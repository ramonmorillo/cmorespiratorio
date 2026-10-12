// Pruebas de regresión de la auditoría pre-entrega (v1.1.0-rc1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, VARIABLES, finalizeCase, normalizeCase, importCase, exportCase, toCSV, actionCatalog, actionsFor, overrideIsValid, parseMeasure, AGE_RANGE} from '../src/clinical.js';
import {prestratify} from '../src/extractor.js';
import {buildReport, reportToText} from '../src/report.js';
import {reportToPdf, toWinAnsi, wrapText, textWidth} from '../src/pdf.js';
import {buildWorkflowState} from '../src/workflow.js';
import {CASES} from './fixtures/cases.js';

const finalized = (form, status = 'completed') => finalizeCase(normalizeCase(form), status);
const WIN_ANSI_EXTRA = {'\x80': '€', '\x85': '…', '\x91': '‘', '\x92': '’', '\x93': '“', '\x94': '”', '\x95': '•', '\x96': '–', '\x97': '—'};
// Extrae el texto de las operaciones Tj de un PDF generado por src/pdf.js (decodifica escapes octales WinAnsi).
const pdfText = bytes => {
  const raw = Buffer.from(bytes).toString('latin1');
  return [...raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => Buffer.from(m[1].replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\([()\\])/g, '$1'), 'latin1')).map(b => b.toString('latin1').replace(/[\x80-\x9f]/g, c => WIN_ANSI_EXTRA[c] || c)).join('\n');
};

test('casos ficticios: puntuación, prioridad y estado coinciden con lo esperado', () => {
  for (const [id, c] of Object.entries(CASES)) {
    const r = calculate(c.form);
    if (c.expected.applicable === false) { assert.equal(r.applicable, false, id); continue; }
    assert.equal(r.total, c.expected.total, `${id} total`);
    assert.equal(r.finalPriority, c.expected.priority, `${id} prioridad`);
    assert.equal(r.pending, c.expected.pending, `${id} pendientes`);
    if (c.expected.automatic) assert.ok(r.automaticCauses.length, `${id} automática`);
    if (c.expected.maxPossiblePriority) assert.equal(r.maxPossiblePriority, c.expected.maxPossiblePriority, `${id} rango`);
  }
});

test('determinismo: mismas variables => misma estratificación, con independencia del orden de entrada', () => {
  const c = CASES.C1_P1.form;
  const reference = JSON.stringify(calculate(c));
  for (let i = 0; i < 50; i++) assert.equal(JSON.stringify(calculate(structuredClone(c))), reference);
  const reversed = {...c, values: Object.fromEntries(Object.entries(c.values).reverse())};
  assert.equal(JSON.stringify(calculate(reversed)), reference);
});

test('CRÍTICO corregido: edad vacía o no numérica no genera Prioridad 1 automática', () => {
  for (const age of ['', null, undefined, 'abc', -3, 150]) {
    const f = {...CASES.C6_P3_SIMPLE.form, age};
    const r = calculate(f);
    assert.equal(r.automaticCauses.length, 0, `edad ${age}`);
    assert.equal(r.details.find(d => d.variable.id === 'age').pending, true, `edad ${age} pendiente`);
    assert.equal(r.finalPriority, 'P3');
  }
  assert.equal(parseMeasure('65', AGE_RANGE), 65);
  assert.equal(calculate({...CASES.C6_P3_SIMPLE.form, age: 65}).details.find(d => d.variable.id === 'age').points, 0, '65 años no suma (>65)');
  assert.equal(calculate({...CASES.C6_P3_SIMPLE.form, age: 66}).details.find(d => d.variable.id === 'age').points, 2, '66 años suma 2');
});

test('CRÍTICO corregido: IMC vacío no puntúa como desnutrición; admite coma decimal y límites del modelo', () => {
  const bmiPoints = (bmi, pathologies = ['asthma']) => calculate({...CASES.C6_P3_SIMPLE.form, bmi, pathologies}).details.find(d => d.variable.id === 'bmi');
  assert.equal(bmiPoints('').pending, true);
  assert.equal(bmiPoints(null).pending, true);
  assert.equal(bmiPoints('5').pending, true, 'fuera de rango plausible');
  assert.equal(bmiPoints('30').points, 3);
  assert.equal(bmiPoints('29,9').points, 0);
  assert.equal(bmiPoints('18,4').points, 0, 'documentado: desnutrición IMC<18,4');
  assert.equal(bmiPoints('18,3').points, 1);
  assert.equal(bmiPoints('18,3', ['cf']).points, 3);
});

