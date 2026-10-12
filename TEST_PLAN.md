# Documento del proyecto

## SIAF-CMO Respiratorio

- Implementación estática HTML/CSS/JavaScript sin backend.
- Reglas clínicas centralizadas en `src/clinical.js`.
- Extractor local determinista en `src/extractor.js`, sin IA generativa, sin proveedores externos, sin claves API y sin llamadas de red.
- Pruebas automatizadas con `npm test`; build con `npm run build`.
- Datos: identificación pseudonimizada y almacenamiento local únicamente de datos estructurados confirmados.
- Aviso: apoyo profesional, no diagnóstico, no prescriptivo, no sustitutivo del juicio clínico, no producto sanitario certificado y pendiente de validación.

## Plan de pruebas vigente (1.1.0-rc1)

| Nivel | Comando | Contenido |
|---|---|---|
| Unitarias | `npm test` | `tests/clinical.test.js` (originales), `tests/interface.test.js`, `tests/audit.test.js` (regresiones de auditoría, informes, PDF, extractor, determinismo) |
| Compilación | `npm run build` | Copia a `dist/` y control de ausencia de red/IA en `src/*.js` |
| Extremo a extremo | `npm run build && npm run test:e2e` | `tests/e2e/flow.e2e.mjs`: Chromium (Playwright) sirviendo `dist/` bajo `/cmorespiratorio/`. Variables: `E2E_OUT` (carpeta de PDF y capturas), `E2E_ROOT` |

Casos ficticios compartidos: `tests/fixtures/cases.js` (documentados en `CASOS_CLINICOS_PRUEBA.md`).

Verificación manual pendiente antes de cada entrega: GitHub Pages, navegador corporativo, pegado en HCE real, PDF en visor institucional (ver `CHECKLIST_ENTREGA.md`).
