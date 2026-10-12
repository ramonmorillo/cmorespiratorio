// Casos sintéticos A–J con referencia manual (gold standard) para las 22 variables. Textos ficticios.
// Codificación de la referencia por variable:
//   'yes' / 'no'          propuesta firme esperada (valor del formulario; en pharmGoals 'no' = objetivos NO alcanzados)
//   {age: n} / {bmi: n}   valor numérico esperado
//   'review'              debe quedar para revisión (dudosa, contradictoria o no atribuible): nunca propuesta firme
//   (ausente)             sin información en el texto: debe quedar sin mención
// La referencia se ha definido por criterio clínico a partir del texto y de los criterios del modelo,
// no a partir de la salida del extractor. No constituye validación clínica externa.
export const GOLD_CASES = [
  {id: 'A', title: 'EPOC complejo, comorbilidades, polimedicación, tabaquismo y baja adherencia', pathologies: ['copd', 'bronchiectasis'],
    text: 'Varón de 74 años con EPOC (GOLD E) y bronquiectasias, ambas en tratamiento inhalado. IMC 32,4. HTA en tratamiento con enalapril y DM2 con metformina. Síndrome depresivo en tratamiento con sertralina. Fumador activo de 20 cigarrillos/día. Mala adherencia al tratamiento inhalado (TAI 36). Tratamiento actual: 9 principios activos. Precisa oxigenoterapia domiciliaria. En el último año, tres ingresos por exacerbación de EPOC. Se cambia el inhalador hace 3 meses. Objetivos farmacoterapéuticos no alcanzados.',
    gold: {age: {age: 74}, bmi: {bmi: 32.4}, respComorbidity: 'yes', nonRespComorbidity: 'yes', mentalDisorder: 'yes', severityOxygen: 'yes', nonAdherence: 'yes', worseningMeds: 'yes', pharmGoals: 'no', polypharmacy: 'yes', complexHospitalMeds: 'review', naiveHospitalTherapy: 'yes', medicationChanges6m: 'yes', activeSmoking: 'yes', hospitalUrgency: 'yes'}},
  {id: 'B', title: 'Asma grave controlada, buena adherencia y ausencia explícita de factores', pathologies: ['asthma'],
    text: 'Mujer de 45 años con asma grave en tratamiento con mepolizumab (pluma precargada) desde 2021. IMC 23,1. Asma bien controlada, objetivos farmacoterapéuticos alcanzados. Buena adherencia (TAI 50). No fumadora. Sin otras comorbilidades. Sin antecedentes psiquiátricos. Sin deterioro cognitivo ni sensorial. Sin otras patologías respiratorias. No ha precisado ingresos ni visitas a urgencias en el último año. Sin cambios en el tratamiento en los últimos 6 meses. Niega hábitos tóxicos. Sin exposición laboral. Buena calidad de vida. 4 principios activos.',
    gold: {age: {age: 45}, bmi: {bmi: 23.1}, respComorbidity: 'no', nonRespComorbidity: 'no', mentalDisorder: 'no', cognitiveSensory: 'no', severityOxygen: 'review', nonAdherence: 'no', pharmGoals: 'yes', polypharmacy: 'no', complexHospitalMeds: 'yes', naiveHospitalTherapy: 'no', medicationChanges6m: 'no', activeSmoking: 'no', alcoholDrugs: 'no', occupationalExposure: 'no', qualityOfLife: 'no', hospitalUrgency: 'no'}},
  {id: 'C', title: 'Fibrosis quística con IMC bajo', pathologies: ['cf'],
    text: 'Varón de 24 años con fibrosis quística. IMC 17,6. FEV1 38%. Tratamiento con tobramicina nebulizada y dornasa alfa nebulizada; elexacaftor/tezacaftor/ivacaftor. 7 principios activos. Adherencia adecuada (MPR 0,92). Dos ingresos por exacerbación respiratoria en los últimos 12 meses. No fumador.',
    gold: {age: {age: 24}, bmi: {bmi: 17.6}, severityOxygen: 'yes', complexHospitalMeds: 'yes', polypharmacy: 'yes', nonAdherence: 'no', hospitalUrgency: 'yes', activeSmoking: 'no'}},
  {id: 'D', title: 'Información clínica incompleta', pathologies: ['copd'],
    text: 'Mujer con EPOC. Refiere disnea. Pendiente de completar la valoración farmacoterapéutica.',
    gold: {naiveHospitalTherapy: 'yes'}},
  {id: 'E', title: 'Negaciones y antecedentes familiares', pathologies: ['bronchiectasis'],
    text: 'Paciente de 58 años con bronquiectasias. Antecedentes familiares de depresión y deterioro cognitivo (madre). No presenta deterioro cognitivo. Exfumador desde hace cinco años. Niega consumo problemático de alcohol. Sin dificultades socioeconómicas. No ha presentado ingresos en el último año. Posible falta de adherencia. Sin exposición laboral.',
    gold: {age: {age: 58}, mentalDisorder: 'review', cognitiveSensory: 'review', activeSmoking: 'no', alcoholDrugs: 'no', socioeconomic: 'no', hospitalUrgency: 'review', nonAdherence: 'review', occupationalExposure: 'no'}},
  {id: 'F', title: 'Datos contradictorios', pathologies: ['copd'],
    text: 'Varón de 66 años, EPOC. No fumador. En la entrevista refiere que fuma diez cigarrillos diarios. Buena adherencia según el paciente; TAI 32. IMC 27. Edad: 61.',
    gold: {age: 'review', activeSmoking: 'review', nonAdherence: 'review', bmi: {bmi: 27}, naiveHospitalTherapy: 'yes'}},
  {id: 'G', title: 'Embarazo con prioridad automática', pathologies: ['asthma'],
    text: 'Mujer de 31 años, gestante de 24 semanas, con asma grave. IMC 26. Sin otras comorbilidades. No fumadora. Buena adherencia.',
    gold: {pregnancyPuerperium: 'yes', age: {age: 31}, bmi: {bmi: 26}, nonRespComorbidity: 'no', activeSmoking: 'no', nonAdherence: 'no'}},
  {id: 'H', title: 'Medicación potencialmente agravante', pathologies: ['asthma', 'crsnp'],
    text: 'Mujer de 62 años con asma grave y rinosinusitis crónica con poliposis nasal, ambas en tratamiento. Toma ibuprofeno a diario por artrosis y propranolol para el temblor esencial. Bisoprolol suspendido por bradicardia. Alergia a AAS.',
    gold: {age: {age: 62}, respComorbidity: 'yes', nonRespComorbidity: 'yes', worseningMeds: 'yes'}},
  {id: 'I', title: 'Terminología abreviada y errores ortográficos', pathologies: ['copd', 'bronchiectasis'],
    text: 'Varon 70a, EPOC GOLD E, bronquiectasis. IMC: 29. HTA y DM2 en tto con metformina y losartan. Fumador activo 1 paq/dia. Oxigenoterapia domicilaria (OCD). TAI-10 de 40. 2 ingresos x reagudizacion en ultimo año. 10 p.a.',
    gold: {age: {age: 70}, bmi: {bmi: 29}, respComorbidity: 'review', nonRespComorbidity: 'yes', severityOxygen: 'yes', activeSmoking: 'yes', nonAdherence: 'yes', hospitalUrgency: 'yes', polypharmacy: 'yes', naiveHospitalTherapy: 'yes'}},
  {id: 'J', title: 'Ingresos y urgencias en distintos periodos y por distintas causas', pathologies: ['copd'],
    text: 'Mujer de 69 años con EPOC. Hace dos años tuvo tres ingresos por neumonía. En el último año, un ingreso por exacerbación de EPOC y una visita a urgencias por crisis de disnea. Además, cuatro exacerbaciones tratadas en domicilio con corticoides orales. Una visita a urgencias por fractura de muñeca este año.',
    gold: {age: {age: 69}, hospitalUrgency: 'no', ismpHighRisk: 'review', naiveHospitalTherapy: 'yes'}}
];
