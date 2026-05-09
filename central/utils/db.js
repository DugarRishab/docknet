// central/utils/db.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Use DATA_ROOT if available (for Docker), otherwise fall back to relative path
const dataDir = process.env.DATA_ROOT || path.join(__dirname, "../data");
const file = process.env.SQLITE_FILE || path.join(dataDir, "db.sqlite3");

const db = new sqlite3.Database(file, (err) => {
	if (err) {
		console.error("Failed to open DB:", err);
		process.exit(1);
	}
	console.log(`SQLite DB opened at ${file}`);
});

// Initialize all tables with proper constraints and indexes
db.serialize(() => {
	// Drop legacy tables (safe since they are unused)
	db.run(`DROP TABLE IF EXISTS telemetry`);
	db.run(`DROP TABLE IF EXISTS unique_transactions`);

	// Runs table
	db.run(`
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER UNIQUE NOT NULL,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME,
            node_count INTEGER,
            nodes_expected INTEGER,
            nodes_reported INTEGER DEFAULT 0,
            status TEXT CHECK(status IN ('running', 'complete', 'incomplete')) DEFAULT 'running'
        )
    `);

	// Nodes table with UNIQUE constraints for race-condition safety
	db.run(`
        CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            node_index INTEGER NOT NULL,
            original_node_id TEXT NOT NULL,
            node_ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(run_id, node_index),
            UNIQUE(run_id, original_node_id),
            FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
        )
    `);

	// Transactions table with UNIQUE constraint for idempotency
	db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id INTEGER NOT NULL,
            transaction_id TEXT NOT NULL,
            sender TEXT,
            receiver TEXT,
            amount REAL,
            unit TEXT,
            price_per_unit REAL,
            currency TEXT,
            timestamp INTEGER,
            parents TEXT,
            cumulative_weight INTEGER,
            signature1 TEXT,
            signature2 TEXT,
            checksum TEXT,
            last_updated INTEGER,
            weight_map TEXT,
            consensus_timestamp INTEGER,
            consensus_duration INTEGER,
            verification_timestamp INTEGER,
            verification_duration INTEGER,
            pow_duration INTEGER,
            tsa_duration INTEGER,
            completion_duration INTEGER,
            propagation_delay INTEGER,
            avg_propagation_delay INTEGER,
            UNIQUE(node_id, transaction_id),
            FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
    `);

	// Transaction hops with proper indexing
	db.run(`
        CREATE TABLE IF NOT EXISTS transaction_hops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            hop_index INTEGER NOT NULL,
            timestamp INTEGER,
            hop_node_id TEXT,
            UNIQUE(transaction_id, hop_index),
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
        )
    `);

	// Peers table
	db.run(`
        CREATE TABLE IF NOT EXISTS peers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id INTEGER NOT NULL,
            peer_node_id TEXT NOT NULL,
            peer_address TEXT,
            peer_port INTEGER,
            peer_uri TEXT,
            state INTEGER,
            connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(node_id, peer_node_id),
            FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
    `);

	// Metrics table
	db.run(`
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id INTEGER NOT NULL,
            ts TEXT,
            cpu_percent REAL,
            ram_total_mb INTEGER,
            ram_used_mb INTEGER,
            net_bytes_sent INTEGER,
            net_bytes_recv INTEGER,
            FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
    `);

	// Run parameters table
	db.run(`
        CREATE TABLE IF NOT EXISTS run_params (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL UNIQUE,
            node_count INTEGER,
            tx_count INTEGER,
            tx_delay INTEGER,
            max_peers INTEGER,
            pow INTEGER,
            wait INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
        )
    `);

	// Tangle consistency table (optional cache)
	db.run(`
        CREATE TABLE IF NOT EXISTS tangle_consistency (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL UNIQUE,
            total_unique_transactions INTEGER,
            fully_replicated_count INTEGER,
            partially_replicated_count INTEGER,
            missing_tx_pairs TEXT,
            metadata_diff_count INTEGER,
            conflict_count INTEGER,
            consistency_score REAL,
            computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
        )
    `);

	// Simulation queue table
	db.run(`
        CREATE TABLE IF NOT EXISTS simulation_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position INTEGER NOT NULL,
            label TEXT,
            node_count INTEGER NOT NULL,
            tx_count INTEGER NOT NULL,
            tx_delay INTEGER NOT NULL,
            max_peers INTEGER NOT NULL,
            pow INTEGER NOT NULL,
            wait INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending','started','completed','error')) DEFAULT 'pending',
            run_id INTEGER,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            started_at DATETIME,
            completed_at DATETIME
        )
    `);
	db.run(`CREATE INDEX IF NOT EXISTS idx_simulation_queue_status_position ON simulation_queue(status, position)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_simulation_queue_run_id ON simulation_queue(run_id)`);

	// Indexes for performance
	db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_tx_id ON transactions(transaction_id)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_node_id ON transactions(node_id)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_transaction_hops_tx_id ON transaction_hops(transaction_id)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_peers_node_id ON peers(node_id)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_node_ts ON metrics(node_id, ts)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_run_params_run_id ON run_params(run_id)`);
});

// Transaction wrapper for atomic operations
function withTransaction(fn) {
	return new Promise((resolve, reject) => {
		db.run("BEGIN IMMEDIATE", (err) => {
			if (err) return reject(err);
			Promise.resolve(fn())
				.then((result) => {
					db.run("COMMIT", (commitErr) => {
						if (commitErr) return reject(commitErr);
						resolve(result);
					});
				})
				.catch((error) => {
					db.run("ROLLBACK", () => reject(error));
				});
		});
	});
}

// ========== RUN MANAGEMENT ==========

// Run management
function getOrCreateRun(runId) {
	return new Promise((resolve, reject) => {
		db.get(`SELECT * FROM runs WHERE run_id = ?`, [runId], (err, row) => {
			if (err) return reject(err);
			if (row) return resolve(row);

			// Create new run
			const stmt = db.prepare(`
                INSERT INTO runs (run_id, status) VALUES (?, 'running')
            `);
			stmt.run(runId, function(err) {
				if (err) return reject(err);
				db.get(`SELECT * FROM runs WHERE id = ?`, [this.lastID], (err, newRow) => {
					if (err) reject(err);
					else resolve(newRow);
				});
			});
			stmt.finalize();
		});
	});
}

