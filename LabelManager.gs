/**
 * @file LabelManager.gs
 * @description Modulo para la gestion centralizada de etiquetas de Gmail.
 *              Extrae dominios de correo, determina el nombre de etiqueta correcto
 *              (con soporte para subdominios y TLD de pais) y aplica etiquetas a hilos.
 * @author 686f6c61
 * @version 0.5
 * @date 2025-11-17
 */

/**
 * @description Gestor de etiquetas de Gmail con cache en memoria y procesamiento por lotes.
 */
class LabelManager {
  constructor() {
    this.labelCache = new Map();
  }

  /**
   * @description Limpia el cache de etiquetas en memoria.
   */
  clearCache() {
    this.labelCache.clear();
  }

  /**
   * @description Extrae el dominio de una direccion de correo electronico.
   *              Acepta formatos como "Nombre <email@dominio.com>" o "email@dominio.com".
   * @param {string} email - Direccion de correo electronico
   * @returns {string|null} Dominio en minusculas o null si es invalido
   */
  extractDomain(email) {
    if (!email || typeof email !== 'string') return null;

    // Extraer la direccion de formatos con o sin angulos
    const emailRegex = /<([^>]+)>|([^\s<>]+@[^\s<>]+)/;
    const match = email.match(emailRegex);

    const emailAddress = match ? (match[1] || match[2]) : null;
    if (!emailAddress) return null;

    const domainMatch = emailAddress.match(/@(.+)$/);
    if (!domainMatch || !domainMatch[1]) return null;

    const domain = domainMatch[1].toLowerCase().trim();
    return isValidDomain(domain) ? domain : null;
  }

  /**
   * @description Determina el nombre de etiqueta a partir del dominio del remitente.
   *
   *              Logica de resolucion:
   *              1. Dominios genericos (gmail.com, etc.) -> etiqueta "generico".
   *              2. Dominios simples (example.com) -> primera parte ("example").
   *              3. Dominios con subdominios y avoidSubdomains activado:
   *                 extrae el dominio registrable desde la derecha, con deteccion
   *                 de TLD de pais (co.uk, com.br) via la constante COUNTRY_SLDS.
   *              4. Con avoidSubdomains desactivado: usa la primera parte tal cual
   *                 (comportamiento legacy).
   *
   * @example
   *   // avoidSubdomains = true
   *   getLabelName('newsletter.amazon.com', config)  // -> "amazon"
   *   getLabelName('shop.example.co.uk', config)     // -> "example"
   *   getLabelName('gmail.com', config)               // -> "generico"
   *
   * @param {string} domain - Dominio completo del correo
   * @param {Object} config - Configuracion actual del script
   * @returns {string|null} Nombre de la etiqueta o null si no se debe etiquetar
   */
  getLabelName(domain, config) {
    if (!domain) return null;

    // Dominios genericos van a la etiqueta "generico"
    if (config.genericDomains && config.genericDomains.includes(domain)) {
      return 'generico';
    }

    const domainParts = domain.split('.');

    // Dominio simple (example.com) -> "example"
    if (domainParts.length <= 2) {
      return this._sanitizeLabelName(domainParts[0]);
    }

    // Dominio con subdominios (sub.example.com, shop.example.co.uk)
    if (config.avoidSubdomains) {
      // Comprobamos si el penultimo segmento es un SLD de pais
      // (co en co.uk, com en com.br, org en org.au, etc.)
      const sld = domainParts[domainParts.length - 2];

      if (COUNTRY_SLDS.includes(sld) && domainParts.length >= 3) {
        // shop.example.co.uk -> indice length-3 = "example"
        // example.co.uk      -> indice length-3 = "example" (length=3)
        return this._sanitizeLabelName(domainParts[domainParts.length - 3]);
      }

      // Caso estandar: newsletter.amazon.com -> indice length-2 = "amazon"
      return this._sanitizeLabelName(domainParts[domainParts.length - 2]);
    }

    // Con avoidSubdomains desactivado: primera parte literal
    return this._sanitizeLabelName(domainParts[0]);
  }

