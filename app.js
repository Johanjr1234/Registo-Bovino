// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- HELPERS UI ---
window.toggleDetails = (id) => { const el = document.getElementById(`details-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.toggleChildDetails = (id) => { const el = document.getElementById(`child-det-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.openModal = (url) => { if(url && !url.includes('flaticon')){ document.getElementById("imageModal").style.display = "flex"; document.getElementById("imgFull").src = url; }};

// --- ACCIONES PRINCIPALES ---
window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿Precio venta de ${nombre}? (0 si murió)`);
    if (precio === null) return;
    if (isNaN(parseFloat(precio))) return alert("Inválido");
    if (confirm(`¿Mover ${nombre} a VENDIDOS?`)) {
        try { await updateDoc(doc(db, "animales", id), { estado: "VENDIDO", precioVenta: parseFloat(precio), fechaSalida: new Date().toISOString().split('T')[0] }); alert("✅ Vendido."); window.filtrarInventario('TODOS'); } catch (e) { alert(e.message); }
    }
};

window.restaurarAnimal = async (id, nombre) => {
    if (confirm(`🔄 ¿Restaurar a ${nombre} al inventario activo?\n(Se borrará el precio de venta)`)) {
        try { await updateDoc(doc(db, "animales", id), { estado: "ACTIVO", precioVenta: 0, fechaSalida: null }); alert("✅ Restaurado."); window.filtrarInventario('HISTORIAL'); } catch (e) { alert(e.message); }
    }
};

window.eliminarAnimal = async (id, nombre) => {
    if (confirm(`⚠️ ¿ELIMINAR DEFINITIVAMENTE a ${nombre}?`)) {
        try { await deleteDoc(doc(db, "animales", id)); alert("🗑️ Eliminado."); window.location.reload(); } catch (e) { alert(e.message); }
    }
};

// CAMBIAR ESTADO PRODUCTIVO
window.cambiarEstado = async (id, nuevoEstado) => {
    try { await updateDoc(doc(db, "animales", id), { estadoProductivo: nuevoEstado }); alert("✅ Estado actualizado a " + nuevoEstado); window.filtrarInventario('TODOS'); } catch (e) { alert("Error al cambiar estado"); }
};

window.editarAnimal = async (id, nombre, raza) => {
    const n = prompt("Nombre:", nombre); if(!n) return;
    const r = prompt("Raza:", raza); if(!r) return;
    try { await updateDoc(doc(db, "animales", id), { nombre: n.toUpperCase(), raza: r }); alert("✅ Editado."); window.location.reload(); } catch (e) { alert(e.message); }
};

// --- UTILIDADES ---
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta API Key");
    const fd = new FormData(); fd.append("image", file); fd.append("key", IMGBB_API_KEY);
    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    const data = await res.json(); if (data.success) return data.data.url; throw new Error("Error foto");
}
function calcularEdad(d) {
    if (!d) return "--"; const b = new Date(d); const n = new Date();
    let y = n.getFullYear() - b.getFullYear(); let m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) { y--; m += 12; }
    if (y===0 && m===0) return "Recién nacido"; if (y===0) return `${m} Meses`; if (m===0) return `${y} Años`;
    return `${y} Años, ${m} Meses`;
}
function formatCOP(v) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v); }

// --- FINANZAS ---
function actualizarFinanzas(data) {
    let tG=0, tV=0, tA=0;
    data.forEach(a => {
        const c = parseFloat(a.precioCompra)||0; const v = parseFloat(a.precioVenta)||0;
        tG += c; if(a.estado==="VENDIDO") tV+=v; else tA+=c;
    });
    document.getElementById('total-compras').innerText = formatCOP(tG);
    document.getElementById('total-activos').innerText = formatCOP(tA);
    document.getElementById('total-ventas').innerText = formatCOP(tV);
    const ctx = document.getElementById('balanceChart');
    if (ctx) {
        if (window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, { type: 'bar', data: { labels: ['Gastos', 'Activos', 'Ventas'], datasets: [{ label: 'COP', data: [tG, tA, tV], backgroundColor: ['#d32f2f', '#1976d2', '#2e7d32'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }
}

// --- REGISTRO ---
const form = document.getElementById('registroForm');
const listaMadres = document.getElementById('listaMadres');

async function cargarMadres() {
    if (!listaMadres) return;
    try {
        const snap = await getDocs(collection(db, "animales"));
        listaMadres.innerHTML = '';
        snap.forEach(doc => {
            const a = doc.data();
            if (a.estado !== "VENDIDO" && a.sexo === 'H') {
                const op = document.createElement('option');
                op.value = a.nombre; 
                op.textContent = `(${a.raza})`;
                listaMadres.appendChild(op);
            }
        });
    } catch (e) { console.error(e); }
}

if (form) {
    cargarMadres();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mensaje'); msg.textContent = 'Guardando...';
        try {
            const file = document.getElementById('foto').files[0];
            const filePadre = document.getElementById('fotoPadre') ? document.getElementById('fotoPadre').files[0] : null; 
            let url = file ? await subirFotoAImgBB(file) : '';
            let urlPadre = filePadre ? await subirFotoAImgBB(filePadre) : '';
            const madreVal = document.getElementById('inputMadre').value.toUpperCase();

            await addDoc(collection(db, 'animales'), {
                nombre: document.getElementById('nombre').value.toUpperCase(),
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                estadoProductivo: document.getElementById('estadoProductivo').value,
                idMadre: madreVal || null,
                nombrePadre: document.getElementById('nombrePadre').value.toUpperCase() || null,
                fotoPadreURL: urlPadre,
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fotoURL: url,
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado!'; msg.style.color = 'green'; form.reset(); cargarMadres();
        } catch (e) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'red'; }
    });
}

// --- INVENTARIO (CORREGIDO VISUALMENTE) ---
const listado = document.getElementById('inventario-listado');
let animalesCache = [];

window.filtrarInventario = async (filtro = 'TODOS') => {
    if (!listado) return;
    if (animalesCache.length === 0) {
        listado.innerHTML = '<p style="text-align: center;">Cargando...</p>';
        const snap = await getDocs(collection(db, "animales"));
        snap.forEach(d => animalesCache.push({ id: d.id, ...d.data() }));
        actualizarFinanzas(animalesCache);
    }

    const esHistorial = (filtro === 'HISTORIAL');
    const listaFiltrada = animalesCache.filter(a => {
        if (esHistorial) return a.estado === "VENDIDO";
        if (a.estado === "VENDIDO") return false;
        if (filtro === 'TODOS') return true;
        // Si no tiene estado, no pasa el filtro específico
        return (a.estadoProductivo) === filtro;
    });

    if (listaFiltrada.length === 0) { listado.innerHTML = `<p style="text-align: center; margin-top:20px;">No hay animales en esta categoría.</p>`; return; }

    const mapaHijos = {};
    const mapaFotos = {}; 
    animalesCache.forEach(a => { 
        mapaFotos[a.nombre] = a.fotoURL; 
        if (a.idMadre) { 
            if (!mapaHijos[a.idMadre]) mapaHijos[a.idMadre] = []; 
            mapaHijos[a.idMadre].push(a); 
        } 
    });

    listado.innerHTML = '';
    const presentes = listaFiltrada.map(a => a.nombre);
    const fb = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

    listaFiltrada.forEach(animal => {
        if (!esHistorial && animal.idMadre && presentes.includes(animal.idMadre)) return; 
        
        const edad = calcularEdad(animal.fechaNacimiento);
        const hijos = mapaHijos[animal.nombre] || [];
        const foto = animal.fotoURL || fb;
        // Si no tiene estado, lo dejamos vacío en lugar de "SIN_ASIGNAR"
        const estProd = animal.estadoProductivo; 

        // SELECTOR DE ESTADO (Incluye TORO y CEBA)
        const getSelector = (id, estadoActual) => `
            <select class="estado-selector" onchange="window.cambiarEstado('${id}', this.value)" onclick="event.stopPropagation()">
                <option value="" disabled ${!estadoActual?'selected':''}>Seleccionar Estado...</option>
                <option value="CRIA" ${estadoActual==='CRIA'?'selected':''}>🌱 Cría</option>
                <option value="LEVANTE" ${estadoActual==='LEVANTE'?'selected':''}>🌾 Levante</option>
                <option value="TORO" ${estadoActual==='TORO'?'selected':''}>🐂 Toro</option>
                <option value="CEBA" ${estadoActual==='CEBA'?'selected':''}>🥩 Ceba</option>
                <option value="ORDEÑO" ${estadoActual==='ORDEÑO'?'selected':''}>🥛 En Ordeño</option>
                <option value="HORRA" ${estadoActual==='HORRA'?'selected':''}>🏖️ Horra</option>
            </select>`;

        let utilidadHTML = '';
        if (esHistorial) {
            const u = (parseFloat(animal.precioVenta)||0) - (parseFloat(animal.precioCompra)||0);
            const color = (parseFloat(animal.precioVenta)===0 || u<0) ? 'profit-negative' : 'profit-positive';
            const txt = (parseFloat(animal.precioVenta)===0) ? 'PERDIDA/MUERTE' : (u>=0?'GANANCIA':'PÉRDIDA');
            utilidadHTML = `<div class="${color} profit-badge">${txt}: ${formatCOP(u)}</div>`;
        }

        let hijosHTML = '';
        if (hijos.length > 0) {
            hijosHTML = `<div class="offspring-container"><span class="offspring-title">🧬 Descendencia (${hijos.length})</span>${hijos.map(h => {
                const hFoto = h.fotoURL || fb; 
                const hEdad = calcularEdad(h.fechaNacimiento);
                const hEstProd = h.estadoProductivo;
                const mamaFoto = mapaFotos[h.idMadre] || fb;
                const papaFoto = h.fotoPadreURL || fb;
                const papaNombre = h.nombrePadre || 'N/A';
                
                return `
                <div class="cria-full-card">
                    <div class="cria-header" onclick="window.toggleChildDetails('${h.id}')">
                        <span class="cria-nombre">${h.nombre} (${h.sexo})</span>
                        <span class="age-badge">${hEdad}</span>
                    </div>
                    <div class="cria-body">
                        <img src="${hFoto}" class="foto-preview" onclick="window.openModal('${hFoto}')">
                        <div class="datos-texto" style="flex:1;">
                            ${!esHistorial ? getSelector(h.id, hEstProd) : ''}
                            <div class="padres-grid" style="margin-top:10px;">
                                <div class="padre-item" style="flex-direction:column; align-items:center; text-align:center;">
                                    <img src="${mamaFoto}" class="padre-thumb" onclick="window.openModal('${mamaFoto}')" style="width:40px;height:40px;">
                                    <span style="font-size:0.7em;">M: ${h.idMadre}</span>
                                </div>
                                <div class="padre-item" style="flex-direction:column; align-items:center; text-align:center;">
                                    <img src="${papaFoto}" class="padre-thumb" onclick="window.openModal('${papaFoto}')" style="width:40px;height:40px;">
                                    <span style="font-size:0.7em;">P: ${papaNombre}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="child-det-${h.id}" class="mini-actions">
                        <button class="btn-accion btn-editar" onclick="window.editarAnimal('${h.id}', '${h.nombre}', '${h.raza}')">✏️</button>
                        <button class="btn-accion btn-vender" onclick="window.venderAnimal('${h.id}', '${h.nombre}')">💰</button>
                        <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${h.id}', '${h.nombre}')">🗑️</button>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // --- RENDERIZADO TARJETA PRINCIPAL ---
        listado.innerHTML += `
            <div class="animal-card">
                <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                    <img src="${foto}" class="cow-thumb" onerror="this.src='${fb}'">
                    <div class="info-resumen">
                        <span class="nombre-animal">${animal.nombre} (${animal.sexo})</span>
                        <span class="raza-animal">${animal.raza}</span>
                        ${!esHistorial && estProd ? `<span class="prod-badge">${estProd}</span>` : ''}
                    </div>
                    <span class="${esHistorial ? 'sold-badge' : 'age-badge'}">${esHistorial ? 'VENDIDO' : edad}</span>
                </div>

                <div id="details-${animal.id}" class="animal-details">
                    <div class="info-con-foto">
                        ${animal.fotoURL ? `<img src="${animal.fotoURL}" class="foto-preview" onclick="window.openModal('${animal.fotoURL}')">` : ''}
                        <div class="datos-texto">
                            ${!esHistorial ? getSelector(animal.id, estProd) : ''}
                            ${animal.nombrePadre ? `<p><strong>Padre:</strong> ${animal.nombrePadre}</p>` : ''}
                            <p><strong>Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                            ${esHistorial ? `<p><strong>Venta:</strong> ${formatCOP(animal.precioVenta)}</p>` : ''}
                            <p><strong>Nac:</strong> ${animal.fechaNacimiento || '--'}</p>
                        </div>
                    </div>
                    ${utilidadHTML}
                    ${hijosHTML}
                    <div class="acciones">
                        ${esHistorial 
                            ? `<button class="btn-accion btn-restaurar" onclick="window.restaurarAnimal('${animal.id}', '${animal.nombre}')">🔄 Restaurar</button>
                               <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️ Borrar</button>`
                            : `<button class="btn-accion btn-editar" onclick="window.editarAnimal('${animal.id}', '${animal.nombre}', '${animal.raza}')">✏️ Editar</button>
                               <button class="btn-accion btn-vender" onclick="window.venderAnimal('${animal.id}', '${animal.nombre}')">💰 Vender</button>
                               <button class="btn-accion btn-eliminar" onclick="window.eliminarAnimal('${animal.id}', '${animal.nombre}')">🗑️</button>`
                        }
                    </div>
                </div>
            </div>`;
    });
};

if (listado) window.filtrarInventario('TODOS');