function completeRun(runId) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(`
            UPDATE runs SET ended_at = CURRENT_TIMESTAMP, status = 'complete' WHERE run_id = ?
        `);
		stmt.run(runId, function(err) {
			if (err) reject(err);
			else resolve({ changes: this.changes });
		});
		stmt.finalize();
	});
}

// Count unique nodes that have sent data for a run
function countNodesForRun(internalRunId) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT COUNT(DISTINCT original_node_id) as count FROM nodes WHERE run_id = ?`,
			[internalRunId],
			(err, row) => {
				if (err) reject(err);
				else resolve(row ? row.count : 0);
			}
		);
	});
}

// Update run status based on node count vs expected count
async function updateRunCompletionStatus(internalRunId) {
	return new Promise(async (resolve, reject) => {
		try {
			// Get run details
			const run = await new Promise((res, rej) => {
				db.get(`SELECT * FROM runs WHERE id = ?`, [internalRunId], (err, row) => {
					if (err) rej(err);
					else res(row);
				});
			});

			if (!run || !run.nodes_expected) {
				return resolve({ updated: false, reason: 'no_expected_count' });
			}

			// Count unique nodes
			const nodesReported = await countNodesForRun(internalRunId);

			// Determine status
			let newStatus = run.status;
			if (nodesReported >= run.nodes_expected) {
				newStatus = 'complete';
			} else if (nodesReported > 0) {
				newStatus = 'incomplete';
			}

			// Update if changed
			if (newStatus !== run.status) {
				db.run(
					`UPDATE runs SET status = ?, nodes_reported = ?, ended_at = CASE WHEN ? = 'complete' AND ended_at IS NULL THEN CURRENT_TIMESTAMP ELSE ended_at END WHERE id = ?`,
					[newStatus, nodesReported, newStatus, internalRunId],
					(err) => {
						if (err) reject(err);
						else resolve({
							updated: true,
							oldStatus: run.status,
							newStatus,
							nodesReported,
							nodesExpected: run.nodes_expected
						});
					}
				);
			} else {
				// Just update the count
				db.run(
					`UPDATE runs SET nodes_reported = ? WHERE id = ?`,
					[nodesReported, internalRunId],
					(err) => {
						if (err) reject(err);
						else resolve({
							updated: false,
							status: run.status,
							nodesReported,
							nodesExpected: run.nodes_expected
						});
					}
				);
			}
		} catch (err) {
			reject(err);
		}
	});
}

function listRuns() {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT
				r.id,
				r.run_id,
				r.started_at,
				r.ended_at,
				r.status,
				r.nodes_expected,
				r.nodes_reported,
				COUNT(DISTINCT n.id) AS node_count,
				p.tx_count   AS tx_count,
				p.tx_delay   AS tx_delay,
				p.max_peers  AS max_peers,
				p.pow        AS pow,
				p.wait       AS wait,
				CASE
					WHEN r.ended_at IS NOT NULL
					THEN CAST((julianday(r.ended_at) - julianday(r.started_at)) * 86400000 AS INTEGER)
					ELSE NULL
				END AS duration,
				COUNT(DISTINCT t.transaction_id) AS total_transactions,
				CASE
					WHEN r.nodes_reported > 0
					THEN CAST(COUNT(DISTINCT t.transaction_id) AS REAL) / r.nodes_reported
					ELSE 0
				END AS actual_tx_per_node
			 FROM runs r
			 LEFT JOIN nodes n      ON r.id = n.run_id
			 LEFT JOIN run_params p ON r.id = p.run_id
			 LEFT JOIN transactions t ON n.id = t.node_id
			 GROUP BY r.id
			 ORDER BY r.started_at DESC`,
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Node management
/**
 * Query runs with flexible filter criteria for multi-run analysis
 * @param {Object} filters - Filter criteria
 * @param {Array} [filters.nodeRange] - [min, max] node count range
 * @param {Array} [filters.txRange] - [min, max] tx count range
 * @param {number} [filters.txDelay] - Transaction delay
 * @param {number} [filters.maxPeers] - Max peers per node
 * @param {number} [filters.pow] - PoW difficulty
 * @param {number} [filters.wait] - Wait period
 * @param {string} [filters.status] - Run status
 * @param {string} [filters.dateFrom] - Start date (YYYY-MM-DD)
 * @param {string} [filters.dateTo] - End date (YYYY-MM-DD)
 */
