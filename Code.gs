/**
 * OEG - Organizador etiquetas Gmail
 * Script que organiza automáticamente los correos de Gmail según el dominio del remitente
 * 
 * @author Cascade
 * @version 0.2
 * @date 2025-04-11
 */

/**
 * Función que se ejecuta cuando se accede al script como aplicación web
 * @param {Object} e - Objeto de evento
 * @return {HtmlOutput} - Interfaz de usuario
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('OEG - Organizador etiquetas Gmail')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Propiedades globales para almacenar configuración
const PROP_GENERIC_DOMAINS = 'genericDomains';
const PROP_MAX_EMAILS = 'maxEmails';
const PROP_DAYS_BACK = 'daysBack';
const PROP_AUTO_PROCESS = 'autoProcess';
const PROP_PROCESS_HOUR = 'processHour';

/**
 * Función que se ejecuta al abrir el script desde Google Apps Script
 * Crea el menú en la interfaz de Gmail
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
      console.error('Error al crear menú: ' + error.toString());
    }
  }
}

/**
 * Muestra el panel lateral con la interfaz de usuario
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
      console.error('Error al mostrar sidebar: ' + error.toString());
    }
  }
}

/**
 * Inicializa las propiedades del script si no existen
 */
function initProperties() {
  const properties = PropertiesService.getUserProperties();
  
  if (!properties.getProperty(PROP_GENERIC_DOMAINS)) {
    const defaultGenericDomains = [
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
    ];
    properties.setProperty(PROP_GENERIC_DOMAINS, JSON.stringify(defaultGenericDomains));
  }
  
  if (!properties.getProperty(PROP_MAX_EMAILS)) {
    properties.setProperty(PROP_MAX_EMAILS, '100');
  }
  
  if (!properties.getProperty(PROP_DAYS_BACK)) {
    properties.setProperty(PROP_DAYS_BACK, '7');
  }
  
  if (!properties.getProperty(PROP_AUTO_PROCESS)) {
    properties.setProperty(PROP_AUTO_PROCESS, 'false');
  }
  
  if (!properties.getProperty(PROP_PROCESS_HOUR)) {
    properties.setProperty(PROP_PROCESS_HOUR, '8');
  }
}

/**
 * Obtiene la configuración actual
 * @return {Object} Objeto con la configuración
 */
function getConfig() {
  initProperties();
  const properties = PropertiesService.getUserProperties();
  
  return {
    genericDomains: JSON.parse(properties.getProperty(PROP_GENERIC_DOMAINS)),
    maxEmails: parseInt(properties.getProperty(PROP_MAX_EMAILS)),
    daysBack: parseInt(properties.getProperty(PROP_DAYS_BACK)),
    autoProcess: properties.getProperty(PROP_AUTO_PROCESS) === 'true',
    processHour: parseInt(properties.getProperty(PROP_PROCESS_HOUR))
  };
}

/**
 * Guarda la configuración
 * @param {Object} config - Objeto con la configuración
 * @return {Boolean} - Resultado de la operación
 */
function saveConfig(config) {
  try {
    const properties = PropertiesService.getUserProperties();
    
    properties.setProperty(PROP_GENERIC_DOMAINS, JSON.stringify(config.genericDomains));
    properties.setProperty(PROP_MAX_EMAILS, config.maxEmails.toString());
    properties.setProperty(PROP_DAYS_BACK, config.daysBack.toString());
    properties.setProperty(PROP_AUTO_PROCESS, config.autoProcess.toString());
    properties.setProperty(PROP_PROCESS_HOUR, config.processHour.toString());
    
    // Configurar o eliminar el disparador según la configuración
    updateTrigger(config.autoProcess, config.processHour);
    
    return true;
  } catch (e) {
    console.error('Error al guardar configuración: ' + e.toString());
    return false;
  }
}

/**
 * Extrae el dominio de una dirección de correo electrónico
 * @param {String} email - Dirección de correo electrónico
 * @return {String} - Dominio extraído
 */
