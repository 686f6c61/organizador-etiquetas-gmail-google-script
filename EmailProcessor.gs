/**
 * @file EmailProcessor.gs
 * @description Módulo para el procesamiento eficiente de correos electrónicos.
 *              Incluye optimizaciones para evitar timeouts y procesamiento por lotes.
 * @author 686f6c61
 * @version 0.4
 * @date 2025-11-17
 */

/**
 * @description Procesador de correos electrónicos con optimizaciones de rendimiento.
 */
class EmailProcessor {
  constructor() {
    this.labelManager = new LabelManager();
    this.configManager = new ConfigManager();
    this.maxExecutionTime = 270000; // 4.5 minutos (límite de Apps Script es 6 min)
    this.startTime = null;
  }

  /**
   * @description Verifica si se está acercando al límite de tiempo de ejecución.
   * @returns {Boolean} true si se debe detener el procesamiento
   */
  _shouldStopExecution() {
    if (!this.startTime) return false;
    const elapsed = Date.now() - this.startTime;
    return elapsed > this.maxExecutionTime;
  }

  /**
   * @description Construye la consulta de búsqueda de Gmail.
   * @param {Object} config - Configuración actual
   * @returns {String} Query de búsqueda
   */
  _buildSearchQuery(config) {
    let query = 'is:read';

    // Añadir filtro de fecha si no es "Todos"
    if (config.daysBack !== -1 && config.daysBack > 0) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - config.daysBack);

      const year = dateLimit.getFullYear();
      const month = dateLimit.getMonth() + 1;
      const day = dateLimit.getDate();

