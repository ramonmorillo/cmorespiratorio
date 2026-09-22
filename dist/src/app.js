import {VARIABLES,DIMENSIONS,PATHOLOGIES,calculate,actionsFor,PERIODICITY,exportCase,importCase,toCSV,applyOverride,normalizeCase,finalizeCase,validateClinicalValue} from './clinical.js';
import {prestratify} from './extractor.js';
import {allCases,saveCase,deleteCase,clearCases} from './storage.js';
import {buildWorkflowState} from './workflow.js';

let form=normalizeCase({values:{},pathologies:[],adultClinic:true});
let currentStage=1;
const $=s=>document.querySelector(s);
const el=(t,a={},h='')=>{const e=document.createElement(t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));e.innerHTML=h;return e};
const variableById=id=>VARIABLES.find(v=>v.id===id);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function render(){renderForm();hydrateForm();update();renderSaved();renderFinalPanel();goToStage(currentStage,false)}
function hydrateForm(){
  $('#pseudo').value=form.pseudoId||'';$('#hospital').value=form.hospital||form.center||'';$('#pharmacist').value=form.pharmacist||'';
  $('#overridePriority').value=form.override?.priority||'';$('#overrideMotive').value=form.override?.motive||'';$('#overrideJustification').value=form.override?.justification||'';
  document.querySelectorAll('#pathologies input').forEach(i=>i.checked=(form.pathologies||[]).includes(i.value));
  document.querySelectorAll('select[data-var]').forEach(s=>{s.value=form.values?.[s.dataset.var]||'pending'});
  if($('#age'))$('#age').value=form.age||'';if($('#bmi'))$('#bmi').value=form.bmi||'';if($('#adultClinic'))$('#adultClinic').checked=form.adultClinic!==false;
}
function syncIdentity(){form.pseudoId=$('#pseudo').value.trim();form.hospital=$('#hospital').value.trim();delete form.center;form.pharmacist=$('#pharmacist').value.trim()}
function validateIdentity(){syncIdentity();clearValidation();const missing=[];if(!form.hospital)missing.push(['hospital','Indique el hospital o centro sanitario.']);if(!form.pharmacist)missing.push(['pharmacist','Indique el farmacéutico/a responsable.']);if(missing.length){showFieldError(missing[0][0],missing.map(m=>m[1]).join(' '));goToStage(1);return false}return true}
function setClinicalVariable(variableId,value,source='manual'){
  const v=variableById(variableId);if(!v)return{ok:false,message:'La propuesta no corresponde a ninguna variable clínica reconocida.'};
  const normalized=value==='set_age'||value==='set_bmi'?'set':value;
  if(!validateClinicalValue(v,normalized))return{ok:false,message:`El valor propuesto no es admisible para ${v.label}.`};
  form.values={...(form.values||{}),[variableId]:normalized};form.status='draft';form.completedAt=null;
  const control=document.querySelector(`[data-var="${CSS.escape(variableId)}"]`);if(!control)return{ok:false,message:`No se ha encontrado el control para ${v.label}.`};
  control.value=normalized;control.dispatchEvent(new Event('change',{bubbles:true}));update(source);return{ok:true};
}
function renderForm(){
  const p=$('#pathologies');p.innerHTML=PATHOLOGIES.map(([id,l])=>`<label><input type="checkbox" value="${id}"> ${l}</label>`).join('');
  p.onchange=()=>{form.pathologies=[...p.querySelectorAll(':checked')].map(i=>i.value);form.mainPathology=form.pathologies[0]||'';markDraft();update()};
  $('#variables').innerHTML='';
  for(const[dim,d]of Object.entries(DIMENSIONS)){
    const sec=el('section',{class:'panel'},`<h3>${d.label} <span id="sub-${dim}" class="chip"></span></h3><div class="variable-grid"></div>`),grid=sec.querySelector('.variable-grid');
    VARIABLES.filter(v=>v.dim===dim).forEach(v=>{const card=el('div',{class:'var-card'},`<h4>${v.label}</h4><p>${v.help||''}</p><div></div>`),c=card.querySelector('div');
      if(v.type==='age')c.innerHTML='<input id="age" type="number" min="0" placeholder="Edad"><label><input id="adultClinic" type="checkbox" checked> Atendido en consulta de adultos</label><select data-var="age"><option value="pending">Pendiente</option><option value="adult">Aplicar edad registrada</option><option value="pediatric">Edad pediátrica: derivar</option></select>';
      else if(v.type==='bmi')c.innerHTML='<input id="bmi" type="number" step="0.1" placeholder="IMC"><select data-var="bmi"><option value="pending">Pendiente</option><option value="set">Aplicar IMC registrado</option></select>';
      else if(v.type==='goals')c.innerHTML='<select data-var="pharmGoals"><option value="pending">Pendiente</option><option value="yes">Sí, alcanzados</option><option value="no">No alcanzados / inicio reciente</option></select>';
      else c.innerHTML=`<select data-var="${v.id}"><option value="pending">Pendiente</option><option value="yes">Sí</option><option value="no">No</option></select>`;grid.append(card)});$('#variables').append(sec)}
  document.querySelectorAll('select[data-var]').forEach(s=>s.onchange=()=>{form.values={...(form.values||{}),[s.dataset.var]:s.value};markDraft();update()});
  ['age','bmi','adultClinic'].forEach(id=>$('#'+id)&&($('#'+id).oninput=()=>{form[id]=$('#'+id).type==='checkbox'?$('#'+id).checked:$('#'+id).value;markDraft();update()}));
}
function markDraft(){if(form.status==='completed'||form.status==='provisional'){form.status='draft';form.outdated=true}}
function evaluatedResult(){let r=calculate(form);try{r=applyOverride(r,form.override)}catch{}return r}
function update(){
  syncIdentity();form.override={priority:$('#overridePriority').value,justification:$('#overrideJustification').value.trim(),motive:$('#overrideMotive').value.trim()};const r=evaluatedResult();
  $('#score').textContent=`${r.total}/59`;$('#priority').textContent=r.finalPriority;$('#provisional').textContent=form.outdated?'Pendiente de actualizar':(r.pending?'Provisional: datos pendientes':'Completo');$('#auto').textContent=r.pediatric||r.automaticCauses.join('; ')||'Sin prioridad automática';
  for(const[k,v]of Object.entries(r.subtotals))$('#sub-'+k)?.replaceChildren(document.createTextNode(`${v}/${DIMENSIONS[k].max}`));
  $('#detail').innerHTML=r.details.map(d=>`<tr><td>${escapeHtml(d.variable.label)}</td><td>${escapeHtml(d.response)}</td><td>${d.points}</td></tr>`).join('');
  const pending=r.details.filter(d=>d.pending);$('#reviewCompleted').textContent=VARIABLES.length-pending.length;$('#reviewPending').textContent=pending.length;$('#reviewPathology').textContent=PATHOLOGIES.find(p=>p[0]===form.mainPathology)?.[1]||'No indicada';
  window.currentResult=r;window.cmoWorkflow=buildWorkflowState(form,r);renderNeeds();renderActionsPanel();renderFinalPanel();
}
function renderNeeds(){const state=window.cmoWorkflow;$('#needs').innerHTML=state.detectedNeeds.map(n=>`<article class="panel need-card"><span class="need-tag">Necesidad CMO</span><h3>${escapeHtml(n.label)}</h3><p>Derivada de la prioridad <strong>${n.priority}</strong>.</p><small>${n.interventionIds.length} intervenciones relacionadas disponibles en la siguiente etapa.</small></article>`).join('')}
function renderActions(priority){return Object.values(actionsFor(priority)).map(g=>`<section class="action-group"><h3>${escapeHtml(g.label)}</h3><ul>${g.items.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul></section>`).join('')}
function renderActionsPanel(){const r=window.currentResult;$('#actions').innerHTML=renderActions(r.finalPriority)+`<p class="periodicity"><strong>Periodicidad:</strong> ${escapeHtml(PERIODICITY[r.finalPriority])}</p>`}

