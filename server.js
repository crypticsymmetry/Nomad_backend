const express = require('express');
const multer = require('multer');
const BusBoy = require('busboy');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { db, bucket } = require('./firebaseConfig'); 

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

// Setup CORS to allow requests from multiple origins
const allowedOrigins = [
    'https://nomad-frontend-silk.vercel.app',
    'https://nomad-frontend-silk.vercel.app/machines'
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

app.use(cors(corsOptions));
app.use(express.json());

// Add machine
app.post('/machines', (req, res) => {
    const { name, worker_name } = req.body;
    db.collection('machines').add({
        name,
        status: 'Pending',
        worker_name,
        total_time: 0,
        inspection_total_time: 0,
        servicing_total_time: 0,
        created_at: new Date().toISOString(),
    })
    .then(docRef => {
        res.status(201).json({ id: docRef.id });
    })
    .catch(err => {
        console.error('Error adding machine:', err.message);
        res.status(500).send(err.message);
    });
});

// Remove machine
app.delete('/machines/:id', (req, res) => {
    const { id } = req.params;
    db.collection('machines').doc(id).delete()
    .then(() => {
        res.status(200).send('Machine deleted');
    })
    .catch(err => {
        console.error('Error deleting machine:', err.message);
        res.status(500).send(err.message);
    });
});



// Upload machine photo
app.post('/machines/:id/photo', (req, res) => {
    if (req.method !== 'POST') {
        res.sendStatus(405); // 405 METHOD_NOT_ALLOWED
        return;
    }

    const bb = busboy({ headers: req.headers });
    let storageFilepath;
    let storageFile;

    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
        const fileext = filename.match(/\.[0-9a-z]+$/i)[0];
        const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileext}`;
        storageFilepath = `images/${uniqueFileName}`;
        storageFile = bucket.file(storageFilepath);

        file.pipe(storageFile.createWriteStream({
            metadata: { contentType: mimetype },
            gzip: true
        }));
    });

    bb.on('finish', () => {
        if (!storageFile) {
            res.status(400).json({ error: 'expected file' }); // 400 BAD_REQUEST
            return;
        }

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storageFile.name}`;

        db.collection('machines').doc(req.params.id).update({ photo: publicUrl })
            .then(() => {
                res.status(201).json({ message: 'Image uploaded successfully', photo: publicUrl }); // 201 CREATED
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: err.message }); // 500 INTERNAL_SERVER_ERROR
            });
    });

    bb.on('error', (err) => {
        console.error(err);
        res.status(500).json({ error: err.message });
    });

    req.pipe(bb);
});

// Timer functions
const startTimer = (timerType, req, res) => {
    const { id } = req.params;
    const startTime = new Date().toISOString();
    db.collection('machines').doc(id).update({
        [`${timerType}_start_time`]: startTime,
        status: 'Started',
    })
    .then(() => {
        res.status(200).send(`${timerType.charAt(0).toUpperCase() + timerType.slice(1)} timer started`);
    })
    .catch(err => {
        console.error(`Error starting ${timerType} timer:`, err.message);
        res.status(500).send(err.message);
    });
};

const pauseTimer = (timerType, req, res) => {
    const { id } = req.params;
    db.collection('machines').doc(id).get()
    .then(doc => {
        const data = doc.data();
        const startTime = new Date(data[`${timerType}_start_time`]);
        const elapsed = (new Date() - startTime) / 1000;
        const newTotalTime = data[`${timerType}_total_time`] + elapsed;
        db.collection('machines').doc(id).update({
            [`${timerType}_start_time`]: null,
            [`${timerType}_total_time`]: newTotalTime,
            status: 'Paused',
        })
        .then(() => {
            res.status(200).send(`${timerType.charAt(0).toUpperCase() + timerType.slice(1)} timer paused`);
        });
    })
    .catch(err => {
        console.error(`Error pausing ${timerType} timer:`, err.message);
        res.status(500).send(err.message);
    });
};

