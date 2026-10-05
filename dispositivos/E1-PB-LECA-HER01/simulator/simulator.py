import json
import time
import paho.mqtt.client as mqtt

DEVICE_ID = "e1-pb-leca-her01"
BROKER = "broker.hivemq.com"
PORT = 1883

TOPIC_DATA = f"devices/{DEVICE_ID}/data"
TOPIC_STATUS = f"devices/{DEVICE_ID}/status"

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print(f"Conectado al Broker MQTT con código de resultado: {rc}")

client.on_connect = on_connect

try:
    client.connect(BROKER, PORT, 60)
    client.loop_start()
except Exception as e:
    print(f"Error de conexión al broker: {e}")

print(f"--- Simulador AURA iniciado para {DEVICE_ID} ---")

try:
    while True:
        # 1. Simulación de lectura de un Tag UHF al ingresar al LabECA
        payload_data = {
            "values": {
                "tag_uid": "E200001A8812014",
                "direccion": 1 # 1 = ENTRADA, 2 = SALIDA
            }
        }
        client.publish(TOPIC_DATA, json.dumps(payload_data))
        print(f"[DATA Sent] -> {TOPIC_DATA}: {payload_data}")

        time.sleep(2)

        # 2. Simulación de reporte periódico de salud/estado del nodo
        payload_status = {
            "status": "online",
            "uhf_reader_ok": True,
            "barrera_a_ok": True,
            "barrera_b_ok": True,
            "free_heap": 182400
        }
        client.publish(TOPIC_STATUS, json.dumps(payload_status))
        print(f"[STATUS Sent] -> {TOPIC_STATUS}: {payload_status}")

        time.sleep(8)

except KeyboardInterrupt:
    print("\nSimulador detenido.")
    client.loop_stop()
    client.disconnect()