// Archivo: firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBIRieWbycyJg2wEYjXXj4SvwOo2Af3Ubc",
  authDomain: "ganaderia-control-3dd11.firebaseapp.com",
  projectId: "ganaderia-control-3dd11",
  storageBucket: "ganaderia-control-3dd11.firebasestorage.app",
  messagingSenderId: "316391024184",
  appId: "1:316391024184:web:17dc1fe0fd7dfc100f28cd"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- HABILITAR PERSISTENCIA OFFLINE ---
enableIndexedDbPersistence(db)
  .then(() => {
    console.log("🔥 Persistencia offline de Firestore habilitada.");
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Persistencia offline ya habilitada en otra pestaña.");
    } else if (err.code === 'unimplemented') {
      console.error("El navegador no soporta la persistencia offline de Firestore.");
    } else {
      console.error("Error al habilitar persistencia offline:", err);
    }
  });

// API Key para ImgBB
export const IMGBB_API_KEY = "76b0f8378bb6ee12aae17f2bf7b14879";

export { db };
