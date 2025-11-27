// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- UI HELPERS ---
window.toggleDetails = (id) => { const el = document.getElementById(`details-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.toggleChildDetails = (id) => { const el = document.getElementById(`child-det-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };

// --- ACCIONES ---
window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿Precio venta de ${nombre}? (0 si murió)`);
    if (precio === null) return;
    if (isNaN(parseFloat(precio))) return alert("Número inválido");
    if (confirm(`¿Marcar a ${nombre} como VENDIDO/SALIDA?`)) {
        try {
            await updateDoc(doc(db, "animales", id), { estado: "VENDIDO", precioVenta: parseFloat(precio), fechaSalida: new Date().toISOString().split('T')[0] });
            alert("✅ Movido al Historial."); window.cargarInventario(false);
        } catch (e) { alert("Error: " + e.message); }
    }
};
window.eliminarAnimal = async (id, nombre) => {
    if (confirm(`⚠️ ¿ELIMINAR DEFINITIVAMENTE a ${nombre}?`)) {
        try { await deleteDoc(doc(db, "animales", id)); alert("🗑️ Eliminado."); window.cargarInventario(false); } catch (e) { alert("Error: " + e.message); }
    }
};
window.editarAnimal = async (id, nombre, raza) => {
    const n = prompt("Nombre:", nombre); if(!n) return;
    const r = prompt("Raza:", raza); if(!r) return;
    try { await updateDoc(doc(db, "animales", id), { nombre: n.toUpperCase(), raza: r }); alert("✅ Actualizado."); window.cargarInventario(false); } catch (e) { alert("Error: " + e.message); }
};

// --- UTILIDADES ---
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta API Key");
    const fd = new FormData(); fd.append("image", file); fd.append("key", IMGBB_API_KEY);
    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    const data = await res.json(); if (data.success) return data.data.url; throw new Error("Error foto");
}

function calcularEdad(dateString) {
    if (!dateString) return "--";
    const birth = new Date(dateString); const now = new Date();
    let y = now.getFullYear() - birth.getFullYear(); let m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) { y--; m += 12; }
    if (y===0 && m===0) return "Recién nacido"; if (y===0) return `${m} Meses`; if (m===0) return `${y} Años`;
    return `${y} Años, ${m} Meses`;
}
function formatCOP(v) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v); }

// --- FINANZAS ---
let myChart = null;
function actualizarFinanzas(data) {
    let tG=0, tV=0, tA=0;
    data.forEach(a => {
        const c = parseFloat(a.precioCompra)||0; const v = parseFloat(a.precioVenta)||0;
        tG += c;
        if(a.estado==="VENDIDO") tV+=v; else tA+=c;
    });
    document.getElementById('total-compras').innerText = formatCOP(tG);
    document.getElementById('total-activos').innerText = formatCOP(tA);
    document.getElementById('total-ventas').innerText = formatCOP(tV);

    const ctx = document.getElementById('balanceChart');
    if (ctx) {
        if (myChart) myChart.destroy();
        myChart = new Chart(ctx, { type: 'bar', data: { labels: ['Gastos', 'Activos', 'Ventas'], datasets: [{ label: 'COP', data: [tG, tA, tV], backgroundColor: ['#d32f2f', '#1976d2', '#2e7d32'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }
}

// --- REGISTRO (MODIFICADO: PADRE Y DOBLE FOTO) ---
const form = document.getElementById('registroForm');
const selectMadre = document.getElementById('idMadre');

async function cargarMadres() {
    if (!selectMadre) return;
    try {
        const snap = await getDocs(collection(db, "animales"));
        selectMadre.innerHTML = '<option value="">-- Ninguna --</option>';
        snap.forEach(doc => {
            const a = doc.data();
            // Solo cargamos hembras vivas como madres
            if (a.estado !== "VENDIDO" && a.sexo === 'H') {
                const op = document.createElement('option');
                op.value = a.nombre; op.textContent = `${a.nombre} (${a.raza})`;
                selectMadre.appendChild(op);
            }
        });
    } catch (e) { console.error(e); }
}

if (form) {
    cargarMadres();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mensaje');
        msg.textContent = 'Subiendo fotos y guardando... (Paciencia)';
        
        try {
            const file = document.getElementById('foto').files[0];
            const filePadre = document.getElementById('fotoPadre') ? document.getElementById('fotoPadre').files[0] : null; // Foto padre opcional
            
            // Subimos las fotos si existen (en paralelo es arriesgado en móvil, mejor secuencial)
            let url = file ? await subirFotoAImgBB(file) : '';
            let urlPadre = filePadre ? await subirFotoAImgBB(filePadre) : '';

            await addDoc(collection(db, 'animales'), {
                nombre: document.getElementById('nombre').value.toUpperCase(),
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                idMadre: document.getElementById('idMadre').value || null,
                
                // CAMBIO: Ahora guardamos nombre y foto del padre directos
                nombrePadre: document.getElementById('nombrePadre').value.toUpperCase() || null,
                fotoPadreURL: urlPadre, // Link a la foto del padre
                
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fotoURL: url,
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado!'; msg.style.color = 'green';
            form.reset(); cargarMadres();
        } catch (e) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'red'; }
    });
}

// --- INVENTARIO (MODIFICADO: SUPER-CRÍA) ---
const listado = document.getElementById('inventario-listado');
window.cargarInventario = async (verHistorial = false) => {
    if (!listado) return;
    listado.innerHTML = '<p style="text-align: center;">Cargando...</p>';
    
    try {
        const snap = await getDocs(collection(db, "animales"));
        const data = []; snap.forEach(d => data.push({ id: d.id, ...d.data() }));

        actualizarFinanzas(data);

        const listaFiltrada = data.filter(a => verHistorial ? (a.estado === "VENDIDO") : (a.estado !== "VENDIDO"));
        if (listaFiltrada.length === 0) { listado.innerHTML = `<p style="text-align: center; margin-top:20px;">${verHistorial ? 'Sin ventas.' : 'Corral vacío.'}</p>`; return; }

        const mapaHijos = {};
        listaFiltrada.forEach(a => { if (a.idMadre) { if (!mapaHijos[a.idMadre]) mapaHijos[a.idMadre] = []; mapaHijos[a.idMadre].push(a); } });

        listado.innerHTML = '';
        const presentes = listaFiltrada.map(a => a.nombre);
        const fb = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

        listaFiltrada.forEach(animal => {
            if (!verHistorial && animal.idMadre && presentes.includes(animal.idMadre)) return; 
            
            const edad = calcularEdad(animal.fechaNacimiento);
            const hijos = mapaHijos[animal.nombre] || [];
            const foto = animal.fotoURL || fb;

            // --- RENDERIZADO DE UTILIDAD ---
            let utilidadHTML = '';
            if (verHistorial) {
                const u = (parseFloat(animal.precioVenta)||0) - (parseFloat(animal.precioCompra)||0);
                const color = (parseFloat(animal.precioVenta)===0 || u<0) ? 'profit-negative' : 'profit-positive';
                const txt = (parseFloat(animal.precioVenta)===0) ? 'PERDIDA/MUERTE' : (u>=0?'GANANCIA':'PÉRDIDA');
                utilidadHTML = `<div class="${color} profit-badge">${txt}: ${formatCOP(u)}</div>`;
            }

            // --- SUPER-CRÍA (Propuesta 3) ---
            let hijosHTML = '';
            if (hijos.length > 0) {
                hijosHTML = `<div class="offspring-container">
                    <span class="offspring-title">🧬 Descendencia (${hijos.length})</span>
                    ${hijos.map(h => {
                        const hEdad = calcularEdad(h.fechaNacimiento);
                        const hFoto = h.fotoURL || fb;
                        const hFecha = h.fechaNacimiento || '--';
                        // Fotos de padres (Madre = animal actual, Padre = h.fotoPadreURL)
                        const mamaFoto = animal.fotoURL || fb;
                        const papaFoto = h.fotoPadreURL || fb;
                        const papaNombre = h.nombrePadre || 'No registrado';
                        
                        // Tarjeta GRANDE de la cría
                        return `
                        <div class="cria-full-card">
                            <div class="cria-header" onclick="window.toggleChildDetails('${h.id}')">
                                <span class="cria-nombre">${h.nombre} (${h.sexo})</span>
                                <span class="age-badge">${hEdad}</span>
                            </div>
                            <img src="${hFoto}" class="foto-optimizada" onerror="this.src='${fb}'">
                            
                            <p style="font-size:0.9em; margin:5px 0;"><strong>Nacimiento:</strong> ${hFecha}</p>
                            
                            <div class="padres-grid">
                                <div class="padre-item">
                                    <img src="${mamaFoto}" class="padre-thumb">
                                    <span>Madre: ${animal.nombre}</span>
                                </div>
                                <div class="padre-item">
                                    <img src="${papaFoto}" class="padre-thumb">
                                    <span>Padre: ${papaNombre}</span>
                                </div>
                            </div>
                            
                            <div class="acciones">
                                <button class="btn-accion btn-editar" onclick="window.editarAnimal('${h.id}', '${h.nombre}', '${h.raza}')">✏️</button>
                                <button class="btn-accion btn-vender" onclick="window.venderAnimal('${h.id}', '${h.nombre}')">💰</button>
                                <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${h.id}', '${h.nombre}')">🗑️</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
            }

            listado.innerHTML += `
                <div class="animal-card">
                    <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                        <img src="${foto}" class="cow-thumb" onerror="this.src='${fb}'">
                        <div class="info-resumen">
                            <span class="nombre-animal">${animal.nombre} (${animal.sexo})</span>
                            <span class="raza-animal">${animal.raza}</span>
                        </div>
                        <span class="${verHistorial ? 'sold-badge' : 'age-badge'}">${verHistorial ? 'VENDIDO' : edad}</span>
                    </div>

                    <div id="details-${animal.id}" class="animal-details">
                        <p><strong>Sexo:</strong> ${animal.sexo === 'H' ? 'Hembra' : 'Macho'}</p>
                        ${animal.nombrePadre ? `<p><strong>Padre:</strong> ${animal.nombrePadre}</p>` : ''}
                        
                        <p><strong>Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                        ${verHistorial ? `<p><strong>Venta:</strong> ${formatCOP(animal.precioVenta)}</p>` : ''}
                        ${utilidadHTML}
                        
                        <p><strong>Nacimiento:</strong> ${animal.fechaNacimiento || '--'}</p>
                        
                        ${animal.fotoURL ? `<img src="${animal.fotoURL}" class="foto-optimizada">` : ''}

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
                </div>`;
        });
    } catch (e) { listado.innerHTML = `<p style="color:red">Error: ${e.message}</p>`; }
};

if (listado) window.cargarInventario(false);
