// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- GESTIÓN DE INTERFAZ ---
window.toggleDetails = (id) => { const el = document.getElementById(`details-${id}`); if(el) el.style.display = (el.style.display==='block')?'none':'block'; };
window.toggleChildActions = (id) => { const el = document.getElementById(`child-actions-${id}`); if(el) el.style.display = (el.style.display==='flex')?'none':'flex'; };

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

// --- FINANZAS AVANZADAS (3 BARRAS) ---
let myChart = null;
function actualizarFinanzas(data) {
    let totalGastado = 0; // Todo lo que ha salido
    let totalVentas = 0;  // Todo lo que ha entrado
    let totalActivos = 0; // Valor del ganado actual

    data.forEach(a => {
        const compra = parseFloat(a.precioCompra) || 0;
        const venta = parseFloat(a.precioVenta) || 0;
        
        // El gasto es histórico, siempre suma
        totalGastado += compra;

        if (a.estado === "VENDIDO") {
            totalVentas += venta;
        } else {
            // Si está activo, suma al valor del inventario vivo
            totalActivos += compra;
        }
    });

    document.getElementById('total-compras').innerText = formatCOP(totalGastado);
    document.getElementById('total-activos').innerText = formatCOP(totalActivos);
    document.getElementById('total-ventas').innerText = formatCOP(totalVentas);

    const ctx = document.getElementById('balanceChart');
    if (ctx) {
        if (myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Gastos Históricos', 'Valor en Finca', 'Ventas Totales'],
                datasets: [{
                    label: 'COP',
                    data: [totalGastado, totalActivos, totalVentas],
                    backgroundColor: ['#d32f2f', '#1976d2', '#2e7d32'],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// --- REGISTRO ---
const form = document.getElementById('registroForm');
const selectMadre = document.getElementById('idMadre');
const selectPadre = document.getElementById('idPadre');

async function cargarOpcionesPadres() {
    if (!selectMadre) return;
    try {
        const snap = await getDocs(collection(db, "animales"));
        selectMadre.innerHTML = '<option value="">-- Ninguna --</option>';
        selectPadre.innerHTML = '<option value="">-- Ninguno --</option>';
        snap.forEach(doc => {
            const a = doc.data();
            if (a.estado === "VENDIDO") return;
            const op = document.createElement('option'); op.value = a.nombre; op.textContent = `${a.nombre} (${a.raza})`;
            if (a.sexo === 'H') selectMadre.appendChild(op);
            if (a.sexo === 'M') selectPadre.appendChild(op);
        });
    } catch (e) { console.error(e); }
}

if (form) {
    cargarOpcionesPadres();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mensaje'); msg.textContent = 'Guardando...';
        try {
            const file = document.getElementById('foto').files[0];
            let url = file ? await subirFotoAImgBB(file) : '';
            await addDoc(collection(db, 'animales'), {
                nombre: document.getElementById('nombre').value.toUpperCase(),
                fechaNacimiento: document.getElementById('fechaNacimiento').value || null,
                sexo: document.getElementById('sexo').value,
                raza: document.getElementById('raza').value,
                idMadre: document.getElementById('idMadre').value || null,
                idPadre: document.getElementById('idPadre').value || null,
                estado: document.getElementById('estado').value,
                precioCompra: parseFloat(document.getElementById('precioCompra').value) || 0,
                precioVenta: 0,
                fotoURL: url,
                timestamp: serverTimestamp()
            });
            msg.textContent = '✅ Guardado!'; msg.style.color = 'green'; form.reset(); cargarOpcionesPadres();
        } catch (e) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'red'; }
    });
}

// --- INVENTARIO ---
const listado = document.getElementById('inventario-listado');
window.cargarInventario = async (verHistorial = false) => {
    if (!listado) return;
    listado.innerHTML = '<p style="text-align: center;">Cargando...</p>';
    try {
        const snap = await getDocs(collection(db, "animales"));
        const data = []; snap.forEach(d => data.push({ id: d.id, ...d.data() }));

        actualizarFinanzas(data); // Actualizar gráfico

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

            // Lógica de Utilidad INDIVIDUAL
            let utilidadHTML = '';
            if (verHistorial) {
                const compra = parseFloat(animal.precioCompra) || 0;
                const venta = parseFloat(animal.precioVenta) || 0;
                const utilidad = venta - compra;
                const esGanancia = utilidad >= 0;
                // Si la venta es 0, asumimos muerte/pérdida total
                const textoUtilidad = (venta === 0) ? "PERDIDA (MUERTE)" : (esGanancia ? "GANANCIA" : "PÉRDIDA");
                const claseUtilidad = (venta === 0 || !esGanancia) ? "profit-negative" : "profit-positive";
                const icono = (venta === 0 || !esGanancia) ? "📉" : "📈";
                
                utilidadHTML = `
                <div class="${claseUtilidad} profit-badge">
                    ${icono} ${textoUtilidad}: ${formatCOP(utilidad)}
                </div>`;
            }

            // Hijos HTML
            let hijosHTML = '';
            if (hijos.length > 0) {
                hijosHTML = `<div class="offspring-container"><span class="offspring-title">🧬 Descendencia (${hijos.length})</span>${hijos.map(h => {
                    return `<div class="mini-cria-card"><div class="mini-header" onclick="event.stopPropagation(); window.toggleChildActions('${h.id}')"><img src="${h.fotoURL||fb}" class="mini-thumb" onerror="this.src='${fb}'"><div class="mini-info"><strong>${h.nombre} (${h.sexo})</strong><br><span style="color:#2e7d32;">${calcularEdad(h.fechaNacimiento)}</span></div></div><div id="child-actions-${h.id}" class="mini-actions"><button class="btn-mini btn-editar" onclick="window.editarAnimal('${h.id}', '${h.nombre}', '${h.raza}')">✏️</button><button class="btn-mini btn-vender" onclick="window.venderAnimal('${h.id}', '${h.nombre}')">💰</button><button class="btn-mini btn-eliminar" onclick="window.eliminarAnimal('${h.id}', '${h.nombre}')">🗑️</button></div></div>`;
                }).join('')}</div>`;
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
                        ${animal.idPadre ? `<p><strong>Padre:</strong> ${animal.idPadre}</p>` : ''}
                        
                        <p><strong>Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                        ${verHistorial ? `<p><strong>Venta:</strong> ${formatCOP(animal.precioVenta)}</p>` : ''}
                        ${utilidadHTML}
                        
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
                </div>`;
        });
    } catch (e) { listado.innerHTML = `<p style="color:red">Error: ${e.message}</p>`; }
};
if (listado) window.cargarInventario(false);         
