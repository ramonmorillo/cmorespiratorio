import {VARIABLES,DIMENSIONS,PATHOLOGIES,PERIODICITY,INTERVENTION_STATUSES,calculate,actionCatalog,exportCase,importCase,toCSV,normalizeCase,finalizeCase,validateClinicalValue,overrideIsValid,parseMeasure,AGE_RANGE,BMI_RANGE,VERSION,SOURCE_URL} from './clinical.js';
import {analyzeText} from './extractor.js';
import {allCases,saveCase,deleteCase,clearCases,saveDraft,loadDraft,clearDraft} from './storage.js';
import {buildWorkflowState} from './workflow.js';
import {buildReport,reportToText,PRIORITY_LABELS} from './report.js';
import {reportToPdf} from './pdf.js';

const freshCase=()=>normalizeCase({values:{},pathologies:[],adultClinic:true});
let form=freshCase();
let currentStage=1;
let dirty=false; // cambios no guardados en el almacenamiento local
const $=s=>document.querySelector(s);
const el=(t,a={},h='')=>{const e=document.createElement(t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));e.innerHTML=h;return e};
const variableById=id=>VARIABLES.find(v=>v.id===id);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function render(){renderForm();hydrateForm();update();renderSaved();goToStage(currentStage,false)}
function hydrateForm(){
  $('#pseudo').value=form.pseudoId||'';$('#hospital').value=form.hospital||'';$('#pharmacist').value=form.pharmacist||'';
  $('#overridePriority').value=form.override?.priority||'';$('#overrideMotive').value=form.override?.motive||'';$('#overrideJustification').value=form.override?.justification||'';
  document.querySelectorAll('#pathologies input').forEach(i=>i.checked=(form.pathologies||[]).includes(i.value));
  renderMainPathology();
  document.querySelectorAll('select[data-var]').forEach(s=>{s.value=form.values?.[s.dataset.var]||'pending'});
  $('#age').value=form.age??'';$('#bmi').value=form.bmi??'';$('#adultClinic').checked=form.adultClinic!==false;
  $('#nextReview').value=form.plan?.nextReview||'';$('#planNotes').value=form.plan?.notes||'';
}
function syncIdentity(){form.pseudoId=$('#pseudo').value.trim();form.hospital=$('#hospital').value.trim();delete form.center;form.pharmacist=$('#pharmacist').value.trim()}
function validateIdentity(){syncIdentity();clearValidation();const missing=[];if(!form.hospital)missing.push(['hospital','Indique el hospital o centro sanitario.']);if(!form.pharmacist)missing.push(['pharmacist','Indique el farmacéutico/a responsable.']);if(missing.length){goToStage(1);showFieldError(missing[0][0],missing.map(m=>m[1]).join(' '));return false}return true}

/** Cambios que afectan a la estratificación: si ya estaba finalizada, el resultado queda pendiente de revalidar. */
function markOutdated(){if(form.status==='completed'||form.status==='provisional'){form.status='draft';form.outdated=true}markDirty()}
function markDirty(){dirty=true}
function clearProvenance(id){if(form.provenance?.[id]){const p={...form.provenance};delete p[id];form.provenance=p}}

function setClinicalVariable(variableId,value,measure=null){
  const v=variableById(variableId);if(!v)return{ok:false,message:'La propuesta no corresponde a ninguna variable clínica reconocida.'};
  const normalized=value==='set_age'||value==='set_bmi'?(v.type==='age'?'adult':'set'):value;
  if(!validateClinicalValue(v,normalized))return{ok:false,message:`El valor propuesto no es admisible para ${v.label}.`};
  if(v.type==='age'&&measure!==null){if(parseMeasure(measure,AGE_RANGE)===null)return{ok:false,message:'Edad fuera de rango.'};form.age=measure;$('#age').value=measure}
  if(v.type==='bmi'){if(measure==null)measure=form.bmi;if(parseMeasure(measure,BMI_RANGE)===null)return{ok:false,message:'IMC no reconocido o fuera de rango (10–80).'};form.bmi=String(measure);$('#bmi').value=measure}
  form.values={...form.values,[variableId]:normalized};
  const control=document.querySelector(`[data-var="${CSS.escape(variableId)}"]`);if(control)control.value=normalized;
  markOutdated();update();return{ok:true};
}

