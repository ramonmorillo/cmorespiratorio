# Auditoría y evaluación del analizador de texto clínico — v2.0.0 (octubre de 2026)

Ámbito: `src/extractor.js` (analizador local y determinista), su integración en el análisis asistido (`src/app.js`) y la transferencia al formulario. **No se han modificado** variables, dimensiones, puntuaciones, umbrales P1/P2/P3 ni excepciones de prioridad automática (`VARIABLES`, `DIMENSIONS`, `scoreVariable` y `calculate` de `src/clinical.js` sin cambios).

> **Advertencia metodológica.** Los 10 casos A–J son **sintéticos** y su referencia (*gold standard*) la ha definido el mismo equipo que escribió las reglas: existe riesgo de sobreajuste. Las métricas **no son una validación clínica externa**. Para validar hace falta un corpus independiente de informes reales seudonimizados con doble anotación ciega.

## 1. Problemas encontrados en el extractor v1.1.0 (por gravedad clínica)

| Gravedad | Problema | Corrección en v2.0 |
|---|---|---|
| Crítico | Ingresos y urgencias contados sin comprobar **periodo ni causa** («hace 2 años, 3 ingresos por neumonía» ⇒ criterio presente) | Recuento por episodio con periodo (último año) y causa respiratoria; exacerbaciones domiciliarias no computan |
| Crítico | Umbrales cuantitativos ignorados: «TAI 48», «MPR 0,92» o «FVC 55 %» no se evaluaban o se marcaban como positivos | Comparación numérica con los umbrales del modelo (TAI <45, MPR <0,8, FVC <50 %, DLCO <30 %, FEV1 <40 % en FQ, SNOT-22 >50, VAS >7, BSI >8, FACED >5, CAT >21, caída FVC ≥10 %, caída DLCO ≥15 %) |
| Alto | 10 de 22 variables sin reglas (45 % de sensibilidad en los casos de referencia) | Reglas para las 22 variables (algunas solo generan revisión) |
| Alto | Sin detección de contradicciones: se tomaba la primera mención | Evidencias incompatibles ⇒ «Contradictorio», sin propuesta |
| Alto | Antecedentes familiares tratados como «dudoso» con ventana fija de ±40 caracteres | «No atribuible al paciente» (análisis por cláusula y frase) |
| Alto | Negación de un subcriterio tomada como ausencia de una variable compuesta («sin oxigenoterapia» ⇒ gravedad No) | En variables compuestas la negación parcial genera revisión |
| Medio | Etiqueta de «certeza» (media/alta) sin validación empírica | Eliminada; se muestran la regla aplicada y la evidencia literal |
| Medio | Revisión mediante tarjetas sueltas, una a una | Tabla de 22 variables por dimensión, con confirmación individual o conjunta explícita |
| Medio | Sin trazabilidad de lo incorporado desde el texto | `form.provenance` (sin fragmentos de texto) e indicación en PDF y texto para HC |
| Bajo | Expresiones regulares de singular/plural incompletas («inhaladores?» no reconocía «inhalador») | Corregidas |

## 2. Matriz de cobertura de las 22 variables

*Propuesta firme* = el extractor preselecciona un valor (siempre requiere confirmación). *Revisión* = solo señala evidencia; decide el profesional. Sin evidencia, la variable queda **sin información** (nunca «No»).

