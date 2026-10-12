# Checklist de entrega — SIAF-CMO Respiratorio 1.1.0-rc1

Estados: **APTO** (verificado con evidencia reproducible) · **NO APTO** · **NO VERIFICADO** (no comprobable en el entorno de auditoría).

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Paciente nivel 1 estratificado correctamente | APTO | Casos C1, C5, C7, C8 (`npm test`, E2E) |
| 2 | Paciente nivel 2 estratificado correctamente | APTO | C2 (21 p), C4 (31 p) |
| 3 | Paciente nivel 3 estratificado correctamente | APTO | C3 (20 p), C6, C10 |
| 4 | Límites exactos 20/21/31/32 | APTO | Motor y E2E |
| 5 | Excepciones (embarazo, <18 en adultos, pediátrico) | APTO | C7, C8, C9 |
| 6 | Mismas variables ⇒ mismo resultado | APTO | Prueba de determinismo |
| 7 | Datos incompletos: resultado provisional y rango alcanzable | APTO | C11 |
| 8 | Edad/IMC vacíos no puntúan ni disparan excepciones | APTO | Pruebas «CRÍTICO corregido» |
| 9 | Modificación manual exige justificación | APTO | Unitaria + E2E |
| 10 | Recalculo inmediato al cambiar variables | APTO | E2E «cambio tras finalizar» |
| 11 | Informe bloqueado si se modifica tras finalizar | APTO | E2E |
| 12 | Selección de estado de intervenciones (realizada/planificada/no procede) | APTO | E2E P1 |
| 13 | Intervenciones correctamente diferenciadas en informes | APTO | Unitaria + E2E |
| 14 | PDF se genera y descarga | APTO | E2E (Chromium) |
| 15 | PDF con caracteres españoles, sin `undefined/null/NaN`, paginado | APTO | Unitaria + `pdftotext` + renderizado |
| 16 | Revisión visual del PDF (maquetación, cortes, solapamientos) | APTO | Renderizado con `pdftoppm` de caso P1 (2 páginas) |
| 17 | PDF en visor institucional e impresión física | NO VERIFICADO | Requiere equipo del hospital |
| 18 | Botón «Copiar informe para historia clínica» con confirmación | APTO | E2E (portapapeles = texto mostrado) |
| 19 | Copia con API de portapapeles no disponible | APTO | E2E (selección + instrucción Ctrl+C) |
| 20 | Pegado en la HCE real del hospital | NO VERIFICADO | Requiere HCE |
| 21 | Concordancia PDF ↔ texto HCE | APTO | Misma estructura + prueba automática |
| 22 | Guardado sin duplicados, apertura y borrado de casos | APTO | E2E |
| 23 | Recuperación tras recarga accidental | APTO | E2E |
| 24 | Nueva evaluación sin mezclar pacientes | APTO | E2E |
| 25 | Exportación/importación JSON con saneamiento | APTO | Unitarias |
| 26 | Sin peticiones a servicios externos | APTO | E2E (0 peticiones) + control en build |
| 27 | Avisos de privacidad acordes al funcionamiento real | APTO | `PRIVACY.md` actualizado |
| 28 | Riesgo de equipos compartidos controlado | NO APTO (riesgo residual) | Datos locales sin cifrar; mitigación organizativa necesaria |
| 29 | Responsive escritorio/tableta/móvil sin desbordamiento | APTO | Capturas 1280/820/390 px |
| 30 | Accesibilidad básica (nombres accesibles, foco, errores visibles) | APTO | E2E |
| 31 | `npm test` | APTO | 34/34 |
| 32 | `npm run build` | APTO | OK |
| 33 | Funcionamiento en GitHub Pages (URL pública) | NO VERIFICADO | Probado con servidor local bajo `/cmorespiratorio/`; no se ha desplegado |
| 34 | Firefox / Safari / Edge corporativo | NO VERIFICADO | Solo Chromium |
| 35 | Reglas contrastadas con el documento SEFH original | NO VERIFICADO | Fuente no disponible en el repositorio |
| 36 | Validación clínica y autorización institucional | NO APTO | Pendiente; fuera del alcance técnico |
