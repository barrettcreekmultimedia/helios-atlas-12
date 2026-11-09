// This script doesn't import PlayCanvas; it can report an error if the engine cannot be imported.
const $=id=>document.getElementById(id);
function showError(error){
 const message=typeof error==='string'?error:(error?.stack||error?.message||String(error));
 const stage=window.HELIOS_BOOT_STAGE||'LOADING ENGINE MODULE';
 window.HELIOS_BOOT_ERROR=message;
 const report=$('boot-report');report.hidden=false;
 $('boot-diagnostic').textContent='Failure stage: '+stage+'\n\n'+message;
 const engineProblem=stage==='LOADING ENGINE MODULE'||/Could not load PlayCanvas Engine|Failed to fetch dynamically imported module/.test(message);
 const webglProblem=/WebGL|graphics device|createGraphicsDevice|context lost/i.test(message);
 $('boot-guidance').textContent=engineProblem
  ? 'PlayCanvas could not be loaded. For GitHub Pages, use the included GitHub Actions deployment workflow, which includes a local engine copy in the published site. Open the details below for host-specific errors.'
  :webglProblem
  ? 'The browser could not initialize WebGL2. Check hardware acceleration and browser graphics support. Open the details below to see the exact error.'
  : 'PlayCanvas loaded, but game initialization failed during '+stage+'. This is a game-code error, not necessarily an internet connection problem. Open the details below for the exact exception.';
 $('boot-details').open=true;
 $('engine-status').textContent='STARTUP FAILED · '+stage;
 $('launch-btn').classList.remove('loading');
 $('launch-btn').setAttribute('aria-describedby','boot-report');
}
window.HELIOS_REPORT_ERROR=showError;

window.addEventListener('error',event=>{
 if(!window.HELIOS_READY && event.error)showError('Script error: '+(event.error.stack||event.error.message||event.message));
});
window.addEventListener('unhandledrejection',event=>{
 if(!window.HELIOS_READY)showError('Module error: '+(event.reason?.stack||String(event.reason)));
});
$('retry-btn').addEventListener('click',()=>location.reload());
(async()=>{
 try {
  await import('./menu.js');
  window.HELIOS_BOOT_STAGE='LOADING ENGINE MODULE';
  $('engine-status').textContent='PREPARING PLAYCANVAS ENGINE…';
  await import('./main.js');
  if(!window.HELIOS_READY)throw new Error('Engine initialized without entering the ready state');
  $('boot-report').hidden=true;
  $('launch-btn').classList.remove('loading');
 } catch(err) {
  console.error('Helios boot failed',err);
  showError(err);
 }
})();
