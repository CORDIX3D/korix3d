import { readFile, writeFile } from 'node:fs/promises';
import { posix } from 'node:path';
import JSZip from 'jszip';

const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const unitScale = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1].split(':').pop().toLowerCase()] = match[2] ?? match[3] ?? '';
  }
  return result;
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`3MF contains an invalid ${label}`);
  return number;
}

function transform(value) {
  if (!value) return identity;
  const values = value.trim().split(/\s+/).map((entry) => finite(entry, 'transform'));
  if (values.length !== 12) throw new Error('3MF transform must contain 12 numbers');
  return values;
}

// 3MF uses row-vector affine transforms; local * parent preserves component order.
function multiply(left, right) {
  const matrix = (value) => [
    [value[0], value[1], value[2], 0],
    [value[3], value[4], value[5], 0],
    [value[6], value[7], value[8], 0],
    [value[9], value[10], value[11], 1],
  ];
  const l = matrix(left);
  const r = matrix(right);
  const out = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let index = 0; index < 4; index += 1) out[row][column] += l[row][index] * r[index][column];
    }
  }
  return [out[0][0], out[0][1], out[0][2], out[1][0], out[1][1], out[1][2], out[2][0], out[2][1], out[2][2], out[3][0], out[3][1], out[3][2]];
}

function apply(point, matrix, scale) {
  const [x, y, z] = point;
  return [
    (x * matrix[0] + y * matrix[3] + z * matrix[6] + matrix[9]) * scale,
    (x * matrix[1] + y * matrix[4] + z * matrix[7] + matrix[10]) * scale,
    (x * matrix[2] + y * matrix[5] + z * matrix[8] + matrix[11]) * scale,
  ];
}

