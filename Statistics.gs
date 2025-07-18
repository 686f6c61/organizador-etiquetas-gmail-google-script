/**
 * @file Statistics.gs
 * @description Módulo para la gestión de estadísticas de procesamiento de correos.
 *              Incluye funciones para obtener, actualizar, limpiar y exportar estadísticas.
 */

// --- Constantes Globales de Propiedades de Estadísticas ---
const PROP_TOTAL_PROCESSED = 'totalProcessed';
const PROP_TOTAL_LABELED = 'totalLabeled';
const PROP_DOMAIN_STATS = 'domainStats';
const PROP_LAST_RUN = 'lastRun';

/**
 * @description Obtiene las estadísticas acumuladas desde `PropertiesService`.
 * @returns {Object} Un objeto con las estadísticas (total procesado, total etiquetado, etc.).
 */
function getStats() {
  const properties = PropertiesService.getUserProperties();
  
  // Obtener estadísticas o valores predeterminados
  const totalProcessed = parseInt(properties.getProperty(PROP_TOTAL_PROCESSED) || '0');
  const totalLabeled = parseInt(properties.getProperty(PROP_TOTAL_LABELED) || '0');
  const lastRun = properties.getProperty(PROP_LAST_RUN) || null;
  
  // Obtener estadísticas por dominio
  let domainStats = {};
  try {
    const domainStatsJson = properties.getProperty(PROP_DOMAIN_STATS);
    if (domainStatsJson) {
      domainStats = JSON.parse(domainStatsJson);
    }
  } catch (e) {
    console.error('Error al parsear estadísticas de dominios: ' + e.toString());
  }
  
  return {
    totalProcessed: totalProcessed,
    totalLabeled: totalLabeled,
    domainStats: domainStats,
    lastRun: lastRun
  };
}

/**
 * @description Actualiza las estadísticas acumuladas con los resultados de un nuevo procesamiento.
 * @param {Object} stats - Estadísticas del procesamiento más reciente.
 * @returns {Boolean} `true` si la actualización fue exitosa, `false` en caso de error.
 */
function updateStats(stats) {
  try {
    const properties = PropertiesService.getUserProperties();
    const currentStats = getStats();
    
    // Actualizar totales
    const newTotalProcessed = currentStats.totalProcessed + stats.processed;
    const newTotalLabeled = currentStats.totalLabeled + stats.labeled;
    
    // Actualizar estadísticas por dominio
    const domainStats = currentStats.domainStats || {};
    
    for (const domain in stats.domains) {
      if (!domainStats[domain]) {
        domainStats[domain] = 0;
      }
      domainStats[domain] += stats.domains[domain];
    }
    
    // Actualizar fecha de última ejecución
    const lastRun = new Date().toISOString();
    
    // Guardar estadísticas actualizadas
    properties.setProperty(PROP_TOTAL_PROCESSED, newTotalProcessed.toString());
    properties.setProperty(PROP_TOTAL_LABELED, newTotalLabeled.toString());
    properties.setProperty(PROP_DOMAIN_STATS, JSON.stringify(domainStats));
    properties.setProperty(PROP_LAST_RUN, lastRun);
    
    return true;
  } catch (e) {
    console.error('Error al actualizar estadísticas: ' + e.toString());
    return false;
  }
}

/**
 * @description Elimina todas las estadísticas guardadas de `PropertiesService`.
 * @returns {Boolean} `true` si la limpieza fue exitosa, `false` en caso de error.
 */
function clearStats() {
  try {
    const properties = PropertiesService.getUserProperties();
    
    properties.deleteProperty(PROP_TOTAL_PROCESSED);
    properties.deleteProperty(PROP_TOTAL_LABELED);
    properties.deleteProperty(PROP_DOMAIN_STATS);
    properties.deleteProperty(PROP_LAST_RUN);
    
    return true;
  } catch (e) {
    console.error('Error al limpiar estadísticas: ' + e.toString());
    return false;
  }
}

/**
 * @description Exporta las estadísticas de dominios a un archivo CSV en Google Drive.
 * @returns {String|null} La URL pública del archivo CSV creado, o `null` en caso de error.
 */
function exportStatsToCSV() {
  try {
    const stats = getStats();
    
    // Crear contenido del CSV
    let csvContent = 'Dominio,Cantidad\n';
    
    for (const domain in stats.domainStats) {
      csvContent += `${domain},${stats.domainStats[domain]}\n`;
    }
    
    // Crear archivo en Google Drive
    const fileName = `OEG_Estadisticas_${new Date().toISOString().split('T')[0]}.csv`;
    const file = DriveApp.createFile(fileName, csvContent, MimeType.CSV);
    
    // Configurar permisos para que cualquiera con el enlace pueda ver
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    console.error('Error al exportar estadísticas: ' + e.toString());
    return null;
  }
}
