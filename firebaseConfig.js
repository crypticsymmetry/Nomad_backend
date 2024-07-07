const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Ensure this path is correct

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "nomadpowersports-84e70.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
