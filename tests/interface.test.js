import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');

test('la navegación contiene las siete etapas comunes en orden',()=>{
  const labels=['Inicio','Historia clínica','Revisión','Estratificación','Necesidades','Intervenciones','Informe'];
  const positions=labels.map(label=>html.indexOf(label));
  assert.ok(positions.every(position=>position>=0));
  assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
  assert.equal((html.match(/data-stage="[1-7]"/g)||[]).length,7);
});

test('las dos entradas convergen en la misma etapa de historia clínica',()=>{
  assert.match(app,/mode==='manual'\)goToStage\(2\)/);
  assert.match(app,/continueAssisted'\)\.onclick=\(\)=>goToStage\(2\)/);
  assert.equal((html.match(/id="variables"/g)||[]).length,1);
});

test('el análisis requiere confirmación o descarte profesional',()=>{
  assert.match(html,/La herramienta ayuda a cumplimentar: no decide ni valida datos clínicos/);
  assert.match(app,/Confirmar dato/);
  assert.match(app,/Descartar/);
});

test('faldón: fuente MAPEX-SEFH, versión vigente y aviso legal',async()=>{
  const {VERSION,SOURCE_URL}=await import('../src/clinical.js');
  assert.match(html,/metodología <strong>CMO \(Capacidad–Motivación–Oportunidad\) MAPEX-SEFH<\/strong>/);
  assert.ok(html.includes(`href="${SOURCE_URL}"`),'enlace al documento SEFH');
  assert.equal(SOURCE_URL,'https://www.sefh.es/mapex/images/modelo-CMO-al-paciente-con-patologias-respiratorias.pdf');
  assert.ok(html.includes(`<span id="appVersion">${VERSION}</span>`),'versión del faldón = versión del código');
  assert.match(html,/nueva versión de octubre de 2026/);
  for(const norma of ['Reglamento (UE) 2017/745','Reglamento (UE) 2016/679','Ley Orgánica 3/2018','Ley 41/2002'])assert.ok(html.includes(norma),norma);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,(html.match(/target="_blank"/g)||[]).length,'enlaces externos con noopener');
});
