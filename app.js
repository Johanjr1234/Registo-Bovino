// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- HELPERS UI ---
window.toggleDetails = (id) => { const el = document.getElementById(`details-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.toggleChildDetails = (id) => { const el = document.getElementById(`child-det-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.openModal = (url) => { if(url && !url.includes('flaticon')){ document.getElementById("imageModal").style.display = "flex"; document.getElementById("imgFull").src = url; }};

// --- GESTIÓN DE FOTOS (NUEVO) ---
// Sube foto y retorna URL
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta API Key");
    const fd = new FormData(); fd.append("image", file); fd.append("key", IMGBB_API_KEY);
    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    const data = await res.json(); if (data.success) return data.data.url; throw new Error("Error foto");
}

let animalIdParaFoto = null; // Variable temporal
window.agregarFoto = (id) => {
    animalIdParaFoto = id;
    document.getElementById('inputFotoNueva').click();
};

window.procesarNuevaFoto = async (input) => {
    if (input.files && input.files[0] && animalIdParaFoto) {
        const file = input.files[0];
        try {
            alert("⏳ Subiendo foto, por favor espera...");
            const url = await subirFotoAImgBB(file);
            
            // Obtener animal actual para no perder fotos viejas
            const animal = animalesCache.find(a => a.id === animalIdParaFoto);
            let galeria = animal.galeria || [];
            
            // Migrar foto vieja si existe y no está en galería
            if (animal.fotoURL && galeria.length === 0) galeria.push(animal.fotoURL);
            
            // Agregar nueva
            galeria.unshift(url); // Poner la nueva al principio
            
            await updateDoc(doc(db, "animales", animalIdParaFoto), { 
                galeria: galeria,
                fotoURL: url // Actualizamos la foto principal también para compatibilidad
            });
            alert("✅ Foto agregada a la galería.");
            window.location.reload(); // Recarga para ver cambios
        } catch (e) {
            alert("Error: " + e.message);
        }
    }
};

// Genera el HTML de la galería deslizable
function getGalleryHTML(fotos, placeholder) {
    // Asegurar que sea array
    let lista = Array.isArray(fotos) ? fotos : (fotos ? [fotos] : []);
    if (lista.length === 0) lista = [placeholder];
    
    return `
    <div class="gallery-container">
        <div class="gallery-scroll">
            ${lista.map(url => `<img src="${url}" class="gallery-img" onclick="window.openModal('${url}')">`).join('')}
        </div>
        ${lista.length > 1 ? `<span class="gallery-badge">📷 ${lista.length}</span>` : ''}
    </div>`;
}

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
    if (confirm(`🔄 ¿Restaurar a ${nombre} al inventario activo?`)) {
        try { await updateDoc(doc(db, "animales", id), { estado: "ACTIVO", precioVenta: 0, fechaSalida: null }); alert("✅ Restaurado."); window.filtrarInventario('HISTORIAL'); } catch (e) { alert(e.message); }
    }
};

// PAPELERA (Soft Delete)
window.moverAPapelera = async (id, nombre) => {
    if (confirm(`⚠️ ¿Enviar a ${nombre} a la PAPELERA?\n(Podrás recuperarlo luego o borrarlo definitivamente)`)) {
        try { await updateDoc(doc(db, "animales", id), { estado: "ELIMINADO" }); alert("🗑️ Enviado a papelera."); window.filtrarInventario('TODOS'); } catch (e) { alert(e.message); }
    }
};

window.restaurarDePapelera = async (id, nombre) => {
    try { await updateDoc(doc(db, "animales", id), { estado: "ACTIVO" }); alert("♻️ Recuperado."); window.filtrarInventario('PAPELERA'); } catch (e) { alert(e.message); }
};

