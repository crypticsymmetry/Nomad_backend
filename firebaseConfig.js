const admin = require('firebase-admin');
const serviceAccount = require('serviceAccountKey.json'); // Ensure the correct path

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "nomadpowersports-84e70" // Replace with your project ID
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
