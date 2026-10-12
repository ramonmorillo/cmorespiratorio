# Documento del proyecto

## SIAF-CMO Respiratorio

- Implementación estática HTML/CSS/JavaScript sin backend.
- Reglas clínicas centralizadas en `src/clinical.js`.
- Extractor local determinista en `src/extractor.js`, sin IA generativa, sin proveedores externos, sin claves API y sin llamadas de red.
- Pruebas automatizadas con `npm test`; build con `npm run build`.
- Datos: identificación pseudonimizada y almacenamiento local únicamente de datos estructurados confirmados.
- Aviso: apoyo profesional, no diagnóstico, no prescriptivo, no sustitutivo del juicio clínico, no producto sanitario certificado y pendiente de validación.

## Funcionamiento real de los datos (verificado en la auditoría de 12/10/2026)

- **Sin envío de datos:** la aplicación no realiza peticiones de red con datos clínicos (verificado en navegador: 0 peticiones externas). No hay analítica, cookies ni IA externa.
- **localStorage (persistente):** casos guardados con «Guardar caso» o al finalizar la estratificación. Permanecen en el navegador hasta que se borran («Borrar», «Borrar todos los casos» o limpieza del navegador). **No están cifrados.**
- **sessionStorage (temporal):** borrador de la evaluación en curso para recuperarla tras una recarga; se elimina al cerrar la pestaña o con «Nueva evaluación».
- **Texto clínico pegado en el análisis asistido:** se procesa en memoria y se borra del campo tras el análisis; no se guarda.
- **Ficheros exportados (PDF, TXT, CSV, JSON):** quedan en la carpeta de descargas del equipo y su custodia corresponde al profesional.
- **Equipos compartidos:** cualquier persona con acceso al mismo perfil de navegador puede ver los casos guardados. Use identificadores seudonimizados, no escriba datos identificativos en «Observaciones» y borre los casos al terminar.
- Este documento describe el funcionamiento técnico; no sustituye la evaluación de protección de datos ni la autorización del centro.

- **Análisis asistido (v2.0):** el texto pegado se procesa en memoria y se borra del campo; la tabla de revisión con las evidencias existe solo en pantalla hasta iniciar otra evaluación. En el caso solo se guarda la trazabilidad mínima de las variables confirmadas (variable, decisión, regla aplicada y fecha), **sin fragmentos del texto**.
