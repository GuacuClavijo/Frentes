(function(){
'use strict';
const D=(window.APP_DATA&&window.APP_DATA.data)||[];
const R=(window.APP_DATA&&window.APP_DATA.releases)||[];
const COLORS={OAE:'#2563eb','CONTENÇÃO':'#7c3aed',TFA:'#06b6d4'};
const MIN=62,MAX=105;
const STATIONS=[
  {name:'JUNDIAÍ',km:60.500},
  {name:'LOUVEIRA',km:76.000},
  {name:'VINHEDO',km:83.500},
  {name:'VALINHOS',km:91.300},
  {name:'CAMPINAS',km:104.600}
];
let lo=MIN,hi=MAX,filtered=D.slice(),active=null,photoData=null,statusFilter='',panEnabled=false,panStartX=0,panStartLo=62,panStartHi=105;
window.ACTIVE_TRECHO='';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function fmt(x){let n=Number(x);if(!Number.isFinite(n))return '-';let k=Math.round(n*1000);let km=Math.floor(k/1000),m=k%1000;return km+'+'+String(m).padStart(3,'0')}
function val(r,k){return r[k]??''}
function storageGet(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(e){return {}}}
function storageSet(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true}catch(e){return false}}
function key(r){return String(r._row||r['IDENTIFICAÇÃO']||'x').replace(/[^a-z0-9_-]/gi,'_')}
function released(r){let side=String(val(r,'LADO')).trim().toUpperCase();return R.some(x=>{let overlap=x.kf>=+r._ki&&x.ki<=+r._kf;return overlap&&((side==='LE'||side==='LD')?x.lado===side:true)})}
function fillSelect(id,arr){let el=$(id);el.innerHTML='<option value="">Todos</option>'+arr.map(x=>'<option>'+esc(x)+'</option>').join('')}
function fillFilters(){
 const uniq=k=>[...new Set(D.map(r=>String(val(r,k)).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 fillSelect('tipo',uniq('TIPO'));fillSelect('lado',uniq('LADO'));updateSolutions();renderTrechoTabs();
}
function renderTrechoTabs(){
  const box=$('trechoTabs');
  if(!box)return;
  const tabs=[
    {key:'A',label:'3A',lo:62,hi:76},
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
 filtered=D.filter(r=>Number.isFinite(+r._ki)&&Number.isFinite(+r._kf)&&+r._kf>=lo&&+r._ki<=hi&&(!tr||String(val(r,'TRECHO')).trim()===tr)&&(!tp||String(val(r,'TIPO')).trim()===tp)&&(!ld||String(val(r,'LADO')).trim()===ld)&&(!so||String(val(r,'SOLUÇÃO')).trim()===so)&&(!statusFilter||(statusFilter==='released'?released(r):!released(r))));
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
function drawLane(id,side){
 let lane=$(id); lane.innerHTML='';
 let span=Math.max(hi-lo,.001);
 let laneLabel=document.createElement('div'); laneLabel.className='lane-label'; laneLabel.textContent=side; lane.appendChild(laneLabel);
 const types=['CONTENÇÃO','TFA'];
 types.forEach((type,ti)=>{
   let row=document.createElement('div'); row.className='typeRow '+type.toLowerCase().replace('ç','c');
   row.style.top=(ti*48+30)+'px';
   let bg=document.createElement('div'); bg.className='releaseBand'; row.appendChild(bg);
   R.filter(x=>String(x.lado).trim().toUpperCase()===side&&x.kf>=lo&&x.ki<=hi).forEach(x=>{
     let a=Math.max(lo,+x.ki),b=Math.min(hi,+x.kf); if(b<=a)return;
     let d=document.createElement('div'); d.className='releaseSegment'; d.style.left=((a-lo)/span*100)+'%'; d.style.width=((b-a)/span*100)+'%'; bg.appendChild(d);
   });
   filtered.filter(r=>String(val(r,'LADO')).trim().toUpperCase()===side&&String(val(r,'TIPO')).trim()===type).forEach(r=>{
     let a=Math.max(lo,+r._ki),b=Math.min(hi,+r._kf); if(b<=a)return;
     let d=document.createElement('button'); d.type='button'; d.className='item typeItem'; d.title=String(val(r,'IDENTIFICAÇÃO')); d.setAttribute('aria-label',String(val(r,'IDENTIFICAÇÃO')));
     d.style.left=((a-lo)/span*100)+'%'; d.style.width=Math.max((b-a)/span*100,0.35)+'%'; d.style.background=color(r); d.onclick=()=>openModal(r); row.appendChild(d);
   });
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
   t.style.left=((x-lo)/span*100)+'%';
   t.innerHTML='<span>'+fmt(x)+'</span>';
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
function renderTable(){let tb=$('tbody');tb.innerHTML='';if(!filtered.length){tb.innerHTML='<tr><td colspan="12" class="empty">Nenhuma frente encontrada.</td></tr>';return}filtered.forEach(r=>{let s=storageGet('frente_'+key(r)),obs=s.obs||val(r,'OBSERVAÇÃO'),photo=s.photo||val(r,'FOTO');let tr=document.createElement('tr');tr.innerHTML='<td>'+(filtered.indexOf(r)+1)+'</td><td>'+esc(val(r,'TRECHO'))+'</td><td>'+esc(val(r,'TIPO'))+'</td><td>'+esc(val(r,'SOLUÇÃO'))+'</td><td>'+esc(val(r,'LADO'))+'</td><td>'+esc(val(r,'EXTENSÃO'))+'</td><td>'+fmt(r._ki)+'</td><td>'+fmt(r._kf)+'</td><td>'+esc(val(r,'IDENTIFICAÇÃO'))+'</td><td><span class="status '+(released(r)?'yes':'no')+'">'+(released(r)?'LIBERADA':'NÃO LIBERADA')+'</span></td><td>'+esc(obs||'')+'</td><td>'+(photo?'📷':'')+'</td>';tr.onclick=()=>openModal(r);tb.appendChild(tr)})}
function openModal(r){active=r;let s=storageGet('frente_'+key(r));$('modalTitle').textContent=val(r,'IDENTIFICAÇÃO')||'Detalhes';let skip=new Set(['_ki','_kf','_row']);$('details').innerHTML=Object.entries(r).filter(([k])=>!skip.has(k)).map(([k,v])=>'<div class="field"><b>'+esc(k)+'</b>'+esc(k==='KM INICIAL'?fmt(r._ki):k==='KM FINAL'?fmt(r._kf):v)+'</div>').join('');$('obs').value=s.obs||val(r,'OBSERVAÇÃO')||'';photoData=s.photo||null;$('preview').src=photoData||'';$('preview').style.display=photoData?'block':'none';$('photo').value='';$('modal').classList.add('show')}
function closeModal(){$('modal').classList.remove('show');active=null}
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
function setupPan(){
  const btn=$('panToggle'), axis=$('axis');
  if(!btn||!axis)return;
  const setState=()=>{
    btn.classList.toggle('active',panEnabled);
    btn.setAttribute('aria-pressed',String(panEnabled));
    btn.title=panEnabled?'Desativar pan':'Ativar pan';
    axis.classList.toggle('panEnabled',panEnabled);
  };
  btn.onclick=()=>{panEnabled=!panEnabled;setState()};
  axis.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch') return;
    if(!panEnabled)return;
    if(e.target.closest('button,.trechoTab,.stationMarker'))return;
    axis.setPointerCapture?.(e.pointerId);
    panStartX=e.clientX;panStartLo=lo;panStartHi=hi;
  });
  axis.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    if(!panEnabled || !axis.hasPointerCapture?.(e.pointerId))return;
    const rect=axis.getBoundingClientRect();
    const delta=(e.clientX-panStartX)/Math.max(rect.width,1);
    const span=panStartHi-panStartLo;
    let nlo=panStartLo-delta*span, nhi=panStartHi-delta*span;
    if(nlo<MIN){nhi+=MIN-nlo;nlo=MIN}
    if(nhi>MAX){nlo-=nhi-MAX;nhi=MAX}
    setRange(nlo,nhi);
  });
  const end=e=>{try{axis.releasePointerCapture?.(e.pointerId)}catch(_){} };
  axis.addEventListener('pointerup',end);axis.addEventListener('pointercancel',end);
  // Mouse wheel: zoom around the pointer position.
  axis.addEventListener('wheel',e=>{
    if(e.ctrlKey)return;
    e.preventDefault();
    const factor=e.deltaY<0?1.18:1/1.18;
    zoomAt(e.clientX,factor);
  },{passive:false});
  // Touch pinch: midpoint between fingers is the zoom focal point.
  const pts=new Map(); let pinch=null;
  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const midpoint=(a,b)=>(a.clientX+b.clientX)/2;
  axis.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    pts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pts.size===2){
      const a=[...pts.values()][0],b=[...pts.values()][1];
      pinch={distance:Math.max(1,distance(a,b)),midX:midpoint(a,b),lo,hi};
      axis.classList.add('pinching');
    }
  });
  axis.addEventListener('pointermove',e=>{
    if(e.pointerType!=='touch'||!pts.has(e.pointerId))return;
    pts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pts.size<2||!pinch)return;
    e.preventDefault();
    const vals=[...pts.values()];
    const d=Math.max(1,distance(vals[0],vals[1]));
    const factor=d/pinch.distance;
    const rect=axis.getBoundingClientRect();
    const p=Math.max(0,Math.min(1,(pinch.midX-rect.left)/Math.max(rect.width,1)));
    const focal=pinch.lo+p*(pinch.hi-pinch.lo);
    const newSpan=Math.max(.1,Math.min(MAX-MIN,(pinch.hi-pinch.lo)/factor));
    let nlo=focal-p*newSpan,nhi=focal+(1-p)*newSpan;
    if(nlo<MIN){nlo=MIN;nhi=MIN+newSpan}
    if(nhi>MAX){nhi=MAX;nlo=MAX-newSpan}
    setRange(nlo,nhi);
  },{passive:false});
  const touchEnd=e=>{
    if(e.pointerType!=='touch')return;
    pts.delete(e.pointerId);
    if(pts.size<2){pinch=null;axis.classList.remove('pinching')}
  };
  axis.addEventListener('pointerup',touchEnd);axis.addEventListener('pointercancel',touchEnd);
  setState();
}
function setupFullscreen(){
  const btn=$('fullscreenBtn'), card=document.querySelector('.graphCard');
  if(!btn||!card)return;
  btn.onclick=async()=>{
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(card.requestFullscreen) await card.requestFullscreen();
    }catch(_){}
  };
  document.addEventListener('fullscreenchange',()=>{
    btn.textContent=document.fullscreenElement?'✕':'⛶';
    btn.title=document.fullscreenElement?'Sair da tela cheia':'Tela cheia';
  });
}
function setupUX(){
  const modal=$('modal');
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))closeModal()});
  let ticking=false;
  window.addEventListener('scroll',()=>{
    if(ticking)return;
    ticking=true;requestAnimationFrame(()=>{
      document.body.classList.toggle('headerCompact',window.scrollY>36);
      ticking=false;
    });
  },{passive:true});
}
$('save').onclick=function(){if(!active)return;let s=storageGet('frente_'+key(active));s.obs=$('obs').value;if(photoData)s.photo=photoData;storageSet('frente_'+key(active),s);closeModal();apply()};$('cancel').onclick=closeModal;$('photo').onchange=function(e){let f=e.target.files&&e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{photoData=rd.result;$('preview').src=photoData;$('preview').style.display='block'};rd.readAsDataURL(f)};
$('r1').oninput=function(){let v=+this.value;if(v>=hi-.001){v=hi-.001;this.value=v}lo=v;apply()};$('r2').oninput=function(){let v=+this.value;if(v<=lo+.001){v=lo+.001;this.value=v}hi=v;apply()};$('tipo').onchange=function(){updateSolutions();apply()};$('lado').onchange=apply;$('solucao').onchange=apply;$('clear').onclick=function(){window.ACTIVE_TRECHO='';$('tipo').value='';$('lado').value='';$('solucao').value='';statusFilter='';document.querySelectorAll('.statusBtn').forEach(b=>b.classList.toggle('active',!b.dataset.status));lo=MIN;hi=MAX;$('r1').value=lo;$('r2').value=hi;updateSolutions();apply()};setupPan();setupFullscreen();setupUX();
function init(){if(!D.length){$('appError').textContent='Dados não carregados.';return}$('r1').value=lo;$('r2').value=hi;fillFilters();apply();}
window.addEventListener('load',init);
})();