function determinant(matrix) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function normal(a, b, c) {
  const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const [nx, ny, nz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function normalizeModelPath(value, currentPath = '') {
  let decoded;
  try {
    decoded = decodeURIComponent(String(value || '').replace(/\\/g, '/'));
  } catch {
    decoded = String(value || '').replace(/\\/g, '/');
  }
  if (!decoded) return currentPath;
  const combined = decoded.startsWith('/')
    ? decoded.slice(1)
    : posix.join(posix.dirname(currentPath), decoded);
  return posix.normalize(combined).replace(/^\.\.\//g, '');
}

function parseModel(xml, modelPath) {
  const modelAttributes = attributes(xml.match(/<(?:[\w.-]+:)?model\b([^>]*)>/i)?.[1] || '');
  const scale = unitScale[String(modelAttributes.unit || 'millimeter').toLowerCase()];
  if (!scale) throw new Error(`Unsupported 3MF unit: ${modelAttributes.unit}`);
  const objects = new Map();
  for (const objectMatch of xml.matchAll(/<(?:[\w.-]+:)?object\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?object>/gi)) {
    const id = attributes(objectMatch[1]).id;
    if (!id) continue;
    const body = objectMatch[2];
    const vertices = [...body.matchAll(/<(?:[\w.-]+:)?vertex\b([^>]*)\/?\s*>/gi)].map((match) => {
      const value = attributes(match[1]);
      return [finite(value.x, 'vertex'), finite(value.y, 'vertex'), finite(value.z, 'vertex')];
    });
    const triangles = [...body.matchAll(/<(?:[\w.-]+:)?triangle\b([^>]*)\/?\s*>/gi)].map((match) => {
      const value = attributes(match[1]);
      return [finite(value.v1, 'triangle index'), finite(value.v2, 'triangle index'), finite(value.v3, 'triangle index')];
    });
    const components = [...body.matchAll(/<(?:[\w.-]+:)?component\b([^>]*)\/?\s*>/gi)].map((match) => {
      const value = attributes(match[1]);
      return {
        objectId: value.objectid,
        modelPath: value.path || null,
        transform: transform(value.transform),
      };
    });
    objects.set(id, { vertices, triangles, components });
  }
  const buildBody = xml.match(/<(?:[\w.-]+:)?build\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?build>/i)?.[1] || '';
  const items = [...buildBody.matchAll(/<(?:[\w.-]+:)?item\b([^>]*)\/?\s*>/gi)].map((match) => {
    const value = attributes(match[1]);
    return {
      objectId: value.objectid,
      modelPath: value.path || null,
      transform: transform(value.transform),
    };
  });
  return { path: modelPath, objects, items, scale };
}

function visitTriangles(model, onTriangle) {
  let triangleCount = 0;
  const resolvePath = (value, currentPath) => {
    const normalized = normalizeModelPath(value, currentPath);
    return model.paths.get(normalized.toLowerCase()) || normalized;
  };
  const visit = (modelPath, objectId, parentTransform, stack) => {
    const reference = `${modelPath.toLowerCase()}#${objectId}`;
    if (!objectId || stack.has(reference) || stack.size > 64) throw new Error('3MF contains a cyclic or invalid component hierarchy');
    const document = model.documents.get(modelPath);
    if (!document) throw new Error(`3MF references missing model part ${modelPath}`);
    if (document.scale !== model.root.scale) throw new Error('3MF model parts use incompatible units');
    const object = document.objects.get(objectId);
    if (!object) throw new Error(`3MF references missing object ${objectId} in ${modelPath}`);
    const nextStack = new Set(stack).add(reference);
    const mirrored = determinant(parentTransform) < 0;
    for (const indices of object.triangles) {
      const vertices = indices.map((index) => object.vertices[index]);
      if (vertices.some((vertex) => !vertex)) throw new Error('3MF triangle references a missing vertex');
      const transformed = vertices.map((vertex) => apply(vertex, parentTransform, model.root.scale));
      if (mirrored) [transformed[1], transformed[2]] = [transformed[2], transformed[1]];
      triangleCount += 1;
      if (triangleCount > 5_000_000) throw new Error('3MF contains too many triangles');
      onTriangle?.(transformed);
    }
    for (const component of object.components) {
      visit(
        resolvePath(component.modelPath, modelPath),
        component.objectId,
        multiply(component.transform, parentTransform),
        nextStack
      );
    }
  };
  for (const item of model.root.items) {
    visit(
      resolvePath(item.modelPath, model.root.path),
      item.objectId,
      item.transform,
      new Set()
    );
  }
  if (!triangleCount) throw new Error('3MF does not contain a printable triangle mesh');
  return triangleCount;
}

function binaryStl(model, triangleCount) {
  const buffer = Buffer.allocUnsafe(84 + triangleCount * 50);
  buffer.fill(0, 0, 80);
  buffer.write('KORIX3D 3MF compatibility conversion', 0, 'ascii');
  buffer.writeUInt32LE(triangleCount, 80);
  let offset = 84;
  visitTriangles(model, (triangle) => {
    for (const value of [...normal(...triangle), ...triangle.flat()]) {
      buffer.writeFloatLE(value, offset);
      offset += 4;
    }
    buffer.writeUInt16LE(0, offset);
    offset += 2;
  });
  return buffer;
}

export async function convert3mfToBinaryStl(inputPath, outputPath) {
  const zip = await JSZip.loadAsync(await readFile(inputPath));
  const entries = Object.values(zip.files);
  const modelEntry = entries.find((entry) => !entry.dir && /(?:^|\/)3dmodel\.model$/i.test(entry.name))
    || entries.find((entry) => !entry.dir && /\.model$/i.test(entry.name));
  if (!modelEntry) throw new Error('3MF archive does not contain a model document');
  const modelEntries = entries.filter((entry) => !entry.dir && /\.model$/i.test(entry.name));
  const documents = new Map();
  const paths = new Map();
  const parsedDocuments = await Promise.all(modelEntries.map(async (entry) => {
    const modelPath = normalizeModelPath(entry.name);
    return [modelPath, parseModel(await entry.async('string'), modelPath)];
  }));
  for (const [modelPath, document] of parsedDocuments) {
    documents.set(modelPath, document);
    paths.set(modelPath.toLowerCase(), modelPath);
  }
  const rootPath = paths.get(normalizeModelPath(modelEntry.name).toLowerCase());
  const root = rootPath ? documents.get(rootPath) : null;
  if (!root?.objects.size || !root.items.length) {
    throw new Error('3MF does not contain printable build items');
  }
  const model = { documents, paths, root };
  const triangleCount = visitTriangles(model);
  await writeFile(outputPath, binaryStl(model, triangleCount));
  return { triangleCount };
}