// BORRADO FISICO (Hard Delete)
window.eliminarDefinitivo = async (id, nombre) => {
    if (confirm(`☠️ ¿ESTÁS SEGURO?\n${nombre} se borrará PARA SIEMPRE.\nEsta acción no se puede deshacer.`)) {
        try { await deleteDoc(doc(db, "animales", id)); alert("Adiós vaquero 🤠. Borrado."); window.filtrarInventario('PAPELERA'); } catch (e) { alert(e.message); }
    }
};

window.vaciarPapelera = async () => {
    if(confirm("⚠️ ¿BORRAR TODOS LOS ANIMALES DE LA PAPELERA?\nNo habrá vuelta atrás.")) {
        const enPapelera = animalesCache.filter(a => a.estado === "ELIMINADO");
        for (const a of enPapelera) {
            await deleteDoc(doc(db, "animales", a.id));
        }
        alert("✅ Papelera vaciada.");
        window.location.reload();
    }
};

window.cambiarEstado = async (id, nuevoEstado) => {
    try { await updateDoc(doc(db, "animales", id), { estadoProductivo: nuevoEstado }); alert("✅ Estado actualizado a " + nuevoEstado); window.filtrarInventario('TODOS'); } catch (e) { alert("Error al cambiar estado"); }
};

window.editarAnimal = async (id, nombre, raza) => {
    const n = prompt("Nombre:", nombre); if(!n) return;
    const r = prompt("Raza:", raza); if(!r) return;
    try { await updateDoc(doc(db, "animales", id), { nombre: n.toUpperCase(), raza: r }); alert("✅ Editado."); window.location.reload(); } catch (e) { alert(e.message); }
};

// --- UTILIDADES ---
function calcularEdad(d) {
    if (!d) return "--"; const b = new Date(d); const n = new Date();
    let y = n.getFullYear() - b.getFullYear(); let m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) { y--; m += 12; }
    if (y===0 && m===0) return "Recién nacido"; if (y===0) return `${m} Meses`; if (m===0) return `${y} Años`;
    return `${y} Años, ${m} Meses`;
}
function formatDateShort(d) { if(!d) return ''; const date = new Date(d); return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); }
function formatCOP(v) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v); }

// --- CONTADORES ---
function actualizarContadores(lista) {
    const counts = { TODOS: 0, ORDEÑO: 0, HORRA: 0, CRIA: 0, LEVANTE: 0, TORO: 0, CEBA: 0, HISTORIAL: 0, PAPELERA: 0 };
    
    lista.forEach(a => {
        if (a.estado === 'VENDIDO') counts.HISTORIAL++;
        else if (a.estado === 'ELIMINADO') counts.PAPELERA++;
        else if (a.estado === 'ACTIVO' || a.estado === 'COMPRADO') {
            counts.TODOS++;
            if (counts.hasOwnProperty(a.estadoProductivo)) counts[a.estadoProductivo]++;
        }
    });

    document.getElementById('c-todos').innerText = counts.TODOS;
    document.getElementById('c-ordeno').innerText = counts.ORDEÑO;
    document.getElementById('c-horra').innerText = counts.HORRA;
    document.getElementById('c-cria').innerText = counts.CRIA;
    document.getElementById('c-levante').innerText = counts.LEVANTE;
    document.getElementById('c-toro').innerText = counts.TORO;
    document.getElementById('c-ceba').innerText = counts.CEBA;
    document.getElementById('c-vendidos').innerText = counts.HISTORIAL;
    document.getElementById('c-papelera').innerText = counts.PAPELERA;
}

// --- FINANZAS ---
function actualizarFinanzas(data) {
    let tG=0, tV=0, tA=0;
    data.forEach(a => {
        if(a.estado === "ELIMINADO") return; // Ignorar papelera
        const c = parseFloat(a.precioCompra)||0; const v = parseFloat(a.precioVenta)||0;
        tG += c; 
        if(a.estado==="VENDIDO") tV+=v; else tA+=c;
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
            if (a.estado !== "VENDIDO" && a.estado !== "ELIMINADO" && a.sexo === 'H') {
                const op = document.createElement('option');
                op.value = a.nombre; op.textContent = `(${a.raza})`;
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

            // Guardamos fotoURL para compatibilidad, pero también iniciamos la galería
            let galeria = url ? [url] : [];

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
                fotoURL: url, // Legacy
                galeria: galeria, // Nuevo array
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado!'; msg.style.color = 'green'; form.reset(); cargarMadres();
        } catch (e) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'red'; }
    });
}

