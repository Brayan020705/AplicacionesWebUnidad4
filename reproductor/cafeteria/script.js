// --- VARIABLES GLOBALES ---
let usuarioLogueado = null;
let chartVentasInstance = null;
let chartRendimientoInstance = null;

// ================= 1. LÓGICA DE LOGIN (CON AJAX REAL) =================
function intentarLogin() {
    const user = document.getElementById('userInput').value;
    const pass = document.getElementById('passInput').value;
    const errorMsg = document.getElementById('errorMsg');

    // AQUÍ ESTÁ EL AJAX: Pide el archivo datos.json al Live Server
    fetch('datos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("No se pudo leer el archivo JSON");
            }
            return response.json();
        })
        .then(data => {
            // Buscamos si el usuario existe en los datos recibidos
            const usuarioEncontrado = data.usuarios.find(u => u.user === user && u.pass === pass);

            if (usuarioEncontrado) {
                // Login Exitoso
                usuarioLogueado = usuarioEncontrado;
                iniciarDashboard(data.config_inicial);
            } else {
                // Login Fallido
                errorMsg.style.display = 'block';
                // Animación de error
                errorMsg.animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(5px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300 });
            }
        })
        .catch(error => {
            console.error('Error cargando datos:', error);
            alert("Error: Asegúrate de estar usando Live Server para que AJAX funcione.");
        });
}

function cerrarSesion() {
    location.reload();
}

// ================= 2. LÓGICA DEL DASHBOARD =================
function iniciarDashboard(config) {
    // Ocultar Login y Mostrar Dashboard
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';

    // Cargar Info del Usuario
    document.getElementById('displayNombre').innerText = usuarioLogueado.nombre;
    document.getElementById('displayRol').innerText = usuarioLogueado.rol;

    // SEGURIDAD POR ROLES: Si es empleado, ocultar gráfica de rendimiento
    if (usuarioLogueado.rol === 'empleado') {
        const cardRendimiento = document.getElementById('cardRendimiento');
        cardRendimiento.style.display = 'none';
        
        // Ajustar el grid
        document.querySelector('.grid-container').style.gridTemplateColumns = '1fr';
    }

    crearGraficas(config);
    iniciarSimulacionEnVivo();
}

// ================= 3. LÓGICA DE GRÁFICAS (Chart.js) =================
function crearGraficas(datos) {
    // --- GRÁFICA DE VENTAS ---
    const ctxVentas = document.getElementById('chartVentas').getContext('2d');
    
    const gradient = ctxVentas.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    chartVentasInstance = new Chart(ctxVentas, {
        type: 'line',
        data: {
            labels: datos.horas_labels,
            datasets: [{
                label: 'Ventas ($)',
                data: datos.ventas_hora,
                borderColor: '#38bdf8',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    // --- GRÁFICA DE RENDIMIENTO (Solo Admin) ---
    if (usuarioLogueado.rol === 'administrador') {
        const ctxRend = document.getElementById('chartRendimiento').getContext('2d');
        
        chartRendimientoInstance = new Chart(ctxRend, {
            type: 'bar',
            data: {
                labels: datos.empleados_nombres,
                datasets: [{
                    label: 'Eficiencia (%)',
                    data: datos.rendimiento_scores,
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.7)', 
                        'rgba(245, 158, 11, 0.7)', 
                        'rgba(16, 185, 129, 0.7)', 
                        'rgba(59, 130, 246, 0.7)', 
                        'rgba(139, 92, 246, 0.7)'
                    ],
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
}

// ================= 4. SIMULACIÓN DE DATOS EN VIVO =================
function iniciarSimulacionEnVivo() {
    setInterval(() => {
        const nuevaVenta = Math.floor(Math.random() * (300 - 100) + 100);
        
        const datos = chartVentasInstance.data.datasets[0].data;
        datos.shift();
        datos.push(nuevaVenta);
        
        chartVentasInstance.update();
    }, 3000);
}

// ================= 5. LÓGICA DE CHAT =================
function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const mensaje = input.value.trim();
    
    if (mensaje === "") return;

    agregarBurbuja(mensaje, 'propio');
    input.value = ''; 

    setTimeout(() => {
        const respuestasRandom = [
            "Recibido, gracias.", "Lo revisaré en un momento.", 
            "¿Estás seguro de eso?", "Ok, procedo con la orden."
        ];
        const respuesta = respuestasRandom[Math.floor(Math.random() * respuestasRandom.length)];
        const remitente = usuarioLogueado.rol === 'administrador' ? 'Empleado' : 'Administrador';
        
        agregarBurbuja(`${respuesta} <br><small style="opacity:0.6">${remitente}</small>`, 'otro');
    }, 1500);
}

function agregarBurbuja(textoHTML, tipo) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.classList.add('mensaje', tipo);
    div.innerHTML = textoHTML;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarMensaje();
});