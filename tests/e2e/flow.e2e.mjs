// Pruebas de extremo a extremo en Chromium real (Playwright). Ejecutar: npm run build && npm run test:e2e
// Sirve dist/ bajo /cmorespiratorio/ (misma ruta que GitHub Pages). Salidas (PDF, capturas) en E2E_OUT o en un tmp.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {CASES} from '../fixtures/cases.js';

const require = createRequire(import.meta.url);
const loadPlaywright = () => { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { return require(p); } catch { /* siguiente */ } } return null; };
const playwright = loadPlaywright();
const ROOT = path.resolve(process.env.E2E_ROOT || 'dist');
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'cmo-e2e-'));
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8'};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (!url.startsWith('/cmorespiratorio/')) { res.writeHead(404); return res.end(); }
      const rel = url.slice('/cmorespiratorio/'.length) || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const skip = !playwright ? 'Playwright no disponible' : false;
let server, browser, base;
test.before(async () => {
  if (skip) return;
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/cmorespiratorio/`;
  browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
});
test.after(async () => { await browser?.close(); server?.close(); });

async function open(options = {}) {
  const context = await browser.newContext({acceptDownloads: true, viewport: {width: 1280, height: 900}, ...options});
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
  page.on('dialog', d => d.accept());
  await page.goto(base);
  return {context, page, errors, external};
}

async function identity(page, pseudo) {
  await page.fill('#hospital', 'Hospital Ficticio de Pruebas');
  await page.fill('#pharmacist', 'Farmacéutico/a de pruebas');
  await page.fill('#pseudo', pseudo);
}

async function fillCase(page, form) {
  for (const p of form.pathologies) await page.check(`#pathologies input[value="${p}"]`);
  if (form.mainPathology) await page.selectOption('#mainPathology', form.mainPathology);
  if (form.adultClinic === false) await page.uncheck('#adultClinic');
  if (form.age !== undefined) await page.fill('#age', String(form.age));
  if (form.bmi !== undefined) await page.fill('#bmi', String(form.bmi));
  for (const [id, value] of Object.entries(form.values)) await page.selectOption(`[data-var="${id}"]`, value);
}

async function stratify(page, c) {
  await identity(page, c.form.pseudoId);
  await page.click('#startManual');
  await fillCase(page, c.form);
  await page.click('[data-stage="2"] [data-next="3"]');
  await page.click('[data-stage="3"] [data-next="4"]');
}

test('circuito completo P1: estratificación, intervenciones, copia para HC y PDF', {skip}, async () => {
  const {context, page, errors, external} = await open();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: base.replace(/\/cmorespiratorio\/$/, '')});
  await stratify(page, CASES.C1_P1);
  assert.equal(await page.textContent('#score'), '37/59');
  assert.equal(await page.textContent('#priority'), 'P1');
  await page.click('#finish');
  assert.ok(await page.isVisible('[data-stage="5"].active'), 'tras finalizar se muestran las necesidades');
  assert.match(await page.textContent('#needs'), /Falta de adherencia a cualquier medicamento/);
  await page.click('[data-stage="5"] [data-next="6"]');
  await page.selectOption('[data-intervention="edu-0"]', 'done');
  await page.selectOption('[data-intervention="sft-2"]', 'done');
  await page.selectOption('[data-intervention="coord-3"]', 'planned');
  await page.selectOption('[data-intervention="coord-0"]', 'not_applicable');
  await page.fill('#nextReview', '2027-01-15');
  await page.fill('#planNotes', 'Revisar técnica inhalatoria; derivación a deshabituación tabáquica acordada con Neumología.');
  await page.click('[data-stage="6"] [data-next="7"]');
  await page.screenshot({path: path.join(OUT, 'p1-informe-escritorio.png'), fullPage: true});

  const text = await page.inputValue('#hceText');
  assert.match(text, /RESULTADO DE ESTRATIFICACIÓN: PRIORIDAD 1/);
  assert.match(text, /Realizadas en esta consulta:\n {2}- Seguimiento farmacoterapéutico: Control y seguimiento de adherencia/);
  assert.match(text, /Planificadas \/ pendientes:\n {2}- Coordinación asistencial: Coordinación intrahospitalaria/);
  assert.doesNotMatch(text, /Colaboración con Asociaciones/, 'no procede no aparece');
  assert.match(text, /Próxima valoración prevista: 15\/01\/2027/);

  await page.click('#copyHce');
  await page.waitForFunction(() => document.querySelector('#copyStatus').textContent.length > 0);
  assert.match(await page.textContent('#copyStatus'), /copiado/);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, text, 'el portapapeles contiene exactamente el texto mostrado');
  fs.writeFileSync(path.join(OUT, 'p1-portapapeles.txt'), clip);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#downloadPdf')]);
  const pdfPath = path.join(OUT, 'p1-informe.pdf');
  await download.saveAs(pdfPath);
  assert.match(download.suggestedFilename(), /^informe-cmo-respiratorio-\d{4}-\d{2}-\d{2}\.pdf$/);
  const bytes = fs.readFileSync(pdfPath);
  assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.4');
  try {
    const pdfText = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {encoding: 'utf8'}).replace(/\s+/g, ' ');
    for (const s of ['Prioridad 1', '37/59', 'RESP-P1-001', 'Promoción de la adherencia.', '15/01/2027', 'Página 1 de']) assert.ok(pdfText.includes(s), `PDF contiene ${s}`);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }

  // Guardado: finalizar de nuevo no duplica el caso.
  assert.equal(await page.locator('#saved [data-load]').count(), 1);
  await page.click('[data-go="4"]');
  await page.click('#finish');
  await page.click('[data-go="7"]');
  assert.equal(await page.locator('#saved [data-load]').count(), 1, 'sin duplicados tras refinalizar');

  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: path.join(OUT, 'p1-informe-movil.png'), fullPage: true});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `sin desplazamiento horizontal en móvil (${overflow}px)`);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, [], 'sin peticiones a servicios externos');
  await context.close();
});