// --- INVENTARIO ---
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
    
    // Recalcular contadores siempre
    actualizarContadores(animalesCache);

    const esHistorial = (filtro === 'HISTORIAL');
    const esPapelera = (filtro === 'PAPELERA');
    
    const listaFiltrada = animalesCache.filter(a => {
        if (esPapelera) return a.estado === "ELIMINADO";
        if (a.estado === "ELIMINADO") return false; // Ocultar eliminados de otras vistas
        
        if (esHistorial) return a.estado === "VENDIDO";
        if (a.estado === "VENDIDO") return false;

        if (filtro === 'TODOS') return true;
        return (a.estadoProductivo) === filtro;
    });

    if (listaFiltrada.length === 0) { listado.innerHTML = `<p style="text-align: center; margin-top:20px;">No hay animales en esta categoría.</p>`; return; }

    const mapaHijos = {};
    const mapaFotos = {}; 
    animalesCache.forEach(a => { 
        mapaFotos[a.nombre] = a.fotoURL || (a.galeria && a.galeria[0]); 
        if (a.idMadre && a.estado !== "ELIMINADO" && a.estado !== "VENDIDO") { // Solo hijos activos
            if (!mapaHijos[a.idMadre]) mapaHijos[a.idMadre] = []; 
            mapaHijos[a.idMadre].push(a); 
        } 
    });

    listado.innerHTML = '';
    const presentes = listaFiltrada.map(a => a.nombre);
    const fb = "https://cdn-icons-png.flaticon.com/512/1998/1998610.png";

    listaFiltrada.forEach(animal => {
        if (!esHistorial && !esPapelera && animal.idMadre && presentes.includes(animal.idMadre)) return; 
        
        const edad = calcularEdad(animal.fechaNacimiento);
        const hijos = mapaHijos[animal.nombre] || [];
        
        // Usar galería o fotoURL
        const fotosToShow = (animal.galeria && animal.galeria.length > 0) ? animal.galeria : (animal.fotoURL || fb);
        
        const estProd = animal.estadoProductivo; 

        // SELECTOR DE ESTADO
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
        if (hijos.length > 0 && !esPapelera) {
            hijosHTML = `<div class="offspring-container"><span class="offspring-title">🧬 Descendencia (${hijos.length})</span>${hijos.map(h => {
                const hFotos = (h.galeria && h.galeria.length>0) ? h.galeria : (h.fotoURL || fb);
                const hEdad = calcularEdad(h.fechaNacimiento);
                const hFecha = formatDateShort(h.fechaNacimiento);
                const mamaFoto = mapaFotos[h.idMadre] || fb;
                const papaFoto = h.fotoPadreURL || fb;
                
                return `
                <div class="cria-full-card">
                    <div class="cria-header" onclick="window.toggleChildDetails('${h.id}')">
                        <span class="cria-nombre">${h.nombre} (${h.sexo})</span>
                        <div class="cria-fecha">
                            <span class="age-badge">${hEdad}</span><br>
                            <small>${hFecha}</small>
                        </div>
                    </div>
                    <div class="cria-body">
                        ${getGalleryHTML(hFotos, fb)}
                        <div class="datos-texto" style="flex:1;">
                            ${!esHistorial ? getSelector(h.id, h.estadoProductivo) : ''}
                            <div class="padres-grid" style="margin-top:10px;">
                                <div class="padre-item" style="flex-direction:column; align-items:center; text-align:center;">
                                    <img src="${mamaFoto}" class="padre-thumb" onclick="window.openModal('${mamaFoto}')">
                                </div>
                                <div class="padre-item" style="flex-direction:column; align-items:center; text-align:center;">
                                    <img src="${papaFoto}" class="padre-thumb" onclick="window.openModal('${papaFoto}')">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="child-det-${h.id}" class="mini-actions" style="margin-top:5px;">
                        <button class="btn-accion btn-foto" onclick="window.agregarFoto('${h.id}')">📷</button>
                        <button class="btn-accion btn-editar" onclick="window.editarAnimal('${h.id}', '${h.nombre}', '${h.raza}')">✏️</button>
                        <button class="btn-accion btn-eliminar" onclick="window.moverAPapelera('${h.id}', '${h.nombre}')">🗑️</button>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // BOTONES DE ACCIÓN SEGÚN CONTEXTO
        let botonesHTML = '';
        if (esPapelera) {
             botonesHTML = `
                <div class="papelera-warning">Este animal está en la papelera.</div>
                <button class="btn-accion btn-restaurar" onclick="window.restaurarDePapelera('${animal.id}', '${animal.nombre}')">♻️ Restaurar</button>
                <button class="btn-accion btn-destruir" onclick="window.eliminarDefinitivo('${animal.id}', '${animal.nombre}')">☠️ Borrar DEFINITIVO</button>
             `;
        } else if (esHistorial) {
            botonesHTML = `
                <button class="btn-accion btn-restaurar" onclick="window.restaurarAnimal('${animal.id}', '${animal.nombre}')">🔄 Restaurar Venta</button>
                <button class="btn-accion btn-eliminar" onclick="window.moverAPapelera('${animal.id}', '${animal.nombre}')">🗑️ Borrar</button>
            `;
        } else {
            botonesHTML = `
                <button class="btn-accion btn-foto" onclick="window.agregarFoto('${animal.id}')">📷 Foto</button>
                <button class="btn-accion btn-editar" onclick="window.editarAnimal('${animal.id}', '${animal.nombre}', '${animal.raza}')">✏️ Edit</button>
                <button class="btn-accion btn-vender" onclick="window.venderAnimal('${animal.id}', '${animal.nombre}')">💰 Vender</button>
                <button class="btn-accion btn-eliminar" onclick="window.moverAPapelera('${animal.id}', '${animal.nombre}')">🗑️</button>
            `;
        }

        // --- RENDERIZADO TARJETA PRINCIPAL ---
        listado.innerHTML += `
            <div class="animal-card">
                <div class="animal-header" onclick="window.toggleDetails('${animal.id}')">
                    ${getGalleryHTML(fotosToShow, fb)}
                    <div class="info-resumen" style="margin-left:10px;">
                        <span class="nombre-animal">${animal.nombre} (${animal.sexo})</span>
                        <span class="raza-animal">${animal.raza}</span>
                        ${!esHistorial && !esPapelera && estProd ? `<span class="prod-badge">${estProd}</span>` : ''}
                    </div>
                    <span class="${esHistorial ? 'sold-badge' : 'age-badge'}">${esHistorial ? 'VENDIDO' : edad}</span>
                </div>

                <div id="details-${animal.id}" class="animal-details">
                    <div class="datos-texto">
                        ${!esHistorial && !esPapelera ? getSelector(animal.id, estProd) : ''}
                        ${animal.nombrePadre ? `<p><strong>Padre:</strong> ${animal.nombrePadre}</p>` : ''}
                        <p><strong>Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                        ${esHistorial ? `<p><strong>Venta:</strong> ${formatCOP(animal.precioVenta)}</p>` : ''}
                        <p><strong>Nac:</strong> ${animal.fechaNacimiento ? formatDateShort(animal.fechaNacimiento) : '--'}</p>
                    </div>
                    ${utilidadHTML}
                    ${hijosHTML}
                    <div class="acciones">
                        ${botonesHTML}
                    </div>
                </div>
            </div>`;
    });
};

if (listado) window.filtrarInventario('TODOS');
