/**
 * @file Statistics.gs
 * @description Módulo para la gestión de estadísticas de procesamiento de correos.
 *              Incluye funciones para obtener, actualizar, limpiar y exportar estadísticas.
 * @author 686f6c61
 * @version 0.4
 * @date 2025-11-17
 */

// --- Constantes Globales de Propiedades de Estadísticas ---
const PROP_TOTAL_PROCESSED = 'totalProcessed';
const PROP_TOTAL_LABELED = 'totalLabeled';
const PROP_DOMAIN_STATS = 'domainStats';
const PROP_LAST_RUN = 'lastRun';
const PROP_TOTAL_ERRORS = 'totalErrors';
const PROP_FIRST_RUN = 'firstRun';

/**
 * @description Obtiene las estadísticas acumuladas desde `PropertiesService`.
 * @returns {Object} Un objeto con las estadísticas (total procesado, total etiquetado, etc.).
 */
function getStats() {
  try {
    const properties = PropertiesService.getUserProperties();

    // Obtener estadísticas o valores predeterminados
    const totalProcessed = parseInt(properties.getProperty(PROP_TOTAL_PROCESSED) || '0');
    const totalLabeled = parseInt(properties.getProperty(PROP_TOTAL_LABELED) || '0');
    const totalErrors = parseInt(properties.getProperty(PROP_TOTAL_ERRORS) || '0');
    const lastRun = properties.getProperty(PROP_LAST_RUN) || null;
    const firstRun = properties.getProperty(PROP_FIRST_RUN) || null;

    // Obtener estadísticas por dominio
    let domainStats = {};
    try {
      const domainStatsJson = properties.getProperty(PROP_DOMAIN_STATS);
      if (domainStatsJson) {
        domainStats = JSON.parse(domainStatsJson);
      }
    } catch (e) {
      Logger.log('Error al parsear estadísticas de dominios: ' + e.toString());
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
    Logger.log('Error al obtener estadísticas: ' + e.toString());
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
 * @description Actualiza las estadísticas acumuladas con los resultados de un nuevo procesamiento.
 * @param {Object} stats - Estadísticas del procesamiento más reciente.
 * @returns {Boolean} `true` si la actualización fue exitosa, `false` en caso de error.
 */
function updateStats(stats) {
  try {
    const properties = PropertiesService.getUserProperties();
    const currentStats = getStats();

    // Actualizar totales
    const newTotalProcessed = currentStats.totalProcessed + (stats.processed || 0);
    const newTotalLabeled = currentStats.totalLabeled + (stats.labeled || 0);
    const newTotalErrors = currentStats.totalErrors + (stats.errors || 0);

    // Actualizar estadísticas por dominio
    const domainStats = currentStats.domainStats || {};

    if (stats.domains && typeof stats.domains === 'object') {
      for (const domain in stats.domains) {
        if (!domainStats[domain]) {
          domainStats[domain] = 0;
        }
        domainStats[domain] += stats.domains[domain];
      }
    }

    // Actualizar fechas
    const now = new Date().toISOString();
    const firstRun = currentStats.firstRun || now;

    // Guardar estadísticas actualizadas
    properties.setProperty(PROP_TOTAL_PROCESSED, newTotalProcessed.toString());
    properties.setProperty(PROP_TOTAL_LABELED, newTotalLabeled.toString());
    properties.setProperty(PROP_TOTAL_ERRORS, newTotalErrors.toString());
    properties.setProperty(PROP_DOMAIN_STATS, JSON.stringify(domainStats));
    properties.setProperty(PROP_LAST_RUN, now);
    properties.setProperty(PROP_FIRST_RUN, firstRun);

    Logger.log(`Estadísticas actualizadas: ${newTotalProcessed} procesados, ${newTotalLabeled} etiquetados, ${newTotalErrors} errores`);

    return true;
  } catch (e) {
    Logger.log('Error al actualizar estadísticas: ' + e.toString());
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
    properties.deleteProperty(PROP_TOTAL_ERRORS);
    properties.deleteProperty(PROP_DOMAIN_STATS);
    properties.deleteProperty(PROP_LAST_RUN);
    properties.deleteProperty(PROP_FIRST_RUN);

    Logger.log('Estadísticas eliminadas correctamente');

    return true;
  } catch (e) {
    Logger.log('Error al limpiar estadísticas: ' + e.toString());
    return false;
  }
}

/**
 * @description Exporta las estadísticas de dominios a un archivo CSV en Google Drive.
 * @param {Boolean} publicAccess - Si true, el archivo será público; si false, será privado
 * @returns {String|null} La URL del archivo CSV creado, o `null` en caso de error.
 */
function exportStatsToCSV(publicAccess = false) {
  try {
    const stats = getStats();

    if (!stats.domainStats || Object.keys(stats.domainStats).length === 0) {
      Logger.log('No hay estadísticas de dominios para exportar');
      return null;
    }

    // Crear contenido del CSV con más información
    let csvContent = 'Dominio,Cantidad de correos\n';

    // Ordenar dominios por cantidad (descendente)
    const sortedDomains = Object.keys(stats.domainStats).sort((a, b) => {
      return stats.domainStats[b] - stats.domainStats[a];
    });

    sortedDomains.forEach(domain => {
      // Escapar comas en el nombre del dominio si las hay
      const escapedDomain = domain.includes(',') ? `"${domain}"` : domain;
      csvContent += `${escapedDomain},${stats.domainStats[domain]}\n`;
    });

    // Añadir resumen al final
    csvContent += '\n';
    csvContent += `Total procesados,${stats.totalProcessed}\n`;
    csvContent += `Total etiquetados,${stats.totalLabeled}\n`;
    csvContent += `Total errores,${stats.totalErrors}\n`;
    csvContent += `Primera ejecución,${stats.firstRun || 'N/A'}\n`;
    csvContent += `Última ejecución,${stats.lastRun || 'N/A'}\n`;

    // Crear archivo en Google Drive
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `OEG_Estadisticas_${timestamp}.csv`;
    const file = DriveApp.createFile(fileName, csvContent, MimeType.CSV);

    // Configurar permisos según el parámetro
    if (publicAccess) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log(`Archivo CSV exportado (público): ${fileName}`);
    } else {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
      Logger.log(`Archivo CSV exportado (privado): ${fileName}`);
    }

    return file.getUrl();
  } catch (e) {
    Logger.log('Error al exportar estadísticas: ' + e.toString());
    return null;
  }
}

/**
 * @description Obtiene un resumen de las estadísticas.
 * @returns {Object} Resumen de estadísticas
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
    Logger.log('Error al obtener resumen de estadísticas: ' + e.toString());
    return null;
  }
}
