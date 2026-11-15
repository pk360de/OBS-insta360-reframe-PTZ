'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const collection=JSON.parse(read('example/obs-scene-collection.json')),presets=JSON.parse(read('example/ptz-demo-presets.json'));
assert.equal(collection.sources.length,2);
const scene=collection.sources.find(s=>s.id==='scene'),image=collection.sources.find(s=>s.id==='image_source');
assert.equal(scene.name,presets.scene);assert.equal(scene.filters[0].name,presets.filter);
assert.equal(image.settings.file,'__REPO_ROOT__/example/sphere_2880x1440.jpg');
assert.equal(scene.filters[0].settings.shader_file_name,'__REPO_ROOT__/shaders/insta360_ptz_reframe.shader');
assert.equal(scene.filters[0].settings.override_entire_effect,false);
const item=scene.settings.items[0];assert.equal(item.source_uuid,image.uuid);assert.equal(item.bounds_type,1);assert.deepEqual(item.pos,{x:0,y:0});assert.deepEqual(item.bounds,{x:1920,y:1080});
for(const edge of ['left','right','top','bottom'])assert.equal(item['crop_'+edge],0);
assert.equal(item.rot,0);assert.equal(item.visible,true);
const js=read('dock/insta360-ptz.js');assert(js.includes("scene:'"+scene.name+"'"));assert(js.includes("filter:'"+scene.filters[0].name+"'"));
assert(js.includes('obs-insta360-reframe-ptz-presets-v1:'));assert(!js.includes('insta360-ptz-presets-v1:')||js.includes('obs-insta360-ptz-presets-v1:'));
assert(!read('dock/insta360-ptz-i18n.js').includes("const key='insta360-ptz-language-v1'"));
const shader=read('shaders/insta360_ptz_reframe.shader');assert(shader.includes('float aspect = 16.0 / 9.0'));assert(shader.includes('AddressU = Wrap'));assert(shader.includes('AddressV = Clamp'));
const textFiles=[];function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ent.name==='.local'||ent.name==='.git')continue;const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full);else if(/\.(md|js|cjs|json|shader|ps1)$/.test(ent.name))textFiles.push(full);}}
walk(root);
for(const file of textFiles){const text=fs.readFileSync(file,'utf8');if(!file.endsWith('repository-check.cjs'))assert(!/C:[\\/]Users[\\/]|D:[\\/]_Download_|X5-reframeing|PTZ v2 - Test/.test(text),'Personal development data: '+file);if(file.endsWith('.md')){
 for(const m of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){const link=m[1];if(/^(?:https?:|mailto:|#)/.test(link))continue;const target=path.resolve(path.dirname(file),decodeURI(link.split('#')[0]));assert(fs.existsSync(target),'Broken local link: '+file+' -> '+link);}
}}
console.log('PASS: sanitized scene/preset targets, full-canvas transform, isolated storage keys, shader geometry, no personal development paths and all Markdown/image links.');
