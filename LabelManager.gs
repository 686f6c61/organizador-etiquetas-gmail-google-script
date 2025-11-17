/**
 * @file LabelManager.gs
 * @description Módulo para la gestión centralizada de etiquetas de Gmail.
 *              Incluye caché de etiquetas y sanitización de nombres.
 * @author 686f6c61
 * @version 0.4
 * @date 2025-11-17
 */

/**
 * @description Gestor de etiquetas de Gmail con caché y validación.
 */
class LabelManager {
  constructor() {
    if (LabelManager.instance) {
      return LabelManager.instance;
    }
    this.labelCache = new Map();
    this.configManager = new ConfigManager();
    LabelManager.instance = this;
  }

  /**
   * @description Limpia el caché de etiquetas.
   */
  clearCache() {
    this.labelCache.clear();
  }

  /**
   * @description Extrae el dominio de una dirección de correo electrónico.
   * @param {String} email - Dirección de correo electrónico
   * @returns {String|null} Dominio en minúsculas o null si es inválido
   */
  extractDomain(email) {
    if (!email || typeof email !== 'string') {
      return null;
    }

    // Regex más robusto para extraer email
    const emailRegex = /<([^>]+)>|([^\s<>]+@[^\s<>]+)/;
    const match = email.match(emailRegex);

    let emailAddress = null;
    if (match) {
      emailAddress = match[1] || match[2];
    }

    if (!emailAddress) {
      return null;
    }

    // Extraer dominio
    const domainMatch = emailAddress.match(/@(.+)$/);
    if (domainMatch && domainMatch[1]) {
      const domain = domainMatch[1].toLowerCase().trim();
      return this._isValidDomain(domain) ? domain : null;
    }

    return null;
  }

