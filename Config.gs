/**
 * @file Config.gs
 * @description Modulo centralizado para la gestion de configuracion del script.
 *              Incluye validacion, valores por defecto y migracion de versiones.
 * @author 686f6c61
 * @version 0.5
 * @date 2025-11-17
 */

// --- Constantes globales de propiedades ---
const PROP_GENERIC_DOMAINS = 'genericDomains';
const PROP_MAX_EMAILS = 'maxEmails';
const PROP_DAYS_BACK = 'daysBack';
const PROP_AUTO_PROCESS = 'autoProcess';
const PROP_PROCESS_HOUR = 'processHour';
const PROP_AVOID_SUBDOMAINS = 'avoidSubdomains';
const PROP_IGNORED_SUBDOMAINS = 'ignoredSubdomains';
const PROP_CONFIG_VERSION = 'configVersion';

const CONFIG_SCHEMA_VERSION = '1.1';

const DEFAULT_CONFIG = {
  genericDomains: [
    'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
    'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
    'zoho.com', 'yandex.com', 'gmx.com', 'live.com',
    'msn.com', 'me.com', 'mac.com'
  ],
  maxEmails: 100,
  daysBack: 7,
  autoProcess: false,
  processHour: 8,
  avoidSubdomains: true,
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

const VALIDATION_LIMITS = {
  maxEmails: { min: 10, max: 500 },
  processHour: { min: 0, max: 23 },
  daysBack: { min: -1, max: 365 },
  maxDomainLength: 253,
  maxLabelNameLength: 225
};

/**
 * Segundos niveles de dominio habituales en TLD de pais.
 * Permiten distinguir "example" en "example.co.uk" (SLD compuesto)
 * frente a "example" en "sub.example.com" (SLD simple).
 */
const COUNTRY_SLDS = [
  'co', 'com', 'net', 'org', 'edu', 'gov',
  'ac', 'go', 'gob', 'nic', 'or', 'ne'
];

/**
 * @description Valida si un dominio tiene formato correcto segun RFC.
 *              Funcion compartida por ConfigManager y LabelManager para evitar duplicacion.
 * @param {string} domain - Dominio a validar
 * @returns {boolean} true si el formato es valido
 */
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > VALIDATION_LIMITS.maxDomainLength) return false;
  return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(domain);
}

/**
 * @description Gestor centralizado de configuracion con validacion y migracion.
 */
class ConfigManager {
  constructor() {
    this.properties = PropertiesService.getUserProperties();
  }

  /**
   * @description Inicializa las propiedades con valores por defecto si no existen.
   *              Gestiona la migracion desde versiones anteriores.
   * @returns {boolean} true si se inicializo correctamente
   */
  initProperties() {
    try {
      const version = this.properties.getProperty(PROP_CONFIG_VERSION);

      if (!version) {
        this._setDefaultProperties();
        this.properties.setProperty(PROP_CONFIG_VERSION, CONFIG_SCHEMA_VERSION);
        Logger.log('Configuracion inicializada con valores por defecto');
        return true;
      }

      // Migracion 1.0 -> 1.1: avoidSubdomains pasa a true por defecto
      if (version === '1.0') {
        const current = this.properties.getProperty(PROP_AVOID_SUBDOMAINS);
        if (current === null) {
          this.properties.setProperty(PROP_AVOID_SUBDOMAINS, 'true');
        }
        this.properties.setProperty(PROP_CONFIG_VERSION, CONFIG_SCHEMA_VERSION);
        Logger.log('Migracion 1.0 -> 1.1 completada');
      }

      return true;
    } catch (e) {
      Logger.log('Error al inicializar propiedades: ' + e.toString());
      return false;
    }
  }

  /** @private */
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

