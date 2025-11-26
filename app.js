// Archivo: app.js
import { db, storage } from './firebase-config.js'; // Importa las llaves y conexión
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const registroForm = document.getElementById('registroForm');
const mensaje = document.getElementById('mensaje');

registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.textContent = 'Guardando...';

    // 1. Obtener datos del formulario
    const nombre = document.getElementById('nombre').value;
    const fechaNacimiento = document.getElementById('fechaNacimiento').value;
    const sexo = document.getElementById('sexo').value;
    const raza = document.getElementById('raza').value;
    const idMadre = document.getElementById('idMadre').value || null;
    const estado = document.getElementById('estado').value;
    const precioCompra = parseFloat(document.getElementById('precioCompra').value) || 0;
    const fotoFile = document.getElementById('foto').files[0];

    let fotoURL = '';

    try {
        // 2. Subir la foto a Firebase Storage (solo si hay archivo)
        if (fotoFile) {
            const storageRef = ref(storage, `fotos_ganado/${nombre}-${fotoFile.name}`);
            const snapshot = await uploadBytes(storageRef, fotoFile);
            fotoURL = await getDownloadURL(snapshot.ref);
        }

        // 3. Crear el objeto de datos
        const nuevoAnimal = {
            nombre: nombre.toUpperCase(),
            fechaNacimiento: fechaNacimiento,
            sexo: sexo,
            raza: raza,
            idMadre: idMadre ? idMadre.toUpperCase() : null,
            estado: estado,
            precioCompra: precioCompra,
            precioVenta: 0,
            fechaRegistro: serverTimestamp(),
            fotoURL: fotoURL
        };

        // 4. Guardar los datos en la colección 'animales'
        await addDoc(collection(db, 'animales'), nuevoAnimal);

        // 5. Mensaje de éxito y limpieza
        mensaje.textContent = `✅ ¡Animal ${nombre} registrado con éxito!`;
        registroForm.reset(); 

    } catch (error) {
        console.error("Error al registrar:", error);
        mensaje.textContent = '❌ Error al guardar. Revisa la consola para más detalles.';
    }
});