| Dimensión | Variable | v1.1.0 | v2.0: propuesta firme cuando… | v2.0: solo revisión cuando… |
|---|---|---|---|---|
| Demográfica | Embarazo o puerperio | Sí | gestante, embarazo, puerperio, posparto; prueba de embarazo negativa ⇒ No | embarazos previos, deseo gestacional, sospecha |
| Demográfica | Edad | Frágil | edad explícita («72 años», «edad: 72», «varón 72a») | varias edades distintas (contradicción) o fuera de 0–120 |
| Demográfica | IMC | Sí | IMC explícito (coma o punto, kg/m²) | varios valores o fuera de 10–80; **no se calcula** a partir de peso y talla |
| Clínica | >1 patología respiratoria con medicación | No | ≥2 patologías afirmadas **y** tratamiento de ambas documentado; «sin otras patologías respiratorias» ⇒ No | ≥2 patologías sin requisito farmacoterapéutico explícito |
| Clínica | Comorbilidad no respiratoria con medicación | No | comorbilidad + tratamiento en la misma frase; «sin comorbilidades» ⇒ No | comorbilidad sin tratamiento; negación de una sola comorbilidad |
| Clínica | Trastorno mental con medicación específica | No | trastorno + tratamiento específico; «sin antecedentes psiquiátricos» ⇒ No | sin tratamiento; reactivo, transitorio o en remisión; sospecha. Familiar ⇒ no atribuible |
| Clínica | Deterioro cognitivo-sensorial | No | deterioro cognitivo, demencia, hipoacusia, ceguera, baja visión; «sin deterioro cognitivo ni sensorial» ⇒ No | negación de un solo componente; glaucoma o retinopatía |
| Clínica | Gravedad u oxigenoterapia | Parcial | oxigenoterapia, GOLD E, GesEPOC alto riesgo, clase funcional III–IV, asma grave no controlada, umbrales cuantitativos | valor que no cumple el umbral; FEV1 fuera de FQ; «sin oxigenoterapia»; «asma controlada» |
| Tratamiento | Falta de adherencia | Parcial | TAI <45, MPR <0,8, Morisky-Green no adherente, expresiones de mala adherencia; TAI ≥45, MPR ≥0,8 o adherencia documentada ⇒ No | «posible», contradicción entre fuentes |
| Tratamiento | Medicamentos que empeoran la patología | No | fármaco del anexo SEFH (p. 68) **pertinente para la patología** registrada o mencionada | sin patología; alergia o retirada; COX-2; descongestionantes (duración). Cardioselectivos fuera de RSCcPN: no se proponen |
| Tratamiento | Alto riesgo ISMP | No | anticoagulantes, insulinas, opioides, metotrexato (subconjunto MARC) | resto de grupos MARC (antiagregantes, corticoides orales, antipsicóticos…): verificar pauta y duración |
| Tratamiento | Objetivos farmacoterapéuticos | No | «no alcanzados», mal control, respuesta insuficiente, inicio reciente ⇒ No alcanzados; «alcanzados», buen control ⇒ Alcanzados | síntomas persistentes sin valoración de objetivos |
| Tratamiento | Polimedicación (≥6 principios activos) | Parcial | «N principios activos» o «N p.a.»; MRCI >11 | «N fármacos/medicamentos/envases», «polimedicado» |
| Tratamiento | Medicamentos hospitalarios complejos | Parcial | nebulizados, pluma, jeringa, autoinyector, SC, IV, perfusión, biológicos | solo inhaladores convencionales |
| Tratamiento | Naïve a terapia hospitalaria | No | «naïve», inicio de biológico; **EPOC confirmada ⇒ Sí (regla del modelo)**; tratamiento hospitalario previo ⇒ No | — |
| Tratamiento | Cambios en 6 meses | No | cambio con fecha ≤6 meses o «reciente / última visita»; «sin cambios en los últimos 6 meses» ⇒ No | cambio sin fecha o >6 meses; «sin cambios» sin periodo |
| Sociosanitaria | Tabaquismo activo | Frágil | fumador activo, fuma, cigarrillos/día; exfumador, no fumador, niega ⇒ No | tabaquismo pasivo, vapeo, solo paquetes-año; contradicción |
| Sociosanitaria | Alcoholismo o drogadicción | Sí | alcoholismo, enolismo, abuso, ADVP, cocaína; consumo ocasional o niega consumo problemático ⇒ No | consumo previo, cannabis |
| Sociosanitaria | Exposición laboral reiterada | Con falsos positivos | exposición laboral o profesional actual, oficios de riesgo | exposición pasada o jubilado, exposición doméstica (biomasa, leña), sin contexto laboral |
| Sociosanitaria | Condiciones socioeconómicas desfavorables | No | precariedad, dificultades económicas, exclusión, desempleo; «sin dificultades socioeconómicas» ⇒ No | vive solo, escaso apoyo, trabajo social |
| Sociosanitaria | Calidad de vida afectada | Parcial | EQ-5D-5L con problemas moderados o superiores, EQ-VAS <50, «calidad de vida afectada»; «buena calidad de vida» ⇒ No | EQ-VAS ≥50, EQ-5D sin problemas |
| Utilización | ≥2 ingresos y/o ≥2 urgencias (último año, causa respiratoria) | Sin periodo ni causa | recuento ≥2 en el último año por causa respiratoria; <2 ingresos **y** <2 urgencias documentados ⇒ No | periodo o causa no especificados; solo un tipo documentado; exacerbaciones domiciliarias |

Catálogos versionados en el código: `WORSENING_CATALOG` (anexo SEFH p. 68, por patología) e `ISMP_CATALOG` (subconjunto local de la lista MARC ISMP-España 2014; **pendiente de verificación farmacéutica frente a la versión vigente**).

## 3. Resultados antes y después (`npm run eval:extractor`)

| Métrica (10 casos × 22 variables = 220 decisiones) | v1.1.0 | v2.0 |
|---|---|---|
| Sensibilidad de detección (variables con información) | 45 % (36/80) | 98.8 % (79/80) |
| Valor predictivo positivo de detección | 100 % (36/36) | 100 % (79/79) |
| Falsos negativos de detección | 44 | 1 |
| Falsos positivos de detección | 0 | 0 |
| Propuestas firmes correctas / esperadas | 32/69 (46.4 %) | 68/69 (98.6 %) |
| Propuestas para revisión donde había dato firme (conservadoras) | 0 | 0 |
| Errores de negación (criterio afirmado cuando estaba negado o ausente) | 2 | 0 |
| Errores de polaridad totales | 2 | 0 |
| Errores de asignación de valor | 0 | 0 |
| Propuestas firmes indebidas (dudoso/contradictorio/sin dato) | 2 | 0 |
| Errores de puntuación (variables con puntos distintos a la referencia) | 4 | 0 |
| Casos con prioridad sobreestimada | 0 | 0 |

