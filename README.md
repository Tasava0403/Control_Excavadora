# Control · Excavadora IoT (frontend)

Interfaz web *mobile first* para controlar el vehículo mediante la API REST y el WebSocket desplegados en AWS.
HTML + Bootstrap 5 + JavaScript Modules, sin compilación: se publica tal cual en GitHub Pages.

## Estructura
```
index.html                       Documento semántico (rutas relativas ./)
assets/css/styles.css                   Estilos personalizados sobre Bootstrap 5
assets/images/                   Favicon SVG, PNG 32/180 e iconos 192/512
assets/js/config.js                     URLs, ID de vehículo, tiempos, mapa de direcciones (sin secretos)
assets/js/main.js                       Arranque y cableado
assets/js/state/store.js                Estado de interfaz (store con suscriptores)
assets/js/services/restClient.js        Fetch genérico: base URL, timeout, JSON, errores tipificados
assets/js/services/vehicleApi.js        Un método por endpoint documentado
assets/js/services/wsClient.js          Cliente WSS con reconexión exponencial
assets/js/services/healthMonitor.js     Sondeo de salud AWS y diagnóstico RDS
assets/js/control/commandController.js  Reglas de comandos (joysticks y botones comparten lógica)
assets/js/control/demoController.js     Catálogo, inicio, cancelación y eventos de DEMO
assets/js/components/joystick.js        Joystick (mouse, táctil, teclado)
assets/js/components/ui.js              Renderizado y eventos del DOM
assets/js/components/fullscreen.js      Botón de pantalla completa
manifest.webmanifest             Instalación en pantalla de inicio (display: fullscreen)
assets/js/utils/errors.js, dom.js       Errores y utilidades
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
- **LED y Sonido (interruptores por pulso)**: cada pulsación envía el código 9 (LED) o 10 (sonido), espera `PULSE_MS` (300 ms) y regresa al estado 11; si un joystick sigue activo, regresa a ese movimiento. El icono alterna encendido/apagado, pero es un estado **estimado**: la API no informa el estado real del LED ni del sonido, y se reinicia al recargar la página.
- **DETENER**: siempre habilitado; aborta solicitudes pendientes, descarta respuestas tardías y cancela la DEMO si existe.
- **Evidencia por botón**: cada control muestra un icono de estado en su esquina: *enviando* (reloj) → *aceptado por la API* (✓, HTTP 2xx) → *evento recibido* (✓✓, llegó por WSS el código de la acción actual). Los errores salen en un aviso flotante. Un evento WSS confirma que el backend lo publicó, **no** la ejecución física. La correlación es por código, porque el contrato no incluye identificador de evento.
- **WebSocket WSS** describe solo el socket del navegador; la presencia del ESP8266/ESP32 requerirá su propio latido.
- **DEMO**: el botón DEMO abre una ventana (`<dialog>`) para elegir, iniciar o cancelar. Solo se elige una existente; no se inicia dos veces y bloquea comandos conflictivos. Si el evento final no llega, una salvaguarda temporal libera la interfaz.
- **Seguridad**: sin claves ni credenciales en el cliente; datos de la API insertados con `textContent`; mensajes de error genéricos. CORS no es autenticación.

## Pantalla completa
- **Botón ⛶** (junto al nombre): Fullscreen API en Android, escritorio e iPad. Se oculta si la página ya está instalada.
- **iPhone**: Safari no permite la Fullscreen API en páginas; usa *Compartir → Agregar a pantalla de inicio* y ábrela desde el icono.
- **Android (Chrome)**: menú ⋮ → *Instalar aplicación* o *Agregar a pantalla de inicio*; el manifiesto pide `display: fullscreen`.
- Para instalarla, la página debe servirse por HTTPS (GitHub Pages lo cumple).

## Pruebas A–E
Con Postman o Thunder Client conectado a `wss://…/ws/vehiculos/1` como cliente **independiente**, captura URL, control accionado y mensaje recibido:
A) AVANZAR · B) cambio de dirección + soltar (DETENER) · C) DEMO inicio / N movimientos / fin y cancelación · D) caída y recuperación de WSS y API, indicador RDS · E) móvil vertical y horizontal, y escritorio.

## Flujo de commits sugerido
```bash
git init -b main
git add .gitignore README.md && git commit -m "chore: inicializa repositorio y documentación"
git add index.html manifest.webmanifest assets/css assets/images && git commit -m "feat(ui): maqueta mobile first, favicon y estilos"
git add assets/js/config.js assets/js/utils assets/js/state assets/js/services && git commit -m "feat(api): cliente REST, WSS con reconexión y monitor de salud"
git add assets/js/control assets/js/components assets/js/main.js && git commit -m "feat(control): joysticks, comandos, DETENER y DEMO"
```
Publicación: *Settings → Pages → Deploy from branch → main / (root)*.

## MONITOREO (práctica 4.2)
Vista `#monitoreo` dentro del mismo sitio (navegación por hash, compatible con GitHub Pages). No requiere backend ni tablas nuevas.

```
CONTROL ─POST /vehiculos/estado─▶ API FastAPI (AWS) ─▶ RDS MySQL (estado + historial)
MONITOREO ◀─GET estado / historial─┘        │
MONITOREO ◀──────── WSS /ws/vehiculos/1 ◀───┘   (código plano o evento JSON de DEMO)
```
Archivos nuevos: `services/wsHub.js` (única conexión WSS compartida), `monitor/monitorController.js` (sincronización), `state/monitorStore.js`, `components/nav.js`, `components/monitorView.js`, `utils/fechas.js`, `utils/validators.js`.

**Reglas de sincronización**: REST carga estado e historial al entrar y tras reconectar WSS; WSS solo *dispara* la consulta (debounce 250 ms, sin polling). Cada solicitud lleva token y aborta la anterior; si llega un evento durante una consulta, esa respuesta se descarta y se repite. El WS de movimientos solo trae el código, así que la fecha/hora siempre proviene de `GET /vehiculos/{id}/estado`. Los pasos de DEMO se muestran en vivo y **no** disparan consulta ni se agregan a la tabla.

**Contrato confirmado**: historial = `{id_historial, id_vehiculo, comando, codigo, fecha_hora, origen}`, más reciente primero. **Pendiente**: zona horaria del servidor (`SERVER_UTC_OFFSET`). Mientras no se declare la zona, la hora se muestra como «hora del servidor».

### Casos de prueba
| # | Prueba | Estado |
|---|---|---|
| 1 | Carga inicial: tarjeta y tabla desde REST | Pendiente (adaptador verificado con el JSON real; falta probar en navegador) |
| 2 | Comando desde CONTROL → tarjeta y tabla se actualizan | Pendiente |
| 3 | Comando desde otra pestaña o cliente → MONITOREO reacciona | Pendiente |
| 4 | Más de 10 movimientos: solo 10 filas, sin borrar datos de RDS | Pendiente |
| 5 | Orden, duplicados y fecha/hora | Pendiente |
| 6 | Cortar y recuperar WSS → resincronización REST | Pendiente |
| 7 | Indicadores AWS y RDS (`/status`, `/salud/db`) | Pendiente |
| 8 | DEMO: banner en vivo y tabla sin cambios | Pendiente |
| 9 | CONTROL intacto: joystick, DETENER, LED/sonido | Pendiente |
| 10 | Publicación HTTPS/WSS en GitHub Pages | Pendiente |

Evidencia por prueba: captura de la URL, la vista, y el mensaje del cliente WSS independiente (Postman/Thunder Client). Un evento WSS prueba la publicación por el backend, no la ejecución física.
