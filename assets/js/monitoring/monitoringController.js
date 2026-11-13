import { vehicleApi } from '../services/vehicleApi.js';
import { MonitoringUI } from '../components/monitoringUi.js';
import { notificar } from '../state/store.js';
import { CONFIG } from '../config.js';

export class MonitoringController {
  constructor() {
    this.ui = new MonitoringUI();
    this.historialCache = [];
  }

  async inicializar() {
    await Promise.all([
      this.cargarUltimoEstado(),
      this.cargarHistorial()
    ]);
  }

  async cargarUltimoEstado() {
    try {
      const estado = await vehicleApi.obtenerUltimoEstado(CONFIG.VEHICLE_ID);
      this.ui.actualizarUltimoEstado(estado);
    } catch (err) {
      notificar(`No se pudo cargar el último estado: ${err.message}`, 'error');
    }
  }

  async cargarHistorial() {
    try {
      const historial = await vehicleApi.obtenerHistorialUltimos10(CONFIG.VEHICLE_ID);
      if (Array.isArray(historial)) {
        this.historialCache = historial;
        this.ui.actualizarHistorial(this.historialCache);
      }
    } catch (err) {
      this.ui.mostrarErrorHistorial(err.message);
      notificar(`No se pudo cargar el historial: ${err.message}`, 'error');
    }
  }

  async onNuevoCodigoWSS(codigo, comandoNombre = null) {
    // Al recibir WSS, actualizamos inmediatamente el último estado y recargamos historial por REST
    const timestampActual = new Date().toISOString();
    this.ui.actualizarUltimoEstado({
      comando: comandoNombre,
      codigo: codigo,
      fecha_actualizacion: timestampActual,
      conectado: 1
    });
    // Sincronizar historial con RDS
    await this.cargarHistorial();
  }
}