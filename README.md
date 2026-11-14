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
