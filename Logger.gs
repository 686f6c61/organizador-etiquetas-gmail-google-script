/**
 * @file Logger.gs
 * @description Utilidades de logging para depuracion y persistencia opcional.
 *
 *              El script usa Logger.log() nativo de Apps Script para la operativa
 *              diaria. Este modulo ofrece funciones adicionales para guardar logs
 *              en PropertiesService (util para diagnosticar ejecuciones automaticas
 *              donde la consola no es accesible).
 *
 * @author 686f6c61
 * @version 0.5
 * @date 2025-11-17
 */

/** Limite de entradas persistidas para no saturar PropertiesService. */
const MAX_PERSISTED_LOGS = 100;
const PROP_APP_LOGS = 'appLogs';

/**
 * @description Guarda un mensaje de log en PropertiesService para revision posterior.
 *              Util cuando el script se ejecuta por trigger y no hay consola visible.
 * @param {string} message - Mensaje a persistir
 * @param {string} level - Nivel: 'INFO', 'WARN', 'ERROR'
 */
function persistLog(message, level) {
  level = level || 'INFO';

  try {
    const properties = PropertiesService.getUserProperties();
    const logsJson = properties.getProperty(PROP_APP_LOGS) || '[]';
    const logs = JSON.parse(logsJson);

    const entry = '[' + new Date().toISOString() + '] [' + level + '] ' + message;
    logs.push(entry);

    // Conservar solo las ultimas N entradas
    const trimmed = logs.length > MAX_PERSISTED_LOGS
      ? logs.slice(-MAX_PERSISTED_LOGS)
      : logs;

    properties.setProperty(PROP_APP_LOGS, JSON.stringify(trimmed));
  } catch (e) {
    Logger.log('Error al persistir log: ' + e.toString());
  }
}

/**
 * @description Obtiene los logs persistidos.
 * @returns {Array<string>} Array de entradas de log
 */
function getAppLogs() {
  try {
    const properties = PropertiesService.getUserProperties();
    return JSON.parse(properties.getProperty(PROP_APP_LOGS) || '[]');
  } catch (e) {
    Logger.log('Error al obtener logs: ' + e.toString());
    return [];
  }
}

/**
 * @description Limpia todos los logs persistidos.
 */
function clearAppLogs() {
  try {
    PropertiesService.getUserProperties().deleteProperty(PROP_APP_LOGS);
    Logger.log('Logs eliminados correctamente');
  } catch (e) {
    Logger.log('Error al limpiar logs: ' + e.toString());
  }
}