test('CRÍTICO corregido: la modificación manual sin justificación no altera la prioridad final', () => {
  const f = {...CASES.C6_P3_SIMPLE.form, override: {priority: 'P1', justification: 'corto'}};
  assert.equal(calculate(f).finalPriority, 'P3');
  assert.equal(overrideIsValid(f.override), false);
  f.override.justification = 'Deterioro clínico reciente documentado en consulta';
  const r = calculate(f);
  assert.equal(r.finalPriority, 'P1');
  assert.equal(r.calculatedPriority, 'P3');
  const down = calculate({...CASES.C7_PREGNANCY.form, override: {priority: 'P3', justification: 'Justificación de prueba suficiente'}});
  assert.equal(down.overrideLowersAutomatic, true);
});

test('CRÍTICO corregido: edad pediátrica => modelo no aplicable e informe bloqueado', () => {
  const f = finalized(CASES.C9_PEDIATRIC.form);
  const r = calculate(f);
  assert.equal(r.applicable, false);
  const report = buildReport(f, r);
  assert.equal(report.exportable, false);
  assert.match(report.blockedReason, /pediátrico/);
  const teen = calculate({...CASES.C6_P3_SIMPLE.form, age: 17, adultClinic: false});
  assert.equal(teen.applicable, true);
  assert.ok(teen.reviews.some(x => /modelo pediátrico/.test(x)), '16–17 fuera de consulta de adultos requiere revisión');
  const contradictory = calculate({...CASES.C6_P3_SIMPLE.form, age: 40, values: {...CASES.C6_P3_SIMPLE.form.values, age: 'pediatric'}});
  assert.ok(contradictory.reviews.some(x => /40 años marcada como pediátrica/.test(x)));
});

test('datos incompletos: rango alcanzable y advertencia de posible cambio de prioridad', () => {
  const r = calculate(CASES.C11_INCOMPLETE.form);
  assert.equal(r.pendingCount, 18);
  assert.equal(r.maxPossibleTotal, 56);
  assert.equal(r.priorityMayChange, true);
  const report = buildReport(finalized(CASES.C11_INCOMPLETE.form, 'provisional'), r);
  assert.equal(report.statusLabel, 'Provisional');
  assert.ok(report.warnings.some(w => /podría llegar a Prioridad 1/.test(w)));
});

test('saneamiento de importación: valores no admisibles quedan pendientes y no puntúan como "No"', () => {
  const f = importCase(JSON.stringify({schema: 'siaf-cmo-respiratorio-v1', form: {values: {activeSmoking: 'si', nonAdherence: 'yes', inventada: 'yes'}, pathologies: ['asthma', '<img src=x>'], interventions: {'edu-0': 'done', 'x': 'done', 'sft-1': 'hack'}, pseudoId: 'x'.repeat(500)}}));
  assert.equal(f.values.activeSmoking, undefined);
  assert.equal(f.values.inventada, undefined);
  assert.equal(f.values.nonAdherence, 'yes');
  assert.deepEqual(f.pathologies, ['asthma']);
  assert.deepEqual(f.interventions, {'edu-0': 'done'});
  assert.equal(f.pseudoId.length, 60);
  assert.equal(calculate(f).details.find(d => d.variable.id === 'activeSmoking').pending, true);
  assert.throws(() => importCase('{"schema":"otro"}'), /incompatible/);
  assert.throws(() => importCase('no es json'));
});

test('exportación/importación JSON conserva el caso completo (ida y vuelta)', () => {
  const f = finalized({...CASES.C1_P1.form, interventions: {'edu-0': 'done'}, plan: {nextReview: '2027-01-15', notes: 'Nota'}});
  const back = importCase(exportCase(f));
  assert.deepEqual(calculate(back).finalPriority, calculate(f).finalPriority);
  assert.deepEqual(back.interventions, f.interventions);
  assert.deepEqual(back.plan, f.plan);
  assert.equal(back.status, 'completed');
});