function renderForm(){
  const p=$('#pathologies');
  p.innerHTML=PATHOLOGIES.map(([id,l])=>`<label><input type="checkbox" value="${id}"> ${escapeHtml(l)}</label>`).join('');
  p.onchange=()=>{form.pathologies=[...p.querySelectorAll(':checked')].map(i=>i.value);if(!form.pathologies.includes(form.mainPathology))form.mainPathology=form.pathologies[0]||'';renderMainPathology();markOutdated();update()};
  $('#mainPathology').onchange=e=>{form.mainPathology=e.target.value;markDirty();update()};
  $('#variables').innerHTML='';
  for(const[dim,d]of Object.entries(DIMENSIONS)){
    const sec=el('section',{class:'panel'},`<h3>${d.label} <span id="sub-${dim}" class="chip"></span></h3><div class="variable-grid"></div>`),grid=sec.querySelector('.variable-grid');
    VARIABLES.filter(v=>v.dim===dim).forEach(v=>{
      const card=el('div',{class:'var-card','data-card':v.id},`<h4 id="lbl-${v.id}">${escapeHtml(v.label)}</h4><p>${escapeHtml(v.help||'')}</p><div></div>`),c=card.querySelector('div');
      const sel=opts=>`<select data-var="${v.id}" aria-labelledby="lbl-${v.id}"><option value="pending">Pendiente</option>${opts}</select>`;
      if(v.type==='age')c.innerHTML=`<label>Edad (años)<input id="age" type="number" min="${AGE_RANGE.min}" max="${AGE_RANGE.max}" step="1" inputmode="numeric" placeholder="Edad"></label><label class="inline-check"><input id="adultClinic" type="checkbox" checked> Atendido en consulta de adultos</label>${sel('<option value="adult">Aplicar edad registrada</option><option value="pediatric">Edad pediátrica: derivar</option>')}`;
      else if(v.type==='bmi')c.innerHTML=`<label>IMC (kg/m²)<input id="bmi" type="number" min="${BMI_RANGE.min}" max="${BMI_RANGE.max}" step="0.1" inputmode="decimal" placeholder="IMC"></label>${sel('<option value="set">Aplicar IMC registrado</option>')}`;
      else if(v.type==='goals')c.innerHTML=sel('<option value="yes">Sí, alcanzados</option><option value="no">No alcanzados / inicio reciente</option>');
      else c.innerHTML=sel('<option value="yes">Sí</option><option value="no">No</option>');
      grid.append(card)});
    $('#variables').append(sec)}
  document.querySelectorAll('select[data-var]').forEach(s=>s.onchange=()=>{form.values={...form.values,[s.dataset.var]:s.value};clearProvenance(s.dataset.var);markOutdated();update()});
  // Al registrar edad o IMC válidos se aplica el dato automáticamente (se puede cambiar en el desplegable).
  const measure=(id,varId,range,applyValue)=>{$('#'+id).oninput=()=>{form[id]=$('#'+id).value;clearProvenance(varId);const s=document.querySelector(`[data-var="${varId}"]`);if(parseMeasure(form[id],range)!==null&&(form.values[varId]||'pending')==='pending'){form.values={...form.values,[varId]:applyValue};s.value=applyValue}markOutdated();update()}};
  measure('age','age',AGE_RANGE,'adult');measure('bmi','bmi',BMI_RANGE,'set');
  $('#adultClinic').onchange=()=>{form.adultClinic=$('#adultClinic').checked;markOutdated();update()};
}
function renderMainPathology(){const s=$('#mainPathology');const chosen=form.pathologies||[];s.innerHTML=chosen.length?chosen.map(id=>`<option value="${id}">${escapeHtml(PATHOLOGIES.find(p=>p[0]===id)?.[1]||id)}</option>`).join(''):'<option value="">Seleccione primero las patologías</option>';s.disabled=!chosen.length;s.value=form.mainPathology||''}

function update(){
  syncIdentity();
  form.override={priority:$('#overridePriority').value,justification:$('#overrideJustification').value.trim(),motive:$('#overrideMotive').value.trim()};
  form.plan={nextReview:$('#nextReview').value,notes:$('#planNotes').value.trim()};
  const r=calculate(form);
  $('#score').textContent=`${r.total}/59`;
  $('#priority').textContent=r.applicable?r.finalPriority:'No aplicable';
  $('#provisional').textContent=form.outdated?'Pendiente de revalidar':(r.pending?`Provisional: ${r.pendingCount} pendiente(s)`:'Datos completos');
  $('#auto').textContent=r.pediatric||r.automaticCauses.join('; ')||'Sin prioridad automática';
  const applic=$('#applicability');applic.hidden=r.applicable;applic.textContent=r.applicable?'':'Paciente en edad pediátrica: el modelo CMO respiratorio de adultos no es aplicable. Derive al modelo pediátrico SEFH; no se generará estratificación ni informe.';
  const impact=$('#pendingImpact');impact.hidden=!r.pending||!r.applicable;impact.textContent=r.priorityMayChange?`Hay ${r.pendingCount} variable(s) pendiente(s). Si resultaran positivas, la puntuación podría alcanzar ${r.maxPossibleTotal}/59 y la prioridad podría llegar a ${r.maxPossiblePriority}. Complete los datos antes de finalizar si es posible.`:`Hay ${r.pendingCount} variable(s) pendiente(s); con los datos actuales no modificarían la prioridad (${r.finalPriority}).`;
  const rw=$('#reviewWarnings');rw.hidden=!r.reviews.length;rw.innerHTML=r.reviews.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
  const ov=form.override;$('#overrideError').textContent=ov.priority&&!overrideIsValid(ov)?'La modificación no se aplicará hasta documentar una justificación de al menos 12 caracteres.':(r.overrideLowersAutomatic?'Está disminuyendo una Prioridad 1 automática: documente una justificación reforzada.':'');
  for(const[k,v]of Object.entries(r.subtotals))$('#sub-'+k)?.replaceChildren(document.createTextNode(`${v}/${DIMENSIONS[k].max}`));
  $('#detail').innerHTML=r.details.map(d=>`<tr${d.pending?' class="pending-row"':''}><td>${escapeHtml(d.variable.label)}</td><td>${escapeHtml(d.response)}</td><td>${d.points}</td></tr>`).join('');
  document.querySelectorAll('[data-card]').forEach(c=>c.classList.toggle('is-pending',Boolean(r.details.find(d=>d.variable.id===c.dataset.card)?.pending)));
  $('#reviewCompleted').textContent=VARIABLES.length-r.pendingCount;$('#reviewPending').textContent=r.pendingCount;
  $('#reviewPathology').textContent=PATHOLOGIES.find(p=>p[0]===form.mainPathology)?.[1]||'No indicada';
  window.currentResult=r;window.cmoWorkflow=buildWorkflowState(form,r);
  renderNeeds(r);renderActionsPanel(r);renderReport(r);
  if(dirty)saveDraft(form,currentStage);
}

