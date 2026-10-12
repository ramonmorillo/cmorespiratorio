# SIAF-CMO Respiratorio

Versión 1.1.0 (octubre de 2026). Basada en la metodología CMO MAPEX-SEFH: [Adaptación del Modelo de Atención Farmacéutica CMO al paciente con patologías respiratorias (SEFH)](https://www.sefh.es/mapex/images/modelo-CMO-al-paciente-con-patologias-respiratorias.pdf).

Aplicación web estática para apoyar la estratificación farmacéutica de pacientes con patologías respiratorias mediante el modelo CMO (Capacidad–Motivación–Oportunidad). Funciona sin backend, sin analítica, sin cookies de seguimiento y con almacenamiento local de datos estructurados confirmados.

## Uso

```bash
npm test
npm run build
```

Publicación GitHub Pages: configurar Pages desde la rama/artefacto que contenga `dist/` o servir la raíz del repositorio; la app incluye `<base href="/cmorespiratorio/">` para funcionar bajo `/cmorespiratorio/`.

## Alcance

Herramienta de apoyo profesional: no diagnóstica, no prescriptiva, no sustitutiva del juicio clínico, no producto sanitario certificado y pendiente de validación asistencial.

## Novedades 1.1.0-rc1 (auditoría pre-entrega)

- Informe PDF y «Copiar informe para historia clínica» desde el paso 7.
- Registro del estado de cada intervención y plan de seguimiento.
- Pruebas E2E: `npm run build && npm run test:e2e` (requiere Playwright/Chromium).
- Guía de uso: `GUIA_RAPIDA_FARMACEUTICO.md`. Auditoría: `INFORME_AUDITORIA_PREENTREGA.md`.