const stopTimer = (timerType, req, res) => {
    const { id } = req.params;
    db.collection('machines').doc(id).get()
    .then(doc => {
        const data = doc.data();
        const startTime = new Date(data[`${timerType}_start_time`]);
        const elapsed = (new Date() - startTime) / 1000;
        const newTotalTime = data[`${timerType}_total_time`] + elapsed;
        db.collection('machines').doc(id).update({
            [`${timerType}_start_time`]: null,
            [`${timerType}_total_time`]: newTotalTime,
            status: 'Stopped/Finished',
        })
        .then(() => {
            res.status(200).send(`${timerType.charAt(0).toUpperCase() + timerType.slice(1)} timer stopped`);
        });
    })
    .catch(err => {
        console.error(`Error stopping ${timerType} timer:`, err.message);
        res.status(500).send(err.message);
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
    db.collection('machines').get()
    .then(snapshot => {
        const machines = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            machines.push({
                id: doc.id,
                ...data,
                total_time: secondsToHMS(data.total_time),
                inspection_total_time: secondsToHMS(data.inspection_total_time),
                servicing_total_time: secondsToHMS(data.servicing_total_time),
            });
        });
        res.json(machines);
    })
    .catch(err => {
        console.error('Error fetching machines:', err.message);
        res.status(500).send(err.message);
    });
});

// Get machine by id
app.get('/machines/:id', (req, res) => {
    const { id } = req.params;
    db.collection('machines').doc(id).get()
    .then(doc => {
        if (!doc.exists) {
            res.status(404).send('Machine not found');
            return;
        }
        const data = doc.data();
        db.collection('issues').where('machine_id', '==', id).get()
        .then(snapshot => {
            const issues = [];
            snapshot.forEach(issueDoc => {
                issues.push({ id: issueDoc.id, ...issueDoc.data() });
            });
            res.json({
                ...data,
                total_time: secondsToHMS(data.total_time),
                inspection_total_time: secondsToHMS(data.inspection_total_time),
                servicing_total_time: secondsToHMS(data.servicing_total_time),
                issues,
            });
        });
    })
    .catch(err => {
        console.error('Error fetching machine:', err.message);
        res.status(500).send(err.message);
    });
});


// Add issue
app.post('/machines/:id/issues', (req, res) => {
    const { id } = req.params;
    const { issue, note, severity } = req.body;
    db.collection('issues').add({
        machine_id: id,
        issue,
        status: 'Pending',
        note,
        severity,
        created_at: new Date().toISOString(),
    })
    .then(() => {
        db.collection('issues').where('machine_id', '==', id).get()
        .then(snapshot => {
            const issues = [];
            snapshot.forEach(issueDoc => {
                issues.push({ id: issueDoc.id, ...issueDoc.data() });
            });
            res.status(201).json(issues);
        });
    })
    .catch(err => {
        console.error('Error adding issue:', err.message);
        res.status(500).send(err.message);
    });
});

// Remove issue
app.delete('/machines/:machineId/issues/:issueId', (req, res) => {
    const { issueId } = req.params;
    db.collection('issues').doc(issueId).delete()
    .then(() => {
        const { machineId } = req.params;
        db.collection('issues').where('machine_id', '==', machineId).get()
        .then(snapshot => {
            const issues = [];
            snapshot.forEach(issueDoc => {
                issues.push({ id: issueDoc.id, ...issueDoc.data() });
            });
            res.status(200).json(issues);
        });
    })
    .catch(err => {
        console.error('Error removing issue:', err.message);
        res.status(500).send(err.message);
    });
});

// Update issue note
app.put('/machines/:machineId/issues/:issueId/note', (req, res) => {
    const { issueId } = req.params;
    const { note } = req.body;
    db.collection('issues').doc(issueId).update({ note })
    .then(() => {
        const { machineId } = req.params;
        db.collection('issues').where('machine_id', '==', machineId).get()
        .then(snapshot => {
            const issues = [];
            snapshot.forEach(issueDoc => {
                issues.push({ id: issueDoc.id, ...issueDoc.data() });
            });
            res.status(200).json(issues);
        });
    })
    .catch(err => {
        console.error('Error updating note:', err.message);
        res.status(500).send(err.message);
    });
});

// Update issue severity
app.put('/machines/:machineId/issues/:issueId/severity', (req, res) => {
    const { issueId } = req.params;
    const { severity } = req.body;
    db.collection('issues').doc(issueId).update({ severity })
    .then(() => {
        const { machineId } = req.params;
        db.collection('issues').where('machine_id', '==', machineId).get()
        .then(snapshot => {
            const issues = [];
            snapshot.forEach(issueDoc => {
                issues.push({ id: issueDoc.id, ...issueDoc.data() });
            });
            res.status(200).json(issues);
        });
    })
    .catch(err => {
        console.error('Error updating severity:', err.message);
        res.status(500).send(err.message);
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
