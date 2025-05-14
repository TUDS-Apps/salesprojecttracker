// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// VVVVVV  PASTE YOUR firebaseConfig FROM FIREBASE HERE  VVVVVV
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Replace with your actual apiKey
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // Replace
  projectId: "YOUR_PROJECT_ID", // Replace
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // Replace
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace
  appId: "YOUR_APP_ID" // Replace
};
// ^^^^^^ MAKE SURE YOU PASTED YOUR ACTUAL CONFIG ABOVE ^^^^^^

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db }; // Export the Firestore instance
