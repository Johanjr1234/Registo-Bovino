// Archivo: app.js
import { db, IMGBB_API_KEY } from './firebase-config.js'; 
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- FUNCIONES DE UTILIDAD ---

// Subir a ImgBB
async function subirFotoAImgBB(file) {
    if (!IMGBB_API_KEY) throw new Error("Falta la API Key de ImgBB");
    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", IMGBB_API_KEY);
    const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (result.success) return result.data.url;
    else throw new Error("ImgBB falló: " + (result.error?.message || "Error desconocido"));
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

// --- FUNCIÓN PARA VENDER (Disponible globalmente) ---
window.venderAnimal = async (id, nombre) => {
    // 1. Preguntar precio de venta
    let precio = prompt(`¿En cuánto se vendió a ${nombre}? \n(Ingresa solo números. Si murió o no hubo pago, pon 0)`);
    
    if (precio === null) return; // Si le da Cancelar, no hace nada

    precio = parseFloat(precio);
    if (isNaN(precio)) {
        alert("Por favor ingresa un número válido.");
        return;
    }

    // 2. Confirmación final
    if (!confirm(`¿Seguro que quieres marcar a ${nombre} como VENDIDO/SALIDA por ${formatCOP(precio)}?`)) return;

    try {
        // 3. Actualizar en Firebase
        const animalRef = doc(db, "animales", id);
        await updateDoc(animalRef, {
            estado: "VENDIDO",
            precioVenta: precio
        });
        
        alert(`✅ ${nombre} ha salido del inventario activo.`);
        location.reload(); // Recargar página para actualizar lista

    } catch (error) {
        console.error("Error al vender:", error);
        alert("Hubo un error al actualizar: " + error.message);
    }
};


// --- REGISTRO ---
const registroForm = document.getElementById('registroForm');
if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Subiendo foto y guardando...';
        mensaje.style.color = 'black';

        const nombre = document.getElementById('nombre').value;
        const fechaNacimiento = document.getElementById('fechaNacimiento').value || null;
        const sexo = document.getElementById('sexo').value;
        const raza = document.getElementById('raza').value;
        const idMadre = document.getElementById('idMadre').value || null;
        const estado = document.getElementById('estado').value;
        const precioCompra = parseFloat(document.getElementById('precioCompra').value) || 0;
        const fotoFile = document.getElementById('foto').files[0];
        
        let fotoURL = '';

        try {
            if (fotoFile) {
                fotoURL = await subirFotoAImgBB(fotoFile);
            }

            const nuevoAnimal = {
                nombre: nombre.toUpperCase(),
                fechaNacimiento: fechaNacimiento,
                sexo: sexo,
                raza: raza,
                idMadre: idMadre ? idMadre.toUpperCase() : null,
                estado: estado, // ACTIVO o COMPRADO
                precioCompra: precioCompra,
                precioVenta: 0,
                fechaRegistro: serverTimestamp(),
                fotoURL: fotoURL
            };

            await addDoc(collection(db, 'animales'), nuevoAnimal);
            mensaje.textContent = `✅ ¡${nombre} registrado con éxito!`;
            mensaje.style.color = 'green';
            registroForm.reset();
            
        } catch (error) {
            mensaje.textContent = '❌ Error: ' + error.message;
            mensaje.style.color = 'red';
        }
    });
}

// --- INVENTARIO ---
const inventarioListado = document.getElementById('inventario-listado');
if (inventarioListado) {
    async function cargarInventario() {
        inventarioListado.innerHTML = '<p style="text-align: center;">Cargando ganado...</p>';
        try {
            const querySnapshot = await getDocs(collection(db, "animales"));
            const animalesData = [];
            querySnapshot.forEach((doc) => animalesData.push({ id: doc.id, ...doc.data() }));
            
            const mapaDescendencia = {};
            const animalesMadres = [];
            
            // Filtramos solo los ACTIVOS para la lista principal
            // (Si quieres ver los vendidos, habría que hacer otra lista)
            const animalesActivos = animalesData.filter(a => a.estado !== "VENDIDO");

            animalesData.forEach(animal => {
                if (animal.idMadre) {
                    const madreID = animal.idMadre;
                    if (!mapaDescendencia[madreID]) mapaDescendencia[madreID] = [];
                    mapaDescendencia[madreID].push(animal);
                }
            });
            
            // Llenamos la lista principal con los activos que no son crías directas de nadie en la lista
            // O mejor: Listamos TODOS los activos
            animalesActivos.forEach(animal => {
                // Si es cría, igual la mostramos en la lista general si está activa
                animalesMadres.push(animal);
            });

            inventarioListado.innerHTML = '';
            if (animalesMadres.length === 0) {
                 inventarioListado.innerHTML = '<p style="text-align: center;">No hay animales activos.</p>';
                 return;
            }
            
            animalesMadres.forEach(animal => {
                const edad = calcularEdad(animal.fechaNacimiento);
                const crías = mapaDescendencia[animal.nombre] || [];

                // Lógica de la miniatura
                const thumbHTML = animal.fotoURL 
                    ? `<img src="${animal.fotoURL}" class="cow-thumb" alt="foto">`
                    : `<div class="no-thumb">🐮</div>`;

                const cardHTML = `
                    <div class="animal-card">
                        <div class="animal-header" onclick="document.getElementById('details-${animal.id}').style.display = document.getElementById('details-${animal.id}').style.display === 'block' ? 'block' : 'none'">
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
            inventarioListado.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
    cargarInventario();
}
