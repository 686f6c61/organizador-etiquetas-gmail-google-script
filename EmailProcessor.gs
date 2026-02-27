/**
 * @file EmailProcessor.gs
 * @description Modulo para el procesamiento de correos electronicos.
 *              Incluye proteccion contra timeouts (4.5 min de los 6 que permite GAS)
 *              y procesamiento por lotes con estadisticas.
 * @author 686f6c61
 * @version 0.5
 * @date 2025-11-17
 */

/**
 * @description Procesador de correos con control de tiempo y procesamiento por lotes.
 */
class EmailProcessor {
  constructor() {
    this.labelManager = new LabelManager();
    this.configManager = new ConfigManager();
    // 4.5 minutos: margen de seguridad sobre el limite de 6 min de Apps Script
    this.maxExecutionTime = 270000;
    this.startTime = null;
  }

  /**
   * @description Comprueba si se esta acercando al limite de tiempo de ejecucion.
   * @returns {boolean} true si se debe detener el procesamiento
   */
  _shouldStopExecution() {
    if (!this.startTime) return false;
    return (Date.now() - this.startTime) > this.maxExecutionTime;
  }

  /**
   * @description Construye la consulta de busqueda de Gmail.
   * @param {string} readFilter - Filtro de lectura: 'is:read' o 'is:unread'
   * @param {Object} config - Configuracion actual
   * @returns {string} Query de busqueda para GmailApp.search()
   */
  _buildSearchQuery(readFilter, config) {
    let query = readFilter;

    if (config.daysBack !== -1 && config.daysBack > 0) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - config.daysBack);

      const year = dateLimit.getFullYear();
      const month = String(dateLimit.getMonth() + 1).padStart(2, '0');
      const day = String(dateLimit.getDate()).padStart(2, '0');

