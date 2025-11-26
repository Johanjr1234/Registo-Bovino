// Archivo: app.js
import { db, storage } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// --- FUNCIONES DE UTILIDAD ---

/**
 * Calcula la edad en años y meses.
 * @param {string} dateString - La fecha de nacimiento (YYYY-MM-DD).
 * @returns {string} La edad formateada.
 */
function calcularEdad(dateString) {
    if (!dateString) {
        return "Edad Desconocida";
    }
    const birthDate = new Date(dateString);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    // Ajustar si el mes de nacimiento es posterior al mes actual
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    
    if (years === 0 && months === 0) {
        return "Menos de 1 mes";
    }
    if (years === 0) {
        return `${months} meses`;
    }
    if (months === 0) {
        return `${years} años`;
    }
    return `${years} años y ${months} meses`;
}

/**
 * Formatea un número como moneda colombiana (COP).
 * @param {number} amount - El valor numérico.
 * @returns {string} El valor formateado (ej: $ 2.500.000).
 */
function formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(amount);
}


// --- LÓGICA DE REGISTRO (Solo se ejecuta en index.html) ---

const registroForm = document.getElementById('registroForm');

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Guardando...';

        // 1. Obtener datos del formulario
        const nombre = document.getElementById('nombre').value;
        const fechaNacimiento = document.getElementById('fechaNacimiento').value || null; 
        const sexo = document.getElementById('sexo').value;
        const raza = document.getElementById('raza').value;
        const idMadre = document.getElementById('idMadre').value || null;
        const estado = document.getElementById('estado').value;
        const precioCompra = parseFloat(document.getElementById('precioCompra').value) || 0;
        const fotoFile = document.getElementById('foto').files[0];
        
        let fotoURL = '';

        try {
            // 2. Subir la foto a Firebase Storage
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

            mensaje.textContent = `✅ ¡Animal ${nombre} registrado con éxito!`;
            registroForm.reset(); 
            
        } catch (error) {
            console.error("Error al registrar:", error);
            mensaje.textContent = '❌ Error al guardar. Revisa la consola para más detalles.';
        }
    });
}


// --- LÓGICA DE LECTURA DE INVENTARIO (Solo se ejecuta en inventario.html) ---

const inventarioListado = document.getElementById('inventario-listado');

if (inventarioListado) {
    // Función principal para obtener y mostrar todos los datos
    async function cargarInventario() {
        inventarioListado.innerHTML = '<p style="text-align: center;">Obteniendo datos de la nube...</p>';
        try {
            // 1. Obtener todos los documentos
            const querySnapshot = await getDocs(collection(db, "animales"));
            const animalesData = [];
            
            // Mapeamos los documentos para tener un array limpio de objetos
            querySnapshot.forEach((doc) => {
                animalesData.push({ id: doc.id, ...doc.data() });
            });
            
            // 2. Separar Madres e Hijos para crear el Árbol Genealógico
            // Este mapa guardará las crías bajo la llave del ID de la madre
            const mapaDescendencia = {};
            const animalesMadres = []; // Animales sin madre registrada
            
            animalesData.forEach(animal => {
                if (animal.idMadre) {
                    // Si tiene idMadre, es una cría
                    const madreID = animal.idMadre;
                    if (!mapaDescendencia[madreID]) {
                        mapaDescendencia[madreID] = [];
                    }
                    mapaDescendencia[madreID].push(animal);
                } else {
                    // Si NO tiene idMadre, lo listamos en el nivel superior
                    animalesMadres.push(animal);
                }
            });

            // 3. Renderizar la lista
            inventarioListado.innerHTML = ''; // Limpiamos el mensaje de carga

            if (animalesMadres.length === 0) {
                 inventarioListado.innerHTML = '<p style="text-align: center;">Aún no hay animales registrados en el inventario principal. ¡Comienza a agregar!</p>';
                 return;
            }
            
            // Iteramos sobre todos los animales de nivel superior
            animalesMadres.forEach(animal => {
                const edad = calcularEdad(animal.fechaNacimiento);
                const crías = mapaDescendencia[animal.nombre] || [];

                // Creamos la tarjeta del animal
                const cardHTML = `
                    <div class="animal-card">
                        <div class="animal-header" onclick="document.getElementById('details-${animal.id}').style.display = document.getElementById('details-${animal.id}').style.display === 'block' ? 'none' : 'block'">
                            <span>${animal.nombre} (${animal.sexo}) - ${animal.raza}</span>
                            <span class="age-badge">${edad}</span>
                        </div>
                        
                        <div id="details-${animal.id}" class="animal-details">
                            <p><strong>Estado:</strong> ${animal.estado}</p>
                            ${animal.fechaNacimiento ? `<p><strong>F. Nacimiento:</strong> ${animal.fechaNacimiento}</p>` : ''}
                            <p><strong>P. Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                            
                            ${animal.fotoURL ? `<img src="${animal.fotoURL}" alt="Foto de ${animal.nombre}">` : ''}

                            <div class="offspring-list">
                                <strong>Crías Registradas (${crías.length}):</strong>
                                <ul>
                                    ${crías.length > 0 
                                        ? crías.map(cria => `<li>${cria.nombre} (${cria.sexo}) - ${calcularEdad(cria.fechaNacimiento)}</li>`).join('') 
                                        : '<li>Aún no tiene crías registradas.</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                inventarioListado.innerHTML += cardHTML;
            });

        } catch (error) {
            console.error("Error al cargar el inventario:", error);
            inventarioListado.innerHTML = `<p style="color: red;">❌ Error al conectar con Firebase: ${error.message}</p>`;
        }
    }
    
    // Llamar a la función al cargar la página
    cargarInventario();
}
