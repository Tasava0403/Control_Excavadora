# Control · Excavadora IoT (frontend)

Interfaz web *mobile first* para controlar el vehículo mediante la API REST y el WebSocket desplegados en AWS.
HTML + Bootstrap 5 + JavaScript Modules, sin compilación: se publica tal cual en GitHub Pages.

## Estructura
```
index.html                       Documento semántico (rutas relativas ./)
css/styles.css                   Estilos personalizados sobre Bootstrap 5
assets/images/                   Favicon SVG + PNG 32 y 180
js/config.js                     URLs, ID de vehículo, tiempos, mapa de direcciones (sin secretos)
js/main.js                       Arranque y cableado
js/state/store.js                Estado de interfaz (store con suscriptores)
js/services/restClient.js        Fetch genérico: base URL, timeout, JSON, errores tipificados
js/services/vehicleApi.js        Un método por endpoint documentado
js/services/wsClient.js          Cliente WSS con reconexión exponencial
js/services/healthMonitor.js     Sondeo de salud AWS y diagnóstico RDS
js/control/commandController.js  Reglas de comandos (joysticks y botones comparten lógica)
js/control/demoController.js     Catálogo, inicio, cancelación y eventos de DEMO
js/components/joystick.js        Joystick (mouse, táctil, teclado)
js/components/ui.js              Renderizado y eventos del DOM
js/utils/errors.js, dom.js       Errores y utilidades
```

## Requisitos
- VS Code (+ extensión *Live Server*) o cualquier servidor estático. No abrir con `file://` (los módulos ES lo bloquean).
- Navegador moderno (Chrome, Edge, Firefox, Safari recientes).
- Backend por HTTPS/WSS con CORS habilitado para tu origen.

## Ejecución local
```bash
python -m http.server 5500     # abre http://localhost:5500
```
Todas las rutas son relativas, por lo que también funciona en `https://<usuario>.github.io/<repo>/`.

## Puntos de integración con la API
| Uso | Método y ruta |
|---|---|
| Nombre del vehículo | `GET /vehiculos/{id}` |
| Catálogo de comandos | `GET /comandos/vehiculo/{id}` |
| Catálogo de DEMO | `GET /demos/vehiculo/{id}` |
| Ejecutar movimiento | `POST /vehiculos/estado` · `{id_vehiculo, id_comando, conectado:true}` |
| Iniciar / cancelar DEMO | `POST /vehiculos/{id}/demo/iniciar` (`{id_demo}`) · `POST /vehiculos/{id}/demo/cancelar` |
| Salud API (indicador AWS) | `GET /status` (configurable en `HEALTH_PATH`) |
| Diagnóstico RDS | `GET /salud/db` → `{"base_datos":"disponible"}` o HTTP 503 |
| Eventos | `wss://…/ws/vehiculos/{id}`: códigos en texto plano y eventos JSON (`INICIO_DEMO`, `FIN_DEMO`, `CANCELACION_DEMO`, `ERROR_DEMO`) |

**Backend:** necesita CORS para el origen de GitHub Pages (variable `CORS_ORIGINS=https://<usuario>.github.io`, sin ruta) y el endpoint `/salud/db`; ambos están en el `app/main.py` entregado. Sin `/salud/db`, el indicador Amazon RDS muestra **Sin verificar**, nunca «Disponible» sin evidencia.

## Comportamiento
- **Joysticks**: vehículo (AVANZAR, RETROCEDER, GIRAR_IZQUIERDA, GIRAR_DERECHA) y brazo-pala (SUBIR_BRAZO, BAJAR_BRAZO, GIRAR_I_PALA, GIRAR_D_PALA). Solo se envía una solicitud al **cambiar** la dirección; al soltar, perder el puntero o cancelar el gesto → DETENER. Comparten un único canal de comando porque el backend guarda un solo estado.
- **DETENER**: siempre habilitado; aborta solicitudes pendientes, descarta respuestas tardías y cancela la DEMO si existe.
- **Evidencia en tres pasos independientes**: *Solicitado* → *Aceptado por API* (HTTP 2xx) → *Evento recibido* (llegó por WSS el código de la acción actual). Un evento WSS confirma que el backend lo publicó, **no** la ejecución física. La correlación es por código, porque el contrato no incluye identificador de evento.
- **WebSocket WSS** describe solo el socket del navegador; la presencia del ESP8266/ESP32 requerirá su propio latido.
- **DEMO**: solo se elige una existente; no se inicia dos veces y bloquea comandos conflictivos. Si el evento final no llega, una salvaguarda temporal libera la interfaz.
- **Seguridad**: sin claves ni credenciales en el cliente; datos de la API insertados con `textContent`; mensajes de error genéricos. CORS no es autenticación.

## Pruebas A–E
Con Postman o Thunder Client conectado a `wss://…/ws/vehiculos/1` como cliente **independiente**, captura URL, control accionado y mensaje recibido:
A) AVANZAR · B) cambio de dirección + soltar (DETENER) · C) DEMO inicio / N movimientos / fin y cancelación · D) caída y recuperación de WSS y API, indicador RDS · E) móvil vertical y horizontal, y escritorio.

## Flujo de commits sugerido
```bash
git init -b main
git add .gitignore README.md && git commit -m "chore: inicializa repositorio y documentación"
git add index.html css assets && git commit -m "feat(ui): maqueta mobile first, favicon y estilos"
git add js/config.js js/utils js/state js/services && git commit -m "feat(api): cliente REST, WSS con reconexión y monitor de salud"
git add js/control js/components js/main.js && git commit -m "feat(control): joysticks, comandos, DETENER y DEMO"
```
Publicación: *Settings → Pages → Deploy from branch → main / (root)*.
