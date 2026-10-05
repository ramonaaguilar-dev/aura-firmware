import json
import time
import random
import paho.mqtt.client as mqtt

DEVICE_ID = "e1-pb-leca-her01"
BROKER = "broker.hivemq.com"
PORT = 1883

TOPIC_DATA = f"devices/{DEVICE_ID}/data"
TOPIC_STATUS = f"devices/{DEVICE_ID}/status"

# Lista de Tags RFID asociados a las herramientas del LabECA
HERRAMIENTAS_TAGS = [
    "E200001A8812014",  # Osciloscopio Digital Rigol
    "E200001A8812015",  # Estación de Soldadura Hakko
    "E200001A8812016",  # Multímetro Digital Fluke
    "E200001A8812017",  # Fuente Regulada DC 30V
    "E200001A8812018"   # Set de Destornilladores
]

try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
except Attribute:
    client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Conectado al Broker MQTT público (HiveMQ)")
    else:
        print(f"❌ Error de conexión al Broker: {rc}")

client.on_connect = on_connect

print(f"--- Simulador Avanzado AURA iniciado para {DEVICE_ID} ---")
print("Simulando Entradas (1) y Salidas/Préstamos (2) en tiempo real...")

try:
    client.connect(BROKER, PORT, 60)
    client.loop_start()
    time.sleep(1)

    while True:
        # Elegir una herramienta al azar
        tag_seleccionado = random.choice(HERRAMIENTAS_TAGS)
        
        # Simular movimiento: 1 = ENTRADA, 2 = SALIDA / PRÉSTAMO
        direccion_simulada = random.choice([1, 2])
        tipo_mov = "ENTRADA" if direccion_simulada == 1 else "SALIDA / PRÉSTAMO"

        payload_data = {
            "values": {
                "tag_uid": tag_seleccionado,
                "direccion": direccion_simulada
            }
        }
        
        client.publish(TOPIC_DATA, json.dumps(payload_data))
        print(f"\n[EVENTO REGISTRADO] -> Movimiento: {tipo_mov} | Tag: {tag_seleccionado}")

        time.sleep(4)

        # Reporte de estado periódico del dispositivo
        payload_status = {
            "status": "online",
            "uhf_reader_ok": True,
            "barrera_a_ok": True,
            "barrera_b_ok": True,
            "free_heap": random.randint(180000, 185000)
        }
        client.publish(TOPIC_STATUS, json.dumps(payload_status))

        time.sleep(6)

except KeyboardInterrupt:
    print("\n🛑 Simulador detenido por el usuario.")
    client.loop_stop()
    client.disconnect()