function queryRunsByFilters(filters = {}) {
	return new Promise((resolve, reject) => {
		let conditions = ['1=1'];
		let params = [];

		if (filters.nodeRange && Array.isArray(filters.nodeRange) && filters.nodeRange.length === 2) {
			conditions.push('p.node_count BETWEEN ? AND ?');
			params.push(filters.nodeRange[0], filters.nodeRange[1]);
		}
		if (filters.txRange && Array.isArray(filters.txRange) && filters.txRange.length === 2) {
			conditions.push('p.tx_count BETWEEN ? AND ?');
			params.push(filters.txRange[0], filters.txRange[1]);
		}
		if (filters.txDelay != null) {
			conditions.push('p.tx_delay = ?');
			params.push(filters.txDelay);
		}
		if (filters.maxPeers != null) {
			conditions.push('p.max_peers = ?');
			params.push(filters.maxPeers);
		}
		if (filters.pow != null) {
			conditions.push('p.pow = ?');
			params.push(filters.pow);
		}
		if (filters.wait != null) {
			conditions.push('p.wait = ?');
			params.push(filters.wait);
		}
		if (filters.status) {
			conditions.push('r.status = ?');
			params.push(filters.status);
		}
		if (filters.dateFrom) {
			conditions.push('r.started_at >= ?');
			params.push(filters.dateFrom);
		}
		if (filters.dateTo) {
			conditions.push('r.started_at <= ?');
			params.push(filters.dateTo);
		}

		const whereClause = conditions.join(' AND ');

		db.all(
			`SELECT
				r.id,
				r.run_id,
				r.started_at,
				r.ended_at,
				r.status,
				r.nodes_expected,
				r.nodes_reported,
				p.node_count  AS param_node_count,
				p.tx_count    AS param_tx_count,
				p.tx_delay    AS param_tx_delay,
				p.max_peers   AS param_max_peers,
				p.pow         AS param_pow,
				p.wait        AS param_wait
			 FROM runs r
			 LEFT JOIN run_params p ON r.id = p.run_id
			 WHERE ${whereClause}
			 ORDER BY r.started_at DESC`,
			params,
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

function getOrCreateNode(runId, originalNodeId, nodeIp) {
	return new Promise((resolve, reject) => {
		// First get the run's internal ID
		db.get(`SELECT id FROM runs WHERE run_id = ?`, [runId], (err, run) => {
			if (err) return reject(err);
			if (!run) return reject(new Error(`Run ${runId} not found`));

			// Check if node already exists for this run
			db.get(
				`SELECT * FROM nodes WHERE run_id = ? AND original_node_id = ?`,
				[run.id, originalNodeId],
				(err, existingNode) => {
					if (err) return reject(err);
					if (existingNode) return resolve(existingNode);

					// Get next node index for this run
					db.get(
						`SELECT COALESCE(MAX(node_index), 0) + 1 as next_index FROM nodes WHERE run_id = ?`,
						[run.id],
						(err, result) => {
							if (err) return reject(err);
							const nodeIndex = result.next_index;

							// Create new node
							const stmt = db.prepare(`
                                INSERT INTO nodes (run_id, node_index, original_node_id, node_ip)
                                VALUES (?, ?, ?, ?)
                            `);
							stmt.run(run.id, nodeIndex, originalNodeId, nodeIp, function(err) {
								if (err) return reject(err);
								db.get(
									`SELECT * FROM nodes WHERE id = ?`,
									[this.lastID],
									(err, newNode) => {
										if (err) reject(err);
										else resolve(newNode);
									}
								);
								});
								stmt.finalize();
							}
						);
					}
				);
			}
		);
	});
}

function listNodes(runId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT n.*, r.run_id 
			 FROM nodes n 
			 JOIN runs r ON n.run_id = r.id 
			 WHERE r.run_id = ? 
			 ORDER BY n.node_index`,
			[runId],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Transaction management - uses INSERT OR REPLACE for idempotency
function insertTransaction(nodeId, tx) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(`
            INSERT OR REPLACE INTO transactions (
                node_id, transaction_id, sender, receiver, amount, unit, price_per_unit,
                currency, timestamp, parents, cumulative_weight, signature1, signature2,
                checksum, last_updated, weight_map, consensus_timestamp, consensus_duration,
                verification_timestamp, verification_duration, pow_duration, tsa_duration,
                completion_duration, propagation_delay, avg_propagation_delay
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

		stmt.run(
			nodeId,
			tx.transaction_id,
			tx.sender,
			tx.receiver,
			tx.amount,
			tx.unit,
			tx.price_per_unit,
			tx.currency,
			tx.timestamp,
			JSON.stringify(tx.parents || []),
			tx.cumulative_weight,
			tx.signature1,
			tx.signature2,
			tx.checksum,
			tx.last_updated,
			JSON.stringify(tx.weight_map || []),
			tx.consensus_timestamp,
			tx.consensus_duration,
			tx.verification_timestamp,
			tx.verification_duration,
			tx.pow_duration,
			tx.tsa_duration,
			tx.completion_duration,
			tx.propagation_delay,
			tx.avg_propagation_delay,
			function(err) {
				if (err) reject(err);
				else resolve({ id: this.lastID });
			}
		);
		stmt.finalize();
	});
}

function insertTransactionHop(transactionId, hopIndex, hop) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(`
            INSERT OR REPLACE INTO transaction_hops (transaction_id, hop_index, timestamp, hop_node_id)
            VALUES (?, ?, ?, ?)
        `);
		stmt.run(transactionId, hopIndex, hop.timestamp, hop.nodeId, function(err) {
			if (err) reject(err);
			else resolve({ id: this.lastID });
		});
		stmt.finalize();
	});
}

function getTransactionsByRun(runId, limit = 500, offset = 0) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT t.*, n.original_node_id, n.node_index
			 FROM transactions t
			 JOIN nodes n ON t.node_id = n.id
			 JOIN runs r ON n.run_id = r.id
			 WHERE r.run_id = ?
			 ORDER BY t.timestamp DESC
			 LIMIT ? OFFSET ?`,
			[runId, limit, offset],
			async (err, rows) => {
				if (err) reject(err);
				else {
					// Parse JSON fields and fetch hops for each transaction
					const parsed = await Promise.all(
						rows.map(async (row) => {
							// Fetch hops for this transaction
							const hops = await new Promise((resolveHops, rejectHops) => {
								db.all(
									`SELECT timestamp, hop_node_id as nodeId
									 FROM transaction_hops
									 WHERE transaction_id = ?
									 ORDER BY hop_index`,
									[row.id],
									(errHops, hopRows) => {
										if (errHops) rejectHops(errHops);
										else resolveHops(hopRows || []);
									}
								);
							});

							return {
								...row,
								parents: JSON.parse(row.parents || '[]'),
								weight_map: JSON.parse(row.weight_map || '[]'),
								hops: hops
							};
						})
					);
					resolve(parsed);
				}
			}
		);
	});
}

function getTransactionWithHops(txId, runId) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT t.*, n.original_node_id, n.node_index
			 FROM transactions t
			 JOIN nodes n ON t.node_id = n.id
			 JOIN runs r ON n.run_id = r.id
			 WHERE t.transaction_id = ? AND r.run_id = ?`,
			[txId, runId],
			(err, row) => {
				if (err) return reject(err);
				if (!row) return resolve(null);

				// Get hops for this transaction
				db.all(
					`SELECT hop_index, timestamp, hop_node_id as nodeId FROM transaction_hops WHERE transaction_id = ? ORDER BY hop_index`,
					[row.id],
					(err, hops) => {
						if (err) reject(err);
						else {
							resolve({
								...row,
								parents: JSON.parse(row.parents || '[]'),
								weight_map: JSON.parse(row.weight_map || '[]'),
								hops: hops || []
							});
						}
					}
				);
			}
		);
	});
}