function goToStage(stage,scroll=true){currentStage=Number(stage);document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('active',Number(s.dataset.stage)===currentStage));document.querySelectorAll('[data-go]').forEach(b=>{const n=Number(b.dataset.go);b.classList.toggle('active',n===currentStage);b.closest('li').classList.toggle('complete',n<currentStage);b.setAttribute('aria-current',n===currentStage?'step':'false')});if(scroll)window.scrollTo({top:0,behavior:'smooth'});announce(`Paso ${currentStage} de 7`)}
function begin(mode){if(!validateIdentity())return;form.entryMode=mode;markDraft();if(mode==='manual')goToStage(2);else{$('#assistantPanel').hidden=false;$('#assistantPanel').scrollIntoView({behavior:'smooth'});$('#clinicalText').focus()}}
$('#startManual').onclick=()=>begin('manual');$('#startAssisted').onclick=()=>begin('assisted');
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goToStage(b.dataset.go));document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>goToStage(b.dataset.back));document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{if(Number(b.dataset.next)>1&&!validateIdentity())return;update();goToStage(b.dataset.next)});
['pseudo','hospital','pharmacist','overridePriority','overrideJustification','overrideMotive'].forEach(id=>$('#'+id).oninput=()=>{markDraft();update()});

$('#extract').onclick=()=>{
  const res=prestratify($('#clinicalText').value),mentioned=res.filter(x=>x.status!=='no_mencionado'),detected=mentioned.filter(x=>x.proposal!=='pending');$('#clinicalText').value='';
  $('#extractSummary').hidden=false;$('#extractSummary').innerHTML=`<strong>${mentioned.length} datos mencionados</strong><span>${VARIABLES.length-detected.length} variables permanecen sin completar hasta revisión profesional.</span>`;
  $('#extractResults').innerHTML=mentioned.map(x=>{const v=variableById(x.variableId),options=v?.type==='age'?'<option value="adult">Aplicar edad registrada</option><option value="pediatric">Edad pediátrica: derivar</option>':v?.type==='bmi'?'<option value="set">Aplicar IMC registrado</option>':'<option value="yes">Sí</option><option value="no">No</option>';const selected=x.proposal==='set_age'?'adult':x.proposal==='set_bmi'?'set':x.proposal;return `<article class="proposal"><span class="proposal-label">${escapeHtml(x.status.replace('_',' '))} · certeza ${escapeHtml(x.certainty)}</span><h4>${escapeHtml(v?.label||x.variableId)}</h4><blockquote>${escapeHtml(x.fragment)}</blockquote><p>${escapeHtml(x.rule)}</p><label>Valor a incorporar<select data-proposal-value>${options}</select></label><button type="button" data-accept="${escapeHtml(x.variableId)}">Confirmar dato</button><button type="button" data-reject class="secondary">Descartar</button><span class="proposal-state" aria-live="polite"></span></article>`}).join('')||'<p class="empty-state">No se han encontrado propuestas fiables. Puede continuar y completar la historia manualmente.</p>';
  document.querySelectorAll('.proposal').forEach((box,i)=>{const select=box.querySelector('[data-proposal-value]'),x=mentioned[i],selected=x.proposal==='set_age'?'adult':x.proposal==='set_bmi'?'set':x.proposal;if([...select.options].some(o=>o.value===selected))select.value=selected;box.querySelector('[data-accept]').onclick=()=>{const result=setClinicalVariable(x.variableId,select.value,'extractor');const msg=box.querySelector('.proposal-state');if(result.ok){box.classList.add('confirmed');msg.textContent='Confirmado por el profesional';box.querySelectorAll('button,select').forEach(c=>c.disabled=true)}else{box.classList.add('error');msg.textContent=result.message}};box.querySelector('[data-reject]').onclick=()=>{box.classList.add('rejected');box.querySelector('.proposal-state').textContent='Descartado';box.querySelectorAll('button,select').forEach(c=>c.disabled=true)}});$('#continueAssisted').hidden=false;
};
$('#continueAssisted').onclick=()=>goToStage(2);

