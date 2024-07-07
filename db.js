const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

function setupDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            start_time TEXT,
            total_time INTEGER DEFAULT 0,
            photo TEXT,
            worker_name TEXT,
            inspection_start_time TEXT,
            inspection_total_time INTEGER DEFAULT 0,
            servicing_start_time TEXT,
            servicing_total_time INTEGER DEFAULT 0
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
