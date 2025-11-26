// Archivo: firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tu configuración de Firebase (Copiada de lo que me enviaste)
const firebaseConfig = {
  apiKey: "AIzaSyBIRieWbycyJg2wEYjXXj4SvwOo2Af3Ubc",
  authDomain: "ganaderia-control-3dd11.firebaseapp.com",
  projectId: "ganaderia-control-3dd11",
  storageBucket: "ganaderia-control-3dd11.firebasestorage.app",
  messagingSenderId: "316391024184",
  appId: "1:316391024184:web:17dc1fe0fd7dfc100f28cd"
};

// Tu llave de ImgBB (Para subir fotos gratis)
const IMGBB_API_KEY = "76b0f8378bb6ee12aae17f2bf7b14879";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exportamos la base de datos y la llave de ImgBB para que app.js las use
export { db, IMGBB_API_KEY };
