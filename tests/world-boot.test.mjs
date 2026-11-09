import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rules from '../src/rules.js';
import * as data from '../src/data.js';

// Regression for a real V10 startup failure. Syntax tests and the previous mocked
// combat test never executed createUniverse(), so an undefined atmosphere material
// helper crashed initialization only once the browser had loaded PlayCanvas.
class Vec3 {
 constructor(x=0,y=0,z=0){this.set(x,y,z)}
 set(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;return this}
 clone(){return new Vec3(this.x,this.y,this.z)}
 copy(v){return this.set(v.x,v.y,v.z)}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
 mulScalar(n){this.x*=n;this.y*=n;this.z*=n;return this}
 length(){return Math.hypot(this.x,this.y,this.z)}
 normalize(){const n=this.length()||1;return this.mulScalar(1/n)}
 distance(o){return Math.hypot(this.x-o.x,this.y-o.y,this.z-o.z)}
 dot(o){return this.x*o.x+this.y*o.y+this.z*o.z}
}
class Entity {
 constructor(name){this.name=name;this.children=[];this.enabled=true;this.position=new Vec3();this.scale=[]}
 addChild(e){this.children.push(e);e.parent=this}
 addComponent(kind,data){this[kind]=data;return this}
 setPosition(...v){this.position.copy(v.length===1?v[0]:new Vec3(...v));return this}
 setLocalPosition(...v){return this.setPosition(...v)}
 setLocalScale(...v){this.scale=v;return this}
 setLocalEulerAngles(){return this}
 rotateLocal(){return this}
 lookAt(){return this}
 destroy(){this.enabled=false}
}
class Color {constructor(r=0,g=0,b=0){Object.assign(this,{r,g,b})}}
class Material {constructor(){this.opacity=1;this.emissiveIntensity=0} update(){return this}}
class Mesh {constructor(){}setPositions(){}setNormals(){}setUvs(){}setIndices(){}update(){}}
class MeshInstance {constructor(mesh,material,entity){Object.assign(this,{mesh,material,entity})}}
class Texture {setSource(){}}
const pc={Vec3,Entity,Color,StandardMaterial:Material,Mesh,MeshInstance,Texture,
 PIXELFORMAT_RGBA8:2,FILTER_LINEAR_MIPMAP_LINEAR:3,FILTER_LINEAR:4,ADDRESS_REPEAT:1,ADDRESS_CLAMP_TO_EDGE:2,
 CULLFACE_NONE:0,BLEND_NORMAL:1};
const clean=p=>readFileSync(new URL(p,import.meta.url),'utf8')
 .replace(/^import .*?;\s*$/gm,'')
 .replace(/^export (function|const|class) /gm,'$1 ');
const gfxCode=clean('../src/graphics.js');
const gfx=new Function('pc','lcg',gfxCode+'\nreturn {material,emissiveMaterial,add,fragment,makeFragmentMesh,randBetween};')(pc,rules.lcg);
const universeCode=clean('../src/world.js');
const build=new Function('pc','BODIES','OORT_INNER_RADIUS','OORT_VISUAL_RADIUS','textureCandidates',
 'clamp','lcg','shadowedFromSun','SOLAR_PULSE','reachesSolarFront','iceFieldContact',
 'material','makeEmissive','add','fragment','makeFragmentMesh','randBetween',
 universeCode+'\nreturn createUniverse;')(
 pc,data.BODIES,data.OORT_INNER_RADIUS,data.OORT_VISUAL_RADIUS,()=>[],
 rules.clamp,rules.lcg,rules.shadowedFromSun,rules.SOLAR_PULSE,rules.reachesSolarFront,rules.iceFieldContact,
 gfx.material,gfx.emissiveMaterial,gfx.add,gfx.fragment,gfx.makeFragmentMesh,gfx.randBetween
);
const previousImage=globalThis.Image;
globalThis.Image=class Image {set src(url){this._src=url}};
test.after(()=>{if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;});
const app={root:new Entity('test scene'),graphicsDevice:{},scene:{ambientLight:null}};
test('all celestial bodies, rings, atmospheric glow and cosmic background construct without ReferenceError',()=>{
 const world=build(app,()=>{},'performance');
 assert.equal(world.worlds.size,data.BODIES.length);
 assert.ok(world.worlds.has('sun'));
 assert.ok(world.worlds.has('saturn'));
 assert.ok(world.worlds.has('earth'));
 assert.ok(world.cosmos);
 assert.equal(world.oortIce.length,0);
 world.update(0.016);
});
test('solar events and planetary breakup can construct translucent materials and render entities',()=>{
 const events=[];
 const world=build({root:new Entity('test scene'),graphicsDevice:{},scene:{}},(type)=>events.push(type),'performance');
 const planet=world.worlds.get('mars');
 assert.equal(world.damagePlanet(planet,planet.hp+1,'test'),true);
 world.update(3.7);
 assert.ok(events.includes('planetRupture'));
 assert.ok(events.includes('planetDestroyed'));
 world.update(31);
 assert.ok(events.includes('solarPulse'));
});
test('world graphics imports the actual defined emissive helper',()=>{
 assert.match(readFileSync(new URL('../src/graphics.js',import.meta.url),'utf8'),/export function emissiveMaterial\(/);
 assert.match(readFileSync(new URL('../src/world.js',import.meta.url),'utf8'),/emissiveMaterial as makeEmissive/);
});
