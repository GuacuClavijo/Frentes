(function(){'use strict';
const DATA=(window.APP_DATA&&window.APP_DATA.data)||[];
const RELEASES=(window.APP_DATA&&window.APP_DATA.releases)||[];
const MIN=60,MAX=105;
const COLORS={OAE:'#2563eb','CONTENÇÃO':'#7c3aed',TFA:'#06b6d4'};
const STATIONS=[{name:'JUNDIAÍ',km:60.5},{name:'LOUVEIRA',km:76},{name:'VINHEDO',km:83.5},{name:'VALINHOS',km:91.3},{name:'CAMPINAS',km:104.6}];
const SEGMENTS=[{key:'3A',lo:60,hi:76},{key:'3B',lo:76,hi:83.5},{key:'3C',lo:83.5,hi:91.3},{key:'3D',lo:91.3,hi:105}];
let lo=MIN,hi=MAX,filtered=DATA.slice(),active=null,photoData=null,statusFilter='';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const text=(r,k)=>String(r?.[k]??'').trim();
function km(v){const n=Number(v);if(!Number.isFinite(n))return '-';const m=Math.round(n*1000);return Math.floor(m/1000)+'+'+String(m%1000).padStart(3,'0')}
function storeGet(k){try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}}
function storeSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
function rowKey(r){return String(r._row||r['IDENTIFICAÇÃO']||'x').replace(/[^a-z0-9_-]/gi,'_')}
const releaseIndex={LE:[],LD:[]};
for(const r of RELEASES){const s=text(r,'lado').toUpperCase(),a=Number(r.ki),b=Number(r.kf);if((s==='LE'||s==='LD')&&b>a)releaseIndex[s].push({a,b,raw:r})}
for(const s of ['LE','LD'])releaseIndex[s].sort((a,b)=>a.a-b.a);
const OS_RELEASES=(window.APP_DATA&&Array.isArray(window.APP_DATA.os_releases)&&window.APP_DATA.os_releases.length)?window.APP_DATA.os_releases.map(x=>({a:Number(x.ki),b:Number(x.kf),raw:x})).filter(x=>x.b>x.a):[{a:MIN,b:MAX,raw:{nome:'OS — Ordem de Serviço'}}];
function status(r){const a=Number(r._ki),b=Number(r._kf),side=text(r,'LADO').toUpperCase();if(!(b>a))return 'unreleased';let cur=a,covered=false;for(const x of releaseIndex[side]||[]){if(x.b<=cur)continue;if(x.a>b)break;if(x.a>cur)break;cur=Math.max(cur,x.b);covered=true;if(cur>=b)break}return covered&&cur>=b-1e-7?'released':covered?'partial':'unreleased'}
function statusLabel(s){return s==='released'?'LIBERADA':s==='partial'?'PARCIAL':'NÃO LIBERADA'}
function statusClass(s){return s==='released'?'yes':s==='partial'?'partial-pill':'no'}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16&255,g=n>>8&255,b=n&255;if(amt<0){r*=1+amt/100;g*=1+amt/100;b*=1+amt/100}else{r+=(255-r)*amt/100;g+=(255-g)*amt/100;b+=(255-b)*amt/100}return '#'+[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('')}
function itemColor(r){const base=COLORS[text(r,'TIPO')]||'#64748b';const sols=[...new Set(filtered.map(x=>text(x,'SOLUÇÃO')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const i=Math.max(0,sols.indexOf(text(r,'SOLUÇÃO')));return shade(base,[-35,-15,0,18,35,52,68][i%7])}
function makeMulti(id,label,values,onChange){const root=$(id);root.innerHTML='';root.className='multi';const trigger=document.createElement('button');trigger.type='button';trigger.className='multi-trigger';trigger.innerHTML='<span>'+label+'</span><span>⌄</span>';const panel=document.createElement('div');panel.className='multi-panel';const head=document.createElement('div');head.className='multi-head';head.innerHTML='<span>Selecionar</span><button class="multi-clear" type="button">Limpar</button>';panel.appendChild(head);const list=document.createElement('div');values.forEach(v=>{const lab=document.createElement('label');lab.className='multi-option';lab.innerHTML='<input type="checkbox" value="'+esc(v)+'"><span>'+esc(v)+'</span>';lab.querySelector('input').addEventListener('change',()=>{updateMulti(trigger,list,label);onChange()});list.appendChild(lab)});panel.appendChild(list);root.append(trigger,panel);trigger.onclick=e=>{e.stopPropagation();document.querySelectorAll('.multi.open').forEach(x=>x!==root&&x.classList.remove('open'));root.classList.toggle('open')};head.querySelector('.multi-clear').onclick=e=>{e.stopPropagation();list.querySelectorAll('input').forEach(x=>x.checked=false);updateMulti(trigger,list,label);onChange()};return root}
function updateMulti(trigger,list,label){const n=list.querySelectorAll('input:checked').length;trigger.firstElementChild.textContent=n?label+' ('+n+')':label}
function selected(id){return [...$(id).querySelectorAll('input:checked')].map(x=>x.value)}
document.addEventListener('click',e=>{if(!e.target.closest('.multi'))document.querySelectorAll('.multi.open').forEach(x=>x.classList.remove('open'))});
function initFilters(){const uniq=k=>[...new Set(DATA.map(r=>text(r,k)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));makeMulti('tipo','Tipo',uniq('TIPO'),()=>{rebuildSolution();apply()});makeMulti('solucao','Solução',uniq('SOLUÇÃO'),apply);makeMulti('lado','Lado',uniq('LADO'),apply)}
function rebuildSolution(){const old=selected('solucao');const types=selected('tipo');const vals=[...new Set(DATA.filter(r=>!types.length||types.includes(text(r,'TIPO'))).map(r=>text(r,'SOLUÇÃO')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const root=makeMulti('solucao','Solução',vals,apply);const list=root.querySelector('.multi-panel');old.filter(x=>vals.includes(x)).forEach(v=>{const c=[...list.querySelectorAll('input')].find(x=>x.value===v);if(c)c.checked=true});updateMulti(root.querySelector('.multi-trigger'),list,'Solução')}
function buildSegments(){const box=$('segments');box.innerHTML='';const all=document.createElement('button');all.className='segment active';all.textContent='TODOS';all.onclick=()=>setWindow(MIN,MAX,'');box.appendChild(all);for(const s of SEGMENTS){const b=document.createElement('button');b.className='segment';b.textContent=s.key;b.onclick=()=>setWindow(s.lo,s.hi,s.key);box.appendChild(b)}}
function setWindow(a,b,key){lo=a;hi=b;document.querySelectorAll('.segment').forEach(x=>x.classList.toggle('active',key?x.textContent===key:x.textContent==='TODOS'));$('graphTitle').textContent=key?'Trecho '+key:'Distribuição das frentes';syncRange();apply()}
function syncRange(){$('r1').value=lo;$('r2').value=hi;$('kmStart').textContent=km(lo);$('kmEnd').textContent=km(hi);$('rangeLeft').textContent=km(lo);$('rangeRight').textContent=km(hi);const p=(lo-MIN)/(MAX-MIN)*100,w=(hi-lo)/(MAX-MIN)*100;$('rangeFill').style.left=p+'%';$('rangeFill').style.width=w+'%'}
function apply(){const types=selected('tipo'),sides=selected('lado'),sols=selected('solucao');filtered=DATA.filter(r=>{const a=Number(r._ki),b=Number(r._kf),s=status(r);return Number.isFinite(a)&&Number.isFinite(b)&&b>=lo&&a<=hi&&(!types.length||types.includes(text(r,'TIPO')))&&(!sides.length||sides.includes(text(r,'LADO')))&&(!sols.length||sols.includes(text(r,'SOLUÇÃO')))&&(!statusFilter||s===statusFilter)});$('count').textContent=filtered.length+' frentes';$('tableCount').textContent=filtered.length+' registros';$('terrapCount').textContent=filtered.length+' registros';render();renderTable();renderTerrapTable();renderLegend()}
function tickStep(){const span=hi-lo;return span>32?5:span>18?2:span>7?1:span>3?.5:span>1?.2:.1}
function ticks(){const st=tickStep(),out=[];for(let x=Math.ceil((lo-1e-9)/st)*st;x<=hi+1e-8;x+=st)out.push(Number(x.toFixed(3)));return out}
function pct(x){return (x-lo)/Math.max(hi-lo,.001)*100}
function releaseParts(side){const ints=(releaseIndex[side]||[]).filter(x=>x.b>=lo&&x.a<=hi).map(x=>({a:Math.max(lo,x.a),b:Math.min(hi,x.b)})).filter(x=>x.b>x.a);const merged=[];for(const x of ints){const last=merged[merged.length-1];if(last&&x.a<=last.b+1e-7)last.b=Math.max(last.b,x.b);else merged.push({...x})}const out=[];let cur=lo;for(const x of merged){if(x.a>cur)out.push({a:cur,b:x.a,released:false});out.push({a:x.a,b:x.b,released:true});cur=Math.max(cur,x.b)}if(cur<hi)out.push({a:cur,b:hi,released:false});return out}
function addReleaseLayer(row,side,terr=false){
  const parts=terr ? [{a:lo,b:hi,released:true}] : releaseParts(side);
  for(const p of parts){
    const d=document.createElement('button');
    d.type='button';
    d.className=p.released?'release-part':'release-unreleased';
    d.style.left=pct(p.a)+'%';
    d.style.width=Math.max(pct(p.b)-pct(p.a),.08)+'%';
    d.title=(p.released?'Área liberada ':'Área não liberada ')+(terr?'Terraplenagem — ':'')+km(p.a)+' – '+km(p.b);
    d.setAttribute('aria-label',d.title);
    d.onclick=e=>{e.stopPropagation();openRelease(p,side,terr)};
    row.appendChild(d);
  }
}
function addItems(row,side,types,y=9){
  for(const r of filtered){
    const rside=text(r,'LADO').toUpperCase();
    const sideOK = types.includes('OAE') ? rside==='-' : rside===side;
    if(!sideOK || !types.includes(text(r,'TIPO'))) continue;
    const a=Math.max(lo,Number(r._ki)),b=Math.min(hi,Number(r._kf));
    if(b<=a)continue;
    const d=document.createElement('button');
    d.type='button';d.className='item'+(types.includes('OAE')?' center-item':'');
    d.style.top=y+'px';
    d.style.left=pct(a)+'%';d.style.width=Math.max(pct(b)-pct(a),.25)+'%';
    d.style.background=itemColor(r);
    d.title=text(r,'IDENTIFICAÇÃO')+' — '+statusLabel(status(r));
    d.onclick=e=>{e.stopPropagation();openItem(r)};
    row.appendChild(d);
  }
}
function drawLane(id,side){
  const lane=$(id); lane.innerHTML='';
  const bands=[
    {type:'CONTENÇÃO',side:'LE'},
    {type:'TFA',side:'LE'},
    {terr:true,side:'LE'},
    {axis:true},
    {terr:true,side:'LD'},
    {type:'TFA',side:'LD'},
    {type:'CONTENÇÃO',side:'LD'}
  ];
  const rowH=32;
  bands.forEach((b,i)=>{
    const row=document.createElement('div');
    row.className='graph-band '+(b.axis?'band-axis':b.terr?'band-terrap':'band-release');
    row.style.top=(i*rowH)+'px';row.style.height=rowH+'px';
    if(b.axis){
      addItems(row,'-', ['OAE'], 9);
      row.setAttribute('aria-label','Eixo OAE — OS');
    } else if(b.terr){
      // Terraplenagem segue exatamente a mesma planilha de liberação do TFA.
      addReleaseLayer(row,b.side,false);
    } else {
      addReleaseLayer(row,b.side,false);
      addItems(row,b.side,[b.type],9);
    }
    lane.appendChild(row);
  });
}

function render(){
  const axis=$('axis');axis.querySelectorAll('.dynamic').forEach(x=>x.remove());
  for(const x of ticks()){
    const d=document.createElement('div');d.className='tick dynamic';d.style.left=pct(x)+'%';
    const lab=document.createElement('span');lab.className='tick-label'+(Math.abs(x-lo)<1e-6?' edge-left':Math.abs(x-hi)<1e-6?' edge-right':'');lab.textContent=km(x);d.appendChild(lab);axis.appendChild(d);
  }
  for(const s of STATIONS.filter(x=>x.km>=lo&&x.km<=hi)){
    const d=document.createElement('div');d.className='station dynamic';d.style.left=pct(s.km)+'%';
    d.innerHTML='<div class="station-name">'+esc(s.name)+'</div><div class="station-dot"></div>';axis.appendChild(d);
  }
  drawLane('laneLE','LE'); $('laneLD').innerHTML=''; $('laneLD').style.display='none';
  axis.appendChild(document.createElement('div')).className='dynamic-marker';
}
function renderLegend(){const box=$('legend');const types=selected('tipo');box.innerHTML='';const vals=types.length?types:['OAE','CONTENÇÃO','TFA'];vals.forEach(t=>{const s=document.createElement('span');s.innerHTML='<i class="sw" style="background:'+COLORS[t]+'"></i>'+t;box.appendChild(s)});const r=document.createElement('span');r.innerHTML='<i class="sw" style="background:rgba(22,163,74,.65)"></i>Área liberada';box.appendChild(r);const n=document.createElement('span');n.innerHTML='<i class="sw" style="background:rgba(220,38,38,.55)"></i>Área não liberada';box.appendChild(n)}
function renderTable(){const tb=$('tbody');tb.innerHTML='';if(!filtered.length){tb.innerHTML='<tr><td colspan="12" class="empty">Nenhuma frente encontrada.</td></tr>';return}filtered.forEach((r,i)=>{const st=status(r),saved=storeGet('frente_'+rowKey(r)),tr=document.createElement('tr');tr.innerHTML='<td>'+String(i+1)+'</td><td>'+esc(text(r,'TRECHO'))+'</td><td>'+esc(text(r,'TIPO'))+'</td><td>'+esc(text(r,'SOLUÇÃO'))+'</td><td>'+esc(text(r,'LADO'))+'</td><td>'+esc(text(r,'EXTENSÃO'))+'</td><td>'+km(r._ki)+'</td><td>'+km(r._kf)+'</td><td>'+esc(text(r,'IDENTIFICAÇÃO'))+'</td><td><span class="status-pill '+statusClass(st)+'">'+statusLabel(st)+'</span></td><td>'+esc(saved.obs||text(r,'OBSERVAÇÃO'))+'</td><td>'+(saved.photo||text(r,'FOTO')?'📷':'')+'</td>';tr.onclick=()=>openItem(r);tb.appendChild(tr)})}
function renderTerrapTable(){const tb=$('terrapBody');tb.innerHTML='';if(!filtered.length){tb.innerHTML='<tr><td colspan="12" class="empty">Nenhuma frente encontrada.</td></tr>';return}filtered.forEach((r,i)=>{const st=status(r),saved=storeGet('frente_'+rowKey(r)),tr=document.createElement('tr');tr.innerHTML='<td>'+String(i+1)+'</td><td>'+esc(text(r,'TRECHO'))+'</td><td>'+esc(text(r,'TIPO'))+'</td><td>'+esc(text(r,'SOLUÇÃO'))+'</td><td>'+esc(text(r,'LADO'))+'</td><td>'+esc(text(r,'EXTENSÃO'))+'</td><td>'+km(r._ki)+'</td><td>'+km(r._kf)+'</td><td>'+esc(text(r,'IDENTIFICAÇÃO'))+'</td><td><span class="status-pill '+statusClass(st)+'">'+statusLabel(st)+'</span></td><td>'+esc(saved.obs||text(r,'OBSERVAÇÃO'))+'</td><td>'+(saved.photo||text(r,'FOTO')?'📷':'')+'</td>';tr.onclick=()=>openItem(r);tb.appendChild(tr)})}
function openItem(r){active=r;const saved=storeGet('frente_'+rowKey(r));$('modalTitle').textContent=text(r,'IDENTIFICAÇÃO')||'Detalhes';const fields=[['TRECHO',text(r,'TRECHO')],['TIPO',text(r,'TIPO')],['SOLUÇÃO',text(r,'SOLUÇÃO')],['LADO',text(r,'LADO')],['KM INICIAL',km(r._ki)],['KM FINAL',km(r._kf)],['EXTENSÃO',text(r,'EXTENSÃO')],['ALTURA MÉDIA',Number(r['ALTURA MÉDIA']).toFixed(2)],['SITUAÇÃO',statusLabel(status(r))]];$('details').innerHTML=fields.map(x=>'<div class="detail"><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('');$('obs').disabled=false;$('photo').disabled=false;$('save').style.display='';$('obs').value=saved.obs||text(r,'OBSERVAÇÃO');photoData=saved.photo||text(r,'FOTO')||null;$('preview').src=photoData||'';$('preview').style.display=photoData?'block':'none';$('photo').value='';showModal()}
function openRelease(p,side,terr=false){active=null;photoData=null;$('modalTitle').textContent=(p.released?'Área liberada':'Área não liberada')+(terr?' — Terraplenagem':'');$('details').innerHTML=[['LADO',side],['KM INICIAL',km(p.a)],['KM FINAL',km(p.b)],['EXTENSÃO',((p.b-p.a)*1000).toFixed(0)+' m'],['SITUAÇÃO',p.released?'LIBERADA':'NÃO LIBERADA']].map(x=>'<div class="detail"><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('');$('obs').value='';$('obs').disabled=true;$('photo').disabled=true;$('save').style.display='none';$('preview').style.display='none';showModal()}
function showModal(){$('modal').classList.add('show');$('modal').setAttribute('aria-hidden','false')}
function closeModal(){$('modal').classList.remove('show');$('modal').setAttribute('aria-hidden','true');active=null;photoData=null}
function setupZoom(){const axis=$('axis');let pinch=null,drag=null;axis.classList.add('pan-mode');axis.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();const rect=axis.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),f=e.deltaY<0?1.2:.833333,span=Math.max(.1,Math.min(MAX-MIN,(hi-lo)/f)),focus=lo+p*(hi-lo);let a=focus-p*span,b=focus+(1-p)*span;if(a<MIN){a=MIN;b=MIN+span}if(b>MAX){b=MAX;a=MAX-span}lo=a;hi=b;syncRange();apply()},{passive:false});const pts=new Map();axis.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===2){drag=null;const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),lo,hi,mid:(a.x+b.x)/2}}else if(pts.size===1&&!e.target.closest('.item,.release-part,.release-unreleased')){drag={x:e.clientX,lo,hi};axis.setPointerCapture?.(e.pointerId)}}else if(!e.target.closest('.item,.release-part,.release-unreleased')){drag={x:e.clientX,lo,hi};axis.classList.add('dragging');axis.setPointerCapture?.(e.pointerId)}});axis.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&pts.has(e.pointerId)){pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pts.size>=2){e.preventDefault();const [a,b]=[...pts.values()],d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),factor=d/pinch.d,span=Math.max(.1,Math.min(MAX-MIN,(pinch.hi-pinch.lo)/factor)),rect=axis.getBoundingClientRect(),p=Math.max(0,Math.min(1,(pinch.mid-rect.left)/rect.width)),focus=pinch.lo+p*(pinch.hi-pinch.lo);let a0=focus-p*span,b0=focus+(1-p)*span;if(a0<MIN){a0=MIN;b0=MIN+span}if(b0>MAX){b0=MAX;a0=MAX-span}lo=a0;hi=b0;syncRange();apply();return}}if(drag){e.preventDefault();const rect=axis.getBoundingClientRect(),delta=(e.clientX-drag.x)/Math.max(1,rect.width)*(drag.hi-drag.lo);lo=Math.max(MIN,drag.lo-delta);hi=Math.min(MAX,drag.hi-delta);if(hi-lo<.1){if(lo<=MIN)hi=lo+.1;else lo=hi-.1}syncRange();apply()}},{passive:false});const end=e=>{if(e.pointerType==='touch')pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(drag){drag=null;axis.classList.remove('dragging')}};axis.addEventListener('pointerup',end);axis.addEventListener('pointercancel',end)}
function setupOSClick(){const axis=$('axis');axis.addEventListener('click',e=>{if(e.target.closest('.item,.release-part,.release-unreleased,.station,.tick'))return;const p=Math.max(0,Math.min(1,(e.clientX-axis.getBoundingClientRect().left)/axis.getBoundingClientRect().width));const kmv=lo+p*(hi-lo);const hit=OS_RELEASES.find(x=>kmv>=x.a&&kmv<=x.b)||OS_RELEASES[0];openRelease({a:hit.a,b:hit.b,released:true},'EIXO — OS',false);$('modalTitle').textContent='OS — ORDEM DE SERVIÇO';$('details').innerHTML=[['KM INICIAL',km(hit.a)],['KM FINAL',km(hit.b)],['EXTENSÃO',((hit.b-hit.a)*1000).toFixed(0)+' m'],['SITUAÇÃO','LIBERADA / OS']].map(x=>'<div class="detail"><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('')});}
function setup(){initFilters();buildSegments();syncRange();$('clearFilters').onclick=()=>{document.querySelectorAll('.multi input').forEach(x=>x.checked=false);document.querySelectorAll('.multi-trigger').forEach(t=>t.firstElementChild.textContent=t.closest('.multi')?.id==='tipo'?'Tipo':t.closest('.multi')?.id==='solucao'?'Solução':'Lado');statusFilter='';document.querySelectorAll('.status-btn').forEach((x,i)=>x.classList.toggle('active',i===0));lo=MIN;hi=MAX;document.querySelectorAll('.segment').forEach(x=>x.classList.toggle('active',x.textContent==='TODOS'));$('graphTitle').textContent='Distribuição das frentes';syncRange();apply()};document.querySelectorAll('.status-btn').forEach(b=>b.onclick=()=>{statusFilter=b.dataset.status||'';document.querySelectorAll('.status-btn').forEach(x=>x.classList.toggle('active',x===b));apply()});$('r1').oninput=()=>{lo=Math.min(Number($('r1').value),hi-.001);syncRange();apply()};$('r2').oninput=()=>{hi=Math.max(Number($('r2').value),lo+.001);syncRange();apply()};$('closeModal').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});$('save').onclick=()=>{if(!active)return;const s=storeGet('frente_'+rowKey(active));s.obs=$('obs').value;if(photoData)s.photo=photoData;storeSet('frente_'+rowKey(active),s);closeModal();renderTable()};window.addEventListener('scroll',()=>document.querySelector('.header')?.classList.toggle('scrolled',window.scrollY>20),{passive:true});$('photo').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{photoData=rd.result;$('preview').src=photoData;$('preview').style.display='block'};rd.readAsDataURL(f)};setupZoom();setupOSClick();apply()}
window.addEventListener('load',setup);window.DASHBOARD_VERSION='V38_7_FAIXAS_OAE_OS';
})();
