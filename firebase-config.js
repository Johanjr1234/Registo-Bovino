// Archivo: firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIRieWbycyJg2wEYjXXj4SvwOo2Af3Ubc",
  authDomain: "ganaderia-control-3dd11.firebaseapp.com",
  projectId: "ganaderia-control-3dd11",
  storageBucket: "ganaderia-control-3dd11.firebasestorage.app",
  messagingSenderId: "316391024184",
  appId: "1:316391024184:web:17dc1fe0fd7dfc100f28cd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
