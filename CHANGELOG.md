# Documento del proyecto

## SIAF-CMO Respiratorio

- Implementación estática HTML/CSS/JavaScript sin backend.
- Reglas clínicas centralizadas en `src/clinical.js`.
- Extractor local determinista en `src/extractor.js`, sin IA generativa, sin proveedores externos, sin claves API y sin llamadas de red.
- Pruebas automatizadas con `npm test`; build con `npm run build`.
- Datos: identificación pseudonimizada y almacenamiento local únicamente de datos estructurados confirmados.
- Aviso: apoyo profesional, no diagnóstico, no prescriptivo, no sustitutivo del juicio clínico, no producto sanitario certificado y pendiente de validación.

## Sin publicar — Identidad CMO Design System 0.1.0 (rama `design/cmo-ds-0.1.0`)

Cambio exclusivamente visual. Sin cambios en `src/clinical.js`, `src/extractor.js`, `src/workflow.js`, `src/report.js`, `src/pdf.js`, `src/storage.js` ni `src/app.js`.
- Copia fijada del CMO Design System 0.1.0 en `src/cmo-ds/` (manifiesto SHA-256); sustituye a la antigua capa `src/cmo-visual.css`.
- `src/styles.css`: colores de marca y neutros pasan a tokens; se retiran los `!important` que solo existían para anular la capa antigua. Colores semánticos sin cambios.
- Accesibilidad: el contorno de foco pasa de #ffbf47 (1,6:1 sobre blanco) a #1f3aa8 (9,4:1) y el borde de los campos de #b9c6d3 (1,7:1) a #7b8495 (≥3:1, WCAG 1.4.11).
- Pie: firma `<cmo-author-signature>` (desarrollo digital y modelo clínico SEFH) a partir de metadatos `cmo-app-meta`; favicon.
- Build: copia recursiva de `src/` y control de llamadas de red ampliado a `src/cmo-ds/`.
- Pruebas: `tests/cmo-ds.test.js` (versión de la firma = `VERSION`, integridad de la copia, atribución SEFH).
- Versión: se mantiene 1.2.0 a la espera de decisión del autor (cambiarla afecta a `src/clinical.js`, a las exportaciones y al PDF).

## 1.1.0-rc1 — 12/10/2026 (auditoría pre-entrega; rama de auditoría, sin publicar)

### Correcciones críticas del motor clínico
- Edad vacía/no numérica ya no genera Prioridad 1 automática; IMC vacío ya no puntúa como desnutrición (rangos plausibles 0–120 años y IMC 10–80; fuera de rango = pendiente).
- La modificación manual de prioridad solo se aplica con justificación (≥12 caracteres).
- Edad pediátrica: el modelo de adultos se declara no aplicable y se bloquean finalización e informes.
- Advertencias de revisión: 16–17 años fuera de consulta de adultos; edad adulta marcada como pediátrica; rebaja de P1 automática.
- Rango alcanzable (puntuación y prioridad máximas) cuando hay variables pendientes.

### Extractor local
- Corregidas inversiones por negación («no adherente»), falsos positivos (exfumador, polvo seco, gases arteriales, «hace 2 años») y propagación de incertidumbre entre frases. Edad e IMC detectados se transfieren al formulario. Las menciones dudosas no se preseleccionan.

### Informes
- Nuevo informe PDF generado localmente (`src/pdf.js`) y botón «Copiar informe para historia clínica» con confirmación y alternativa sin API de portapapeles. Ambos derivan de una única estructura (`src/report.js`). Informes bloqueados si no hay finalización válida o si se modificaron datos tras finalizar.

### Flujo y datos
- Estado por intervención (recomendada / realizada / planificada / no procede) e identificadores estables; plan con próxima valoración y observaciones.
- Paso «Necesidades» basado en las variables puntuadas del paciente.
- «Nueva evaluación»; selector de patología principal; recuperación del borrador tras recarga (sessionStorage) y aviso al salir con cambios.
- Corregida la duplicación de casos al guardar/finalizar; tolerancia a almacenamiento corrupto; saneamiento de importación JSON; CSV con escape y protección frente a fórmulas.
- Mensajes visibles, nombres accesibles en los controles, mejoras móviles.

### Calidad
- 18 pruebas unitarias nuevas (34 en total) y 9 pruebas E2E en Chromium (`npm run test:e2e`).
- `build.js` comprueba ausencia de llamadas de red en todos los módulos.
- Documentación: `INFORME_AUDITORIA_PREENTREGA.md`, `CHECKLIST_ENTREGA.md`, `GUIA_RAPIDA_FARMACEUTICO.md`, `CASOS_CLINICOS_PRUEBA.md`.

## 1.1.0 — octubre de 2026 (nueva versión)

- Publicación como versión 1.1.0 de los cambios de la auditoría pre-entrega (1.1.0-rc1).
- La web indica que la herramienta se basa en la **metodología CMO MAPEX-SEFH** (cabecera y faldón).
- Faldón con enlace al documento fuente SEFH: https://www.sefh.es/mapex/images/modelo-CMO-al-paciente-con-patologias-respiratorias.pdf
- Nuevo faldón de **aviso legal** (Reglamento (UE) 2017/745, RGPD, LOPDGDD, Ley 41/2002, propiedad intelectual y limitación de responsabilidad) y aviso legal completo en `LEGAL_NOTICE.md`.
- El PDF y el texto para historia clínica citan la versión, su fecha y la fuente MAPEX-SEFH.

## 1.2.0 — octubre de 2026 · Analizador de texto clínico v2.0

- Reglas de extracción para las **22 variables** (antes 12), con umbrales cuantitativos del modelo (TAI, MPR, FVC, DLCO, FEV1, SNOT-22, VAS, BSI, FACED, CAT, EQ-VAS), periodo y causa en ingresos y urgencias, y catálogos locales versionados de medicamentos agravantes (anexo SEFH, por patología) y de alto riesgo (subconjunto MARC ISMP, pendiente de verificación).
- Negación por cláusula (no se propaga a otras variables), antecedentes familiares «no atribuibles», incertidumbre y **detección de contradicciones** (sin propuesta).
- Eliminada la etiqueta de «certeza» no validada.
- Nueva **tabla de revisión** de las 22 variables por dimensión: confirmar, modificar o descartar cada fila; confirmación conjunta solo de propuestas explícitas tras una casilla de revisión; nunca sobrescribe respuestas previas; contadores de confirmadas, pendientes, descartadas y sin información.
- Trazabilidad `provenance` en el caso (sin fragmentos de texto) e indicación en PDF y texto para historia clínica.
- Sin cambios en variables, puntuaciones, umbrales ni prioridad automática.
- Evaluación reproducible (`npm run eval:extractor`) con 10 casos sintéticos A–J: `docs/EVALUACION_EXTRACTOR.md`.
