# Documento del proyecto

## SIAF-CMO Respiratorio

- Implementación estática HTML/CSS/JavaScript sin backend.
- Reglas clínicas centralizadas en `src/clinical.js`.
- Extractor local determinista en `src/extractor.js`, sin IA generativa, sin proveedores externos, sin claves API y sin llamadas de red.
- Pruebas automatizadas con `npm test`; build con `npm run build`.
- Datos: identificación pseudonimizada y almacenamiento local únicamente de datos estructurados confirmados.
- Aviso: apoyo profesional, no diagnóstico, no prescriptivo, no sustitutivo del juicio clínico, no producto sanitario certificado y pendiente de validación.

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