function extractDomain(email) {
  if (!email) return '';
  
  const match = email.match(/@([^>]*)/);
  if (match && match[1]) {
    return match[1].toLowerCase();
  }
  return '';
}

/**
 * Obtiene el nombre de la etiqueta a partir del dominio
 * @param {String} domain - Dominio del correo
 * @param {Array} genericDomains - Lista de dominios genéricos
 * @return {String} - Nombre de la etiqueta
 */
function getLabelName(domain, genericDomains) {
  if (!domain) return null;
  
  // Si el dominio está en la lista de genéricos, usar etiqueta "generico"
  if (genericDomains.includes(domain)) {
    return 'generico';
  }
  
  // Extraer la parte principal del dominio (antes del primer punto)
  const mainDomain = domain.split('.')[0];
  return mainDomain;
}

/**
 * Obtiene o crea una etiqueta en Gmail
 * @param {String} labelName - Nombre de la etiqueta
 * @return {GmailLabel} - Objeto etiqueta de Gmail
 */
function getOrCreateLabel(labelName) {
  if (!labelName) return null;
  
  try {
    // Intentar obtener la etiqueta existente
    let label = GmailApp.getUserLabelByName(labelName);
    
    // Si no existe, crearla
    if (!label) {
      label = GmailApp.createLabel(labelName);
    }
    
    return label;
  } catch (e) {
    console.error('Error al crear/obtener etiqueta: ' + e.toString());
    return null;
  }
}

/**
 * Actualiza el disparador para el procesamiento automático
 * @param {Boolean} enabled - Si el procesamiento automático está habilitado
 * @param {Number} hour - Hora del día para ejecutar (0-23)
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
    }
    
    return true;
  } catch (e) {
    console.error('Error al configurar disparador: ' + e.toString());
    return false;
  }
}

/**
 * Procesa los correos y aplica las etiquetas según el dominio
 * @return {Object} - Estadísticas del procesamiento
 */
function processEmails() {
  try {
    const config = getConfig();
    const genericDomains = config.genericDomains;
    const maxEmails = config.maxEmails;
    const daysBack = config.daysBack;
    
    // Crear consulta para buscar correos leídos
    let query = "is:read";
    
    // Añadir filtro de fecha si no es "Todos"
    if (daysBack !== -1) {
      // Calcular la fecha límite
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - daysBack);
      
      // Añadir filtro de fecha a la consulta
      query += ` after:${dateLimit.getFullYear()}/${dateLimit.getMonth() + 1}/${dateLimit.getDate()}`;
    }
    
    // Obtener los hilos de correo que coinciden con la consulta
    const threads = GmailApp.search(query, 0, maxEmails);
    
    let stats = {
      processed: 0,
      labeled: 0,
      errors: 0,
      domains: {}
    };
    
    // Procesar cada hilo
    for (const thread of threads) {
      const messages = thread.getMessages();
      
      for (const message of messages) {
        try {
          // Solo procesar mensajes leídos
          if (!message.isUnread()) {
            const from = message.getFrom();
            const domain = extractDomain(from);
            
            if (domain) {
              const labelName = getLabelName(domain, genericDomains);
              
              if (labelName) {
                const label = getOrCreateLabel(labelName);
                
                if (label) {
                  // Aplicar la etiqueta al hilo si no la tiene ya
                  if (!thread.getLabels().some(l => l.getName() === labelName)) {
                    label.addToThread(thread);
                    stats.labeled++;
                    
                    // Registrar estadísticas por dominio
                    if (!stats.domains[domain]) {
                      stats.domains[domain] = 0;
                    }
                    stats.domains[domain]++;
                  }
                }
              }
            }
            
            stats.processed++;
          }
        } catch (e) {
          console.error('Error al procesar mensaje: ' + e.toString());
          stats.errors++;
        }
      }
    }
    
    // Actualizar estadísticas globales
    updateStats(stats);
    
    return stats;
  } catch (e) {
    console.error('Error en processEmails: ' + e.toString());
    return { error: e.toString() };
  }
}
