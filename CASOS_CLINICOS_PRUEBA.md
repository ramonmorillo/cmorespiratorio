# Casos clínicos de prueba (ficticios)

Todos los pacientes son inventados. Definición ejecutable: `tests/fixtures/cases.js`. Salvo indicación, las variables no citadas = «No», objetivos farmacoterapéuticos = «alcanzados», consulta de adultos = sí. Puntos según `CLINICAL_RULES.md` y `src/clinical.js`.

| Caso | Paciente ficticio | Variables positivas (puntos) | Esperado (fundamento) | Obtenido |
|---|---|---|---|---|
| C1 `RESP-P1-001` | EPOC (principal) + bronquiectasias, 72 a, IMC 31,5 | Edad >65 (2), obesidad (3), comorbilidad no resp. (3), trastorno mental (3), deterioro cognitivo-sensorial (4), gravedad/O₂ (2), no adherencia (4), medicamentos que empeoran (4), OFT no alcanzados (2), polimedicación (3), tabaquismo activo (4), ≥2 ingresos/urgencias (3) | 37 ⇒ **P1** (≥32) | 37, P1 ✔ |
| C2 `RESP-P2-021` | Asma grave, 45 a, IMC 24 | No adherencia (4), tabaquismo (4), ≥2 urgencias (3), polimedicación (3), comorbilidad no resp. (3), OFT no alcanzados (2), cambios 6 m (1), naïve (1) | 21 ⇒ **P2** (límite inferior) | 21, P2 ✔ |
| C3 `RESP-P3-020` | Igual que C2 sin naïve | — | 20 ⇒ **P3** (límite superior) | 20, P3 ✔ |
| C4 `RESP-P2-031` | C2 + deterioro cognitivo (4) + trastorno mental (3) + socioeconómico (3) | — | 31 ⇒ **P2** (límite superior) | 31, P2 ✔ |
| C5 `RESP-P1-032` | C2 + deterioro cognitivo (4) + trastorno mental (3) + >1 patología resp. (2) + medicación hospitalaria compleja (2) | — | 32 ⇒ **P1** (límite inferior) | 32, P1 ✔ |
| C6 `RESP-P3-001` | Asma grave controlada, 50 a | Cambios de medicación 6 m (1) | 1 ⇒ **P3** | 1, P3 ✔ |
| C7 `RESP-EMB-001` | Asma grave, gestante de 32 a | Embarazo (0 puntos) | 0 ⇒ **P1 automática** (excepción) | 0, P1 automática ✔ |
| C8 `RESP-MEN-017` | 17 a en consulta de adultos | — | 0 ⇒ **P1 automática** | 0, P1 automática ✔ |
| C9 `RESP-PED-014` | 14 a, no en consulta de adultos | — | **Modelo no aplicable** (derivar a pediátrico) | No aplicable; informes bloqueados ✔ |
| C10 `RESP-FQ-001` | Fibrosis quística, 24 a, IMC 17,9 | Desnutrición con FQ (3) | 3 ⇒ **P3** | 3, P3 ✔ |
| C11 `RESP-PROV-001` | FPI, 68 a, IMC 22; solo 4 variables valoradas | No adherencia (4), gravedad/O₂ (2) + edad >65 (2) | 8 ⇒ **P3 provisional**; 18 pendientes; máximo alcanzable 56 ⇒ podría ser P1 | 8, P3 provisional, rango 56/P1 ✔ |

## Casos de robustez (pruebas unitarias/E2E)

| Situación | Esperado | Obtenido |
|---|---|---|
| Edad vacía, «abc», −3 o 150 con «Aplicar edad registrada» | Variable pendiente; sin P1 automática | ✔ (antes: P1 automática falsa) |
| IMC vacío o 5 | Pendiente | ✔ (antes: desnutrición, 1 punto) |
| IMC 18,4 / 18,3 / 29,9 / 30 | 0 / 1 / 0 / 3 | ✔ |
| Edad 65 / 66 | 0 / 2 | ✔ |
| Edad 40 marcada como pediátrica | Advertencia de incoherencia | ✔ |
| 17 años fuera de consulta de adultos | Advertencia de revisión del modelo aplicable | ✔ |
| Modificación a P1 con justificación «corto» | No se aplica | ✔ |
| Rebaja de P1 automática | Advertencia de justificación reforzada | ✔ |
| Variable cambiada tras finalizar | Informes bloqueados hasta revalidar | ✔ |
| JSON importado con «si», variables inventadas o HTML | Pendientes / descartados | ✔ |
| Texto «Varón de 70 años con EPOC. IMC: 31,5. Exfumador. Posible oxigenoterapia. Mala adherencia…» | Edad 70 y IMC 31,5 transferidos; tabaquismo = No; oxigenoterapia dudosa sin preselección; no adherencia = Sí | ✔ |