      query += ' after:' + year + '/' + month + '/' + day;
    }

    return query;
  }

  /**
   * @description Procesa un lote de hilos de correo, extrayendo dominios y preparando
   *              las asignaciones de etiquetas para aplicarlas en bloque.
   * @param {Array<GmailThread>} threads - Hilos a procesar
   * @param {Object} config - Configuracion actual
   * @returns {Object} Estadisticas del procesamiento
   */
  _processThreadBatch(threads, config) {
    const stats = {
      processed: 0,
      labeled: 0,
      errors: 0,
      domains: {},
      stopped: false
    };

    const threadLabelPairs = [];

    for (const thread of threads) {
      if (this._shouldStopExecution()) {
        stats.stopped = true;
        Logger.log('Procesamiento detenido: limite de tiempo alcanzado');
        break;
      }

      try {
        const messages = thread.getMessages();
        if (messages.length === 0) continue;

        // Usar el primer mensaje del hilo para determinar el remitente original
        const firstMessage = messages[0];
        const from = firstMessage.getFrom();
        const domain = this.labelManager.extractDomain(from);

        if (domain) {
          const labelName = this.labelManager.getLabelName(domain, config);

          if (labelName) {
            threadLabelPairs.push({
              thread: thread,
              labelName: labelName,
              domain: domain
            });
          }
        }

        stats.processed++;
      } catch (e) {
        Logger.log('Error al procesar hilo: ' + e.toString());
        stats.errors++;
      }
    }

    // Aplicar etiquetas en lote
    if (threadLabelPairs.length > 0) {
      try {
        const labelStats = this.labelManager.applyLabelsToThreads(threadLabelPairs);
        stats.labeled += labelStats.applied;
        stats.errors += labelStats.errors;

        // Contabilizar dominios procesados
        threadLabelPairs.forEach(pair => {
          if (!stats.domains[pair.domain]) {
            stats.domains[pair.domain] = 0;
          }
          stats.domains[pair.domain]++;
        });
      } catch (e) {
        Logger.log('Error al aplicar etiquetas en lote: ' + e.toString());
        stats.errors += threadLabelPairs.length;
      }
    }

    return stats;
  }

  /**
   * @description Procesa correos leidos segun la configuracion.
   * @returns {Object} Estadisticas del procesamiento o error
   */
  processEmails() {
    this.startTime = Date.now();

    try {
      const config = this.configManager.getConfig();
      const query = this._buildSearchQuery('is:read', config);

      Logger.log('Iniciando procesamiento con query: ' + query);
      Logger.log('Configuracion: maxEmails=' + config.maxEmails + ', daysBack=' + config.daysBack);

      const threads = GmailApp.search(query, 0, config.maxEmails);
      Logger.log('Hilos encontrados: ' + threads.length);

      if (threads.length === 0) {
        return {
          processed: 0,
          labeled: 0,
          errors: 0,
          domains: {},
          message: 'No se encontraron correos para procesar'
        };
      }

      const stats = this._processThreadBatch(threads, config);

      Logger.log('Procesamiento completado: ' + stats.processed +
        ' procesados, ' + stats.labeled + ' etiquetados, ' + stats.errors + ' errores');

      if (stats.stopped) {
        stats.message = 'Procesamiento detenido por limite de tiempo. Ejecute nuevamente para continuar.';
      }

      return stats;
    } catch (e) {
      Logger.log('Error en processEmails: ' + e.toString());
      return {
        error: e.toString(),
        message: 'Error al procesar correos: ' + e.toString()
      };
    }
  }

  /**
   * @description Procesa correos y actualiza las estadisticas acumuladas.
   * @returns {Object} Resultado del procesamiento
   */
  processEmailsWithStats() {
    const result = this.processEmails();

    if (!result.error && result.processed > 0) {
      try {
        updateStats(result);
      } catch (e) {
        Logger.log('Error al actualizar estadisticas: ' + e.toString());
        result.statsError = e.toString();
      }
    }

    return result;
  }

  /**
   * @description Obtiene una vista previa de los correos que serian procesados.
   * @param {number} limit - Numero maximo de correos a previsualizar
   * @returns {Object} Vista previa del procesamiento
   */
  previewProcessing(limit) {
    limit = limit || 10;

    try {
      const config = this.configManager.getConfig();
      const query = this._buildSearchQuery('is:read', config);

      const threads = GmailApp.search(query, 0, limit);
      const preview = [];

      threads.forEach(thread => {
        try {
          const messages = thread.getMessages();
          if (messages.length > 0) {
            const firstMessage = messages[0];
            const from = firstMessage.getFrom();
            const domain = this.labelManager.extractDomain(from);
            const labelName = domain ? this.labelManager.getLabelName(domain, config) : null;

            preview.push({
              subject: thread.getFirstMessageSubject(),
              from: from,
              domain: domain,
              labelName: labelName,
              messageCount: messages.length,
              date: firstMessage.getDate()
            });
          }
        } catch (e) {
          Logger.log('Error en preview: ' + e.toString());
        }
      });

      return {
        total: threads.length,
        preview: preview,
        query: query
      };
    } catch (e) {
      Logger.log('Error en previewProcessing: ' + e.toString());
      return { error: e.toString() };
    }
  }

  /**
   * @description Procesa correos no leidos.
   * @returns {Object} Resultado del procesamiento
   */
  processUnreadEmails() {
    this.startTime = Date.now();

    try {
      const config = this.configManager.getConfig();
      const query = this._buildSearchQuery('is:unread', config);

      Logger.log('Procesando correos no leidos con query: ' + query);

      const threads = GmailApp.search(query, 0, config.maxEmails);
      const stats = this._processThreadBatch(threads, config);

      Logger.log('Correos no leidos: ' + stats.processed +
        ' procesados, ' + stats.labeled + ' etiquetados');

      return stats;
    } catch (e) {
      Logger.log('Error en processUnreadEmails: ' + e.toString());
      return { error: e.toString() };
    }
  }

  clearCache() {
    this.labelManager.clearCache();
  }
}

// --- Funciones publicas ---

/**
 * @description Procesa correos leidos y actualiza estadisticas.
 * @returns {Object} Estadisticas del procesamiento
 */
function processEmails() {
  return new EmailProcessor().processEmailsWithStats();
}

/**
 * @description Obtiene vista previa del procesamiento.
 * @param {number} limit - Limite de correos
 * @returns {Object} Vista previa
 */
function previewProcessing(limit) {
  return new EmailProcessor().previewProcessing(limit);
}

/**
 * @description Procesa correos no leidos y actualiza estadisticas.
 * @returns {Object} Resultado del procesamiento
 */
function processUnreadEmails() {
  const processor = new EmailProcessor();
  const result = processor.processUnreadEmails();

  if (!result.error && result.processed > 0) {
    updateStats(result);
  }

  return result;
}
