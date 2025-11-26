// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- 1. FUNCIONES GLOBALES ---

window.toggleDetails = (id) => {
    const elemento = document.getElementById(`details-${id}`);
    elemento.style.display = (elemento.style.display === 'block') ? 'none' : 'block';
};

window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿En cuánto se vendió a ${nombre}? \n(Solo números)`);
    if (precio === null) return; 

    precio = parseFloat(precio);
    if (isNaN(precio)) { alert("Número no válido."); return; }

    if (!confirm(`¿Confirmar venta de ${nombre}?`)) return;

    try {
        await updateDoc(doc(db, "animales", id), { estado: "VENDIDO", precioVenta: precio });
        alert("✅ Venta registrada.");
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
    else throw new Error("Error ImgBB");
}

// CORRECCIÓN DE EDAD: Texto más claro
function calcularEdad(dateString) {
    if (!dateString) return "Sin fecha";
    const birthDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    
    // Formato amigable
    if (years === 0) return `${months} Meses`;
    if (months === 0) return `${years} Años`;
    return `${years} Años, ${months} Meses`;
}

function formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

// --- 3. REGISTRO ---
const registroForm = document.getElementById('registroForm');
if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Subiendo...';
        
        try {
            const fotoFile = document.getElementById('foto').files[0];
            let fotoURL = '';

            if (fotoFile) {
                fotoURL = await subirFotoAImgBB(fotoFile);
            }

            await addDoc(collection(db, 'animales'), {
                nombre: document.getElementById('nombre').value.toUpperCase(),
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                idMadre: document.getElementById('idMadre').value ? document.getElementById('idMadre').value.toUpperCase() : null,
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fechaRegistro: serverTimestamp(),
                fotoURL: fotoURL
            });

            mensaje.textContent = `✅ Guardado con éxito!`;
            mensaje.style.color = 'green';
            registroForm.reset();
        } catch (error) {
            mensaje.textContent = '❌ Error: ' + error.message;
        }
    });
}

// --- 4. INVENTARIO (CORRECCIÓN DE FOTOS) ---
const inventarioListado = document.getElementById('inventario-listado');
if (inventarioListado) {
    async function cargarInventario() {
        try {
            const querySnapshot = await getDocs(collection(db, "animales"));
            const animalesData = [];
            querySnapshot.forEach((doc) => animalesData.push({ id: doc.id, ...doc.data() }));
            
            const mapaDescendencia = {};
            const animalesMostrar = []; 

            animalesData.forEach(animal => {
                if (animal.estado !== "VENDIDO") {
                    if (animal.idMadre) {
                        const madreID = animal.idMadre;
                        if (!mapaDescendencia[madreID]) mapaDescendencia[madreID] = [];
                        mapaDescendencia[madreID].push(animal);
                    }
                    animalesMostrar.push(animal);
                }
            });

            inventarioListado.innerHTML = '';
            if (animalesMostrar.length === 0) {
                 inventarioListado.innerHTML = '<p style="text-align: center;">No hay animales activos.</p>';
                 return;
            }
            
            // IMAGEN DE RESERVA (Una vaquita genérica si falla la foto)
            const fallbackImage = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

            animalesMostrar.forEach(animal => {
                const edad = calcularEdad(animal.fechaNacimiento);
                const crías = mapaDescendencia[animal.nombre] || [];

                // CORRECCIÓN FOTO: Si falla, carga la imagen de reserva
                const thumbHTML = animal.fotoURL 
                    ? `<img src="${animal.fotoURL}" class="cow-thumb" alt="foto" onerror="this.onerror=null;this.src='${fallbackImage}';">`
                    : `<div class="no-thumb">🐮</div>`;
                
                // Para la foto grande en el detalle
                const bigPhotoHTML = animal.fotoURL
                    ? `<img src="${animal.fotoURL}" class="foto-grande" alt="Foto grande" onerror="this.onerror=null;this.src='${fallbackImage}';">`
                    : '';

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
                            
                            ${bigPhotoHTML}

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
            inventarioListado.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
    cargarInventario();
}
