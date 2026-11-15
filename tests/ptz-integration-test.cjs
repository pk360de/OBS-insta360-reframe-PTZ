'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const C=require('../dock/insta360-ptz-core.js');
function harness({auth=false,badFilter=false,language='de-DE',seed=null,existing=null,home=null,ui=null}={}) {
 const els=new Map(),stored=new Map(),intervals=[],frames=[],requests=[];
 if(existing)stored.set('obs-insta360-reframe-ptz-presets-v1:'+JSON.stringify(['127.0.0.1',4455,'test','PTZ - Demo 16x9','PTZ - Perspective 16x9']),JSON.stringify(existing));
 if(home)stored.set('obs-insta360-reframe-ptz-home-v1:'+JSON.stringify(['127.0.0.1',4455,'test','PTZ - Demo 16x9','PTZ - Perspective 16x9']),JSON.stringify(home));
 if(ui)stored.set('obs-insta360-reframe-ptz-ui-v1',JSON.stringify(ui));
 let confirmResult=true;
 let pose={pan:0,tilt:0,roll:0,fov:90},now=0,ws;
 class Element {
  constructor(){this.value='';this.children=[];this.dataset={};this.listeners={};this.disabled=false;this.hidden=false;}
  set id(v){this._id=v;els.set(v,this);} get id(){return this._id;}
  append(...e){this.children.push(...e);}replaceChildren(){this.children=[];}setAttribute(k,v){(this.attrs||={})[k]=v;}removeAttribute(){}setPointerCapture(){}
  addEventListener(k,f){this.listeners[k]=f;}focus(){doc.activeElement=this;}getBoundingClientRect(){return {width:640,height:360};}click(){return this.onclick?.();}
 }
 const doc={hidden:false,activeElement:null,documentElement:{lang:'',dataset:{}},querySelectorAll(){return [];},getElementById(id){if(!els.has(id)){const el=new Element();el.id=id;}return els.get(id);},createElement(){return new Element();}};
 for(const [id,value]of Object.entries({host:'127.0.0.1',port:'4455',scene:'PTZ - Demo 16x9',filter:'PTZ - Perspective 16x9',duration:'1.2',password:auth?'test-password':''}))doc.getElementById(id).value=value;
 class WS {
  static OPEN=1;
  constructor(){ws=this;this.readyState=1;queueMicrotask(()=>this.onmessage({data:JSON.stringify({op:0,d:{rpcVersion:1,...(auth?{authentication:{salt:'salt',challenge:'challenge'}}:{})}})}));}
  close(){this.readyState=3;}
  send(raw){const p=JSON.parse(raw);if(p.op===1){if(auth){const sha=x=>createHash('sha256').update(x).digest('base64');assert.equal(p.d.authentication,sha(sha('test-passwordsalt')+'challenge'));}queueMicrotask(()=>this.onmessage({data:JSON.stringify({op:2,d:{negotiatedRpcVersion:1}})}));return;}
   assert.equal(p.op,6);const {requestType:t,requestId,requestData:d}=p.d;requests.push({type:t,data:d});let data;
   switch(t){
    case'GetVersion':data={availableRequests:['GetSourceFilter','SetSourceFilterSettings','GetSourceScreenshot','GetSceneList','GetSceneCollectionList']};break;
    case'GetSceneCollectionList':data={currentSceneCollectionName:'test'};break;
    case'GetSceneList':data={scenes:[{sceneName:'PTZ - Demo 16x9',sceneUuid:'scene-id'}]};break;
    case'GetSourceFilter':data={filterKind:badFilter?'other':'shader_filter',filterEnabled:true,filterSettings:{shader_file_name:'D:/test/insta360_ptz_reframe.shader',...pose}};break;
    case'SetSourceFilterSettings':assert.equal(d.sourceUuid,'scene-id');assert.equal(d.filterName,'PTZ - Perspective 16x9');assert.equal(d.overlay,true);assert.deepEqual(Object.keys(d.filterSettings).sort(),['fov','pan','roll','tilt']);pose={...d.filterSettings};data={};break;
    case'GetSourceScreenshot':data={imageData:'data:image/jpeg;base64,AAAA'};break;
    default:throw Error('Unexpected '+t);
   }
   queueMicrotask(()=>this.onmessage({data:JSON.stringify({op:7,d:{requestId,requestStatus:{result:true,code:100},responseData:data}})}));
  }
 }
 const context=vm.createContext({PTZ:C,document:doc,navigator:{language,languages:[language,'en-US']},WebSocket:WS,crypto:webcrypto,TextEncoder,btoa,URL,Blob,console,performance:{now:()=>now},setTimeout,clearTimeout,setInterval:(f,ms)=>intervals.push({f,ms}),requestAnimationFrame:f=>frames.push(f),localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},window:{addEventListener(){},confirm(){return confirmResult;}}});
 for(const file of ['locales/de.js','locales/en.js','locales/es.js','insta360-ptz-i18n.js'])vm.runInContext(fs.readFileSync(require.resolve('../dock/'+file),'utf8'),context);
 context.PTZ_MIGRATION=seed;
 vm.runInContext(fs.readFileSync(require.resolve('../dock/insta360-ptz.js'),'utf8'),context);
 return {el:id=>doc.getElementById(id),requests,stored,intervals,frames,i18n:context.PTZ_I18N,locales:context.PTZ_LOCALES,setConfirm(v){confirmResult=v;},get pose(){return pose;},advance(t){now=t;frames.shift()(t);},event(type,data){ws.onmessage({data:JSON.stringify({op:5,d:{eventType:type,eventData:data}})});}};
}
const settle=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 const h=harness({auth:true});await h.el('connect').onclick();await settle();assert.equal(h.el('controls').disabled,false);assert.equal(h.el('status').textContent,'Verbunden');assert(![...h.stored.values()].some(v=>v.includes('test-password')));
 const manual=h.el('panNumber');manual.value='179';manual.listeners.input();await h.intervals.find(i=>i.ms===40).f();assert.equal(h.pose.pan,179);
 const preview=h.el('preview');
 // Locked preview must leave wheel scrolling and keys to the browser, without camera writes.
 assert.equal(h.el('mouseControl').attrs['aria-pressed'],'false');assert.equal(preview.dataset.mouse,'off');
 const blockedEvent={button:0,pointerId:1,clientX:320,clientY:180,deltaY:-100,deltaMode:0,key:'ArrowRight',preventDefault(){throw Error('Locked input consumed');}};
 const lockedPose={...h.pose},lockedWrites=h.requests.length;
 preview.onpointerdown(blockedEvent);preview.onpointermove({...blockedEvent,clientX:400});preview.listeners.wheel(blockedEvent);preview.onkeydown(blockedEvent);
 await h.intervals.find(i=>i.ms===40).f();assert.deepEqual(h.pose,lockedPose);assert.equal(h.requests.length,lockedWrites);
 h.el('mouseControl').onclick();assert.equal(h.el('mouseControl').attrs['aria-pressed'],'true');
 preview.onpointerdown({button:0,pointerId:1,clientX:320,clientY:180,preventDefault(){}});preview.onpointermove({pointerId:1,clientX:400,clientY:180,shiftKey:false});preview.onpointerup();await h.intervals.find(i=>i.ms===40).f();assert(h.pose.pan<179);
 const before=h.pose.fov;preview.listeners.wheel({deltaY:-100,deltaMode:0,shiftKey:false,preventDefault(){}});await h.intervals.find(i=>i.ms===40).f();assert(h.pose.fov<before);
 // Save actual acknowledged OBS values, change view, recall with smooth movement.
 await h.el('presets').children[0].children[2].onclick();assert.match(h.el('notice').textContent,/gespeichert/);
 const saved={...h.pose};manual.value='-150';manual.listeners.input();await h.intervals.find(i=>i.ms===40).f();h.el('presets').children[0].children[1].onclick();h.advance(600);await h.intervals.find(i=>i.ms===40).f();assert.notEqual(h.pose.pan,-150);h.advance(1300);await h.intervals.find(i=>i.ms===40).f();assert(Math.abs(h.pose.pan-saved.pan)<1e-9);
 // Grabbing during a flight cancels it.
 h.el('home').onclick();h.advance(1400);preview.onpointerdown({button:0,pointerId:2,clientX:320,clientY:180,preventDefault(){}});preview.onpointermove({pointerId:2,clientX:340,clientY:180});preview.onpointerup();await h.intervals.find(i=>i.ms===40).f();const interrupted={...h.pose};h.advance(3000);await h.intervals.find(i=>i.ms===40).f();assert.deepEqual(h.pose,interrupted);
 await h.intervals.find(i=>i.ms===180).f();assert.equal(h.el('previewText').hidden,true);
 // Scene collection changes disarm controls and stop further writes.
 h.event('CurrentSceneCollectionChanging',{});const count=h.requests.length;manual.value='90';manual.listeners.input();await h.intervals.find(i=>i.ms===40).f();assert.equal(h.requests.length,count);assert(h.el('controls').disabled);
 const bad=harness({badFilter:true});await bad.el('connect').onclick();await settle();assert(bad.el('controls').disabled);assert.equal(bad.requests.filter(r=>r.type==='SetSourceFilterSettings').length,0);
 // +179 -> -179 must travel over the seam, never through zero.
 assert.equal(Math.abs(C.blend({pan:179,tilt:0,roll:0,fov:90},{pan:-179,tilt:0,roll:0,fov:60},.5).pan),180);
 for(const [language,lang,connected]of [['de-DE','de','Verbunden'],['en-US','en','Connected'],['es-ES','es','Conectado'],['fr-FR','en','Connected']]){
  const l=harness({language});assert.equal(l.i18n.language,lang);await l.el('connect').onclick();await settle();assert.equal(l.el('status').textContent,connected);
  const before=l.requests.length;l.i18n.select('es');assert.equal(l.el('status').textContent,'Conectado');assert.equal(l.requests.length,before);assert.equal(l.el('scene').value,'PTZ - Demo 16x9');l.el('disconnect').onclick();
  const keys=Object.keys(l.locales.de).sort();for(const name of ['en','es'])assert.deepEqual(Object.keys(l.locales[name]).sort(),keys);
 }
 const seed=JSON.parse(fs.readFileSync(require.resolve('../example/ptz-demo-presets.json'),'utf8'));seed.collection='test';
 const migrated=harness({seed});await migrated.el('connect').onclick();await settle();assert.equal(migrated.el('presets').children[1].children[1].disabled,false);assert.equal(migrated.requests.filter(r=>r.type==='SetSourceFilterSettings').length,0);migrated.el('disconnect').onclick();
 const existing=seed.presets.map(({id,...p})=>({...p,name:'Own '+p.name}));const preserved=harness({seed,existing});await preserved.el('connect').onclick();await settle();assert.equal(preserved.el('presets').children[0].children[0].value,'Own Inner lens');preserved.el('disconnect').onclick();
 const extra=harness({existing});await extra.el('connect').onclick();await settle();
 const presetKey=[...extra.stored.keys()].find(k=>k.startsWith('obs-insta360-reframe-ptz-presets-v1:'));
 const oldPresets=extra.stored.get(presetKey), oldPose={...extra.pose};
 // Home settings are separate from presets and never move the camera on change.
 extra.el('homeLens').value='outer';extra.el('homeLens').onchange();extra.el('homeFov').value='65';extra.el('homeFov').onchange();
 assert.equal(extra.stored.get(presetKey),oldPresets);assert.equal(extra.requests.filter(r=>r.type==='SetSourceFilterSettings').length,0);assert.deepEqual(extra.pose,oldPose);
 extra.el('duration').value='0';extra.el('home').onclick();await extra.intervals.find(i=>i.ms===40).f();assert.equal(extra.pose.pan,-180);assert.equal(extra.pose.fov,65);assert.equal(extra.pose.tilt,0);assert.equal(extra.pose.roll,0);
 const homeKey=[...extra.stored.keys()].find(k=>k.startsWith('obs-insta360-reframe-ptz-home-v1:'));const storedHome=JSON.parse(extra.stored.get(homeKey));assert.deepEqual(storedHome,{lens:'outer',fov:65});
 extra.el('homeFov').value='999';extra.el('homeFov').onchange();assert.equal(extra.el('homeFov').value,65);assert.deepEqual(JSON.parse(extra.stored.get(homeKey)),storedHome);
 const writes=extra.requests.filter(r=>r.type==='SetSourceFilterSettings').length, afterHome={...extra.pose};
 extra.setConfirm(false);extra.el('presets').children[0].children[3].onclick();assert.equal(extra.stored.get(presetKey),oldPresets);
 extra.setConfirm(true);extra.el('presets').children[0].children[3].onclick();
 const cleared=JSON.parse(extra.stored.get(presetKey));assert.equal(cleared[0].pose,null);assert.equal(cleared[0].name,existing[0].name);assert.deepEqual(cleared.slice(1).map(({id,...p})=>p),existing.slice(1));assert.deepEqual(extra.pose,afterHome);assert.equal(extra.requests.filter(r=>r.type==='SetSourceFilterSettings').length,writes);assert(extra.el('presets').children[0].children[3].disabled);
 extra.el('disconnect').onclick();
 const reload=harness({existing:cleared,home:storedHome});await reload.el('connect').onclick();await settle();assert.equal(reload.el('homeLens').value,'outer');assert.equal(reload.el('homeFov').value,65);assert(reload.el('presets').children[0].children[1].disabled);reload.el('homeLens').value='inner';reload.el('homeLens').onchange();reload.el('duration').value='0';reload.el('home').onclick();await reload.intervals.find(i=>i.ms===40).f();assert.equal(reload.pose.pan,0);assert.equal(reload.pose.fov,65);reload.el('disconnect').onclick();
 console.log('PASS: inner/outer home direction and FOV, delayed movement, separate settings persistence, unchanged existing presets, isolated clear and cancellation without camera writes, empty-slot disable and reload.');
 // Compact mode uses the same presets, shows only occupied slots and pauses preview requests.
 const compact=harness({existing});await compact.el('connect').onclick();await settle();
 const ck=[...compact.stored.keys()].find(k=>k.startsWith('obs-insta360-reframe-ptz-presets-v1:'));
 const original=compact.stored.get(ck),compactList=compact.el('compactPresets');
 assert.equal(compactList.children.length,existing.filter(p=>p.pose).length);
 existing.forEach((p,i)=>{if(p.pose)assert(compactList.children.some(b=>b.textContent==='Pos'+(i+1)&&b.title===p.name));});
 compact.el('mouseControl').onclick();compact.el('compactToggle').onclick();assert(compact.el('fullPanel').hidden);assert.equal(compact.el('compactBar').hidden,false);assert.equal(compact.el('preview').dataset.mouse,'off');
 const beforeCompactRequests=compact.requests.length;await compact.intervals.find(i=>i.ms===180).f();assert.equal(compact.requests.length,beforeCompactRequests);assert.equal(compact.stored.get(ck),original);
 compactList.children[1].onclick();compact.advance(600);await compact.intervals.find(i=>i.ms===40).f();assert.notEqual(compact.pose.pan,0);
 compact.el('compactStop').onclick();const stoppedPose={...compact.pose};compact.advance(2000);await compact.intervals.find(i=>i.ms===40).f();assert.deepEqual(compact.pose,stoppedPose);
 compact.i18n.select('es');assert.equal(compactList.children[0].title,existing[0].name);assert.equal(compact.stored.get(ck),original);
 assert.deepEqual(JSON.parse(compact.stored.get('obs-insta360-reframe-ptz-ui-v1')),{compact:true});
 compact.el('compactExpand').onclick();assert.equal(compact.el('fullPanel').hidden,false);await settle();assert(compact.requests.some(r=>r.type==='GetSourceScreenshot'));
 const compactReload=harness({existing,ui:{compact:true}});assert.equal(compactReload.el('compactBar').hidden,false);assert.equal(compactReload.el('compactPresets').children.length,0);assert(compactReload.el('compactStop').disabled);await compactReload.el('connect').onclick();await settle();assert.equal(compactReload.el('compactBar').hidden,false);assert.equal(compactReload.el('compactPresets').children.length,existing.filter(p=>p.pose).length);
 compactReload.event('CurrentSceneCollectionChanging',{});assert.equal(compactReload.el('fullPanel').hidden,false);assert.equal(compactReload.el('compactPresets').children.length,0);assert(compactReload.el('compactStop').disabled);
 const noPositions=harness({existing:[]});await noPositions.el('connect').onclick();await settle();noPositions.el('compactToggle').onclick();assert.equal(noPositions.el('compactPresets').children.length,0);assert.equal(noPositions.el('compactEmpty').hidden,false);noPositions.el('disconnect').onclick();compact.el('disconnect').onclick();
 console.log('PASS: compact mode only shows saved positions with original numbering/names, recalls and stops, preserves presets, locks mouse, pauses/resumes preview, persists separately, handles empty/disconnected states and opens errors.');
 const dynamic=harness({existing});await dynamic.el('connect').onclick();await settle();
 const dk=[...dynamic.stored.keys()].find(k=>k.startsWith('obs-insta360-reframe-ptz-presets-v1:'));
 assert.equal(dynamic.stored.get(dk),JSON.stringify(existing)); // No rewriting on upgrade or connection.
 dynamic.el('addPreset').onclick();assert.equal(dynamic.el('presets').children.length,7);
 const added=JSON.parse(dynamic.stored.get(dk));assert.deepEqual(added.slice(0,6).map(({id,...p})=>p),existing);assert.equal(added[6].pose,null);assert.equal(new Set(added.map(p=>p.id)).size,7);
 dynamic.setConfirm(false);dynamic.el('presets').children[0].children[4].onclick();assert.equal(dynamic.el('presets').children.length,7);
 dynamic.setConfirm(true);dynamic.el('presets').children[0].children[4].onclick();const deleted=JSON.parse(dynamic.stored.get(dk));assert.deepEqual(deleted,added.slice(1));
 // Empty slots delete without confirmation; all can be removed and re-added.
 dynamic.setConfirm(false);dynamic.el('presets').children[5].children[4].onclick();assert.equal(dynamic.el('presets').children.length,5);
 dynamic.setConfirm(true);while(dynamic.el('presets').children.length)dynamic.el('presets').children[0].children[4].onclick();
 assert.deepEqual(JSON.parse(dynamic.stored.get(dk)),[]);dynamic.el('addPreset').onclick();assert.equal(dynamic.el('presets').children.length,1);
 const one=JSON.parse(dynamic.stored.get(dk));const dr=harness({existing:one});await dr.el('connect').onclick();await settle();assert.equal(dr.el('presets').children.length,1);
 const emptyReload=harness({existing:[]});await emptyReload.el('connect').onclick();await settle();assert.equal(emptyReload.el('presets').children.length,0);
 for(let n=1;n<100;n++)dynamic.el('addPreset').onclick();assert.equal(dynamic.el('presets').children.length,100);assert(dynamic.el('addPreset').disabled);dynamic.el('addPreset').onclick();assert.equal(dynamic.el('presets').children.length,100);
 const importFile=dynamic.el('importFile');
 async function importData(data){await importFile.onchange({target:{files:[{size:500,text:async()=>JSON.stringify(data)}]}});}
 await importData({version:1,presets:existing});assert.equal(dynamic.el('presets').children.length,6);
 const importedLegacy=JSON.parse(dynamic.stored.get(dk));assert.deepEqual(importedLegacy.map(({id,...p})=>p),existing);
 await importData({version:2,presets:one,homeView:{lens:'outer',fov:70}});assert.deepEqual(JSON.parse(dynamic.stored.get(dk)),one);assert.equal(dynamic.el('homeFov').value,70);
 const valid=dynamic.stored.get(dk);await importData({version:2,presets:[one[0],one[0]]});assert.equal(dynamic.stored.get(dk),valid);
 await importData({version:2,presets:Array(101).fill(one[0])});assert.equal(dynamic.stored.get(dk),valid);
 assert.equal(dynamic.requests.filter(r=>r.type==='SetSourceFilterSettings').length,0);
 dynamic.el('mouseControl').onclick();assert.equal(dynamic.el('preview').dataset.mouse,'on');dynamic.el('disconnect').onclick();assert.equal(dynamic.el('preview').dataset.mouse,'off');await dynamic.el('connect').onclick();await settle();assert.equal(dynamic.el('preview').dataset.mouse,'off');
 dynamic.el('disconnect').onclick();dr.el('disconnect').onclick();emptyReload.el('disconnect').onclick();
 console.log('PASS: locked input passes scrolling/keys through without writes, opt-in drag/zoom, reconnect resets lock; dynamic slots preserve legacy poses/names and stable IDs, add/delete/cancel/empty list/reload/100-slot limit, v1/v2 import and invalid IDs rejected without camera writes.');
 console.log('PASS: OBS authentication and scoped control, drag/zoom, presets and interruption, preview, no password persistence, collection disarm, seam route; de/en/es auto/manual/fallback and complete dictionaries; migration without writes or overwriting existing views.');
})().catch(e=>{console.error(e);process.exitCode=1;});
