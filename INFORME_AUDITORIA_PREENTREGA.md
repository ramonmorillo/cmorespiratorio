# Informe de auditoría pre-entrega — SIAF-CMO Respiratorio

- **Versión auditada:** 1.0.0 (commit `78beede`, rama `main`).
- **Versión candidata resultante:** 1.1.0-rc1 (rama `claude/admiring-meitner-fw404g`; sin merge a `main` ni despliegue).
- **Fecha:** 12/10/2026.
- **Alcance:** código (`src`, `scripts`, `tests`, `dist`), documentación del repositorio, comportamiento real en Chromium (Playwright), PDF y texto para historia clínica.
- **Limitación de partida:** la fuente primaria (SEFH, *Adaptación del Modelo CMO al paciente con patologías respiratorias*) **no está en el repositorio**. Las reglas se han contrastado con `CLINICAL_RULES.md`, `SOURCE_MAPPING.md` y los textos de ayuda del código, **no con el documento original**. Cualquier afirmación de “conforme a la fuente” debe leerse como “conforme a la documentación interna”.

---

## 1. Inventario funcional real (antes de la auditoría)

| Componente | Estado encontrado |
|---|---|
| Motor CMO (`clinical.js`): 22 variables, 5 dimensiones, máx. 59, umbrales P1 ≥32 / P2 21–31 / P3 ≤20, excepciones | Implementado; **defectos críticos** en edad, IMC, modificación manual y pediatría |
| Extractor local de texto (`extractor.js`) | Determinista, sin red; **inversiones y falsos positivos** relevantes |
| Flujo en 7 etapas (`app.js`, `index.html`) | Funcional; sin “Nueva evaluación”, sin confirmaciones visibles |
| Necesidades (paso 5) | Eran las 3 categorías de actuación renombradas como “Necesidad CMO”: no reflejaban la valoración del paciente |
| Intervenciones (paso 6) | Lista estática; **no se podía marcar realizada/planificada/no procede** |
| Informe | Solo `window.print()` de un resumen y un `.txt` con valores técnicos (`completed`, `draft`, fecha ISO). **No existía PDF ni “copiar para historia clínica”** |
| Persistencia | `localStorage`; **duplicaba el caso en cada finalización**; JSON corrupto bloqueaba la app; sin protección ante recarga |
| Importación JSON | Sin saneamiento: valores no válidos puntuaban silenciosamente como “No” |
| Next Best Action | **No implementado** (no se ha añadido: no hay regla documentada) |
| Documentación | 6 documentos (`AUDITORIA`, `CHANGELOG`, `TEST_PLAN`, `PRIVACY`, `LEGAL_NOTICE`, `AI_POLICY`) eran **copias idénticas** de un texto genérico |
| Pruebas | 16 pruebas unitarias; las de interfaz solo buscaban cadenas en el código fuente (no probaban comportamiento) |

## 2. Hallazgos, gravedad y estado

Gravedad: **C** crítico (decisión clínica, nivel asignado, integridad o seguridad) · **A** alto · **M** medio · **B** bajo.

