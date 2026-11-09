import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
test('PlayCanvas Engine module and game entrypoint',()=>{
 const html=read('index.html');assert.match(html,/src\/boot\.js/);assert.match(read('src/engine.js'),/playcanvas@2\.23\.3/);assert.match(read('src/boot.js'),/import\('\.\/main\.js'\)/);
 for(const name of ['main','world','combat','rules','graphics'])assert.ok(existsSync(new URL(`src/${name}.js`,root)));
});
test('every interactive HUD control has a handler',()=>{
 const html=read('index.html'),js=read('src/main.js')+read('src/menu.js')+read('src/boot.js');
 const ids=[...html.matchAll(/<button\b[^>]*\bid="([\w-]+)"/g)].map(x=>x[1]);
 assert.ok(ids.length>=11);
 for(const id of ids)assert.ok(js.includes(`$('${id}')`)||['p1-mode','p1-next','p2-mode','p2-next','p1-view','p2-view','p1-flare','p2-flare','p1-zoom','p2-zoom','p1-pickup-btn','p2-pickup-btn','p1-special-btn','p2-special-btn'].includes(id),`missing handler for ${id}`);
});
test('surface textures are local fallbacks and no science progression modules remain',()=>{
 assert.ok(readdirSync(new URL('assets/',root)).filter(f=>f.endsWith('.jpg')).length>=20);
 assert.ok(!existsSync(new URL('src/progression.js',root)));
 assert.match(read('src/world.js'),/debris/);
 assert.match(read('src/combat.js'),/last|winner|findWinner/);
});

test('hangar controls initialize before engine imports',()=>{
 const boot=read('src/boot.js'),menu=read('src/menu.js'),main=read('src/main.js');
 assert.ok(boot.indexOf("import('./menu.js')")<boot.indexOf("import('./main.js')"));
 assert.match(menu,/HELIOS_CONFIG/);assert.doesNotMatch(menu,/import .*playcanvas/);
 assert.match(main,/window\.HELIOS_LAUNCH=launch/);
});
test('engine has alternate sources and local-vendor support',()=>{
 const engine=read('src/engine.js');
 for(const token of ['vendor/playcanvas.mjs','cdn.jsdelivr.net','unpkg.com','esm.sh'])assert.ok(engine.includes(token));
 for(const name of ['main','combat','world','graphics'])assert.match(read(`src/${name}.js`),/import pc from '\.\/engine\.js'/);
});