  /** @private */
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
   * @description Obtiene la configuracion actual del script.
   * @returns {Object} Objeto con toda la configuracion
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
        // Por defecto true: si la propiedad no existe o no es "false", se activa
        avoidSubdomains: this.properties.getProperty(PROP_AVOID_SUBDOMAINS) !== 'false',
        ignoredSubdomains: JSON.parse(this.properties.getProperty(PROP_IGNORED_SUBDOMAINS) ||
          JSON.stringify(DEFAULT_CONFIG.ignoredSubdomains))
      };
    } catch (e) {
      Logger.log('Error al obtener configuracion: ' + e.toString());
      return DEFAULT_CONFIG;
    }
  }

  /**
   * @description Valida la configuracion proporcionada.
   * @param {Object} config - Configuracion a validar
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateConfig(config) {
    const errors = [];

    if (config.maxEmails < VALIDATION_LIMITS.maxEmails.min ||
        config.maxEmails > VALIDATION_LIMITS.maxEmails.max) {
      errors.push('maxEmails debe estar entre ' +
        VALIDATION_LIMITS.maxEmails.min + ' y ' + VALIDATION_LIMITS.maxEmails.max);
    }

    if (config.processHour < VALIDATION_LIMITS.processHour.min ||
        config.processHour > VALIDATION_LIMITS.processHour.max) {
      errors.push('processHour debe estar entre ' +
        VALIDATION_LIMITS.processHour.min + ' y ' + VALIDATION_LIMITS.processHour.max);
    }

    if (config.daysBack < VALIDATION_LIMITS.daysBack.min ||
        config.daysBack > VALIDATION_LIMITS.daysBack.max) {
      errors.push('daysBack debe estar entre ' +
        VALIDATION_LIMITS.daysBack.min + ' y ' + VALIDATION_LIMITS.daysBack.max);
    }

    if (!Array.isArray(config.genericDomains)) {
      errors.push('genericDomains debe ser un array');
    } else {
      config.genericDomains.forEach(domain => {
        if (!isValidDomain(domain)) {
          errors.push('Dominio invalido: ' + domain);
        }
      });
    }

    if (config.ignoredSubdomains && !Array.isArray(config.ignoredSubdomains)) {
      errors.push('ignoredSubdomains debe ser un array');
    }

    return { valid: errors.length === 0, errors: errors };
  }

  /**
   * @description Guarda la configuracion despues de validarla.
   * @param {Object} config - Configuracion a guardar
   * @returns {Object} { success: boolean, errors: string[] }
   */
  saveConfig(config) {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      this.properties.setProperty(PROP_GENERIC_DOMAINS, JSON.stringify(config.genericDomains));
      this.properties.setProperty(PROP_MAX_EMAILS, config.maxEmails.toString());
      this.properties.setProperty(PROP_DAYS_BACK, config.daysBack.toString());
      this.properties.setProperty(PROP_AUTO_PROCESS, config.autoProcess.toString());
      this.properties.setProperty(PROP_PROCESS_HOUR, config.processHour.toString());
      this.properties.setProperty(PROP_AVOID_SUBDOMAINS, config.avoidSubdomains.toString());

      if (config.ignoredSubdomains) {
        this.properties.setProperty(PROP_IGNORED_SUBDOMAINS, JSON.stringify(config.ignoredSubdomains));
      }

      Logger.log('Configuracion guardada correctamente');
      return { success: true, errors: [] };
    } catch (e) {
      Logger.log('Error al guardar configuracion: ' + e.toString());
      return { success: false, errors: [e.toString()] };
    }
  }

  /**
   * @description Resetea la configuracion a valores por defecto.
   * @returns {boolean} true si se reseteo correctamente
   */
  resetConfig() {
    try {
      Object.keys(DEFAULT_CONFIG).forEach(key => {
        this.properties.deleteProperty(this._getPropKey(key));
      });
      this._setDefaultProperties();
      Logger.log('Configuracion reseteada a valores por defecto');
      return true;
    } catch (e) {
      Logger.log('Error al resetear configuracion: ' + e.toString());
      return false;
    }
  }
}

// --- Funciones publicas ---

function initProperties() {
  return new ConfigManager().initProperties();
}

/**
 * @description Obtiene la configuracion actual.
 * @returns {Object} Configuracion actual
 */
function getConfig() {
  return new ConfigManager().getConfig();
}

/**
 * @description Guarda la configuracion y actualiza el trigger si procede.
 *              Devuelve el resultado completo con errores de validacion.
 * @param {Object} config - Configuracion a guardar
 * @returns {Object} { success: boolean, errors: string[] }
 */
function saveConfig(config) {
  const result = new ConfigManager().saveConfig(config);

  if (result.success) {
    updateTrigger(config.autoProcess, config.processHour);
  }

  return result;
}
