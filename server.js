const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { db, setupDatabase } = require('./db');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'images/' });

setupDatabase();

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

// Add machine
app.post('/machines', (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO machines (name, status) VALUES (?, 'Pending')`, [name], function(err) {
        if (err) {
            console.error('Error adding machine:', err.message);
            return res.status(500).send(err.message);
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Remove machine
app.delete('/machines/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM machines WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error('Error deleting machine:', err.message);
            return res.status(500).send(err.message);
        }
        res.status(200).send('Machine deleted');
    });
});

// Upload machine photo
app.post('/machines/:id/photo', upload.single('photo'), (req, res) => {
    const { id } = req.params;
    const photoPath = req.file.path;
    db.run(`UPDATE machines SET photo = ? WHERE id = ?`, [photoPath, id], function(err) {
        if (err) {
            console.error('Error uploading photo:', err.message);
            return res.status(500).send(err.message);
        }
        res.status(200).send('Photo uploaded');
    });
});

// Start timer
app.post('/machines/:id/start', (req, res) => {
    const { id } = req.params;
    const startTime = new Date().toISOString();
    db.run(`UPDATE machines SET start_time = ? WHERE id = ?`, [startTime, id], function(err) {
        if (err) {
            console.error('Error starting timer:', err.message);
            return res.status(500).send(err.message);
        }
        res.status(200).send('Timer started');
    });
});

// Pause timer
app.post('/machines/:id/pause', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT start_time, total_time FROM machines WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Error fetching machine data:', err.message);
            return res.status(500).send(err.message);
        }
        const startTime = new Date(row.start_time);
        const elapsed = (new Date() - startTime) / 1000;
        const newTotalTime = row.total_time + elapsed;
        db.run(`UPDATE machines SET start_time = NULL, total_time = ? WHERE id = ?`, [newTotalTime, id], function(err) {
            if (err) {
                console.error('Error pausing timer:', err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).send('Timer paused');
        });
    });
});

// Stop timer
app.post('/machines/:id/stop', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT start_time, total_time FROM machines WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Error fetching machine data:', err.message);
            return res.status(500).send(err.message);
        }
        const startTime = new Date(row.start_time);
        const elapsed = (new Date() - startTime) / 1000;
        const newTotalTime = row.total_time + elapsed;
        db.run(`UPDATE machines SET start_time = NULL, total_time = ? WHERE id = ?`, [newTotalTime, id], function(err) {
            if (err) {
                console.error('Error stopping timer:', err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).send('Timer stopped');
        });
    });
});

// Update status
app.put('/machines/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.run(`UPDATE machines SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) {
            console.error('Error updating status:', err.message);
            return res.status(500).send(err.message);
        }
        res.status(200).send('Status updated');
    });
});

// Get all machines
app.get('/machines', (req, res) => {
    db.all(`SELECT * FROM machines`, (err, rows) => {
        if (err) {
            console.error('Error fetching machines:', err.message);
            return res.status(500).send(err.message);
        }
        res.json(rows.map(row => ({
            ...row,
            total_time: secondsToHMS(row.total_time),
        })));
    });
});

// Get machine by id
app.get('/machines/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM machines WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Error fetching machine:', err.message);
            return res.status(500).send(err.message);
        }
        db.all(`SELECT * FROM issues WHERE machine_id = ?`, [id], (err, issues) => {
            if (err) {
                console.error('Error fetching issues:', err.message);
                return res.status(500).send(err.message);
            }
            res.json({
                ...row,
                total_time: secondsToHMS(row.total_time),
                issues,
            });
        });
    });
});

// Add issue
app.post('/machines/:id/issues', (req, res) => {
    const { id } = req.params;
    const { issue, note, severity } = req.body;
    db.run(`INSERT INTO issues (machine_id, issue, status, note, severity) VALUES (?, ?, 'Pending', ?, ?)`, [id, issue, note, severity], function(err) {
        if (err) {
            console.error('Error adding issue:', err.message);
            return res.status(500).send(err.message);
        }
        db.all(`SELECT * FROM issues WHERE machine_id = ?`, [id], (err, issues) => {
            if (err) {
                console.error('Error fetching updated issues:', err.message);
                return res.status(500).send(err.message);
            }
            res.status(201).json(issues);
        });
    });
});

// Remove issue
app.delete('/machines/:machineId/issues/:issueId', (req, res) => {
    const { machineId, issueId } = req.params;
    db.run(`DELETE FROM issues WHERE id = ?`, [issueId], function(err) {
        if (err) {
            console.error('Error removing issue:', err.message);
            return res.status(500).send(err.message);
        }
        db.all(`SELECT * FROM issues WHERE machine_id = ?`, [machineId], (err, issues) => {
            if (err) {
                console.error('Error fetching updated issues:', err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).json(issues);
        });
    });
});

// Update issue note
app.put('/machines/:machineId/issues/:issueId/note', (req, res) => {
    const { machineId, issueId } = req.params;
    const { note } = req.body;
    db.run(`UPDATE issues SET note = ? WHERE id = ?`, [note, issueId], function(err) {
        if (err) {
            console.error('Error updating note:', err.message);
            return res.status(500).send(err.message);
        }
        db.all(`SELECT * FROM issues WHERE machine_id = ?`, [machineId], (err, issues) => {
            if (err) {
                console.error('Error fetching updated issues:', err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).json(issues);
        });
    });
});

// Update issue severity
app.put('/machines/:machineId/issues/:issueId/severity', (req, res) => {
    const { machineId, issueId } = req.params;
    const { severity } = req.body;
    db.run(`UPDATE issues SET severity = ? WHERE id = ?`, [severity, issueId], function(err) {
        if (err) {
            console.error('Error updating severity:', err.message);
            return res.status(500).send(err.message);
        }
        db.all(`SELECT * FROM issues WHERE machine_id = ?`, [machineId], (err, issues) => {
            if (err) {
                console.error('Error fetching updated issues:', err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).json(issues);
        });
    });
});

// Serve issues_file.json
app.get('/issues-file', (req, res) => {
    const issuesFilePath = path.join(__dirname, 'issues_file.json');
    fs.readFile(issuesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading issues file:', err.message);
            res.status(500).send('Error reading issues file');
        } else {
            res.json(JSON.parse(data));
        }
    });
});

function secondsToHMS(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${m < 10 ? '0' : ''}${m}`;
}

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
