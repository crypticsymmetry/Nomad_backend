const firebase = require("firebase/app");
require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyCEjiw2NdpMSIuv0_VKXHzlrMywAyMtYg4",
    authDomain: "nomadpowersports-84e70.firebaseapp.com",
    projectId: "nomadpowersports-84e70",
    storageBucket: "nomadpowersports-84e70.appspot.com",
    messagingSenderId: "476619609513",
    appId: "1:476619609513:web:15a6bcc9a8677a9e0ce0b8",
    measurementId: "G-M1D1T3QZRX"
  };
  
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

module.exports = db;
