# Dispositivo: E1-PB-LECA-HER01 (Control de Activos y Herramientas)

## 1. Identificación
- **Universidad:** Universidad Nacional de Rafaela (UNRaf)
- **Materia:** Ingeniería en Computación III / IV
- **Integrantes:** Ramona Aguilar, Constanza Armando
- **Ubicación:** Edificio 1 - Planta Baja - Laboratorio ECA (E1-PB-LECA)
- **Código de Dispositivo:** `E1-PB-LECA-HER01`

---

## 2. Descripción del Proyecto
Sistema IoT para la gestión patrimonial y trazabilidad de herramientas y activos de alto valor en el Laboratorio ECA (Edificio 1, Planta Baja). Integra detección direccional de paso mediante barreras infrarrojas de 15 metros y lectura de identificación por radiofrecuencia (RFID UHF Anti-Metal). Permite auditar la entrada y salida de equipos, además de detectar activos no autorizados en tiempo real.

---

## 3. Arquitectura del Sistema
[ Barrera IR (Pasillo) + Lector UHF Anti-Metal ]
│
▼ (GPIO / UART RS-232 via MAX3232)
[ ESP32 Node ]
│
▼ (MQTT / Wi-Fi o ESP-NOW)
[ Broker AURA ]
│
▼
[ Backend / Dashboard AURA ]
---

## 4. Hardware y Componentes
- **Microcontrolador:** ESP32 DevKit V1
- **Identificación:** Lector RFID UHF + Tags Anti-Metal
- **Sensores de Paso:** Barrera Infrarroja (15m emisor/receptor)
- **Alimentación:** Fuente Switching 12V 3A + Conversor DC-DC Buck LM2596 (12V a 5V)
- **Acondicionamiento de Señal:** Módulo MAX3232 + Resistencias de Pull-down 10 kΩ

---

## 5. Contrato de Tópicos MQTT (AURA v3.0)

El dispositivo responde estrictamente al contrato normativo de la plataforma AURA:

| Tópico | Dirección | Descripción | Payload Ejemplo |
| :--- | :--- | :--- | :--- |
| `devices/e1-pb-leca-her01/data` | Publica | Lecturas de activos y dirección de movimiento | `{"values": {"tag_uid": "E200001A8812", "direccion": 1}}` |
| `devices/e1-pb-leca-her01/status` | Publica | Estado de salud, memoria libre y fallos de sensores | `{"status": "online", "ir_sensor_ok": true, "free_heap": 182400}` |
| `devices/e1-pb-leca-her01/command` | Suscribe | Comandos remotos y reconfiguración de parámetros | `{"command": "set_config", "params": {"timeout_barrera_ms": 2000}}` |

*Nota sobre `direccion`: `1` = Entrada al LabECA, `2` = Salida del LabECA.*

---

## 6. Configuración Remota y NVS
El dispositivo soporta reconfiguración remota en caliente sin necesidad de reflashear:
- **`timeout_barrera_ms`**: Tiempo máximo entre el disparo de barreras (Rango válido: 500ms a 5000ms).
- Los parámetros aprobados se almacenan en la memoria Flash no volátil (**NVS**) del ESP32 usando `Preferences.h`.

---

## 7. Instrucciones de Puesta en Marcha
1. Clonar el repositorio `aura-firmware`.
2. Duplicar `config_local.h.example` como `config_local.h` y completar las credenciales Wi-Fi / MQTT.
3. Para probar sin hardware: Ejecutar el simulador ubicado en `simulator/simulator.py`.

---

## 8. Limitaciones Conocidas
- Operación en entorno de prueba de banco sin TLS/MQTTS activado.
- La confirmación de ejecución de comandos se notifica mediante el tópico `status`.