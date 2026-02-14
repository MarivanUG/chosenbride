import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCUTwb6YuqDaqBH9yZSgpOPhnFyJ8Fo0j4",
  authDomain: "chosen-bride-finance.firebaseapp.com",
  projectId: "chosen-bride-finance",
  storageBucket: "chosen-bride-finance.firebasestorage.app",
  messagingSenderId: "441922006853",
  appId: "1:441922006853:web:f6c892d7a739da1d95d82c",
  measurementId: "G-BDXBSX07EV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Export instances
export { app, analytics, auth, db };

// Global exposure for debugging
window.firebaseCtx = { app, auth, db };
console.log('Firebase Configuration Loaded');
