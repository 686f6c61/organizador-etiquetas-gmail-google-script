/**
 * @file Statistics.gs
 * @description Modulo para la gestion de estadisticas de procesamiento de correos.
 *              Incluye funciones para obtener, actualizar, limpiar y exportar a CSV.
 *              Las estadisticas por dominio se limitan a MAX_DOMAIN_STATS entradas
 *              para no exceder el limite de 9 KB por propiedad de PropertiesService.
 * @author 686f6c61
 * @version 0.5
 * @date 2025-11-17
 */

// --- Constantes ---
const PROP_TOTAL_PROCESSED = 'totalProcessed';
const PROP_TOTAL_LABELED = 'totalLabeled';
const PROP_DOMAIN_STATS = 'domainStats';
const PROP_LAST_RUN = 'lastRun';
const PROP_TOTAL_ERRORS = 'totalErrors';
const PROP_FIRST_RUN = 'firstRun';

/**
 * Limite maximo de dominios almacenados en estadisticas.
 * PropertiesService tiene un tope de 9 KB por propiedad; con ~500 dominios
 * el JSON ocupa aproximadamente 7-8 KB, dejando margen de seguridad.
 */
const MAX_DOMAIN_STATS = 500;

/**
 * @description Obtiene las estadisticas acumuladas desde PropertiesService.
 * @returns {Object} Estadisticas con totales, dominios y fechas
 */
function getStats() {
  try {
    const properties = PropertiesService.getUserProperties();

    const totalProcessed = parseInt(properties.getProperty(PROP_TOTAL_PROCESSED) || '0');
    const totalLabeled = parseInt(properties.getProperty(PROP_TOTAL_LABELED) || '0');
    const totalErrors = parseInt(properties.getProperty(PROP_TOTAL_ERRORS) || '0');
    const lastRun = properties.getProperty(PROP_LAST_RUN) || null;
    const firstRun = properties.getProperty(PROP_FIRST_RUN) || null;

    let domainStats = {};
    try {
      const domainStatsJson = properties.getProperty(PROP_DOMAIN_STATS);
      if (domainStatsJson) {
        domainStats = JSON.parse(domainStatsJson);
      }
    } catch (e) {
      Logger.log('Error al parsear estadisticas de dominios: ' + e.toString());
    }

    return {
      totalProcessed: totalProcessed,
      totalLabeled: totalLabeled,
      totalErrors: totalErrors,
      domainStats: domainStats,
      lastRun: lastRun,
      firstRun: firstRun
    };
  } catch (e) {
    Logger.log('Error al obtener estadisticas: ' + e.toString());
    return {
      totalProcessed: 0,
      totalLabeled: 0,
      totalErrors: 0,
      domainStats: {},
      lastRun: null,
      firstRun: null,
      error: e.toString()
    };
  }
}

/**
 * @description Recorta el mapa de dominios para que no exceda el limite.
 *              Conserva los dominios con mas correos y descarta los menos frecuentes.
 * @private
 * @param {Object} domainStats - Mapa dominio -> cantidad
 * @returns {Object} Mapa recortado
 */
function _trimDomainStats(domainStats) {
  const keys = Object.keys(domainStats);
  if (keys.length <= MAX_DOMAIN_STATS) return domainStats;

  // Ordenar por cantidad descendente y quedarse con los mas frecuentes
  const sorted = keys.sort((a, b) => domainStats[b] - domainStats[a]);
  const trimmed = {};
  for (let i = 0; i < MAX_DOMAIN_STATS; i++) {
    trimmed[sorted[i]] = domainStats[sorted[i]];
  }

  Logger.log('Estadisticas de dominios recortadas: ' + keys.length +
    ' -> ' + MAX_DOMAIN_STATS);
  return trimmed;
}

/**
 * @description Actualiza las estadisticas acumuladas con los resultados de un procesamiento.
 * @param {Object} stats - Estadisticas del procesamiento reciente
 * @returns {boolean} true si la actualizacion fue exitosa
 */
