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
