// Extractor v2.0: cobertura, negaciones, incertidumbre, contradicciones y evaluación frente a la referencia A–J.
import test from 'node:test';
import assert from 'node:assert/strict';
import {VARIABLES, calculate, normalizeCase, finalizeCase, importCase, exportCase} from '../src/clinical.js';
import {analyzeText, prestratify, EXTRACTOR_VERSION, WORSENING_CATALOG, ISMP_CATALOG} from '../src/extractor.js';
import {buildReport, reportToText} from '../src/report.js';
import {evaluate} from './extractor-eval.js';
import {prestratify as prestratifyV1} from './fixtures/extractor-v1.1.0.js';

const get = (text, id, ctx) => analyzeText(text, ctx).items.find(x => x.variableId === id);

test('cobertura: las 22 variables tienen una entrada y regla documentada', () => {
  const r = analyzeText('');
  assert.equal(r.items.length, 22);
  assert.deepEqual(r.items.map(x => x.variableId), VARIABLES.map(v => v.id));
  assert.ok(r.items.every(x => x.status === 'no_mencionado' && x.proposal === 'pending'), 'sin texto no hay propuestas: la ausencia no se convierte en "No"');
  assert.equal(EXTRACTOR_VERSION, '2.0.0');
  assert.ok(WORSENING_CATALOG.length && ISMP_CATALOG.length);
});

test('frases de referencia del enunciado (negaciones, incertidumbre y cuantitativos)', () => {
  const cases = [
    ['No presenta deterioro cognitivo.', 'cognitiveSensory', 'dudoso'], // negación parcial: el componente sensorial no consta
    ['Antecedentes familiares de depresión.', 'mentalDisorder', 'no_atribuible'],
    ['Posible falta de adherencia.', 'nonAdherence', 'dudoso'],
    ['Exfumador desde hace cinco años.', 'activeSmoking', 'ausencia_explicita'],
    ['No ha presentado ingresos en el último año.', 'hospitalUrgency', 'dudoso'], // urgencias no documentadas
    ['Sin dificultades socioeconómicas.', 'socioeconomic', 'ausencia_explicita'],
    ['Pendiente de confirmar diagnóstico de depresión.', 'mentalDisorder', 'dudoso'],
    ['Niega consumo problemático de alcohol.', 'alcoholDrugs', 'ausencia_explicita'],
    ['TAI de 38 puntos.', 'nonAdherence', 'detectado'],
    ['MPR de 0,65.', 'nonAdherence', 'detectado'],
    ['TAI de 48 puntos.', 'nonAdherence', 'ausencia_explicita'],
    ['MPR del 92 %.', 'nonAdherence', 'ausencia_explicita'],
    ['Bebedor ocasional los fines de semana.', 'alcoholDrugs', 'ausencia_explicita'],
    ['Exacerbaciones frecuentes tratadas en domicilio.', 'hospitalUrgency', 'no_mencionado'],
    ['3 exacerbaciones tratadas con corticoides orales en el último año.', 'hospitalUrgency', 'dudoso'],
    ['Sin ingresos ni visitas a urgencias en el último año.', 'hospitalUrgency', 'ausencia_explicita'],
    ['Usa inhalador de polvo seco.', 'complexHospitalMeds', 'dudoso'],
    ['8 medicamentos.', 'polypharmacy', 'dudoso'],
    ['Polimedicado.', 'polypharmacy', 'dudoso'],
    ['Persistencia de síntomas.', 'pharmGoals', 'dudoso'],
    ['HTA.', 'nonRespComorbidity', 'dudoso'],
    ['HTA en tratamiento con amlodipino.', 'nonRespComorbidity', 'detectado'],
    ['Ansiedad reactiva puntual.', 'mentalDisorder', 'dudoso'],
    ['Exposición laboral a sílice hace 20 años, ya jubilado.', 'occupationalExposure', 'dudoso'],
    ['Cocina con leña en domicilio.', 'occupationalExposure', 'dudoso'],
    ['Vive sola.', 'socioeconomic', 'dudoso'],
    ['EQ-VAS 40.', 'qualityOfLife', 'detectado'],
    ['Se ajusta dosis hace 8 meses.', 'medicationChanges6m', 'dudoso'],
    ['Se añade montelukast hace 2 meses.', 'medicationChanges6m', 'detectado']
  ];
  for (const [text, id, status] of cases) assert.equal(get(text, id).status, status, `${text} → ${id}`);
});

