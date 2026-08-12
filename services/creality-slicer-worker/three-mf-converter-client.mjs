import { Worker } from 'node:worker_threads';

export async function convert3mfInWorker(inputPath, outputPath, timeoutMs) {
  return await new Promise((resolve, reject) => {
    let settled = false;
    const conversionWorker = new Worker(
      new URL('./three-mf-converter-worker.mjs', import.meta.url),
      {
        workerData: { inputPath, outputPath },
        execArgv: process.execArgv.filter((argument) => !argument.startsWith('--input-type')),
      }
    );
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => {
        conversionWorker.terminate().catch(() => undefined);
        reject(new Error('3MF compatibility conversion timed out'));
      });
    }, timeoutMs);
    conversionWorker.once('message', (message) => {
      finish(() => {
        if (message?.ok) resolve(message.result);
        else reject(new Error(message?.error || '3MF conversion failed'));
      });
    });
    conversionWorker.once('error', (error) => finish(() => reject(error)));
    conversionWorker.once('exit', (code) => {
      if (code !== 0) {
        finish(() => reject(new Error(`3MF conversion worker exited with code ${code}`)));
      }
    });
  });
}