function renderNeeds(r){
  if(!r.applicable){$('#needs').innerHTML='<p class="panel empty-state">Modelo no aplicable (edad pediátrica).</p>';return}
  const groups=Object.entries(DIMENSIONS).map(([dim,d])=>({dim,label:d.label,items:r.details.filter(x=>x.variable.dim===dim&&(x.points>0||x.auto))})).filter(g=>g.items.length);
  const pending=r.details.filter(d=>d.pending);
  $('#needs').innerHTML=(groups.length?groups.map(g=>`<article class="panel need-card${g.dim==='treatment'?' need-pharm':''}"><span class="need-tag">${g.dim==='treatment'?'Necesidades farmacoterapéuticas':'Factores de complejidad'}</span><h3>${escapeHtml(g.label)} <span class="chip">${r.subtotals[g.dim]}/${DIMENSIONS[g.dim].max}</span></h3><ul>${g.items.map(x=>`<li>${escapeHtml(x.variable.label)}: <strong>${escapeHtml(x.response)}</strong>${x.points?` (${x.points} p)`:''}</li>`).join('')}</ul></article>`).join(''):'<p class="panel empty-state">Ninguna variable ha puntuado con los datos actuales.</p>')
    +(pending.length?`<article class="panel"><h3>Variables pendientes (${pending.length})</h3><p class="help">No suman puntos hasta que se valoren.</p><ul>${pending.map(d=>`<li>${escapeHtml(d.variable.label)}</li>`).join('')}</ul></article>`:'');
}

function renderActionsPanel(r){
  const catalog=actionCatalog(r.finalPriority);
  const statusOptions=id=>Object.entries(INTERVENTION_STATUSES).map(([k,l])=>`<option value="${k}"${(form.interventions?.[id]||'recommended')===k?' selected':''}>${l}</option>`).join('');
  const groups=[...new Set(catalog.map(a=>a.group))];
  const counts=Object.fromEntries(Object.keys(INTERVENTION_STATUSES).map(k=>[k,catalog.filter(a=>(form.interventions?.[a.id]||'recommended')===k).length]));
  $('#actions').innerHTML=`<p class="help"><strong>${PRIORITY_LABELS[r.finalPriority]}</strong>: ${catalog.length} actuaciones · ${counts.done} realizadas · ${counts.planned} planificadas · ${counts.not_applicable} no proceden.</p>`
    +groups.map(g=>{const items=catalog.filter(a=>a.group===g);return `<section class="action-group"><h3>${escapeHtml(items[0].groupLabel)}</h3><ul class="intervention-list">${items.map(a=>`<li class="intervention status-${form.interventions?.[a.id]||'recommended'}"><span>${escapeHtml(a.label)} <small class="level">${a.level}</small></span><select data-intervention="${a.id}" aria-label="Estado: ${escapeHtml(a.label)}">${statusOptions(a.id)}</select></li>`).join('')}</ul></section>`}).join('');
  document.querySelectorAll('[data-intervention]').forEach(s=>s.onchange=()=>{form.interventions={...form.interventions,[s.dataset.intervention]:s.value};if(s.value==='recommended')delete form.interventions[s.dataset.intervention];markDirty();update()});
  $('#periodicityText').innerHTML=`<strong>Periodicidad (${r.finalPriority}):</strong> ${escapeHtml(PERIODICITY[r.finalPriority])}`;
}

