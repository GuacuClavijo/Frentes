/* V46 — replacement app.js
   7 faixas:
   Contenção LE / TFA LE / Terraplenagem LE / Eixo-OAE /
   Terraplenagem LD / TFA LD / Contenção LD
*/
(function(){
'use strict';
const A=window.APP_DATA||{}, DATA=Array.isArray(A.data)?A.data:[];
const ALL=Array.isArray(A.releases)?A.releases:[];
const typed=ALL.some(r=>String(r.tipo??r.TIPO??'').trim());
const TFA_REL=Array.isArray(A.tfa_terr_releases)&&A.tfa_terr_releases.length?A.tfa_terr_releases:(typed?ALL.filter(r=>/TFA|TERRAP/i.test(String(r.tipo??r.TIPO??''))):ALL);
const CONT_REL=Array.isArray(A.contencao_releases)&&A.contencao_releases.length?A.contencao_releases:(typed?ALL.filter(r=>/CONTEN/i.test(String(r.tipo??r.TIPO??''))):ALL);
/* If the OS table is not yet exported by the data file, preserve the current
   corridor-wide OS behavior instead of making OAE falsely unavailable. */
const OS_REL=Array.isArray(A.os_releases)&&A.os_releases.length?A.os_releases:[{ki:60,kf:105,status:'Liberada',nome:'OS — Ordem de Serviço'}];

const MIN=60,MAX=105;
const COLORS={OAE:'#2563eb','CONTENÇÃO':'#7c3aed',TFA:'#06b6d4'};
const STATIONS=[{name:'JUNDIAÍ',km:60.5},{name:'LOUVEIRA',km:76},{name:'VINHEDO',km:83.5},{name:'VALINHOS',km:91.3},{name:'CAMPINAS',km:104.6}];
const SEGMENTS=[{key:'3A',lo:60,hi:76},{key:'3B',lo:76,hi:83.5},{key:'3C',lo:83.5,hi:91.3},{key:'3D',lo:91.3,hi:105}];
let lo=MIN,hi=MAX,filtered=DATA.slice(),statusFilter='';
const $=id=>document.getElementById(id);
const text=(r,k)=>String(r?.[k]??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function km(v){const n=Number(v);if(!Number.isFinite(n))return '-';const m=Math.round(n*1000);return Math.floor(m/1000)+'+'+String(m%1000).padStart(3,'0')}
function rowKey(r){return String(r._row||r['IDENTIFICAÇÃO']||'x').replace(/[^a-z0-9_-]/gi,'_')}
function storeGet(k){try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}}
function storeSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
function interval(r){return [Number(r.ki??r._ki??r['KM INICIAL']),Number(r.kf??r._kf??r['KM FINAL'])]}
function sideOf(r){return text(r,'lado')||text(r,'LADO')}
function norm(rows){return (rows||[]).map(r=>{const [a,b]=interval(r);return {a,b,status:String(r.status??r.STATUS??'Liberada').toLowerCase(),raw:r}}).filter(x=>Number.isFinite(x.a)&&Number.isFinite(x.b)&&x.b>x.a)}
function coverage(a,b,rows){
  const seg=norm(rows).filter(x=>x.b>a&&x.a<b&&!/não|nao|unreleased/.test(x.status));
  const parts=seg.map(x=>[Math.max(a,x.a),Math.min(b,x.b)]).filter(x=>x[1]>x[0]).sort((x,y)=>x[0]-y[0]);
  let cur=a;
  for(const [s,e] of parts){if(e<=cur)continue;if(s>cur)break;cur=Math.max(cur,e);if(cur>=b)break}
  const covered=Math.max(0,Math.min(b,cur)-a);
  return covered>=b-a-1e-7?'released':covered>0?'partial':'unreleased';
}
function relRows(type,side){
  if(type==='OS')return OS_REL;
  const rows=type==='CONTENÇÃO'?CONT_REL:TFA_REL;
  return rows.filter(r=>{const s=sideOf(r).toUpperCase();return s===side||!s});
}
function status(r){
  const [a,b]=interval(r);if(!(b>a))return 'unreleased';
  const t=text(r,'TIPO').toUpperCase(),s=sideOf(r).toUpperCase();
  if(t==='OAE')return coverage(a,b,OS_REL);
  if(t==='TERRAPLENAGEM')return coverage(a,b,relRows('TFA',s));
  return coverage(a,b,relRows(t,s));
}
function statusLabel(s){return s==='released'?'LIBERADA':s==='partial'?'PARCIAL':'NÃO LIBERADA'}
function statusClass(s){return s==='released'?'yes':s==='partial'?'partial-pill':'no'}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16&255,g=n>>8&255,b=n&255;if(amt<0){r*=1+amt/100;g*=1+amt/100;b*=1+amt/100}else{r+=(255-r)*amt/100;g+=(255-g)*amt/100;b+=(255-b)*amt/100}return '#'+[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('')}
function itemColor(r){const base=COLORS[text(r,'TIPO')]||'#64748b';const sols=[...new Set(filtered.map(x=>text(x,'SOLUÇÃO')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));return shade(base,[-35,-15,0,18,35,52,68][Math.max(0,sols.indexOf(text(r,'SOLUÇÃO')))%7])}
function makeMulti(id,label,values,onChange){
  const root=$(id);root.innerHTML='';root.className='multi';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='multi-trigger';trigger.innerHTML='<span>'+label+'</span><span>⌄</span>';
  const panel=document.createElement('div');panel.className='multi-panel';
  const head=document.createElement('div');head.className='multi-head';head.innerHTML='<span>Selecionar</span><button class="multi-clear" type="button">Limpar</button>';panel.appendChild(head);
  const list=document.createElement('div');
  values.forEach(v=>{const lab=document.createElement('label');lab.className='multi-option';lab.innerHTML='<input type="checkbox" value="'+esc(v)+'"><span>'+esc(v)+'</span>';lab.querySelector('input').onchange=()=>{updateMulti(trigger,list,label);onChange()};list.appendChild(lab)});
  panel.appendChild(list);root.append(trigger,panel);
  trigger.onclick=e=>{e.stopPropagation();document.querySelectorAll('.multi.open').forEach(x=>x!==root&&x.classList.remove('open'));root.classList.toggle('open')};
  head.querySelector('.multi-clear').onclick=e=>{e.stopPropagation();list.querySelectorAll('input').forEach(x=>x.checked=false);updateMulti(trigger,list,label);onChange()};
}
function updateMulti(trigger,list,label){const n=list.querySelectorAll('input:checked').length;trigger.firstElementChild.textContent=n?label+' ('+n+')':label}
function selected(id){return [...$(id).querySelectorAll('input:checked')].map(x=>x.value)}
document.addEventListener('click',e=>{if(!e.target.closest('.multi'))document.querySelectorAll('.multi.open').forEach(x=>x.classList.remove('open'))});
function initFilters(){
  const uniq=k=>[...new Set(DATA.map(r=>text(r,k)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  makeMulti('tipo','Tipo',uniq('TIPO'),()=>{rebuildSolution();apply()});
  makeMulti('solucao','Solução',uniq('SOLUÇÃO'),apply);
  makeMulti('lado','Lado',uniq('LADO'),apply);
}
function rebuildSolution(){
  const old=selected('solucao'),types=selected('tipo');
  const vals=[...new Set(DATA.filter(r=>!types.length||types.includes(text(r,'TIPO'))).map(r=>text(r,'SOLUÇÃO')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  makeMulti('solucao','Solução',vals,apply);
  const root=$('solucao'),list=root.querySelector('.multi-panel');
  old.filter(x=>vals.includes(x)).forEach(v=>{const c=[...list.querySelectorAll('input')].find(x=>x.value===v);if(c)c.checked=true});
  updateMulti(root.querySelector('.multi-trigger'),list,'Solução');
}
function buildSegments(){
  const box=$('segments');box.innerHTML='';
  const all=document.createElement('button');all.className='segment active';all.textContent='TODOS';all.onclick=()=>setWindow(MIN,MAX,'');box.appendChild(all);
  for(const s of SEGMENTS){const b=document.createElement('button');b.className='segment';b.textContent=s.key;b.onclick=()=>setWindow(s.lo,s.hi,s.key);box.appendChild(b)}
}
function setWindow(a,b,key){lo=a;hi=b;document.querySelectorAll('.segment').forEach(x=>x.classList.toggle('active',key?x.textContent===key:x.textContent==='TODOS'));$('graphTitle').textContent=key?'Trecho '+key:'Distribuição das frentes';syncRange();apply()}
function syncRange(){
  $('r1').value=lo;$('r2').value=hi;$('kmStart').textContent=km(lo);$('kmEnd').textContent=km(hi);$('rangeLeft').textContent=km(lo);$('rangeRight').textContent=km(hi);
  const p=(lo-MIN)/(MAX-MIN)*100,w=(hi-lo)/(MAX-MIN)*100;$('rangeFill').style.left=p+'%';$('rangeFill').style.width=w+'%';
}
function apply(){
  const types=selected('tipo'),sides=selected('lado'),sols=selected('solucao');
  filtered=DATA.filter(r=>{const [a,b]=interval(r),s=status(r);return Number.isFinite(a)&&Number.isFinite(b)&&b>=lo&&a<=hi&&(!types.length||types.includes(text(r,'TIPO')))&&(!sides.length||sides.includes(text(r,'LADO')))&&(!sols.length||sols.includes(text(r,'SOLUÇÃO')))&&(!statusFilter||s===statusFilter)});
  $('count').textContent=filtered.length+' frentes';$('tableCount').textContent=filtered.length+' registros';$('terrapCount').textContent=filtered.filter(r=>text(r,'TIPO').toUpperCase()==='TFA').length+' registros';
  render();renderTable();renderTerrapTable();renderLegend();
}
function tickStep(){const span=hi-lo;return span>32?5:span>18?2:span>7?1:span>3?.5:span>1?.2:.1}
function ticks(){const st=tickStep(),out=[];for(let x=Math.ceil((lo-1e-9)/st)*st;x<=hi+1e-8;x+=st)out.push(Number(x.toFixed(3)));return out}
function pct(x){return (x-lo)/Math.max(hi-lo,.001)*100}
function mergeParts(rows){
  const ints=norm(rows).filter(x=>x.b>=lo&&x.a<=hi).map(x=>({a:Math.max(lo,x.a),b:Math.min(hi,x.b),status:x.status})).filter(x=>x.b>x.a).sort((a,b)=>a.a-b.a);
  const out=[];let cur=lo;
  for(const x of ints){if(x.a>cur)out.push({a:cur,b:x.a,released:false,status:'unreleased'});if(x.a<=cur){if(x.b>cur)cur=x.b;out.push({a:x.a,b:x.b,released:true,status:x.status})}else{out.push({a:x.a,b:x.b,released:true,status:x.status});cur=x.b}}
  if(cur<hi)out.push({a:cur,b:hi,released:false,status:'unreleased'});return out;
}
function addReleaseLayer(row,side,type){
  const rows=type==='CONTENÇÃO'?CONT_REL:TFA_REL;
  for(const p of mergeParts(rows.filter(r=>{const s=sideOf(r).toUpperCase();return s===side||!s;}))){
    const d=document.createElement('button');d.type='button';d.className=p.released?(p.status.includes('parcial')?'release-part partial':'release-part'):'release-unreleased';
    d.style.left=pct(p.a)+'%';d.style.width=Math.max(pct(p.b)-pct(p.a),.08)+'%';d.title=(p.released?'Área liberada ':'Área não liberada ')+type+' — '+km(p.a)+' – '+km(p.b);
    d.onclick=e=>{e.stopPropagation();openRelease(p,side,type)};row.appendChild(d);
  }
}
function addItems(row,side,type){
  for(const r of filtered){
    const rt=text(r,'TIPO').toUpperCase(),rs=sideOf(r).toUpperCase();
    if(rt!==type||(type!=='OAE'&&rs!==side)||(type==='OAE'&&!(rs==='-'||rs==='MEIO'||!rs)))continue;
    const [a0,b0]=interval(r),a=Math.max(lo,a0),b=Math.min(hi,b0);if(!(b>a))continue;
    const d=document.createElement('button');d.type='button';d.className='item'+(type==='OAE'?' center-item':'');
    d.style.top='9px';d.style.left=pct(a)+'%';d.style.width=Math.max(pct(b)-pct(a),.25)+'%';d.style.background=itemColor(r);d.title=text(r,'IDENTIFICAÇÃO')+' — '+statusLabel(status(r));d.onclick=e=>{e.stopPropagation();openItem(r)};row.appendChild(d);
  }
}
function addOS(row){
  for(const p of mergeParts(OS_REL)){
    const d=document.createElement('button');d.type='button';d.className=p.released?'release-part':'release-unreleased';d.style.left=pct(p.a)+'%';d.style.width=Math.max(pct(p.b)-pct(p.a),.08)+'%';
    d.title=(p.released?'OS liberada ':'OS não liberada ')+km(p.a)+' – '+km(p.b);d.onclick=e=>{e.stopPropagation();openRelease(p,'EIXO','OS')};row.appendChild(d)
  }
  addItems(row,'-','OAE');
}
function render(){
  const axis=$('axis');axis.querySelectorAll('.dynamic').forEach(x=>x.remove());
  for(const x of ticks()){const d=document.createElement('div');d.className='tick dynamic';d.style.left=pct(x)+'%';const lab=document.createElement('span');lab.className='tick-label'+(Math.abs(x-lo)<1e-6?' edge-left':'')+(Math.abs(x-hi)<1e-6?' edge-right':'');lab.textContent=km(x);d.appendChild(lab);axis.appendChild(d)}
  for(const s of STATIONS.filter(x=>x.km>=lo&&x.km<=hi)){const d=document.createElement('div');d.className='station dynamic';d.style.left=pct(s.km)+'%';d.innerHTML='<div class="station-name">'+esc(s.name)+'</div><div class="station-dot"></div>';axis.appendChild(d)}
  const lane=$('laneLE');lane.innerHTML='';
  const bands=[['CONTENÇÃO','LE'],['TFA','LE'],['TERRAPLENAGEM','LE'],['OS','EIXO'],['TERRAPLENAGEM','LD'],['TFA','LD'],['CONTENÇÃO','LD']];
  bands.forEach((b,i)=>{const row=document.createElement('div');row.className='graph-band '+(b[0]==='OS'?'band-axis':'band-release');row.style.top=(i*32)+'px';row.style.height='32px';if(b[0]==='OS')addOS(row);else if(b[0]==='TERRAPLENAGEM')addReleaseLayer(row,b[1],'TFA');else{addReleaseLayer(row,b[1],b[0]);addItems(row,b[1],b[0])}lane.appendChild(row)});
  $('laneLD').innerHTML='';$('laneLD').style.display='none';
}
function renderLegend(){
  const box=$('legend');box.innerHTML='';const types=selected('tipo'),vals=types.length?types:['OAE','CONTENÇÃO','TFA'];
  vals.forEach(t=>{const sols=[...new Set(filtered.filter(r=>text(r,'TIPO')===t).map(r=>text(r,'SOLUÇÃO')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const base=COLORS[t]||'#64748b';sols.forEach((s,i)=>{const sp=document.createElement('span');sp.innerHTML='<i class="sw" style="background:'+shade(base,[-35,-15,0,18,35,52,68][i%7])+'"></i>'+esc(s);box.appendChild(sp)})});
  [['rgba(34,197,94,.55)','Área liberada'],['rgba(234,179,8,.55)','Parcial'],['rgba(239,68,68,.55)','Não liberada']].forEach(x=>{const sp=document.createElement('span');sp.innerHTML='<i class="sw" style="background:'+x[0]+'"></i>'+x[1];box.appendChild(sp)});
}
function tableRow(r,i){
  const st=status(r),saved=storeGet('frente_'+rowKey(r)),tr=document.createElement('tr');
  tr.innerHTML='<td>'+String(i+1)+'</td><td>'+esc(text(r,'TRECHO'))+'</td><td>'+esc(text(r,'TIPO'))+'</td><td>'+esc(text(r,'SOLUÇÃO'))+'</td><td>'+esc(text(r,'LADO'))+'</td><td>'+esc(text(r,'EXTENSÃO'))+'</td><td>'+km(r._ki)+'</td><td>'+km(r._kf)+'</td><td>'+esc(text(r,'IDENTIFICAÇÃO'))+'</td><td><span class="status-pill '+statusClass(st)+'">'+statusLabel(st)+'</span></td><td>'+esc(saved.obs||text(r,'OBSERVAÇÃO'))+'</td><td>'+(saved.photo||text(r,'FOTO')?'📷':'')+'</td>';
  tr.onclick=()=>openItem(r);return tr;
}
function renderTable(){const tb=$('tbody');tb.innerHTML='';filtered.forEach((r,i)=>tb.appendChild(tableRow(r,i)))}
function renderTerrapTable(){const tb=$('terrapBody');tb.innerHTML='';filtered.filter(r=>text(r,'TIPO').toUpperCase()==='TFA').forEach((r,i)=>tb.appendChild(tableRow(Object.assign({},r,{TIPO:'TERRAPLENAGEM'}),i)))}
function openItem(r){
  const saved=storeGet('frente_'+rowKey(r));$('modalTitle').textContent=text(r,'IDENTIFICAÇÃO')||'Detalhes';
  const h=Number(r['ALTURA MÉDIA']),alt=Number.isFinite(h)?h.toFixed(2):text(r,'ALTURA MÉDIA');
  const fields=[['TRECHO',text(r,'TRECHO')],['TIPO',text(r,'TIPO')],['SOLUÇÃO',text(r,'SOLUÇÃO')],['LADO',text(r,'LADO')],['KM INICIAL',km(r._ki)],['KM FINAL',km(r._kf)],['EXTENSÃO',text(r,'EXTENSÃO')],['ALTURA MÉDIA',alt],['SITUAÇÃO',statusLabel(status(r))]];
  $('details').innerHTML=fields.map(x=>'<div class="detail"><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('');
  $('obs').disabled=false;$('photo').disabled=false;$('save').style.display='';$('obs').value=saved.obs||text(r,'OBSERVAÇÃO');window._active=r;window._photo=saved.photo||text(r,'FOTO')||null;$('preview').src=window._photo||'';$('preview').style.display=window._photo?'block':'none';$('photo').value='';showModal();
}
function openRelease(p,side,type){
  $('modalTitle').textContent=(type==='OS'?'OS — ORDEM DE SERVIÇO':type+' — '+(p.released?'ÁREA LIBERADA':'ÁREA NÃO LIBERADA'));
  $('details').innerHTML=[['LADO',side],['KM INICIAL',km(p.a)],['KM FINAL',km(p.b)],['EXTENSÃO',((p.b-p.a)*1000).toFixed(0)+' m'],['SITUAÇÃO',p.released?(p.status==='partial'?'PARCIAL':'LIBERADA'):'NÃO LIBERADA']].map(x=>'<div class="detail"><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('');
  $('obs').value='';$('obs').disabled=true;$('photo').disabled=true;$('save').style.display='none';$('preview').style.display='none';showModal();
}
function showModal(){$('modal').classList.add('show');$('modal').setAttribute('aria-hidden','false')}
function closeModal(){$('modal').classList.remove('show');$('modal').setAttribute('aria-hidden','true')}
function setupZoom(){
  const axis=$('axis');axis.classList.add('pan-mode');
  axis.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();const rect=axis.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),f=e.deltaY<0?1.2:.833333,span=Math.max(.1,Math.min(MAX-MIN,(hi-lo)/f)),focus=lo+p*(hi-lo);let a=focus-p*span,b=focus+(1-p)*span;if(a<MIN){a=MIN;b=MIN+span}if(b>MAX){b=MAX;a=MAX-span}lo=a;hi=b;syncRange();apply()},{passive:false});
  let drag=null;axis.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.item,.release-part,.release-unreleased,.station,.tick'))return;drag={x:e.clientX,lo,hi};axis.classList.add('dragging');axis.setPointerCapture?.(e.pointerId)});
  axis.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();const rect=axis.getBoundingClientRect(),delta=(e.clientX-drag.x)/Math.max(1,rect.width)*(drag.hi-drag.lo);lo=Math.max(MIN,drag.lo-delta);hi=Math.min(MAX,drag.hi-delta);if(hi-lo<.1){if(lo<=MIN)hi=lo+.1;else lo=hi-.1}syncRange();apply()},{passive:false});
  const end=()=>{drag=null;axis.classList.remove('dragging')};axis.addEventListener('pointerup',end);axis.addEventListener('pointercancel',end);
}
function setup(){
  initFilters();buildSegments();syncRange();
  $('clearFilters').onclick=()=>{document.querySelectorAll('.multi input').forEach(x=>x.checked=false);document.querySelectorAll('.multi-trigger').forEach(t=>t.firstElementChild.textContent=t.closest('.multi').id==='tipo'?'Tipo':t.closest('.multi').id==='solucao'?'Solução':'Lado');statusFilter='';document.querySelectorAll('.status-btn').forEach((x,i)=>x.classList.toggle('active',i===0));lo=MIN;hi=MAX;document.querySelectorAll('.segment').forEach(x=>x.classList.toggle('active',x.textContent==='TODOS'));syncRange();apply()};
  document.querySelectorAll('.status-btn').forEach(b=>b.onclick=()=>{statusFilter=b.dataset.status||'';document.querySelectorAll('.status-btn').forEach(x=>x.classList.toggle('active',x===b));apply()});
  $('r1').oninput=()=>{lo=Math.min(Number($('r1').value),hi-.001);syncRange();apply()};$('r2').oninput=()=>{hi=Math.max(Number($('r2').value),lo+.001);syncRange();apply()};
  $('closeModal').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  $('photo').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{window._photo=rd.result;$('preview').src=window._photo;$('preview').style.display='block'};rd.readAsDataURL(f)};
  $('save').onclick=()=>{if(!window._active)return;const s=storeGet('frente_'+rowKey(window._active));s.obs=$('obs').value;if(window._photo)s.photo=window._photo;storeSet('frente_'+rowKey(window._active),s);closeModal();renderTable()};
  setupZoom();apply();
}
window.addEventListener('load',setup);
window.DASHBOARD_VERSION='V46_7_FAIXAS';
})();