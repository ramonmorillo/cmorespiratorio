// Generador PDF mínimo, local y sin dependencias (PDF 1.4, Helvetica/Helvetica-Bold con WinAnsiEncoding).
// Las métricas proceden de las tablas AFM estándar de Helvetica (códigos 32–255, Windows-1252).
const HELVETICA=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const HELVETICA_BOLD=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
const CP1252_EXTRA = {'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8a,'‹':0x8b,'Œ':0x8c,'Ž':0x8e,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9a,'›':0x9b,'œ':0x9c,'ž':0x9e,'Ÿ':0x9f};
const SUBSTITUTIONS = {'≥':'>=','≤':'<=','α':'alfa','β':'beta','‐':'-','‑':'-',' ':' ','\t':' '};
const PAGE = {width: 595.28, height: 841.89, left: 50, right: 50, top: 50, bottom: 64};
const COLORS = {ink: [0.09, 0.13, 0.2], muted: [0.36, 0.41, 0.5], accent: [0.03, 0.42, 0.44], soft: [0.9, 0.97, 0.96], warn: [1, 0.97, 0.89], warnInk: [0.45, 0.33, 0], line: [0.85, 0.89, 0.93], white: [1, 1, 1]};

/** Convierte texto Unicode a códigos WinAnsi; los caracteres no representables se sustituyen de forma explícita. */
export function toWinAnsi(text) {
  const codes = [];
  for (const raw of String(text ?? '')) {
    const ch = SUBSTITUTIONS[raw] ?? raw;
    for (const c of ch) {
      const cp = c.codePointAt(0);
      if (cp >= 32 && cp <= 126) codes.push(cp);
      else if (cp >= 160 && cp <= 255) codes.push(cp);
      else if (CP1252_EXTRA[c]) codes.push(CP1252_EXTRA[c]);
      else if (cp === 10 || cp === 13) codes.push(32);
      else codes.push(63); // '?'
    }
  }
  return codes;
}

export function textWidth(text, size, bold = false) {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  return toWinAnsi(text).reduce((sum, code) => sum + (table[code - 32] || 556), 0) * size / 1000;
}

/** Divide un texto en líneas que no superan el ancho disponible (corta palabras excesivamente largas). */
export function wrapText(text, size, maxWidth, bold = false) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (textWidth(word, size, bold) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > maxWidth) cut--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= maxWidth) line = candidate;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

const escapePdf = codes => codes.map(c => c === 40 || c === 41 || c === 92 ? `\\${String.fromCharCode(c)}` : c > 126 ? `\\${c.toString(8).padStart(3, '0')}` : String.fromCharCode(c)).join('');
const rgb = ([r, g, b], op) => `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${op}`;

