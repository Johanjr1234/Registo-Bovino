// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- 1. GESTIÓN DE INTERFAZ ---
window.toggleDetails = (id) => {
    const el = document.getElementById(`details-${id}`);
    if (el) el.style.display = (el.style.display === 'block') ? 'none' : 'block';
};

window.toggleChildActions = (id) => {
    const el = document.getElementById(`child-actions-${id}`);
    if (el) el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
};

// --- 2. ACCIONES (Vender/Editar/Eliminar) ---
window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿Precio venta de ${nombre}? (0 si murió)`);
    if (precio === null) return;
    if (isNaN(parseFloat(precio))) return alert("Número inválido");

    if (confirm(`¿Marcar a ${nombre} como VENDIDO/SALIDA?`)) {
        try {
            await updateDoc(doc(db, "animales", id), { 
                estado: "VENDIDO", precioVenta: parseFloat(precio), fechaSalida: new Date().toISOString().split('T')[0] 
            });
            alert("✅ Movido al Historial.");
            window.cargarInventario(false);
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.eliminarAnimal = async (id, nombre) => {
    if (confirm(`⚠️ ¿ELIMINAR DEFINITIVAMENTE a ${nombre}?`)) {
        try {
            await deleteDoc(doc(db, "animales", id));
            alert("🗑️ Eliminado.");
            window.cargarInventario(false);
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.editarAnimal = async (id, nombre, raza) => {
    const n = prompt("Nombre:", nombre); if (n === null) return;
    const r = prompt("Raza:", raza); if (r === null) return;
    try {
        await updateDoc(doc(db, "animales", id), { nombre: n.toUpperCase(), raza: r });
        alert("✅ Actualizado.");
        window.cargarInventario(false);
    } catch (e) { alert("Error: " + e.message); }
};

// --- 3. UTILIDADES ---
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta API Key");
    const fd = new FormData(); fd.append("image", file); fd.append("key", IMGBB_API_KEY);
    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error("Error foto");
}

function calcularEdad(dateString) {
    if (!dateString) return "--";
    const birth = new Date(dateString);
    const now = new Date();
    let y = now.getFullYear() - birth.getFullYear();
    let m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) { y--; m += 12; }
    if (y === 0 && m === 0) return "Recién nacido";
    if (y === 0) return `${m} Meses`;
    if (m === 0) return `${y} Años`;
    return `${y} Años, ${m} Meses`;
}

function formatCOP(v) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v); }

// --- 4. LÓGICA DE REGISTRO INTELIGENTE ---
const form = document.getElementById('registroForm');
const selectMadre = document.getElementById('idMadre');
const selectPadre = document.getElementById('idPadre');

// Función para llenar los Selects automáticamente
async function cargarOpcionesPadres() {
    if (!selectMadre || !selectPadre) return;
    
    try {
        const snap = await getDocs(collection(db, "animales"));
        // Limpiar opciones
        selectMadre.innerHTML = '<option value="">-- Ninguna (Opcional) --</option>';
        selectPadre.innerHTML = '<option value="">-- Ninguno (Opcional) --</option>';

        snap.forEach(doc => {
            const a = doc.data();
            if (a.estado === "VENDIDO") return; // Solo listar animales activos

            const opcion = document.createElement('option');
            opcion.value = a.nombre; // Guardamos el NOMBRE como ID de referencia
            opcion.textContent = `${a.nombre} (${a.raza})`;

            if (a.sexo === 'H') selectMadre.appendChild(opcion); // Va a lista de Madres
            if (a.sexo === 'M') selectPadre.appendChild(opcion); // Va a lista de Padres
        });
    } catch (e) { console.error("Error cargando padres", e); }
}

if (form) {
    cargarOpcionesPadres(); // Ejecutar al cargar la página de registro

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
                idMadre: document.getElementById('idMadre').value || null, // Toma del Select
                idPadre: document.getElementById('idPadre').value || null, // Nuevo campo Padre
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fotoURL: url,
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado!'; msg.style.color = 'green';
            form.reset();
            cargarOpcionesPadres(); // Recargar listas
        } catch (e) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'red'; }
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
        if (listaFiltrada.length === 0) { listado.innerHTML = `<p style="text-align: center; margin-top:20px;">${verHistorial ? 'Sin ventas.' : 'Corral vacío.'}</p>`; return; }

        const mapaHijos = {};
        listaFiltrada.forEach(a => {
            if (a.idMadre) {
                if (!mapaHijos[a.idMadre]) mapaHijos[a.idMadre] = [];
                mapaHijos[a.idMadre].push(a);
            }
        });

        listado.innerHTML = '';
        const presentes = listaFiltrada.map(a => a.nombre);
        const fb = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

        listaFiltrada.forEach(animal => {
            if (!verHistorial && animal.idMadre && presentes.includes(animal.idMadre)) return; 

            const edad = calcularEdad(animal.fechaNacimiento);
            const hijos = mapaHijos[animal.nombre] || [];
            const foto = animal.fotoURL || fb;

            let hijosHTML = '';
            if (hijos.length > 0) {
                hijosHTML = `<div class="offspring-container">
                    <span class="offspring-title">🧬 Descendencia (${hijos.length})</span>
                    ${hijos.map(h => {
                        const hEdad = calcularEdad(h.fechaNacimiento);
                        const hFoto = h.fotoURL || fb;
                        return `
                        <div class="mini-cria-card">
                            <div class="mini-header" onclick="event.stopPropagation(); window.toggleChildActions('${h.id}')">
                                <img src="${hFoto}" class="mini-thumb" onerror="this.src='${fb}'">
                                <div class="mini-info">
                                    <strong>${h.nombre} (${h.sexo})</strong><br>
                                    <span style="color:#2e7d32; font-weight:bold;">${hEdad}</span> </div>
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

            const thumbHTML = animal.fotoURL ? `<img src="${animal.fotoURL}" class="cow-thumb" onerror="this.src='${fb}'">` : `<div class="no-thumb">🐮</div>`;
            const infoPadre = animal.idPadre ? `<p><strong>Padre:</strong> ${animal.idPadre}</p>` : ''; // Mostrar Padre

            listado.innerHTML += `
                <div class="animal-card">
                    <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                        ${thumbHTML}
                        <div class="info-resumen">
                            <span class="nombre-animal">${animal.nombre} (${animal.sexo})</span>
                            <span class="raza-animal">${animal.raza}</span>
                        </div>
                        <span class="${verHistorial ? 'sold-badge' : 'age-badge'}">${verHistorial ? 'VENDIDO' : edad}</span>
                    </div>

                    <div id="details-${animal.id}" class="animal-details">
                        <p><strong>Sexo:</strong> ${animal.sexo === 'H' ? 'Hembra' : 'Macho'}</p>
                        ${infoPadre} 
                        ${verHistorial ? `<p><strong>Venta:</strong> ${formatCOP(animal.precioVenta)}</p>` : `<p><strong>Compra:</strong> ${formatCOP(animal.precioCompra)}</p>`}
                        <p><strong>Nacimiento:</strong> ${animal.fechaNacimiento || '--'}</p>
                        ${animal.fotoURL ? `<img src="${animal.fotoURL}" class="foto-grande">` : ''}
                        ${hijosHTML}
                        
                        <div class="acciones">
                            ${verHistorial 
                                ? `<button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️ Borrar Historial</button>`
                                : `<button class="btn-accion btn-editar" onclick="window.editarAnimal('${animal.id}', '${animal.nombre}', '${animal.raza}')">✏️ Editar</button>
                                   <button class="btn-accion btn-vender" onclick="window.venderAnimal('${animal.id}', '${animal.nombre}')">💰 Vender</button>
                                   <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) { listado.innerHTML = `<p style="color:red">Error: ${e.message}</p>`; }
};

if (listado) window.cargarInventario(false);
