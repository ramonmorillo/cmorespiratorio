import { actionsFor, actionCatalog, PERIODICITY } from './clinical.js';

/** Adapta el resultado clínico existente a un estado de flujo reutilizable, sin añadir reglas. */
export function buildWorkflowState(patientData, stratificationResult) {
  const priority = stratificationResult.finalPriority;
  const catalog = actionCatalog(priority);
  const detectedNeeds = Object.entries(actionsFor(priority)).map(([id, group]) => ({
    id,
    label: group.label,
    source: 'cmo-priority',
    priority,
    interventionIds: catalog.filter(a => a.group === id).map(a => a.id)
  }));
  // Identificadores estables (posición en la tabla original de actuaciones), independientes de la prioridad.
  const selectedInterventions = catalog.map(a => {
    const status = patientData.interventions?.[a.id] || 'recommended';
    return { id: a.id, needId: a.group, label: a.label, level: a.level, status, selected: status !== 'not_applicable' };
  });
  return { patientData, stratificationResult, detectedNeeds, selectedInterventions, periodicity: PERIODICITY[priority] };
}