function updateStats(stats) {
  try {
    const properties = PropertiesService.getUserProperties();
    const currentStats = getStats();

    const newTotalProcessed = currentStats.totalProcessed + (stats.processed || 0);
    const newTotalLabeled = currentStats.totalLabeled + (stats.labeled || 0);
    const newTotalErrors = currentStats.totalErrors + (stats.errors || 0);

    // Fusionar estadisticas por dominio
    const domainStats = currentStats.domainStats || {};

    if (stats.domains && typeof stats.domains === 'object') {
      for (const domain in stats.domains) {
        if (!domainStats[domain]) {
          domainStats[domain] = 0;
        }
        domainStats[domain] += stats.domains[domain];
      }
    }

    // Recortar si excede el limite para no reventar PropertiesService
    const trimmedDomainStats = _trimDomainStats(domainStats);

    const now = new Date().toISOString();
    const firstRun = currentStats.firstRun || now;

    properties.setProperty(PROP_TOTAL_PROCESSED, newTotalProcessed.toString());
    properties.setProperty(PROP_TOTAL_LABELED, newTotalLabeled.toString());
    properties.setProperty(PROP_TOTAL_ERRORS, newTotalErrors.toString());
    properties.setProperty(PROP_DOMAIN_STATS, JSON.stringify(trimmedDomainStats));
    properties.setProperty(PROP_LAST_RUN, now);
    properties.setProperty(PROP_FIRST_RUN, firstRun);

    Logger.log('Estadisticas actualizadas: ' + newTotalProcessed +
      ' procesados, ' + newTotalLabeled + ' etiquetados, ' + newTotalErrors + ' errores');

    return true;
  } catch (e) {
    Logger.log('Error al actualizar estadisticas: ' + e.toString());
    return false;
  }
}

/**
 * @description Elimina todas las estadisticas guardadas.
 * @returns {boolean} true si la limpieza fue exitosa
 */
function clearStats() {
  try {
    const properties = PropertiesService.getUserProperties();

    properties.deleteProperty(PROP_TOTAL_PROCESSED);
    properties.deleteProperty(PROP_TOTAL_LABELED);
    properties.deleteProperty(PROP_TOTAL_ERRORS);
    properties.deleteProperty(PROP_DOMAIN_STATS);
    properties.deleteProperty(PROP_LAST_RUN);
    properties.deleteProperty(PROP_FIRST_RUN);

    Logger.log('Estadisticas eliminadas correctamente');
    return true;
  } catch (e) {
    Logger.log('Error al limpiar estadisticas: ' + e.toString());
    return false;
  }
}

/**
 * @description Exporta las estadisticas de dominios a un archivo CSV en Google Drive.
 * @param {boolean} publicAccess - true para enlace publico, false para privado
 * @returns {string|null} URL del archivo CSV o null en caso de error
 */
function exportStatsToCSV(publicAccess) {
  publicAccess = publicAccess || false;

  try {
    const stats = getStats();

    if (!stats.domainStats || Object.keys(stats.domainStats).length === 0) {
      Logger.log('No hay estadisticas de dominios para exportar');
      return null;
    }

    let csvContent = 'Dominio,Cantidad de correos\n';

    const sortedDomains = Object.keys(stats.domainStats).sort((a, b) => {
      return stats.domainStats[b] - stats.domainStats[a];
    });

    sortedDomains.forEach(domain => {
      // Escapar comas y comillas en el nombre del dominio
      const escaped = domain.includes(',') || domain.includes('"')
        ? '"' + domain.replace(/"/g, '""') + '"'
        : domain;
      csvContent += escaped + ',' + stats.domainStats[domain] + '\n';
    });

    csvContent += '\n';
    csvContent += 'Total procesados,' + stats.totalProcessed + '\n';
    csvContent += 'Total etiquetados,' + stats.totalLabeled + '\n';
    csvContent += 'Total errores,' + stats.totalErrors + '\n';
    csvContent += 'Primera ejecucion,' + (stats.firstRun || 'N/A') + '\n';
    csvContent += 'Ultima ejecucion,' + (stats.lastRun || 'N/A') + '\n';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = 'OEG_Estadisticas_' + timestamp + '.csv';
    const file = DriveApp.createFile(fileName, csvContent, MimeType.CSV);

    if (publicAccess) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } else {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
    }

    Logger.log('Archivo CSV exportado: ' + fileName);
    return file.getUrl();
  } catch (e) {
    Logger.log('Error al exportar estadisticas: ' + e.toString());
    return null;
  }
}

/**
 * @description Obtiene un resumen compacto de las estadisticas.
 * @returns {Object|null} Resumen con totales, dominios unicos y top 5
 */
function getStatsSummary() {
  try {
    const stats = getStats();

    const domainCount = Object.keys(stats.domainStats || {}).length;
    const topDomains = Object.keys(stats.domainStats || {})
      .sort((a, b) => stats.domainStats[b] - stats.domainStats[a])
      .slice(0, 5)
      .map(domain => ({
        domain: domain,
        count: stats.domainStats[domain]
      }));

    return {
      totalProcessed: stats.totalProcessed,
      totalLabeled: stats.totalLabeled,
      totalErrors: stats.totalErrors,
      uniqueDomains: domainCount,
      topDomains: topDomains,
      lastRun: stats.lastRun,
      firstRun: stats.firstRun
    };
  } catch (e) {
    Logger.log('Error al obtener resumen de estadisticas: ' + e.toString());
    return null;
  }
}
