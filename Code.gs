/**
 * @file Code.gs
 * @description Contiene la lógica principal del script para organizar etiquetas de Gmail.
 * @author Cascade
 * @version 0.3
 * @date 2025-07-18
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

// --- Constantes Globales de Propiedades ---
// Almacenan los nombres de las claves para `PropertiesService` para evitar errores de tipeo.
const PROP_GENERIC_DOMAINS = 'genericDomains';
const PROP_MAX_EMAILS = 'maxEmails';
const PROP_DAYS_BACK = 'daysBack';
const PROP_AUTO_PROCESS = 'autoProcess';
const PROP_PROCESS_HOUR = 'processHour';
const PROP_AVOID_SUBDOMAINS = 'avoidSubdomains';
const PROP_SUBDOMAINS_TO_AVOID = 'subdomainsToAvoid';


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
      console.error('Error al crear menú: ' + error.toString());
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
      console.error('Error al mostrar sidebar: ' + error.toString());
    }
  }
}

/**
 * @description Inicializa las propiedades del script con valores por defecto si no existen.
 *              Esto asegura que el script tenga una configuración base para funcionar correctamente.
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

  if (!properties.getProperty(PROP_AVOID_SUBDOMAINS)) {
    properties.setProperty(PROP_AVOID_SUBDOMAINS, 'false');
  }

  if (!properties.getProperty(PROP_SUBDOMAINS_TO_AVOID)) {
    const defaultSubdomainsToAvoid = ['e', 'email', 'mail', 'info', 'news', 'newsletter', 'team', 'hello'];
    properties.setProperty(PROP_SUBDOMAINS_TO_AVOID, JSON.stringify(defaultSubdomainsToAvoid));
  }
}

/**
 * @description Obtiene la configuración actual del script desde `PropertiesService`.
 *              Si no hay propiedades guardadas, las inicializa primero.
 * @returns {Object} Un objeto con toda la configuración del script.
 */
function getConfig() {
  initProperties();
  const properties = PropertiesService.getUserProperties();
  
  return {
    genericDomains: JSON.parse(properties.getProperty(PROP_GENERIC_DOMAINS)),
    maxEmails: parseInt(properties.getProperty(PROP_MAX_EMAILS)),
    daysBack: parseInt(properties.getProperty(PROP_DAYS_BACK)),
    autoProcess: properties.getProperty(PROP_AUTO_PROCESS) === 'true',
    processHour: parseInt(properties.getProperty(PROP_PROCESS_HOUR)),
    avoidSubdomains: properties.getProperty(PROP_AVOID_SUBDOMAINS) === 'true',
    subdomainsToAvoid: JSON.parse(properties.getProperty(PROP_SUBDOMAINS_TO_AVOID))
  };
}

/**
 * @description Guarda la configuración proporcionada en `PropertiesService`.
 *              También actualiza el trigger para el procesamiento automático.
 * @param {Object} config - Objeto con la configuración a guardar.
 * @returns {Boolean} `true` si se guardó correctamente, `false` en caso de error.
 */
function saveConfig(config) {
  try {
    const properties = PropertiesService.getUserProperties();
    
    properties.setProperty(PROP_GENERIC_DOMAINS, JSON.stringify(config.genericDomains));
    properties.setProperty(PROP_MAX_EMAILS, config.maxEmails.toString());
    properties.setProperty(PROP_DAYS_BACK, config.daysBack.toString());
    properties.setProperty(PROP_AUTO_PROCESS, config.autoProcess.toString());
    properties.setProperty(PROP_PROCESS_HOUR, config.processHour.toString());
    properties.setProperty(PROP_AVOID_SUBDOMAINS, config.avoidSubdomains.toString());
    properties.setProperty(PROP_SUBDOMAINS_TO_AVOID, JSON.stringify(config.subdomainsToAvoid));
    
    // Configurar o eliminar el disparador según la configuración
    updateTrigger(config.autoProcess, config.processHour);
    
    return true;
  } catch (e) {
    console.error('Error al guardar configuración: ' + e.toString());
    return false;
  }
}

/**
 * @description Extrae el dominio de una dirección de correo electrónico.
 * @param {String} email - La dirección de correo electrónico (ej. "nombre <usuario@dominio.com>").
 * @returns {String} El dominio en minúsculas, o una cadena vacía si no se encuentra.
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
 * @description Determina el nombre de la etiqueta de Gmail a partir de un dominio.
 *              Aplica la lógica para dominios genéricos y para evitar subdominios.
 * @param {String} domain - El dominio del correo.
 * @param {Array<String>} genericDomains - Lista de dominios a considerar como "generico".
 * @param {Boolean} avoidSubdomains - `true` para activar la lógica de eliminación de subdominios.
 * @param {Array<String>} subdomainsToAvoid - Lista de subdominios a ignorar.
 * @returns {String|null} El nombre de la etiqueta, o `null` si no se debe etiquetar.
 */
function getLabelName(domain, genericDomains, avoidSubdomains, subdomainsToAvoid) {
  if (!domain) return null;

  // Si el dominio está en la lista de genéricos, usar etiqueta "generico"
  if (genericDomains.includes(domain)) {
    return 'generico';
  }

  let domainParts = domain.split('.');

  // Si se deben evitar subdominios y el dominio tiene más de 2 partes (ej. sub.dominio.com)
  if (avoidSubdomains && domainParts.length > 2) {
    // Si la primera parte (subdominio) está en la lista de subdominios a evitar
    if (subdomainsToAvoid.includes(domainParts[0])) {
      // Eliminar la primera parte (subdominio)
      domainParts.shift();
    }
  }

  // Extraer la parte principal del dominio (antes del primer punto)
  const mainDomain = domainParts[0];
  return mainDomain;
}

/**
 * @description Obtiene una etiqueta de Gmail existente o la crea si no existe.
 * @param {String} labelName - El nombre de la etiqueta a obtener o crear.
 * @returns {GmailLabel|null} El objeto de la etiqueta de Gmail, o `null` en caso de error.
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
    }
    
    return true;
  } catch (e) {
    console.error('Error al configurar disparador: ' + e.toString());
    return false;
  }
}

/**
 * @description Función principal que procesa los correos de Gmail.
 *              Busca correos según la configuración, extrae el dominio del remitente,
 *              determina el nombre de la etiqueta y la aplica al hilo de correo.
 *              También recopila estadísticas sobre el proceso.
 * @returns {Object} Un objeto con las estadísticas del procesamiento, o un objeto de error.
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
              const labelName = getLabelName(domain, config.genericDomains, config.avoidSubdomains, config.subdomainsToAvoid);
              
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
