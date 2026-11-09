// Menu is deliberately independent of PlayCanvas, WebGL and all CDN imports.
// Even if graphics fail to load, the user can select a mode and see diagnostics.
import {SHIP_CLASSES} from './rules.js';
const $=id=>document.getElementById(id);
const config=window.HELIOS_CONFIG={mode:'teams',humans:2,difficulty:'standard',p1:'fighter',p2:'interceptor',assist:.14,quality:'balanced'};
const selector=$('launch-btn');
selector.disabled=false;
selector.classList.add('loading');
function updatePreview(){
 const c=SHIP_CLASSES[config.p1];
 $('class-title').textContent=c.name;
 $('class-specs').textContent=c.tag;
 const desc={interceptor:'Needle-thin interceptor. Fast acceleration, tight turns, light shields and rapid pulse fire.',fighter:'Balanced multirole strike craft. Reinforced armour, precision handling and twin pulse weapons.',dreadnought:'Heavy battle vessel. Thick hull and shields, high-damage weapons and deliberate acceleration.'};
 $('class-description').textContent=desc[config.p1];
 $('stat-thrust').style.width=Math.min(100,Math.round(c.acceleration/10*100))+'%';
 $('stat-armour').style.width=Math.min(100,Math.round(c.hp/245*100))+'%';
 $('stat-weapons').style.width=Math.min(100,Math.round(c.laserDamage/24*100))+'%';
}
for (const [container,key,convert] of [['mode-choices','mode',x=>x],['human-choices','humans',Number]]) {
 for (const button of $(container).querySelectorAll('button')) button.addEventListener('click',()=>{
  $(container).querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));
  config[key]=convert(button.dataset[key]);
  if(key==='humans')$('pilot2-selector').style.opacity=config.humans===1?'.32':'1';
 });
}
$('assist-choice').addEventListener('change',e=>config.assist=Number(e.target.value));
$('bot-choice').addEventListener('change',e=>config.difficulty=e.target.value);
$('quality-choice').addEventListener('change',e=>config.quality=e.target.value);
for (const [id,key] of [['ship-p1','p1'],['ship-p2','p2']]) $(''+id).addEventListener('change',e=>{
 config[key]=e.target.value; updatePreview();
});
updatePreview();
selector.addEventListener('click',()=>{
 if (typeof window.HELIOS_LAUNCH==='function') return window.HELIOS_LAUNCH();
 const status=$('engine-status');
 if(status)status.textContent=window.HELIOS_BOOT_ERROR?'STARTUP FAILED · SEE DIAGNOSTICS BELOW':'LOADING 3D ENGINE · YOUR SETTINGS ARE SAVED';
 if(window.HELIOS_BOOT_ERROR) $('boot-report').hidden=false;
});
window.addEventListener('helios-engine-progress',e=>{
 if(!$('engine-status'))return;
 $('engine-status').textContent=e.detail.message;
});
window.HELIOS_MENU_READY=true;
