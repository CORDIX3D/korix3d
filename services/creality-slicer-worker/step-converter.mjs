import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';

function outputTail(current, chunk) {
  return `${current}${chunk}`.slice(-8_000);
}

export async function convertStepToStl({
  binary,
  scriptPath,
  inputPath,
  outputPath,
  environment,
  timeoutMs,
}) {
  let stdout = '';
  let stderr = '';

  await new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(binary, [scriptPath], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...environment,
        KORIX_STEP_INPUT: inputPath,
        KORIX_STEP_OUTPUT: outputPath,
      },
      cwd: dirname(binary),
    });
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
      finish(() => reject(new Error('STEP compatibility conversion timed out')));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout = outputTail(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = outputTail(stderr, chunk); });
    child.once('error', (error) => finish(() => reject(error)));
    child.once('close', (code) => finish(() => {
      if (code === 0) resolve();
      else {
        const details = stderr.trim() || stdout.trim();
        reject(new Error(
          `FreeCAD STEP conversion exited with code ${code}${details ? `: ${details}` : ''}`
        ));
      }
    }));
  });

  const output = await stat(outputPath).catch(() => null);
  if (!output || output.size <= 84) {
    throw new Error('FreeCAD STEP conversion did not create a valid STL mesh');
  }
  return { outputBytes: output.size };
}
