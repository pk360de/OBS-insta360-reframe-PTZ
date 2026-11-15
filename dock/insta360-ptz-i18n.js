'use strict';
(() => {
 const languages=globalThis.PTZ_LOCALES||{}, callbacks=[];
 const key='obs-insta360-reframe-ptz-language-v1';
 function browserLanguage(){return String(navigator.languages?.[0]||navigator.language||'en').toLowerCase().split(/[-_]/)[0];}
 function resolve(mode){const lang=mode==='auto'?browserLanguage():mode;return Object.hasOwn(languages,lang)?lang:'en';}
 let mode='auto';try{const saved=JSON.parse(localStorage.getItem(key));if(['auto','de','en','es'].includes(saved))mode=saved;}catch{}
 let language=resolve(mode);
 function t(id,values={}){const template=languages[language]?.[id]??languages.en?.[id]??id;return template.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??'{'+name+'}'));}
 function apply(){
  document.documentElement.lang=language;
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
  for(const [attr,data]of [['placeholder','i18nPlaceholder'],['aria-label','i18nAria'],['alt','i18nAlt'],['title','i18nTitle']]){
   for(const el of document.querySelectorAll('[data-'+data.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']'))el.setAttribute(attr,t(el.dataset[data]));
  }
  const select=document.getElementById('language');if(select)select.value=mode;
 }
 function select(value){if(!['auto','de','en','es'].includes(value))return;mode=value;language=resolve(mode);try{localStorage.setItem(key,JSON.stringify(mode));}catch{}apply();for(const fn of callbacks)fn(language);}
 globalThis.PTZ_I18N={t,select,onChange:fn=>callbacks.push(fn),get language(){return language;},get mode(){return mode;}};
 apply();document.getElementById('language')?.addEventListener('change',e=>select(e.target.value));
 window.addEventListener('languagechange',()=>{if(mode==='auto')select('auto');});
})();
