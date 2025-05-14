// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAic56lPgHqnMSJAgslpTAsNqqwY19UHiQ",
  authDomain: "sales-project-tracker.firebaseapp.com",
  projectId: "sales-project-tracker",
  storageBucket: "sales-project-tracker.firebasestorage.app",
  messagingSenderId: "275799582428",
  appId: "1:275799582428:web:a44d210b2d48765d537619",
  measurementId: "G-6ZQ7SL2DX9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db }; // Export the Firestore instance
