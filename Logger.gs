/**
 * @file Logger.gs
 * @description Sistema de logging estructurado con niveles y persistencia opcional.
 * @author 686f6c61
 * @version 0.4
 * @date 2025-11-17
 */

/**
 * @description Niveles de logging
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

/**
 * @description Sistema de logging mejorado
 */
class AppLogger {
  constructor() {
    if (AppLogger.instance) {
      return AppLogger.instance;
    }
    this.currentLevel = LogLevel.INFO;
    this.enableConsole = true;
    this.enableProperties = false;
    this.maxLogEntries = 100;
    AppLogger.instance = this;
  }

  /**
   * @description Establece el nivel de logging
   * @param {Number} level - Nivel de logging
   */
  setLevel(level) {
    this.currentLevel = level;
  }

  /**
   * @description Habilita o deshabilita logging en consola
   * @param {Boolean} enabled - true para habilitar
   */
  setConsoleLogging(enabled) {
    this.enableConsole = enabled;
  }

  /**
   * @description Habilita o deshabilita persistencia de logs
   * @param {Boolean} enabled - true para habilitar
   */
  setPersistentLogging(enabled) {
    this.enableProperties = enabled;
  }

  /**
   * @description Formatea un mensaje de log
   * @private
   * @param {String} level - Nivel del log
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   * @returns {String} Mensaje formateado
   */
  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;

    if (data && Object.keys(data).length > 0) {
      formatted += ` | Data: ${JSON.stringify(data)}`;
    }

    return formatted;
  }

  /**
   * @description Registra un mensaje
   * @private
   * @param {Number} level - Nivel numérico
   * @param {String} levelName - Nombre del nivel
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   */
  _log(level, levelName, message, data = {}) {
    if (level < this.currentLevel) return;

    const formatted = this._formatMessage(levelName, message, data);

    // Log a consola (usando Logger de Apps Script)
    if (this.enableConsole) {
      Logger.log(formatted);
    }

    // Log persistente
    if (this.enableProperties) {
      this._persistLog(formatted);
    }
  }

  /**
   * @description Persiste un log en PropertiesService
   * @private
   * @param {String} message - Mensaje a persistir
   */
  _persistLog(message) {
    try {
      const properties = PropertiesService.getUserProperties();
      const logsJson = properties.getProperty('appLogs') || '[]';
      let logs = JSON.parse(logsJson);

      logs.push(message);

      // Mantener solo los últimos N logs
      if (logs.length > this.maxLogEntries) {
        logs = logs.slice(-this.maxLogEntries);
      }

      properties.setProperty('appLogs', JSON.stringify(logs));
    } catch (e) {
      // Si falla la persistencia, solo loguear a consola
      Logger.log('Error al persistir log: ' + e.toString());
    }
  }

  /**
   * @description Log de nivel DEBUG
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   */
  debug(message, data) {
    this._log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  /**
   * @description Log de nivel INFO
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   */
  info(message, data) {
    this._log(LogLevel.INFO, 'INFO', message, data);
  }

  /**
   * @description Log de nivel WARN
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   */
  warn(message, data) {
    this._log(LogLevel.WARN, 'WARN', message, data);
  }

  /**
   * @description Log de nivel ERROR
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   */
  error(message, data) {
    this._log(LogLevel.ERROR, 'ERROR', message, data);
  }

  /**
   * @description Log de nivel CRITICAL
   * @param {String} message - Mensaje
   * @param {Object} data - Datos adicionales
   */
  critical(message, data) {
    this._log(LogLevel.CRITICAL, 'CRITICAL', message, data);
  }

  /**
   * @description Obtiene los logs persistidos
   * @returns {Array<String>} Array de logs
   */
  getLogs() {
    try {
      const properties = PropertiesService.getUserProperties();
      const logsJson = properties.getProperty('appLogs') || '[]';
      return JSON.parse(logsJson);
    } catch (e) {
      Logger.log('Error al obtener logs: ' + e.toString());
      return [];
    }
  }

  /**
   * @description Limpia los logs persistidos
   */
  clearLogs() {
    try {
      const properties = PropertiesService.getUserProperties();
      properties.deleteProperty('appLogs');
      Logger.log('Logs eliminados correctamente');
    } catch (e) {
      Logger.log('Error al limpiar logs: ' + e.toString());
    }
  }

  /**
   * @description Exporta logs a texto
   * @returns {String} Logs en formato texto
   */
  exportLogsToText() {
    const logs = this.getLogs();
    return logs.join('\n');
  }
}

// Funciones globales de utilidad

/**
 * @description Obtiene la instancia del logger
 * @returns {AppLogger} Instancia del logger
 */
function getLogger() {
  return new AppLogger();
}

/**
 * @description Función de utilidad para logging rápido
 * @param {String} message - Mensaje
 * @param {String} level - Nivel (debug, info, warn, error, critical)
 * @param {Object} data - Datos adicionales
 */
function log(message, level = 'info', data = {}) {
  const logger = getLogger();

  switch(level.toLowerCase()) {
    case 'debug':
      logger.debug(message, data);
      break;
    case 'info':
      logger.info(message, data);
      break;
    case 'warn':
      logger.warn(message, data);
      break;
    case 'error':
      logger.error(message, data);
      break;
    case 'critical':
      logger.critical(message, data);
      break;
    default:
      logger.info(message, data);
  }
}

/**
 * @description Obtiene todos los logs
 * @returns {Array<String>} Logs
 */
function getAppLogs() {
  const logger = getLogger();
  return logger.getLogs();
}

/**
 * @description Limpia los logs
 */
function clearAppLogs() {
  const logger = getLogger();
  logger.clearLogs();
}
