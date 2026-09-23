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
let lo=MIN,hi=MAX,filtered=D.slice(),active=null,photoData=null,statusFilters=new Set();
window.ACTIVE_TRECHO='';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function fmt(x){let n=Number(x);if(!Number.isFinite(n))return '-';let k=Math.round(n*1000);let km=Math.floor(k/1000),m=k%1000;return km+'+'+String(m).padStart(3,'0')}
function val(r,k){return r[k]??''}
function displayValue(k,v){if(String(k).toUpperCase().includes('ALTURA')){const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n.toFixed(2):String(v??'')}return String(v??'')}
function storageGet(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(e){return {}}}
function storageSet(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true}catch(e){return false}}
function key(r){return String(r._row||r['IDENTIFICAÇÃO']||'x').replace(/[^a-z0-9_-]/gi,'_')}
const releaseIndex={LE:[],LD:[]};
R.forEach(x=>{const side=String(x.lado??'').trim().toUpperCase(),a=+x.ki,b=+x.kf;if((side==='LE'||side==='LD')&&Number.isFinite(a)&&Number.isFinite(b)&&b>a)releaseIndex[side].push([a,b,x])});
Object.keys(releaseIndex).forEach(side=>releaseIndex[side].sort((a,b)=>a[0]-b[0]));
const statusCache=new Map();
function releaseStatus(r){
  const a=+r._ki,b=+r._kf,side=String(val(r,'LADO')).trim().toUpperCase();
  const cacheKey=String(r._row||r['IDENTIFICAÇÃO']||'')+'|'+side+'|'+a+'|'+b;
  if(statusCache.has(cacheKey))return statusCache.get(cacheKey);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){statusCache.set(cacheKey,'unreleased');return 'unreleased'}
  const intervals=releaseIndex[side]||[];
  let covered=0,cur=a,found=false;
  for(const x of intervals){
    if(x[1]<=cur)continue;
    if(x[0]>b)break;
    const ia=Math.max(a,x[0]),ib=Math.min(b,x[1]);
    if(ib<=ia)continue;
    found=true;
    if(ia>cur)break;
    cur=Math.max(cur,ib);
    if(cur>=b){covered=b-a;break;}
  }
  const st=!found?'unreleased':(covered>=(b-a)-1e-6?'released':'partial');
  statusCache.set(cacheKey,st);
  return st;
}
function released(r){return releaseStatus(r)==='released'}
function statusLabel(r){const s=releaseStatus(r);return s==='released'?'LIBERADA':s==='partial'?'PARCIAL':'NÃO LIBERADA'}
function fillSelect(id,arr){let el=$(id);el.innerHTML=arr.map(x=>'<option>'+esc(x)+'</option>').join('')}
function buildCustomMulti(id){
  const sel=$(id); if(!sel)return;
  const old=sel.parentElement.querySelector('.customMulti'); if(old)old.remove();
  sel.style.display='none';
  const wrap=document.createElement('div'); wrap.className='customMulti'; wrap.dataset.for=id;
  const btn=document.createElement('button'); btn.type='button'; btn.className='multiTrigger';
  const label=id==='tipo'?'Tipo':id==='solucao'?'Solução':'Lado';
  btn.innerHTML='<span class="multiText">'+label+'</span><span class="multiCount"></span><span class="multiChevron">⌄</span>';
  const panel=document.createElement('div'); panel.className='multiPanel';
  const head=document.createElement('div'); head.className='multiPanelHead'; head.innerHTML='<span>Selecionar</span><button type="button" class="multiClear">Limpar</button>'; panel.appendChild(head);
  const list=document.createElement('div'); list.className='multiList';
  [...sel.options].forEach((o,i)=>{
    const lab=document.createElement('label'); lab.className='multiOption';
    lab.innerHTML='<input type="checkbox" data-index="'+i+'" '+(o.selected?'checked':'')+'><span>'+esc(o.textContent)+'</span>';
    lab.querySelector('input').addEventListener('change',()=>{
      [...sel.options].forEach((opt,j)=>opt.selected=!!list.querySelector('input[data-index="'+j+'"]').checked);
      updateMultiTrigger(wrap,sel,label); sel.dispatchEvent(new Event('change',{bubbles:true}));
    });
    list.appendChild(lab);
  });
  panel.appendChild(list); wrap.appendChild(btn); wrap.appendChild(panel); sel.parentElement.appendChild(wrap);
  btn.onclick=()=>{document.querySelectorAll('.customMulti.open').forEach(x=>{if(x!==wrap)x.classList.remove('open')});wrap.classList.toggle('open')};
  head.querySelector('.multiClear').onclick=()=>{[...sel.options].forEach(o=>o.selected=false);list.querySelectorAll('input').forEach(x=>x.checked=false);updateMultiTrigger(wrap,sel,label);sel.dispatchEvent(new Event('change',{bubbles:true}))};
  updateMultiTrigger(wrap,sel,label);
}
function updateMultiTrigger(wrap,sel,label){
  const vals=[...sel.selectedOptions].map(o=>o.textContent.trim());
  const text=wrap.querySelector('.multiText'),count=wrap.querySelector('.multiCount');
  text.textContent=vals.length?(vals.length===1?vals[0]:label):label;
  count.textContent=vals.length>1?vals.length+' selecionados':vals.length===1?'1':'';
}
function rebuildCustom(id){const sel=$(id);if(sel&&sel.parentElement.querySelector('.customMulti'))buildCustomMulti(id)}
document.addEventListener('click',e=>{if(!e.target.closest('.customMulti'))document.querySelectorAll('.customMulti.open').forEach(x=>x.classList.remove('open'))});
function fillFilters(){
 const uniq=k=>[...new Set(D.map(r=>String(val(r,k)).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 fillSelect('tipo',uniq('TIPO'));fillSelect('lado',uniq('LADO'));updateSolutions();buildCustomMulti('tipo');buildCustomMulti('solucao');buildCustomMulti('lado');renderTrechoTabs();
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
      window.ACTIVE_TRECHO=window.ACTIVE_TRECHO===t.key?'':t.key;
      const selected=tabs.find(x=>x.key===window.ACTIVE_TRECHO);
      if(selected){lo=selected.lo; hi=selected.hi}else{lo=MIN;hi=MAX;}
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

function updateSolutions(){const types=[...$('tipo').selectedOptions].map(o=>o.value);const old=[...$('solucao').selectedOptions].map(o=>o.value);let arr=D.filter(r=>!types.length||types.includes(String(val(r,'TIPO')).trim())).map(r=>String(val(r,'SOLUÇÃO')).trim()).filter(x=>x&&x!=='-');arr=[...new Set(arr)].sort((a,b)=>a.localeCompare(b,'pt-BR'));fillSelect('solucao',arr);[...$('solucao').options].forEach(o=>o.selected=old.includes(o.value));if($('solucao').parentElement.querySelector('.customMulti'))buildCustomMulti('solucao');}
function apply(){
 const tr=window.ACTIVE_TRECHO||'',types=[...$('tipo').selectedOptions].map(o=>o.value),sides=[...$('lado').selectedOptions].map(o=>o.value),sols=[...$('solucao').selectedOptions].map(o=>o.value);
 filtered=D.filter(r=>Number.isFinite(+r._ki)&&Number.isFinite(+r._kf)&&+r._kf>=lo&&+r._ki<=hi&&(!tr||String(val(r,'TRECHO')).trim()===tr)&&(!types.length||types.includes(String(val(r,'TIPO')).trim()))&&(!sides.length||sides.includes(String(val(r,'LADO')).trim()))&&(!sols.length||sols.includes(String(val(r,'SOLUÇÃO')).trim()))&&(!statusFilters.size||statusFilters.has(releaseStatus(r))));
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
  return (releaseIndex[side]||[]).filter(x=>x[1]>=a&&x[0]<=b)
    .map(x=>[Math.max(a,x[0]),Math.min(b,x[1]),x[2]]).filter(x=>x[1]>x[0]);
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
    '<div class="field"><b>SITUAÇÃO DE LIBERAÇÃO</b><span class="status '+(releaseStatus(r)==='released'?'yes':releaseStatus(r)==='partial'?'partial':'no')+'">'+statusLabel(r)+'</span></div>';
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
    // The release hit area is placed only over the actual graphical bands;
    // the white spaces of the lane remain non-selectable.
    [8,56,104].forEach(top=>{
      let d=document.createElement('button'); d.type='button'; d.className='releaseArea '+(part.released?'released':'partial');
      d.style.left=((part.a-lo)/span*100)+'%'; d.style.width=((part.b-part.a)/span*100)+'%';
      d.style.top=top+'px'; d.style.height='40px';
      d.title=(part.released?'Área liberada ':'Área não liberada ')+fmt(part.a)+' – '+fmt(part.b);
      d.onclick=e=>{e.stopPropagation();openReleaseModal(part,side)};
      lane.appendChild(d);
    });
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
   d.onclick=e=>{e.stopPropagation();openItemModal(r)};
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
    tr.innerHTML='<td>'+(i+1)+'</td><td>'+esc(val(r,'TRECHO'))+'</td><td>'+esc(val(r,'TIPO'))+'</td><td>'+esc(val(r,'SOLUÇÃO'))+'</td><td>'+esc(val(r,'LADO'))+'</td><td>'+esc(val(r,'EXTENSÃO'))+'</td><td>'+fmt(r._ki)+'</td><td>'+fmt(r._kf)+'</td><td>'+esc(val(r,'IDENTIFICAÇÃO'))+'</td><td><span class="status '+(releaseStatus(r)==='released'?'yes':releaseStatus(r)==='partial'?'partial':'no')+'">'+statusLabel(r)+'</span></td><td>'+esc(obs||'')+'</td><td>'+(photo?'📷':'')+'</td>';
    tr.onclick=()=>openModal(r);tb.appendChild(tr);
  });
}
function openModal(r){openItemModal(r)}
document.querySelectorAll('.statusBtn').forEach(btn=>{btn.onclick=function(){const st=this.dataset.status||'';if(!st){statusFilters.clear();document.querySelectorAll('.statusBtn').forEach(b=>b.classList.remove('active'));this.classList.add('active')}else{statusFilters.delete('');if(statusFilters.has(st)){statusFilters.delete(st);this.classList.remove('active')}else{statusFilters.add(st);this.classList.add('active')}const active=[...statusFilters];document.querySelector('.statusBtn[data-status=\"\"]')?.classList.toggle('active',active.length===0)}apply()}});
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
  const surface=axis.closest('.axiswrap')||axis;
  const inGraph=e=>surface.contains(e.target);
  const onWheel=e=>{
    if(!inGraph(e) || e.ctrlKey)return;
    e.preventDefault();
    zoomAt(e.clientX,e.deltaY<0?1.22:1/1.22);
  };
  // Zoom is independent of filters and never uses the mouse drag/pan interaction.
  surface.addEventListener('wheel',onWheel,{passive:false});
  let pinch=null;
  const pts=new Map();
  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const midX=(a,b)=>(a.clientX+b.clientX)/2;
  axis.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    pts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pts.size===2){
      const [a,b]=[...pts.values()];
      pinch={distance:Math.max(1,distance(a,b)),midX:midX(a,b),lo,hi};
      axis.classList.add('pinching');
    }
  });
  axis.addEventListener('pointermove',e=>{
    if(e.pointerType!=='touch'||!pts.has(e.pointerId)||!pinch)return;
    pts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pts.size<2)return;
    e.preventDefault();
    const [a,b]=[...pts.values()];
    const d=Math.max(1,distance(a,b));
    const factor=d/pinch.distance;
    const rect=axis.getBoundingClientRect();
    const p=Math.max(0,Math.min(1,(pinch.midX-rect.left)/Math.max(rect.width,1)));
    const oldSpan=pinch.hi-pinch.lo;
    const newSpan=Math.max(.1,Math.min(MAX-MIN,oldSpan/factor));
    const focal=pinch.lo+p*oldSpan;
    let nlo=focal-p*newSpan,nhi=focal+(1-p)*newSpan;
    if(nlo<MIN){nlo=MIN;nhi=MIN+newSpan}
    if(nhi>MAX){nhi=MAX;nlo=MAX-newSpan}
    setRange(nlo,nhi);
  },{passive:false});
  const end=e=>{
    if(e.pointerType!=='touch')return;
    pts.delete(e.pointerId);
    if(pts.size<2){pinch=null;axis.classList.remove('pinching')}
  };
  axis.addEventListener('pointerup',end);
  axis.addEventListener('pointercancel',end);
}