// Peer management
function insertPeer(nodeId, peer) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(`
            INSERT OR REPLACE INTO peers (node_id, peer_node_id, peer_address, peer_port, peer_uri, state)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
		stmt.run(
			nodeId,
			peer.id,
			peer.address,
			peer.port,
			peer.uri,
			peer.state,
			function(err) {
				if (err) reject(err);
				else resolve({ id: this.lastID });
			}
		);
		stmt.finalize();
	});
}

function getPeersByRun(runId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT p.*, n.original_node_id as source_node_id, n.node_index as source_node_index
			 FROM peers p
			 JOIN nodes n ON p.node_id = n.id
			 JOIN runs r ON n.run_id = r.id
			 WHERE r.run_id = ?`,
			[runId],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Metrics management
function insertMetric(nodeId, metric) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(`
            INSERT OR REPLACE INTO metrics (node_id, ts, cpu_percent, ram_total_mb, ram_used_mb, net_bytes_sent, net_bytes_recv)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
		stmt.run(
			nodeId,
			metric.ts,
			metric.cpu_percent,
			metric.ram_total_mb,
			metric.ram_used_mb,
			metric.net_bytes_sent,
			metric.net_bytes_recv,
			function(err) {
				if (err) reject(err);
				else resolve({ id: this.lastID });
			}
		);
		stmt.finalize();
	});
}

function getMetricsByRun(runId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT m.*, n.original_node_id, n.node_index
			 FROM metrics m
			 JOIN nodes n ON m.node_id = n.id
			 JOIN runs r ON n.run_id = r.id
			 WHERE r.run_id = ?
			 ORDER BY m.ts DESC`,
			[runId],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Get peers by specific node ID
function getPeersByNodeId(nodeId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT p.*, n.original_node_id as source_node_id
			 FROM peers p
			 JOIN nodes n ON p.node_id = n.id
			 WHERE p.node_id = ?`,
			[nodeId],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Get metrics by specific node ID
function getMetricsByNodeId(nodeId, limit = 50) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT * FROM metrics
			 WHERE node_id = ?
			 ORDER BY ts DESC
			 LIMIT ?`,
			[nodeId, limit],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Get transaction count by node ID
function getTransactionCountByNode(nodeId) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT COUNT(*) as count FROM transactions WHERE node_id = ?`,
			[nodeId],
			(err, row) => {
				if (err) reject(err);
				else resolve(row ? row.count : 0);
			}
		);
	});
}

// Check if run exists in database
function checkRunExists(runId) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT 1 FROM runs WHERE run_id = ?`,
			[runId],
			(err, row) => {
				if (err) reject(err);
				else resolve(!!row);
			}
		);
	});
}

// Get node details with counts
function getNodeDetailsWithCounts(runId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT
				n.id,
				n.original_node_id,
				n.node_index,
				n.node_ip,
				n.created_at,
				COUNT(DISTINCT t.transaction_id) as transaction_count,
				COUNT(DISTINCT p.id) as peer_count,
				CASE WHEN COUNT(DISTINCT m.id) > 0 THEN 1 ELSE 0 END as has_metrics
			 FROM nodes n
			 LEFT JOIN transactions t ON n.id = t.node_id
			 LEFT JOIN peers p ON n.id = p.node_id
			 LEFT JOIN metrics m ON n.id = m.node_id
			 JOIN runs r ON n.run_id = r.id
			 WHERE r.run_id = ?
			 GROUP BY n.id`,
			[runId],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

// Run summary
function getRunSummary(runId) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT
			    r.*,
			    COUNT(DISTINCT n.id) as total_nodes,
			    COUNT(DISTINCT t.transaction_id) as total_transactions,
			    COUNT(DISTINCT p.id) as total_peer_records,
			    COUNT(DISTINCT m.id) as total_metrics_records
			 FROM runs r
			 LEFT JOIN nodes n ON r.id = n.run_id
			 LEFT JOIN transactions t ON n.id = t.node_id
			 LEFT JOIN peers p ON n.id = p.node_id
			 LEFT JOIN metrics m ON n.id = m.node_id
			 WHERE r.run_id = ?
			 GROUP BY r.id`,
			[runId],
			async (err, row) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				// Get additional metrics from transactions
				try {
					const metrics = await getRunMetrics(runId);
					resolve({ ...row, ...metrics });
				} catch (metricsErr) {
					// If metrics fail, still return basic summary
					resolve(row);
				}
			}
		);
	});
}

