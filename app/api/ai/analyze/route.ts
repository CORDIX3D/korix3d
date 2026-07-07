import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(url, key);
}

interface STLAnalysis {
  fileName: string;
  fileSize: number;
  dimensions: {
    width: number;
    depth: number;
    height: number;
    unit: string;
  };
  volume: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  recommendedMaterials: string[];
  estimatedPrintingTime: number;
  estimatedFilamentUsage: number;
  recommendedLayerHeight: number;
  possibleIssues: string[];
}

function parseSTL(buffer: Buffer): { triangles: number[][][]; boundingBox: { min: number[]; max: number[] } } {
  // Check if binary or ASCII STL
  const isBinary = buffer.toString('ascii', 0, 6) !== 'solid ';

  let triangles: number[][][] = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  if (isBinary) {
    // Binary STL format
    const numTriangles = buffer.readUInt32LE(80);
    let offset = 84;

    for (let i = 0; i < Math.min(numTriangles, 100000); i++) {
      const normal = [
        buffer.readFloatLE(offset),
        buffer.readFloatLE(offset + 4),
        buffer.readFloatLE(offset + 8)
      ];
      offset += 12;

      const v1 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
      offset += 12;
      const v2 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
      offset += 12;
      const v3 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
      offset += 12;

      const attr = buffer.readUInt16LE(offset);
      offset += 2;

      triangles.push([v1, v2, v3]);

      for (const v of [v1, v2, v3]) {
        minX = Math.min(minX, v[0]);
        minY = Math.min(minY, v[1]);
        minZ = Math.min(minZ, v[2]);
        maxX = Math.max(maxX, v[0]);
        maxY = Math.max(maxY, v[1]);
        maxZ = Math.max(maxZ, v[2]);
      }
    }
  } else {
    // ASCII STL format
    const content = buffer.toString('utf8');
    const vertexRegex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
    let match;

    while ((match = vertexRegex.exec(content)) !== null) {
      const v = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
      minX = Math.min(minX, v[0]);
      minY = Math.min(minY, v[1]);
      minZ = Math.min(minZ, v[2]);
      maxX = Math.max(maxX, v[0]);
      maxY = Math.max(maxY, v[1]);
      maxZ = Math.max(maxZ, v[2]);
    }
  }

  return {
    triangles,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    }
  };
}

function calculateVolume(triangles: number[][][]): number {
  let volume = 0;

  for (const tri of triangles) {
    const [v1, v2, v3] = tri;
    // Signed volume of a tetrahedron
    volume += (
      v1[0] * (v2[1] * v3[2] - v3[1] * v2[2]) +
      v2[0] * (v3[1] * v1[2] - v1[1] * v3[2]) +
      v3[0] * (v1[1] * v2[2] - v2[1] * v1[2])
    ) / 6;
  }

  return Math.abs(volume);
}

function estimatePrintingTime(volume: number, boundingMax: number[], layerHeight: number): number {
  // Simplified estimation based on volume and dimensions
  // Real printers would need slicer settings
  const infillPercentage = 0.2; // Assume 20% infill
  const effectiveVolume = volume * (0.1 + infillPercentage * 0.9);

  // Speed estimation: ~60mm/s average
  const maxDimension = Math.max(...boundingMax);
  const layers = maxDimension / layerHeight;

  // Estimated time in hours (very rough)
  const hours = (effectiveVolume / 1000) * 2 + layers * 0.01;

  return Math.round(hours * 10) / 10;
}

function estimateFilamentUsage(volume: number, infillPercentage: number = 0.2): number {
  // Volume in mm³ to grams (PLA density ~1.24 g/cm³)
  const effectiveVolume = volume * (0.1 + infillPercentage * 0.9);
  const density = 1.24; // g/cm³ for PLA
  const weightGrams = (effectiveVolume / 1000) * density;

  // Add 10% for support and brim
  return Math.round(weightGrams * 1.1);
}

