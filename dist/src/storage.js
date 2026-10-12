import {normalizeCase} from './clinical.js';

const KEY = 'siaf-cmo-respiratorio-cases';
const DRAFT_KEY = 'siaf-cmo-respiratorio-draft';

// Almacenamiento exclusivamente local (navegador). Ningún dato sale del equipo.
const readJson = (store, key, fallback) => {
  try { const raw = store?.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const local = () => { try { return globalThis.localStorage; } catch { return null; } };
const session = () => { try { return globalThis.sessionStorage; } catch { return null; } };

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `caso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Devuelve los casos guardados; un contenido corrupto no bloquea la aplicación. */
export function allCases() {
  const cases = readJson(local(), KEY, []);
  return Array.isArray(cases) ? cases.filter(c => c && typeof c === 'object' && c.id) : [];
}

/** Guarda (o actualiza, si ya tiene id) un caso. Devuelve el caso guardado con id estable. */
export function saveCase(form) {
  const item = {...normalizeCase(form), id: form.id || newId(), updatedAt: new Date().toISOString()};
  delete item.center;
  const cases = allCases().filter(c => c.id !== item.id);
  cases.unshift(item);
  local()?.setItem(KEY, JSON.stringify(cases));
  return item;
}
export function deleteCase(id) { local()?.setItem(KEY, JSON.stringify(allCases().filter(c => c.id !== id))); }
export function clearCases() { local()?.removeItem(KEY); }

// Borrador de la evaluación en curso: sessionStorage (se elimina al cerrar la pestaña) para no perder datos al recargar.
export function saveDraft(form, stage) { try { session()?.setItem(DRAFT_KEY, JSON.stringify({form, stage})); } catch { /* cuota o almacenamiento bloqueado */ } }
export function loadDraft() { const d = readJson(session(), DRAFT_KEY, null); return d && d.form ? {form: normalizeCase(d.form), stage: Number(d.stage) || 1} : null; }
export function clearDraft() { try { session()?.removeItem(DRAFT_KEY); } catch { /* sin acceso */ } }
