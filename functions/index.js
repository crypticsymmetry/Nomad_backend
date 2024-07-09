const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

const getShipEngineApiKey = async () => {
  const [version] = await admin
    .secretManager()
    .accessSecretVersion({ name: 'projects/YOUR_PROJECT_ID/secrets/SHIPENGINE_API_KEY/versions/latest' });

  return version.payload.data.toString();
};

exports.trackLabel = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const issuesSnapshot = await db.collection('issues').where('trackingNumber', '!=', '').get();
  const shipEngineAPIKey = await getShipEngineApiKey();

  issuesSnapshot.forEach(async (doc) => {
    const issue = doc.data();
    const trackingNumber = issue.trackingNumber;
    const carrierCode = issue.carrierCode; // e.g., 'ups', 'usps', 'fedex'

    try {
      const response = await axios.get(`https://api.shipengine.com/v1/tracking?carrier_code=${carrierCode}&tracking_number=${trackingNumber}`, {
        headers: {
          'API-Key': shipEngineAPIKey
        }
      });

      const trackingData = response.data;
      await db.collection('issues').doc(doc.id).update({ trackingData });
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    }
  });

  return null;
});