| Caso | Puntos referencia | Puntos v2.0 (si se confirman todas las propuestas firmes) | Prioridad ref./v2.0 | Discrepancias v2.0 | Discrepancias v1.1.0 |
|---|---|---|---|---|---|
| A. EPOC complejo, comorbilidades, polimedicación, tabaquismo y baja adherencia | 37 | 37 | P1 / P1 | — | 8 |
| B. Asma grave controlada, buena adherencia y ausencia explícita de factores | 2 | 2 | P3 / P3 | — | 13 |
| C. Fibrosis quística con IMC bajo | 13 | 13 | P3 / P3 | — | 2 |
| D. Información clínica incompleta | 1 | 1 | P3 / P3 | — | 1 |
| E. Negaciones y antecedentes familiares | 0 | 0 | P3 / P3 | — | 6 |
| F. Datos contradictorios | 1 | 1 | P3 / P3 | — | 4 |
| G. Embarazo con prioridad automática | 0 | 0 | P1 / P1 | — | 2 |
| H. Medicación potencialmente agravante | 9 | 6 | P3 / P3 | nonRespComorbidity: no detectado | 3 |
| I. Terminología abreviada y errores ortográficos | 22 | 22 | P2 / P2 | — | 6 |
| J. Ingresos y urgencias en distintos periodos y por distintas causas | 3 | 3 | P3 / P3 | — | 3 |

Definiciones:
- **Detección**: la variable tiene información en la referencia (valor firme o revisión) y el extractor la señala.
- **Propuesta firme indebida**: el extractor preselecciona un valor donde la referencia exige revisión o no hay dato.
- **Error de puntuación**: variable cuyas propuestas firmes, si se confirmaran, darían puntos distintos de la referencia.
- **Prioridad sobreestimada**: confirmar todas las propuestas firmes daría una prioridad superior a la de la referencia.

Falso negativo residual (caso H): «artrosis» y «temblor esencial» tratados farmacológicamente no figuran en la lista local de comorbilidades. No se corrige para no sobreajustar a la referencia; el profesional lo completa manualmente.

## 4. Integración y seguridad (verificado con pruebas automatizadas)

1. Las propuestas aceptadas pasan al formulario (E2E: edad 70, IMC 31,5, tabaquismo No, naïve Sí).
2. Las descartadas no modifican valores (E2E).
3. La confirmación conjunta **no sobrescribe** respuestas profesionales previas; la individual pide confirmación explícita para sustituir (E2E).
4. Los casos incompletos siguen provisionales; la ausencia de información nunca se convierte en «No» (unitaria y E2E).
5. Puntuación y prioridades: motor clínico sin cambios; 0 errores de puntuación en A–J.
6. El PDF y el texto para historia clínica se generan solo desde el formulario: las propuestas no confirmadas no aparecen. Se indica cuántas variables proceden del análisis asistido.
7. El texto pegado se borra tras el análisis y no se guarda. `form.provenance` solo almacena variable, decisión, regla y fecha (sin fragmentos).
8. Sin red: 0 peticiones externas (E2E) y control automático en `npm run build`.

## 5. Riesgos residuales y limitaciones del enfoque determinista

- Las listas de términos y fármacos no son exhaustivas: habrá falsos negativos con sinónimos, nombres comerciales o redacciones no previstas.
- Errores ortográficos: solo se toleran variantes frecuentes (sin acentos, «bronquiectasis», abreviaturas habituales). No hay corrección ortográfica difusa.
- Ámbito de la negación: por cláusula y frase; dobles negaciones, negaciones a distancia o listas largas pueden escapar.
- Temporalidad: solo «hace N…», «último año», «últimos N meses» y similares; las fechas absolutas sin referencia no se interpretan.
- No se calculan valores derivados (IMC desde peso y talla; número de principios activos desde un listado).
- El catálogo ISMP es un subconjunto local y debe verificarse frente a la lista vigente antes del uso clínico.
- Las métricas proceden de 10 casos sintéticos redactados con conocimiento de las reglas.

## 6. Pendiente antes del uso clínico

- Validación con un corpus independiente de informes reales seudonimizados (orientativo: 50–100 informes, doble anotación ciega, concordancia y sensibilidad/VPP por variable).
- Verificación farmacéutica de los catálogos (anexo SEFH p. 68 y lista ISMP vigente).
- Decisión clínica sobre las propuestas P-1 a P-10 del informe de auditoría pre-entrega.