test('cambio tras finalizar: informe bloqueado hasta revalidar y actualización inmediata', {skip}, async () => {
  const {context, page, errors} = await open();
  await stratify(page, CASES.C2_P2_LIMIT_21);
  assert.equal(await page.textContent('#priority'), 'P2');
  await page.click('#finish');
  await page.click('[data-go="7"]');
  assert.match(await page.inputValue('#hceText'), /21\/59/);
  await page.click('[data-go="2"]');
  await page.selectOption('[data-var="socioeconomic"]', 'yes');
  await page.click('[data-go="7"]');
  assert.equal(await page.isDisabled('#copyHce'), true);
  assert.equal(await page.isDisabled('#downloadPdf'), true);
  assert.match(await page.textContent('#reportBlocked'), /Vuelva a validar/);
  await page.click('[data-go="4"]');
  assert.equal(await page.textContent('#provisional'), 'Pendiente de revalidar');
  await page.click('#finish');
  await page.click('[data-go="7"]');
  assert.equal(await page.isDisabled('#copyHce'), false);
  assert.match(await page.inputValue('#hceText'), /24\/59/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('límites P3/P2/P1 a través de la interfaz', {skip}, async () => {
  for (const [key, expected] of [['C3_P3_LIMIT_20', 'P3'], ['C4_P2_LIMIT_31', 'P2'], ['C5_P1_LIMIT_32', 'P1'], ['C7_PREGNANCY', 'P1'], ['C10_CF_UNDERWEIGHT', 'P3']]) {
    const {context, page, errors} = await open();
    await stratify(page, CASES[key]);
    assert.equal(await page.textContent('#priority'), expected, key);
    assert.equal(await page.textContent('#score'), `${CASES[key].expected.total}/59`, key);
    assert.deepEqual(errors, [], key);
    await context.close();
  }
});

test('datos incompletos: diálogo de pendientes, resultado provisional y rango alcanzable', {skip}, async () => {
  const {context, page, errors} = await open();
  await stratify(page, CASES.C11_INCOMPLETE);
  assert.match(await page.textContent('#pendingImpact'), /podría llegar a P1/);
  await page.click('#finish');
  assert.ok(await page.isVisible('#pendingDialog'));
  assert.equal(await page.textContent('#pendingCount'), '18');
  await page.click('#finishProvisional');
  await page.click('[data-go="7"]');
  const text = await page.inputValue('#hceText');
  assert.match(text, /PRIORIDAD 3 \(PROVISIONAL\)/);
  assert.match(text, /18 variable\(s\) pendiente\(s\)/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('pediátrico y modificación manual sin justificación', {skip}, async () => {
  const {context, page, errors} = await open();
  await stratify(page, CASES.C9_PEDIATRIC);
  assert.equal(await page.textContent('#priority'), 'No aplicable');
  assert.ok(await page.isVisible('#applicability'));
  await page.click('#finish');
  await page.click('[data-go="7"]');
  assert.equal(await page.isDisabled('#copyHce'), true);
  await context.close();

  const s2 = await open();
  await stratify(s2.page, CASES.C6_P3_SIMPLE);
  await s2.page.selectOption('#overridePriority', 'P1');
  assert.equal(await s2.page.textContent('#priority'), 'P3', 'sin justificación no se aplica');
  assert.match(await s2.page.textContent('#overrideError'), /justificación/);
  await s2.page.fill('#overrideJustification', 'Reagudización grave reciente no recogida en las variables');
  assert.equal(await s2.page.textContent('#priority'), 'P1');
  await s2.page.click('#finish');
  await s2.page.click('[data-go="7"]');
  const text = await s2.page.inputValue('#hceText');
  assert.match(text, /Prioridad calculada por el modelo: Prioridad 3/);
  assert.match(text, /Modificación por criterio profesional a Prioridad 1/);
  assert.match(text, /RESULTADO DE ESTRATIFICACIÓN: PRIORIDAD 1/);
  assert.deepEqual([...errors, ...s2.errors], []);
  await s2.context.close();
});

test('análisis asistido: la edad e IMC detectados se transfieren y requieren confirmación', {skip}, async () => {
  const {context, page, errors} = await open();
  await identity(page, 'RESP-ASIST-001');
  await page.click('#startAssisted');
  await page.fill('#clinicalText', 'Varón de 70 años con EPOC. IMC: 31,5. Exfumador. Posible oxigenoterapia. Mala adherencia al tratamiento inhalado.');
  await page.click('#extract');
  assert.equal(await page.inputValue('#clinicalText'), '', 'el texto pegado se elimina');
  const proposals = page.locator('.proposal');
  const n = await proposals.count();
  for (let i = 0; i < n; i++) {
    const box = proposals.nth(i);
    if (await box.locator('[data-proposal-value]').inputValue() === '') { await box.locator('[data-reject]').click(); continue; }
    await box.locator('[data-accept]').click();
  }
  await page.click('#continueAssisted');
  assert.equal(await page.inputValue('#age'), '70');
  assert.equal(await page.inputValue('#bmi'), '31.5');
  assert.equal(await page.inputValue('[data-var="activeSmoking"]'), 'no');
  assert.equal(await page.inputValue('[data-var="nonAdherence"]'), 'yes');
  assert.equal(await page.inputValue('[data-var="severityOxygen"]'), 'pending', 'mención dudosa no se incorpora');
  assert.match(await page.textContent('#sub-demographic'), /5\/5/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('persistencia: recarga recupera el borrador; nueva evaluación reinicia; JSON corrupto no bloquea', {skip}, async () => {
  const {context, page, errors} = await open();
  await identity(page, 'RESP-DRAFT-001');
  await page.click('#startManual');
  await page.selectOption('[data-var="activeSmoking"]', 'yes');
  await page.reload();
  assert.equal(await page.inputValue('#pseudo'), 'RESP-DRAFT-001');
  assert.equal(await page.inputValue('[data-var="activeSmoking"]'), 'yes');
  assert.ok(await page.isVisible('[data-stage="2"].active'));
  await page.click('#newCase');
  assert.equal(await page.inputValue('#pseudo'), '');
  assert.equal(await page.inputValue('[data-var="activeSmoking"]'), 'pending');
  assert.ok(await page.isVisible('[data-stage="1"].active'));
  await page.evaluate(() => localStorage.setItem('siaf-cmo-respiratorio-cases', '{corrupto'));
  await page.reload();
  assert.ok(await page.isVisible('#startManual'));
  assert.deepEqual(errors, []);
  await context.close();
});

test('accesibilidad básica: controles con nombre accesible y validación visible', {skip}, async () => {
  const {context, page, errors} = await open();
  await page.click('#startManual');
  assert.match(await page.textContent('#validation'), /hospital/);
  assert.equal(await page.getAttribute('#hospital', 'aria-invalid'), 'true');
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('select, input:not([type=file]), textarea')].filter(e => {
    const labelled = e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'));
    return !(e.labels?.length || e.getAttribute('aria-label') || labelled);
  }).map(e => e.id || e.outerHTML.slice(0, 60)));
  assert.deepEqual(unnamed, []);
  await page.setViewportSize({width: 820, height: 1100});
  await identity(page, 'RESP-TAB-001');
  await page.click('#startManual');
  await page.screenshot({path: path.join(OUT, 'historia-tableta.png')});
  assert.deepEqual(errors, []);
  await context.close();
});

test('copia sin API de portapapeles: método alternativo con confirmación visible', {skip}, async () => {
  const {context, page, errors} = await open();
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true}));
  await page.reload();
  await stratify(page, CASES.C6_P3_SIMPLE);
  await page.click('#finish');
  await page.click('[data-go="7"]');
  await page.click('#copyHce');
  await page.waitForFunction(() => document.querySelector('#copyStatus').textContent.length > 0);
  assert.match(await page.textContent('#copyStatus'), /copiado|Ctrl\+C/);
  assert.equal(await page.evaluate(() => document.querySelector('#hceText').closest('details').open), true);
  const selected = await page.evaluate(() => { const t = document.querySelector('#hceText'); return t.value.slice(t.selectionStart, t.selectionEnd).length === t.value.length; });
  assert.ok(selected, 'el texto completo queda seleccionado');
  assert.deepEqual(errors, []);
  await context.close();
});
