import {VERSION, VERSION_DATE, SOURCE_URL, DIMENSIONS, PATHOLOGIES, PERIODICITY, INTERVENTION_STATUSES, actionCatalog} from './clinical.js';

// Estructura única del informe: el PDF, el texto para historia clínica y la vista previa se generan a partir de ella.

export const PRIORITY_LABELS = {P1: 'Prioridad 1', P2: 'Prioridad 2', P3: 'Prioridad 3'};
export const DISCLAIMER = 'Herramienta de apoyo profesional: no diagnóstica, no prescriptiva, no sustitutiva del juicio clínico, no producto sanitario certificado y pendiente de validación asistencial.';
const TOOL_NAME = 'SIAF-CMO Respiratorio';
const SHORT_DIMENSIONS = {demographic: 'Demográficas', clinical: 'Clínicas', treatment: 'Tratamiento', social: 'Sociosanitarias', utilization: 'Utilización de servicios'};
const pad = n => String(n).padStart(2, '0');

export function formatDate(value, withTime = false) {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

const pathologyLabel = id => PATHOLOGIES.find(p => p[0] === id)?.[1] || '';

/** Estado del informe: solo es exportable cuando la estratificación está finalizada y no se ha modificado después. */
export function reportState(form, result) {
  if (!result.applicable) return {exportable: false, reason: 'Paciente en edad pediátrica: el modelo de adultos no es aplicable. Derive al modelo pediátrico SEFH.'};
  if (!form.completedAt) return {exportable: false, reason: 'Finalice la estratificación en el paso 4 para generar los informes.'};
  if (form.outdated) return {exportable: false, reason: 'Se han modificado datos de la estratificación tras finalizarla. Vuelva a validar en el paso 4.'};
  return {exportable: true, reason: ''};
}

export function buildReport(form, result) {
  const state = reportState(form, result);
  const pendingLabels = result.details.filter(d => d.pending).map(d => d.variable.label);
  const factors = result.details.filter(d => (d.points > 0 || d.auto) && d.variable.id !== 'age' && d.variable.id !== 'bmi').map(d => ({
    id: d.variable.id,
    dimension: d.variable.dim,
    dimensionLabel: SHORT_DIMENSIONS[d.variable.dim],
    label: d.variable.label,
    response: d.response,
    points: d.points
  }));
  const catalog = actionCatalog(result.finalPriority);
  const statusOf = id => form.interventions?.[id] || 'recommended';
  const byStatus = status => catalog.filter(a => statusOf(a.id) === status).map(a => ({group: a.groupLabel, label: a.label}));
  const ageDetail = result.details.find(d => d.variable.id === 'age');
  const bmiDetail = result.details.find(d => d.variable.id === 'bmi');
  const main = pathologyLabel(form.mainPathology);
  const others = (form.pathologies || []).filter(p => p !== form.mainPathology).map(pathologyLabel).filter(Boolean);

  const warnings = [];
  if (form.status === 'provisional' || result.pending) {
    warnings.push(`Resultado provisional: ${pendingLabels.length} variable(s) pendiente(s) de valoración (${pendingLabels.join('; ')}).`);
    if (result.priorityMayChange) warnings.push(`Si las variables pendientes resultaran positivas, la puntuación podría alcanzar ${result.maxPossibleTotal}/59 y la prioridad podría llegar a ${PRIORITY_LABELS[result.maxPossiblePriority]}.`);
  }
  result.reviews.forEach(r => warnings.push(r));
  if (result.overrideLowersAutomatic) warnings.push('La modificación profesional disminuye una Prioridad 1 automática: requiere justificación reforzada documentada.');
  if (!(form.pathologies || []).length) warnings.push('No se ha registrado ninguna patología respiratoria incluida en el modelo.');

  return {
    exportable: state.exportable,
    blockedReason: state.reason,
    title: 'Atención farmacéutica respiratoria — Modelo CMO',
    tool: `${TOOL_NAME} v${VERSION} (${VERSION_DATE})`,
    evaluationDate: formatDate(form.completedAt, true),
    statusLabel: form.status === 'completed' && !result.pending ? 'Definitiva' : 'Provisional',
    pharmacist: form.pharmacist || '',
    hospital: form.hospital || '',
    patientId: form.pseudoId || '',
    clinical: {
      mainPathology: main,
      otherPathologies: others,
      age: ageDetail && !ageDetail.pending ? `${ageDetail.response}${ageDetail.points ? ` (${ageDetail.points} p)` : ''}` : '',
      bmi: bmiDetail && !bmiDetail.pending ? `${bmiDetail.response}${bmiDetail.points ? ` (${bmiDetail.points} p)` : ''}` : ''
    },
    stratification: {
      total: result.total,
      max: 59,
      subtotals: Object.entries(result.subtotals).map(([k, v]) => ({label: DIMENSIONS[k].label, short: SHORT_DIMENSIONS[k], points: v, max: DIMENSIONS[k].max})),
      calculatedPriority: PRIORITY_LABELS[result.calculatedPriority],
      finalPriority: PRIORITY_LABELS[result.finalPriority],
      finalPriorityCode: result.finalPriority,
      automaticCauses: result.automaticCauses,
      override: result.override ? {
        priority: PRIORITY_LABELS[result.override.priority],
        motive: result.override.motive || '',
        justification: result.override.justification || ''
      } : null,
      pending: pendingLabels,
      assistedCount: Object.keys(form.provenance || {}).filter(id => result.details.some(d => d.variable.id === id && !d.pending)).length
    },
    contextFactors: factors.filter(f => f.dimension !== 'treatment'),
    pharmacotherapeuticNeeds: factors.filter(f => f.dimension === 'treatment'),
    interventions: {
      done: byStatus('done'),
      planned: byStatus('planned'),
      recommended: byStatus('recommended'),
      notApplicableCount: byStatus('not_applicable').length
    },
    plan: {
      periodicity: PERIODICITY[result.finalPriority] || '',
      nextReview: formatDate(form.plan?.nextReview),
      notes: form.plan?.notes || ''
    },
    warnings,
    disclaimer: DISCLAIMER,
    source: `Basado en la metodología CMO MAPEX-SEFH: Adaptación del Modelo de Atención Farmacéutica CMO al paciente con patologías respiratorias (SEFH). ${SOURCE_URL}`
  };
}

// Caracteres que algunas historias clínicas electrónicas no muestran correctamente.
export const toPlain = text => String(text ?? '')
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[‐‑]/g, '-')
  .replace(/α/g, 'alfa').replace(/β/g, 'beta').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/\t/g, ' ').trimEnd();