$('#save').onclick=()=>{form=saveCase(form);renderSaved();announce('Caso guardado localmente')};$('#exportJson').onclick=()=>download('caso-respiratorio.json',exportCase(form));$('#exportCsv').onclick=()=>download('detalle-respiratorio.csv',toCSV(window.currentResult.details,form));$('#summary').onclick=()=>download('resumen-clinico.txt',report());$('#print').onclick=()=>print();$('#import').onchange=e=>e.target.files[0].text().then(t=>{try{form=importCase(t);render()}catch{announce('JSON inválido o incompatible')}});$('#clear').onclick=()=>confirm('¿Borrar todos los casos locales?')&&(clearCases(),renderSaved());
$('#finish').onclick=()=>finish(false);$('#finishProvisional').onclick=()=>finish(true);$('#backToForm').onclick=()=>{$('#pendingDialog').hidden=true;goToStage(2)};
function finish(allowProvisional){if(!validateIdentity())return;update();const pending=calculate(form).details.filter(d=>d.pending);if(pending.length&&!allowProvisional){$('#pendingList').innerHTML=pending.map(d=>`<li>${escapeHtml(d.variable.label)}</li>`).join('');$('#pendingCount').textContent=pending.length;$('#pendingDialog').hidden=false;$('#pendingDialog').focus();return}form=finalizeCase(form,allowProvisional?'provisional':'completed');update();saveCase(form);goToStage(5);announce('Resultado de estratificación generado')}
function renderFinalPanel(){const panel=$('#finalResult');if(!form.completedAt){panel.className='panel empty-state';panel.innerHTML='<h3>Informe pendiente</h3><p>Finalice la estratificación en el paso 4 para generar el informe definitivo o provisional.</p>';return}const rr=evaluatedResult(),pending=rr.details.filter(d=>d.pending);panel.className=`panel result ${rr.finalPriority.toLowerCase()}`;panel.innerHTML=`<h3>Resultado de estratificación <span class="priority-badge">${rr.finalPriority}</span></h3>${form.status==='provisional'?'<p class="warning"><strong>Resultado provisional: existen variables pendientes.</strong></p>':''}${form.outdated?'<p class="warning"><strong>Resultado pendiente de actualizar.</strong></p>':''}<dl><dt>Paciente</dt><dd>${escapeHtml(form.pseudoId||'seudónimo')}</dd><dt>Hospital o centro</dt><dd>${escapeHtml(form.hospital)}</dd><dt>Farmacéutico/a</dt><dd>${escapeHtml(form.pharmacist)}</dd><dt>Finalización</dt><dd>${new Date(form.completedAt).toLocaleString('es-ES')}</dd><dt>Puntuación total</dt><dd>${rr.total}/59</dd><dt>Prioridad calculada</dt><dd>${rr.calculatedPriority}</dd><dt>Prioridad final</dt><dd>${rr.finalPriority}</dd><dt>Estado</dt><dd>${form.status==='completed'?'Definitivo':'Provisional'}</dd><dt>Variables</dt><dd>${VARIABLES.length-pending.length} completadas, ${pending.length} pendientes</dd><dt>Periodicidad</dt><dd>${escapeHtml(PERIODICITY[rr.finalPriority])}</dd></dl>`}
function clearValidation(){['hospital','pharmacist'].forEach(id=>$('#'+id).removeAttribute('aria-invalid'));$('#validation').textContent=''}
function showFieldError(id,msg){$('#'+id).setAttribute('aria-invalid','true');$('#validation').textContent=msg;$('#'+id).focus()}
function announce(msg){$('#live').textContent=msg}
function renderSaved(){$('#saved').innerHTML=allCases().map(c=>`<li>${escapeHtml(c.pseudoId||c.id)} <button type="button" data-load="${escapeHtml(c.id)}">Cargar</button> <button type="button" data-del="${escapeHtml(c.id)}">Borrar</button></li>`).join('');document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{form=normalizeCase(allCases().find(c=>c.id===b.dataset.load));render()});document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>confirm('¿Borrar este caso?')&&(deleteCase(b.dataset.del),renderSaved()))}
function download(n,t){const a=el('a',{href:URL.createObjectURL(new Blob([t],{type:'text/plain'})),download:n});a.click()}
function report(){const r=window.currentResult;return `SIAF-CMO Respiratorio\nPaciente: ${form.pseudoId||'seudónimo'}\nHospital o centro sanitario: ${form.hospital||''}\nFarmacéutico responsable: ${form.pharmacist||''}\nFinalización: ${form.completedAt||'No finalizada'}\nPrioridad calculada: ${r.calculatedPriority}\nPrioridad final: ${r.finalPriority}\nPuntuación: ${r.total}/59\nEstado: ${form.status==='provisional'?'Resultado provisional: existen variables clínicas pendientes de valoración.':form.status||'draft'}\nPeriodicidad: ${PERIODICITY[r.finalPriority]}\n\nIntervenciones\n${Object.values(actionsFor(r.finalPriority)).map(g=>`${g.label}\n- ${g.items.join('\n- ')}`).join('\n')}`}
render();
