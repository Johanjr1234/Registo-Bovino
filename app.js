// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; // Importamos la DB y la llave de ImgBB
import { collection, addDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- FUNCIONES DE UTILIDAD ---

/**
 * Función CLAVE: Sube la imagen a ImgBB (GRATIS) y devuelve el enlace.
 * Se encarga de manejar archivos grandes como 4MB.
 */
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) {
        throw new Error("ERROR FATAL: La llave IMGBB_API_KEY no está configurada en firebase-config.js");
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", IMGBB_API_KEY);

    const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData,
    });

    const result = await response.json();

    if (result.success) {
        return result.data.url; // Retorna el enlace directo a la imagen
    } else {
        // Muestra el error de ImgBB si falla la subida
        throw new Error("ImgBB falló: " + (result.error.message || "Error desconocido"));
    }
}


function calcularEdad(dateString) {
    if (!dateString) return "Edad Desconocida";
    const birthDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    return years === 0 ? `${months} meses` : `${years} años y ${months} meses`;
}

function formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}


// --- LÓGICA DE REGISTRO ---
const registroForm = document.getElementById('registroForm');

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Procesando imagen y guardando...';
        mensaje.style.color = 'black';

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
            // AQUI ESTA EL CAMBIO: Primero subimos a ImgBB
            if (fotoFile) {
                mensaje.textContent = `Subiendo foto de ${fotoFile.size/1024/1024} MB...`;
                fotoURL = await subirFotoAImgBB(fotoFile);
            }

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
                fotoURL: fotoURL // Aquí guardamos el ENLACE de ImgBB
            };

            await addDoc(collection(db, 'animales'), nuevoAnimal);

            mensaje.textContent = `✅ ¡Animal ${nombre} registrado con éxito! (Foto externa OK)`;
            mensaje.style.color = 'green';
            registroForm.reset();
            
        } catch (error) {
            console.error("Error:", error);
            mensaje.textContent = '❌ Error: ' + error.message;
            mensaje.style.color = 'red';
        }
    });
}

// --- LÓGICA DE LECTURA (INVENTARIO) ---

const inventarioListado = document.getElementById('inventario-listado');

if (inventarioListado) {
    async function cargarInventario() {
        inventarioListado.innerHTML = '<p style="text-align: center;">Cargando ganado...</p>';
        try {
            const querySnapshot = await getDocs(collection(db, "animales"));
            const animalesData = [];
            querySnapshot.forEach((doc) => {
                animalesData.push({ id: doc.id, ...doc.data() });
            });
            
            const mapaDescendencia = {};
            const animalesMadres = [];
            
            animalesData.forEach(animal => {
                if (animal.idMadre) {
                    const madreID = animal.idMadre;
                    if (!mapaDescendencia[madreID]) mapaDescendencia[madreID] = [];
                    mapaDescendencia[madreID].push(animal);
                } else {
                    animalesMadres.push(animal);
                }
            });

            inventarioListado.innerHTML = '';

            if (animalesMadres.length === 0) {
                 inventarioListado.innerHTML = '<p style="text-align: center;">No hay animales. ¡Agrega uno!</p>';
                 return;
            }
            
            animalesMadres.forEach(animal => {
                const edad = calcularEdad(animal.fechaNacimiento);
                const crías = mapaDescendencia[animal.nombre] || [];

                const cardHTML = `
                    <div class="animal-card">
                        <div class="animal-header" onclick="document.getElementById('details-${animal.id}').style.display = document.getElementById('details-${animal.id}').style.display === 'block' ? 'none' : 'block'">
                            <span>${animal.nombre} (${animal.sexo})</span>
                            <span class="age-badge">${edad}</span>
                        </div>
                        
                        <div id="details-${animal.id}" class="animal-details">
                            <p><strong>Raza:</strong> ${animal.raza}</p>
                            <p><strong>Estado:</strong> ${animal.estado}</p>
                            <p><strong>P. Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                            
                            ${animal.fotoURL ? `<img src="${animal.fotoURL}" alt="Foto" style="width: 100%; max-width: 300px; display: block; margin: 10px auto;">` : ''}

                            <div class="offspring-list">
                                <strong>Crías (${crías.length}):</strong>
                                <ul>
                                    ${crías.length > 0 
                                        ? crías.map(cria => `<li>${cria.nombre} (${cria.sexo}) - ${calcularEdad(cria.fechaNacimiento)}</li>`).join('') 
                                        : '<li>Sin crías registradas.</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                inventarioListado.innerHTML += cardHTML;
            });

        } catch (error) {
            console.error("Error:", error);
            inventarioListado.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
    cargarInventario();
}
