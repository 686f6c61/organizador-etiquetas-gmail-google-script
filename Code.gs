/**
 * @file Code.gs
 * @description Punto de entrada principal y funciones de UI para el organizador de etiquetas de Gmail.
 *              La lógica de negocio se ha modularizado en archivos separados.
 * @author 686f6c61
 * @version 0.4
 * @date 2025-11-17
 *
 * @requires Config.gs - Gestión de configuración
 * @requires LabelManager.gs - Gestión de etiquetas
 * @requires EmailProcessor.gs - Procesamiento de correos
 * @requires Statistics.gs - Gestión de estadísticas
 */

/**
 * @description Se ejecuta cuando el script se accede como una aplicación web. Sirve la interfaz de usuario principal.
 * @param {Object} e - Objeto de evento de Google Apps Script.
 * @returns {HtmlOutput} La interfaz de usuario renderizada desde 'Sidebar.html'.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('OEG - Organizador etiquetas Gmail')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * @description Se ejecuta cuando un usuario abre un documento que contiene este script.
 *              Crea un menú personalizado en la UI de Google Sheets o Gmail para acceder al panel de control.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('OEG')
      .addItem('Abrir panel de control', 'showSidebar')
      .addToUi();
  } catch (e) {
    // Probablemente se está ejecutando desde Gmail, no desde Sheets
    try {
      const ui = GmailApp.getUi();
      ui.createMenu('OEG')
        .addItem('Abrir panel de control', 'showSidebar')
        .addToUi();
    } catch (error) {
      Logger.log('Error al crear menú: ' + error.toString());
    }
  }
}

/**
 * @description Muestra el panel lateral (sidebar) con la interfaz de usuario principal.
 *              Es compatible tanto con Google Sheets como con Gmail.
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('OEG - Organizador etiquetas Gmail')
    .setWidth(350);

  try {
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (e) {
    try {
      GmailApp.getUi().showSidebar(html);
    } catch (error) {
      Logger.log('Error al mostrar sidebar: ' + error.toString());
    }
  }
}

// Las funciones initProperties, getConfig, saveConfig, extractDomain, getLabelName y getOrCreateLabel
// ahora están implementadas en los módulos Config.gs y LabelManager.gs

/**
 * @description Crea, actualiza o elimina el disparador (trigger) para el procesamiento automático diario.
 * @param {Boolean} enabled - `true` para crear o mantener el disparador, `false` para eliminarlo.
 * @param {Number} hour - La hora del día (0-23) en la que se debe ejecutar el disparador.
 */
function updateTrigger(enabled, hour) {
  try {
    // Eliminar todos los disparadores existentes
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'processEmails') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Si está habilitado, crear un nuevo disparador
    if (enabled) {
      ScriptApp.newTrigger('processEmails')
        .timeBased()
        .atHour(hour)
        .everyDays(1)
        .create();
      Logger.log(`Trigger creado para ejecutarse a las ${hour}:00 todos los días`);
    } else {
      Logger.log('Trigger eliminado');
    }

    return true;
  } catch (e) {
    Logger.log('Error al configurar disparador: ' + e.toString());
    return false;
  }
}

// La función processEmails ahora está implementada en EmailProcessor.gs