| # | Gr. | Hallazgo (evidencia reproducida) | Estado |
|---|---|---|---|
| 1 | C | Edad vacía con “Aplicar edad registrada” ⇒ `Number('')=0` ⇒ «Menor de 18 años en consulta de adultos» ⇒ **Prioridad 1 automática falsa** | Corregido: edad ausente/no numérica/fuera de 0–120 ⇒ variable **pendiente** |
| 2 | C | IMC vacío con “Aplicar IMC registrado” ⇒ IMC 0 ⇒ **desnutrición, 1 punto** | Corregido: IMC ausente o fuera de 10–80 ⇒ pendiente; admite coma decimal |
| 3 | C | El análisis asistido confirmaba edad/IMC **sin trasladar el valor numérico** (agrava 1 y 2: «Varón de 70 años» ⇒ P1 automática) | Corregido: el valor detectado se traslada al campo y se muestra antes de confirmar |
| 4 | C | La modificación manual de prioridad se aplicaba **sin justificación** (`calculate` usaba `override.priority` sin validar) | Corregido: solo se aplica con prioridad válida y justificación ≥12 caracteres; aviso visible; no se puede finalizar con modificación incompleta |
| 5 | C | Paciente pediátrico (0–15 fuera de consulta de adultos) **recibía una prioridad (P3) y un informe** del modelo de adultos | Corregido: «No aplicable — derivar a modelo pediátrico»; finalización e informes bloqueados |
| 6 | A | Extractor: «no adherente» ⇒ propuesta **No** (la negación se buscaba dentro del propio hallazgo); «Sin cambios. Mala adherencia.» ⇒ No | Corregido: negación solo en el texto previo y en la misma frase |
| 7 | A | Extractor: «exfumador» y «tabaquismo previo» ⇒ tabaquismo activo **Sí**; «inhalador de polvo seco» y «gases arteriales» ⇒ exposición laboral **Sí**; «hace 2 años» ⇒ edad 2 ⇒ **pediátrico** | Corregido con exclusiones explícitas y patrones de edad contextuales |
| 8 | A | Extractor: menciones dudosas quedaban preseleccionadas en «Sí» (primera opción) y se incorporaban con un clic | Corregido: «Seleccione…» obligatorio cuando no hay propuesta firme |
| 9 | A | Extractor: la ventana de incertidumbre (±40 caracteres) cruzaba frases | Corregido: limitada a la frase del hallazgo |
| 10 | A | No existía informe PDF ni texto para historia clínica | Implementado (ver §4) |
| 11 | A | Intervenciones no registrables (realizadas/propuestas/pendientes indiferenciadas) | Implementado: estado por actuación (Recomendada por el modelo / Realizada / Planificada / No procede) con identificadores estables |
| 12 | A | Cada finalización y cada «Guardar» creaba un **caso duplicado** (no se reasignaba el `id`) | Corregido |
| 13 | A | No había forma de iniciar otro paciente sin recargar; riesgo de mezclar pacientes | Implementado «Nueva evaluación» con confirmación si hay cambios sin guardar |
| 14 | A | Importación JSON sin saneamiento: `"si"` puntuaba como «No»; patologías/valores arbitrarios aceptados | Corregido: valores no admisibles ⇒ pendientes; textos truncados; patologías e intervenciones filtradas |
| 15 | M | Recarga accidental ⇒ pérdida total de la evaluación | Corregido: borrador en `sessionStorage` (se borra al cerrar la pestaña) + aviso del navegador al salir con cambios |
| 16 | M | `localStorage` corrupto ⇒ excepción y aplicación en blanco | Corregido |
| 17 | M | Mensajes de guardado/importación solo para lectores de pantalla (región `sr-only`) | Corregido: aviso visible (toast) |
| 18 | M | Paso 5 «Necesidades» mostraba categorías de actuación, no necesidades del paciente | Corregido: variables puntuadas por dimensión; las de tratamiento se presentan como necesidades farmacoterapéuticas; variables pendientes listadas |
| 19 | M | Resultado provisional sin indicar cuánto podía variar | Añadido: puntuación máxima alcanzable y prioridad máxima posible con las variables pendientes (aritmética del propio modelo) |
| 20 | M | «Patología principal» = primera casilla en el orden de la lista, no elección del profesional | Corregido: selector explícito |
| 21 | M | CSV sin escape de comillas y vulnerable a inyección de fórmulas (`=…`) | Corregido |
| 22 | M | Tras finalizar, cambiar identificación o intervenciones marcaba la estratificación como desactualizada | Corregido: solo los cambios que afectan al cálculo exigen revalidar |
| 23 | M | Informe disponible con datos modificados tras finalizar | Corregido: PDF/copia bloqueados hasta revalidar (un clic en paso 4) |
| 24 | M | Documentación de auditoría, cambios, pruebas y privacidad sin contenido real | Corregido (se conserva el texto previo) |
| 25 | B | Desplegables de variables sin nombre accesible; `aria-current="false"` | Corregido |
| 26 | B | Descarga sin anclar al DOM ni liberar `ObjectURL`; tipos MIME genéricos | Corregido |
| 27 | B | Edad 16–17 fuera de consulta de adultos rotulada «18–65 años» | Corregido el rótulo + advertencia de revisión (ver propuesta P-3) |
| 28 | B | `build.js` solo comprobaba marcadores de red en `extractor.js` | Ampliado a todos los módulos |

## 3. Auditoría clínica del algoritmo

**Verificado como coherente con la documentación interna** (pruebas automáticas):
- 22 variables; máximos por dimensión 5/14/21/16/3 = 59.
- Umbrales: 20 ⇒ P3, 21 ⇒ P2, 31 ⇒ P2, 32 ⇒ P1 (probados en motor y en la interfaz).
- Excepciones: embarazo/puerperio ⇒ P1; <18 en consulta de adultos ⇒ P1; ambas sin puntos ficticios.
- IMC: ≥30 ⇒ 3; <18,4 ⇒ 1; <18,4 con FQ ⇒ 3. Edad >65 ⇒ 2 (65 ⇒ 0).
- Actuaciones acumulativas P3 ⊂ P2 ⊂ P1; periodicidad por prioridad.
- **Determinismo:** mismas variables ⇒ resultado idéntico (50 repeticiones y orden de entrada invertido).
- Recalculo inmediato ante cualquier cambio (comprobado en navegador).