function closeModal(){
  const modal=$('modal');
  if(!modal)return;
  modal.classList.remove('show');
  active=null;
  photoData=null;
  $('obs').value='';
  $('photo').value='';
  $('preview').src='';
  $('preview').style.display='none';
}
function setupUX(){
  const modal=$('modal');
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))closeModal()});
  let lastY=window.scrollY||0;
  const syncHeader=()=>{const y=window.scrollY||0; document.body.classList.toggle('headerCompact',y>50); lastY=y;};
  window.addEventListener('scroll',syncHeader,{passive:true});
  syncHeader();
}
$('save').onclick=function(){if(!active)return;let s=storageGet('frente_'+key(active));s.obs=$('obs').value;if(photoData)s.photo=photoData;storageSet('frente_'+key(active),s);closeModal();apply()};$('cancel').onclick=closeModal;$('photo').onchange=function(e){let f=e.target.files&&e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{photoData=rd.result;$('preview').src=photoData;$('preview').style.display='block'};rd.readAsDataURL(f)};
$('r1').oninput=function(){let v=+this.value;if(v>=hi-.001){v=hi-.001;this.value=v}lo=v;apply()};$('r2').oninput=function(){let v=+this.value;if(v<=lo+.001){v=lo+.001;this.value=v}hi=v;apply()};$('tipo').onchange=function(){updateSolutions();apply()};$('lado').onchange=apply;$('solucao').onchange=apply;$('clear').onclick=function(){window.ACTIVE_TRECHO='';[...$('tipo').options].forEach(o=>o.selected=false);[...$('lado').options].forEach(o=>o.selected=false);[...$('solucao').options].forEach(o=>o.selected=false);statusFilters.clear();document.querySelectorAll('.statusBtn').forEach(b=>b.classList.remove('active'));document.querySelector('.statusBtn[data-status=\"\"]')?.classList.add('active');lo=MIN;hi=MAX;$('r1').value=lo;$('r2').value=hi;updateSolutions();rebuildCustom('tipo');rebuildCustom('lado');rebuildCustom('solucao');apply()};setupZoom();setupUX();
function init(){if(!D.length){$('appError').textContent='Dados não carregados.';return}$('r1').value=lo;$('r2').value=hi;fillFilters();apply();}
window.addEventListener('load',init);
})();
window.DASHBOARD_VERSION='V24';