/** Texto plano para pegar en la historia clínica: sin HTML, tablas ni emojis; omite apartados sin contenido. */
export function reportToText(r) {
  const lines = [];
  const section = (title, body) => { const rows = body.filter(Boolean); if (rows.length) lines.push('', title.toUpperCase(), ...rows); };
  lines.push('ATENCIÓN FARMACÉUTICA RESPIRATORIA — MODELO CMO');
  if (r.evaluationDate) lines.push(`Fecha de evaluación: ${r.evaluationDate}`);
  if (r.patientId) lines.push(`Identificador del paciente (seudonimizado): ${r.patientId}`);
  lines.push(`Valoración: ${r.statusLabel}`);

  const c = r.clinical;
  section('Situación clínica y farmacoterapéutica relevante', [
    c.mainPathology && `- Patología respiratoria principal: ${c.mainPathology}.`,
    c.otherPathologies.length && `- Otras patologías respiratorias: ${c.otherPathologies.join('; ')}.`,
    c.age && `- Edad: ${c.age}.`,
    c.bmi && `- IMC: ${c.bmi}.`,
    ...r.contextFactors.map(f => `- ${f.label}${f.points ? ` (${f.points} p)` : ''}.`)
  ]);

  const s = r.stratification;
  section('Valoración CMO (estratificación)', [
    `- Puntuación total: ${s.total}/${s.max} (${s.subtotals.map(x => `${x.short} ${x.points}/${x.max}`).join('; ')}).`,
    `- Prioridad calculada por el modelo: ${s.calculatedPriority}.`,
    s.automaticCauses.length && `- Criterio de prioridad automática: ${s.automaticCauses.join('; ')}.`,
    s.assistedCount && `- Origen de los datos: ${s.assistedCount} variable(s) incorporada(s) desde el análisis asistido del texto, confirmada(s) por el profesional.`,
    s.override && `- Modificación por criterio profesional a ${s.override.priority}${s.override.motive ? `. Motivo: ${s.override.motive}` : ''}. Justificación: ${s.override.justification}`
  ]);
  lines.push('', `RESULTADO DE ESTRATIFICACIÓN: ${s.finalPriority.toUpperCase()}${r.statusLabel === 'Provisional' ? ' (PROVISIONAL)' : ''}`);

  section('Necesidades farmacoterapéuticas identificadas', r.pharmacotherapeuticNeeds.map(f => `- ${f.label}: ${f.response} (${f.points} p).`));

  const i = r.interventions;
  const list = items => items.map(it => `  - ${it.group}: ${it.label}`);
  section('Intervenciones farmacéuticas', [
    i.done.length && 'Realizadas en esta consulta:', ...list(i.done),
    i.planned.length && 'Planificadas / pendientes:', ...list(i.planned),
    i.recommended.length && `Recomendadas por el modelo para ${s.finalPriority} (no registradas como realizadas):`, ...list(i.recommended)
  ]);

  section('Plan de atención y seguimiento', [
    r.plan.periodicity && `- ${r.plan.periodicity}`,
    r.plan.nextReview && `- Próxima valoración prevista: ${r.plan.nextReview}.`,
    r.plan.notes && `- Observaciones: ${r.plan.notes}`
  ]);

  section('Advertencias', r.warnings.map(w => `- ${w}`));

  lines.push('', `Profesional responsable: ${[r.pharmacist, r.hospital].filter(Boolean).join(' — ')}`);
  lines.push(`Generado con ${r.tool}. ${r.source}`);
  lines.push(r.disclaimer);
  return lines.map(toPlain).join('\n').replace(/\n{3,}/g, '\n\n');
}

export {INTERVENTION_STATUSES};
