# Documento del proyecto

## SIAF-CMO Respiratorio

- Implementación estática HTML/CSS/JavaScript sin backend.
- Reglas clínicas centralizadas en `src/clinical.js`.
- Extractor local determinista en `src/extractor.js`, sin IA generativa, sin proveedores externos, sin claves API y sin llamadas de red.
- Pruebas automatizadas con `npm test`; build con `npm run build`.
- Datos: identificación pseudonimizada y almacenamiento local únicamente de datos estructurados confirmados.
- Aviso: apoyo profesional, no diagnóstico, no prescriptivo, no sustitutivo del juicio clínico, no producto sanitario certificado y pendiente de validación.

## Auditoría pre-entrega — 12/10/2026 (versión 1.1.0-rc1)

Informe completo en `INFORME_AUDITORIA_PREENTREGA.md`; criterios en `CHECKLIST_ENTREGA.md`; casos en `CASOS_CLINICOS_PRUEBA.md`.

- 28 hallazgos (5 críticos, 9 altos, 10 medios, 4 bajos), todos los técnicos corregidos.
- 10 propuestas clínicas (P-1 a P-10) pendientes de validación profesional; no incorporadas como reglas.
- Conclusión: apta para demostración con pacientes ficticios; pilotaje supervisado condicionado a validación clínica, verificación del despliegue y autorizaciones.

## Auditoría del analizador de texto clínico — octubre de 2026 (v1.2.0)

Informe: `docs/EVALUACION_EXTRACTOR.md`. Cobertura 22/22 variables; en los 10 casos sintéticos A–J la sensibilidad de detección pasa de 45 % a 98,8 %, sin errores de negación, puntuación ni propuestas firmes indebidas (antes: 2, 4 y 2). No es validación clínica externa.
