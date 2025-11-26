// Archivo: app.js
import { db } from './firebase-config.js'; // Ya NO importamos storage
import { collection, addDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- FUNCIONES DE UTILIDAD ---

// 1. Truco Nuevo: Convertir imagen a Texto (Base64) con compresión
const convertirImagenATexto = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            // Creamos una imagen virtual para reducirle el tamaño
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Redimensionamos para que no sea gigante (Max 800px)
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convertimos a texto comprimido (JPEG calidad 0.7)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
        };
        reader.onerror = error => reject(error);
    });
};

function calcularEdad(dateString) {
    if (!dateString) return "Edad Desconocida";
    const birthDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    return years === 0 ? `${months} meses` : `${years} años y ${months} meses`;
}

function formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

// --- LÓGICA DE REGISTRO ---
const registroForm = document.getElementById('registroForm');

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Procesando imagen y guardando...';
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
            // AQUI ESTA EL CAMBIO: Convertimos la foto a texto en lugar de subirla a Storage
            if (fotoFile) {
                if (fotoFile.size > 2 * 1024 * 1024) {
                    throw new Error("La imagen es muy grande. Intenta tomar una foto con menor calidad.");
                }
                fotoURL = await convertirImagenATexto(fotoFile);
            }

            const nuevoAnimal = {
                nombre: nombre.toUpperCase(),
                fechaNacimiento: fechaNacimiento,
                sexo: sexo,
                raza: raza,
                idMadre: idMadre ? idMadre.toUpperCase() : null,
                estado: estado,
                precioCompra: precioCompra,
                precioVenta: 0,
                fechaRegistro: serverTimestamp(),
                fotoURL: fotoURL // Aquí guardamos el texto de la imagen
            };

            await addDoc(collection(db, 'animales'), nuevoAnimal);

            mensaje.textContent = `✅ ¡Animal ${nombre} registrado con foto (modo gratis)!`;
            mensaje.style.color = 'green';
            registroForm.reset();
            
        } catch (error) {
            console.error("Error:", error);
            mensaje.textContent = '❌ Error: ' + error.message;
            mensaje.style.color = 'red';
        }
    });
}

// --- LÓGICA DE LECTURA ---
const inventarioListado = document.getElementById('inventario-listado');

if (inventarioListado) {
    async function cargarInventario() {
        inventarioListado.innerHTML = '<p style="text-align: center;">Cargando ganado...</p>';
        try {
            const querySnapshot = await getDocs(collection(db, "animales"));
            const animalesData = [];
            querySnapshot.forEach((doc) => {
                animalesData.push({ id: doc.id, ...doc.data() });
            });
            
            const mapaDescendencia = {};
            const animalesMadres = [];
            
            animalesData.forEach(animal => {
                if (animal.idMadre) {
                    const madreID = animal.idMadre;
                    if (!mapaDescendencia[madreID]) mapaDescendencia[madreID] = [];
                    mapaDescendencia[madreID].push(animal);
                } else {
                    animalesMadres.push(animal);
                }
            });

            inventarioListado.innerHTML = '';

            if (animalesMadres.length === 0) {
                 inventarioListado.innerHTML = '<p style="text-align: center;">No hay animales. ¡Agrega uno!</p>';
                 return;
            }
            
            animalesMadres.forEach(animal => {
                const edad = calcularEdad(animal.fechaNacimiento);
                const crías = mapaDescendencia[animal.nombre] || [];

                const cardHTML = `
                    <div class="animal-card">
                        <div class="animal-header" onclick="document.getElementById('details-${animal.id}').style.display = document.getElementById('details-${animal.id}').style.display === 'block' ? 'none' : 'block'">
                            <span>${animal.nombre} (${animal.sexo})</span>
                            <span class="age-badge">${edad}</span>
                        </div>
                        
                        <div id="details-${animal.id}" class="animal-details">
                            <p><strong>Raza:</strong> ${animal.raza}</p>
                            <p><strong>Estado:</strong> ${animal.estado}</p>
                            <p><strong>P. Compra:</strong> ${formatCOP(animal.precioCompra)}</p>
                            
                            ${animal.fotoURL ? `<img src="${animal.fotoURL}" alt="Foto" style="width: 100%; max-width: 300px; display: block; margin: 10px auto;">` : ''}

                            <div class="offspring-list">
                                <strong>Crías (${crías.length}):</strong>
                                <ul>
                                    ${crías.length > 0 
                                        ? crías.map(cria => `<li>${cria.nombre} (${cria.sexo}) - ${calcularEdad(cria.fechaNacimiento)}</li>`).join('') 
                                        : '<li>Sin crías registradas.</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                inventarioListado.innerHTML += cardHTML;
            });

        } catch (error) {
            console.error("Error:", error);
            inventarioListado.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
    cargarInventario();
}