function recommendMaterials(boundingBox: number[]): { materials: string[]; layerHeight: number } {
  const maxDim = Math.max(...boundingBox);

  const materials: string[] = [];
  let layerHeight = 0.2;

  if (maxDim < 50) {
    // Small detailed parts
    materials.push('PLA', 'PETG', 'ABS');
    layerHeight = 0.12;
  } else if (maxDim < 100) {
    // Medium parts
    materials.push('PLA', 'PETG', 'ABS', 'Nylon');
    layerHeight = 0.16;
  } else if (maxDim < 200) {
    // Large parts
    materials.push('PLA', 'PETG', 'ASA', 'Nylon');
    layerHeight = 0.2;
  } else {
    // Very large parts
    materials.push('PETG', 'ASA', 'Nylon', 'TPU');
    layerHeight = 0.28;
  }

  return { materials, layerHeight };
}

function identifyPossibleIssues(boundingBox: { min: number[]; max: number[] }, volume: number): string[] {
  const issues: string[] = [];
  const dimensions = boundingBox.max.map((v, i) => v - boundingBox.min[i]);
  const maxDim = Math.max(...dimensions);
  const minDim = Math.min(...dimensions);

  // Check overhangs (simplified)
  if (minDim < 1) {
    issues.push('Model posiada bardzo cienkie elementy które mogą wymagać supportów');
  }

  // Check size
  if (maxDim > 300) {
    issues.push('Model jest duży - może wymagać podziału na części');
  }

  // Check aspect ratio
  const aspectRatio = maxDim / minDim;
  if (aspectRatio > 20) {
    issues.push('Model ma bardzo chudy kształt - może być podatny na deformację');
  }

  // Check volume vs surface area (simplified)
  if (volume < 100 && maxDim > 20) {
    issues.push('Model ma cienkie ścianki - sprawdź czy model jest zalidny');
  }

  return issues;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'Brak pliku' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Plik zbyt duży (max 50MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.stl')) {
      return new Response(JSON.stringify({ error: 'Dozwolone są tylko pliki STL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse STL
    const { triangles, boundingBox } = parseSTL(buffer);

    // Calculate volume
    const volume = calculateVolume(triangles);

    // Dimensions
    const width = boundingBox.max[0] - boundingBox.min[0];
    const depth = boundingBox.max[1] - boundingBox.min[1];
    const height = boundingBox.max[2] - boundingBox.min[2];

    // Recommendations
    const { materials, layerHeight } = recommendMaterials([width, depth, height]);
    const filamentUsage = estimateFilamentUsage(volume);
    const printingTime = estimatePrintingTime(volume, boundingBox.max, layerHeight);
    const issues = identifyPossibleIssues(boundingBox, volume);

    const analysis: STLAnalysis = {
      fileName: file.name,
      fileSize: file.size,
      dimensions: {
        width: Math.round(width * 10) / 10,
        depth: Math.round(depth * 10) / 10,
        height: Math.round(height * 10) / 10,
        unit: 'mm'
      },
      volume: Math.round(volume * 100) / 100,
      boundingBox: {
        min: { x: boundingBox.min[0], y: boundingBox.min[1], z: boundingBox.min[2] },
        max: { x: boundingBox.max[0], y: boundingBox.max[1], z: boundingBox.max[2] }
      },
      recommendedMaterials: materials,
      estimatedPrintingTime: printingTime,
      estimatedFilamentUsage: filamentUsage,
      recommendedLayerHeight: layerHeight,
      possibleIssues: issues
    };

    // Store analysis result
    if (conversationId) {
      await getSupabaseAdmin()
        .from('ai_file_uploads')
        .insert({
          conversation_id: conversationId,
          user_id: user?.id || null,
          file_name: file.name,
          file_type: 'stl',
          file_size: file.size,
          analysis_result: analysis
        });
    }

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analysis error:', error);

    return new Response(JSON.stringify({
      error: 'Nie udało się przeanalizować pliku. Sprawdź czy plik STL jest poprawny.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