// Get additional run metrics for KPIs
function getRunMetrics(runId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT
				t.transaction_id,
				t.cumulative_weight,
				t.verification_duration,
				t.completion_duration,
				t.avg_propagation_delay,
				t.parents,
				t.timestamp
			 FROM transactions t
			 JOIN nodes n ON t.node_id = n.id
			 JOIN runs r ON n.run_id = r.id
			 WHERE r.run_id = ?`,
			[runId],
			(err, rows) => {
				if (err) {
					reject(err);
					return;
				}

				if (!rows || rows.length === 0) {
					resolve({
						unique_transactions: 0,
						max_dag_depth: 0,
						genesis_weight: 0,
						avg_verification_time: 0,
						avg_completion_time: 0,
						avg_propagation_delay: 0
					});
					return;
				}

				// Calculate unique transactions
				const uniqueTxIds = new Set(rows.map(r => r.transaction_id));
				const uniqueTransactions = uniqueTxIds.size;

				// Calculate max DAG depth using parent relationships
				const txMap = new Map();
				rows.forEach(r => {
					txMap.set(r.transaction_id, {
						parents: r.parents ? JSON.parse(r.parents) : [],
						timestamp: r.timestamp
					});
				});

				// Find genesis transactions (no parents) and calculate depths
				const depths = new Map();
				function getDepth(txId, visited = new Set()) {
					if (visited.has(txId)) return 0; // Cycle detection
					if (depths.has(txId)) return depths.get(txId);
					visited.add(txId);

					const tx = txMap.get(txId);
					if (!tx || !tx.parents || tx.parents.length === 0) {
						depths.set(txId, 0);
						return 0;
					}

					const parentDepths = tx.parents.map(p => getDepth(p, new Set(visited)));
					const depth = 1 + Math.max(...parentDepths);
					depths.set(txId, depth);
					return depth;
				}

				let maxDagDepth = 0;
				let genesisWeight = 0;

				for (const txId of uniqueTxIds) {
					const depth = getDepth(txId);
					maxDagDepth = Math.max(maxDagDepth, depth);

					// Genesis transactions have depth 0
					if (depth === 0) {
						const tx = rows.find(r => r.transaction_id === txId);
						if (tx && tx.cumulative_weight) {
							genesisWeight = Math.max(genesisWeight, tx.cumulative_weight);
						}
					}
				}

				// Calculate averages
				const validVerification = rows.filter(r => r.verification_duration > 0);
				const validCompletion = rows.filter(r => r.completion_duration > 0);
				const validPropagation = rows.filter(r => r.avg_propagation_delay > 0);

				const avgVerificationTime = validVerification.length > 0
					? validVerification.reduce((sum, r) => sum + r.verification_duration, 0) / validVerification.length
					: 0;

				const avgCompletionTime = validCompletion.length > 0
					? validCompletion.reduce((sum, r) => sum + r.completion_duration, 0) / validCompletion.length
					: 0;

				const avgPropagationDelay = validPropagation.length > 0
					? validPropagation.reduce((sum, r) => sum + r.avg_propagation_delay, 0) / validPropagation.length
					: 0;

				resolve({
					unique_transactions: uniqueTransactions,
					max_dag_depth: maxDagDepth,
					genesis_weight: genesisWeight,
					avg_verification_time: Math.round(avgVerificationTime),
					avg_completion_time: Math.round(avgCompletionTime),
					avg_propagation_delay: Math.round(avgPropagationDelay)
				});
			}
		);
	});
}

// ========== ATOMIC BATCH INGESTION ==========

async function saveTelemetryBatch(runId, nodeId, nodeIp, data) {
	return withTransaction(async () => {
		const run = await getOrCreateRun(runId);
		const node = await getOrCreateNode(runId, nodeId, nodeIp);

		const counts = { tx: 0, hops: 0, peers: 0, metrics: 0 };

		// Save transactions
		if (data.tangle && Array.isArray(data.tangle) && data.tangle.length > 0) {
			for (const tx of data.tangle) {
				const txData = {
					transaction_id: tx.data?.transaction_id,
					sender: tx.data?.sender,
					receiver: tx.data?.receiver,
					amount: tx.data?.amount,
					unit: tx.data?.unit,
					price_per_unit: tx.data?.price_per_unit,
					currency: tx.data?.currency,
					timestamp: tx.data?.timestamp,
					parents: tx.data?.parents || [],
					cumulative_weight: tx.metadata?.cumulative_weight,
					signature1: tx.metadata?.signature1,
					signature2: tx.metadata?.signature2,
					checksum: tx.metadata?.checksum,
					last_updated: tx.metadata?.lastUpdated,
					weight_map: tx.metadata?.weightMap || [],
					consensus_timestamp: tx.metadata?.consensusTimestamp,
					consensus_duration: tx.metadata?.consensusDuration,
					verification_timestamp: tx.metadata?.verificationTimestamp,
					verification_duration: tx.metadata?.verificationDuration,
					pow_duration: tx.metadata?.powDuration,
					tsa_duration: tx.metadata?.tsaDuration,
					completion_duration: tx.metadata?.completionDuration,
					propagation_delay: tx.metadata?.propagationDelay,
					avg_propagation_delay: tx.metadata?.avgPropagationDelay
				};

				const result = await insertTransaction(node.id, txData);
				counts.tx++;

				// Save hops
				if (tx.metadata?.hops && Array.isArray(tx.metadata.hops)) {
					for (let i = 0; i < tx.metadata.hops.length; i++) {
						const hop = tx.metadata.hops[i];
						await insertTransactionHop(result.id, i, {
							timestamp: hop.timestamp,
							nodeId: hop.nodeId || hop.uid
						});
						counts.hops++;
					}
				}
			}
		}

		// Save peers
		if (data.peers && Array.isArray(data.peers) && data.peers.length > 0) {
			for (const peer of data.peers) {
				await insertPeer(node.id, {
					id: peer.id,
					address: peer.address,
					port: peer.port,
					uri: peer.uri,
					state: peer.state
				});
				counts.peers++;
			}
		}

		// Save metrics
		if (data.metrics && Array.isArray(data.metrics) && data.metrics.length > 0) {
			for (const metric of data.metrics) {
				await insertMetric(node.id, {
					ts: metric.ts,
					cpu_percent: metric.cpu_percent,
					ram_total_mb: metric.ram_total_mb,
					ram_used_mb: metric.ram_used_mb,
					net_bytes_sent: metric.net_bytes_sent,
					net_bytes_recv: metric.net_bytes_recv
				});
				counts.metrics++;
			}
		}

		// Check and update run completion status
		let completionStatus = null;
		try {
			completionStatus = await updateRunCompletionStatus(run.id);
			if (completionStatus.updated) {
				console.log(`[saveTelemetryBatch] Run ${runId} status changed: ${completionStatus.oldStatus} -> ${completionStatus.newStatus} (${completionStatus.nodesReported}/${completionStatus.nodesExpected} nodes)`);
				// Trigger queue runner when run completes
				if (completionStatus.newStatus === 'complete') {
					try {
						const { onRunComplete } = require('./queueRunner');
						onRunComplete(runId);
					} catch (e) {
						console.error('[saveTelemetryBatch] queueRunner.onRunComplete failed:', e);
					}
				}
			}
		} catch (err) {
			console.error('[saveTelemetryBatch] Failed to update run completion status:', err);
		}

		return { run, node, counts, completionStatus };
	});
}

// ========== NEW FUNCTIONS FOR RUN PARAMS AND CONSISTENCY ==========

function insertRunParams(runId, params) {
	return new Promise((resolve, reject) => {
		// First get the internal run ID
		db.get(`SELECT id FROM runs WHERE run_id = ?`, [runId], (err, run) => {
			if (err) return reject(err);
			if (!run) return reject(new Error(`Run ${runId} not found`));

			// Update run_params
			const stmt = db.prepare(`
                INSERT OR REPLACE INTO run_params
                (run_id, node_count, tx_count, tx_delay, max_peers, pow, wait)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
			stmt.run(
				run.id,
				params.node_count,
				params.tx_count,
				params.tx_delay,
				params.max_peers,
				params.pow,
				params.wait,
				function(err) {
					if (err) {
						stmt.finalize();
						return reject(err);
					}

					// Also update runs table with nodes_expected
					db.run(
						`UPDATE runs SET nodes_expected = ? WHERE id = ?`,
						[params.node_count, run.id],
						(err2) => {
							stmt.finalize();
							if (err2) reject(err2);
							else resolve({ id: this.lastID });
						}
					);
				}
			);
		});
	});
}

function getRunWithParams(runId) {
	return new Promise((resolve, reject) => {
		db.get(`
            SELECT r.*, rp.node_count as param_node_count, rp.tx_count, rp.tx_delay,
                   rp.max_peers, rp.pow, rp.wait
            FROM runs r
            LEFT JOIN run_params rp ON r.id = rp.run_id
            WHERE r.run_id = ?
        `, [runId], (err, row) => {
			if (err) reject(err);
			else resolve(row);
		});
	});
}