**Propuestas que requieren validación profesional (NO incorporadas como reglas):**

| Id | Cuestión | Comportamiento actual | Propuesta |
|---|---|---|---|
| P-1 | Umbral de desnutrición «IMC <18,4» (habitual OMS: <18,5) | Se mantiene <18,4 (IMC 18,4 = 0 puntos) | Verificar en p. 12, Figura 2 de la fuente |
| P-2 | «>65 años» frente a «≥65» | >65 (65 años = 0 puntos) | Verificar en la fuente |
| P-3 | 16–17 años no atendidos en consulta de adultos | Se puntúa como adulto (0 puntos) con advertencia de revisión | Decidir si debe considerarse pediátrico «hasta derivación autonómica» |
| P-4 | «Justificación reforzada» al rebajar una P1 automática | Mismo requisito mínimo (≥12 caracteres) + advertencia visible y en informes | Definir criterio (p. ej., doble validación o campo específico) |
| P-5 | Variables pendientes puntúan 0 (posible infraestimación) | Se permite finalizar como provisional; se informa del rango alcanzable | Definir un conjunto mínimo obligatorio para finalizar |
| P-6 | «En EPOC marcar Sí» en naïve a terapia hospitalaria | Solo texto de ayuda | Valorar sugerencia automática al marcar EPOC |
| P-7 | Necesidades por ejes Capacidad/Motivación/Oportunidad | No existe mapeo documentado; se usan dimensiones del modelo | Documentar el mapeo variable→eje si la fuente lo contempla |
| P-8 | Intervenciones dirigidas a factores concretos (p. ej., tabaquismo activo ⇒ deshabituación) | Las actuaciones dependen solo de la prioridad (fuente: Tablas 1–3) | Requiere criterio clínico documentado; no se ha añadido |
| P-9 | Next Best Action | No existe | No implementar sin reglas validadas |
| P-10 | Rangos de plausibilidad técnicos (edad 0–120; IMC 10–80) | Fuera de rango ⇒ pendiente | Confirmar que son aceptables clínicamente |

## 4. Informes

Una **única estructura de datos** (`src/report.js` → `buildReport`) alimenta la vista previa en pantalla, el PDF (`src/pdf.js`) y el texto para historia clínica (`reportToText`). Las pruebas comprueban que resultado, puntuación, intervenciones, fecha de revisión y periodicidad aparecen idénticos en PDF y texto.

**PDF** (generador propio, local, sin dependencias ni red): A4, encabezado, identificación, fecha y profesional, recuadro de resultado, situación clínica, variables determinantes y subtotales, necesidades farmacoterapéuticas, intervenciones diferenciadas (realizadas / planificadas / recomendadas no registradas; «no procede» se excluye), plan y seguimiento, advertencias, versión y aviso profesional, numeración «Página X de N» y cabecera de continuación. Caracteres españoles verificados (á é í ó ú ñ ü ¿ ¡ €, raya). «≥/≤» se transcriben como «>=/<=» (no existen en la fuente estándar del PDF). Estructura interna validada (tabla `xref` coherente) y extracción con `pdftotext`. **Inspección visual realizada sobre la imagen renderizada** (`pdftoppm`) de un caso P1 de 2 páginas: sin solapamientos, cortes ni campos vacíos. No se ha verificado en Adobe Reader, impresora física ni otros visores.

**Texto para historia clínica:** botón «Copiar informe para historia clínica», confirmación visible, alternativa `execCommand` y, si falla, selección automática del texto con instrucción «Ctrl+C». Texto plano, sin HTML, tablas ni emojis, con apartados omitidos si no tienen contenido. Verificado en Chromium que el portapapeles contiene exactamente el texto mostrado. **No verificado:** pegado en la historia clínica electrónica real del hospital (codificación, longitud máxima de campo, saltos de línea).

**Bloqueos de seguridad:** no se generan informes si la estratificación no está finalizada, si se modificó tras finalizar o si el paciente es pediátrico.

## 5. Persistencia, privacidad y seguridad

