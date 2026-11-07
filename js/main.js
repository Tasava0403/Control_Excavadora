import { CONFIG, VEHICLE_DIRS, ARM_DIRS, LABELS } from './config.js';
import { store, notificar } from './state/store.js';
import { vehicleApi } from './services/vehicleApi.js';
import { VehicleSocket } from './services/wsClient.js';
import { startHealthMonitor } from './services/healthMonitor.js';
import { CommandController } from './control/commandController.js';
import { DemoController } from './control/demoController.js';
import { Joystick } from './components/joystick.js';
import { initUI } from './components/ui.js';
import { mensajeUsuario } from './utils/errors.js';
import { $ } from './utils/dom.js';

const demo = new DemoController();
const commands = new CommandController(demo);

function crearJoystick(id, dirId, mapa) {
  return new Joystick($(id), {
    deadzone: CONFIG.JOYSTICK_DEADZONE,
    onDirection: (d) => {
      $(dirId).textContent = d ? LABELS[mapa[d]] : 'Neutro';
      commands.joystick(mapa, d);
    },
  });
}
const joysticks = [crearJoystick('#joy-v', '#dir-v', VEHICLE_DIRS), crearJoystick('#joy-a', '#dir-a', ARM_DIRS)];
initUI({ commands, demo, joysticks });

async function cargarCatalogo() {
  const [v, c] = await Promise.allSettled([vehicleApi.obtenerVehiculo(CONFIG.VEHICLE_ID), vehicleApi.listarComandos(CONFIG.VEHICLE_ID)]);
  if (v.status === 'fulfilled' && typeof v.value?.nombre === 'string') store.set({ vehiculo: { nombre: v.value.nombre } });
  if (c.status === 'fulfilled' && Array.isArray(c.value)) {
    const comandos = {};
    c.value.filter((x) => x?.activo && Number.isInteger(x.id_comando)).forEach((x) => {
      comandos[String(x.nombre)] = { id_comando: x.id_comando, codigo: x.codigo, nombre: String(x.nombre) };
    });
    store.set({ comandos });
  } else if (c.status === 'rejected') {
    notificar(`No se pudo cargar el catálogo de comandos. ${mensajeUsuario(c.reason)}`, 'error');
  }
}

// Conexión WSS propia de la interfaz (distinta de cualquier cliente externo de prueba).
new VehicleSocket(CONFIG.WSS_URL, {
  backoff: CONFIG.WS_BACKOFF,
  onStatus: (ws) => store.set({ ws }),
  onMessage: (m) => {
    if (m.tipo === 'codigo') { commands.onCodigo(m.codigo); demo.onCodigo(); }
    else if (m.tipo === 'json') demo.onEvento(m.data);
  },
}).connect();

startHealthMonitor({
  onAws: (aws) => {
    const recuperada = aws === 'disponible' && store.get().aws !== 'disponible';
    store.set({ aws });
    if (recuperada && !Object.keys(store.get().comandos).length) { cargarCatalogo(); demo.cargar(); }
  },
  onRds: (rds) => store.set({ rds }),
});

cargarCatalogo();
demo.cargar();
