/**
 * @file Config.gs
 * @description Módulo centralizado para la gestión de configuración del script.
 *              Separa la lógica de configuración del resto del código.
 * @author 686f6c61
 * @version 0.4
 * @date 2025-11-17
 */

// --- Constantes Globales de Propiedades ---
const PROP_GENERIC_DOMAINS = 'genericDomains';
const PROP_MAX_EMAILS = 'maxEmails';
const PROP_DAYS_BACK = 'daysBack';
const PROP_AUTO_PROCESS = 'autoProcess';
const PROP_PROCESS_HOUR = 'processHour';
const PROP_AVOID_SUBDOMAINS = 'avoidSubdomains';
const PROP_IGNORED_SUBDOMAINS = 'ignoredSubdomains';
const PROP_CONFIG_VERSION = 'configVersion';

// Versión actual del esquema de configuración
const CONFIG_SCHEMA_VERSION = '1.0';

// Valores por defecto
const DEFAULT_CONFIG = {
  genericDomains: [
    'gmail.com',
    'outlook.com',
    'yahoo.com',
    'hotmail.com',
    'icloud.com',
    'aol.com',
    'protonmail.com',
    'mail.com',
    'zoho.com',
    'yandex.com',
    'gmx.com',
    'live.com',
    'msn.com',
    'me.com',
    'mac.com'
  ],
  maxEmails: 100,
  daysBack: 7,
  autoProcess: false,
  processHour: 8,
  avoidSubdomains: false,
  ignoredSubdomains: [
    'e', 'mail', 'info', 'news', 'noreply', 'no-reply', 'newsletter',
    'support', 'help', 'notify', 'notifications', 'alerts', 'email',
    'marketing', 'promo', 'promos', 'offers', 'deals', 'updates',
    'www', 'webmail', 'smtp', 'imap', 'pop', 'mx', 'mx1', 'mx2',
    'contact', 'hello', 'hi', 'welcome', 'team', 'admin',
    'accounts', 'account', 'billing', 'invoice', 'receipts',
    'customerservice', 'service', 'donotreply', 'bounce',
    'mailer', 'sender', 'system', 'automated', 'auto'
  ]
};

// Límites de validación
const VALIDATION_LIMITS = {
  maxEmails: { min: 10, max: 500 },
  processHour: { min: 0, max: 23 },
  daysBack: { min: -1, max: 365 },
  maxDomainLength: 253,
  maxLabelNameLength: 225
};

/**
 * @description Singleton para gestionar la configuración del script.
 */