- Sin backend, analítica ni cookies. Prueba E2E: **cero peticiones a orígenes externos** durante el circuito completo. `build.js` rechaza `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` y marcadores de proveedores de IA.
- `localStorage`: casos guardados explícitamente o al finalizar (persisten hasta su borrado). `sessionStorage`: borrador de la evaluación en curso (se elimina al cerrar la pestaña).
- Toda la salida HTML de datos de usuario se escapa; importación saneada.
- **Riesgo residual en equipos compartidos:** los casos guardados permanecen en el navegador y son visibles para cualquier usuario del mismo perfil de sistema operativo; no están cifrados. Mitigaciones: identificador seudonimizado, aviso en la interfaz, botón de borrado. Recomendación: usar perfiles de navegador nominativos o borrar al terminar cada sesión.
- El campo «Observaciones» es texto libre: el profesional podría introducir datos identificativos. Se advierte en la etiqueta; no hay control automático.
- **Esta auditoría técnica no acredita cumplimiento RGPD/LOPDGDD, evaluación de impacto, autorización institucional ni marcado como producto sanitario.**

## 6. Pruebas ejecutadas

| Batería | Comando | Resultado |
|---|---|---|
| Unitarias y de regresión (motor, extractor, informes, PDF, importación, CSV, determinismo) | `npm test` | **34/34 superadas** |
| Compilación (`dist/`) con control de red | `npm run build` | **OK** |
| Extremo a extremo en Chromium real bajo `/cmorespiratorio/` | `npm run test:e2e` | **9/9 superadas** (≈60 s) |

Escenarios E2E: circuito P1 completo con intervenciones, plan, copia (comparación exacta con el portapapeles) y descarga PDF; límites 20/31/32 y P1 automática por embarazo; FQ con desnutrición; datos incompletos y finalización provisional; pediátrico bloqueado; modificación manual sin/con justificación; cambio tras finalizar (bloqueo y revalidación); análisis asistido; recarga con recuperación de borrador; «Nueva evaluación»; almacenamiento corrupto; ausencia de duplicados; nombres accesibles; validación visible; ausencia de desbordamiento horizontal en 390 px; copia sin API de portapapeles; cero errores de consola y cero peticiones externas.

## 7. Verificaciones pendientes (no realizables en este entorno)

1. Contraste de las reglas con el documento SEFH original (propuestas P-1 a P-10).
2. Funcionamiento en la URL real de GitHub Pages (no se ha desplegado; se ha probado con un servidor local bajo la misma ruta `/cmorespiratorio/`). Confirmar en la configuración de Pages si se publica la raíz o `dist/` (ambas contienen la misma versión tras `npm run build`).
3. Navegadores distintos de Chromium (Firefox, Safari/iPad, Edge corporativo) y políticas del navegador hospitalario sobre portapapeles y descargas.
4. Pegado real en la historia clínica electrónica del centro.
5. Apertura del PDF en el visor institucional e impresión física.
6. Validación de usabilidad con farmacéuticos que no conozcan la herramienta.
7. Validación del extractor con un corpus de informes reales seudonimizados (sensibilidad/especificidad desconocidas).

## 8. Respuesta a los criterios de aceptación

1. **¿La estratificación funciona según las reglas documentadas?** Sí, tras corregir los defectos 1–5. Pendiente el contraste con la fuente original.
2. **¿Niveles coherentes con las variables?** Sí en los 11 casos ficticios y en todos los límites probados.
3. **¿Intervenciones consistentes?** Sí con la prioridad (acumulativas, tablas 1–3). No están dirigidas a factores concretos (P-8).
4. **¿Proceso completo sin obstáculos?** Sí en Chromium de escritorio, tableta y móvil.
5. **¿PDF completo, correcto, profesional y descargable?** Sí, con las limitaciones de verificación del §4.
6. **¿Copiar-pegar funciona y genera texto útil?** Sí en Chromium; pendiente la HCE real.
7. **¿Ambos informes concuerdan?** Sí, por construcción (misma estructura) y por prueba automática.
8. **¿Datos y privacidad controlados?** Técnicamente sí; persiste el riesgo de equipos compartidos y no hay evaluación legal.
9. **¿Pruebas y compilación funcionan?** Sí (34 + 9 pruebas; build OK).
10. **¿Qué impediría el uso clínico?** Validación del modelo frente a la fuente, decisiones P-1 a P-10, autorización institucional y protección de datos, y validación del extractor.

## 9. Conclusión

- **Apta para demostración con pacientes ficticios:** **SÍ.**
- **Apta técnicamente para pilotaje supervisado:** **SÍ, condicionada** a: (a) contrastar las reglas con el documento SEFH y resolver P-1 a P-5; (b) verificar el despliegue en GitHub Pages y en el navegador corporativo; (c) autorización institucional y valoración de protección de datos; (d) usar el análisis asistido solo como ayuda, siempre con revisión.
- **No apta para uso asistencial autónomo** en su estado actual: no dispone de validación clínica ni autorización; superar esta auditoría técnica no equivale a ninguna de las dos.
