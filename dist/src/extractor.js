import {VARIABLES, PATHOLOGIES, scoreVariable} from './clinical.js';

// Extractor local y determinista (sin red, sin IA). Propone; nunca decide.
// Cada propuesta conserva su evidencia literal y requiere confirmación profesional.
// Estados: detectado (propuesta firme), ausencia_explicita (propuesta "No" firme), dudoso (revisión),
// contradictorio (evidencias incompatibles), no_atribuible (referido a un familiar), no_mencionado.
export const EXTRACTOR_VERSION = '2.0.0';
export const NETWORK_FREE = true;

// ---------------------------------------------------------------------------------------------
// Utilidades de texto
const normalize = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NUM_WORDS = {un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, ningun: 0, ninguno: 0, ninguna: 0};
const NUM = '(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
const toNumber = s => { if (s === undefined || s === null) return null; const k = String(s).trim(); if (k in NUM_WORDS) return NUM_WORDS[k]; const n = Number(k.replace(',', '.')); return Number.isFinite(n) ? n : null; };
const SENTENCE_SEP = /[.;\n]\s|[;\n]|\.$/g;
const CLAUSE_SEP = /[.;:,\n()]|\s(?:pero|aunque|sin embargo|mientras que|y)\s/g;

function lastBoundary(t, index, re) { let pos = 0; re.lastIndex = 0; let m; while ((m = re.exec(t)) && m.index < index) { pos = m.index + m[0].length; if (m[0].length === 0) re.lastIndex++; } return pos; }
function nextBoundary(t, index, re) { re.lastIndex = index; const m = re.exec(t); return m ? m.index : t.length; }

/** Contexto lingüístico de una coincidencia: cláusula previa (para negaciones), frase completa (incertidumbre, periodo). */
function contextOf(t, m) {
  const start = m.index, end = m.index + m[0].length;
  const sStart = lastBoundary(t, start, SENTENCE_SEP), sEnd = nextBoundary(t, end, SENTENCE_SEP);
  const cStart = Math.max(sStart, lastBoundary(t, start, CLAUSE_SEP));
  return {start, end, sStart, sEnd, sentence: t.slice(sStart, sEnd), before: t.slice(Math.max(cStart, start - 45), start), sentenceBefore: t.slice(Math.max(sStart, start - 80), start), after: t.slice(end, Math.min(sEnd, end + 40))};
}
const NEGATION_AFTER = /^\s*(descartad[oa]s?|negativ[oa]s?|ausentes?|excluid[oa]s?)\b/;
const NEGATION = /(?:^|[^a-z])(no|niega|sin|ni|nunca|descarta|descartad[oa]s?|se descarta|ausencia de|negativ[oa] para|libre de)\b(?!\s+se\s+descart)[^]*$/;
const UNCERTAIN = /(sospech|posible|probable|dudos|a descartar|no se (puede )?descart|sin descartar|pendiente de (confirmar|valorar|estudio|diagnostico)|en estudio|a valorar|compatible con|\?)/;
const FAMILY_NEAR = /(antecedentes? familiar|\baf\b|\b(madre|padre|herman[oa]s?|hij[oa]s?|abuel[oa]s?|ti[oa]s?|prim[oa]s?|conyuge|pareja|marido|esposa?)\b)/;
const FAMILY_SENTENCE = /(antecedentes? familiares?|\baf\s*:)/;