  /**
   * @description Valida si un dominio es válido.
   * @private
   * @param {String} domain - Dominio a validar
   * @returns {Boolean} true si es válido
   */
  _isValidDomain(domain) {
    if (!domain || domain.length > 253) return false;
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  /**
   * @description Determina el nombre de la etiqueta a partir de un dominio.
   * @param {String} domain - Dominio del correo
   * @param {Object} config - Configuración actual
   * @returns {String|null} Nombre de la etiqueta o null si no se debe etiquetar
   */
  getLabelName(domain, config) {
    if (!domain) return null;

    // Si está en dominios genéricos, usar etiqueta "generico"
    if (config.genericDomains && config.genericDomains.includes(domain)) {
      return 'generico';
    }

    let domainParts = domain.split('.');

    // Si está activada la opción de evitar subdominios
    if (config.avoidSubdomains && domainParts.length > 2) {
      // Obtener el primer subdominio
      const firstSubdomain = domainParts[0];

      // Si tenemos una lista de subdominios a ignorar
      if (config.ignoredSubdomains && Array.isArray(config.ignoredSubdomains)) {
        if (config.ignoredSubdomains.includes(firstSubdomain)) {
          // Quitar el primer subdominio
          domainParts = domainParts.slice(1);
        }
      } else {
        // Comportamiento antiguo: tomar solo las dos últimas partes
        domainParts = domainParts.slice(-2);
      }
    }

    // Extraer la parte principal del dominio
    const mainDomain = domainParts[0];
    return this._sanitizeLabelName(mainDomain);
  }

  /**
   * @description Sanitiza el nombre de una etiqueta para que sea válido en Gmail.
   * @private
   * @param {String} labelName - Nombre a sanitizar
   * @returns {String|null} Nombre sanitizado o null si es inválido
   */
  _sanitizeLabelName(labelName) {
    if (!labelName) return null;

    // Eliminar caracteres no permitidos y espacios al inicio/final
    let sanitized = labelName
      .replace(/[<>()[\]{}\\|;:,?*&^%$#@!+=]/g, '')
      .trim();

    // Limitar longitud (Gmail tiene límite de ~225 caracteres)
    if (sanitized.length > 225) {
      sanitized = sanitized.substring(0, 225);
    }

    return sanitized.length > 0 ? sanitized : null;
  }

  /**
   * @description Obtiene o crea una etiqueta de Gmail.
   * @param {String} labelName - Nombre de la etiqueta
   * @returns {GmailLabel|null} Objeto de etiqueta o null en caso de error
   */
  getOrCreateLabel(labelName) {
    if (!labelName) return null;

    try {
      // Verificar caché primero
      if (this.labelCache.has(labelName)) {
        return this.labelCache.get(labelName);
      }

      // Buscar etiqueta existente
      let label = GmailApp.getUserLabelByName(labelName);

      // Crear si no existe
      if (!label) {
        label = GmailApp.createLabel(labelName);
        Logger.log(`Etiqueta creada: ${labelName}`);
      }

      // Guardar en caché
      this.labelCache.set(labelName, label);

      return label;
    } catch (e) {
      Logger.log(`Error al crear/obtener etiqueta '${labelName}': ${e.toString()}`);
      return null;
    }
  }

  /**
   * @description Aplica una etiqueta a un hilo si no la tiene ya.
   * @param {GmailThread} thread - Hilo de Gmail
   * @param {String} labelName - Nombre de la etiqueta
   * @returns {Boolean} true si se aplicó la etiqueta, false si ya la tenía o hubo error
   */
  applyLabelToThread(thread, labelName) {
    if (!thread || !labelName) return false;

    try {
      const label = this.getOrCreateLabel(labelName);
      if (!label) return false;

      // Verificar si el hilo ya tiene la etiqueta
      const existingLabels = thread.getLabels();
      const hasLabel = existingLabels.some(l => l.getName() === labelName);

      if (!hasLabel) {
        label.addToThread(thread);
        return true;
      }

      return false;
    } catch (e) {
      Logger.log(`Error al aplicar etiqueta '${labelName}' al hilo: ${e.toString()}`);
      return false;
    }
  }

  /**
   * @description Aplica etiquetas a múltiples hilos de manera eficiente.
   * @param {Array<{thread: GmailThread, labelName: String}>} threadLabelPairs - Array de pares hilo-etiqueta
   * @returns {Object} { applied: number, skipped: number, errors: number }
   */
  applyLabelsToThreads(threadLabelPairs) {
    const stats = {
      applied: 0,
      skipped: 0,
      errors: 0
    };

    if (!Array.isArray(threadLabelPairs) || threadLabelPairs.length === 0) {
      return stats;
    }

    // Agrupar por etiqueta para procesamiento por lotes
    const labelGroups = new Map();

    threadLabelPairs.forEach(pair => {
      if (!pair.thread || !pair.labelName) {
        stats.errors++;
        return;
      }

      if (!labelGroups.has(pair.labelName)) {
        labelGroups.set(pair.labelName, []);
      }
      labelGroups.get(pair.labelName).push(pair.thread);
    });

    // Procesar cada grupo de etiquetas
    labelGroups.forEach((threads, labelName) => {
      try {
        const label = this.getOrCreateLabel(labelName);
        if (!label) {
          stats.errors += threads.length;
          return;
        }

        threads.forEach(thread => {
          try {
            const existingLabels = thread.getLabels();
            const hasLabel = existingLabels.some(l => l.getName() === labelName);

            if (!hasLabel) {
              label.addToThread(thread);
              stats.applied++;
            } else {
              stats.skipped++;
            }
          } catch (e) {
            Logger.log(`Error al procesar hilo: ${e.toString()}`);
            stats.errors++;
          }
        });
      } catch (e) {
        Logger.log(`Error al procesar grupo de etiquetas '${labelName}': ${e.toString()}`);
        stats.errors += threads.length;
      }
    });

    return stats;
  }

  /**
   * @description Obtiene todas las etiquetas del usuario.
   * @returns {Array<GmailLabel>} Array de etiquetas
   */
  getAllLabels() {
    try {
      return GmailApp.getUserLabels();
    } catch (e) {
      Logger.log(`Error al obtener etiquetas: ${e.toString()}`);
      return [];
    }
  }

  /**
   * @description Obtiene estadísticas de las etiquetas creadas por el script.
   * @returns {Object} Estadísticas de etiquetas
   */
  getLabelStats() {
    try {
      const allLabels = this.getAllLabels();
      const stats = {
        total: allLabels.length,
        cached: this.labelCache.size,
        labels: allLabels.map(label => ({
          name: label.getName(),
          threadCount: label.getThreads().length,
          unreadCount: label.getUnreadCount()
        }))
      };
      return stats;
    } catch (e) {
      Logger.log(`Error al obtener estadísticas de etiquetas: ${e.toString()}`);
      return { total: 0, cached: 0, labels: [] };
    }
  }
}

// Funciones públicas para mantener compatibilidad con Code.gs

/**
 * @description Extrae el dominio de un email.
 * @param {String} email - Email a procesar
 * @returns {String} Dominio extraído
 */
function extractDomain(email) {
  const labelManager = new LabelManager();
  return labelManager.extractDomain(email);
}

/**
 * @description Obtiene el nombre de etiqueta para un dominio.
 * @param {String} domain - Dominio
 * @param {Array<String>} genericDomains - Lista de dominios genéricos
 * @param {Boolean} avoidSubdomains - Si se deben evitar subdominios
 * @returns {String|null} Nombre de la etiqueta
 */
function getLabelName(domain, genericDomains, avoidSubdomains) {
  const labelManager = new LabelManager();
  const config = {
    genericDomains: genericDomains,
    avoidSubdomains: avoidSubdomains,
    ignoredSubdomains: getConfig().ignoredSubdomains
  };
  return labelManager.getLabelName(domain, config);
}

/**
 * @description Obtiene o crea una etiqueta.
 * @param {String} labelName - Nombre de la etiqueta
 * @returns {GmailLabel|null} Etiqueta
 */
function getOrCreateLabel(labelName) {
  const labelManager = new LabelManager();
  return labelManager.getOrCreateLabel(labelName);
}