class ConfigManager {
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    this.properties = PropertiesService.getUserProperties();
    ConfigManager.instance = this;
  }

  /**
   * @description Inicializa las propiedades con valores por defecto si no existen.
   *              También maneja la migración de versiones antiguas.
   * @returns {Boolean} true si se inicializó correctamente
   */
  initProperties() {
    try {
      const version = this.properties.getProperty(PROP_CONFIG_VERSION);

      // Si no hay versión, es una instalación nueva o antigua
      if (!version) {
        this._setDefaultProperties();
        this.properties.setProperty(PROP_CONFIG_VERSION, CONFIG_SCHEMA_VERSION);
        Logger.log('Configuración inicializada con valores por defecto');
        return true;
      }

      // Aquí se pueden añadir migraciones futuras
      // if (version < '2.0') { migrate(); }

      return true;
    } catch (e) {
      Logger.log('Error al inicializar propiedades: ' + e.toString());
      return false;
    }
  }

  /**
   * @description Establece los valores por defecto en las propiedades.
   * @private
   */
  _setDefaultProperties() {
    Object.keys(DEFAULT_CONFIG).forEach(key => {
      const propKey = this._getPropKey(key);
      if (!this.properties.getProperty(propKey)) {
        const value = DEFAULT_CONFIG[key];
        this.properties.setProperty(
          propKey,
          typeof value === 'object' ? JSON.stringify(value) : String(value)
        );
      }
    });
  }

  /**
   * @description Convierte el nombre de configuración a la clave de propiedad.
   * @private
   * @param {String} key - Nombre de la configuración
   * @returns {String} Clave de propiedad
   */
  _getPropKey(key) {
    const keyMap = {
      genericDomains: PROP_GENERIC_DOMAINS,
      maxEmails: PROP_MAX_EMAILS,
      daysBack: PROP_DAYS_BACK,
      autoProcess: PROP_AUTO_PROCESS,
      processHour: PROP_PROCESS_HOUR,
      avoidSubdomains: PROP_AVOID_SUBDOMAINS,
      ignoredSubdomains: PROP_IGNORED_SUBDOMAINS
    };
    return keyMap[key] || key;
  }

  /**
   * @description Obtiene la configuración actual del script.
   * @returns {Object} Objeto con toda la configuración
   */
  getConfig() {
    this.initProperties();

    try {
      return {
        genericDomains: JSON.parse(this.properties.getProperty(PROP_GENERIC_DOMAINS) || '[]'),
        maxEmails: parseInt(this.properties.getProperty(PROP_MAX_EMAILS) || '100'),
        daysBack: parseInt(this.properties.getProperty(PROP_DAYS_BACK) || '7'),
        autoProcess: this.properties.getProperty(PROP_AUTO_PROCESS) === 'true',
        processHour: parseInt(this.properties.getProperty(PROP_PROCESS_HOUR) || '8'),
        avoidSubdomains: this.properties.getProperty(PROP_AVOID_SUBDOMAINS) === 'true',
        ignoredSubdomains: JSON.parse(this.properties.getProperty(PROP_IGNORED_SUBDOMAINS) ||
          JSON.stringify(DEFAULT_CONFIG.ignoredSubdomains))
      };
    } catch (e) {
      Logger.log('Error al obtener configuración: ' + e.toString());
      return DEFAULT_CONFIG;
    }
  }

  /**
   * @description Valida la configuración proporcionada.
   * @param {Object} config - Configuración a validar
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateConfig(config) {
    const errors = [];

    // Validar maxEmails
    if (config.maxEmails < VALIDATION_LIMITS.maxEmails.min ||
        config.maxEmails > VALIDATION_LIMITS.maxEmails.max) {
      errors.push(`maxEmails debe estar entre ${VALIDATION_LIMITS.maxEmails.min} y ${VALIDATION_LIMITS.maxEmails.max}`);
    }

    // Validar processHour
    if (config.processHour < VALIDATION_LIMITS.processHour.min ||
        config.processHour > VALIDATION_LIMITS.processHour.max) {
      errors.push(`processHour debe estar entre ${VALIDATION_LIMITS.processHour.min} y ${VALIDATION_LIMITS.processHour.max}`);
    }

    // Validar daysBack
    if (config.daysBack < VALIDATION_LIMITS.daysBack.min ||
        config.daysBack > VALIDATION_LIMITS.daysBack.max) {
      errors.push(`daysBack debe estar entre ${VALIDATION_LIMITS.daysBack.min} y ${VALIDATION_LIMITS.daysBack.max}`);
    }

    // Validar genericDomains
    if (!Array.isArray(config.genericDomains)) {
      errors.push('genericDomains debe ser un array');
    } else {
      config.genericDomains.forEach(domain => {
        if (!this._isValidDomain(domain)) {
          errors.push(`Dominio inválido: ${domain}`);
        }
      });
    }

    // Validar ignoredSubdomains
    if (config.ignoredSubdomains && !Array.isArray(config.ignoredSubdomains)) {
      errors.push('ignoredSubdomains debe ser un array');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * @description Valida si un dominio es válido.
   * @private
   * @param {String} domain - Dominio a validar
   * @returns {Boolean} true si es válido
   */
  _isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    if (domain.length > VALIDATION_LIMITS.maxDomainLength) return false;

    // Regex básico para validar dominios
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  /**
   * @description Guarda la configuración después de validarla.
   * @param {Object} config - Configuración a guardar
   * @returns {Object} { success: boolean, errors: string[] }
   */
  saveConfig(config) {
    try {
      // Validar configuración
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Guardar propiedades
      this.properties.setProperty(PROP_GENERIC_DOMAINS, JSON.stringify(config.genericDomains));
      this.properties.setProperty(PROP_MAX_EMAILS, config.maxEmails.toString());
      this.properties.setProperty(PROP_DAYS_BACK, config.daysBack.toString());
      this.properties.setProperty(PROP_AUTO_PROCESS, config.autoProcess.toString());
      this.properties.setProperty(PROP_PROCESS_HOUR, config.processHour.toString());
      this.properties.setProperty(PROP_AVOID_SUBDOMAINS, config.avoidSubdomains.toString());

      if (config.ignoredSubdomains) {
        this.properties.setProperty(PROP_IGNORED_SUBDOMAINS, JSON.stringify(config.ignoredSubdomains));
      }

      Logger.log('Configuración guardada correctamente');
      return { success: true, errors: [] };
    } catch (e) {
      Logger.log('Error al guardar configuración: ' + e.toString());
      return { success: false, errors: [e.toString()] };
    }
  }

  /**
   * @description Resetea la configuración a valores por defecto.
   * @returns {Boolean} true si se reseteo correctamente
   */
  resetConfig() {
    try {
      Object.keys(DEFAULT_CONFIG).forEach(key => {
        const propKey = this._getPropKey(key);
        this.properties.deleteProperty(propKey);
      });
      this._setDefaultProperties();
      Logger.log('Configuración reseteada a valores por defecto');
      return true;
    } catch (e) {
      Logger.log('Error al resetear configuración: ' + e.toString());
      return false;
    }
  }
}

// Funciones públicas para mantener compatibilidad con Code.gs

/**
 * @description Inicializa las propiedades del script.
 */
function initProperties() {
  const configManager = new ConfigManager();
  return configManager.initProperties();
}

/**
 * @description Obtiene la configuración actual.
 * @returns {Object} Configuración actual
 */
function getConfig() {
  const configManager = new ConfigManager();
  return configManager.getConfig();
}

/**
 * @description Guarda la configuración.
 * @param {Object} config - Configuración a guardar
 * @returns {Boolean} true si se guardó correctamente
 */
function saveConfig(config) {
  const configManager = new ConfigManager();
  const result = configManager.saveConfig(config);

  if (result.success) {
    // Actualizar trigger si es necesario
    updateTrigger(config.autoProcess, config.processHour);
  }

  return result.success;
}