test('la negación no se propaga a otras variables de la misma frase', () => {
  const r = analyzeText('No fumador y en tratamiento con oxigenoterapia domiciliaria.').items;
  assert.equal(r.find(x => x.variableId === 'activeSmoking').proposal, 'no');
  assert.equal(r.find(x => x.variableId === 'severityOxygen').proposal, 'yes');
  const r2 = analyzeText('Sin deterioro cognitivo, pero con hipoacusia bilateral.').items;
  assert.equal(r2.find(x => x.variableId === 'cognitiveSensory').proposal, 'yes');
});

test('contradicciones: se señalan y nunca se elige una respuesta', () => {
  for (const [text, id] of [['No fumador. Fuma diez cigarrillos diarios.', 'activeSmoking'], ['Buena adherencia. TAI 30.', 'nonAdherence'], ['Varón de 66 años. Edad: 61.', 'age'], ['IMC 24. IMC 31.', 'bmi']]) {
    const x = get(text, id);
    assert.equal(x.status, 'contradictorio', text);
    assert.equal(x.proposal, 'pending', text);
    assert.ok(x.evidence.length >= 2, `${text}: evidencias`);
  }
});

test('medicamentos agravantes contextualizados por patología y con excepciones', () => {
  assert.equal(get('Toma propranolol.', 'worseningMeds', {pathologies: ['asthma']}).status, 'detectado');
  assert.equal(get('Toma propranolol.', 'worseningMeds', {pathologies: ['ipf']}).status, 'no_mencionado', 'no figura en el anexo para FPI');
  assert.equal(get('Toma propranolol.', 'worseningMeds').status, 'dudoso', 'sin patología: requiere revisión');
  assert.equal(get('Toma bisoprolol.', 'worseningMeds', {pathologies: ['asthma']}).status, 'no_mencionado', 'cardioselectivo excluido en asma');
  assert.equal(get('Toma bisoprolol.', 'worseningMeds', {pathologies: ['crsnp']}).status, 'detectado');
  assert.equal(get('Alergia a ibuprofeno.', 'worseningMeds', {pathologies: ['asthma']}).status, 'dudoso');
  assert.equal(get('En tratamiento con amiodarona.', 'worseningMeds', {pathologies: ['ild']}).status, 'detectado');
  assert.equal(get('Celecoxib a demanda.', 'worseningMeds', {pathologies: ['asthma']}).status, 'dudoso');
});

test('alto riesgo ISMP: solo grupos núcleo como propuesta firme', () => {
  assert.equal(get('Anticoagulado con acenocumarol.', 'ismpHighRisk').status, 'detectado');
  assert.equal(get('Prednisona 10 mg/día.', 'ismpHighRisk').status, 'dudoso');
  assert.equal(get('Metformina 850 mg.', 'ismpHighRisk').status, 'no_mencionado');
});

test('naïve: regla EPOC del modelo y tratamiento hospitalario previo', () => {
  assert.equal(get('Paciente con EPOC.', 'naiveHospitalTherapy').proposal, 'yes');
  assert.equal(get('Sospecha de EPOC.', 'naiveHospitalTherapy').status, 'no_mencionado', 'EPOC no confirmada');
  assert.equal(get('Asma grave en tratamiento con dupilumab desde 2022.', 'naiveHospitalTherapy').proposal, 'no');
  assert.equal(get('Asma grave. Inicia tratamiento con benralizumab.', 'naiveHospitalTherapy').proposal, 'yes');
});