function renderReport(r){
  const report=buildReport(form,r);
  const panel=$('#finalResult');
  ['copyHce','downloadPdf','print','summary'].forEach(id=>$('#'+id).disabled=!report.exportable);
  $('#reportBlocked').hidden=report.exportable;$('#reportBlocked').textContent=report.blockedReason;
  if(!report.exportable){panel.className='panel empty-state';panel.innerHTML=`<h3>Informe no disponible</h3><p>${escapeHtml(report.blockedReason)}</p>${r.applicable?'<button type="button" class="primary" data-goto="4">Ir a estratificación</button>':''}`;$('#hceText').value='';panel.querySelector('[data-goto]')?.addEventListener('click',()=>goToStage(4));return}
  const s=report.stratification,c=report.clinical,i=report.interventions;
  const li=items=>items.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
  const ilist=items=>`<ul>${items.map(x=>`<li><span class="muted">${escapeHtml(x.group)}:</span> ${escapeHtml(x.label)}</li>`).join('')}</ul>`;
  panel.className=`panel result ${s.finalPriorityCode.toLowerCase()} report-preview`;
  panel.innerHTML=`<h3>${escapeHtml(report.title)}</h3>
  <div class="result-banner"><strong>${escapeHtml(s.finalPriority)}${report.statusLabel==='Provisional'?' (provisional)':''}</strong><span>Puntuación ${s.total}/${s.max} · calculada: ${escapeHtml(s.calculatedPriority)}${s.override?` · modificada a ${escapeHtml(s.override.priority)}`:''}</span></div>
  <dl><dt>Fecha de evaluación</dt><dd>${escapeHtml(report.evaluationDate)}</dd><dt>Paciente</dt><dd>${escapeHtml(report.patientId||'No registrado')}</dd><dt>Farmacéutico/a</dt><dd>${escapeHtml(report.pharmacist)}</dd><dt>Centro</dt><dd>${escapeHtml(report.hospital)}</dd><dt>Patología principal</dt><dd>${escapeHtml(c.mainPathology||'No registrada')}</dd>${c.otherPathologies.length?`<dt>Otras patologías</dt><dd>${escapeHtml(c.otherPathologies.join('; '))}</dd>`:''}${c.age?`<dt>Edad</dt><dd>${escapeHtml(c.age)}</dd>`:''}${c.bmi?`<dt>IMC</dt><dd>${escapeHtml(c.bmi)}</dd>`:''}<dt>Dimensiones</dt><dd>${escapeHtml(s.subtotals.map(x=>`${x.short} ${x.points}/${x.max}`).join(' · '))}</dd>${s.automaticCauses.length?`<dt>Prioridad automática</dt><dd>${escapeHtml(s.automaticCauses.join('; '))}</dd>`:''}${s.override?`<dt>Modificación profesional</dt><dd>${escapeHtml(s.override.priority)}${s.override.motive?` · ${escapeHtml(s.override.motive)}`:''}. ${escapeHtml(s.override.justification)}</dd>`:''}</dl>
  ${report.contextFactors.length?`<h4>Variables determinantes</h4><ul>${li(report.contextFactors.map(f=>`${f.label}${f.points?` (${f.points} p)`:''} — ${f.dimensionLabel}`))}</ul>`:''}
  ${report.pharmacotherapeuticNeeds.length?`<h4>Necesidades farmacoterapéuticas</h4><ul>${li(report.pharmacotherapeuticNeeds.map(f=>`${f.label}: ${f.response} (${f.points} p)`))}</ul>`:''}
  <h4>Intervenciones farmacéuticas</h4>${i.done.length?`<p><strong>Realizadas</strong></p>${ilist(i.done)}`:''}${i.planned.length?`<p><strong>Planificadas / pendientes</strong></p>${ilist(i.planned)}`:''}${i.recommended.length?`<p><strong>Recomendadas por el modelo (no registradas como realizadas)</strong></p>${ilist(i.recommended)}`:''}
  <h4>Plan de atención y seguimiento</h4><ul>${li([report.plan.periodicity,report.plan.nextReview&&`Próxima valoración prevista: ${report.plan.nextReview}`,report.plan.notes&&`Observaciones: ${report.plan.notes}`].filter(Boolean))}</ul>
  ${report.warnings.length?`<div class="warning"><strong>Advertencias</strong><ul>${li(report.warnings)}</ul></div>`:''}
  <p class="help">${escapeHtml(report.tool)} · ${escapeHtml(report.disclaimer)}</p><p class="help">Basado en la metodología CMO MAPEX-SEFH · <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">documento fuente SEFH (PDF)</a></p>`;
  $('#hceText').value=reportToText(report);
}

