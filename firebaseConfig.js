const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Ensure you have this file from Firebase console

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "nomadpowersports-84e70" // replace with your project ID
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
