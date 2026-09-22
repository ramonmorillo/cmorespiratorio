import { actionsFor, PERIODICITY } from './clinical.js';

/** Adapta el resultado clínico existente a un estado de flujo reutilizable, sin añadir reglas. */
export function buildWorkflowState(patientData, stratificationResult) {
  const actionGroups = actionsFor(stratificationResult.finalPriority);
  const detectedNeeds = Object.entries(actionGroups).map(([id, group]) => ({
    id,
    label: group.label,
    source: 'cmo-priority',
    priority: stratificationResult.finalPriority,
    interventionIds: group.items.map((_, index) => `${id}-${index}`)
  }));
  const selectedInterventions = Object.entries(actionGroups).flatMap(([needId, group]) =>
    group.items.map((label, index) => ({ id: `${needId}-${index}`, needId, label, selected: true }))
  );
  return { patientData, stratificationResult, detectedNeeds, selectedInterventions, periodicity: PERIODICITY[stratificationResult.finalPriority] };
}