function goToStage(stage,scroll=true){currentStage=Number(stage);document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('active',Number(s.dataset.stage)===currentStage));document.querySelectorAll('[data-go]').forEach(b=>{const n=Number(b.dataset.go);b.classList.toggle('active',n===currentStage);b.closest('li').classList.toggle('complete',n<currentStage);if(n===currentStage)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});if(scroll)window.scrollTo({top:0,behavior:'smooth'});announce(`Paso ${currentStage} de 7`);if(dirty)saveDraft(form,currentStage)}
function begin(mode){if(!validateIdentity())return;form.entryMode=mode;if(mode==='manual')goToStage(2);else{$('#assistantPanel').hidden=false;$('#assistantPanel').scrollIntoView({behavior:'smooth'});$('#clinicalText').focus()}}
$('#startManual').onclick=()=>begin('manual');
$('#startAssisted').onclick=()=>begin('assisted');
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goToStage(b.dataset.go));
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>goToStage(b.dataset.back));
document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{if(Number(b.dataset.next)>1&&!validateIdentity())return;update();goToStage(b.dataset.next)});
['pseudo','hospital','pharmacist','nextReview','planNotes'].forEach(id=>$('#'+id).oninput=()=>{markDirty();update()});
['overridePriority','overrideJustification','overrideMotive'].forEach(id=>$('#'+id).oninput=()=>{markOutdated();update()});

// ---- Análisis asistido: tabla de revisión profesional de las 22 variables ----
const STATUS_INFO={detectado:['Propuesta: criterio presente','st-yes'],ausencia_explicita:['Propuesta: criterio ausente','st-no'],dudoso:['Requiere revisión','st-review'],contradictorio:['Contradictorio: revisar','st-conflict'],no_atribuible:['No atribuible al paciente (familiar)','st-review'],no_mencionado:['Sin información en el texto','st-none']};
const FIRM_STATUS=new Set(['detectado','ausencia_explicita']);
let review=null; // {items, pathologies, decisions:{variableId:'confirmed'|'edited'|'rejected'}} — solo en memoria; el texto no se guarda
const optionsFor=v=>v.type==='age'?[['adult','Aplicar edad registrada'],['pediatric','Edad pediátrica: derivar']]:v.type==='bmi'?[['set','Aplicar IMC registrado']]:v.type==='goals'?[['yes','Sí, alcanzados'],['no','No alcanzados / inicio reciente']]:[['yes','Sí'],['no','No']];
const proposalValue=x=>x.proposal==='set_age'?'adult':x.proposal==='set_bmi'?'set':x.proposal==='pending'?'':x.proposal;
const optionLabel=(v,val)=>optionsFor(v).find(o=>o[0]===val)?.[1]||'—';
function formValueLabel(v){const val=form.values?.[v.id];if(!val||val==='pending')return '';if(v.type==='age')return form.age?`${form.age} años`:optionLabel(v,val);if(v.type==='bmi')return form.bmi?`IMC ${String(form.bmi).replace('.',',')}`:optionLabel(v,val);return optionLabel(v,val)}
function findingText(x){return x.finding||(x.value!==null&&x.value!==undefined?String(x.value).replace('.',','):'')}

