# Rutina de gimnasio móvil

Interfaz web responsive para Android con búsqueda editable por ejercicio, hasta cinco resultados por búsqueda, miniaturas y enlaces a YouTube. No requiere instalar dependencias de npm.

## Ejecutar

1. Instala Node.js 22 o posterior.
2. Crea un proyecto en Google Cloud y habilita **YouTube Data API v3**. Crea una clave de API y restríngela a esa API; para un servidor publicado, agrega la restricción por IP del servidor.
3. Copia `.env.example` a `.env` y reemplaza el valor de `YOUTUBE_API_KEY`. La clave permanece en el servidor; nunca la agregues al HTML ni la subas a Git.
4. Ejecuta `npm start` desde esta carpeta.
5. Abre http://127.0.0.1:8080 en tu computadora.

Para usarlo desde Android en la misma red Wi-Fi, configura `HOST=0.0.0.0` en `.env`, reinicia el servidor y abre `http://IP_LOCAL_DE_TU_PC:8080` en Chrome del teléfono. Permite el puerto en el firewall solo en tu red privada si Windows lo solicita. El servidor debe seguir encendido. Para publicarlo en Internet, utiliza HTTPS y añade autenticación y límites por usuario al servicio de búsqueda.

## Búsquedas

Cada ejercicio tiene un campo editable y un botón **Buscar Shorts en YouTube**. El servicio aplica `type=video`, `videoDuration=short`, el término `#shorts`, preferencia de español y `maxResults=5`. El límite de cinco también se aplica en el servidor y en la interfaz. No se pagina ni se añaden resultados de búsquedas anteriores.

YouTube Data API no proporciona un filtro exclusivo de Shorts: `short` incluye videos de menos de cuatro minutos. Por ello pueden aparecer videos que no sean Shorts; abrir un enlace `/shorts/` tampoco certifica su formato. Referencia: https://developers.google.com/youtube/v3/docs/search/list

Las búsquedas requieren Internet y una clave con cuota disponible. La aplicación muestra errores por falta de configuración, desconexión y fallos del servicio. Guarda resultados en memoria durante cinco minutos (hasta 100 consultas) y comparte consultas simultáneas idénticas para reducir consumo. No registra la clave ni devuelve errores internos de Google al cliente.

El HTML abierto directamente como archivo permite consultar la rutina, pero necesita el servidor para las búsquedas. Esta entrega es una aplicación web; no incluye un APK. El temporizador usa tiempo real para evitar que un navegador en segundo plano prolongue el descanso; la alarma depende de las restricciones de audio y ejecución de Android.

## Verificación

Ejecuta `npm test`. Las pruebas usan respuestas simuladas de YouTube y no gastan cuota. Para comprobar resultados reales, configura tu clave y realiza una búsqueda desde el navegador.

## Versión 2.0: calendario, progreso y combinaciones

- **Mi entrenamiento** aparece antes de las rutinas. Toca una fecha para consultar o registrar una sesión (una por fecha). Se puede editar, eliminar y registrar días anteriores; las fechas futuras solo admiten planes.
- Guarda el estado planificado, parcial o completado, duración real, esfuerzo, molestias y notas. Marca las series realmente realizadas; guardar una sesión completada requiere al menos una serie marcada. Los botones de series de las tarjetas originales son una ayuda temporal: el registro permanente se realiza en Mi entrenamiento.
- Registra peso (kg o lb) y repeticiones por serie. La aplicación muestra las últimas series realizadas de ese ejercicio antes de la fecha seleccionada; no convierte unidades ni aumenta pesos. Las dos filas iniciales son campos de registro ajustables, no una dosis prescrita. La rutina original sigue identificada como intermedia.
- Las propuestas usan plantillas de cuerpo completo, tren superior o piernas, con 25 o 40 minutos aproximados. Respetan los ejercicios excluidos, permiten quitar ejercicios y avisan si se repiten ejercicios de los dos días anteriores. Son plantillas generales, no un plan clínico individual ni un programa semanal completo. Consulta la adecuación de ejercicios y cargas con un profesional según tu capacidad y condiciones; no se determina seguridad médica desde la app.
- **Ver técnica y videos** lleva a la tarjeta original. **Volver a mi registro** permite regresar sin perder lo escrito. Los cambios sin guardar se advierten al cambiar de sesión.
- Los registros se guardan en localStorage del navegador/WebView. No se envían al servidor y no se sincronizan entre Chrome, APK o teléfonos. Borrar datos o desinstalar puede eliminarlos. En Respaldo puedes exportar/restaurar JSON; restaurar reemplaza el historial tras confirmación. Si el APK bloquea la descarga, se ofrece el JSON seleccionable para copiar y guardar manualmente. El comportamiento de descarga y selección de archivos debe verificarse en el APK real.

### Actualizar Render

Sube al repositorio estos archivos modificados/nuevos: `rutina_completa_3dias_movil-v5.html`, `server.mjs`, **`planner.js`**, `planner.test.mjs`, `server.test.mjs` y `README.md`. No subas `.env`, APK, AAB, ZIP ni archivos de firma. `planner.js` es imprescindible para las nuevas funciones y el servidor lo sirve desde una ruta explícita.

Despliega el último commit en Render. La app instalada que utiliza la URL de Render recibe la interfaz al recargar; no requiere reconstruir el APK para estos cambios web. Comprueba que aparezca **Mi entrenamiento · Versión 2.0**. Se desactiva la caché del HTML y del script para facilitar las actualizaciones.

## Versión 3.0: navegación por pantallas

La interfaz ahora abre en **Inicio** y utiliza una barra inferior permanente: Inicio, Rutinas, Calendario y Progreso. Inicio permite comenzar la sesión de hoy y retomar cambios pendientes; Rutinas permite elegir un día original, consultar su biblioteca o aplicar una combinación con vista previa; Calendario abre el registro de la fecha tocada; Progreso consulta las series realizadas por ejercicio y contiene los respaldos.

**Entrenamiento** muestra un ejercicio a la vez con Anterior/Siguiente y un resumen final para guardar. Fecha y rutina están en un panel desplegable. Técnica y YouTube abren una pantalla secundaria y regresan al mismo ejercicio. El temporizador aparece en entrenamiento y técnica, encima de la navegación. Cambiar de pantalla conserva el borrador en memoria; para conservarlo al cerrar hay que guardar la sesión. Cargar otra fecha o reemplazar la rutina solicita confirmación si hay cambios sin guardar.

Las rutas usan el historial del navegador (`#inicio`, `#rutinas`, `#calendario`, `#progreso`, `#entrenar`, `#tecnica/8` y `#catalogo`). Atrás vuelve a la vista anterior; el botón físico de Android depende también de que el contenedor de WebIntoApp permita navegar hacia atrás en el WebView. Se ofrecen controles visibles de retorno. Recargar conserva los datos guardados, no los borradores.

Se conserva la clave `gym-progress-v1` y el formato de respaldo: no hace falta migrar ni borrar el historial anterior. Para publicar esta reorganización, actualiza **`planner.js` y `rutina_completa_3dias_movil-v5.html`** en GitHub (el servidor ya debe incluir la ruta `/planner.js` de la versión 2). Tras el despliegue, debe aparecer **Mi gimnasio · Versión 3.0**. Comprueba también la navegación, descarga de respaldos y apertura de YouTube en el APK real.
