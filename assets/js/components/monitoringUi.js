import { formatearFechaHora } from '../utils/dateUtils.js';
import { LABELS } from '../config.js';
import { $ } from '../utils/dom.js';

export class MonitoringUI {
  constructor() {
    this.$cardName = $('#last-cmd-name');
    this.$cardTime = $('#last-cmd-time');
    this.$cardBadge = $('#last-cmd-badge');
    this.$cardContainer = $('#last-movement-card');
    this.$tbody = $('#history-tbody');
  }

  actualizarUltimoEstado(estado) {
    if (!estado) return;
    const nombreComando = estado.comando || LABELS[estado.codigo] || `Código ${estado.codigo}`;
    this.$cardName.textContent = nombreComando;
    this.$cardTime.textContent = formatearFechaHora(estado.fecha_actualizacion || estado.fecha_hora);
    
    if (estado.conectado === 1 || estado.conectado === true) {
      this.$cardBadge.textContent = 'En línea';
      this.$cardBadge.className = 'last-card__status badge bg-success';
    } else {
      this.$cardBadge.textContent = 'Desconectado';
      this.$cardBadge.className = 'last-card__status badge bg-danger';
    }
    this.$cardContainer.dataset.state = 'ok';
  }

  actualizarHistorial(historial) {
    if (!Array.isArray(historial) || historial.length === 0) {
      this.$tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">Sin registros de historial</td></tr>`;
      return;
    }

    this.$tbody.innerHTML = historial.map((item, index) => {
      const comandoTexto = item.comando || LABELS[item.codigo] || `Código ${item.codigo}`;
      const fechaFormateada = formatearFechaHora(item.fecha_hora);
      return `
        <tr>
          <td><span class="badge bg-secondary">${item.id_historial || (index + 1)}</span></td>
          <td class="fw-semibold">${comandoTexto}</td>
          <td><small class="text-muted">${fechaFormateada}</small></td>
        </tr>
      `;
    }).join('');
  }

  mostrarErrorHistorial(mensaje) {
    this.$tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Error al cargar historial: ${mensaje}</td></tr>`;
  }
}