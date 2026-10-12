// Evaluación reproducible del extractor frente a la referencia manual (casos sintéticos A–J).
import {VARIABLES, calculate} from '../src/clinical.js';
import {GOLD_CASES} from './fixtures/extractor-gold.js';

const FIRM = new Set(['detectado', 'ausencia_explicita']);
const toFormValue = (id, proposal) => proposal === 'set_age' ? 'adult' : proposal === 'set_bmi' ? 'set' : proposal;
const criterionPresent = (id, v) => id === 'pharmGoals' ? v === 'no' : v === 'yes' || v === 'adult' || v === 'set';

function classify(item) {
  if (!item || item.status === 'no_mencionado') return {kind: 'none'};
  if (FIRM.has(item.status) && item.proposal && item.proposal !== 'pending') return {kind: 'firm', value: toFormValue(item.variableId, item.proposal), number: item.value ?? null};
  return {kind: 'review'};
}
function goldOf(g) {
  if (g === undefined) return {kind: 'none'};
  if (g === 'review') return {kind: 'review'};
  if (typeof g === 'object') return {kind: 'firm', value: 'age' in g ? 'adult' : 'set', number: g.age ?? g.bmi};
  return {kind: 'firm', value: g};
}
const same = (a, b) => a.value === b.value && (b.number === undefined || b.number === null || Number(a.number) === Number(b.number));

function formFrom(entries, pathologies) {
  const form = {values: {}, pathologies, adultClinic: true};
  for (const [id, x] of entries) if (x.kind === 'firm') { form.values[id] = x.value; if (id === 'age') form.age = x.number; if (id === 'bmi') form.bmi = x.number; }
  return form;
}

/** prestratify(text, context) → items. Devuelve métricas globales y por caso. */
export function evaluate(prestratify, {useContext = true} = {}) {
  const totals = {tp: 0, fn: 0, fp: 0, correct: 0, conservative: 0, polarity: 0, negation: 0, unsafeFirm: 0, assignment: 0, scoring: 0, priority: 0, goldFirm: 0};
  const cases = GOLD_CASES.map(c => {
    const items = prestratify(c.text, useContext ? {pathologies: c.pathologies} : undefined);
    const errors = [];
    const golds = [], exts = [];
    for (const v of VARIABLES) {
      const g = goldOf(c.gold[v.id]), e = classify(items.find(i => i.variableId === v.id));
      golds.push([v.id, g]); exts.push([v.id, e]);
      if (g.kind !== 'none' && e.kind !== 'none') totals.tp++;
      else if (g.kind !== 'none') { totals.fn++; errors.push(`${v.id}: no detectado`); }
      else if (e.kind !== 'none') { totals.fp++; errors.push(`${v.id}: detección sin información en la referencia`); }
      if (g.kind === 'firm') {
        totals.goldFirm++;
        if (e.kind === 'firm' && same(e, g)) totals.correct++;
        else if (e.kind === 'firm') {
          const polarity = criterionPresent(v.id, e.value) !== criterionPresent(v.id, g.value);
          if (polarity) { totals.polarity++; if (!criterionPresent(v.id, g.value)) totals.negation++; } else totals.assignment++;
          errors.push(`${v.id}: propuesta ${e.value}${e.number != null ? ` (${e.number})` : ''} ≠ referencia ${g.value}${g.number != null ? ` (${g.number})` : ''}`);
        } else if (e.kind === 'review') totals.conservative++;
      } else if (e.kind === 'firm') { totals.unsafeFirm++; errors.push(`${v.id}: propuesta firme donde la referencia exige revisión o no hay información`); }
    }
    // Puntuación: referencia (respuestas firmes de la referencia) frente a confirmar todas las propuestas firmes del extractor.
    const goldResult = calculate(formFrom(golds, c.pathologies)), extResult = calculate(formFrom(exts, c.pathologies));
    const scoreErrors = VARIABLES.filter(v => {
      const e = exts.find(x => x[0] === v.id)[1];
      if (e.kind !== 'firm') return false;
      const gp = goldResult.details.find(d => d.variable.id === v.id), ep = extResult.details.find(d => d.variable.id === v.id);
      return gp.pending || gp.points !== ep.points;
    }).map(v => v.id);
    totals.scoring += scoreErrors.length;
    // Prioridad: solo cuenta como error si las propuestas firmes asignan una prioridad SUPERIOR a la de la referencia
    // (las variables no confirmadas quedan pendientes y nunca suman).
    const rank = {P1: 1, P2: 2, P3: 3};
    if (rank[extResult.finalPriority] < rank[goldResult.finalPriority]) totals.priority++;
    return {id: c.id, title: c.title, errors, goldScore: goldResult.total, extScore: extResult.total, goldPriority: goldResult.finalPriority, extPriority: extResult.finalPriority, scoreErrors};
  });
  const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : null;
  return {cases, totals, sensitivity: pct(totals.tp, totals.tp + totals.fn), ppv: pct(totals.tp, totals.tp + totals.fp), firmAccuracy: pct(totals.correct, totals.goldFirm)};
}
