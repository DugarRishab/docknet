const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve('./data'); // final layout: data/runX/nodeY/*.csv
fs.mkdirSync(DATA_ROOT, { recursive: true });

async function writeAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.part-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
    await fs.promises.writeFile(tmp, data);
    await fs.promises.rename(tmp, filePath);
}

const saveArrayToFile = async (data, filePath) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    // primitives (string/number/boolean)
    if (typeof data[0] !== 'object' || data[0] === null) {
        // one-value-per-line, no header
        const lines = data.map((v) => quoteCell(String(v))).join('\n') + '\n';
        await writeAtomic(filePath, lines);
        return {
            path: filePath,
            rows: data.length,
            bytes: Buffer.byteLength(lines),
        };
    }

    // Build header order while detecting special "array-of-objects" fields to expand
    const seen = new Set();
    const keysOrder = []; // final header order (includes expanded column names)
    const expandMap = new Map(); // originalKey -> {tsKey, idKey, idFieldName}

    for (const row of data) {
        if (!row || typeof row !== 'object') continue;
        for (const k of Object.keys(row)) {
            if (seen.has(k)) continue;

            const val = row[k];
            // detect array-of-objects with timestamp + id-like field
            if (
                Array.isArray(val) &&
                val.length > 0 &&
                typeof val[0] === 'object' &&
                val[0] !== null
            ) {
                // check presence of timestamp and an id field
                const sample = val[0];
                const hasTs =
                    Object.prototype.hasOwnProperty.call(sample, 'timestamp') ||
                    Object.prototype.hasOwnProperty.call(sample, 'ts');
                const idField = ['uid', 'nodeId', 'node_id', 'id'].find((f) =>
                    Object.prototype.hasOwnProperty.call(sample, f)
                );
                if (hasTs && idField) {
                    const tsKey = `${k}_timestamp`;
                    const idKey = `${k}_node_id`;
                    expandMap.set(k, { tsKey, idKey, idField });
                    // add expanded keys to header order
                    keysOrder.push(tsKey, idKey);
                    seen.add(k);
                    continue;
                }
            }

            // normal key
            keysOrder.push(k);
            seen.add(k);
        }
    }

    // Build CSV lines
    const lines = [];
    // Header
    lines.push(keysOrder.map(quoteCell).join(','));

    for (const row of data) {
        const rowVals = [];
        for (const headerKey of keysOrder) {
            // If headerKey corresponds to an expanded column, we need to find original key
            const expandEntry = Array.from(expandMap.entries()).find(
                ([, v]) => v.tsKey === headerKey || v.idKey === headerKey
            );
            if (expandEntry) {
                const [origKey, cfg] = expandEntry;
                const arr = Array.isArray(row[origKey]) ? row[origKey] : [];
                if (headerKey === cfg.tsKey) {
                    // collect timestamps
                    const tsList = arr
                        .map((it) => {
                            if (it == null) return '';
                            if (
                                Object.prototype.hasOwnProperty.call(
                                    it,
                                    'timestamp'
                                )
                            )
                                return String(it.timestamp);
                            if (Object.prototype.hasOwnProperty.call(it, 'ts'))
                                return String(it.ts);
                            return JSON.stringify(it);
                        })
                        .filter((x) => x !== '');
                    rowVals.push(quoteCell(tsList.join(';')));
                } else {
                    // id column
                    const idList = arr
                        .map((it) => {
                            if (it == null) return '';
                            const idField = cfg.idField;
                            if (
                                Object.prototype.hasOwnProperty.call(
                                    it,
                                    idField
                                )
                            )
                                return String(it[idField]);
                            return JSON.stringify(it);
                        })
                        .filter((x) => x !== '');
                    rowVals.push(quoteCell(idList.join(';')));
                }
                continue;
            }

            // Normal header key:
            const v = row[headerKey];
            if (v === undefined || v === null) {
                rowVals.push(''); // empty cell
                continue;
            }

            // if nested object or array -> JSON.stringify it
            if (typeof v === 'object') {
                try {
                    rowVals.push(quoteCell(JSON.stringify(v)));
                } catch (e) {
                    rowVals.push(quoteCell(String(v)));
                }
            } else {
                // primitive
                rowVals.push(quoteCell(String(v)));
            }
        }
        lines.push(rowVals.join(','));
    }

    const csv = lines.join('\n') + '\n';
    await writeAtomic(filePath, csv);

    return { path: filePath, rows: data.length, bytes: Buffer.byteLength(csv) };
};

function quoteCell(s) {
    if (s === undefined || s === null) s = '';
    s = String(s);
    // needs quoting if contains comma, newline or quote
    const needs = /[,\n"]/;
    if (!needs.test(s)) return s;
    return `"${s.replace(/"/g, '""')}"`;
}

module.exports = {
	saveArrayToFile,
}