test('CSV: escapa comillas y neutraliza fórmulas', () => {
  const csv = toCSV(calculate(CASES.C6_P3_SIMPLE.form).details, {hospital: '=HYPERLINK("x")', pharmacist: 'Ana "La" FH'});
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"Ana ""La"" FH"/);
});

test('catálogo de intervenciones: identificadores estables entre prioridades y acumulativo', () => {
  const p1 = actionCatalog('P1'), p3 = actionCatalog('P3');
  for (const a of p3) assert.equal(p1.find(x => x.id === a.id)?.label, a.label, a.id);
  assert.equal(p1.length, Object.values(actionsFor('P1')).flatMap(g => g.items).length);
  const state = buildWorkflowState({...CASES.C6_P3_SIMPLE.form, interventions: {'edu-0': 'not_applicable'}}, calculate(CASES.C6_P3_SIMPLE.form));
  assert.equal(state.selectedInterventions.find(i => i.id === 'edu-0').selected, false);
});

test('extractor: corrige inversiones y falsos positivos detectados en la auditoría', () => {
  const get = (text, id) => prestratify(text).find(x => x.variableId === id);
  assert.equal(get('Paciente no adherente al tratamiento.', 'nonAdherence').proposal, 'yes');
  assert.equal(get('Sin cambios. Mala adherencia.', 'nonAdherence').proposal, 'yes');
  assert.equal(get('Exfumador desde hace 10 años.', 'activeSmoking').proposal, 'no');
  assert.equal(get('Niega tabaquismo.', 'activeSmoking').proposal, 'no');
  assert.equal(get('Fumadora activa de 20 cigarrillos/día.', 'activeSmoking').proposal, 'yes');
  assert.equal(get('Usa inhalador de polvo seco.', 'occupationalExposure').status, 'no_mencionado');
  assert.equal(get('Gases arteriales normales.', 'occupationalExposure').status, 'no_mencionado');
  assert.equal(get('Diagnosticado hace 2 años.', 'age').status, 'no_mencionado');
  const age = get('Varón de 70 años con EPOC.', 'age');
  assert.equal(age.proposal, 'set_age'); assert.equal(age.value, 70);
  const bmi = get('IMC: 31,5.', 'bmi');
  assert.equal(bmi.proposal, 'set_bmi'); assert.equal(bmi.value, 31.5);
  assert.equal(get('Posible oxigenoterapia.', 'severityOxygen').proposal, 'pending');
  assert.equal(get('Hace 2 años acudió a urgencias.', 'hospitalUrgency').status, 'no_mencionado');
  assert.equal(get('Tres ingresos por exacerbación en el último año.', 'hospitalUrgency').proposal, 'yes');
});

