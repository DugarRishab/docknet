// central/utils/runPythonReport.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_ROOT || path.join(__dirname, '../data');
const pythonBin = process.env.PYTHON_BIN || 'python';

/**
 * Spawn Python script to generate run report
 * @param {Object} options
 * @param {number} options.runId - The run ID to analyze
 * @param {string} options.outDir - Output directory for the report
 * @param {number} [options.timeoutMs=120000] - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string, outDir: string}>}
 */
function runPythonReport({ runId, outDir, timeoutMs = 120000 }) {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists and is empty (idempotent)
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.mkdirSync(outDir, { recursive: true });
    } catch (err) {
      return reject(new Error(`Failed to prepare output directory: ${err.message}`));
    }

    const dbFile = process.env.SQLITE_FILE || path.join(dataDir, 'db.sqlite3');
    const scriptPath = path.join(__dirname, '../scripts/analyze_run.py');

    const args = [
      scriptPath,
      '--run-id', String(runId),
      '--db', dbFile,
      '--out', outDir
    ];

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(pythonBin, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        return reject(new Error(`Report generation timed out after ${timeoutMs}ms`));
      }

      if (code !== 0) {
        // Capture last 2KB of stderr for error message
        const lastErr = stderr.slice(-2048) || '(no stderr)';
        return reject(new Error(`Report generation failed (exit ${code}): ${lastErr}`));
      }

      resolve({ stdout, stderr, outDir });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

module.exports = { runPythonReport };
