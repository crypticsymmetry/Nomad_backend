const express = require('express');
const multer = require('multer');
const { db, setupDatabase } = require('./db');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); // Import the CORS middleware

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'images/' });

// Setup CORS to allow requests from multiple origins
const allowedOrigins = [
    'https://nomad-frontend-silk.vercel.app',
    'https://nomad-frontend-e2accdm96-crypticsymmetrys-projects.vercel.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); // Use the CORS middleware with the specified options

setupDatabase();

app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

// Add machine
app.post('/machines', (req, res) => {
    const { name, worker_name } = req.body; // Include worker_name
    db.run(`INSERT INTO machines (name, status, worker_name) VALUES (?, 'Pending', ?)`, [name, worker_name], function (err) {
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
    db.run(`DELETE FROM machines WHERE id = ?`, [id], function (err) {
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
    db.run(`UPDATE machines SET photo = ? WHERE id = ?`, [photoPath, id], function (err) {
        if (err) {
            console.error('Error uploading photo:', err.message);
            return res.status(500).send(err.message);
        }
        res.status(200).send({ photo: photoPath });
    });
});

// Timer functions
const startTimer = (timerType, req, res) => {
    const { id } = req.params;
    const startTime = new Date().toISOString();
    const updateQuery = `UPDATE machines SET ${timerType}_start_time = ?, status = 'Started' WHERE id = ?`;
    db.run(updateQuery, [startTime, id], function (err) {
        if (err) {
            console.error(`Error starting ${timerType} timer:`, err.message);
            return res.status(500).send(err.message);
        }
        res.status(200).send(`${timerType.charAt(0).toUpperCase() + timerType.slice(1)} timer started`);
    });
};

const pauseTimer = (timerType, req, res) => {
    const { id } = req.params;
    const selectQuery = `SELECT ${timerType}_start_time, ${timerType}_total_time FROM machines WHERE id = ?`;
    db.get(selectQuery, [id], (err, row) => {
        if (err) {
            console.error(`Error fetching machine data for ${timerType} timer:`, err.message);
            return res.status(500).send(err.message);
        }
        const startTime = new Date(row[`${timerType}_start_time`]);
        const elapsed = (new Date() - startTime) / 1000;
        const newTotalTime = row[`${timerType}_total_time`] + elapsed;
        const updateQuery = `UPDATE machines SET ${timerType}_start_time = NULL, ${timerType}_total_time = ?, status = 'Paused' WHERE id = ?`;
        db.run(updateQuery, [newTotalTime, id], function (err) {
            if (err) {
                console.error(`Error pausing ${timerType} timer:`, err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).send(`${timerType.charAt(0).toUpperCase() + timerType.slice(1)} timer paused`);
        });
    });
};

const stopTimer = (timerType, req, res) => {
    const { id } = req.params;
    const selectQuery = `SELECT ${timerType}_start_time, ${timerType}_total_time FROM machines WHERE id = ?`;
    db.get(selectQuery, [id], (err, row) => {
        if (err) {
            console.error(`Error fetching machine data for ${timerType} timer:`, err.message);
            return res.status(500).send(err.message);
        }
        const startTime = new Date(row[`${timerType}_start_time`]);
        const elapsed = (new Date() - startTime) / 1000;
        const newTotalTime = row[`${timerType}_total_time`] + elapsed;
        const updateQuery = `UPDATE machines SET ${timerType}_start_time = NULL, ${timerType}_total_time = ?, status = 'Stopped/Finished' WHERE id = ?`;
        db.run(updateQuery, [newTotalTime, id], function (err) {
            if (err) {
                console.error(`Error stopping ${timerType} timer:`, err.message);
                return res.status(500).send(err.message);
            }
            res.status(200).send(`${timerType.charAt(0).toUpperCase() + timerType.slice(1)} timer stopped`);
        });
    });
};

// Inspection timers
app.post('/machines/:id/inspection/start', (req, res) => startTimer('inspection', req, res));
app.post('/machines/:id/inspection/pause', (req, res) => pauseTimer('inspection', req, res));
app.post('/machines/:id/inspection/stop', (req, res) => stopTimer('inspection', req, res));

// Servicing timers
app.post('/machines/:id/servicing/start', (req, res) => startTimer('servicing', req, res));
app.post('/machines/:id/servicing/pause', (req, res) => pauseTimer('servicing', req, res));
app.post('/machines/:id/servicing/stop', (req, res) => stopTimer('servicing', req, res));

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
            inspection_total_time: secondsToHMS(row.inspection_total_time),
            servicing_total_time: secondsToHMS(row.servicing_total_time)
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
                inspection_total_time: secondsToHMS(row.inspection_total_time),
                servicing_total_time: secondsToHMS(row.servicing_total_time),
                issues,
            });
        });
    });
});

// Add issue
app.post('/machines/:id/issues', (req, res) => {
    const { id } = req.params;
    const { issue, note, severity } = req.body;
    db.run(`INSERT INTO issues (machine_id, issue, status, note, severity) VALUES (?, ?, 'Pending', ?, ?)`, [id, issue, note, severity], function (err) {
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
    db.run(`DELETE FROM issues WHERE id = ?`, [issueId], function (err) {
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
    db.run(`UPDATE issues SET note = ? WHERE id = ?`, [note, issueId], function (err) {
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
    db.run(`UPDATE issues SET severity = ? WHERE id = ?`, [severity, issueId], function (err) {
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