function getAllTransactionsByRun(runId, limit = 10000) {
	return new Promise((resolve, reject) => {
		db.all(`
            SELECT t.*, n.original_node_id, n.node_index
            FROM transactions t
            JOIN nodes n ON t.node_id = n.id
            JOIN runs r ON n.run_id = r.id
            WHERE r.run_id = ?
            ORDER BY t.transaction_id, n.node_index
            LIMIT ?
        `, [runId, limit], (err, rows) => {
			if (err) reject(err);
			else {
				const parsed = rows.map(row => ({
					...row,
					parents: JSON.parse(row.parents || '[]'),
					weight_map: JSON.parse(row.weight_map || '[]')
				}));
				resolve(parsed);
			}
		});
	});
}

function getUniqueTransactionIds(runId) {
	return new Promise((resolve, reject) => {
		db.all(`
            SELECT DISTINCT t.transaction_id, COUNT(DISTINCT n.id) as node_count
            FROM transactions t
            JOIN nodes n ON t.node_id = n.id
            JOIN runs r ON n.run_id = r.id
            WHERE r.run_id = ?
            GROUP BY t.transaction_id
        `, [runId], (err, rows) => {
			if (err) reject(err);
			else resolve(rows);
		});
	});
}

function saveConsistencyReport(runId, report) {
	return new Promise((resolve, reject) => {
		db.get(`SELECT id FROM runs WHERE run_id = ?`, [runId], (err, run) => {
			if (err) return reject(err);
			if (!run) return reject(new Error(`Run ${runId} not found`));

			const stmt = db.prepare(`
                INSERT OR REPLACE INTO tangle_consistency
                (run_id, total_unique_transactions, fully_replicated_count,
                 partially_replicated_count, missing_tx_pairs, metadata_diff_count,
                 conflict_count, consistency_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
			stmt.run(
				run.id,
				report.total_unique_transactions,
				report.fully_replicated_count,
				report.partially_replicated_count,
				JSON.stringify(report.missing_tx_pairs || []),
				report.metadata_diff_count,
				report.conflict_count,
				report.consistency_score,
				function(err) {
					if (err) reject(err);
					else resolve({ id: this.lastID });
				}
			);
			stmt.finalize();
		});
	});
}

// ========== DASHBOARD GLOBAL QUERIES ==========

function getGlobalCounters() {
	return new Promise((resolve, reject) => {
		db.get(`
            SELECT
                (SELECT COUNT(*) FROM runs) AS totalRuns,
                (SELECT COUNT(*) FROM runs WHERE status='complete') AS completeRuns,
                (SELECT COUNT(*) FROM runs WHERE status='incomplete') AS incompleteRuns,
                (SELECT COUNT(*) FROM runs WHERE status='running') AS runningRuns,
                (SELECT COUNT(*) FROM nodes) AS totalNodes,
                (SELECT COUNT(*) FROM transactions) AS totalTransactions,
                (SELECT COUNT(DISTINCT transaction_id) FROM transactions) AS totalDistinctTransactionIds,
                (SELECT COUNT(*) FROM peers) AS totalPeerLinks,
                (SELECT MAX(started_at) FROM runs) AS lastRunAt
        `, (err, row) => {
			if (err) reject(err);
			else resolve(row || {
				totalRuns: 0, completeRuns: 0, incompleteRuns: 0, runningRuns: 0,
				totalNodes: 0, totalTransactions: 0, totalDistinctTransactionIds: 0,
				totalPeerLinks: 0, lastRunAt: null
			});
		});
	});
}

function getAllRunParamsWithStatus(statusFilter = 'all') {
	return new Promise((resolve, reject) => {
		let whereClause = '';
		if (statusFilter !== 'all') {
			// Support both old and new status values for backward compatibility
			const statusMap = {
				'completed': 'complete',
				'complete': 'complete',
				'incomplete': 'incomplete',
				'running': 'running'
			};
			const mappedStatus = statusMap[statusFilter] || statusFilter;
			whereClause = `WHERE r.status = '${mappedStatus}'`;
		}
		db.all(`
            SELECT rp.node_count, rp.tx_count, rp.tx_delay, rp.max_peers, rp.pow,
                   r.status, r.nodes_expected, r.nodes_reported
            FROM run_params rp
            JOIN runs r ON rp.run_id = r.id
            ${whereClause}
        `, (err, rows) => {
			if (err) reject(err);
			else resolve(rows || []);
		});
	});
}

// ========== PER-NODE TANGLE + CHART DATA ==========

function getTangleForNode(runId, nodeIndex, limit = 10000) {
	return new Promise((resolve, reject) => {
		db.all(`
            SELECT t.*, n.original_node_id
            FROM transactions t
            JOIN nodes n ON t.node_id = n.id
            JOIN runs r ON n.run_id = r.id
            WHERE r.run_id = ? AND n.node_index = ?
            ORDER BY t.timestamp ASC
            LIMIT ?
        `, [runId, nodeIndex, limit], async (err, rows) => {
			if (err) return reject(err);
			if (!rows || rows.length === 0) return resolve([]);

			const parsed = await Promise.all(
				rows.map(async (row) => {
					const hops = await new Promise((resolveHops, rejectHops) => {
						db.all(
							`SELECT hop_index, timestamp, hop_node_id as nodeId
							 FROM transaction_hops
							 WHERE transaction_id = ?
							 ORDER BY hop_index`,
							[row.id],
							(errHops, hopRows) => {
								if (errHops) rejectHops(errHops);
								else resolveHops(hopRows || []);
							}
						);
					});

					return {
						...row,
						parents: JSON.parse(row.parents || '[]'),
						weight_map: JSON.parse(row.weight_map || '[]'),
						hops
					};
				})
			);
			resolve(parsed);
		});
	});
}

// Get chart-ready data aggregated by consensus (most common tx version per txId)
function getChartsData(runId) {
	return new Promise((resolve, reject) => {
		db.all(`
            SELECT t.*, n.node_index, n.original_node_id
            FROM transactions t
            JOIN nodes n ON t.node_id = n.id
            JOIN runs r ON n.run_id = r.id
            WHERE r.run_id = ?
        `, [runId], (err, rows) => {
			if (err) return reject(err);
			if (!rows || rows.length === 0) {
				return resolve({
					cumulativeWeights: [],
					timingBreakdown: [],
					propagationHops: [],
					dagEdges: []
				});
			}

			// Group by transaction_id and pick the most common version
			const byTxId = {};
			rows.forEach(r => {
				if (!byTxId[r.transaction_id]) byTxId[r.transaction_id] = [];
				byTxId[r.transaction_id].push(r);
			});

			const consensusTx = Object.values(byTxId).map(versions => {
				// Pick the version seen by most nodes as "consensus"
				const byFingerprint = {};
				versions.forEach(v => {
					const fp = `${v.sender}|${v.receiver}|${v.amount}|${JSON.stringify(v.parents)}`;
					if (!byFingerprint[fp]) byFingerprint[fp] = [];
					byFingerprint[fp].push(v);
				});
				const best = Object.values(byFingerprint).sort((a, b) => b.length - a.length)[0][0];
				return best;
			});

			// Sort by cumulative weight desc for chart display
			const sorted = consensusTx.sort((a, b) => (b.cumulative_weight || 0) - (a.cumulative_weight || 0));

			// Build chart data
			const cumulativeWeights = sorted.map(tx => ({
				txId: tx.transaction_id,
				label: tx.transaction_id === 'genesis' ? 'genesis' :
					`${tx.sender?.slice(0,1) || '?'}→${tx.receiver?.slice(0,1) || '?'}`,
				cumulativeWeight: tx.cumulative_weight || 0,
				isGenesis: tx.transaction_id === 'genesis' || !JSON.parse(tx.parents || '[]').length
			}));

			const timingBreakdown = sorted.map(tx => ({
				txId: tx.transaction_id,
				label: tx.transaction_id === 'genesis' ? 'genesis' :
					`${tx.sender?.slice(0,1) || '?'}→${tx.receiver?.slice(0,1) || '?'}`,
				verificationMs: tx.verification_duration || 0,
				powMs: tx.pow_duration || 0,
				tsaMs: tx.tsa_duration || 0,
				completionMs: tx.completion_duration || 0
			}));

			const propagationHops = sorted.map(tx => {
				const parents = JSON.parse(tx.parents || '[]');
				// Estimate hop count from parent chain depth (simplified)
				return {
					txId: tx.transaction_id,
					label: tx.transaction_id === 'genesis' ? 'genesis' :
						`${tx.sender?.slice(0,1) || '?'}→${tx.receiver?.slice(0,1) || '?'}`,
					hopCount: parents.length,
					totalDelayMs: tx.propagation_delay || 0,
					avgPerHopMs: tx.avg_propagation_delay || 0
				};
			});

			// Build DAG edges from parent relationships
			const dagEdges = [];
			const seenEdges = new Set();
			sorted.forEach(tx => {
				const parents = JSON.parse(tx.parents || '[]');
				parents.forEach(parentId => {
					const edgeKey = `${parentId}→${tx.transaction_id}`;
					if (!seenEdges.has(edgeKey)) {
						seenEdges.add(edgeKey);
						dagEdges.push({ from: parentId, to: tx.transaction_id });
					}
				});
			});

			resolve({
				cumulativeWeights,
				timingBreakdown,
				propagationHops,
				dagEdges
			});
		});
	});
}

// ========== ATOMIC DELETE ==========

async function deleteRunAtomic(runId) {
	return withTransaction(async () => {
		// Get internal run id
		const run = await new Promise((resolve, reject) => {
			db.get(`SELECT id FROM runs WHERE run_id = ?`, [runId], (err, row) => {
				if (err) return reject(err);
				resolve(row);
			});
		});
		if (!run) throw new Error(`Run ${runId} not found`);

		const internalRunId = run.id;

		// Delete in dependency order: hops → transactions → peers → metrics → nodes → run_params → consistency → runs
		await new Promise((res, rej) => db.run(`DELETE FROM transaction_hops WHERE transaction_id IN (SELECT id FROM transactions WHERE node_id IN (SELECT id FROM nodes WHERE run_id = ?))`, [internalRunId], err => err ? rej(err) : res()));
		await new Promise((res, rej) => db.run(`DELETE FROM transactions WHERE node_id IN (SELECT id FROM nodes WHERE run_id = ?)`, [internalRunId], err => err ? rej(err) : res()));
		await new Promise((res, rej) => db.run(`DELETE FROM peers WHERE node_id IN (SELECT id FROM nodes WHERE run_id = ?)`, [internalRunId], err => err ? rej(err) : res()));
		await new Promise((res, rej) => db.run(`DELETE FROM metrics WHERE node_id IN (SELECT id FROM nodes WHERE run_id = ?)`, [internalRunId], err => err ? rej(err) : res()));
		await new Promise((res, rej) => db.run(`DELETE FROM nodes WHERE run_id = ?`, [internalRunId], err => err ? rej(err) : res()));
		await new Promise((res, rej) => db.run(`DELETE FROM run_params WHERE run_id = ?`, [internalRunId], err => err ? rej(err) : res()));
		await new Promise((res, rej) => db.run(`DELETE FROM tangle_consistency WHERE run_id = ?`, [internalRunId], err => err ? rej(err) : res()));

		const result = await new Promise((resolve, reject) => {
			db.run(`DELETE FROM runs WHERE id = ?`, [internalRunId], function(err) {
				if (err) reject(err);
				else resolve({ changes: this.changes });
			});
		});

		return result;
	});
}

// ========== SIMULATION QUEUE ==========

function addQueueItem({ label, node_count, tx_count, tx_delay, max_peers, pow, wait }) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(`
            INSERT INTO simulation_queue (position, label, node_count, tx_count, tx_delay, max_peers, pow, wait)
            VALUES ((SELECT COALESCE(MAX(position), 0) + 1 FROM simulation_queue WHERE status='pending'), ?, ?, ?, ?, ?, ?, ?)
        `);
		stmt.run(label, node_count, tx_count, tx_delay, max_peers, pow, wait, function(err) {
			if (err) {
				stmt.finalize();
				return reject(err);
			}
			db.get(`SELECT * FROM simulation_queue WHERE id = ?`, [this.lastID], (err, row) => {
				stmt.finalize();
				if (err) reject(err);
				else resolve(row);
			});
		});
	});
}

function listQueue({ status } = {}) {
	return new Promise((resolve, reject) => {
		let sql = `
            SELECT * FROM simulation_queue
            ORDER BY
                CASE status
                    WHEN 'started' THEN 0
                    WHEN 'pending' THEN 1
                    ELSE 2
                END,
                position ASC,
                id ASC
        `;
		const params = [];
		if (status) {
			sql = `SELECT * FROM simulation_queue WHERE status = ? ORDER BY position ASC, id ASC`;
			params.push(status);
		}
		db.all(sql, params, (err, rows) => {
			if (err) reject(err);
			else resolve(rows);
		});
	});
}

function getQueueItem(id) {
	return new Promise((resolve, reject) => {
		db.get(`SELECT * FROM simulation_queue WHERE id = ?`, [id], (err, row) => {
			if (err) reject(err);
			else resolve(row);
		});
	});
}

function removeQueueItem(id) {
	return new Promise((resolve, reject) => {
		// Only allow deleting pending items
		db.get(`SELECT status FROM simulation_queue WHERE id = ?`, [id], (err, row) => {
			if (err) return reject(err);
			if (!row) return reject(new Error(`Queue item ${id} not found`));
			if (row.status !== 'pending') return reject(new Error(`Cannot delete queue item with status '${row.status}'`));
			db.run(`DELETE FROM simulation_queue WHERE id = ?`, [id], function(err) {
				if (err) reject(err);
				else resolve({ changes: this.changes });
			});
		});
	});
}

function reorderQueue(orderedIds) {
	return withTransaction(async () => {
		for (let i = 0; i < orderedIds.length; i++) {
			const id = orderedIds[i];
			await new Promise((resolve, reject) => {
				// Verify status is still pending
				db.get(`SELECT status FROM simulation_queue WHERE id = ?`, [id], (err, row) => {
					if (err) return reject(err);
					if (!row) return reject(new Error(`Queue item ${id} not found`));
					if (row.status !== 'pending') return reject(new Error(`Cannot reorder queue item with status '${row.status}'`));
					db.run(`UPDATE simulation_queue SET position = ? WHERE id = ?`, [i + 1, id], (err2) => {
						if (err2) reject(err2);
						else resolve();
					});
				});
			});
		}
		return { reordered: orderedIds.length };
	});
}

function getNextPending() {
	return new Promise((resolve, reject) => {
		db.get(`SELECT * FROM simulation_queue WHERE status='pending' ORDER BY position ASC, id ASC LIMIT 1`, [], (err, row) => {
			if (err) reject(err);
			else resolve(row);
		});
	});
}

function markQueueStarted(id, runId) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE simulation_queue SET status='started', run_id=?, started_at=CURRENT_TIMESTAMP WHERE id = ?`,
			[runId, id],
			function(err) {
				if (err) reject(err);
				else resolve({ changes: this.changes });
			}
		);
	});
}

function markQueueCompleted(id) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE simulation_queue SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id = ?`,
			[id],
			function(err) {
				if (err) reject(err);
				else resolve({ changes: this.changes });
			}
		);
	});
}

function markQueueError(id, errorMessage) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE simulation_queue SET status='error', error_message=?, completed_at=CURRENT_TIMESTAMP WHERE id = ?`,
			[errorMessage, id],
			function(err) {
				if (err) reject(err);
				else resolve({ changes: this.changes });
			}
		);
	});
}