      query += ` after:${year}/${month}/${day}`;
    }

    return query;
  }

  /**
   * @description Procesa un lote de hilos de correo.
   * @param {Array<GmailThread>} threads - Hilos a procesar
   * @param {Object} config - Configuración actual
   * @returns {Object} Estadísticas del procesamiento
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
      // Verificar límite de tiempo
      if (this._shouldStopExecution()) {
        stats.stopped = true;
        Logger.log('Procesamiento detenido: límite de tiempo alcanzado');
        break;
      }

      try {
        // Obtener el primer mensaje del hilo para extraer el remitente
        const messages = thread.getMessages();
        if (messages.length === 0) continue;

        // Solo procesar el primer mensaje del hilo (el remitente original)
        const firstMessage = messages[0];

        // Solo procesar si el mensaje está leído
        if (!firstMessage.isUnread()) {
          const from = firstMessage.getFrom();
          const domain = this.labelManager.extractDomain(from);

          if (domain) {
            const labelName = this.labelManager.getLabelName(domain, config);

            if (labelName) {
              // Añadir al lote para procesamiento
              threadLabelPairs.push({
                thread: thread,
                labelName: labelName,
                domain: domain
              });
            }
          }

          stats.processed++;
        }
      } catch (e) {
        Logger.log(`Error al procesar hilo: ${e.toString()}`);
        stats.errors++;
      }
    }

    // Aplicar etiquetas en lote
    if (threadLabelPairs.length > 0) {
      try {
        const labelStats = this.labelManager.applyLabelsToThreads(threadLabelPairs);
        stats.labeled += labelStats.applied;
        stats.errors += labelStats.errors;

        // Registrar estadísticas por dominio
        threadLabelPairs.forEach(pair => {
          if (!stats.domains[pair.domain]) {
            stats.domains[pair.domain] = 0;
          }
          stats.domains[pair.domain]++;
        });
      } catch (e) {
        Logger.log(`Error al aplicar etiquetas en lote: ${e.toString()}`);
        stats.errors += threadLabelPairs.length;
      }
    }

    return stats;
  }

  /**
   * @description Procesa los correos electrónicos según la configuración.
   * @returns {Object} Estadísticas del procesamiento o error
   */
  processEmails() {
    this.startTime = Date.now();

    try {
      const config = this.configManager.getConfig();
      const query = this._buildSearchQuery(config);

      Logger.log(`Iniciando procesamiento con query: ${query}`);
      Logger.log(`Configuración: maxEmails=${config.maxEmails}, daysBack=${config.daysBack}`);

      // Obtener hilos de correo
      const threads = GmailApp.search(query, 0, config.maxEmails);
      Logger.log(`Hilos encontrados: ${threads.length}`);

      if (threads.length === 0) {
        return {
          processed: 0,
          labeled: 0,
          errors: 0,
          domains: {},
          message: 'No se encontraron correos para procesar'
        };
      }

      // Procesar hilos
      const stats = this._processThreadBatch(threads, config);

      // Registrar resumen
      Logger.log(`Procesamiento completado: ${stats.processed} procesados, ${stats.labeled} etiquetados, ${stats.errors} errores`);

      if (stats.stopped) {
        stats.message = 'Procesamiento detenido por límite de tiempo. Ejecute nuevamente para continuar.';
      }

      return stats;
    } catch (e) {
      Logger.log(`Error en processEmails: ${e.toString()}`);
      return {
        error: e.toString(),
        message: 'Error al procesar correos: ' + e.toString()
      };
    }
  }

  /**
   * @description Procesa correos y actualiza las estadísticas.
   * @returns {Object} Resultado del procesamiento
   */
  processEmailsWithStats() {
    const result = this.processEmails();

    // Actualizar estadísticas si no hubo error
    if (!result.error && result.processed > 0) {
      try {
        updateStats(result);
      } catch (e) {
        Logger.log(`Error al actualizar estadísticas: ${e.toString()}`);
        result.statsError = e.toString();
      }
    }

    return result;
  }

  /**
   * @description Obtiene una vista previa de los correos que serían procesados.
   * @param {Number} limit - Número máximo de correos a previsualizar
   * @returns {Object} Vista previa del procesamiento
   */
  previewProcessing(limit = 10) {
    try {
      const config = this.configManager.getConfig();
      const query = this._buildSearchQuery(config);

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
          Logger.log(`Error en preview: ${e.toString()}`);
        }
      });

      return {
        total: threads.length,
        preview: preview,
        query: query
      };
    } catch (e) {
      Logger.log(`Error en previewProcessing: ${e.toString()}`);
      return {
        error: e.toString()
      };
    }
  }

  /**
   * @description Procesa solo correos no leídos.
   * @returns {Object} Resultado del procesamiento
   */
  processUnreadEmails() {
    this.startTime = Date.now();

    try {
      const config = this.configManager.getConfig();

      // Modificar query para correos no leídos
      let query = 'is:unread';

      if (config.daysBack !== -1 && config.daysBack > 0) {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - config.daysBack);
        query += ` after:${dateLimit.getFullYear()}/${dateLimit.getMonth() + 1}/${dateLimit.getDate()}`;
      }

      Logger.log(`Procesando correos no leídos con query: ${query}`);

      const threads = GmailApp.search(query, 0, config.maxEmails);
      const stats = this._processThreadBatch(threads, config);

      Logger.log(`Correos no leídos procesados: ${stats.processed} procesados, ${stats.labeled} etiquetados`);

      return stats;
    } catch (e) {
      Logger.log(`Error en processUnreadEmails: ${e.toString()}`);
      return {
        error: e.toString()
      };
    }
  }

  /**
   * @description Limpia la caché del procesador.
   */
  clearCache() {
    this.labelManager.clearCache();
  }
}

// Funciones públicas para mantener compatibilidad con Code.gs

/**
 * @description Procesa correos electrónicos.
 * @returns {Object} Estadísticas del procesamiento
 */
function processEmails() {
  const processor = new EmailProcessor();
  return processor.processEmailsWithStats();
}

/**
 * @description Obtiene vista previa del procesamiento.
 * @param {Number} limit - Límite de correos a previsualizar
 * @returns {Object} Vista previa
 */
function previewProcessing(limit) {
  const processor = new EmailProcessor();
  return processor.previewProcessing(limit);
}

/**
 * @description Procesa correos no leídos.
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
