import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BODIES,BY_BODY_ID,OORT_INNER_RADIUS,OORT_VISUAL_RADIUS} from '../src/data.js';
import {iceFieldContact,SHIP_CLASSES,SOLAR_PULSE,shadowedFromSun} from '../src/rules.js';
const groups=group=>BODIES.filter(b=>b.group===group);
const d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('contains all eight planets, five dwarf planets and 22 named moons',()=>{
 assert.deepEqual(groups('planet').map(b=>b.id),['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune']);
 assert.deepEqual(groups('dwarf').map(b=>b.id),['ceres','pluto','haumea','makemake','eris']);
 assert.equal(groups('moon').length,22);
 assert.ok(BODIES.length===36);
 for(const moon of groups('moon'))assert.ok(BY_BODY_ID[moon.parent],`${moon.id} has known parent`);
});

test('planet and large-moon radius ratios are proportionate to physical radii',()=>{
 const j=BY_BODY_ID.jupiter;
 for(const b of [...groups('planet'),...groups('moon')].filter(b=>b.radiusKm>300)){
  const ratio=b.size/j.size,physical=b.radiusKm/j.radiusKm;
  assert.ok(Math.abs(ratio-physical)<.0001,`${b.id}: ${ratio} vs ${physical}`);
 }
 assert.ok(j.size/BY_BODY_ID.earth.size>10.5);
 assert.ok(j.size/BY_BODY_ID.titan.size>25);
});

test('all catalogue objects begin inside Oort ice perimeter',()=>{
 for(const b of BODIES){
  assert.ok(Math.hypot(...b.pos)+b.size<OORT_INNER_RADIUS,`${b.id} starts inside Oort field`);
 }
 assert.ok(OORT_VISUAL_RADIUS>OORT_INNER_RADIUS);
});

test('ice field restricts ship travel in any direction, not just on a flat plane',()=>{
 for(const pos of [[3250,0,0],[0,-3200,0],[0,0,3400],[-3500,30,400]]){
  const hit=iceFieldContact({x:pos[0],y:pos[1],z:pos[2]},null,OORT_INNER_RADIUS);
  assert.equal(hit.blocked,true);
  assert.ok(Math.hypot(hit.contact.x,hit.contact.y,hit.contact.z)<OORT_INNER_RADIUS);
 }
 assert.equal(iceFieldContact({x:1300,y:100,z:2300},null,OORT_INNER_RADIUS).blocked,false);
});

test('combat ship collision radius stays tiny next to planets',()=>{
 const j=BY_BODY_ID.jupiter;
 assert.ok(j.size/SHIP_CLASSES.interceptor.radius>500);
 assert.ok(j.size/SHIP_CLASSES.dreadnought.radius>300);
});

test('solar front crosses major orbit region and planet still provides occlusion',()=>{
 assert.ok(SOLAR_PULSE.maxRadius>BY_BODY_ID.neptune.pos[2]*-1);
 const sun={x:0,y:0,z:0},ship={x:1500,y:0,z:80};
 const planet={position:{x:1140,y:0,z:80},radius:270,group:'planet',alive:true};
 // Planet occludes a ray with comparable direction but an offset above the star.
 const c={x:1900,y:0,z:130};
 assert.equal(shadowedFromSun(sun,c,[planet]),true);
});

test('rendering includes panoramic cosmos and uses Oort navigation force without procedural ice geometry',()=>{
 const world=readFileSync(new URL('../src/world.js',import.meta.url),'utf8');
 const combat=readFileSync(new URL('../src/combat.js',import.meta.url),'utf8');
 assert.match(world,/createCosmos/);assert.doesNotMatch(world,/createOortIceField/);
 assert.match(world,/checkOortWall/);
 assert.match(combat,/oortImpact/);
 assert.match(combat,/checkOortWall\(s\.position/);
 assert.match(combat,/checkOortWall\(p\.position/);
});
