import { parentPort, workerData } from 'node:worker_threads';
import { convert3mfToBinaryStl } from './three-mf-to-stl.mjs';

try {
  const result = await convert3mfToBinaryStl(workerData.inputPath, workerData.outputPath);
  parentPort?.postMessage({ ok: true, result });
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : '3MF conversion failed',
  });
}
