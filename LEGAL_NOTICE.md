# Documento del proyecto

## SIAF-CMO Respiratorio

- Implementación estática HTML/CSS/JavaScript sin backend.
- Reglas clínicas centralizadas en `src/clinical.js`.
- Extractor local determinista en `src/extractor.js`, sin IA generativa, sin proveedores externos, sin claves API y sin llamadas de red.
- Pruebas automatizadas con `npm test`; build con `npm run build`.
- Datos: identificación pseudonimizada y almacenamiento local únicamente de datos estructurados confirmados.
- Aviso: apoyo profesional, no diagnóstico, no prescriptivo, no sustitutivo del juicio clínico, no producto sanitario certificado y pendiente de validación.

# Aviso legal — SIAF-CMO Respiratorio (versión 1.1.0, octubre de 2026)

El texto de esta sección se muestra resumido en el faldón de la aplicación.

## Naturaleza de la herramienta

SIAF-CMO Respiratorio es una **herramienta de apoyo a la decisión para profesionales sanitarios**. No es diagnóstica ni prescriptiva, no sustituye el juicio clínico del profesional responsable y debe ser validada por el centro y el equipo asistencial antes de su implantación en la práctica clínica habitual.

**No es un producto sanitario certificado** conforme al Reglamento (UE) 2017/745 sobre los productos sanitarios ni a ninguna otra normativa de certificación de software sanitario. Su uso no exime al profesional de su responsabilidad clínica ni de sus obligaciones deontológicas y legales.

## Base clínica y metodología

La herramienta se basa en la **metodología CMO (Capacidad–Motivación–Oportunidad) del proyecto MAPEX de la Sociedad Española de Farmacia Hospitalaria (SEFH)**. El modelo de estratificación procede de la publicación SEFH *Adaptación del Modelo de Atención Farmacéutica CMO al paciente con patologías respiratorias*:
https://www.sefh.es/mapex/images/modelo-CMO-al-paciente-con-patologias-respiratorias.pdf

La autoría científica del modelo corresponde al grupo de trabajo SEFH que lo elaboró. Esta herramienta es una implementación informática del modelo, no una obra científica propia, y no implica aval ni respaldo institucional de la SEFH. Las discrepancias o ambigüedades detectadas se documentan en `CLINICAL_RULES.md`, `SOURCE_MAPPING.md` e `INFORME_AUDITORIA_PREENTREGA.md` como pendientes de validación, sin resolverse de forma unilateral.

## Protección de datos

- Funciona íntegramente en el navegador, sin servidor, sin cookies, sin analítica y sin envío de datos a terceros (detalle en `PRIVACY.md`).
- Debe utilizarse con identificadores seudonimizados. Los casos guardados permanecen en el almacenamiento local del navegador, sin cifrar, hasta su borrado.
- El diseño se orienta al principio de minimización de datos del Reglamento (UE) 2016/679 (RGPD) y de la Ley Orgánica 3/2018 (LOPDGDD). **Esta descripción técnica no constituye una declaración de cumplimiento** ni sustituye la evaluación de impacto, el registro de actividades de tratamiento o la autorización del responsable del tratamiento del centro.

## Documentación clínica

El texto para historia clínica y el informe PDF son borradores de apoyo. El profesional que los incorpora a la historia clínica es responsable de revisar su exactitud y pertinencia, conforme a la Ley 41/2002, básica reguladora de la autonomía del paciente y de derechos y obligaciones en materia de información y documentación clínica.

## Propiedad intelectual

El modelo clínico subyacente (variables, puntuaciones y actuaciones) es propiedad intelectual de la SEFH y de los autores del documento original; su reproducción parcial se realiza con fines de apoyo asistencial y con cita expresa de la fuente.

## Limitación de responsabilidad

La herramienta se ofrece «tal cual», sin garantía de ningún tipo, expresa o implícita, incluida la de idoneidad para un uso clínico concreto. El uso de sus resultados para la toma de decisiones asistenciales es responsabilidad exclusiva del profesional sanitario que los aplique.

## Contacto y correcciones

Los errores de implementación, discrepancias con el documento SEFH o sugerencias pueden comunicarse a través del repositorio de GitHub del proyecto.
