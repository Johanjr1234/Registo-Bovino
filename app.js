// ... (Código superior inalterado)

registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.textContent = 'Guardando...';

    // 1. Obtener datos del formulario
    const nombre = document.getElementById('nombre').value;
    // --- CAMBIO AQUÍ: Ahora puede ser null si está vacío ---
    const fechaNacimiento = document.getElementById('fechaNacimiento').value || null; 
    // --------------------------------------------------------
    const sexo = document.getElementById('sexo').value;
    const raza = document.getElementById('raza').value;
    const idMadre = document.getElementById('idMadre').value || null;
    const estado = document.getElementById('estado').value;
    const precioCompra = parseFloat(document.getElementById('precioCompra').value) || 0;
    const fotoFile = document.getElementById('foto').files[0];
    
// ... (Resto del código para subir fotos y guardar en Firestore inalterado)
