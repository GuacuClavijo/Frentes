(function(){
'use strict';
const D=(window.APP_DATA&&window.APP_DATA.data)||[];
const R=(window.APP_DATA&&window.APP_DATA.releases)||[];
const COLORS={OAE:'#2563eb','CONTENÇÃO':'#7c3aed',TFA:'#06b6d4'};
const MIN=60,MAX=105;
const STATIONS=[
  {name:'JUNDIAÍ',km:60.500},
  {name:'LOUVEIRA',km:76.000},
  {name:'VINHEDO',km:83.500},
  {name:'VALINHOS',km:91.300},
  {name:'CAMPINAS',km:104.600}
];
let lo=MIN,hi=MAX,filtered=D.slice(),active=null,photoData=null,statusFilter='',panEnabled=false,panStartX=0,panStartLo=MIN,panStartHi=MAX;
window.ACTIVE_TRECHO='';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function fmt(x){let n=Number(x);if(!Number.isFinite(n))return '-';let k=Math.round(n*1000);let km=Math.floor(k/1000),m=k%1000;return km+'+'+String(m).padStart(3,'0')}
function val(r,k){return r[k]??''}
function displayValue(k,v){if(String(k).toUpperCase().includes('ALTURA')){const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n.toFixed(2):String(v??'')}return String(v??'')}
function storageGet(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(e){return {}}}
function storageSet(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true}catch(e){return false}}
function key(r){return String(r._row||r['IDENTIFICAÇÃO']||'x').replace(/[^a-z0-9_-]/gi,'_')}
function releaseStatus(r){
  const side=String(val(r,'LADO')).trim().toUpperCase();
  const a=+r._ki,b=+r._kf;
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return 'partial';
  const intervals=R.filter(x=>String(x.lado).trim().toUpperCase()===side && +x.kf>=a && +x.ki<=b)
    .map(x=>[Math.max(a,+x.ki),Math.min(b,+x.kf)]).filter(x=>x[1]>x[0]).sort((u,v)=>u[0]-v[0]);
  if(!intervals.length)return 'partial';
  let covered=0,start=intervals[0][0],end=intervals[0][1];
  for(let i=1;i<intervals.length;i++){
    if(intervals[i][0]<=end+1e-9) end=Math.max(end,intervals[i][1]);
    else {covered+=end-start;start=intervals[i][0];end=intervals[i][1];}
  }
  covered+=end-start;
  return covered >= (b-a)-1e-6 ? 'released' : 'partial';
}
function released(r){return releaseStatus(r)==='released'}
function statusLabel(r){return releaseStatus(r)==='released'?'LIBERADA':'PARCIAL'}
function fillSelect(id,arr){let el=$(id);el.innerHTML='<option value="">Todos</option>'+arr.map(x=>'<option>'+esc(x)+'</option>').join('')}
function fillFilters(){
 const uniq=k=>[...new Set(D.map(r=>String(val(r,k)).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 fillSelect('tipo',uniq('TIPO'));fillSelect('lado',uniq('LADO'));updateSolutions();renderTrechoTabs();
}
function renderTrechoTabs(){
  const box=$('trechoTabs');
  if(!box)return;
  const tabs=[
    {key:'A',label:'3A',lo:60,hi:76},
    {key:'B',label:'3B',lo:76,hi:83.5},
    {key:'C',label:'3C',lo:83.5,hi:91.3},
    {key:'D',label:'3D',lo:91.3,hi:105}
  ];
  box.innerHTML='';
  tabs.forEach(t=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='trechoTab'+(window.ACTIVE_TRECHO===t.key?' active':'');
    b.innerHTML='<b>'+t.label+'</b>';
    b.onclick=()=>{
      window.ACTIVE_TRECHO=t.key;
      lo=t.lo; hi=t.hi;
      $('r1').value=lo; $('r2').value=hi;
      apply();
    };
    box.appendChild(b);
  });
  const title=$('graphTitle');
  if(title){
    const t=tabs.find(x=>x.key===window.ACTIVE_TRECHO);
    title.textContent=t?('Trecho '+t.label):'Distribuição das frentes';
  }
}

function updateSolutions(){const type=$('tipo').value;let arr=D.filter(r=>!type||String(val(r,'TIPO')).trim()===type).map(r=>String(val(r,'SOLUÇÃO')).trim()).filter(x=>x&&x!=='-');arr=[...new Set(arr)].sort((a,b)=>a.localeCompare(b,'pt-BR'));let old=$('solucao').value;fillSelect('solucao',arr);if(arr.includes(old))$('solucao').value=old}
function apply(){
 const tr=window.ACTIVE_TRECHO||'',tp=$('tipo').value,ld=$('lado').value,so=$('solucao').value;
 filtered=D.filter(r=>Number.isFinite(+r._ki)&&Number.isFinite(+r._kf)&&+r._kf>=lo&&+r._ki<=hi&&(!tr||String(val(r,'TRECHO')).trim()===tr)&&(!tp||String(val(r,'TIPO')).trim()===tp)&&(!ld||String(val(r,'LADO')).trim()===ld)&&(!so||String(val(r,'SOLUÇÃO')).trim()===so)&&(!statusFilter||(statusFilter==='released'?releaseStatus(r)==='released':releaseStatus(r)==='partial')));
 $('v1').textContent=fmt(lo);$('v2').textContent=fmt(hi);$('count').textContent=filtered.length+' frentes';let f=$('fill');if(f){f.style.left=((lo-MIN)/(MAX-MIN)*100)+'%';f.style.width=((hi-lo)/(MAX-MIN)*100)+'%'}
 render();renderTable();renderLegend();
}
function step(){
 let span=hi-lo;
 return span>32?5:span>18?2:span>7?1:span>3?.5:span>1?.2:.1
}
function ticks(){let st=step(),out=[];let x=Math.ceil(lo/st-1e-8)*st;for(;x<=hi+1e-8;x+=st)out.push(+x.toFixed(3));return out}
function shade(hex,amt){let n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;if(amt<0){r=Math.round(r*(1+amt/100));g=Math.round(g*(1+amt/100));b=Math.round(b*(1+amt/100))}else{r=Math.round(r+(255-r)*amt/100);g=Math.round(g+(255-g)*amt/100);b=Math.round(b+(255-b)*amt/100)}return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}
function color(r){let type=String(val(r,'TIPO')).trim(),base=COLORS[type]||'#64748b';if(!$('tipo').value)return base;let sols=[...new Set(filtered.map(x=>String(val(x,'SOLUÇÃO')).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));let i=Math.max(0,sols.indexOf(String(val(r,'SOLUÇÃO')).trim()));return shade(base,[-40,-20,0,20,40,60,75][i%7])}
function releaseIntervals(side,a,b){
  return R.filter(x=>String(x.lado).trim().toUpperCase()===side && +x.kf>=a && +x.ki<=b)
    .map(x=>[Math.max(a,+x.ki),Math.min(b,+x.kf),x]).filter(x=>x[1]>x[0]).sort((u,v)=>u[0]-v[0]);
}
function releaseParts(side,a,b){
  const ints=releaseIntervals(side,a,b), out=[]; let cur=a;
  ints.forEach(x=>{
    if(x[0]>cur)out.push({a:cur,b:x[0],released:false});
    if(x[1]>cur)cur=x[1];
  });
  if(cur<b)out.push({a:cur,b,released:false});
  // Merge release intervals for a clean clickable green area.
  let merged=[];
  ints.forEach(x=>{
    if(!merged.length||x[0]>merged[merged.length-1].b+1e-9) merged.push({a:x[0],b:x[1],released:true});
    else merged[merged.length-1].b=Math.max(merged[merged.length-1].b,x[1]);
  });
  return merged.concat(out).filter(x=>x.b>x.a).sort((u,v)=>u.a-v.a);
}
function openReleaseModal(part,side){
  active=null;
  $('modalTitle').textContent=part.released?'Área Liberada':'Área Não Liberada';
  $('details').innerHTML=[
    ['LADO',side],['KM INICIAL',fmt(part.a)],['KM FINAL',fmt(part.b)],['EXTENSÃO',((part.b-part.a)*1000).toFixed(0)+' m'],['SITUAÇÃO',part.released?'LIBERADA':'NÃO LIBERADA']
  ].map(([k,v])=>'<div class="field"><b>'+esc(k)+'</b>'+esc(v)+'</div>').join('');
  $('obs').value=''; $('obs').disabled=true; photoData=null; $('preview').src=''; $('preview').style.display='none'; $('photo').value=''; $('photo').disabled=true; $('save').style.display='none';
  $('modal').classList.add('show');
}
function openItemModal(r){
  active=r; let s=storageGet('frente_'+key(r)); $('modalTitle').textContent=val(r,'IDENTIFICAÇÃO')||'Detalhes';
  let skip=new Set(['_ki','_kf','_row']);
  $('details').innerHTML=Object.entries(r).filter(([k])=>!skip.has(k)).map(([k,v])=>'<div class="field"><b>'+esc(k)+'</b>'+esc(k==='KM INICIAL'?fmt(r._ki):k==='KM FINAL'?fmt(r._kf):displayValue(k,v))+'</div>').join('')+
    '<div class="field"><b>SITUAÇÃO DE LIBERAÇÃO</b><span class="status '+(released(r)?'yes':'partial')+'">'+statusLabel(r)+'</span></div>';
  $('obs').disabled=false;$('photo').disabled=false;$('save').style.display='';$('obs').value=s.obs||val(r,'OBSERVAÇÃO')||'';photoData=s.photo||null;$('preview').src=photoData||'';$('preview').style.display=photoData?'block':'none';$('photo').value='';$('modal').classList.add('show');
}
function drawLane(id,side){
  let lane=$(id); lane.innerHTML='';
  const span=Math.max(hi-lo,.001);
  let laneLabel=document.createElement('div'); laneLabel.className='lane-label'; laneLabel.textContent=side; lane.appendChild(laneLabel);
  const rows=side==='LE'?['CONTENÇÃO','TFA','TERRAPLANAGEM']:['TERRAPLANAGEM','TFA','CONTENÇÃO'];
  const rowH=48;
  const parts=releaseParts(side,lo,hi);
  parts.forEach(part=>{
    let d=document.createElement('button'); d.type='button'; d.className='releaseArea '+(part.released?'released':'partial');
    d.style.left=((part.a-lo)/span*100)+'%'; d.style.width=((part.b-part.a)/span*100)+'%';
    d.title=(part.released?'Área liberada ':'Área não liberada ')+fmt(part.a)+' – '+fmt(part.b);
    d.onclick=e=>{e.stopPropagation();openReleaseModal(part,side)};
    lane.appendChild(d);
  });
  rows.forEach((type,idx)=>{
    let row=document.createElement('div'); row.className='typeRow '+type.toLowerCase().replace('ç','c'); row.style.top=(idx*rowH+8)+'px';
    if(type!=='TERRAPLANAGEM'){
      filtered.filter(r=>String(val(r,'LADO')).trim().toUpperCase()===side&&String(val(r,'TIPO')).trim()===type).forEach(r=>{
        let a=Math.max(lo,+r._ki),b=Math.min(hi,+r._kf); if(b<=a)return;
        let d=document.createElement('button'); d.type='button'; d.className='item typeItem '+(releaseStatus(r)==='released'?'releasedItem':'partialItem');
        d.title=String(val(r,'IDENTIFICAÇÃO'))+' — '+statusLabel(r); d.setAttribute('aria-label',String(val(r,'IDENTIFICAÇÃO'))+' '+statusLabel(r));
        d.style.left=((a-lo)/span*100)+'%'; d.style.width=Math.max((b-a)/span*100,0.35)+'%'; d.style.background=color(r); d.onclick=e=>{e.stopPropagation();openItemModal(r)}; row.appendChild(d);
      });
    }
    lane.appendChild(row);
  });
}
function render(){
 renderTrechoTabs();
 let axis=$('axis');
 axis.querySelectorAll('.tick,.kmRulerItem,.centerItem,.stationMarker').forEach(e=>e.remove());

 let span=Math.max(hi-lo,.001);

 // KM ruler on the central railway axis.
 let ruler=document.createElement('div');
 ruler.className='kmRulerItem';
 ruler.innerHTML='<div class="kmRulerLine"></div>';
 axis.appendChild(ruler);

 ticks().forEach(x=>{
   let t=document.createElement('div');
   t.className='tick kmRulerItem';
   const pos=((x-lo)/span*100);
   t.style.left=pos+'%';
   const align=Math.abs(x-lo)<1e-6?'left':(Math.abs(x-hi)<1e-6?'right':'center');
   t.innerHTML='<span class="tickLabel '+align+'">'+fmt(x)+'</span>';
   axis.appendChild(t);
 });

 // Stations: icon on the axis, with the station name above it.
 STATIONS.filter(s=>s.km>=lo&&s.km<=hi).forEach(s=>{
   let m=document.createElement('div');
   m.className='stationMarker';
   m.style.left=((s.km-lo)/span*100)+'%';
   m.innerHTML='<div class="stationName">'+esc(s.name)+'</div><div class="stationIcon" aria-label="Estação '+esc(s.name)+'">🚉</div>';
   axis.appendChild(m);
 });

 drawLane('laneLE','LE');
 drawLane('laneLD','LD');

 // Items without LE/LD stay on the central axis.
 let arr=filtered.filter(r=>String(val(r,'TIPO')).trim()==='OAE');
 arr.forEach((r,i)=>{
   let a=Math.max(lo,+r._ki),b=Math.min(hi,+r._kf);
   if(b<=a)return;
   let d=document.createElement('button');
   d.type='button';
   d.className='item centerItem';
   d.title=String(val(r,'IDENTIFICAÇÃO'));
   d.setAttribute('aria-label',String(val(r,'IDENTIFICAÇÃO')));
   d.style.left=((a-lo)/span*100)+'%';
   d.style.width=Math.max((b-a)/span*100,0.35)+'%';
   d.style.top='calc(50% - 8px)';
   d.style.background=color(r);
   d.onclick=function(){openModal(r)};
   axis.appendChild(d);
 });
}
function renderLegend(){let box=$('legend'),tp=$('tipo').value;box.innerHTML='';if(!tp){box.innerHTML='<b>Tipos:</b> <span><i class="sw" style="background:#2563eb"></i>OAE</span><span><i class="sw" style="background:#7c3aed"></i>CONTENÇÃO</span><span><i class="sw" style="background:#06b6d4"></i>TFA</span>';return}let sols=[...new Set(filtered.map(r=>String(val(r,'SOLUÇÃO')).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));box.innerHTML='<b>'+esc(tp)+':</b>';sols.forEach((s,i)=>{let sp=document.createElement('span');sp.innerHTML='<i class="sw" style="background:'+shade(COLORS[tp]||'#64748b',[-40,-20,0,20,40,60,75][i%7])+'"></i>'+esc(s);box.appendChild(sp)})}
function renderTable(){
  let tb=$('tbody');tb.innerHTML='';
  if(!filtered.length){tb.innerHTML='<tr><td colspan="12" class="empty">Nenhuma frente encontrada.</td></tr>';return}
  filtered.forEach((r,i)=>{
    let st=storageGet('frente_'+key(r)),obs=st.obs||val(r,'OBSERVAÇÃO'),photo=st.photo||val(r,'FOTO');
    let tr=document.createElement('tr');
    tr.innerHTML='<td>'+(i+1)+'</td><td>'+esc(val(r,'TRECHO'))+'</td><td>'+esc(val(r,'TIPO'))+'</td><td>'+esc(val(r,'SOLUÇÃO'))+'</td><td>'+esc(val(r,'LADO'))+'</td><td>'+esc(val(r,'EXTENSÃO'))+'</td><td>'+fmt(r._ki)+'</td><td>'+fmt(r._kf)+'</td><td>'+esc(val(r,'IDENTIFICAÇÃO'))+'</td><td><span class="status '+(released(r)?'yes':'partial')+'">'+statusLabel(r)+'</span></td><td>'+esc(obs||'')+'</td><td>'+(photo?'📷':'')+'</td>';
    tr.onclick=()=>openModal(r);tb.appendChild(tr);
  });
}
function openModal(r){openItemModal(r)}
document.querySelectorAll('.statusBtn').forEach(btn=>{btn.onclick=function(){statusFilter=this.dataset.status||'';document.querySelectorAll('.statusBtn').forEach(b=>b.classList.remove('active'));this.classList.add('active');apply()}});
function setRange(nlo,nhi){
  const span=Math.max(hi-lo,.001);
  lo=Math.max(MIN,Math.min(nlo,MAX-span));
  hi=Math.min(MAX,Math.max(nhi,MIN+span));
  if(hi<=lo){lo=MIN;hi=MAX}
  $('r1').value=lo;$('r2').value=hi;apply();
}
function zoomAt(clientX,factor){
  const axis=$('axis'); if(!axis)return;
  const rect=axis.getBoundingClientRect();
  const p=Math.max(0,Math.min(1,(clientX-rect.left)/Math.max(rect.width,1)));
  const focal=lo+p*(hi-lo);
  const oldSpan=hi-lo;
  let newSpan=Math.max(.1,Math.min(MAX-MIN,oldSpan/factor));
  newSpan=Math.min(newSpan,MAX-MIN);
  let nlo=focal-p*newSpan, nhi=focal+(1-p)*newSpan;
  if(nlo<MIN){nlo=MIN;nhi=MIN+newSpan}
  if(nhi>MAX){nhi=MAX;nlo=MAX-newSpan}
  setRange(nlo,nhi);
}
function setupZoom(){
  const axis=$('axis'); if(!axis)return;
  axis.addEventListener('wheel',e=>{
    if(e.ctrlKey)return;
    e.preventDefault();
    const factor=e.deltaY<0?1.22:1/1.22;
    zoomAt(e.clientX,factor);
  },{passive:false});
  const pts=new Map(); let pinch=null;
  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const midpoint=(a,b)=>(a.clientX+b.clientX)/2;
  axis.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    pts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pts.size===2){
      const [a,b]=[...pts.values()]; pinch={distance:Math.max(1,distance(a,b)),midX:midpoint(a,b),lo,hi}; axis.classList.add('pinching');
    }
  });
  axis.addEventListener('pointermove',e=>{
    if(e.pointerType!=='touch'||!pts.has(e.pointerId))return;
    pts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pts.size<2||!pinch)return;
    e.preventDefault(); const [a,b]=[...pts.values()]; const d=Math.max(1,distance(a,b)); const factor=d/pinch.distance;
    const rect=axis.getBoundingClientRect(),p=Math.max(0,Math.min(1,(pinch.midX-rect.left)/Math.max(rect.width,1)));
    const focal=pinch.lo+p*(pinch.hi-pinch.lo),newSpan=Math.max(.1,Math.min(MAX-MIN,(pinch.hi-pinch.lo)/factor));
    let nlo=focal-p*newSpan,nhi=focal+(1-p)*newSpan;
    if(nlo<MIN){nlo=MIN;nhi=MIN+newSpan} if(nhi>MAX){nlo=MAX-newSpan;nhi=MAX}
    setRange(nlo,nhi);
  },{passive:false});
  const end=e=>{if(e.pointerType!=='touch')return;pts.delete(e.pointerId);if(pts.size<2){pinch=null;axis.classList.remove('pinching')}};
  axis.addEventListener('pointerup',end);axis.addEventListener('pointercancel',end);axis.addEventListener('pointerleave',end);
}
function setupUX(){
  const modal=$('modal');
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))closeModal()});
}
$('save').onclick=function(){if(!active)return;let s=storageGet('frente_'+key(active));s.obs=$('obs').value;if(photoData)s.photo=photoData;storageSet('frente_'+key(active),s);closeModal();apply()};$('cancel').onclick=closeModal;$('photo').onchange=function(e){let f=e.target.files&&e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{photoData=rd.result;$('preview').src=photoData;$('preview').style.display='block'};rd.readAsDataURL(f)};
$('r1').oninput=function(){let v=+this.value;if(v>=hi-.001){v=hi-.001;this.value=v}lo=v;apply()};$('r2').oninput=function(){let v=+this.value;if(v<=lo+.001){v=lo+.001;this.value=v}hi=v;apply()};$('tipo').onchange=function(){updateSolutions();apply()};$('lado').onchange=apply;$('solucao').onchange=apply;$('clear').onclick=function(){window.ACTIVE_TRECHO='';$('tipo').value='';$('lado').value='';$('solucao').value='';statusFilter='';document.querySelectorAll('.statusBtn').forEach(b=>b.classList.toggle('active',!b.dataset.status));lo=MIN;hi=MAX;$('r1').value=lo;$('r2').value=hi;updateSolutions();apply()};setupZoom();setupUX();
function init(){if(!D.length){$('appError').textContent='Dados não carregados.';return}$('r1').value=lo;$('r2').value=hi;fillFilters();apply();}
window.addEventListener('load',init);
})();