$('#extract').onclick=()=>{
  const text=$('#clinicalText').value;
  if(!text.trim()){toast('Pegue un texto clínico seudonimizado antes de analizar.',true);$('#clinicalText').focus();return}
  const analysis=analyzeText(text,{pathologies:form.pathologies});
  $('#clinicalText').value=''; // el texto no se conserva
  review={items:analysis.items,pathologies:analysis.pathologies,decisions:{}};
  renderReview();
  $('#continueAssisted').hidden=false;
};
function reviewCounts(){const items=review.items,d=review.decisions;return{confirmed:items.filter(x=>d[x.variableId]==='confirmed'||d[x.variableId]==='edited').length,rejected:items.filter(x=>d[x.variableId]==='rejected').length,pending:items.filter(x=>!d[x.variableId]&&x.status!=='no_mencionado').length,none:items.filter(x=>!d[x.variableId]&&x.status==='no_mencionado').length,firm:items.filter(x=>FIRM_STATUS.has(x.status)).length,toReview:items.filter(x=>['dudoso','contradictorio','no_atribuible'].includes(x.status)).length,identified:items.filter(x=>x.status!=='no_mencionado').length}}
function bulkEligible(){return review.items.filter(x=>{const v=variableById(x.variableId),sel=document.querySelector(`[data-review-value="${x.variableId}"]`),current=form.values?.[x.variableId];return FIRM_STATUS.has(x.status)&&!review.decisions[x.variableId]&&sel&&sel.value===proposalValue(x)&&(!current||current==='pending'||current===proposalValue(x))&&!(v.type==='bmi'&&x.value==null)})}
function renderReview(){
  const c=reviewCounts();
  $('#extractSummary').hidden=false;
  $('#extractSummary').innerHTML=`<div><strong>Información identificada en ${c.identified} de ${VARIABLES.length} variables</strong>: ${c.firm} propuestas explícitas y ${c.toReview} que requieren revisión (dudosas, contradictorias o no atribuibles). ${VARIABLES.length-c.identified} sin información en el texto: permanecen pendientes.<br><small>Estas cifras describen lo encontrado en el texto, no la exactitud clínica de la extracción. El texto pegado se ha borrado.</small></div><div class="review-counters" aria-live="polite"><span>Confirmadas <b>${c.confirmed}</b></span><span>Pendientes de revisión <b>${c.pending}</b></span><span>Descartadas <b>${c.rejected}</b></span><span>Sin información <b>${c.none}</b></span></div>`;
  const newPath=review.pathologies.filter(p=>!(form.pathologies||[]).includes(p));
  const pathHtml=review.pathologies.length?`<p class="help">Patologías respiratorias mencionadas: <strong>${escapeHtml(review.pathologies.map(p=>PATHOLOGIES.find(x=>x[0]===p)?.[1]).join('; '))}</strong>.${newPath.length?` <button type="button" class="secondary" id="addPathologies">Añadir a las patologías del paciente</button>`:' Ya registradas.'}</p>`:'';
  $('#extractResults').innerHTML=pathHtml+Object.entries(DIMENSIONS).map(([dim,d])=>`<div class="table-wrap review-wrap"><table class="review-table"><caption>${escapeHtml(d.label)}</caption><thead><tr><th scope="col">Variable CMO</th><th scope="col">Dato identificado</th><th scope="col">Propuesta</th><th scope="col">Evidencia textual</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody>${review.items.filter(x=>variableById(x.variableId).dim===dim).map(reviewRow).join('')}</tbody></table></div>`).join('')
    +`<div class="bulk-confirm"><label class="inline-check"><input type="checkbox" id="bulkReviewed"> He revisado la evidencia de las propuestas explícitas</label><button type="button" id="bulkConfirm" class="primary" disabled>Confirmar propuestas explícitas revisadas</button><p class="help">Solo incorpora propuestas explícitas sin modificar y sin conflicto con datos ya registrados. Las dudosas, contradictorias o sin información nunca se incorporan automáticamente.</p></div>`;
  wireReview();
}
function reviewRow(x){
  const v=variableById(x.variableId),[label0,cls]=STATUS_INFO[x.status],label=(v.type==='age'||v.type==='bmi')&&x.status==='detectado'?'Propuesta: dato identificado':label0,decision=review.decisions[x.variableId],firm=FIRM_STATUS.has(x.status),pre=firm?proposalValue(x):'';
  const current=formValueLabel(v),ev=x.evidence||[];
  const evidence=ev.length?`<blockquote>${escapeHtml(ev[0].fragment||'—')}</blockquote>${ev.length>1?`<details><summary>${ev.length} evidencias</summary><ul>${ev.map(e=>`<li>${escapeHtml(e.fragment||'—')} <small>(${escapeHtml(e.rule)})</small></li>`).join('')}</ul></details>`:''}`:'<span class="muted">—</span>';
  const decided=decision?`<span class="decision decision-${decision}">${decision==='rejected'?'Descartada':decision==='edited'?'Confirmada (modificada)':'Confirmada'}</span>${decision==='rejected'?` <button type="button" class="secondary" data-review-undo="${x.variableId}">Revisar de nuevo</button>`:''}`:`<button type="button" data-review-accept="${x.variableId}" aria-label="Confirmar ${escapeHtml(v.label)}">${current&&pre&&formValueLabel(v)!==''&&form.values[x.variableId]!==pre?'Sustituir':'Confirmar'}</button><button type="button" class="secondary" data-review-reject="${x.variableId}" aria-label="Descartar ${escapeHtml(v.label)}">Descartar</button>`;
  return `<tr class="review-row ${cls}${decision?' is-decided':''}" data-row="${x.variableId}"><th scope="row" data-label="Variable CMO">${escapeHtml(v.label)}${current?`<small class="current-value">En formulario: ${escapeHtml(current)}</small>`:''}</th><td data-label="Dato identificado">${escapeHtml(findingText(x))||'<span class="muted">—</span>'}</td><td data-label="Propuesta"><select data-review-value="${x.variableId}" aria-label="Propuesta para ${escapeHtml(v.label)}"${decision?' disabled':''}><option value="">— Sin valor —</option>${optionsFor(v).map(([k,l])=>`<option value="${k}"${k===pre?' selected':''}>${escapeHtml(l)}</option>`).join('')}</select></td><td data-label="Evidencia textual" class="evidence">${evidence}</td><td data-label="Estado"><span class="status-badge ${cls}">${label}</span><small class="rule">${escapeHtml(x.rule)}</small></td><td data-label="Acción" class="review-actions">${decided}<span class="row-msg" aria-live="polite"></span></td></tr>`;
}
function wireReview(){
  document.querySelectorAll('[data-review-accept]').forEach(b=>b.onclick=()=>acceptReview(b.dataset.reviewAccept,false));
  document.querySelectorAll('[data-review-reject]').forEach(b=>b.onclick=()=>{review.decisions[b.dataset.reviewReject]='rejected';renderReview();focusRow(b.dataset.reviewReject)});
  document.querySelectorAll('[data-review-undo]').forEach(b=>b.onclick=()=>{delete review.decisions[b.dataset.reviewUndo];renderReview();focusRow(b.dataset.reviewUndo)});
  const box=$('#bulkReviewed'),btn=$('#bulkConfirm'),refresh=()=>{const n=bulkEligible().length;btn.disabled=!box.checked||!n;btn.textContent=`Confirmar ${n} propuesta${n===1?'':'s'} explícita${n===1?'':'s'} revisada${n===1?'':'s'}`};
  box.onchange=refresh;document.querySelectorAll('[data-review-value]').forEach(s=>s.onchange=refresh);refresh();
  btn.onclick=()=>{const list=bulkEligible();if(!box.checked||!list.length)return;let n=0;list.forEach(x=>{if(acceptReview(x.variableId,true))n++});renderReview();toast(`${n} propuesta(s) explícita(s) incorporadas. Revise las pendientes.`)};
  $('#addPathologies')?.addEventListener('click',()=>{form.pathologies=[...new Set([...(form.pathologies||[]),...review.pathologies])];if(!form.mainPathology)form.mainPathology=form.pathologies[0];document.querySelectorAll('#pathologies input').forEach(i=>i.checked=form.pathologies.includes(i.value));renderMainPathology();markOutdated();update();renderReview();toast('Patologías añadidas. Revise la patología principal en Historia clínica.')});
}
function focusRow(id){document.querySelector(`[data-row="${id}"] select, [data-row="${id}"] button`)?.focus()}
/** Incorpora al formulario la decisión profesional de una fila. Nunca sobrescribe sin confirmación explícita. */
function acceptReview(id,bulk){
  const x=review.items.find(i=>i.variableId===id),v=variableById(id),sel=document.querySelector(`[data-review-value="${id}"]`),row=document.querySelector(`[data-row="${id}"] .row-msg`);
  const value=sel?.value;
  if(!value){if(row)row.textContent='Seleccione un valor o descarte la fila.';sel?.focus();return false}
  const current=form.values?.[id];
  if(current&&current!=='pending'&&current!==value&&(bulk||!confirm(`${v.label}: el formulario ya tiene «${formValueLabel(v)}». ¿Sustituirlo por «${optionLabel(v,value)}»?`)))return false;
  const measure=(v.type==='age'&&value==='adult')||(v.type==='bmi')?x.value:null;
  if(v.type==='age'&&value==='adult'&&measure==null&&!form.age){if(row)row.textContent='No hay edad numérica: regístrela en Historia clínica.';return false}
  const result=setClinicalVariable(id,value,measure);
  if(!result.ok){if(row)row.textContent=result.message;return false}
  const decision=value===proposalValue(x)&&FIRM_STATUS.has(x.status)?'confirmed':'edited';
  review.decisions[id]=decision;
  form.provenance={...form.provenance,[id]:{source:'extractor',decision,rule:x.rule,at:new Date().toISOString()}};
  if(!bulk){renderReview();focusRow(id)}
  return true;
}
$('#continueAssisted').onclick=()=>goToStage(2);

