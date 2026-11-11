// Adaptador de SIAF-CMO Respiratorio al informe único del núcleo CMO (src/cmo-ds/).
// No contiene reglas clínicas: traduce la estructura de report.js (buildReport) a cmo-report/1 sin recalcular nada.
// Respiratorio es el patrón del que deriva el núcleo; su texto y su PDF propios se conservan sin cambios.
import {createReport} from './cmo-ds/cmo-report.js';

const levelCode = code => Number(String(code).slice(1)) || null;
const items = list => list.map(({group, label}) => ({group, label}));

export function toCoreInput(report, {version = ''} = {}) {
  const s = report.stratification, c = report.clinical;
  return {
    title: report.title,
    tool: {name: 'SIAF-CMO Respiratorio', version},
    model: {name: 'SEFH, Adaptación del Modelo de Atención Farmacéutica CMO al paciente con patologías respiratorias', source: report.source},
    evaluationDate: '', // la fecha de evaluación ya está formateada en report.evaluationDate (dd/mm/aaaa)
    status: report.statusLabel === 'Definitiva' ? 'final' : 'provisional',
    hospital: report.hospital, pharmacist: report.pharmacist, patientId: report.patientId,
    context: [
      {label: 'Fecha de evaluación', value: report.evaluationDate},
      {label: 'Patología respiratoria principal', value: c.mainPathology},
      {label: 'Otras patologías respiratorias', value: c.otherPathologies.join('; ')},
      {label: 'Edad', value: c.age}, {label: 'IMC', value: c.bmi}
    ],
    stratification: {
      score: s.total, maxScore: s.max,
      subtotals: s.subtotals.map(x => ({label: x.short, points: x.points, max: x.max})),
      calculatedLevel: s.calculatedPriority, finalLevel: s.finalPriority, levelCode: levelCode(s.finalPriorityCode),
      rules: s.automaticCauses,
      override: s.override ? {level: s.override.priority, motive: s.override.motive, justification: s.override.justification} : null,
      pending: s.pending, assistedCount: s.assistedCount
    },
    factors: report.contextFactors.map(f => ({dimension: f.dimensionLabel, label: f.label, detail: f.response, points: f.points})),
    needs: {confirmed: report.pharmacotherapeuticNeeds.map(f => ({dimension: f.dimensionLabel, label: f.label, detail: f.response})), potential: []},
    interventions: {done: items(report.interventions.done), planned: items(report.interventions.planned), recommended: items(report.interventions.recommended), notApplicableCount: report.interventions.notApplicableCount},
    plan: {periodicity: report.plan.periodicity, nextReview: report.plan.nextReview, notes: report.plan.notes},
    warnings: report.warnings, disclaimer: report.disclaimer
  };
}

export const toCoreReport = (report, opts) => createReport(toCoreInput(report, opts));