function polarityOf(ctx, rule) {
  if (UNCERTAIN.test(ctx.sentence)) return 'review';
  if (rule.family !== false && (FAMILY_NEAR.test(ctx.before) || FAMILY_SENTENCE.test(ctx.sentenceBefore) || /^\s*\((madre|padre|herman|hij|abuel)/.test(ctx.after))) return 'family';
  if (rule.negatable !== false && (NEGATION.test(ctx.before) || NEGATION_AFTER.test(ctx.after))) return rule.negated || 'no';
  return rule.on;
}

// ---------------------------------------------------------------------------------------------
// Catálogos locales trazables
// Medicamentos que pueden empeorar la patología respiratoria: anexo del documento SEFH (p. 68), por patología.
const OBSTRUCTIVE = ['asthma', 'copd', 'crsnp'];
export const WORSENING_CATALOG = [
  {re: /\b(propranolol|nadolol|sotalol|timolol|carvedilol|labetalol|pindolol)\b/, label: 'β-bloqueante no cardioselectivo', pathologies: OBSTRUCTIVE},
  {re: /\b(bisoprolol|atenolol|metoprolol|nebivolol)\b/, label: 'β-bloqueante cardioselectivo (solo incluido en el anexo para RSCcPN)', pathologies: ['crsnp']},
  {re: /\b(ieca|enalapril|lisinopril|ramipril|captopril|perindopril|quinapril|fosinopril|trandolapril|benazepril|cilazapril|zofenopril|imidapril)\b/, label: 'IECA', pathologies: OBSTRUCTIVE},
  {re: /\b(aines?|ibuprofeno|naproxeno|diclofenaco|dexketoprofeno|ketoprofeno|indometacina|meloxicam|piroxicam|aceclofenaco|ketorolaco)\b/, label: 'AINE', pathologies: ['asthma', 'crsnp']},
  {re: /\b(aas|acido acetilsalicilico|aspirina|adiro)\b/, label: 'AAS (anexo RSCcPN; en asma, valorar como AINE)', pathologies: ['crsnp'], reviewFor: ['asthma']},
  {re: /\b(celecoxib|etoricoxib)\b/, label: 'Inhibidor selectivo COX-2 (no incluido expresamente en el anexo)', pathologies: [], reviewFor: ['asthma', 'crsnp']},
  {re: /\b(oximetazolina|xilometazolina|nafazolina|tramazolina|descongestionantes? nasal(es)?)\b/, label: 'Descongestionante nasal (criterio: uso >3–5 días)', pathologies: [], reviewFor: ['crsnp']},
  {re: /\b(clorpromazina|gabapentina|sildenafilo|tadalafilo|vardenafilo|avanafilo|anticonceptiv[oa]s?|etinilestradiol|cocaina)\b/, label: 'Fármaco del anexo para RSCcPN', pathologies: ['crsnp']},
  {re: /\b(adalimumab|amiodarona|bleomicina|certolizumab|erlotinib|etanercept|infliximab|nivolumab|pembrolizumab|atezolizumab|durvalumab|ipilimumab|cemiplimab|interferon gamma|metotrexato|mitomicina|paclitaxel|pemetrexed|penicilamina)\b/, label: 'Fármaco del anexo para FPI/EPID', pathologies: ['ipf', 'ild']}
];
// Alto riesgo en pacientes crónicos: subconjunto local de la lista MARC (ISMP-España, 2014). Catálogo v2.0,
// pendiente de verificación farmacéutica frente a la versión vigente. "core" => propuesta firme; resto => revisión.
export const ISMP_CATALOG_VERSION = 'MARC ISMP-España 2014 · subconjunto local v2.0 (pendiente de verificación)';
export const ISMP_CATALOG = [
  {re: /\b(acenocumarol|sintrom|warfarina|apixaban|rivaroxaban|edoxaban|dabigatran|anticoagulante oral|enoxaparina|bemiparina|tinzaparina|heparina)\b/, label: 'Anticoagulante', core: true},
  {re: /\b(insulinas?|glargina|detemir|degludec|insulina aspart|lispro|glulisina)\b/, label: 'Insulina', core: true},
  {re: /\b(morfina|fentanilo|oxicodona|tapentadol|hidromorfona|buprenorfina|metadona|tramadol|opioides?)\b/, label: 'Opioide', core: true},
  {re: /\bmetotrexato\b/, label: 'Metotrexato oral (uso no oncológico)', core: true},
  {re: /\b(clopidogrel|prasugrel|ticagrelor|antiagregante)/, label: 'Antiagregante plaquetario'},
  {re: /\b(glibenclamida|gliclazida|glimepirida|glipizida|repaglinida|sulfonilurea)/, label: 'Antidiabético oral (secretagogo)'},
  {re: /\b(carbamazepina|fenitoina|acido valproico|valproato|fenobarbital)\b/, label: 'Antiepiléptico de estrecho margen'},
  {re: /\b(prednisona|metilprednisolona|deflazacort|corticoides? oral(es)?|corticoterapia oral)\b/, label: 'Corticoide sistémico (alto riesgo si ≥3 meses)'},
  {re: /\b(digoxina|amiodarona|dronedarona)\b/, label: 'Antiarrítmico / digoxina'},
  {re: /\b(furosemida|torasemida|espironolactona|eplerenona)\b/, label: 'Diurético de asa / antialdosterónico'},
  {re: /\b(tacrolimus|ciclosporina|micofenolato|azatioprina|everolimus|sirolimus)\b/, label: 'Inmunosupresor'},
  {re: /\b(quetiapina|olanzapina|risperidona|haloperidol|aripiprazol|clozapina|antipsicotico)/, label: 'Antipsicótico'},
  {re: /\b(lorazepam|alprazolam|diazepam|clonazepam|lormetazepam|zolpidem|benzodiacepina)/, label: 'Benzodiacepina o análogo'}
];
const PATHOLOGY_RULES = {
  asthma: /\basma\b/, copd: /\b(epoc|enfermedad pulmonar obstructiva cronica|enfisema|bronquitis cronica|deficit de alfa-?1)/, crsnp: /(rinosinusitis cronica|poliposis nasal|polipos nasales|rsccpn)/,
  cf: /(fibrosis quistica|\bfq\b|mucoviscidosis)/, bronchiectasis: /bronquiectasi/, ipf: /(fibrosis pulmonar idiopatica|\bfpi\b)/,
  ild: /(\bepid\b|enfermedad pulmonar intersticial|neumopatia intersticial|fibrosis pulmonar(?! idiopatica))/, ph: /(hipertension (arterial )?pulmonar|\bhap\b|\bhtp\b)/
};
const HOSPITAL_DRUGS = 'omalizumab|mepolizumab|benralizumab|reslizumab|dupilumab|tezepelumab|biologico|pirfenidona|nintedanib|ivacaftor|lumacaftor|tezacaftor|elexacaftor|bosentan|ambrisentan|macitentan|riociguat|selexipag|treprostinil|epoprostenol|iloprost|tobramicina|colistimetato|colistina|aztreonam|dornasa';
const TREATMENT_CUE = /(en tratamiento|en tto|tto\.? con|tratad[oa]|controlad[oa] con|toma |recibe |\b\w+(pril|sartan|olol|statina|gliptina|gliflozina|formina|dipino|semida|tiazida)\b|insulina|levotiroxina|alopurinol|acenocumarol|apixaban|rivaroxaban|edoxaban|dabigatran|antihipertensiv|antidiabetic|hipolipemiante)/;
const PSY_TREATMENT_CUE = /(en tratamiento|en tto|tratad|antidepresiv|ansiolitic|antipsicotic|isrs|sertralina|escitalopram|citalopram|fluoxetina|paroxetina|venlafaxina|duloxetina|mirtazapina|trazodona|bupropion|quetiapina|olanzapina|risperidona|aripiprazol|haloperidol|litio|lamotrigina|lorazepam|alprazolam|diazepam|clonazepam|lormetazepam|metilfenidato)/;

// ---------------------------------------------------------------------------------------------
// Reglas por variable. Cada patrón: re (sin flag g), on (propuesta si se afirma), negated (si se niega),
// negatable/family (desactivar comprobaciones), when(ctx, m, env) -> {proposal|polarity, value, finding, rule} opcional.
const R = (re, on, rule, extra = {}) => ({re, on, rule, ...extra});
const RULES = {
  pregnancyPuerperium: [
    R(/\b(test|prueba) de embarazo negativ[oa]\b/, 'no', 'Prueba de embarazo negativa', {negatable: false}),
    R(/\b(embarazos? previos?|gestaciones previas|deseo gestacional|planifica(ndo)? embarazo)\b/, 'review', 'Mención obstétrica no actual', {negatable: false}),
    R(/\b(embarazada|gestante|embarazo|gestacion|semanas de gestacion|puerperio|puerpera|posparto|postparto)\b/, 'yes', 'Embarazo o puerperio documentado')
  ],
  age: [R(/(?:\bedad\s*(?:de|:|=)?\s*(\d{1,3})\b|\b(?:varon|mujer|hombre|paciente|nino|nina|chico|chica|senor|senora)\s*,?\s*(?:de\s+)?(\d{1,3})\s*(?:anos|a)\b|\b(\d{1,3})\s*anos\s+de\s+edad\b|\b(\d{1,3})\s*(?:anos|a)\s*,?\s*(?:varon|mujer|hombre)\b)/, 'set_age', 'Edad explícita', {negatable: false, family: false,
    when: (ctx, m) => { const n = toNumber(m.slice(1).find(Boolean)); return n === null || n > 120 ? {polarity: 'review', rule: 'Edad fuera de rango plausible'} : {value: n, finding: `${n} años`}; }})],
  bmi: [R(/\b(?:imc|indice de masa corporal|bmi)\s*(?:actual\s*)?(?:de|:|=)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\b/, 'set_bmi', 'IMC explícito', {negatable: false, family: false,
    when: (ctx, m) => { const n = toNumber(m[1]); return n < 10 || n > 80 ? {polarity: 'review', rule: 'IMC fuera de rango plausible'} : {value: n, finding: `IMC ${String(n).replace('.', ',')}`}; }})],
  respComorbidity: [R(/\bsin otras (patologias|enfermedades) respiratorias\b/, 'no', 'Ausencia explícita de otras patologías respiratorias', {negatable: false})],
  nonRespComorbidity: [
    R(/\b(sin (otras )?comorbilidades|sin otros antecedentes( medicos| personales)?( de interes)?|no (presenta|tiene) comorbilidades)\b/, 'no', 'Ausencia explícita de comorbilidades', {negatable: false}),
    R(/(\bhta\b|hipertension arterial(?! pulmonar)|diabetes( mellitus)?|\bdm ?[12]?\b|dislipemia|dislipidemia|hipercolesterolemia|\bdlp\b|insuficiencia cardiaca|cardiopatia|fibrilacion auricular|insuficiencia renal|enfermedad renal cronica|\berc\b|hipotiroidismo|hipertiroidismo|osteoporosis|artritis reumatoide|epilepsia|parkinson|reflujo gastroesofagico|\berge\b|hiperuricemia|\bvih\b|neoplasia|cancer)/, 'yes', 'Comorbilidad no respiratoria', {negated: 'review',
      when: ctx => TREATMENT_CUE.test(ctx.sentence) ? {rule: 'Comorbilidad no respiratoria con tratamiento documentado'} : {polarity: 'review', rule: 'Comorbilidad mencionada sin tratamiento farmacológico documentado'}})
  ],
  mentalDisorder: [
    R(/\b(sin (antecedentes|patologia|trastornos?) psiquiatric|sin patologia mental)/, 'no', 'Ausencia explícita de patología psiquiátrica', {negatable: false}),
    R(/(depresion|trastorno depresivo|sindrome depresivo|trastorno de ansiedad|ansiedad generalizada|\bansiedad\b|trastorno bipolar|esquizofrenia|psicosis|trastorno psicotico|\btdah\b|trastorno de (la )?personalidad|trastorno obsesivo|\btoc\b|anorexia nerviosa|bulimia|trastorno mental)/, 'yes', 'Trastorno mental', {
      when: ctx => /(reactiv|transitori|puntual|en remision|resuelt|previo|pasad)/.test(ctx.sentence) ? {polarity: 'review', rule: 'Trastorno posiblemente transitorio o resuelto'} : PSY_TREATMENT_CUE.test(ctx.sentence) ? {rule: 'Trastorno mental con tratamiento específico documentado'} : {polarity: 'review', rule: 'Trastorno mental sin tratamiento específico documentado'}})
  ],
  cognitiveSensory: [
    R(/\bsin deterioro (cognitivo[- ]sensorial|cognitivo ni sensorial|cognitivo ni (deficit )?sensorial)\b/, 'no', 'Ausencia explícita de deterioro cognitivo-sensorial', {negatable: false}),
    R(/(deterioro cognitivo|demencia|alzheimer|hipoacusia|sordera|ceguera|baja vision|deficit (visual|auditivo|cognitivo|sensorial)|amaurosis)/, 'yes', 'Deterioro cognitivo o sensorial documentado', {negated: 'review'}),
    R(/(glaucoma|retinopatia|degeneracion macular|catarata)/, 'review', 'Patología ocular: verificar déficit funcional')
  ],
  severityOxygen: [
    R(/(oxigenoterapia|oxigeno ?terapia|\bocd\b|\bo2 domicil|oxigeno domicil|oxigeno cronico)/, 'yes', 'Necesidad de oxigenoterapia', {negated: 'review'}),
    R(/(asma (grave )?(no controlada|mal controlada|no control)|gold e\b|gesepoc (de )?alto riesgo|alto riesgo (segun )?gesepoc|clase funcional (iii|iv|3|4)\b|\bcf (iii|iv)\b)/, 'yes', 'Criterio de gravedad del modelo', {negated: 'review'}),
    R(/(caida|descenso|disminucion|perdida) (de (la )?)?(fvc|cvf)[^.;\d]{0,20}(\d+(?:[.,]\d+)?)\s*%/, 'yes', 'Caída de FVC', {negated: 'review', when: (ctx, m) => toNumber(m[5]) >= 10 ? {finding: `Caída FVC ${m[5]} %`, rule: 'Caída de FVC ≥10 %'} : {polarity: 'review', finding: `Caída FVC ${m[5]} %`, rule: 'Caída de FVC <10 %: no cumple este criterio'}}),
    R(/(caida|descenso|disminucion|perdida) (de (la )?)?dlco[^.;\d]{0,20}(\d+(?:[.,]\d+)?)\s*%/, 'yes', 'Caída de DLCO', {negated: 'review', when: (ctx, m) => toNumber(m[4]) >= 15 ? {finding: `Caída DLCO ${m[4]} %`, rule: 'Caída de DLCO ≥15 %'} : {polarity: 'review', finding: `Caída DLCO ${m[4]} %`, rule: 'Caída de DLCO <15 %: no cumple este criterio'}}),
    R(/\b(snot-?22|vas|eva nasal|fvc|cvf|dlco|fev1|vems|bsi|faced|cat)\b[^.;\d\n]{0,25}?(\d+(?:[.,]\d+)?)/, 'yes', 'Parámetro cuantitativo de gravedad', {negated: 'review', when: (ctx, m, env) => severityThreshold(m, ctx, env)}),
    R(/(asma (grave )?(bien )?controlada|sin oxigenoterapia)/, 'review', 'Información parcial: no excluye otros criterios de gravedad', {negatable: false})
  ],
  nonAdherence: [
    R(/\btai(?:[- ]?1[02])?\b[^.;\d\n]{0,20}(\d{1,2})\b/, 'yes', 'TAI', {negatable: false, when: (ctx, m) => toNumber(m[1]) < 45 ? {finding: `TAI ${m[1]}`, rule: 'TAI <45 (criterio del modelo en asma grave/EPOC)'} : {proposal: 'no', finding: `TAI ${m[1]}`, rule: 'TAI ≥45: no cumple el criterio de falta de adherencia'}}),
    R(/\bmpr\b[^;\d\n]{0,15}(\d+(?:[.,]\d+)?)\s*(%)?/, 'yes', 'MPR', {negatable: false, when: (ctx, m) => { let v = toNumber(m[1]); if (m[2] || v > 1) v = v / 100; const shown = String(v).replace('.', ','); return v < 0.8 ? {finding: `MPR ${shown}`, rule: 'MPR <0,8'} : {proposal: 'no', finding: `MPR ${shown}`, rule: 'MPR ≥0,8: no cumple el criterio'}; }}),
    R(/morisky(?:-green)?(?:-levine)?[^.;\n]{0,40}?(no adherente|incumplidor|no cumplidor|positivo|negativo|adherente|cumplidor)/, 'yes', 'Morisky-Green-Levine', {negatable: false, when: (ctx, m) => /^(no adherente|incumplidor|no cumplidor|positivo)$/.test(m[1]) ? {finding: `Morisky-Green: ${m[1]}`} : {proposal: 'no', finding: `Morisky-Green: ${m[1]}`, rule: 'Morisky-Green-Levine compatible con adherencia'}}),
    R(/((mala|baja|escasa|irregular|deficiente|insuficiente|pobre) adherencia|no adherente|falta de adherencia|incumplimiento( terapeutico)?|no cumplidor|olvidos (frecuentes|habituales)|olvida (con frecuencia|dosis|tomas)|abandon(o|a) (del|el) tratamiento|no toma (la|su) medicacion)/, 'yes', 'Expresión clínica de falta de adherencia', {negated: 'no'}),
    R(/((buena|correcta|adecuada|optima|excelente) adherencia|adherencia (buena|correcta|adecuada|optima)|adherente al tratamiento|\badherente\b|buen cumplimiento|\bcumplidor[a]?\b)/, 'no', 'Adherencia documentada', {negated: 'review'})
  ],
  worseningMeds: [R(new RegExp(WORSENING_CATALOG.map(c => c.re.source).join('|')), 'yes', 'Medicamento del anexo', {negated: 'review', when: (ctx, m, env) => catalogMatch(m[0], ctx, env)})],
  ismpHighRisk: [R(new RegExp(ISMP_CATALOG.map(c => c.re.source).join('|')), 'yes', 'Medicamento de alto riesgo', {negated: 'review', family: false, when: (ctx, m) => ismpMatch(m[0], ctx)})],
  pharmGoals: [
    R(/(objetivos? (farmacoterapeuticos? |terapeuticos? )?no (alcanzados?|conseguidos?|logrados?|cumplidos?)|no (alcanza|ha alcanzado|consigue|logra) (los )?objetivos|mal control|control (insuficiente|inadecuado|deficiente|suboptimo)|no controlad[ao]|respuesta (insuficiente|parcial|inadecuada)|fracaso (terapeutico|del tratamiento)|inicio reciente de(l)? tratamiento|inicia(do)? (recientemente )?(el )?tratamiento)/, 'no', 'Objetivos farmacoterapéuticos no alcanzados o inicio reciente', {negatable: false}),
    R(/(objetivos? (farmacoterapeuticos? |terapeuticos? )?(alcanzados?|cumplidos?|conseguidos?|logrados?)|buen control|bien controlad[ao]|control (adecuado|optimo|correcto|total)|\bcontrolad[ao]\b|respuesta (completa|adecuada|favorable))/, 'yes', 'Objetivos farmacoterapéuticos alcanzados', {negated: 'review'}),
    R(/(persistencia de (los )?sintomas|sintomas persistentes|persiste (la )?(disnea|tos|clinica)|exacerbaciones frecuentes)/, 'review', 'Síntomas persistentes: no equivale por sí solo a objetivos no alcanzados', {negatable: false})
  ],
  polypharmacy: [
    R(new RegExp(`\\b${NUM}\\s+(?:principios activos|p\\.?a\\.?(?=\\s|$|[,.;]))`), 'yes', 'Número de principios activos', {negatable: false, when: (ctx, m) => { const n = toNumber(m[1]); return n >= 6 ? {finding: `${n} principios activos`} : {proposal: 'no', finding: `${n} principios activos`, rule: '<6 principios activos'}; }}),
    R(new RegExp(`\\b${NUM}\\s+(farmacos|medicamentos|medicaciones|envases|especialidades|productos)\\b`), 'review', 'Recuento de medicamentos', {negatable: false, when: (ctx, m) => ({finding: `${toNumber(m[1])} ${m[2]}`, rule: 'El recuento no está expresado en principios activos: verificar'})}),
    R(/mrci[^.;\d\n]{0,10}(\d+(?:[.,]\d+)?)/, 'yes', 'MRCI', {negatable: false, when: (ctx, m) => toNumber(m[1]) > 11 ? {finding: `MRCI ${m[1]}`, rule: 'MRCI >11 (criterio complementario)'} : {polarity: 'review', finding: `MRCI ${m[1]}`, rule: 'MRCI ≤11: verificar número de principios activos'}}),
    R(/(polimedicad[oa]|polimedicacion|polifarmacia)/, 'review', 'Término genérico de polimedicación: verificar ≥6 principios activos', {negated: 'no'})
  ],
  complexHospitalMeds: [
    R(new RegExp(`(nebuliza(do|da|dor|cion|ciones)|via nebulizada|autoinyector|pluma precargada|\\bpluma\\b|jeringa precargada|via subcutanea|subcutane[ao]|perfusion|intravenos[ao]|\\bvia iv\\b|\\bi\\.v\\.|bomba de infusion|infusor|omalizumab|mepolizumab|benralizumab|reslizumab|dupilumab|tezepelumab|treprostinil|epoprostenol|dornasa|colistimetato|tobramicina inhalada|aztreonam (lisina )?inhalado)`), 'yes', 'Medicamento que requiere dispositivo o manipulación', {negated: 'review'}),
    R(/(inhalador(es)?|cartucho presurizado|polvo seco|camara espaciadora|turbuhaler|accuhaler|ellipta|respimat|breezhaler|nexthaler|spiromax)/, 'review', 'Inhaladores convencionales: no cumplen el criterio por sí solos', {negatable: false})
  ],
  naiveHospitalTherapy: [
    R(new RegExp(`(\\bnaive\\b|sin tratamiento hospitalario previo|no ha recibido (previamente )?(tratamiento|terapia)s? (de uso )?hospitalari|primera dispensacion|inicio de (tratamiento con )?(${HOSPITAL_DRUGS})|inicia (tratamiento con )?(${HOSPITAL_DRUGS}))`), 'yes', 'Paciente naïve a terapia hospitalaria', {negatable: false}),
    R(new RegExp(`(previamente tratad[oa] con|tratamiento previo con|cambio de (biologico|${HOSPITAL_DRUGS})|\\bswitch\\b|(en )?(tratamiento|tto\\.?) con (${HOSPITAL_DRUGS})[^.;]{0,30}desde)`), 'no', 'Tratamiento hospitalario previo documentado', {negatable: false})
  ],
  medicationChanges6m: [
    R(/(sin cambios (en el |de |del )?(tratamiento|medicacion)?\s*(en|durante) (los |el )?(ultimos? )?(6|seis|doce|12) meses|sin cambios (en el |de |del )?(tratamiento|medicacion)?\s*en el ultimo ano|tratamiento estable desde hace (mas de )?(\d+|un|uno|dos|tres) anos?)/, 'no', 'Ausencia de cambios en el periodo', {negatable: false}),
    R(/(sin cambios (en el |de |del )?(tratamiento|medicacion)|tratamiento estable)/, 'review', 'Sin cambios: periodo no especificado', {negatable: false}),
    R(/(se (inicia|anade|suspende|retira|cambia|modifica|ajusta|aumenta|reduce|sustituye|introduce)|cambio de (tratamiento|inhalador|dispositivo|dosis|biologico|pauta)|ajuste de (dosis|tratamiento)|inicio de (tratamiento|terapia)|nueva prescripcion|suspension de|modificacion del tratamiento)/, 'yes', 'Cambio de medicación', {negatable: false, when: ctx => changePeriod(ctx.sentence)})
  ],
  activeSmoking: [
    R(/(ex-?\s?fumador(a)?|extabaquismo|ex tabaquismo|tabaquismo (previo|pasado|abandonado|inactivo)|dejo de fumar|no fumador(a)?|nunca (ha )?fumad[oa]|nunca fumador(a)?|niega (habito )?tabaquic|niega tabaquismo|no fuma\b)/, 'no', 'No fumador o exfumador', {negatable: false}),
    R(/(fumador(a)? pasiv[oa]|tabaquismo pasivo|vapea|cigarrillo electronico|vapeador)/, 'review', 'Exposición pasiva o vapeo: no equivale a tabaquismo activo', {negatable: false}),
    R(/(fumador(a)? activ[oa]|tabaquismo activo|(?<!ex)(?<!ex-)(?<!ex )\bfumador(a)?\b|\bfuma\b|cigarrillos? (al|\/|por|diarios|cada) ?(dia)?|cig\/dia|\bfumando\b)/, 'yes', 'Tabaquismo activo', {negated: 'no'}),
    R(/(paquetes?[- ]anos?|\bipa\b)/, 'review', 'Índice paquetes-año sin estado actual', {negatable: false})
  ],
  alcoholDrugs: [
    R(/(bebedor(a)? ocasional|consumo (ocasional|social|esporadico|moderado|leve) de alcohol|alcohol (de forma )?ocasional|no (bebe|consume alcohol)|abstemi[oa]|niega (consumo|habitos) (de )?(toxicos|alcohol|drogas)|niega (el )?consumo problematico|sin habitos toxicos|no habitos toxicos|niega habitos toxicos)/, 'no', 'Consumo ocasional o ausencia de consumo problemático', {negatable: false}),
    R(/(exenolismo|ex-?enolismo|ex-?alcoholic|exadvp|ex-?advp|alcoholismo en remision|deshabituad)/, 'review', 'Consumo previo: verificar si es activo', {negatable: false}),
    R(/(\bcannabis\b|\bporros?\b|marihuana)/, 'review', 'Consumo de cannabis: verificar patrón de adicción', {negatable: false}),
    R(/(alcoholismo|enolismo|etilismo|dependencia (alcoholica|al alcohol|del alcohol)|abuso de (alcohol|sustancias|drogas)|consumo (perjudicial|de riesgo|excesivo|problematico) de alcohol|trastorno por (uso|consumo) de (alcohol|sustancias)|drogadiccion|adiccion a|\badvp\b|consumo (activo |habitual )?de (cocaina|heroina|drogas)|cocainomano|politoxicoman)/, 'yes', 'Alcoholismo o drogadicción', {negated: 'no'})
  ],
  occupationalExposure: [
    R(/\bsin exposicion (laboral|profesional|ocupacional)\b/, 'no', 'Ausencia explícita de exposición laboral', {negatable: false}),
    R(/(humo de lena|biomasa|cocina (de|con) lena|estufa de lena|brasero)/, 'review', 'Exposición doméstica: no es exposición laboral', {negatable: false}),
    R(/(exposicion (laboral|profesional|ocupacional)|trabaj(a|o|aba|ado) (en|como) [^.;]{0,40}(mina|miner|construccion|cantera|soldad|carpinter|agricult|granja|ganader|panader|peluquer|limpieza|pintor|fundicion|textil|quimic|amianto|silice)|\bminero\b|\bsoldador\b|amianto|asbesto|\bsilice\b|exposicion a (humos|polvo|gases|vapores|particulas))/, 'yes', 'Exposición laboral', {negated: 'no',
      when: ctx => /(previa|pasada|antigua|jubilad|hace (\d+|un|dos|tres|cuatro|cinco|diez) anos|durante (\d+|un|dos|tres|cuatro|cinco|diez) anos|trabajo (previo|anterior)|anteriormente)/.test(ctx.sentence) ? {polarity: 'review', rule: 'Exposición pasada: verificar si es reiterada y actual'} : !/(laboral|profesional|ocupacional|trabaj|miner|soldador)/.test(ctx.sentence) ? {polarity: 'review', rule: 'Exposición sin contexto laboral documentado'} : {}})
  ],
  socioeconomic: [
    R(/(sin (dificultades|problemas) (socioeconomic|economic)|situacion socioeconomica (adecuada|estable|buena|favorable)|buena situacion socioeconomica)/, 'no', 'Situación socioeconómica no desfavorable', {negatable: false}),
    R(/(vive sol[oa]|sin apoyo (familiar|social)|escaso apoyo|apoyo sociofamiliar (escaso|insuficiente)|trabajador(a)? social|trabajo social)/, 'review', 'Indicador social indirecto: verificar condición socioeconómica', {negatable: false}),
    R(/(situacion (socioeconomica|social|economica) (desfavorable|precaria|dificil)|precariedad|dificultades (economicas|socioeconomicas)|bajos (recursos|ingresos)|sin recursos|riesgo de exclusion|exclusion social|sin hogar|indigen|no puede (costear|pagar|permitirse)|desemplead[oa]|\ben paro\b|problematica social|vulnerabilidad social)/, 'yes', 'Condición socioeconómica desfavorable', {negated: 'no'})
  ],
  qualityOfLife: [
    R(/eq-?5d(?:-?5l)?[^.;\n]{0,60}?(problemas? (moderados?|graves?|severos?|extremos?)|sin problemas)/, 'yes', 'EQ-5D-5L', {negatable: false, when: (ctx, m) => /sin problemas/.test(m[1]) ? {polarity: 'review', finding: 'EQ-5D-5L sin problemas', rule: 'EQ-5D-5L sin problemas: verificar EQ-VAS'} : {finding: `EQ-5D-5L: ${m[1]}`, rule: 'EQ-5D-5L con problemas moderados o superiores'}}),
    R(/(eq-?vas|valoracion (global )?del estado de salud|escala visual analogica del eq)[^.;\d\n]{0,20}(\d{1,3})/, 'yes', 'EQ-VAS', {negatable: false, when: (ctx, m) => toNumber(m[2]) < 50 ? {finding: `EQ-VAS ${m[2]}`, rule: 'Valoración <50'} : {polarity: 'review', finding: `EQ-VAS ${m[2]}`, rule: 'Valoración ≥50: verificar dimensiones EQ-5D'}}),
    R(/(buena calidad de vida|calidad de vida (conservada|buena|no afectada|preservada)|sin afectacion de (la |su )?calidad de vida)/, 'no', 'Calidad de vida no afectada', {negatable: false}),
    R(/(calidad de vida (afectada|deteriorada|limitada|muy afectada|mala|reducida|alterada|disminuida)|mala calidad de vida|afectacion de (la |su )?calidad de vida|impacto (importante |significativo )?en (su |la )?calidad de vida)/, 'yes', 'Calidad de vida afectada', {negated: 'no'})
  ],
  hospitalUrgency: [] // regla específica (recuento, periodo y causa): ver utilizationMentions
};

function severityThreshold(m, ctx, env) {
  const name = m[1], v = toNumber(m[2]);
  const pct = /^\s*%/.test(ctx.after) || /%/.test(m[0]);
  const T = {'snot-22': ['>', 50], snot22: ['>', 50], vas: ['>', 7], 'eva nasal': ['>', 7], fvc: ['<', 50, true], cvf: ['<', 50, true], dlco: ['<', 30, true], fev1: ['<', 40, true, 'cf'], vems: ['<', 40, true, 'cf'], bsi: ['>', 8], faced: ['>', 5], cat: ['>', 21]}[name];
  if (!T || v === null) return {polarity: 'review'};
  const [op, limit, needsPct, onlyFor] = T;
  const finding = `${name.toUpperCase()} ${String(m[2])}${needsPct ? ' %' : ''}`;
  if (needsPct && !pct) return {polarity: 'review', finding, rule: 'Valor sin porcentaje del teórico: verificar'};
  const met = op === '>' ? v > limit : v < limit;
  if (!met) return {polarity: 'review', finding, rule: `${finding}: no cumple ${op}${limit}; otros criterios de gravedad no evaluados`};
  if (onlyFor && !env.pathologies.has(onlyFor)) return {polarity: 'review', finding, rule: `${finding}: umbral definido para fibrosis quística`};
  return {finding, rule: `${finding} (${op}${limit}${needsPct ? ' %' : ''})`};
}

const PATHOLOGY_LABEL = id => PATHOLOGIES.find(p => p[0] === id)?.[1].split(' (')[0] || id;
function catalogMatch(text, ctx, env) {
  const entry = WORSENING_CATALOG.find(c => c.re.test(text));
  if (!entry) return {polarity: 'review'};
  if (/(alergi|intoleran|evitar|contraindicad|reaccion adversa|\bram\b|suspendid|retirad)/.test(ctx.sentence)) return {polarity: 'review', finding: text, rule: `${entry.label}: mención de alergia, contraindicación o retirada (no implica uso actual)`};
  const relevant = entry.pathologies.filter(p => env.pathologies.has(p));
  if (relevant.length) return {finding: text, rule: `${entry.label}: incluido en el anexo SEFH para ${relevant.map(PATHOLOGY_LABEL).join(', ')}`};
  const review = [...entry.pathologies, ...(entry.reviewFor || [])];
  if (!env.pathologies.size) return {polarity: 'review', finding: text, rule: `${entry.label}: su pertinencia depende de la patología (no registrada)`};
  if ((entry.reviewFor || []).some(p => env.pathologies.has(p))) return {polarity: 'review', finding: text, rule: `${entry.label}: requiere valoración profesional`};
  return review.length ? null : {polarity: 'review', finding: text, rule: entry.label};
}
function ismpMatch(text, ctx) {
  const entry = ISMP_CATALOG.find(c => c.re.test(text));
  if (!entry) return {polarity: 'review'};
  if (/(alergi|intoleran|contraindicad|suspendid|retirad)/.test(ctx.sentence)) return {polarity: 'review', finding: text, rule: `${entry.label}: mención no implica uso actual`};
  return entry.core ? {finding: text, rule: `${entry.label} (${ISMP_CATALOG_VERSION})`} : {polarity: 'review', finding: text, rule: `${entry.label}: incluido en la lista MARC; verificar pauta/duración (${ISMP_CATALOG_VERSION})`};
}
function changePeriod(sentence) {
  const m = new RegExp(`hace ${NUM} (semanas?|dias?|meses?|anos?)`).exec(sentence);
  if (m) { const n = toNumber(m[1]), unit = m[2]; const inPeriod = unit.startsWith('mes') ? n <= 6 : !unit.startsWith('ano'); return inPeriod ? {finding: `Cambio hace ${n} ${unit}`, rule: 'Cambio dentro de los últimos 6 meses'} : {polarity: 'review', finding: `Cambio hace ${n} ${unit}`, rule: 'Cambio fuera del periodo de 6 meses'}; }
  if (/(recientemente|reciente|este mes|el (ultimo|pasado) mes|en (la|esta) (ultima )?(visita|consulta|revision)|desde la ultima (visita|consulta|revision)|ultimos (6|seis|tres|3|dos|2) meses|hoy|esta consulta)/.test(sentence)) return {rule: 'Cambio reciente (dentro de 6 meses)'};
  return {polarity: 'review', rule: 'Cambio de medicación sin fecha: verificar si es de los últimos 6 meses'};
}

// Utilización de recursos: ≥2 ingresos y/o ≥2 visitas a urgencias por descompensación respiratoria en el último año.
const IN_PERIOD = /(ultimo ano|ultimos (12|doce) meses|este ano|en el ano|durante el ano|ultimos (6|seis|\d) meses|ultimo semestre)/;
const OUT_PERIOD = /(hace (\d+|un|dos|tres|cuatro|cinco) anos|en (19|20)\d\d|anos previos|anos anteriores|previamente|en el pasado|antecedentes? de)/;
const RESP_CAUSE = /(exacerbacion|descompensacion|agudizacion|reagudizacion|neumonia|respiratori|insuficiencia respiratoria|crisis (asmatica|de asma)|broncoespasmo|disnea|epoc|asma|infeccion respiratoria|bronquiectasias|hemoptisis)/;
const NON_RESP_CAUSE = /(fractura|traumat|cirugia|quirurgic|cardiolog|ictus|abdominal|urolog)/;
function utilizationMentions(t, display) {
  const out = [];
  const add = (m, kind, n, extraRule) => {
    const ctx = contextOf(t, m);
    const period = IN_PERIOD.test(ctx.sentence) ? 'in' : OUT_PERIOD.test(ctx.sentence) ? 'out' : 'unknown';
    const cause = RESP_CAUSE.test(ctx.sentence) ? 'resp' : NON_RESP_CAUSE.test(ctx.sentence) ? 'other' : 'unknown';
    out.push({kind, n, period, cause, fragment: display.slice(ctx.sStart, ctx.sEnd + 1).trim().slice(0, 240), extraRule, uncertain: UNCERTAIN.test(ctx.sentence)});
  };
  const scan = (re, fn) => { const g = new RegExp(re.source, 'g'); let m; while ((m = g.exec(t))) fn(m); };
  scan(new RegExp(`\\b${NUM}\\s+(?:ingresos?|hospitalizacion(?:es)?)\\b`), m => add(m, 'ingresos', toNumber(m[1])));
  scan(new RegExp(`\\b${NUM}\\s+(?:visitas?|consultas?|asistencias?|veces|ocasiones|episodios|atenciones)\\s+(?:a |en |al )?(?:el )?(?:servicio de )?urgencias\\b`), m => add(m, 'urgencias', toNumber(m[1])));
  scan(new RegExp(`\\b${NUM}\\s+urgencias\\b`), m => add(m, 'urgencias', toNumber(m[1])));
  scan(new RegExp(`\\b${NUM}\\s+(?:exacerbaciones|agudizaciones|reagudizaciones|descompensaciones)\\b([^.;]{0,60})`), m => {
    const tail = m[2];
    if (/(ingres|hospitaliz)/.test(tail)) add(m, 'ingresos', toNumber(m[1]));
    else if (/urgencias/.test(tail)) add(m, 'urgencias', toNumber(m[1]));
    else add(m, 'ambulatorias', toNumber(m[1]), 'Exacerbaciones sin ingreso ni urgencias documentados: no computan');
  });
  scan(/\b(?:sin|no ha (?:presentado|requerido|tenido|precisado)|ningun|ninguna|no precisa|no requiere|0)\s+(?<first>ingresos?|hospitalizacion(?:es)?|visitas? a urgencias|urgencias)(?<second> ni (?:visitas? a )?(?:urgencias|ingresos?|hospitalizacion(?:es)?))?/, m => {
    add(m, /urgencias/.test(m.groups.first) ? 'urgencias' : 'ingresos', 0);
    if (m.groups.second) add(m, /urgencias/.test(m.groups.second) ? 'urgencias' : 'ingresos', 0);
  });
  return out;
}
function utilizationResult(mentions) {
  if (!mentions.length) return null;
  const valid = mentions.filter(x => x.period === 'in' && x.cause !== 'other' && x.kind !== 'ambulatorias' && !x.uncertain);
  const evidence = mentions.map(x => ({fragment: x.fragment, rule: x.extraRule || `${x.n} ${x.kind} · periodo: ${{in: 'último año', out: 'fuera del último año', unknown: 'no especificado'}[x.period]} · causa: ${{resp: 'respiratoria', other: 'no respiratoria', unknown: 'no especificada'}[x.cause]}`}));
  const positive = valid.filter(x => x.n >= 2 && x.cause === 'resp');
  const finding = valid.map(x => `${x.n} ${x.kind}`).join(', ') || mentions.map(x => `${x.n} ${x.kind}`).join(', ');
  if (positive.length) return {status: 'detectado', proposal: 'yes', finding, rule: '≥2 ingresos y/o ≥2 visitas a urgencias por causa respiratoria en el último año', evidence};
  const known = kind => valid.some(x => x.kind === kind && x.n < 2);
  if (known('ingresos') && known('urgencias') && !mentions.some(x => x.n >= 2 && x.period !== 'out' && x.cause !== 'other' && x.kind !== 'ambulatorias')) return {status: 'ausencia_explicita', proposal: 'no', finding, rule: '<2 ingresos y <2 visitas a urgencias en el último año', evidence};
  const why = mentions.some(x => x.n >= 2 && x.period === 'unknown') ? 'periodo no especificado' : mentions.some(x => x.n >= 2 && x.cause === 'unknown') ? 'causa no especificada' : 'información incompleta (ingresos o urgencias)';
  return {status: 'dudoso', proposal: 'pending', finding, rule: `Requiere revisión: ${why}`, evidence};
}

// ---------------------------------------------------------------------------------------------
/** Detecta patologías respiratorias afirmadas (no negadas, no familiares, no sospechadas). */
export function detectPathologies(text) {
  const t = normalize(String(text || ''));
  const found = [];
  for (const [id, re] of Object.entries(PATHOLOGY_RULES)) {
    const g = new RegExp(re.source, 'g'); let m;
    while ((m = g.exec(t))) { const p = polarityOf(contextOf(t, m), {on: 'yes'}); if (p === 'yes') { found.push(id); break; } }
  }
  return found;
}

/**
 * Analiza un texto clínico seudonimizado. context.pathologies: patologías ya registradas en el formulario.
 * Devuelve {items: una entrada por cada una de las 22 variables, pathologies: patologías mencionadas}.
 */
export function analyzeText(text, context = {}) {
  const source = String(text || '');
  const t = normalize(source);
  const display = source.length === t.length ? source : t;
  const detected = detectPathologies(source);
  const env = {pathologies: new Set([...(context.pathologies || []), ...detected])};
  // Evidencia: la frase completa que contiene el hallazgo (recortada por palabras si es muy larga).
  const frag = ctx => {
    const sentence = display.slice(ctx.sStart, ctx.sEnd + 1).trim();
    if (sentence.length <= 220) return sentence;
    let a = Math.max(ctx.sStart, ctx.start - 90), b = Math.min(ctx.sEnd, ctx.end + 90);
    while (a > ctx.sStart && /\S/.test(display[a - 1])) a--; while (b < ctx.sEnd && /\S/.test(display[b])) b++;
    return `${a > ctx.sStart ? '… ' : ''}${display.slice(a, b).trim()}${b < ctx.sEnd ? ' …' : ''}`;
  };

  const items = VARIABLES.map(v => {
    if (v.id === 'hospitalUrgency') {
      const r = utilizationResult(utilizationMentions(t, display));
      return finish(v, r || {status: 'no_mencionado'});
    }
    const mentions = [], spans = [];
    for (const rule of RULES[v.id] || []) {
      const g = new RegExp(rule.re.source, 'g'); let m;
      while ((m = g.exec(t))) {
        if (m[0].length === 0) { g.lastIndex++; continue; }
        const s = m.index, e = s + m[0].length;
        if (spans.some(([a, b]) => s < b && e > a)) continue; // un fragmento solo cuenta una vez por variable
        spans.push([s, e]);
        const ctx = contextOf(t, m);
        let polarity = polarityOf(ctx, rule); // 'yes' | 'no' | 'set_age' | 'set_bmi' | 'review' | 'family'
        let extra = {};
        if (rule.when && polarity !== 'family') {
          const w = rule.when(ctx, m, env);
          if (w === null) continue; // coincidencia no pertinente en este contexto
          extra = w || {};
          if (polarity !== 'review' && w?.polarity) polarity = w.polarity;
        }
        const firm = polarity !== 'review' && polarity !== 'family';
        mentions.push({polarity: firm ? 'firm' : polarity, proposal: firm ? (extra.proposal || polarity) : null, value: extra.value ?? null, finding: extra.finding || '', rule: extra.rule || rule.rule, fragment: frag(ctx)});
      }
    }
    if (v.id === 'respComorbidity' && !mentions.some(x => x.polarity === 'firm') && detected.length >= 2) {
      const both = /\b(ambas|ambos|las dos|los dos|todas)\b[^.;]{0,25}(en tratamiento|en tto|tratad|con tratamiento)/.exec(t);
      if (both) mentions.push({polarity: 'firm', proposal: 'yes', value: null, finding: detected.map(PATHOLOGY_LABEL).join(' + '), rule: '≥2 patologías respiratorias con tratamiento documentado', fragment: frag(contextOf(t, both))});
      else mentions.push({polarity: 'review', proposal: null, value: null, finding: detected.map(PATHOLOGY_LABEL).join(' + '), rule: '≥2 patologías respiratorias mencionadas: verifique que cada una requiere medicación (criterio del modelo)', fragment: ''});
    }
    if (v.id === 'naiveHospitalTherapy' && env.pathologies.has('copd')) {
      return finish(v, {status: 'detectado', proposal: 'yes', finding: 'EPOC', rule: 'Regla del modelo: en EPOC se marca Sí en todos los casos (no se dispone de medicamentos de uso hospitalario)', evidence: mentions.map(x => ({fragment: x.fragment, rule: x.rule}))});
    }
    currentVariable = v.id;
    return finish(v, aggregate(mentions));
  });
  return {items, pathologies: detected};
}

let currentVariable = null;
// "Ausencia" = la propuesta firme no puntúa el criterio (en objetivos farmacoterapéuticos, "Sí, alcanzados").
const criterionAbsent = proposal => currentVariable === 'pharmGoals' ? proposal === 'yes' : proposal === 'no';
function aggregate(mentions) {
  if (!mentions.length) return {status: 'no_mencionado'};
  const evidence = mentions.map(x => ({fragment: x.fragment, rule: x.rule, finding: x.finding}));
  const firm = mentions.filter(x => x.polarity === 'firm');
  const keyOf = x => `${x.proposal}|${x.value ?? ''}`;
  const keys = [...new Set(firm.map(keyOf))];
  if (keys.length > 1) return {status: 'contradictorio', proposal: 'pending', finding: [...new Set(firm.map(x => x.finding || x.rule))].join(' / '), rule: 'Evidencias incompatibles en el texto: requiere revisión', evidence};
  if (firm.length) { const x = firm[0]; return {status: criterionAbsent(x.proposal) ? 'ausencia_explicita' : 'detectado', proposal: x.proposal, value: x.value, finding: x.finding, rule: x.rule, evidence}; }
  if (mentions.some(x => x.polarity === 'review')) { const x = mentions.find(y => y.polarity === 'review'); return {status: 'dudoso', proposal: 'pending', value: x.value, finding: x.finding, rule: x.rule, evidence}; }
  return {status: 'no_atribuible', proposal: 'pending', finding: '', rule: 'Mención referida a un familiar: no atribuible al paciente', evidence};
}

function finish(v, r) {
  const evidence = r.evidence || [];
  const proposal = r.proposal || 'pending';
  return {variableId: v.id, status: r.status, proposal, value: r.value ?? null, finding: r.finding || '', rule: r.rule || 'Sin mención en el texto', fragment: evidence[0]?.fragment || '', evidence,
    provisionalPoints: proposal === 'yes' ? scoreVariable(v, {values: {[v.id]: 'yes'}}).points : v.id === 'pharmGoals' && proposal === 'no' ? 2 : 0};
}

/** Compatibilidad con la API anterior: lista de propuestas por variable. */
export function prestratify(text, context = {}) { return analyzeText(text, context).items; }
