// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- 1. FUNCIONES GLOBALES (Para que funcionen los botones en el HTML) ---

// Función para ABRIR/CERRAR los detalles (CORREGIDA)
window.toggleDetails = (id) => {
    const elemento = document.getElementById(`details-${id}`);
    if (elemento.style.display === 'block') {
        elemento.style.display = 'none'; // Cerrar
    } else {
        elemento.style.display = 'block'; // Abrir
    }
};

// Función para VENDER
window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿En cuánto se vendió a ${nombre}? \n(Solo números. Si murió, pon 0)`);
    if (precio === null) return; 

    precio = parseFloat(precio);
    if (isNaN(precio)) {
        alert("Número no válido.");
        return;
    }

    if (!confirm(`¿Confirmar venta/salida de ${nombre}?`)) return;

    try {
        const animalRef = doc(db, "animales", id);
        await updateDoc(animalRef, {
            estado: "VENDIDO",
            precioVenta: precio
        });
        alert("✅ Estado actualizado.");
        location.reload(); 
    } catch (error) {
        alert("Error: " + error.message);
    }
};

// --- 2. FUNCIONES DE UTILIDAD ---

async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta API Key ImgBB");
    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", IMGBB_API_KEY);
    const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (result.success) return result.data.url;
    else throw new Error("Error subiendo imagen");
}

function calcularEdad(dateString) {
    if (!dateString) return "Desconocida";
    const birthDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    return years === 0 ? `${months} m` : `${years} a, ${months} m`;
}

function formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

// --- 3. LÓGICA DE REGISTRO ---
const registroForm = document.getElementById('registroForm');
if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Guardando...';
        mensaje.style.color = 'black';

        try {
            const nombre = document.getElementById('nombre').value.toUpperCase();
            const fotoFile = document.getElementById('foto').files[0];
            let fotoURL = '';

            if (fotoFile) {
                mensaje.textContent = 'Subiendo foto...';
                fotoURL = await subirFotoAImgBB(fotoFile);
            }

            const nuevoAnimal = {
                nombre: nombre,
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                idMadre: document.getElementById('idMadre').value ? document.getElementById('idMadre').value.toUpperCase() : null,
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fechaRegistro: serverTimestamp(),
                fotoURL: fotoURL
            };

            await addDoc(collection(db, 'animales'), nuevoAnimal);
            mensaje.textContent = `✅ ${nombre} registrado!`;
            mensaje.style.color = 'green';
            registroForm.reset();
        } catch (error) {
            mensaje.textContent = '❌ Error: ' + error.message;
            mensaje.style.color = 'red';
        }
    });
}

// --- 4. LÓGICA DE INVENTARIO ---
const inventarioListado = document.getElementById('inventario-listado');
if (inventarioListado) {
    async function cargarInventario() {
        try {
            const querySnapshot = await getDocs(collection(db, "animales"));
            const animalesData = [];
            querySnapshot.forEach((doc) => animalesData.push({ id: doc.id, ...doc.data() }));
            
            // Filtrar y ordenar: Primero las crías
            const mapaDescendencia = {};
            const animalesMostrar = []; // Lista final

            // Primero, organizamos quién es hijo de quién
            animalesData.forEach(animal => {
                if (animal.estado !== "VENDIDO") { // Solo mostrar activos
                    if (animal.idMadre) {
                        const madreID = animal.idMadre;
                        if (!mapaDescendencia[madreID]) mapaDescendencia[madreID] = [];
                        mapaDescendencia[madreID].push(animal);
                    }
                    animalesMostrar.push(animal); // Agregamos todos a la lista principal
                }
            });

            inventarioListado.innerHTML = '';
            if (animalesMostrar.length === 0) {
                 inventarioListado.innerHTML = '<p style="text-align: center;">No hay animales activos.</p>';
                 return;
            }
            
            animalesMostrar.forEach(animal => {
                const edad = calcularEdad(animal.fechaNacimiento);
                const crías = mapaDescendencia[animal.nombre] || [];

                // Lógica de miniatura: Si hay URL, muestra foto. Si no, muestra ícono.
                // Agregamos un "onerror" por si la foto vieja está rota.
                const thumbHTML = animal.fotoURL 
                    ? `<img src="${animal.fotoURL}" class="cow-thumb" alt="foto" onerror="this.src=''; this.className='no-thumb'; this.innerHTML='🐮'">`
                    : `<div class="no-thumb">🐮</div>`;

                const cardHTML = `
                    <div class="animal-card">
                        <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                            ${thumbHTML}
                            <div class="info-resumen">
                                <span class="nombre-animal">${animal.nombre} (${animal.sexo})</span>
                                <span class="raza-animal">${animal.raza}</span>
                            </div>
                            <span class="age-badge">${edad}</span>
                        </div>
                        
                        <div id="details-${animal.id}" class="animal-details">
                            <p><strong>Estado:</strong> ${animal.estado}</p>
                            <p><strong>P. Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                            ${animal.fechaNacimiento ? `<p><strong>Nacimiento:</strong> ${animal.fechaNacimiento}</p>` : ''}
                            
                            ${animal.fotoURL ? `<img src="${animal.fotoURL}" class="foto-grande" alt="Foto grande">` : ''}

                            <div class="offspring-list">
                                <strong>Crías (${crías.length}):</strong>
                                <ul>
                                    ${crías.length > 0 
                                        ? crías.map(cria => `<li>${cria.nombre} (${cria.estado})</li>`).join('') 
                                        : '<li>Sin crías.</li>'}
                                </ul>
                            </div>

                            <button class="btn-vender" onclick="event.stopPropagation(); window.venderAnimal('${animal.id}', '${animal.nombre}')">
                                💰 VENDER / DAR DE BAJA
                            </button>
                        </div>
                    </div>
                `;
                inventarioListado.innerHTML += cardHTML;
            });

        } catch (error) {
            inventarioListado.innerHTML = `<p style="color: red;">Error cargando lista: ${error.message}</p>`;
        }
    }
    cargarInventario();
}
