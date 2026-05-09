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
 * @param {number} [options.timeoutMs=300000] - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string, outDir: string}>}
 */
function runPythonReport({ runId, outDir, timeoutMs = 600000 }) {
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

/**
 * Spawn Python multi-run analysis script
 * @param {Object} options
 * @param {Array<number>} [options.runIds] - Specific run IDs to analyze
 * @param {Object} [options.filters] - Filter criteria for selecting runs
 * @param {string} options.outDir - Output directory for the report
 * @param {number} [options.timeoutMs=600000] - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string, outDir: string}>}
 */
function runMultiRunPythonReport({ runIds, filters, outDir, timeoutMs = 600000 }) {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.mkdirSync(outDir, { recursive: true });
    } catch (err) {
      return reject(new Error(`Failed to prepare output directory: ${err.message}`));
    }

    const dbFile = process.env.SQLITE_FILE || path.join(dataDir, 'db.sqlite3');
    const scriptPath = path.join(__dirname, '../scripts/analyze_multi_run.py');

    const args = [scriptPath, '--db', dbFile, '--out', outDir];

    if (runIds && runIds.length > 0) {
      args.push('--run-ids', runIds.join(','));
    } else if (filters) {
      args.push('--use-filters');
      if (filters.nodeRange) args.push('--node-range', `${filters.nodeRange[0]},${filters.nodeRange[1]}`);
      if (filters.txRange) args.push('--tx-range', `${filters.txRange[0]},${filters.txRange[1]}`);
      if (filters.txDelay != null) args.push('--tx-delay', String(filters.txDelay));
      if (filters.maxPeers != null) args.push('--max-peers', String(filters.maxPeers));
      if (filters.pow != null) args.push('--pow', String(filters.pow));
      if (filters.wait != null) args.push('--wait', String(filters.wait));
      if (filters.status) args.push('--status', filters.status);
      if (filters.dateFrom) args.push('--date-from', filters.dateFrom);
      if (filters.dateTo) args.push('--date-to', filters.dateTo);
    }

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
        return reject(new Error(`Multi-run report generation timed out after ${timeoutMs}ms`));
      }

      if (code !== 0) {
        const lastErr = stderr.slice(-2048) || '(no stderr)';
        return reject(new Error(`Multi-run report generation failed (exit ${code}): ${lastErr}`));
      }

      resolve({ stdout, stderr, outDir });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

module.exports = { runPythonReport, runMultiRunPythonReport };