  /**
   * @description Limpia el nombre de una etiqueta para que sea valido en Gmail.
   *              Elimina caracteres especiales y recorta a la longitud maxima.
   * @private
   * @param {string} labelName - Nombre sin sanitizar
   * @returns {string|null} Nombre limpio o null si queda vacio
   */
  _sanitizeLabelName(labelName) {
    if (!labelName) return null;

    let sanitized = labelName
      .replace(/[<>()[\]{}\\|;:,?*&^%$#@!+=]/g, '')
      .trim();

    if (sanitized.length > VALIDATION_LIMITS.maxLabelNameLength) {
      sanitized = sanitized.substring(0, VALIDATION_LIMITS.maxLabelNameLength);
    }

    return sanitized.length > 0 ? sanitized : null;
  }

  /**
   * @description Obtiene una etiqueta existente o la crea si no existe.
   *              Mantiene un cache en memoria para reducir llamadas a la API de Gmail.
   * @param {string} labelName - Nombre de la etiqueta
   * @returns {GmailLabel|null} Objeto de etiqueta o null en caso de error
   */
  getOrCreateLabel(labelName) {
    if (!labelName) return null;

    try {
      if (this.labelCache.has(labelName)) {
        return this.labelCache.get(labelName);
      }

      let label = GmailApp.getUserLabelByName(labelName);

      if (!label) {
        label = GmailApp.createLabel(labelName);
        Logger.log('Etiqueta creada: ' + labelName);
      }

      this.labelCache.set(labelName, label);
      return label;
    } catch (e) {
      Logger.log('Error al crear/obtener etiqueta "' + labelName + '": ' + e.toString());
      return null;
    }
  }

  /**
   * @description Aplica una etiqueta a un hilo si no la tiene ya.
   * @param {GmailThread} thread - Hilo de Gmail
   * @param {string} labelName - Nombre de la etiqueta
   * @returns {boolean} true si se aplico, false si ya la tenia o hubo error
   */
  applyLabelToThread(thread, labelName) {
    if (!thread || !labelName) return false;

    try {
      const label = this.getOrCreateLabel(labelName);
      if (!label) return false;

      const hasLabel = thread.getLabels().some(l => l.getName() === labelName);
      if (!hasLabel) {
        label.addToThread(thread);
        return true;
      }
      return false;
    } catch (e) {
      Logger.log('Error al aplicar etiqueta "' + labelName + '" al hilo: ' + e.toString());
      return false;
    }
  }

  /**
   * @description Aplica etiquetas a multiples hilos agrupando por nombre de etiqueta.
   *              Reduce las llamadas a getOrCreateLabel al procesar todos los hilos
   *              de una misma etiqueta de una vez.
   * @param {Array<{thread: GmailThread, labelName: string}>} threadLabelPairs
   * @returns {Object} { applied: number, skipped: number, errors: number }
   */
  applyLabelsToThreads(threadLabelPairs) {
    const stats = { applied: 0, skipped: 0, errors: 0 };

    if (!Array.isArray(threadLabelPairs) || threadLabelPairs.length === 0) {
      return stats;
    }

    // Agrupar hilos por etiqueta para minimizar llamadas a la API
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

    labelGroups.forEach((threads, labelName) => {
      try {
        const label = this.getOrCreateLabel(labelName);
        if (!label) {
          stats.errors += threads.length;
          return;
        }

        threads.forEach(thread => {
          try {
            const hasLabel = thread.getLabels().some(l => l.getName() === labelName);
            if (!hasLabel) {
              label.addToThread(thread);
              stats.applied++;
            } else {
              stats.skipped++;
            }
          } catch (e) {
            Logger.log('Error al procesar hilo: ' + e.toString());
            stats.errors++;
          }
        });
      } catch (e) {
        Logger.log('Error al procesar grupo "' + labelName + '": ' + e.toString());
        stats.errors += threads.length;
      }
    });

    return stats;
  }
}

// --- Funciones publicas para compatibilidad con Code.gs ---

function extractDomain(email) {
  return new LabelManager().extractDomain(email);
}

/**
 * @description Obtiene el nombre de etiqueta para un dominio.
 * @param {string} domain - Dominio
 * @param {Array<string>} genericDomains - Lista de dominios genericos
 * @param {boolean} avoidSubdomains - Si se deben resolver subdominios
 * @returns {string|null} Nombre de la etiqueta
 */
function getLabelName(domain, genericDomains, avoidSubdomains) {
  const config = {
    genericDomains: genericDomains,
    avoidSubdomains: avoidSubdomains,
    ignoredSubdomains: getConfig().ignoredSubdomains
  };
  return new LabelManager().getLabelName(domain, config);
}

function getOrCreateLabel(labelName) {
  return new LabelManager().getOrCreateLabel(labelName);
}