test('dos patologías respiratorias: no puntúa sin requisito farmacoterapéutico', () => {
  assert.equal(get('EPOC y bronquiectasias.', 'respComorbidity').status, 'dudoso');
  assert.equal(get('EPOC y bronquiectasias, ambas en tratamiento.', 'respComorbidity').proposal, 'yes');
  assert.equal(get('EPOC. Descartadas bronquiectasias.', 'respComorbidity').status, 'no_mencionado');
});

test('textos largos y formatos numéricos no generan coincidencias parciales', () => {
  const long = 'Paciente estable. '.repeat(3000) + 'IMC 31,5.';
  const t0 = Date.now(); const r = analyzeText(long).items; assert.ok(Date.now() - t0 < 2000, 'rendimiento');
  assert.equal(r.find(x => x.variableId === 'bmi').value, 31.5);
  assert.equal(get('Catéter central. Vasculitis.', 'severityOxygen').status, 'no_mencionado');
  assert.equal(get('Clase funcional IV de la NYHA.', 'complexHospitalMeds').status, 'no_mencionado');
  assert.equal(get('IMC 31.5 kg/m2.', 'bmi').value, 31.5);
});

test('evaluación A–J: sin errores de negación, de asignación, de puntuación ni propuestas firmes indebidas', () => {
  const after = evaluate(prestratify);
  assert.equal(after.totals.negation, 0, 'errores de negación');
  assert.equal(after.totals.polarity, 0, 'errores de polaridad');
  assert.equal(after.totals.assignment, 0, 'errores de asignación');
  assert.equal(after.totals.unsafeFirm, 0, 'propuestas firmes indebidas');
  assert.equal(after.totals.scoring, 0, 'errores de puntuación');
  assert.equal(after.totals.priority, 0, 'prioridad sobreestimada');
  assert.equal(after.totals.fp, 0, 'falsos positivos de detección');
  assert.ok(after.sensitivity >= 95, `sensibilidad ${after.sensitivity}`);
  const before = evaluate(prestratifyV1);
  assert.ok(after.sensitivity > before.sensitivity && after.totals.negation <= before.totals.negation);
});

test('integración: solo lo confirmado llega al caso, al PDF y al texto para historia clínica', () => {
  // Propuestas sin confirmar no modifican el formulario: el informe se construye exclusivamente desde form.values.
  const items = analyzeText('Varón de 72 años con EPOC. Fumador activo. Oxigenoterapia domiciliaria.').items;
  assert.ok(items.some(x => x.status === 'detectado'));
  const form = finalizeCase(normalizeCase({values: {activeSmoking: 'yes'}, age: 72, pathologies: ['copd'], mainPathology: 'copd', hospital: 'H', pharmacist: 'F', provenance: {activeSmoking: {source: 'extractor', decision: 'confirmed', rule: 'Tabaquismo activo'}, severityOxygen: {decision: 'confirmed'}}}), 'provisional');
  assert.deepEqual(Object.keys(form.provenance), ['activeSmoking'], 'la trazabilidad solo se conserva para valores realmente registrados');
  const text = reportToText(buildReport(form, calculate(form)));
  assert.match(text, /Tabaquismo activo \(4 p\)/);
  assert.doesNotMatch(text, /oxigenoterapia \(2 p\)/i, 'la propuesta no confirmada no aparece');
  assert.match(text, /1 variable\(s\) incorporada\(s\) desde el análisis asistido/);
  assert.deepEqual(importCase(exportCase(form)).provenance, form.provenance, 'exportación/importación compatible');
  assert.deepEqual(importCase(JSON.stringify({schema: 'siaf-cmo-respiratorio-v1', form: {values: {activeSmoking: 'yes'}}})).provenance, {}, 'casos antiguos sin trazabilidad siguen importándose');
});
