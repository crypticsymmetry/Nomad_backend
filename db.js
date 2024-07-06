const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const databaseDirectory = path.join(__dirname, 'data');
const databasePath = path.join(databaseDirectory, 'powersports.db');

// Ensure the database directory exists
if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
}

const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Database connected.');
    }
});

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
