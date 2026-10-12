import {VARIABLES, scoreVariable} from './clinical.js';

// Extractor local y determinista: propone, nunca decide. Cada propuesta requiere confirmación profesional.
// Negación: se busca solo en el texto que PRECEDE al hallazgo y dentro de la misma frase/cláusula.
const NEGATION = /\b(no|niega|sin|descarta|descartad[oa]|ausencia de|nunca)\b[^.;:\n]{0,30}$/;
const UNCERTAIN = /(sospecha|posible|probable|dudos|antecedentes familiares|madre|padre|hermano|hermana|a valorar|pendiente de)/;
const RULES = {
  pregnancyPuerperium: /\b(embaraz|puerperi|gestante)/,
  age: /(?:\bedad\s*[:=]?\s*(\d{1,3})\b|\b(?:varon|mujer|hombre|paciente|nino|nina|chico|chica)\s+de\s+(\d{1,3})\s*anos\b|\b(\d{1,3})\s*anos\s+de\s+edad\b|\b(\d{1,3})\s*a\.\s)/,
  bmi: /\bimc\s*(?:de|:|=)?\s*(\d{1,2}(?:[,.]\d{1,2})?)/,
  nonAdherence: /(morisky[^.;]{0,40}(positivo|no adherente)|mpr\s*[<]\s*0[,.]8|tai\s*[<]\s*45|mala adherencia|no adherente|baja adherencia|incumplimiento terapeutico)/,
  polypharmacy: /(polimedic|\b(seis|siete|ocho|nueve|diez|once|doce)\s+principios activos|\b([6-9]|[1-9]\d)\s+principios activos|mrci\s*>\s*11)/,
  complexHospitalMeds: /(nebulizad|pluma|jeringa precargada|autoinyector|intravenos|perfusion)/,
  activeSmoking: /(fumador activo|fumadora activa|tabaquismo activo|\bfuma\b|(?<!ex)(?<!ex-)(?<!ex )\bfumador(a)?\b|(?<!ex)\btabaquismo\b)/,
  alcoholDrugs: /(alcoholismo|drogadiccion|cocaina|abuso de alcohol|enolismo)/,
  occupationalExposure: /(exposicion laboral|exposicion profesional|humos|formaldehido|amoniaco|\bcloro\b|polvo(?!\s+seco)(?!\s+para inhalacion)|gases(?!\s+arteriales)(?!\s+en sangre))/,
  qualityOfLife: /(eq-5d|calidad de vida|valoracion\s*<\s*50|problemas moderados)/,
  hospitalUrgency: /\b(dos|tres|cuatro|cinco|[2-9]|\d{2})\s+(?:ingresos|visitas|veces|ocasiones|episodios|consultas|exacerbaciones|reagudizaciones)\b.{0,60}(ingres|urgencia)|\b(dos|tres|cuatro|cinco|[2-9]|\d{2})\s+(?:ingresos|visitas a urgencias|urgencias)\b/,
  severityOxygen: /(oxigenoterapia|gold e\b|clase funcional (iii|iv)\b|vas\s*>\s*7|snot-22\s*>\s*50|fvc\s*<\s*50|dlco\s*<\s*30|fev1\s*<\s*40|bsi\s*>\s*8|faced\s*>\s*5|cat\s*>\s*21)/
};
// Menciones que contradicen el criterio (p. ej., exfumador => no tabaquismo activo).
const EXPLICIT_ABSENCE = {
  activeSmoking: /\b(ex\s?-?\s?fumador(a)?|extabaquismo|tabaquismo (previo|pasado|abandonado)|dejo de fumar|no fumador(a)?|nunca fumador(a)?)\b/
};

const normalize = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function prestratify(text) {
  const source = String(text || '');
  const t = normalize(source);
  // Si la normalización conserva la longitud (caso habitual), el fragmento se muestra con el texto original.
  const display = source.length === t.length ? source : t;
  const out = [];
  for (const v of VARIABLES) {
    let status = 'no_mencionado', proposal = 'pending', certainty = 'baja', fragment = '', rule = 'Sin mención literal', value = null;
    const absence = EXPLICIT_ABSENCE[v.id]?.exec(t);
    const m = RULES[v.id]?.exec(t);
    const hit = m || absence;
    if (hit) {
      fragment = display.slice(Math.max(0, hit.index - 35), hit.index + hit[0].length + 35).trim();
      // Ventanas limitadas a la frase del hallazgo (no cruzan '. ', ';' ni saltos de línea).
      const starts = ['. ', ';', '\n'].map(sep => ({at: t.lastIndexOf(sep, hit.index - 1), sep})).filter(x => x.at >= 0).map(x => x.at + x.sep.length).filter(i => i <= hit.index);
      const start = Math.max(0, hit.index - 40, ...starts);
      const endCandidates = ['. ', ';', '\n'].map(sep => t.indexOf(sep, hit.index + hit[0].length)).filter(i => i >= 0);
      const end = Math.min(hit.index + hit[0].length + 40, ...endCandidates, t.length);
      const before = t.slice(start, hit.index);
      const around = t.slice(start, end);
      if (absence && (!m || absence.index <= m.index)) {
        status = 'ausencia_explicita'; proposal = 'no'; certainty = 'media'; rule = 'Mención explícita que excluye el criterio';
      } else if (NEGATION.test(before)) {
        status = 'ausencia_explicita'; proposal = 'no'; certainty = 'media'; rule = 'Negación previa al criterio en la misma frase';
      } else if (UNCERTAIN.test(around)) {
        status = 'dudoso'; rule = 'Término detectado con incertidumbre o referido a un familiar';
      } else {
        status = 'detectado'; proposal = 'yes'; certainty = 'media'; rule = 'Patrón determinista respiratorio';
      }
    }
    if (v.id === 'age' && m && status === 'detectado') {
      value = Number(m.slice(1).find(Boolean));
      proposal = value < 16 ? 'pediatric' : 'set_age';
      certainty = 'media';
    }
    if (v.id === 'bmi' && m && status === 'detectado') {
      value = Number(m[1].replace(',', '.'));
      proposal = 'set_bmi';
      certainty = 'alta';
    }
    out.push({variableId: v.id, status, proposal, certainty, fragment, rule, value,
      provisionalPoints: proposal === 'yes' ? scoreVariable(v, {values: {[v.id]: 'yes'}}).points : 0});
  }
  return out;
}
export const NETWORK_FREE = true;
