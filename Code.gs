/**
 * @file Code.gs
 * @description Punto de entrada principal y funciones de UI para el organizador
 *              de etiquetas de Gmail. La logica de negocio esta en modulos separados.
 * @author 686f6c61
 * @version 0.5
 * @date 2025-11-17
 *
 * @requires Config.gs - Gestion de configuracion
 * @requires LabelManager.gs - Gestion de etiquetas
 * @requires EmailProcessor.gs - Procesamiento de correos
 * @requires Statistics.gs - Gestion de estadisticas
 */

/**
 * @description Sirve la interfaz de usuario cuando se accede como aplicacion web.
 * @param {Object} e - Objeto de evento de Google Apps Script
 * @returns {HtmlOutput} Interfaz renderizada desde 'Sidebar.html'
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('OEG - Organizador etiquetas Gmail')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * @description Crea el menu personalizado al abrir el documento contenedor.
 *              Compatible con Google Sheets; Gmail standalone usa doGet().
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('OEG')
      .addItem('Abrir panel de control', 'showSidebar')
      .addToUi();
  } catch (e) {
    // Si no estamos en Sheets (p.ej. ejecutando como webapp), ignorar
    Logger.log('onOpen: no se pudo crear menu (contexto no soportado)');
  }
}

/**
 * @description Muestra el panel lateral con la interfaz de usuario.
 */
function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('OEG - Organizador etiquetas Gmail')
    .setWidth(350);

  try {
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (e) {
    Logger.log('showSidebar: no se pudo mostrar sidebar (contexto no soportado)');
  }
}

/**
 * @description Crea, actualiza o elimina el trigger para procesamiento automatico diario.
 * @param {boolean} enabled - true para activar el trigger, false para desactivarlo
 * @param {number} hour - Hora del dia (0-23) para la ejecucion
 * @returns {boolean} true si la operacion fue exitosa
 */
function updateTrigger(enabled, hour) {
  try {
    // Eliminar triggers previos de processEmails
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'processEmails') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    if (enabled) {
      ScriptApp.newTrigger('processEmails')
        .timeBased()
        .atHour(hour)
        .everyDays(1)
        .create();
      Logger.log('Trigger creado para las ' + hour + ':00 diario');
    } else {
      Logger.log('Trigger eliminado');
    }

    return true;
  } catch (e) {
    Logger.log('Error al configurar disparador: ' + e.toString());
    return false;
  }
}
