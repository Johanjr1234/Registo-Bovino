// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- 1. GESTIÓN DE INTERFAZ ---
window.toggleDetails = (id) => {
    const el = document.getElementById(`details-${id}`);
    // Si existe (porque es madre), lo abrimos
    if (el) {
        el.style.display = (el.style.display === 'block') ? 'none' : 'block';
    }
};

window.toggleChildActions = (id) => {
    const el = document.getElementById(`child-actions-${id}`);
    // Abrimos el menú de acciones de la cría
    if (el) {
        el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
    }
};

// --- 2. ACCIONES (Funcionan para madres e hijos) ---
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
            window.cargarInventario(false);
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.eliminarAnimal = async (id, nombre) => {
    if (confirm(`⚠️ ¿ELIMINAR a ${nombre}?\n(Acción permanente)`)) {
        try {
            await deleteDoc(doc(db, "animales", id));
            alert("🗑️ Eliminado.");
            window.cargarInventario(false);
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.editarAnimal = async (id, nombreActual, razaActual) => {
    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (nuevoNombre === null) return;
    const nuevaRaza = prompt("Nueva raza:", razaActual);
    if (nuevaRaza === null) return;

    try {
        await updateDoc(doc(db, "animales", id), { nombre: nuevoNombre.toUpperCase(), raza: nuevaRaza });
        alert("✅ Actualizado.");
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

// NUEVA FÓRMULA DE EDAD COMPLETA
function calcularEdad(dateString) {
    if (!dateString) return "--";
    const birth = new Date(dateString);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
        years--;
        months += 12;
    }

    if (years === 0 && months === 0) return "Recién nacido";
    if (years === 0) return `${months} Meses`;
    if (months === 0) return `${years} Años`;
    
    // AQUÍ ESTÁ EL CAMBIO: Muestra ambos
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

// --- 5. INVENTARIO ---
const listado = document.getElementById('inventario-listado');
window.cargarInventario = async (verHistorial = false) => {
    if (!listado) return;
    listado.innerHTML = '<p style="text-align: center;">Cargando...</p>';
    
    try {
        const snap = await getDocs(collection(db, "animales"));
        const data = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() }));

        const listaFiltrada = data.filter(a => verHistorial ? (a.estado === "VENDIDO") : (a.estado !== "VENDIDO"));

        if (listaFiltrada.length === 0) {
            listado.innerHTML = `<p style="text-align: center; margin-top:20px;">${verHistorial ? 'Sin ventas.' : 'Corral vacío.'}</p>`;
            return;
        }

        const mapaHijos = {};
        listaFiltrada.forEach(animal => {
            if (animal.idMadre) {
                if (!mapaHijos[animal.idMadre]) mapaHijos[animal.idMadre] = [];
                mapaHijos[animal.idMadre].push(animal);
            }
        });

        listado.innerHTML = '';
        const nombresPresentes = listaFiltrada.map(a => a.nombre);
        const fallback = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

        listaFiltrada.forEach(animal => {
            if (!verHistorial && animal.idMadre && nombresPresentes.includes(animal.idMadre)) return; 

            const edad = calcularEdad(animal.fechaNacimiento);
            const hijos = mapaHijos[animal.nombre] || [];
            const foto = animal.fotoURL || fallback;

            // --- CONSTRUCCIÓN DE LA MINI-TARJETA PARA HIJOS ---
            let hijosHTML = '';
            if (hijos.length > 0) {
                hijosHTML = `<div class="offspring-container">
                    <span class="offspring-title">🧬 Descendencia (${hijos.length}) - Toca para opciones</span>
                    ${hijos.map(h => {
                        const hEdad = calcularEdad(h.fechaNacimiento);
                        const hFoto = h.fotoURL || fallback;
                        // Tarjeta interactiva del hijo
                        return `
                        <div class="mini-cria-card">
                            <div class="mini-header" onclick="event.stopPropagation(); window.toggleChildActions('${h.id}')">
                                <img src="${hFoto}" class="mini-thumb" onerror="this.src='${fallback}'">
                                <div class="mini-info">
                                    <strong>${h.nombre} (${h.sexo})</strong><br>
                                    <small>${hEdad}</small>
                                </div>
                            </div>
                            <div id="child-actions-${h.id}" class="mini-actions" style="display:none;">
                                <button class="btn-mini btn-editar" onclick="window.editarAnimal('${h.id}', '${h.nombre}', '${h.raza}')">✏️ Editar</button>
                                <button class="btn-mini btn-vender" onclick="window.venderAnimal('${h.id}', '${h.nombre}')">💰 Vender</button>
                                <button class="btn-mini btn-eliminar" onclick="window.eliminarAnimal('${h.id}', '${h.nombre}')">🗑️ Borrar</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
            }

            // --- TARJETA PRINCIPAL (MADRE) ---
            let botonesHTML = '';
            if (verHistorial) {
                botonesHTML = `<div class="acciones"><button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️ Borrar</button></div>`;
            } else {
                botonesHTML = `<div class="acciones">
                    <button class="btn-accion btn-editar" onclick="window.editarAnimal('${animal.id}', '${animal.nombre}', '${animal.raza}')">✏️ Editar</button>
                    <button class="btn-accion btn-vender" onclick="window.venderAnimal('${animal.id}', '${animal.nombre}')">💰 Vender</button>
                    <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️</button>
                </div>`;
            }

            const thumbHTML = animal.fotoURL 
                ? `<img src="${animal.fotoURL}" class="cow-thumb" onerror="this.src='${fallback}'">`
                : `<div class="no-thumb">🐮</div>`;

            listado.innerHTML += `
                <div class="animal-card">
                    <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                        ${thumbHTML}
                        <div class="info-resumen">
                            <span class="nombre-animal">${animal.nombre} (${animal.sexo})</span>
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

if (listado) window.cargarInventario(false);
