// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- 1. GESTIÓN DE INTERFAZ (Abrir detalles) ---
window.toggleDetails = (id) => {
    const el = document.getElementById(`details-${id}`);
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
};

// --- 2. ACCIONES (Vender, Editar, Eliminar) ---

window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿Precio de venta de ${nombre}?\n(Si murió pon 0)`);
    if (precio === null) return;
    if (isNaN(parseFloat(precio))) { alert("Número inválido"); return; }

    if (confirm(`¿Marcar a ${nombre} como VENDIDO/SALIDA?`)) {
        try {
            await updateDoc(doc(db, "animales", id), { 
                estado: "VENDIDO", 
                precioVenta: parseFloat(precio),
                fechaSalida: new Date().toISOString().split('T')[0]
            });
            alert("✅ Movido al Historial.");
            window.cargarInventario(false); // Recargar
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.eliminarAnimal = async (id, nombre) => {
    if (confirm(`⚠️ ¿Estás seguro de ELIMINAR a ${nombre}?\nEsto borrará el registro permanentemente.\n(Usa 'Vender' si solo salió de la finca)`)) {
        try {
            await deleteDoc(doc(db, "animales", id));
            alert("🗑️ Registro eliminado.");
            window.cargarInventario(false);
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.editarAnimal = async (id, nombreActual, razaActual) => {
    // Edición simple por ahora
    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (nuevoNombre === null) return;
    
    const nuevaRaza = prompt("Nueva raza:", razaActual);
    if (nuevaRaza === null) return;

    try {
        await updateDoc(doc(db, "animales", id), { 
            nombre: nuevoNombre.toUpperCase(),
            raza: nuevaRaza 
        });
        alert("✅ Datos actualizados.");
        window.cargarInventario(false);
    } catch (e) { alert("Error: " + e.message); }
};

// --- 3. UTILIDADES ---
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta API Key");
    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", IMGBB_API_KEY);
    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error("Error subiendo foto");
}

function calcularEdad(dateString) {
    if (!dateString) return "--";
    const birth = new Date(dateString);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) { years--; months += 12; }
    if (years === 0) return `${months} Meses`;
    if (months === 0) return `${years} Años`;
    return `${years} Años, ${months} Meses`;
}

function formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

// --- 4. REGISTRO ---
const form = document.getElementById('registroForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mensaje');
        msg.textContent = 'Guardando...';
        try {
            const file = document.getElementById('foto').files[0];
            let url = file ? await subirFotoAImgBB(file) : '';

            await addDoc(collection(db, 'animales'), {
                nombre: document.getElementById('nombre').value.toUpperCase(),
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                idMadre: document.getElementById('idMadre').value ? document.getElementById('idMadre').value.toUpperCase() : null,
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fotoURL: url,
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado!';
            msg.style.color = 'green';
            form.reset();
        } catch (e) {
            msg.textContent = '❌ Error: ' + e.message;
            msg.style.color = 'red';
        }
    });
}

// --- 5. INVENTARIO (LÓGICA ÁRBOL) ---
const listado = document.getElementById('inventario-listado');

// Hacemos la función global para poder llamarla desde los botones HTML
window.cargarInventario = async (verHistorial = false) => {
    if (!listado) return;
    listado.innerHTML = '<p style="text-align: center;">Cargando...</p>';
    
    try {
        const snap = await getDocs(collection(db, "animales"));
        const data = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() }));

        // 1. Separar Activos vs Historial
        const listaFiltrada = data.filter(a => {
            return verHistorial ? (a.estado === "VENDIDO") : (a.estado !== "VENDIDO");
        });

        if (listaFiltrada.length === 0) {
            listado.innerHTML = `<p style="text-align: center; margin-top:20px;">${verHistorial ? 'No hay ventas registradas.' : 'Corral vacío.'}</p>`;
            return;
        }

        // 2. Organizar Descendencia (Mapa: Madre -> Lista de Hijos)
        const mapaHijos = {};
        // Solo incluimos hijos que estén en la misma lista (Activos con Activos)
        listaFiltrada.forEach(animal => {
            if (animal.idMadre) {
                if (!mapaHijos[animal.idMadre]) mapaHijos[animal.idMadre] = [];
                mapaHijos[animal.idMadre].push(animal);
            }
        });

        // 3. Renderizar
        listado.innerHTML = '';
        
        // Obtenemos los nombres de las vacas presentes para saber si la mamá está aquí
        const nombresPresentes = listaFiltrada.map(a => a.nombre);

        listaFiltrada.forEach(animal => {
            // TRUCO DEL ÁRBOL: 
            // Si la vaca tiene mamá Y la mamá está en esta lista visual, NO LA MOSTRAMOS afuera.
            // Se mostrará adentro de la mamá.
            if (!verHistorial && animal.idMadre && nombresPresentes.includes(animal.idMadre)) {
                return; 
            }

            const edad = calcularEdad(animal.fechaNacimiento);
            const hijos = mapaHijos[animal.nombre] || []; // Sus hijos
            const foto = animal.fotoURL || "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

            // HTML de los hijos (Mini tarjetas)
            let hijosHTML = '';
            if (hijos.length > 0) {
                hijosHTML = `<div class="offspring-container">
                    <span class="offspring-title">🧬 Descendencia (${hijos.length})</span>
                    ${hijos.map(h => `
                        <div class="mini-cria" onclick="event.stopPropagation(); window.toggleDetails('${h.id}')">
                            <img src="${h.fotoURL || foto}" class="mini-thumb">
                            <div>
                                <strong>${h.nombre}</strong> <small>(${calcularEdad(h.fechaNacimiento)})</small>
                            </div>
                        </div>
                        `).join('')}
                </div>`;
            }

            // Botones según la vista
            let botonesHTML = '';
            if (verHistorial) {
                botonesHTML = `<div class="acciones">
                    <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️ Borrar Historial</button>
                </div>`;
            } else {
                botonesHTML = `<div class="acciones">
                    <button class="btn-accion btn-editar" onclick="window.editarAnimal('${animal.id}', '${animal.nombre}', '${animal.raza}')">✏️ Editar</button>
                    <button class="btn-accion btn-vender" onclick="window.venderAnimal('${animal.id}', '${animal.nombre}')">💰 Vender</button>
                    <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️ Eliminar</button>
                </div>`;
            }

            // Tarjeta Principal
            listado.innerHTML += `
                <div class="animal-card">
                    <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                        <img src="${foto}" class="cow-thumb" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1998/1998610.png'">
                        <div class="info-resumen">
                            <span class="nombre-animal">${animal.nombre}</span>
                            <span class="raza-animal">${animal.raza}</span>
                        </div>
                        <span class="${verHistorial ? 'sold-badge' : 'age-badge'}">
                            ${verHistorial ? 'VENDIDO' : edad}
                        </span>
                    </div>

                    <div id="details-${animal.id}" class="animal-details">
                        <p><strong>Sexo:</strong> ${animal.sexo === 'H' ? 'Hembra' : 'Macho'}</p>
                        ${verHistorial ? `<p><strong>Venta:</strong> ${formatCOP(animal.precioVenta)}</p>` : `<p><strong>Compra:</strong> ${formatCOP(animal.precioCompra)}</p>`}
                        <p><strong>Nacimiento:</strong> ${animal.fechaNacimiento || 'No registrada'}</p>
                        
                        ${animal.fotoURL ? `<img src="${animal.fotoURL}" class="foto-grande">` : ''}

                        ${hijosHTML}
                        ${botonesHTML}
                    </div>
                </div>
            `;
        });

    } catch (e) {
        listado.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
    }
};

// Cargar por defecto al abrir
if (listado) window.cargarInventario(false);                                
