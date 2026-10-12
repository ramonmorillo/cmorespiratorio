// Evaluación reproducible del extractor (casos sintéticos A–J) frente a la versión 1.1.0 congelada.
// Uso: npm run eval:extractor  → imprime tablas Markdown. No constituye validación clínica externa.
import {evaluate} from '../tests/extractor-eval.js';
import {prestratify} from '../src/extractor.js';
import {prestratify as prestratifyV1} from '../tests/fixtures/extractor-v1.1.0.js';

const before = evaluate(prestratifyV1), after = evaluate(prestratify);
const row = (label, f) => `| ${label} | ${f(before)} | ${f(after)} |`;
console.log(['| Métrica (10 casos × 22 variables = 220 decisiones) | v1.1.0 | v2.0 |', '|---|---|---|',
  row('Sensibilidad de detección (variables con información)', r => `${r.sensitivity} % (${r.totals.tp}/${r.totals.tp + r.totals.fn})`),
  row('Valor predictivo positivo de detección', r => `${r.ppv} % (${r.totals.tp}/${r.totals.tp + r.totals.fp})`),
  row('Falsos negativos de detección', r => r.totals.fn),
  row('Falsos positivos de detección', r => r.totals.fp),
  row('Propuestas firmes correctas / esperadas', r => `${r.totals.correct}/${r.totals.goldFirm} (${r.firmAccuracy} %)`),
  row('Propuestas para revisión donde había dato firme (conservadoras)', r => r.totals.conservative),
  row('Errores de negación (criterio afirmado cuando estaba negado o ausente)', r => r.totals.negation),
  row('Errores de polaridad totales', r => r.totals.polarity),
  row('Errores de asignación de valor', r => r.totals.assignment),
  row('Propuestas firmes indebidas (dudoso/contradictorio/sin dato)', r => r.totals.unsafeFirm),
  row('Errores de puntuación (variables con puntos distintos a la referencia)', r => r.totals.scoring),
  row('Casos con prioridad sobreestimada', r => r.totals.priority)].join('\n'));
console.log('\n| Caso | Puntos referencia | Puntos v2.0 (si se confirman todas las propuestas firmes) | Prioridad ref./v2.0 | Discrepancias v2.0 | Discrepancias v1.1.0 |\n|---|---|---|---|---|---|');
after.cases.forEach((c, i) => console.log(`| ${c.id}. ${c.title} | ${c.goldScore} | ${c.extScore} | ${c.goldPriority} / ${c.extPriority} | ${c.errors.join('; ') || '—'} | ${before.cases[i].errors.length} |`));