class Layout {
  constructor(runningTitle) { this.pages = []; this.runningTitle = runningTitle; this.newPage(); }
  get width() { return PAGE.width - PAGE.left - PAGE.right; }
  newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE.height - PAGE.top;
    if (this.pages.length > 1) {
      this.textAt(this.runningTitle, PAGE.left, PAGE.height - 34, 8, false, COLORS.muted);
      this.rule(PAGE.height - 40);
      this.y = PAGE.height - 58;
    }
  }
  ensure(height) { if (this.y - height < PAGE.bottom) this.newPage(); }
  textAt(text, x, y, size, bold = false, color = COLORS.ink) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color, 'rg')} ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(toWinAnsi(text))}) Tj ET`);
  }
  rect(x, y, w, h, color) { this.ops.push(`${rgb(color, 'rg')} ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  rule(y, color = COLORS.line) { this.ops.push(`${rgb(color, 'RG')} 0.6 w ${PAGE.left} ${y.toFixed(2)} m ${PAGE.width - PAGE.right} ${y.toFixed(2)} l S`); }
  /** Párrafo con sangría francesa opcional; nunca deja una línea por debajo del margen inferior. */
  paragraph(text, {size = 9.5, bold = false, color = COLORS.ink, indent = 0, hanging = '', gap = 2} = {}) {
    const lead = size * 1.35;
    const hangWidth = hanging ? textWidth(`${hanging} `, size, bold) : 0;
    const lines = wrapText(text, size, this.width - indent - hangWidth, bold);
    lines.forEach((line, i) => {
      this.ensure(lead);
      this.y -= lead;
      if (i === 0 && hanging) this.textAt(hanging, PAGE.left + indent, this.y, size, bold, color);
      this.textAt(line, PAGE.left + indent + hangWidth, this.y, size, bold, color);
    });
    this.y -= gap;
  }
  heading(text) {
    this.ensure(46); // evita títulos huérfanos al pie de página
    this.y -= 14;
    this.textAt(text.toUpperCase(), PAGE.left, this.y - 11, 10.5, true, COLORS.accent);
    this.y -= 16;
    this.rule(this.y, COLORS.accent);
    this.y -= 2;
  }
  keyValue(key, value) {
    const size = 9.5, keyWidth = 150, lead = size * 1.35;
    const lines = wrapText(value || '—', size, this.width - keyWidth);
    lines.forEach((line, i) => {
      this.ensure(lead);
      this.y -= lead;
      if (i === 0) this.textAt(key, PAGE.left, this.y, size, true, COLORS.muted);
      this.textAt(line, PAGE.left + keyWidth, this.y, size);
    });
  }
  box(lines, {fill, color, size = 9.5, boldFirst = true}) {
    const lead = size * 1.4;
    const wrapped = lines.flatMap((l, i) => wrapText(l, i === 0 && boldFirst ? size + 3 : size, this.width - 24, i === 0 && boldFirst).map(t => ({t, first: i === 0})));
    const height = wrapped.length * lead + (boldFirst ? 18 : 14);
    if (height < PAGE.height - PAGE.top - PAGE.bottom) this.ensure(height + 8);
    this.y -= 8;
    this.rect(PAGE.left, this.y - height, this.width, height, fill);
    let y = this.y - 8;
    wrapped.forEach(({t, first}) => {
      const s = first && boldFirst ? size + 3 : size;
      y -= first && boldFirst ? lead + 3 : lead;
      this.textAt(t, PAGE.left + 12, y, s, first && boldFirst, color);
    });
    this.y -= height;
  }
}

