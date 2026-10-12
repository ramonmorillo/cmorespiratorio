// Pacientes ficticios de prueba (sin datos reales). Documentados en CASOS_CLINICOS_PRUEBA.md.
import {VARIABLES} from '../../src/clinical.js';

const base = (overrides = {}) => {
  const values = Object.fromEntries(VARIABLES.map(v => [v.id, 'no']));
  values.pharmGoals = 'yes';
  values.age = 'adult';
  values.bmi = 'set';
  return {values, age: 45, bmi: 24, adultClinic: true, pathologies: ['asthma'], mainPathology: 'asthma', hospital: 'Hospital Ficticio de Pruebas', pharmacist: 'Farmacéutico/a de pruebas', ...overrides};
};
const withYes = (form, ids, extra = {}) => ({...form, values: {...form.values, ...Object.fromEntries(ids.map(id => [id, 'yes'])), ...extra}});

const P2_21 = ['nonAdherence', 'activeSmoking', 'hospitalUrgency', 'polypharmacy', 'nonRespComorbidity', 'medicationChanges6m', 'naiveHospitalTherapy'];

export const CASES = {
  C1_P1: {
    description: 'EPOC + bronquiectasias, 72 años, IMC 31,5, no adherente, fumador activo, oxigenoterapia, ≥2 urgencias',
    form: withYes(base({pseudoId: 'RESP-P1-001', age: 72, bmi: '31.5', pathologies: ['copd', 'bronchiectasis'], mainPathology: 'copd'}),
      ['nonAdherence', 'activeSmoking', 'severityOxygen', 'hospitalUrgency', 'polypharmacy', 'nonRespComorbidity', 'mentalDisorder', 'cognitiveSensory', 'worseningMeds'], {pharmGoals: 'no'}),
    expected: {total: 37, priority: 'P1', pending: false}
  },
  C2_P2_LIMIT_21: {
    description: 'Asma grave, 45 años: exactamente 21 puntos (límite inferior de P2)',
    form: withYes(base({pseudoId: 'RESP-P2-021'}), P2_21, {pharmGoals: 'no'}),
    expected: {total: 21, priority: 'P2', pending: false}
  },
  C3_P3_LIMIT_20: {
    description: 'Asma grave, 45 años: exactamente 20 puntos (límite superior de P3)',
    form: withYes(base({pseudoId: 'RESP-P3-020'}), P2_21.filter(id => id !== 'naiveHospitalTherapy'), {pharmGoals: 'no'}),
    expected: {total: 20, priority: 'P3', pending: false}
  },
  C4_P2_LIMIT_31: {
    description: '31 puntos (límite superior de P2)',
    form: withYes(base({pseudoId: 'RESP-P2-031'}), [...P2_21, 'cognitiveSensory', 'mentalDisorder', 'socioeconomic'], {pharmGoals: 'no'}),
    expected: {total: 31, priority: 'P2', pending: false}
  },
  C5_P1_LIMIT_32: {
    description: '32 puntos (límite inferior de P1)',
    form: withYes(base({pseudoId: 'RESP-P1-032'}), [...P2_21, 'cognitiveSensory', 'mentalDisorder', 'respComorbidity', 'complexHospitalMeds'], {pharmGoals: 'no'}),
    expected: {total: 32, priority: 'P1', pending: false}
  },
  C6_P3_SIMPLE: {
    description: 'Asma grave bien controlada, 50 años, objetivos alcanzados, solo cambios de medicación recientes',
    form: withYes(base({pseudoId: 'RESP-P3-001', age: 50}), ['medicationChanges6m']),
    expected: {total: 1, priority: 'P3', pending: false}
  },
  C7_PREGNANCY: {
    description: 'Asma grave en gestante de 32 años, resto sin criterios: Prioridad 1 automática',
    form: withYes(base({pseudoId: 'RESP-EMB-001', age: 32}), ['pregnancyPuerperium']),
    expected: {total: 0, priority: 'P1', pending: false, automatic: true}
  },
  C8_MINOR_ADULT_CLINIC: {
    description: '17 años atendido en consulta de adultos: Prioridad 1 automática',
    form: base({pseudoId: 'RESP-MEN-017', age: 17}),
    expected: {total: 0, priority: 'P1', pending: false, automatic: true}
  },
  C9_PEDIATRIC: {
    description: '14 años, no atendido en consulta de adultos: modelo no aplicable (pediátrico)',
    form: base({pseudoId: 'RESP-PED-014', age: 14, adultClinic: false}),
    expected: {applicable: false}
  },
  C10_CF_UNDERWEIGHT: {
    description: 'Fibrosis quística, 24 años, IMC 17,9: desnutrición con FQ (3 puntos)',
    form: base({pseudoId: 'RESP-FQ-001', age: 24, bmi: '17.9', pathologies: ['cf'], mainPathology: 'cf'}),
    expected: {total: 3, priority: 'P3', pending: false}
  },
  C11_INCOMPLETE: {
    description: 'FPI, 68 años, solo 4 variables valoradas: resultado provisional',
    form: {values: {age: 'adult', bmi: 'set', nonAdherence: 'yes', severityOxygen: 'yes'}, age: 68, bmi: 22, adultClinic: true, pathologies: ['ipf'], mainPathology: 'ipf', pseudoId: 'RESP-PROV-001', hospital: 'Hospital Ficticio de Pruebas', pharmacist: 'Farmacéutico/a de pruebas'},
    expected: {total: 8, priority: 'P3', pending: true, maxPossiblePriority: 'P1'}
  }
};
