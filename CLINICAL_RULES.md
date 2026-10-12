# Reglas clínicas

- 22 variables en cinco dimensiones: demográficas (máx. 5), clínicas (14), tratamiento (21), sociosanitarias (16) y utilización sanitaria (3). Máximo global: 59.
- Umbrales: P1 ≥32; P2 21–31; P3 ≤20.
- Excepciones sin puntuación ficticia: embarazo/puerperio => P1; <18 atendido en consulta adultos => P1; edad pediátrica 0–15 o hasta derivación autonómica => modelo pediátrico SEFH.
- Patologías incluidas: asma grave, RSCcPN, EPOC, fibrosis quística, bronquiectasias no FQ, FPI, EPID e hipertensión pulmonar.
- Los valores ausentes quedan Pendiente y el resultado es provisional.
- Actuaciones acumulativas: P2 incluye P3; P1 incluye P2 y P3.

## Precisiones de implementación (1.1.0-rc1, pendientes de validación profesional)

- Edad e IMC solo puntúan con un valor numérico plausible (0–120 años; IMC 10–80, admite coma). Si falta, la variable queda **Pendiente** (nunca se interpreta como 0).
- Edad pediátrica ⇒ el modelo de adultos **no se aplica**: no se asigna prioridad ni se generan informes.
- 16–17 años fuera de consulta de adultos: se puntúa como adulto y se muestra advertencia de revisión (decisión pendiente, ver P-3 del informe de auditoría).
- La modificación manual de prioridad solo es efectiva con justificación ≥12 caracteres; la prioridad calculada se muestra siempre.
- Con variables pendientes se informa de la puntuación y prioridad máximas alcanzables.
- Umbrales a verificar en la fuente: desnutrición IMC <18,4 y edad >65 (ver P-1, P-2).

## Analizador de texto clínico v2.0 (apoyo a la cumplimentación; no modifica el modelo)

- El analizador solo **propone**; ninguna variable se incorpora sin confirmación profesional y la ausencia de mención nunca se interpreta como «No».
- Umbrales usados para proponer (tomados de los criterios ya documentados en las ayudas del modelo): TAI <45; MPR <0,8; FVC <50 %; DLCO <30 %; FEV1 <40 % (FQ); caída de FVC ≥10 % o de DLCO ≥15 %; SNOT-22 >50; VAS >7; BSI >8; FACED >5; CAT >21; EQ-VAS <50; ≥6 principios activos; MRCI >11; ≥2 ingresos y/o ≥2 urgencias en el último año por causa respiratoria; cambios en los últimos 6 meses.
- EPOC confirmada ⇒ propuesta «Sí» en naïve a terapia hospitalaria, según la nota del modelo.
- Medicamentos agravantes: solo se propone si el fármaco figura en el anexo para la patología del paciente; β-bloqueantes cardioselectivos solo en RSCcPN.
- Alto riesgo ISMP: subconjunto local de la lista MARC (2014) **pendiente de verificación** frente a la lista vigente.
- Detalle por variable: `docs/EVALUACION_EXTRACTOR.md`, sección 2.
