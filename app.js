// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- HELPERS UI ---
window.toggleDetails = (id) => { const el = document.getElementById(`details-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.toggleChildDetails = (id) => { const el = document.getElementById(`child-det-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.openModal = (url) => { 
    if(url && !url.includes('flaticon')){ 
        document.getElementById("imageModal").style.display = "flex"; 
        document.getElementById("imgFull").src = url; 
    } else {
        alert("🖼️ Imagen no disponible o cargada sin conexión."); // Mensaje si la foto no es real o está offline
    }
};

// --- ACCIONES PRINCIPALES ---
window.venderAnimal = async (id, nombre) => {
    let precio = prompt(`¿Precio venta de ${nombre}? (0 si murió)`);
    if (precio === null) return;
    if (isNaN(parseFloat(precio))) return alert("Inválido");
    if (confirm(`¿Mover ${nombre} a VENDIDOS?`)) {
        try { 
            await updateDoc(doc(db, "animales", id), { estado: "VENDIDO", precioVenta: parseFloat(precio), fechaSalida: new Date().toISOString().split('T')[0] }); 
            alert("✅ Vendido. (Sincronizando si hay conexión)"); 
            window.filtrarInventario('TODOS'); 
        } catch (e) { alert("❌ Error al vender: " + e.message); }
    }
};

window.restaurarAnimal = async (id, nombre) => {
    if (confirm(`🔄 ¿Restaurar a ${nombre} al inventario activo?\n(Se borrará el precio de venta)`)) {
        try { 
            await updateDoc(doc(db, "animales", id), { estado: "ACTIVO", precioVenta: 0, fechaSalida: null }); 
            alert("✅ Restaurado. (Sincronizando si hay conexión)"); 
            window.filtrarInventario('HISTORIAL'); 
        } catch (e) { alert("❌ Error al restaurar: " + e.message); }
    }
};

window.eliminarAnimal = async (id, nombre) => {
    if (confirm(`⚠️ ¿ELIMINAR DEFINITIVAMENTE a ${nombre}?`)) {
        try { 
            await deleteDoc(doc(db, "animales", id)); 
            alert("🗑️ Eliminado. (Sincronizando si hay conexión)"); 
            window.location.reload(); 
        } catch (e) { alert("❌ Error al eliminar: " + e.message); }
    }
};

window.cambiarEstado = async (id, nuevoEstado) => {
    try { 
        await updateDoc(doc(db, "animales", id), { estadoProductivo: nuevoEstado }); 
        alert("✅ Estado actualizado a " + nuevoEstado + " (Sincronizando si hay conexión)"); 
        window.filtrarInventario('TODOS'); 
    } catch (e) { alert("❌ Error al cambiar estado: " + e.message); }
};

window.editarAnimal = async (id, nombre, raza) => {
    const n = prompt("Nombre:", nombre); if(!n) return;
    const r = prompt("Raza:", raza); if(!r) return;
    try { 
        await updateDoc(doc(db, "animales", id), { nombre: n.toUpperCase(), raza: r }); 
        alert("✅ Editado. (Sincronizando si hay conexión)"); 
        window.location.reload(); 
    } catch (e) { alert("❌ Error al editar: " + e.message); }
};

// --- UTILIDADES ---
async function subirFotoAImgBB(file) {
    if (!navigator.onLine) {
        throw new Error("❌ No hay conexión a internet para subir fotos.");
    }
    if (!IMGBB_API_KEY) throw new Error("Falta API Key de ImgBB.");
    const fd = new FormData(); fd.append("image", file); fd.append("key", IMGBB_API_KEY);
    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    const data = await res.json(); 
    if (data.success) return data.data.url; 
    throw new Error("Error al subir foto a ImgBB: " + (data.error ? data.error.message : 'Desconocido'));
}

function calcularEdad(d) {
    if (!d) return "--"; const b = new Date(d); const n = new Date();
    let y = n.getFullYear() - b.getFullYear(); let m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) { y--; m += 12; }
    if (y===0 && m===0) return "Recién nacido"; if (y===0) return `${m} Meses`; if (m===0) return `${y} Años`;
    return `${y} Años, ${m} Meses`;
}
function formatCOP(v) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v); }

// --- INDICADOR DE CONEXIÓN ---
const statusDiv = document.createElement('div');
statusDiv.style.cssText = 'position:fixed; bottom:10px; right:10px; padding:8px 12px; border-radius:5px; background:rgba(0,0,0,0.7); color:white; font-size:0.8em; z-index:1000;';
document.body.appendChild(statusDiv);

