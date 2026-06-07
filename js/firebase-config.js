import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDXI8ippfNbzXTKGkYPSeUyeUdtD7mBybs",
  authDomain: "wellness-insight-52aa7.firebaseapp.com",
  projectId: "wellness-insight-52aa7",
  storageBucket: "wellness-insight-52aa7.firebasestorage.app",
  messagingSenderId: "221532965975",
  appId: "1:221532965975:web:33599ee09a38f010d5a712",
  measurementId: "G-MEFLFPSRET"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

console.log("Firebase Initialized Successfully");
console.log(app);
console.log(auth);
console.log(db);

export { app, auth, db, analytics };