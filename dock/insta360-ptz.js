'use strict';
(() => {
const $=id=>document.getElementById(id), C=PTZ, I=PTZ_I18N, t=I.t;
let socket=null, epoch=0, identified=false, binding=null, seq=0;
let current={pan:0,tilt:0,roll:0,fov:90}, dirty=false, writing=false, animation=null, dragging=null;
let lastEdit=0, editRevision=0, syncing=false, screenshotBusy=false, connectTimer=null;
const pending=new Map();
const maxPresets=100;
const emptyPresets=()=>Array.from({length:6},(_,i)=>({id:`legacy-${i+1}`,name:t('viewName',{n:i+1}),pose:null}));
let presets=emptyPresets(), mouseEnabled=false;
let homeView={lens:'inner',fov:90};
let compact=false;
let config={host:'127.0.0.1',port:4455,scene:'PTZ - Demo 16x9',filter:'PTZ - Perspective 16x9'};
const ranges={pan:[-180,180],tilt:[-90,90],roll:[-180,180],fov:[10,150]};
function notice(text){$('notice').textContent=text;}
function error(text){$('error').textContent=text==='PTZ_INVALID_POSE'?t('invalidPose'):text;}
function status(text,kind=''){$('status').textContent=text;$('status').dataset.kind=kind;$('compactConnection').dataset.kind=kind;$('compactConnection').title=text;$('compactConnection').setAttribute('aria-label',text);}
function storageGet(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}
function storageSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{notice(t('storageFailed'));return false;}}
const presetKey=()=>`obs-insta360-reframe-ptz-presets-v1:${JSON.stringify([config.host,config.port,binding?.collection,config.scene,config.filter])}`;
const homeKey=()=>presetKey().replace('presets-v1:','home-v1:');
function checkedHome(value){
 if(!value||!['inner','outer'].includes(value.lens)||typeof value.fov!=='number'||!Number.isFinite(value.fov)||value.fov<10||value.fov>150)throw Error(t('invalidHome'));
 return {lens:value.lens,fov:value.fov};
}
function drawHome(){$('homeLens').value=homeView.lens;$('homeFov').value=homeView.fov;}
function loadHome(){homeView={lens:'inner',fov:90};const value=storageGet(homeKey());if(value){try{homeView=checkedHome(value);}catch{notice(t('invalidHome'));}}drawHome();}
function updateHome(){
 if(!binding)return;const value={lens:$('homeLens').value,fov:Number($('homeFov').value)};
 try{const next=checkedHome(value);if(storageSet(homeKey(),next)){homeView=next;notice(t('homeSaved'));}else drawHome();}catch(e){error(e.message);drawHome();}
}
function checkedPresets(data){
  if(!Array.isArray(data)||data.length>maxPresets)throw Error(t('presetCount'));
  const ids=new Set();
  return data.map((p,i)=>{
   if(!p||typeof p!=='object')throw Error(t('invalidPresets'));
   let id=p.id;
   if(id===undefined){id=`legacy-${i+1}`;while(ids.has(id)||data.some(item=>item?.id===id))id+='-';}
   if(typeof id!=='string'||!id||id.length>80||ids.has(id))throw Error(t('invalidPresets'));
   ids.add(id);return {id,name:typeof p.name==='string'?p.name.slice(0,40):t('viewName',{n:i+1}),pose:p.pose===null?null:C.pose(p.pose)};
  });
}
function loadPresets(){
 const p=storageGet(presetKey()), seed=globalThis.PTZ_MIGRATION;
 presets=emptyPresets();
 if(p){try{presets=checkedPresets(p);}catch{notice(t('invalidPresets'));}}
 else if(seed&&seed.collection===binding.collection&&seed.scene===binding.scene&&seed.filter===binding.filter){
  try{presets=checkedPresets(seed.presets);storageSet(presetKey(),presets);}catch{notice(t('invalidPresets'));}
 }
 renderPresets();
}
function renderPresets(){
 renderCompactPresets();
 $('presets').replaceChildren();
 $('addPreset').disabled=presets.length>=maxPresets;
 presets.forEach((p,i)=>{
  const card=document.createElement('div');card.className='preset';
  const name=document.createElement('input');name.value=p.name;name.maxLength=40;name.setAttribute('aria-label',t('viewAria',{n:i+1}));
  name.onchange=()=>{presets[i].name=name.value.trim()||t('viewName',{n:i+1});storageSet(presetKey(),presets);};
  const recall=document.createElement('button');recall.textContent=p.pose?t('recall'):t('empty');recall.disabled=!p.pose;recall.onclick=()=>fly(presets[i].pose);
  const save=document.createElement('button');save.textContent=t('save');save.className='save';save.onclick=async()=>{
   if(!binding)return;
   stopMotion();
   const savedBinding=binding;
   try{await flushWrites();if(!await syncFromOBS(true)||binding!==savedBinding)return;const slot=presets.find(item=>item.id===p.id);if(!slot)return;const next=presets.map(item=>item.id===p.id?{...item,pose:{...current}}:item);if(!storageSet(presetKey(),next))return;presets=next;renderPresets();notice(t('saved',{name:slot.name}));}catch(e){fail(e);}
  };
  const clear=document.createElement('button');clear.type='button';clear.className='clear';clear.textContent='↺';clear.disabled=!p.pose;
  clear.title=t('clearView',{name:p.name});clear.setAttribute('aria-label',t('clearView',{name:p.name}));
  clear.onclick=()=>{
   if(!binding||!presets[i].pose)return;
   if(!window.confirm(t('clearConfirm',{name:presets[i].name})))return;
   const next=presets.map((item,j)=>j===i?{...item,pose:null}:item);
   if(!storageSet(presetKey(),next))return;
   presets=next;renderPresets();notice(t('viewCleared',{name:presets[i].name}));
  };
  const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='\uD83D\uDDD1';
  remove.title=t('deleteSlot',{name:p.name});remove.setAttribute('aria-label',t('deleteSlot',{name:p.name}));
  remove.onclick=()=>{
   if(!binding)return;
   if(p.pose&&!window.confirm(t('deleteConfirm',{name:p.name})))return;
   const next=presets.filter(item=>item.id!==p.id);
   if(!storageSet(presetKey(),next))return;
   presets=next;renderPresets();notice(t('slotDeleted',{name:p.name}));
  };
  card.append(name,recall,save,clear,remove);$('presets').append(card);
 });
}
function renderCompactPresets(){
 $('compactPresets').replaceChildren();
 presets.forEach((p,i)=>{
  if(!binding||!p.pose)return;
  const button=document.createElement('button');button.type='button';button.textContent=t('compactPosition',{n:i+1});
  button.title=p.name;button.setAttribute('aria-label',t('compactRecall',{n:i+1,name:p.name}));
  button.onclick=()=>{const slot=presets.find(item=>item.id===p.id);if(slot?.pose)fly(slot.pose);};
  $('compactPresets').append(button);
 });
 $('compactEmpty').hidden=!!binding&&presets.some(p=>p.pose);
 $('compactEmpty').textContent=t(binding?'compactNoPresets':'compactConnect');
 $('compactStop').disabled=!binding;
}
function setCompact(value,persist=true){
 compact=!!value;endDrag();mouseEnabled=false;drawMouseControl();
 document.documentElement.dataset.compact=String(compact);
 $('fullPanel').hidden=compact;$('compactBar').hidden=!compact;
 if(persist)storageSet('obs-insta360-reframe-ptz-ui-v1',{compact});
 renderCompactPresets();window.scrollTo?.(0,0);
 if(!compact&&binding)preview();
}
function drawValues(){for(const k of C.keys){const v=current[k].toFixed(1);if(document.activeElement!==$(`${k}Number`))$(`${k}Number`).value=v;if(document.activeElement!==$(`${k}Range`))$(`${k}Range`).value=v;}}
for(const k of C.keys){
 const row=document.createElement('div');row.className='parameter';
 const label=document.createElement('label');label.id=`${k}Label`;label.htmlFor=`${k}Range`;label.textContent=t(k);
 const range=document.createElement('input');range.type='range';range.id=`${k}Range`;range.min=ranges[k][0];range.max=ranges[k][1];range.step=.1;
 const num=document.createElement('input');num.type='number';num.id=`${k}Number`;num.min=range.min;num.max=range.max;num.step=.1;num.setAttribute('aria-label',t('degrees',{label:label.textContent}));
 for(const input of [range,num])input.addEventListener('input',()=>{const v=Number(input.value);if(input.value===''||!Number.isFinite(v))return;manual({...current,[k]:C.clamp(v,...ranges[k])});});
 num.onchange=drawValues;row.append(label,range,num);$('sliders').append(row);
}
drawValues();renderPresets();
function stopMotion(){animation=null;}
function manual(p){if(!binding)return;stopMotion();current=C.pose(p);dirty=true;editRevision++;lastEdit=performance.now();drawValues();}
function fly(target){
 if(!binding)return;stopMotion();dragging=null;
 const seconds=C.clamp(Number($('duration').value)||0,0,10);
 if(!seconds){manual(target);return;}
 animation={from:{...current},to:C.pose(target),start:performance.now(),ms:seconds*1000};notice(t('flight'));
}
function tickAnimation(now){if(animation&&binding){const progress=(now-animation.start)/animation.ms;current=C.blend(animation.from,animation.to,progress);dirty=true;editRevision++;lastEdit=now;drawValues();if(progress>=1){animation=null;notice(t('reached'));}}requestAnimationFrame(tickAnimation);}
requestAnimationFrame(tickAnimation);
function rpc(type,data={}){
 if(!identified||!socket||socket.readyState!==WebSocket.OPEN)return Promise.reject(Error(t('noConnection')));
 const requestId=`ptz-${++seq}`;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(requestId);reject(Error(t('timeout',{type})));},5000);
  pending.set(requestId,{resolve,reject,timer});
  try{socket.send(JSON.stringify({op:6,d:{requestType:type,requestId,requestData:data}}));}catch(e){clearTimeout(timer);pending.delete(requestId);reject(e);}
 });
}
function target(){if(!binding)throw Error(t('noTarget'));return {sourceUuid:binding.uuid,filterName:binding.filter};}
function drawMouseControl(){
 $('mouseControl').disabled=!binding;$('mouseControl').textContent=t(mouseEnabled?'lockMouse':'enableMouse');$('mouseControl').setAttribute('aria-pressed',String(mouseEnabled));
 $('mouseState').textContent=t(mouseEnabled?'mouseActive':'mouseLocked');
 $('preview').dataset.mouse=mouseEnabled?'on':'off';$('preview').tabIndex=mouseEnabled?0:-1;
 $('preview').setAttribute('role',mouseEnabled?'application':'img');$('preview').setAttribute('aria-label',t(mouseEnabled?'previewAria':'previewLockedAria'));
}
function unbind(){binding=null;dirty=false;writing=false;animation=null;endDrag();mouseEnabled=false;drawMouseControl();renderCompactPresets();$('controls').disabled=true;$('frame').removeAttribute('src');$('previewText').hidden=false;$('previewText').textContent=t('inactive');}
function disconnect(message=t('disconnected')){
 ++epoch;clearTimeout(connectTimer);identified=false;unbind();const old=socket;socket=null;if(old)old.close();
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(t('connectionEnded')));}pending.clear();
 $('connect').disabled=false;$('disconnect').disabled=true;
 for(const id of ['host','port','scene','filter'])$(id).disabled=false;
 status(message);$('target').textContent=t('targetDisconnected');
}
function fail(e){error(e.message==='PTZ_INVALID_POSE'?t('invalidPose'):(e.message||String(e)));disconnect(t('checkConnection'));status(t('checkConnection'),'error');setCompact(false);$('connectionBox').open=true;}
async function sha(text){if(!crypto.subtle)throw Error(t('cryptoUnsupported'));const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return btoa(String.fromCharCode(...new Uint8Array(bytes)));}
async function connect(){
 disconnect();error('');notice('');
 const host=$('host').value.trim(),port=Number($('port').value);
 if(!['127.0.0.1','localhost'].includes(host)||!Number.isInteger(port)||port<1||port>65535){error(t('invalidEndpoint'));return;}
 config={host,port,scene:$('scene').value.trim(),filter:$('filter').value.trim()};
 if(!config.scene||!config.filter){error(t('missingTarget'));return;}
 const password=$('password').value; // Memory only; never stored or logged.
 const run=epoch;
 $('connect').disabled=true;$('disconnect').disabled=false;
 for(const id of ['host','port','scene','filter'])$(id).disabled=true;
 status(t('connecting'));
 try{socket=new WebSocket(`ws://${host}:${port}`,'obswebsocket.json');}catch(e){fail(e);return;}
 connectTimer=setTimeout(()=>{if(run===epoch)fail(Error(t('unreachable')));},8000);
 socket.onmessage=async event=>{
  if(run!==epoch)return;
  try{
   const {op,d}=JSON.parse(event.data);
   if(op===0){
    const identify={rpcVersion:1,eventSubscriptions:255};
    if(d.authentication){if(!password)throw Error(t('passwordRequired'));identify.authentication=await sha(await sha(password+d.authentication.salt)+d.authentication.challenge);}
    if(run===epoch)socket.send(JSON.stringify({op:1,d:identify}));
   }else if(op===2){
    identified=true;clearTimeout(connectTimer);await bind(run);
   }else if(op===7){
    const p=pending.get(d.requestId);if(!p)return;clearTimeout(p.timer);pending.delete(d.requestId);
    if(d.requestStatus.result)p.resolve(d.responseData||{});else p.reject(Error(`${d.requestType}: ${d.requestStatus.comment||d.requestStatus.code}`));
   }else if(op===5&&binding){
    if(['CurrentSceneCollectionChanging','CurrentSceneCollectionChanged','SceneCollectionChanging','SceneCollectionChanged'].includes(d.eventType))fail(Error(t('collectionChanged')));
    if(['SourceFilterRemoved','SourceFilterNameChanged'].includes(d.eventType)&&d.eventData?.sourceName===binding.scene&&[d.eventData.filterName,d.eventData.oldFilterName].includes(binding.filter))fail(Error(t('filterChanged')));
   }
  }catch(e){if(run===epoch)fail(e);}
 };
 socket.onerror=()=>{if(run===epoch)fail(Error(t('connectionFailed')));};
 socket.onclose=event=>{if(run===epoch)fail(Error(event.code===4009?t('authFailed'):t('closed',{code:event.code})));};
}
async function bind(run){
 const info=await rpc('GetVersion');
 for(const method of ['GetSourceFilter','SetSourceFilterSettings','GetSourceScreenshot','GetSceneList','GetSceneCollectionList'])if(!info.availableRequests.includes(method))throw Error(t('unsupported',{method}));
 const collection=await rpc('GetSceneCollectionList');const list=await rpc('GetSceneList');
 const scene=list.scenes.find(s=>s.sceneName===config.scene);
 if(!scene?.sceneUuid)throw Error(t('sceneMissing',{scene:config.scene}));
 const f=await rpc('GetSourceFilter',{sourceUuid:scene.sceneUuid,filterName:config.filter});
 if(f.filterKind!=='shader_filter')throw Error(t('wrongFilter'));
 if(!/insta360_ptz_reframe\.shader$/i.test(f.filterSettings.shader_file_name||''))throw Error(t('wrongShader'));
 if(!f.filterEnabled)throw Error(t('filterDisabled'));
 const defaults={pan:0,tilt:0,roll:0,fov:90};current=C.pose({...defaults,...Object.fromEntries(C.keys.filter(k=>k in f.filterSettings).map(k=>[k,f.filterSettings[k]]))});
 if(run!==epoch)return;
 binding={uuid:scene.sceneUuid,scene:config.scene,filter:config.filter,collection:collection.currentSceneCollectionName};
 storageSet('obs-insta360-reframe-ptz-config-v1',config);loadPresets();loadHome();drawValues();dirty=false;
 $('controls').disabled=false;$('connectionBox').open=false;status(t('connected'),'ok');
 drawMouseControl();
 $('target').textContent=`${binding.scene} → ${binding.filter}`;
 $('previewText').textContent=t('loadingPreview');notice(t('ready'));
}
async function writeLatest(){
 if(!binding||!dirty||writing)return;
 const run=epoch, b=binding, value={...current};dirty=false;writing=true;
 try{await rpc('SetSourceFilterSettings',{...target(),filterSettings:value,overlay:true});}
 catch(e){if(run===epoch)fail(e);}finally{if(run===epoch&&binding===b)writing=false;}
}
setInterval(writeLatest,40);
async function flushWrites(){const run=epoch;while(run===epoch&&(dirty||writing)){if(!writing)await writeLatest();else await new Promise(r=>setTimeout(r,15));}if(run!==epoch)throw Error(t('connectionEnded'));}
async function syncFromOBS(force=false){
 if(!binding||syncing||writing||dirty||(!force&&(animation||dragging||performance.now()-lastEdit<700)))return false;
 const run=epoch, revision=editRevision;syncing=true;
 try{
  const [f,col]=await Promise.all([rpc('GetSourceFilter',target()),rpc('GetSceneCollectionList')]);
  if(run!==epoch||!binding)return false;
  if(col.currentSceneCollectionName!==binding.collection||!f.filterEnabled)throw Error(t('targetInactive'));
  if(animation||dragging||writing||dirty||revision!==editRevision)return false;
  const defaults={pan:0,tilt:0,roll:0,fov:90};current=C.pose({...defaults,...Object.fromEntries(C.keys.filter(k=>k in f.filterSettings).map(k=>[k,f.filterSettings[k]]))});drawValues();return true;
 }catch(e){if(run===epoch)fail(e);return false;}finally{syncing=false;}
}
setInterval(()=>syncFromOBS(),1000);
async function preview(){
 if(!binding||compact||screenshotBusy||document.hidden)return;const run=epoch;screenshotBusy=true;
 try{
  const r=await rpc('GetSourceScreenshot',{sourceUuid:binding.uuid,imageFormat:'jpg',imageWidth:640,imageHeight:360,imageCompressionQuality:65});
  if(run!==epoch||!binding||compact)return;
  if(!/^data:image\/(jpeg|jpg|png);base64,/.test(r.imageData))throw Error(t('invalidPreview'));
  $('frame').src=r.imageData;$('previewText').hidden=true;
 }catch(e){if(run===epoch){$('previewText').hidden=false;$('previewText').textContent=t('previewUnavailable')+e.message;}}
 finally{screenshotBusy=false;}
}
setInterval(preview,180);
const previewBox=$('preview');
previewBox.onpointerdown=e=>{if(!binding||!mouseEnabled||e.button!==0)return;e.preventDefault();previewBox.focus();stopMotion();dragging={id:e.pointerId,x:e.clientX,y:e.clientY};previewBox.setPointerCapture(e.pointerId);};
previewBox.onpointermove=e=>{if(!binding||!mouseEnabled||!dragging||dragging.id!==e.pointerId)return;const r=previewBox.getBoundingClientRect();const fine=e.shiftKey?.2:1;manual(C.drag(current,(e.clientX-dragging.x)*fine,(e.clientY-dragging.y)*fine,r.width,r.height));dragging={id:e.pointerId,x:e.clientX,y:e.clientY};};
function endDrag(){const id=dragging?.id;dragging=null;if(id!==undefined&&$('preview').hasPointerCapture?.(id))$('preview').releasePointerCapture(id);}previewBox.onpointerup=endDrag;previewBox.onpointercancel=endDrag;previewBox.onlostpointercapture=endDrag;
previewBox.addEventListener('wheel',e=>{if(!binding||!mouseEnabled)return;e.preventDefault();const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?360:1);manual(C.zoom(current,d*(e.shiftKey?.2:1)));},{passive:false});
previewBox.onkeydown=e=>{
 if(!binding)return;if(e.key==='Escape'){stopMotion();notice(t('stopped'));return;}if(!mouseEnabled)return;let p={...current},step=e.shiftKey?.2:2;
 switch(e.key){case'ArrowLeft':p.pan-=step;break;case'ArrowRight':p.pan+=step;break;case'ArrowUp':p.tilt+=step;break;case'ArrowDown':p.tilt-=step;break;case'+':case'=':p=C.zoom(p,-80);break;case'-':p=C.zoom(p,80);break;case'Escape':stopMotion();notice(t('stopped'));return;default:return;}e.preventDefault();manual(p);
};
$('connect').onclick=connect;$('disconnect').onclick=()=>disconnect();
$('compactToggle').onclick=()=>{setCompact(true);$('compactExpand').focus();};
$('compactExpand').onclick=()=>{setCompact(false);$('compactToggle').focus();};
$('compactStop').onclick=()=>{stopMotion();notice(t('stopped'));};
$('compactPresets').addEventListener('wheel',e=>{
 const list=$('compactPresets');
 if(!compact||window.innerWidth<window.innerHeight||list.scrollWidth<=list.clientWidth||!e.deltaY)return;
 e.preventDefault();list.scrollLeft+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?list.clientWidth:1);
},{passive:false});
$('mouseControl').onclick=()=>{if(!binding)return;endDrag();mouseEnabled=!mouseEnabled;drawMouseControl();};drawMouseControl();
$('addPreset').onclick=()=>{
 if(!binding||presets.length>=maxPresets)return;
 let n=1;while(presets.some(p=>p.name===t('viewName',{n})))n++;
 const next=[...presets,{id:crypto.randomUUID(),name:t('viewName',{n}),pose:null}];
 if(!storageSet(presetKey(),next))return;presets=next;renderPresets();notice(t('slotAdded'));
};
$('home').onclick=()=>fly({pan:homeView.lens==='outer'?180:0,tilt:0,roll:0,fov:homeView.fov});
$('homeLens').onchange=updateHome;$('homeFov').onchange=updateHome;
$('stop').onclick=()=>{stopMotion();notice(t('stopped'));};
$('sync').onclick=async()=>{stopMotion();await flushWrites();await syncFromOBS(true);};
$('export').onclick=()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,scene:config.scene,filter:config.filter,presets,homeView},null,2)],{type:'application/json'}));a.href=url;a.download='insta360-ptz-ansichten.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
$('import').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw Error(t('fileLarge'));const data=JSON.parse(await file.text());if(![1,2].includes(data.version))throw Error(t('unknownFormat'));const checked=checkedPresets(data.presets);const importedHome=data.homeView===undefined?null:checkedHome(data.homeView);if(!window.confirm(t(importedHome?'replaceWithHomeConfirm':'replaceConfirm')))return;if(!storageSet(presetKey(),checked))return;presets=checked;if(importedHome&&storageSet(homeKey(),importedHome)){homeView=importedHome;drawHome();}renderPresets();notice(t('imported'));}catch(e){error(e.message);}finally{$('importFile').value='';}};
const saved=storageGet('obs-insta360-reframe-ptz-config-v1');if(saved&&['127.0.0.1','localhost'].includes(saved.host)){for(const k of ['host','port','scene','filter'])if(saved[k]!==undefined)$(k).value=saved[k];}
I.onChange(()=>{renderPresets();drawMouseControl();for(const k of C.keys){$(k+'Label').textContent=t(k);$(k+'Number').setAttribute('aria-label',t('degrees',{label:t(k)}));}status(binding?t('connected'):socket?t('connecting'):t('disconnected'),binding?'ok':'');if(!binding){$('target').textContent=t('targetDisconnected');$('previewText').textContent=t('connectHint');}notice('');});
setCompact(storageGet('obs-insta360-reframe-ptz-ui-v1')?.compact===true,false);status(t('disconnected'));
window.addEventListener('beforeunload',()=>{if(socket)socket.close();});
})();