function persist(message){form=saveCase(form);dirty=false;clearDraft();renderSaved();toast(message)}
$('#save').onclick=()=>{if(!validateIdentity())return;persist('Caso guardado en este navegador.')};
$('#exportJson').onclick=()=>download(`caso-cmo-respiratorio-${today()}.json`,exportCase(form),'application/json');
$('#exportCsv').onclick=()=>download(`detalle-cmo-respiratorio-${today()}.csv`,'﻿'+toCSV(window.currentResult.details,form),'text/csv;charset=utf-8');
$('#summary').onclick=()=>download(`informe-cmo-respiratorio-${today()}.txt`,$('#hceText').value,'text/plain;charset=utf-8');
$('#downloadPdf').onclick=()=>{const report=buildReport(form,window.currentResult);if(!report.exportable)return toast(report.blockedReason,true);download(`informe-cmo-respiratorio-${today()}.pdf`,reportToPdf(report),'application/pdf');toast('PDF generado. Revise la carpeta de descargas.')};
$('#print').onclick=()=>print();
$('#copyHce').onclick=async()=>{const text=$('#hceText').value;if(!text)return;const how=await copyText(text);const status=$('#copyStatus');
  status.textContent=how==='manual'?'No se ha podido copiar automáticamente: el texto está seleccionado; pulse Ctrl+C (Cmd+C en Mac).':'Informe copiado al portapapeles. Péguelo en la historia clínica y revíselo antes de guardar.';status.className=`copy-status ${how==='manual'?'is-warning':'is-ok'}`;toast(status.textContent,how==='manual')};
