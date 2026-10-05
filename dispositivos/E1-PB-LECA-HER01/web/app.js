// Configuración WebSockets MQTT
const broker = "broker.hivemq.com";
const port = 8000;
const clientId = "aura_web_inventory_" + Math.random().toString(16).substr(2, 8);

const deviceId = "e1-pb-leca-her01";
const topicData = `devices/${deviceId}/data`;
const topicStatus = `devices/${deviceId}/status`;

// Base de Datos de Componentes Iniciales (Catálogo del LabECA)
const inventarioBase = {
    "E200001A8812014": { nombre: "Osciloscopio Digital Rigol", categoria: "Equipamiento", enLab: true, fecha: "Inicial" },
    "E200001A8812015": { nombre: "Estación de Soldadura Hakko", categoria: "Herramientas", enLab: true, fecha: "Inicial" },
    "E200001A8812016": { nombre: "Multímetro Digital Fluke", categoria: "Medición", enLab: true, fecha: "Inicial" },
    "E200001A8812017": { nombre: "Fuente Regulada DC 30V", categoria: "Equipamiento", enLab: false, fecha: "Inicial (Prestado)" },
    "E200001A8812018": { nombre: "Set de Destornilladores de Precisión", categoria: "Herramientas", enLab: true, fecha: "Inicial" }
};

const client = new Paho.MQTT.Client(broker, port, clientId);

client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
    useSSL: false
});

function onConnect() {
    console.log("Conectado a MQTT vía WebSockets");
    document.getElementById("mqtt-status").innerText = "Online (WebSockets)";
    document.getElementById("mqtt-status").className = "badge bg-success";

    client.subscribe(topicData);
    client.subscribe(topicStatus);

    renderizarInventario();
}

function onFailure(response) {
    document.getElementById("mqtt-status").innerText = "Error de Conexión";
    document.getElementById("mqtt-status").className = "badge bg-danger";
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        document.getElementById("mqtt-status").innerText = "Desconectado";
        document.getElementById("mqtt-status").className = "badge bg-danger";
    }
}

// Renderizar la tabla principal de inventario y actualizar contadores
function renderizarInventario() {
    const tbody = document.getElementById("inventory-table-body");
    tbody.innerHTML = "";

    let total = 0;
    let disponibles = 0;
    let prestados = 0;

    for (const [uid, item] of Object.entries(inventarioBase)) {
        total++;
        if (item.enLab) disponibles++;
        else prestados++;

        const tr = document.createElement("tr");
        const estadoBadge = item.enLab 
            ? '<span class="badge bg-success">DISPONIBLE (En Lab)</span>' 
            : '<span class="badge bg-warning text-dark">PRESTADO / RETIRADO</span>';
        
        const ubicacionTexto = item.enLab ? "LabECA - Estante A" : "Fuera de Laboratorio";

        tr.innerHTML = `
            <td><code>${uid}</code></td>
            <td class="fw-bold">${item.nombre}</td>
            <td><span class="badge bg-secondary">${item.categoria}</span></td>
            <td>${estadoBadge}</td>
            <td>${ubicacionTexto}</td>
            <td><small class="text-muted">${item.fecha}</small></td>
        `;
        tbody.appendChild(tr);
    }

    // Actualizar métricas generales
    document.getElementById("total-inventario").innerText = total;
    document.getElementById("stock-disponible").innerText = disponibles;
    document.getElementById("componentes-prestados").innerText = prestados;
}

// Manejo de eventos MQTT entrantes
function onMessageArrived(message) {
    try {
        const payload = JSON.parse(message.payloadString);
        
        if (message.destinationName === topicData) {
            procesarEventoMovimiento(payload);
        } else if (message.destinationName === topicStatus) {
            procesarEventoEstado(payload);
        }
    } catch (e) {
        console.error("Error procesando mensaje MQTT:", e);
    }
}

function procesarEventoMovimiento(payload) {
    const values = payload.values;
    if (!values) return;

    const tagUid = values.tag_uid || "E200001A8812014";
    const direccion = values.direccion; // 1 = Entrada, 2 = Salida
    const hora = new Date().toLocaleTimeString();

    // Actualizar o dar de alta en la base local
    if (!inventarioBase[tagUid]) {
        inventarioBase[tagUid] = {
            nombre: `Activo Nuevo (${tagUid.slice(-4)})`,
            categoria: "General",
            enLab: direccion === 1,
            fecha: hora
        };
    } else {
        inventarioBase[tagUid].enLab = (direccion === 1);
        inventarioBase[tagUid].fecha = hora;
    }

    // Re-renderizar tabla de stock con el nuevo estado
    renderizarInventario();

    // Agregar registro al historial
    const emptyRow = document.getElementById("empty-row");
    if (emptyRow) emptyRow.remove();

    const tbody = document.getElementById("movements-table-body");
    const row = document.createElement("tr");

    const badgeMov = direccion === 1 
        ? '<span class="badge bg-success">ENTRADA (Ingresó a Lab)</span>'
        : '<span class="badge bg-warning text-dark">SALIDA (Retirado de Lab)</span>';

    row.innerHTML = `
        <td>${hora}</td>
        <td><code>${tagUid}</code></td>
        <td>${inventarioBase[tagUid].nombre}</td>
        <td>${badgeMov}</td>
    `;

    tbody.insertBefore(row, tbody.firstChild);
}

function procesarEventoEstado(payload) {
    const status = payload.status || "online";
    const freeHeap = payload.free_heap ? `${payload.free_heap} bytes` : "N/A";

    document.getElementById("node-status").innerText = status.toUpperCase();
    document.getElementById("node-heap").innerText = `Heap Libre: ${freeHeap}`;
}

function limpiarHistorial() {
    const tbody = document.getElementById("movements-table-body");
    tbody.innerHTML = `
        <tr id="empty-row">
            <td colspan="4" class="text-center text-muted py-3">Esperando eventos del lector...</td>
        </tr>
    `;
}