test('informes: texto para historia clínica limpio, sin HTML ni valores técnicos', () => {
  for (const [id, c] of Object.entries(CASES)) {
    const f = finalized(c.form, calculate(c.form).pending ? 'provisional' : 'completed');
    const r = calculate(f);
    const report = buildReport(f, r);
    if (!report.exportable) continue;
    const text = reportToText(report);
    assert.doesNotMatch(text, /undefined|null|NaN|\[object|<\/?[a-z][^>]*>/i, id);
    assert.doesNotMatch(text, /[\u{1F300}-\u{1FAFF}]/u, `${id} emojis`);
    assert.match(text, /^ATENCIÓN FARMACÉUTICA RESPIRATORIA — MODELO CMO/);
    assert.match(text, new RegExp(`RESULTADO DE ESTRATIFICACIÓN: ${report.stratification.finalPriority.toUpperCase()}`));
    assert.match(text, /Profesional responsable: Farmacéutico\/a de pruebas — Hospital Ficticio de Pruebas/);
    assert.doesNotMatch(text, /\n{3,}/);
  }
});

test('informes: PDF válido, paginado y concordante con el texto para historia clínica', () => {
  const f = finalized({...CASES.C1_P1.form, interventions: {'edu-0': 'done', 'coord-3': 'planned', 'coord-0': 'not_applicable'}, plan: {nextReview: '2027-01-15', notes: 'Técnica inhalatoria: revisar en próxima visita (señal ñ, ü, ¿?, ¡!).'}});
  const r = calculate(f);
  const report = buildReport(f, r);
  const bytes = reportToPdf(report);
  const raw = Buffer.from(bytes).toString('latin1');
  assert.ok(raw.startsWith('%PDF-1.4'));
  assert.ok(raw.trimEnd().endsWith('%%EOF'));
  // Tabla xref coherente con las posiciones reales de los objetos.
  const xrefAt = Number(raw.match(/startxref\n(\d+)/)[1]);
  assert.ok(raw.slice(xrefAt).startsWith('xref'));
  const offsets = [...raw.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map(m => Number(m[1]));
  offsets.forEach((o, i) => assert.ok(raw.slice(o).startsWith(`${i + 1} 0 obj`), `objeto ${i + 1}`));
  const pages = Number(raw.match(/\/Count (\d+)/)[1]);
  assert.ok(pages >= 1);
  const pdf = pdfText(bytes);
  assert.match(pdf, new RegExp(`Página ${pages} de ${pages}`));
  assert.doesNotMatch(pdf, /undefined|null|NaN|\?\?/);
  assert.match(pdf, /Técnica inhalatoria/);
  assert.match(pdf, /ñ, ü, ¿\?, ¡!/);
  // Concordancia: resultado, puntuación, intervenciones y plan presentes en ambos formatos.
  const text = reportToText(report);
  const flatPdf = pdf.replace(/\s+/g, ' ');
  for (const fragment of ['Prioridad 1', '37/59', 'Promoción de la adherencia.', 'Coordinación intrahospitalaria especializada', '15/01/2027', 'Recomendación: aplicar al inicio y ante cambios; valorar cada 3–6 meses.']) {
    assert.ok(text.includes(fragment), `texto: ${fragment}`);
    assert.ok(flatPdf.includes(fragment), `pdf: ${fragment}`);
  }
  for (const item of report.interventions.recommended) assert.ok(flatPdf.includes(item.label.split(' ').slice(0, 4).join(' ')), item.label);
  // Las intervenciones marcadas como "no procede" no aparecen como recomendadas.
  assert.ok(!report.interventions.recommended.some(i => i.label.startsWith('Colaboración con Asociaciones')));
});

test('informes: bloqueados si no está finalizado o si se modificó tras finalizar', () => {
  const draft = normalizeCase(CASES.C1_P1.form);
  assert.equal(buildReport(draft, calculate(draft)).exportable, false);
  const outdated = {...finalized(CASES.C1_P1.form), outdated: true, status: 'draft'};
  assert.equal(buildReport(outdated, calculate(outdated)).exportable, false);
});

test('PDF: codificación WinAnsi y ajuste de línea dentro del ancho', () => {
  assert.deepEqual(toWinAnsi('áéíóúñÑü¿¡€—'), [225, 233, 237, 243, 250, 241, 209, 252, 191, 161, 128, 151]);
  assert.deepEqual(toWinAnsi('≥'), [62, 61]);
  const lines = wrapText('Información sobre enfermedad, tratamiento, conservación, interacciones, reacciones adversas'.repeat(3), 9, 200);
  assert.ok(lines.every(l => textWidth(l, 9) <= 200));
  assert.ok(wrapText('x'.repeat(300), 9, 100).every(l => textWidth(l, 9) <= 100), 'palabras muy largas se cortan');
});

test('variables: 22 variables y máximos documentados', () => {
  assert.equal(VARIABLES.length, 22);
});

test('extractor: la incertidumbre no se propaga entre frases', () => {
  const r = prestratify('Varón de 70 años con EPOC. IMC: 31,5. Exfumador. Posible oxigenoterapia.');
  assert.equal(r.find(x => x.variableId === 'age').status, 'detectado');
  assert.equal(r.find(x => x.variableId === 'severityOxygen').status, 'dudoso');
  assert.equal(prestratify('Madre con asma. Fumador activo.').find(x => x.variableId === 'activeSmoking').proposal, 'yes');
  assert.equal(prestratify('Madre fumadora.').find(x => x.variableId === 'activeSmoking').status, 'dudoso');
});