function updateOnlineStatus() {
    if (navigator.onLine) {
        statusDiv.textContent = '🟢 Online';
        statusDiv.style.backgroundColor = 'rgba(46, 125, 50, 0.7)'; // Verde
    } else {
        statusDiv.textContent = '🔴 Offline';
        statusDiv.style.backgroundColor = 'rgba(211, 47, 47, 0.7)'; // Rojo
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus(); // Cargar estado inicial

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
        const snap = await getDocs(collection(db, "animales")); // Usa getDocs directamente
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
    } catch (e) { console.error("Error cargando madres:", e); }
}

if (form) {
    cargarMadres();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mensaje'); msg.textContent = 'Guardando...';
        try {
            const file = document.getElementById('foto').files[0];
            const filePadre = document.getElementById('fotoPadre') ? document.getElementById('fotoPadre').files[0] : null; 
            let url = '';
            let urlPadre = '';

            // Intentar subir fotos solo si hay conexión
            if (navigator.onLine) {
                if (file) url = await subirFotoAImgBB(file);
                if (filePadre) urlPadre = await subirFotoAImgBB(filePadre);
            } else {
                msg.textContent = '⚠️ Sin conexión: Las fotos se subirán cuando haya internet.';
                msg.style.color = 'orange';
            }

            const madreVal = document.getElementById('inputMadre').value.toUpperCase();

            await addDoc(collection(db, 'animales'), {
                nombre: document.getElementById('nombre').value.toUpperCase(),
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                estadoProductivo: document.getElementById('estadoProductivo').value,
                idMadre: madreVal || null,
                nombrePadre: document.getElementById('nombrePadre').value.toUpperCase() || null,
                fotoPadreURL: url, // Guarda la URL si se subió, sino queda vacía
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fotoURL: url, // Guarda la URL si se subió, sino queda vacía
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado! (Sincronizando si hay conexión)'; msg.style.color = 'green'; form.reset(); cargarMadres();
        } catch (e) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'red'; }
    });
}

// --- INVENTARIO (LISTADO OFFLINE) ---
const listado = document.getElementById('inventario-listado');
let animalesCache = []; // Esta caché se llenará con los datos de Firebase (offline o no)

window.filtrarInventario = async (filtro = 'TODOS') => {
    if (!listado) return;
    
    listado.innerHTML = '<p style="text-align: center;">Cargando inventario...</p>';

    try {
        // Carga los datos de Firebase. Con persistencia habilitada, intentará desde el caché.
        const snap = await getDocs(collection(db, "animales"));
        animalesCache = []; // Limpiar caché antes de rellenar
        snap.forEach(d => animalesCache.push({ id: d.id, ...d.data() }));
        actualizarFinanzas(animalesCache);
    } catch (e) {
        console.error("Error al cargar datos (posiblemente offline):", e);
        // Si hay un error al cargar (ej. no hay datos en caché ni conexión), se queda el mensaje de cargando
        listado.innerHTML = '<p style="text-align: center; color: red;">❌ Error al cargar. ¿Estás sin conexión o es la primera vez?</p>';
        return; 
    }

    const esHistorial = (filtro === 'HISTORIAL');
    const listaFiltrada = animalesCache.filter(a => {
        if (esHistorial) return a.estado === "VENDIDO";
        if (a.estado === "VENDIDO") return false;
        if (filtro === 'TODOS') return true;
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
    const fb = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png"; // Fallback para fotos

    listaFiltrada.forEach(animal => {
        if (!esHistorial && animal.idMadre && presentes.includes(animal.idMadre)) return; 
        
        const edad = calcularEdad(animal.fechaNacimiento);
        const hijos = mapaHijos[animal.nombre] || [];
        // Muestra la foto o el fallback si no está disponible o sin conexión
        const foto = (animal.fotoURL && navigator.onLine) ? animal.fotoURL : fb; 
        const estProd = animal.estadoProductivo; 

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
                // Fotos de hijos y padres solo si hay conexión
                const hFoto = (h.fotoURL && navigator.onLine) ? h.fotoURL : fb; 
                const hEdad = calcularEdad(h.fechaNacimiento);
                const hEstProd = h.estadoProductivo;
                const mamaFoto = (mapaFotos[h.idMadre] && navigator.onLine) ? mapaFotos[h.idMadre] : fb;
                const papaFoto = (h.fotoPadreURL && navigator.onLine) ? h.fotoPadreURL : fb;
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
                        ${animal.fotoURL ? `<img src="${foto}" class="foto-preview" onclick="window.openModal('${foto}')">` : ''}
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
```http://googleusercontent.com/generated_image_content/0
