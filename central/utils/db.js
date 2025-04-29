// central/utils/db.js

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.sqlite");

db.serialize(() => {
	db.run(`
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT,
            tx_id TEXT,
            tx_time_ms INTEGER,
            pow_time_ms INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function insertTelemetry({ node_id, tx_id, tx_time_ms, pow_time_ms }) {
	const stmt = db.prepare(`
        INSERT INTO telemetry (node_id, tx_id, tx_time_ms, pow_time_ms)
        VALUES (?, ?, ?, ?)
    `);
	stmt.run(node_id, tx_id, tx_time_ms, pow_time_ms);
	stmt.finalize();
}

function getRecentTelemetry(limit = 20) {
	return new Promise((resolve, reject) => {
		db.all(
			`
            SELECT * FROM telemetry
            ORDER BY timestamp DESC
            LIMIT ?
        `,
			[limit],
			(err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			}
		);
	});
}

module.exports = {
	insertTelemetry,
	getRecentTelemetry,
};