/** Genera el PDF del informe a partir de la estructura única de informe (src/report.js). Devuelve Uint8Array. */
export function reportToPdf(r) {
  const L = new Layout(`${r.title} · ${r.patientId ? `Paciente ${r.patientId} · ` : ''}${r.evaluationDate}`);
  // Encabezado
  L.rect(0, PAGE.height - 92, PAGE.width, 92, COLORS.accent);
  L.textAt(r.title, PAGE.left, PAGE.height - 48, 16, true, COLORS.white);
  L.textAt(`Informe de atención farmacéutica · ${r.tool}`, PAGE.left, PAGE.height - 66, 9, false, COLORS.white);
  L.y = PAGE.height - 104;

  L.keyValue('Fecha de evaluación', r.evaluationDate);
  L.keyValue('Identificador del paciente', r.patientId ? `${r.patientId} (seudonimizado)` : 'No registrado');
  L.keyValue('Farmacéutico/a responsable', r.pharmacist);
  L.keyValue('Hospital o centro', r.hospital);
  L.keyValue('Estado de la valoración', r.statusLabel);

  const s = r.stratification;
  L.box([`Resultado de estratificación: ${s.finalPriority}${r.statusLabel === 'Provisional' ? ' (provisional)' : ''}`,
    `Puntuación total ${s.total}/${s.max} · Prioridad calculada por el modelo: ${s.calculatedPriority}`,
    ...(s.automaticCauses.length ? [`Prioridad automática: ${s.automaticCauses.join('; ')}`] : []),
    ...(s.override ? [`Modificada por criterio profesional a ${s.override.priority}`] : [])], {fill: COLORS.soft, color: COLORS.accent});

  const c = r.clinical;
  L.heading('Situación clínica relevante');
  L.keyValue('Patología principal', c.mainPathology || 'No registrada');
  if (c.otherPathologies.length) L.keyValue('Otras patologías', c.otherPathologies.join('; '));
  if (c.age) L.keyValue('Edad', c.age);
  if (c.bmi) L.keyValue('IMC', c.bmi);

  L.heading('Valoración CMO: variables determinantes');
  L.paragraph(`Puntuación por dimensiones: ${s.subtotals.map(x => `${x.short} ${x.points}/${x.max}`).join(' · ')}.`, {size: 9, color: COLORS.muted});
  if (r.contextFactors.length) r.contextFactors.forEach(f => L.paragraph(`${f.label}${f.points ? ` (${f.points} p)` : ''} — ${f.dimensionLabel}`, {hanging: '•', indent: 4}));
  else if (!r.pharmacotherapeuticNeeds.length) L.paragraph('Ninguna variable puntuada.', {color: COLORS.muted});
  if (s.assistedCount) L.paragraph(`Origen de los datos: ${s.assistedCount} variable(s) incorporada(s) desde el análisis asistido del texto, confirmada(s) por el profesional.`, {size: 9, color: COLORS.muted});
  if (s.override) {
    L.paragraph(`Modificación profesional a ${s.override.priority}.${s.override.motive ? ` Motivo: ${s.override.motive}.` : ''} Justificación: ${s.override.justification}`, {size: 9.5});
  }

  if (r.pharmacotherapeuticNeeds.length) {
    L.heading('Necesidades farmacoterapéuticas identificadas');
    r.pharmacotherapeuticNeeds.forEach(f => L.paragraph(`${f.label}: ${f.response} (${f.points} p)`, {hanging: '•', indent: 4}));
  }

  const i = r.interventions;
  L.heading('Intervenciones farmacéuticas');
  const block = (title, items) => {
    if (!items.length) return;
    L.ensure(44);
    L.paragraph(title, {bold: true, size: 9.5, gap: 1});
    let group = '';
    items.forEach(it => {
      if (it.group !== group) { group = it.group; L.ensure(30); L.paragraph(group, {size: 9, color: COLORS.accent, indent: 4, gap: 0}); }
      L.paragraph(it.label, {hanging: '•', indent: 10, size: 9});
    });
  };
  block('Realizadas en esta consulta', i.done);
  block('Planificadas / pendientes', i.planned);
  block(`Recomendadas por el modelo para ${s.finalPriority} (no registradas como realizadas)`, i.recommended);
  if (!i.done.length && !i.planned.length && !i.recommended.length) L.paragraph('No se han registrado intervenciones.', {color: COLORS.muted});

  L.heading('Plan de atención y seguimiento');
  if (r.plan.periodicity) L.paragraph(r.plan.periodicity, {hanging: '•', indent: 4});
  if (r.plan.nextReview) L.paragraph(`Próxima valoración prevista: ${r.plan.nextReview}`, {hanging: '•', indent: 4});
  if (r.plan.notes) L.paragraph(`Observaciones: ${r.plan.notes}`, {hanging: '•', indent: 4});

  if (r.warnings.length) {
    L.heading('Advertencias');
    r.warnings.forEach(w => L.paragraph(w, {hanging: '!', indent: 4, color: COLORS.warnInk}));
  }
  L.y -= 6;
  L.box(['Aviso profesional', r.disclaimer], {fill: COLORS.warn, color: COLORS.warnInk, size: 8.5});
  L.paragraph(r.source, {size: 8, color: COLORS.muted});

  // Pie de página con numeración
  const total = L.pages.length;
  L.pages.forEach((ops, index) => {
    L.ops = ops;
    L.rule(PAGE.bottom - 18);
    L.textAt(`${r.tool} · Documento de apoyo; no sustituye el juicio clínico`, PAGE.left, PAGE.bottom - 32, 7.5, false, COLORS.muted);
    const label = `Página ${index + 1} de ${total}`;
    L.textAt(label, PAGE.width - PAGE.right - textWidth(label, 7.5), PAGE.bottom - 32, 7.5, false, COLORS.muted);
  });
  return buildPdf(L.pages, `Informe de atencion farmaceutica respiratoria - Modelo CMO`);
}

function buildPdf(pages, title) {
  const objects = [];
  const add = body => { objects.push(body); return objects.length; };
  const catalog = add(null), pagesId = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = pages.map(ops => {
    const stream = ops.join('\n');
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${escapePdf(toWinAnsi(title))}) /Producer (SIAF-CMO Respiratorio) >>`);
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = objects.map((body, index) => { const offset = out.length; out += `${index + 1} 0 obj\n${body}\nendobj\n`; return offset; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 0xff;
  return bytes;
}
