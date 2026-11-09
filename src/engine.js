// HELIOS PlayCanvas Engine boot resolver.
// Local vendored build wins; alternate CDNs are used only if it isn't present.
// This is still the real PlayCanvas Engine, not a substitute renderer.
const candidates = [
  {name: 'Local bundled PlayCanvas', url: '../vendor/playcanvas.mjs'},
  {name: 'jsDelivr', url: 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/build/playcanvas.mjs'},
  {name: 'UNPKG', url: 'https://unpkg.com/playcanvas@2.23.3/build/playcanvas.mjs'},
  {name: 'esm.sh', url: 'https://esm.sh/playcanvas@2.23.3?bundle'},
];
const update=(message)=>{try{window.dispatchEvent(new CustomEvent('helios-engine-progress',{detail:{message}}));}catch{}};
const errors=[];
let engine=null;
for (const {name,url} of candidates) {
  update('CONNECTING TO PLAYCANVAS · '+name.toUpperCase());
  try {
    // Don't let a single network host hang the entire game indefinitely.
    const timeout=Number(name==='Local bundled PlayCanvas'?9000:7500);
    let timer;
    const awaited = await Promise.race([
      import(url),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Source timed out')),timeout);})
    ]).finally(()=>clearTimeout(timer));
    if (!awaited?.createGraphicsDevice || !awaited?.AppBase || !awaited?.Entity) {
      throw new Error('Module does not expose the expected PlayCanvas API');
    }
    engine=awaited;
    update('PLAYCANVAS LOADED · '+name.toUpperCase());
    break;
  } catch (error) {
    errors.push(`${name}: ${error?.message||String(error)}`);
  }
}
if (!engine) {
  const e=new Error('Could not load PlayCanvas Engine. '+errors.join(' | '));
  e.code='HELIOS_ENGINE_LOAD_FAILED';
  throw e;
}
export default engine;
