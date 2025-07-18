# OEG - Organizador de Etiquetas para Gmail (V.0.3)

<div align="center">
  <img src="https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Apps Script" />
  <img src="https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
</div>

**OEG** es un potente script de Google Apps Script diseñado para organizar automáticamente tu bandeja de entrada de Gmail mediante la creación y asignación de etiquetas basadas en el dominio del remitente. Simplifica la gestión de correos, mejora la visibilidad y te permite tener un control total sobre cómo se clasifican tus mensajes.

![Interfaz principal del Configurador](img/configurador.png)

## Índice

- [Descripción](#descripción)
- [Características Principales](#características-principales)
- [Instalación](#instalación)
- [Uso](#uso)
- [Configuración Detallada](#configuración-detallada)
- [Estadísticas y Visualización](#estadísticas-y-visualización)
- [Arquitectura Técnica](#arquitectura-técnica)
- [Permisos Requeridos](#permisos-requeridos)
- [Limitaciones](#limitaciones)
- [Solución de Problemas](#solución-de-problemas)
- [Cómo Contribuir](#cómo-contribuir)

## Descripción

Este script analiza los correos electrónicos leídos en tu bandeja de entrada, extrae el dominio del remitente y crea una etiqueta con el nombre de ese dominio (por ejemplo, `github`, `amazon`, `google`). Además, agrupa los correos de proveedores de correo comunes (como `gmail.com`, `outlook.com`) bajo una única etiqueta `generico` para mantener tu lista de etiquetas limpia y organizada.

La característica más avanzada es su capacidad para **ignorar subdominios específicos** (como `e.`, `info.`, `news.`), permitiendo agrupar correos de `info@e.atlassian.com` y `Jira@atlassian.com` bajo la misma etiqueta `atlassian`.

## Características Principales

- **Organización Automática**: Procesa correos leídos y les asigna etiquetas basadas en el dominio del remitente.
- **Creación de Etiquetas Inteligente**: Genera nuevas etiquetas si no existen.
- **Agrupación de Dominios Genéricos**: Mantiene tu espacio de trabajo limpio agrupando correos de dominios como `gmail.com` o `yahoo.com` en una sola etiqueta: `generico`.
- **Control de Subdominios**: Permite ignorar subdominios personalizables (ej. `e`, `mail`, `info`) para una clasificación más precisa.
- **Procesamiento Programado**: Configura el script para que se ejecute automáticamente cada día a la hora que elijas.
- **Panel de Control Interactivo**: Una interfaz de usuario intuitiva integrada en Gmail para configurar y ejecutar el script.
- **Panel de Estadísticas**: Visualiza datos sobre los correos procesados, las etiquetas creadas y los dominios más frecuentes a través de gráficos y contadores.
- **Exportación de Datos**: Exporta las estadísticas de dominios a un archivo CSV compatible con Google Sheets.

## Instalación

Para instalar OEG, sigue estos pasos:

1.  **Accede a Google Apps Script**: Ve a [script.google.com](https://script.google.com/) y haz clic en **Nuevo proyecto**.
2.  **Copia el Código**:
    -   Elimina el contenido del archivo `Código.gs` por defecto.
    -   Copia todo el contenido de [Code.gs](./Code.gs) y [Statistics.gs](./Statistics.gs) y pégalo en el editor de `Código.gs`.
3.  **Crea los Archivos HTML**:
    -   En el editor, haz clic en `+` > **HTML** para crear los siguientes archivos (asegúrate de que los nombres coincidan exactamente):
        -   `Sidebar.html`
        -   `Script.html`
        -   `Styles.html`
    -   Copia el contenido de los archivos correspondientes de este repositorio en cada uno de los archivos que has creado.
4.  **Guarda el Proyecto**: Haz clic en el icono de guardar 💾 y dale un nombre descriptivo, como "OEG - Organizador Gmail".
5.  **Ejecuta la Inicialización**:
    -   Selecciona la función `onOpen` en el menú desplegable de funciones.
    -   Haz clic en **Ejecutar**.
    -   Se te pedirá que autorices los permisos necesarios. Revisa y acepta para continuar.

Una vez completado, el script estará activo en tu cuenta.

## Uso

1.  **Abre Gmail**: Ve a [gmail.com](https://gmail.com).
2.  **Accede al Panel de Control**:
    -   Busca el nuevo menú **OEG** en la barra de menú superior de Gmail.
    -   Haz clic en `OEG` > `Abrir panel de control`.
3.  **Utiliza la Interfaz**:
    -   El panel de control aparecerá en la barra lateral derecha.
    -   Desde aquí, puedes ejecutar el script manualmente, ajustar la configuración y ver las estadísticas.

## Configuración Detallada

### Opciones de Procesamiento
-   **Máximo de correos a procesar**: Define el número de hilos de correo que se analizarán en cada ejecución (rango: 10-500).
-   **Días hacia atrás**: Limita el análisis a un período de tiempo específico (1, 3, 7, 15, 30 días) o selecciona `Todos` para un análisis completo.

### Procesamiento Automático
-   **Activar/Desactivar**: Marca la casilla para que el script se ejecute automáticamente todos los días.
-   **Hora de ejecución**: Selecciona la hora del día (formato 24h) para el procesamiento automático.

### Gestión de Dominios
-   **Evitar Subdominios**: Activa esta opción para que el script ignore los subdominios definidos en la lista (ej. `e.atlassian.com` se convierte en `atlassian.com`).
    -   Puedes añadir o eliminar subdominios de la lista de ignorados.
-   **Dominios Genéricos**: Administra la lista de dominios que se agruparán bajo la etiqueta `generico`.

## Estadísticas y Visualización

El panel de estadísticas ofrece una visión clara del trabajo que OEG está haciendo por ti.

-   **Contadores**: `Total procesados`, `Total etiquetados` y `Última ejecución`.
-   **Gráfico de Dominios**: Un gráfico de barras que muestra los 5 dominios más frecuentes.
-   **Top Dominios**: Una lista detallada de los dominios con más correos.
-   **Acciones**:
    -   **Abrir en Spreadsheet**: Exporta los datos de dominios a un archivo CSV en tu Google Drive.
    -   **Limpiar**: Reinicia todas las estadísticas a cero.

![Panel de Estadísticas](img/estadisticas.png)

## Arquitectura Técnica

-   **`Code.gs`**: Contiene la lógica principal del backend, incluyendo el procesamiento de correos, la gestión de etiquetas y la configuración.
-   **`Statistics.gs`**: Módulo dedicado a la manipulación de datos estadísticos (obtener, actualizar, limpiar, exportar).
-   **`Sidebar.html`**: Define la estructura HTML de la interfaz de usuario.
-   **`Script.html`**: Alberga el código JavaScript del lado del cliente que gestiona la interactividad del panel.
-   **`Styles.html`**: Contiene los estilos CSS para dar formato a la interfaz.

El script utiliza `PropertiesService` de Google Apps Script para almacenar de forma persistente la configuración del usuario y las estadísticas.

## Permisos Requeridos

Para funcionar correctamente, el script necesita los siguientes permisos de tu cuenta de Google:
-   **Leer y modificar tu correo de Gmail**: Para analizar los mensajes y aplicar etiquetas.
-   **Ejecutar como tú**: Para que los triggers automáticos funcionen.
-   **Mostrar una interfaz de usuario personalizada**: Para renderizar el panel de control en Gmail.
-   **Crear y gestionar archivos en Google Drive**: Para la funcionalidad de exportación a CSV.

## Limitaciones

-   El script solo procesa correos que ya han sido **leídos**.
-   Está sujeto a las [cuotas y limitaciones de Google Apps Script](https://developers.google.com/apps-script/guides/services/quotas). Un uso intensivo en cuentas con un volumen de correo muy alto podría alcanzar estos límites.
-   El procesamiento inicial en una bandeja de entrada muy grande puede tardar varios minutos.

## Solución de Problemas

-   **El menú "OEG" no aparece en Gmail**: Refresca la página de Gmail. Si persiste, asegúrate de haber ejecutado la función `onOpen` correctamente durante la instalación.
-   **El script falla durante la ejecución**: Revisa los registros de ejecución en el editor de Google Apps Script (`Ver` > `Ejecuciones`) para identificar el error.
-   **Problemas de permisos**: Si encuentras errores de autorización, intenta ejecutar de nuevo la función `onOpen` para volver a lanzar el diálogo de permisos.

## Cómo Contribuir

Las contribuciones son bienvenidas. Si tienes ideas para nuevas funcionalidades, mejoras o has encontrado un error, por favor, abre un *issue* o envía un *pull request*.