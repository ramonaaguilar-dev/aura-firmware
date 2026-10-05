// Configuración de conexión MQTT por WebSockets al broker público HiveMQ
const broker = "broker.hivemq.com";
const port = 8000; // Puerto WebSockets
const clientId = "aura_web_dashboard_" + Math.random().toString(16).substr(2, 8);

const deviceId = "e1-pb-leca-her01";
const topicData = `devices/${deviceId}/data`;
const topicStatus = `devices/${deviceId}/status`;

let totalStock = 0;

// Inicialización del cliente MQTT Websockets
const client = new Paho.MQTT.Client(broker, port, clientId);

client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
    useSSL: false
});

function onConnect() {
    console.log("Conectado exitosamente por WebSockets al Broker MQTT");
    document.getElementById("mqtt-status").innerText = "Online (WebSockets)";
    document.getElementById("mqtt-status").className = "badge bg-success";

    // Suscribirse a los tópicos de Datos y Estado del dispositivo
    client.subscribe(topicData);
    client.subscribe(topicStatus);
}

function onFailure(response) {
    console.error("Fallo la conexión MQTT:", response.errorMessage);
    document.getElementById("mqtt-status").innerText = "Error de Conexión";
    document.getElementById("mqtt-status").className = "badge bg-danger";
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.warn("Conexión perdida:", responseObject.errorMessage);
        document.getElementById("mqtt-status").innerText = "Desconectado";
        document.getElementById("mqtt-status").className = "badge bg-danger";
    }
}

// Procesamiento de mensajes entrantes
function onMessageArrived(message) {
    try {
        const payload = JSON.parse(message.payloadString);
        
        if (message.destinationName === topicData) {
            procesarEventoDatos(payload);
        } else if (message.destinationName === topicStatus) {
            procesarEventoEstado(payload);
        }
    } catch (e) {
        console.error("Error al procesar el mensaje JSON:", e);
    }
}

function procesarEventoDatos(payload) {
    const values = payload.values;
    if (!values) return;

    const tagUid = values.tag_uid || "Desconocido";
    const direccion = values.direccion; // 1 = Entrada, 2 = Salida
    const timestamp = new Date().toLocaleTimeString();

    let textoMovimiento = "";
    let badgeClass = "";

    if (direccion === 1) {
        textoMovimiento = "ENTRADA (Ingreso a LabECA)";
        badgeClass = "bg-success";
        totalStock++;
    } else if (direccion === 2) {
        textoMovimiento = "SALIDA (Retiro de LabECA)";
        badgeClass = "bg-warning text-dark";
        totalStock = Math.max(0, totalStock - 1);
    } else {
        textoMovimiento = "Lectura / Detección";
        badgeClass = "bg-info";
    }

    // Actualizar métricas
    document.getElementById("total-stock").innerText = totalStock;
    document.getElementById("last-event-type").innerText = direccion === 1 ? "Entrada" : "Salida";
    document.getElementById("last-event-uid").innerText = `Tag: ${tagUid}`;

    // Agregar fila a la tabla
    const emptyRow = document.getElementById("empty-row");
    if (emptyRow) emptyRow.remove();

    const tbody = document.getElementById("movements-table-body");
    const row = document.createElement("tr");

    row.innerHTML = `
        <td>${timestamp}</td>
        <td><code>${tagUid}</code></td>
        <td><span class="badge ${badgeClass}">${textoMovimiento}</span></td>
        <td>E1-PB-LECA</td>
    `;

    tbody.insertBefore(row, tbody.firstChild);
}

function procesarEventoEstado(payload) {
    const status = payload.status || "online";
    const freeHeap = payload.free_heap ? `${payload.free_heap} bytes` : "N/A";

    document.getElementById("node-status").innerText = status.toUpperCase();
    document.getElementById("node-heap").innerText = `Heap Libre: ${freeHeap}`;
}

function limpiarTabla() {
    const tbody = document.getElementById("movements-table-body");
    tbody.innerHTML = `
        <tr id="empty-row">
            <td colspan="4" class="text-center text-muted py-4">Esperando eventos del lector...</td>
        </tr>
    `;
}