$('#import').onchange=e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(dirty&&!confirm('La evaluación en curso tiene cambios sin guardar. ¿Reemplazarla por el caso importado?'))return;
  file.text().then(t=>{form=importCase(t);dirty=true;currentStage=7;render();toast('Caso importado. Las variables no reconocidas quedan como pendientes.')}).catch(()=>toast('JSON inválido o incompatible: no se ha importado nada.',true))};
$('#clear').onclick=()=>{if(confirm('¿Borrar todos los casos guardados en este navegador? La evaluación en pantalla no se modifica.')){clearCases();if(form.id){delete form.id;dirty=true}renderSaved();toast('Casos locales borrados.')}};
$('#newCase').onclick=()=>{if(dirty&&!confirm('Hay cambios sin guardar en la evaluación actual. ¿Iniciar una nueva evaluación y descartarlos?'))return;form=freshCase();dirty=false;clearDraft();resetAssistant();currentStage=1;render();toast('Nueva evaluación iniciada.');$('#hospital').focus()};
$('#finish').onclick=()=>finish(false);
$('#finishProvisional').onclick=()=>finish(true);
$('#backToForm').onclick=()=>{$('#pendingDialog').hidden=true;goToStage(2)};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

function finish(allowProvisional){
  if(!validateIdentity())return;update();
  const r=calculate(form);
  if(!r.applicable){toast('Modelo no aplicable en edad pediátrica: derive al modelo pediátrico SEFH.',true);return}
  if(form.override?.priority&&!overrideIsValid(form.override)){$('#overrideJustification').focus();toast('Documente la justificación de la modificación manual (mínimo 12 caracteres) o retire la modificación.',true);return}
  const pending=r.details.filter(d=>d.pending);
  if(pending.length&&!allowProvisional){$('#pendingList').innerHTML=pending.map(d=>`<li>${escapeHtml(d.variable.label)}</li>`).join('');$('#pendingCount').textContent=pending.length;$('#pendingDialog').hidden=false;$('#pendingDialog').focus();return}
  $('#pendingDialog').hidden=true;
  form=finalizeCase(form,pending.length?'provisional':'completed');
  persist('Estratificación finalizada y guardada en este navegador.');update();goToStage(5);
}
function resetAssistant(){review=null;$('#assistantPanel').hidden=true;$('#extractSummary').hidden=true;$('#extractResults').innerHTML='';$('#continueAssisted').hidden=true;$('#clinicalText').value='';$('#copyStatus').textContent='';$('#pendingDialog').hidden=true}
function clearValidation(){['hospital','pharmacist'].forEach(id=>$('#'+id).removeAttribute('aria-invalid'));$('#validation').textContent=''}
function showFieldError(id,msg){$('#'+id).setAttribute('aria-invalid','true');$('#validation').textContent=msg;$('#'+id).focus()}
function announce(msg){$('#live').textContent=msg}
let toastTimer;
function toast(msg,warn=false){const t=$('#toast');t.textContent=msg;t.className=`toast${warn?' is-warning':''}`;t.hidden=false;announce(msg);clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},5000)}
function renderSaved(){const cases=allCases();$('#saved').innerHTML=cases.length?cases.map(c=>`<li><span>${escapeHtml(c.pseudoId||'Sin identificador')} · ${escapeHtml(c.status==='completed'?'definitivo':c.status==='provisional'?'provisional':'borrador')} · ${escapeHtml(new Date(c.updatedAt||Date.now()).toLocaleString('es-ES'))}</span> <button type="button" class="secondary" data-load="${escapeHtml(c.id)}">Abrir</button> <button type="button" class="secondary" data-del="${escapeHtml(c.id)}">Borrar</button></li>`).join(''):'<li class="help">No hay casos guardados en este navegador.</li>';
  document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{if(dirty&&!confirm('Hay cambios sin guardar. ¿Abrir otro caso y descartarlos?'))return;const found=allCases().find(c=>c.id===b.dataset.load);if(!found)return;form=normalizeCase(found);dirty=false;resetAssistant();currentStage=form.completedAt?7:2;render();toast('Caso abierto.')});
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('¿Borrar este caso del navegador?'))return;deleteCase(b.dataset.del);if(form.id===b.dataset.del){delete form.id;dirty=true}renderSaved()})}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a',{href:url,download:name});a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
/** Copia con la API del portapapeles; si no está disponible (contexto no seguro, permisos), usa execCommand o deja el texto seleccionado. */
async function copyText(text){
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return 'api'}}catch{/* se intenta el método alternativo */}
  const ta=$('#hceText');ta.closest('details')?.setAttribute('open','');ta.focus();ta.select();ta.setSelectionRange(0,text.length);
  try{if(document.execCommand('copy'))return 'exec'}catch{/* sin soporte */}
  return 'manual';
}

$('#appVersion').textContent=VERSION;
const draft=loadDraft();
if(draft){form=draft.form;currentStage=draft.stage;dirty=true}
render();
if(draft)toast('Se ha recuperado la evaluación en curso de esta pestaña (no guardada).');
