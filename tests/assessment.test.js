// Adaptador al informe único del núcleo CMO y protección de los ficheros clínicos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {calculate, finalizeCase, normalizeCase, VERSION} from '../src/clinical.js';
import {buildReport, reportToText} from '../src/report.js';
import {reportToPdf} from '../src/pdf.js';
import {toCoreReport} from '../src/assessment.js';
import {reportToHtml, reportToText as coreText, validateReport} from '../src/cmo-ds/cmo-report.js';
import {CASES} from './fixtures/cases.js';

test('huella SHA-256 de clinical.js y extractor.js (no modificados; las constantes VERSION y VERSION_DATE se normalizan)', () => {
  const fp = JSON.parse(fs.readFileSync(new URL('./fixtures/clinical-files.sha256.json', import.meta.url), 'utf8'));
  for (const [f, h] of Object.entries(fp)) {
    const text = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/export const VERSION='[^']*';/, 'export const VERSION=X;').replace(/export const VERSION_DATE='[^']*';/, 'export const VERSION_DATE=X;');
    assert.equal(crypto.createHash('sha256').update(text).digest('hex'), h, f);
  }
});

test('todos los casos ficticios exportables producen un informe cmo-report/1 válido y coherente', () => {
  let n = 0;
  for (const [id, c] of Object.entries(CASES)) {
    const f = finalizeCase(normalizeCase(c.form), calculate(c.form).pending ? 'provisional' : 'completed');
    const r = calculate(f), rep = buildReport(f, r);
    if (!rep.exportable) continue;
    n++;
    const core = toCoreReport(rep, {version: VERSION});
    assert.deepEqual(validateReport(core), [], id);
    assert.equal(core.stratification.finalLevel, rep.stratification.finalPriority, id);
    assert.equal(core.stratification.score, r.total, id);
    assert.equal(core.status, rep.statusLabel === 'Definitiva' ? 'final' : 'provisional', id);
    assert.equal(core.stratification.pending.length, rep.stratification.pending.length, id);
    assert.equal(reportToText(rep), coreText(core), id);
    assert.ok(reportToPdf(rep).length > 500, id);
  }
  assert.ok(n >= 5);
});

test('el informe en HTML escapa el contenido', () => {
  const f = finalizeCase(normalizeCase({...CASES.C1_P1.form, hospital: '<img src=x onerror=alert(1)>'}));
  const html = reportToHtml(toCoreReport(buildReport(f, calculate(f))));
  assert.doesNotMatch(html, /<img/);
});
