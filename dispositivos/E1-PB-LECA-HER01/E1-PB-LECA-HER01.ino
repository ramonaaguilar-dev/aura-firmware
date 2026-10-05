#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// Incluir plantilla local de credenciales (nunca subir contraseñas al repo)
#include "config_local.h.example" 

// Identificador del dispositivo según contrato AURA
#define DEVICE_ID "e1-pb-leca-her01"

// Definición de Tópicos MQTT AURA v3.0
const char* TOPIC_DATA    = "devices/" DEVICE_ID "/data";
const char* TOPIC_STATUS  = "devices/" DEVICE_ID "/status";
const char* TOPIC_COMMAND = "devices/" DEVICE_ID "/command";

// Pines de Hardware
const int PIN_BARRERA_A = 32; // Barrera Infrarroja A (Exterior/Pasillo)
const int PIN_BARRERA_B = 33; // Barrera Infrarroja B (Interior LabECA)

// Variables Globales y Objeto NVS
Preferences prefs;
WiFiClient espClient;
PubSubClient client(espClient);

// Parámetros reconfigurables en NVS (Valores por defecto)
int timeout_barrera_ms = 2000;  // Tiempo límite entre paso por barrera A y B
int intervalo_status_ms = 10000; // Frecuencia de heartbeat/status

// Control de Tiempos No Bloqueante (millis)
unsigned long last_status_time = 0;
unsigned long tiempo_barrera_a = 0;
unsigned long tiempo_barrera_b = 0;

// Banderas de Estado de Sensores
bool barrera_a_ok = true;
bool barrera_b_ok = true;
bool lector_uhf_ok = true;

// Prototipos de funciones
void setupWifi();
void reconnectMqtt();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void procesarConfiguracion(StaticJsonDocument<256>& doc);
void enviarStatus(const char* mensaje_estado);
void enviarEventoTag(const char* uid, int direccion);

void setup() {
  Serial.begin(115200);

  // Configuración de Pines Digitales para Barreras IR
  pinMode(PIN_BARRERA_A, INPUT);
  pinMode(PIN_BARRERA_B, INPUT);

  // Cargar Configuración desde Memoria NVS
  prefs.begin("aura_cfg", false);
  timeout_barrera_ms = prefs.getInt("timeout_ir", 2000);
  intervalo_status_ms = prefs.getInt("interval_st", 10000);
  prefs.end();

  Serial.println("--- Dispositivo E1-PB-LECA-HER01 Iniciado ---");
  Serial.printf("Config NVS -> Timeout IR: %d ms | Intervalo Status: %d ms\n", 
                timeout_barrera_ms, intervalo_status_ms);

  // Inicialización de Conexión de Red
  setupWifi();
  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(mqttCallback);
}

void loop() {
  // 1. Mantenimiento de conexión MQTT No Bloqueante
  if (!client.connected()) {
    reconnectMqtt();
  }
  client.loop();

  unsigned long current_time = millis();

  // 2. Lógica No Bloqueante para Detección de Barreras IR (Direccionalidad)
  int estado_a = digitalRead(PIN_BARRERA_A);
  int estado_b = digitalRead(PIN_BARRERA_B);

  if (estado_a == HIGH && tiempo_barrera_a == 0) {
    tiempo_barrera_a = current_time;
  }
  if (estado_b == HIGH && tiempo_barrera_b == 0) {
    tiempo_barrera_b = current_time;
  }

  // Evaluación de Dirección (1 = ENTRADA, 2 = SALIDA)
  if (tiempo_barrera_a > 0 && tiempo_barrera_b > 0) {
    if (abs((long)(tiempo_barrera_b - tiempo_barrera_a)) <= timeout_barrera_ms) {
      int direccion = (tiempo_barrera_a < tiempo_barrera_b) ? 1 : 2;
      
      // Simulación de lectura del lector UHF en UART2
      // (Aquí se reemplaza por la lectura real del lector UHF RS-232)
      enviarEventoTag("E200001A8812014", direccion); 
    }
    // Reiniciar contadores de barrera
    tiempo_barrera_a = 0;
    tiempo_barrera_b = 0;
  }

  // Limpieza por Timeout si no se cruzó la segunda barrera
  if (tiempo_barrera_a > 0 && (current_time - tiempo_barrera_a > timeout_barrera_ms)) {
    tiempo_barrera_a = 0;
  }
  if (tiempo_barrera_b > 0 && (current_time - tiempo_barrera_b > timeout_barrera_ms)) {
    tiempo_barrera_b = 0;
  }

  // 3. Envío Periódico de Estado y Salud del Nodo
  if (current_time - last_status_time >= intervalo_status_ms) {
    last_status_time = current_time;
    enviarStatus("online");
  }
}

// Configuración de Wi-Fi
void setupWifi() {
  delay(10);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

// Reconexión MQTT Sin Bloqueo Infinito (Backoff)
void reconnectMqtt() {
  static unsigned long last_reconnect_attempt = 0;
  unsigned long now = millis();

  if (now - last_reconnect_attempt > 5000) {
    last_reconnect_attempt = now;
    if (client.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      client.subscribe(TOPIC_COMMAND);
      enviarStatus("reconnected");
    }
  }
}

// Procesamiento de Comandos Entrantes por MQTT
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    enviarStatus("error_json_invalid");
    return;
  }

  const char* command = doc["command"];
  if (command && strcmp(command, "set_config") == 0) {
    procesarConfiguracion(doc);
  }
}

// Validación Estricta de Rangos y Guardado en NVS
void procesarConfiguracion(StaticJsonDocument<256>& doc) {
  JsonObject params = doc["params"];
  bool cambio = false;

  if (params.containsKey("timeout_barrera_ms")) {
    int val = params["timeout_barrera_ms"];
    // Validación de rango de seguridad: Entre 500ms y 5000ms
    if (val >= 500 && val <= 5000) {
      timeout_barrera_ms = val;
      cambio = true;
    } else {
      enviarStatus("error_param_out_of_range");
      return;
    }
  }

  if (cambio) {
    prefs.begin("aura_cfg", false);
    prefs.putInt("timeout_ir", timeout_barrera_ms);
    prefs.end();
    enviarStatus("config_updated_nvs");
  }
}

// Enviar Medición en Tópico Data (Contrato AURA v3.0)
void enviarEventoTag(const char* uid, int direccion) {
  StaticJsonDocument<128> doc;
  JsonObject values = doc.createNestedObject("values");
  values["tag_uid"] = uid;
  values["direccion"] = direccion;

  char buffer[128];
  serializeJson(doc, buffer);
  client.publish(TOPIC_DATA, buffer);
}

// Enviar Estado del Nodo en Tópico Status
void enviarStatus(const char* mensaje_estado) {
  StaticJsonDocument<256> doc;
  doc["status"] = mensaje_estado;
  doc["uhf_reader_ok"] = lector_uhf_ok;
  doc["barrera_a_ok"]  = barrera_a_ok;
  doc["barrera_b_ok"]  = barrera_b_ok;
  doc["free_heap"]     = ESP.getFreeHeap();

  char buffer[256];
  serializeJson(doc, buffer);
  client.publish(TOPIC_STATUS, buffer);
}