function updateQueueItem(id, { label, node_count, tx_count, tx_delay, max_peers, pow, wait }) {
	return new Promise((resolve, reject) => {
		// Only allow updating pending items
		db.get(`SELECT status FROM simulation_queue WHERE id = ?`, [id], (err, row) => {
			if (err) return reject(err);
			if (!row) return reject(new Error(`Queue item ${id} not found`));
			if (row.status !== 'pending') return reject(new Error(`Cannot update queue item with status '${row.status}'`));

			const stmt = db.prepare(`
				UPDATE simulation_queue
				SET label = ?, node_count = ?, tx_count = ?, tx_delay = ?, max_peers = ?, pow = ?, wait = ?
				WHERE id = ?
			`);
			stmt.run(label, node_count, tx_count, tx_delay, max_peers, pow, wait, id, function(err) {
				if (err) {
					stmt.finalize();
					return reject(err);
				}
				db.get(`SELECT * FROM simulation_queue WHERE id = ?`, [id], (err, row) => {
					stmt.finalize();
					if (err) reject(err);
					else resolve(row);
				});
			});
		});
	});
}

function findQueueItemByRunId(runId) {
	return new Promise((resolve, reject) => {
		db.get(`SELECT * FROM simulation_queue WHERE run_id = ? AND status='started'`, [runId], (err, row) => {
			if (err) reject(err);
			else resolve(row);
		});
	});
}

