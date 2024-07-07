const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Ensure this path is correct

console.log('Initializing Firebase Admin SDK...');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "nomadpowersports-84e70.appspot.com" // Replace with your project ID
    });

    console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
