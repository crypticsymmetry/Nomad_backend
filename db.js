const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Use a different directory for Render, or default to the local directory
const dbDirectory = process.env.DB_DIRECTORY || './data';
const dbPath = path.join(dbDirectory, 'powersports.db');

// Ensure the directory for the database exists
if (!fs.existsSync(dbDirectory)) {
    try {
        fs.mkdirSync(dbDirectory, { recursive: true });
    } catch (err) {
        console.error(`Error creating directory ${dbDirectory}:`, err.message);
        process.exit(1);
    }
}

const db = new sqlite3.Database(dbPath);

function setupDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            start_time TEXT,
            total_time INTEGER DEFAULT 0,
            photo TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id INTEGER NOT NULL,
            issue TEXT NOT NULL,
            status TEXT NOT NULL,
            note TEXT,
            severity TEXT,
            FOREIGN KEY(machine_id) REFERENCES machines(id)
        )`);
    });
}

module.exports = {
    db,
    setupDatabase,
};