function findStuckStartedItems() {
	return new Promise((resolve, reject) => {
		db.all(`SELECT * FROM simulation_queue WHERE status='started'`, [], (err, rows) => {
			if (err) reject(err);
			else resolve(rows);
		});
	});
}

function preemptStartedQueueItems() {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE simulation_queue SET status='error', error_message='preempted by manual start', completed_at=CURRENT_TIMESTAMP WHERE status='started'`,
			[],
			function(err) {
				if (err) reject(err);
				else resolve({ changes: this.changes });
			}
		);
	});
}

module.exports = {
	db,
	withTransaction,
	// Run management
	getOrCreateRun,
	completeRun,
	listRuns,
	queryRunsByFilters,
	deleteRunAtomic,
	// Simulation queue
	addQueueItem,
	listQueue,
	getQueueItem,
	removeQueueItem,
	updateQueueItem,
	reorderQueue,
	getNextPending,
	markQueueStarted,
	markQueueCompleted,
	markQueueError,
	findQueueItemByRunId,
	findStuckStartedItems,
	preemptStartedQueueItems,
	// Node management
	getOrCreateNode,
	listNodes,
	// Transaction management
	insertTransaction,
	insertTransactionHop,
	getTransactionsByRun,
	getTransactionWithHops,
	getTangleForNode,
	// Peer management
	insertPeer,
	getPeersByRun,
	getPeersByNodeId,
	// Metrics management
	insertMetric,
	getMetricsByRun,
	getMetricsByNodeId,
	// Stats and summaries
	getTransactionCountByNode,
	checkRunExists,
	getNodeDetailsWithCounts,
	getRunSummary,
	getRunMetrics,
	// Batch ingestion
	saveTelemetryBatch,
	// Run params and consistency
	insertRunParams,
	getRunWithParams,
	getAllTransactionsByRun,
	getUniqueTransactionIds,
	saveConsistencyReport,
	// Dashboard global queries
	getGlobalCounters,
	getAllRunParamsWithStatus,
	getChartsData
};
