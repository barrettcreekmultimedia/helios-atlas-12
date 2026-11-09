import test from 'node:test';
import assert from 'node:assert/strict';

class MockElement {
  constructor(dataset={}) {this.dataset=dataset;this.handlers=new Map();this.style={};this.classList={
    states:new Set(),add(x){this.states.add(x)},remove(x){this.states.delete(x)},toggle(x,enabled){if(enabled)this.states.add(x);else this.states.delete(x);},contains(x){return this.states.has(x)}
  };this.textContent='';this.value='';this.children=[];this.hidden=false;this.disabled=false;}
  addEventListener(name,fn){this.handlers.set(name,fn)}
  dispatch(name, extra={}) {this.handlers.get(name)?.({target:this,...extra})}
  querySelectorAll(){return this.children}
}

test('hangar menu remains usable before PlayCanvas finishes loading', async () => {
 const originals={window:globalThis.window,document:globalThis.document};
 const ids=new Map();const el=id=>{if(!ids.has(id))ids.set(id,new MockElement());return ids.get(id)};
 const teams=[new MockElement({mode:'teams'}),new MockElement({mode:'ffa'})];
 const humans=[new MockElement({humans:'2'}),new MockElement({humans:'1'})];
 el('mode-choices').children=teams;el('human-choices').children=humans;
 const listeners=new Map();
 globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn)};
 globalThis.document={getElementById:el};
 try {
  await import('../src/menu.js?independent='+Date.now());
  assert.equal(window.HELIOS_MENU_READY,true);
  assert.equal(el('launch-btn').disabled,false);
  assert.equal(window.HELIOS_CONFIG.mode,'teams');
  teams[1].dispatch('click');
  assert.equal(window.HELIOS_CONFIG.mode,'ffa');
  humans[1].dispatch('click');
  assert.equal(window.HELIOS_CONFIG.humans,1);
  assert.equal(el('pilot2-selector').style.opacity,'.32');
  el('ship-p1').value='dreadnought';el('ship-p1').dispatch('change');
  assert.equal(window.HELIOS_CONFIG.p1,'dreadnought');
  assert.equal(el('class-title').textContent,'TITAN');
  el('bot-choice').value='veteran';el('bot-choice').dispatch('change');
  assert.equal(window.HELIOS_CONFIG.difficulty,'veteran');
  el('launch-btn').dispatch('click');
  assert.match(el('engine-status').textContent,/LOADING 3D ENGINE/);
  window.HELIOS_BOOT_ERROR='unavailable';
  el('launch-btn').dispatch('click');
  assert.equal(el('boot-report').hidden,false);
 } finally {
  globalThis.window=originals.window;globalThis.document=originals.document;
 }
});
