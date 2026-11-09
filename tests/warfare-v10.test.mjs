import test from 'node:test';
import assert from 'node:assert/strict';
import {PICKUPS,SPECIALS,MISSILE,missileStep,oortForce,radialDamage,chooseBotPickup,botPickupPreference,specialReady} from '../src/warfare.js';
import {SHIP_CLASSES} from '../src/rules.js';
const vec=(x=0,y=0,z=0)=>({x,y,z});
const length=v=>Math.hypot(v.x,v.y,v.z);
const cosine=(a,b)=> (a.x*b.x+a.y*b.y+a.z*b.z)/(length(a)*length(b));
test('70+ second persistent homing and fast launch overtakes all three ships',()=>{
 assert.ok(MISSILE.lifetime>=60);
 for(const c of Object.values(SHIP_CLASSES)){assert.ok(MISSILE.initialSpeed>c.maxSpeed);assert.ok(MISSILE.maxSpeed>c.maxSpeed*3);}
});
test('guidance accelerates toward moving target and remains finite',()=>{
 const from=vec(),target=vec(100,10,200),vTarget=vec(10,0,0);
 let v=vec(0,0,-MISSILE.initialSpeed),position=vec();
 for(let i=0;i<150;i++){v=missileStep(v,position,target,vTarget,.04);position.x+=v.x*.04;position.y+=v.y*.04;position.z+=v.z*.04;}
 assert.ok(Number.isFinite(v.x+v.y+v.z));assert.ok(length(v)<=MISSILE.maxSpeed+1e-6);
});
test('missile at opposite heading actually turns instead of becoming stuck',()=>{
 const start=vec(0,0,-115),target=vec(0,0,100);const after=missileStep(start,vec(),target,vec(),.04);
 assert.ok(Math.hypot(after.x,after.y)>.01);
 assert.ok(cosine(start,after)>Math.cos(MISSILE.turnRate*.04+.001));
});
test('turn rate is bounded for 90 degree target',()=>{
 const start=vec(0,0,-100),after=missileStep(start,vec(),vec(100,0,0),vec(),.02);
 assert.ok(cosine(start,after)>Math.cos(MISSILE.turnRate*.02+.001));
});
test('missile steering respects coarse and fine frame steps reasonably',()=>{
 function step(dt){let pos=vec(),vel=vec(0,0,-MISSILE.initialSpeed);
  for(let t=0;t<1-1e-8;t+=dt){vel=missileStep(vel,pos,vec(150,10,-280),vec(2,0,0),dt);pos=vec(pos.x+vel.x*dt,pos.y+vel.y*dt,pos.z+vel.z*dt)}return pos;}
 const a=step(.02),b=step(.01);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<8);
});
test('Oort force grows closer to boundary and points inwards',()=>{
 const near=oortForce(vec(3000,30,-20),vec(30,0,0)),far=oortForce(vec(2500,0,0),vec(30,0,0));
 assert.ok(near.x<0&&near.proximity>0);assert.equal(far.proximity,0);
 assert.ok(Math.hypot(near.x,near.y,near.z)>Math.hypot(far.x,far.y,far.z));
});
test('warhead falloff decreases toward edge',()=>{
 assert.equal(radialDamage(100,100,200),0);assert.equal(radialDamage(0,100,200),200);
 assert.ok(radialDamage(50,100,200)<radialDamage(10,100,200));
});
test('all three ship classes have different signature weapons',()=>{
 assert.deepEqual(Object.keys(SPECIALS).sort(),Object.keys(SHIP_CLASSES).sort());
 assert.ok(SPECIALS.interceptor.count>=8&&SPECIALS.interceptor.count<=12);
 assert.ok(SPECIALS.fighter.charge>=1&&SPECIALS.dreadnought.radius>40);
});
test('pickup catalogue includes weapons, EMP, repair, ammo and overcharge',()=>{
 for(const id of ['railgun','scatter','emp','overcharge','repair','resupply'])assert.ok(PICKUPS[id]);
 assert.ok(PICKUPS.railgun.ammo>0&&PICKUPS.emp.ammo>0);
});
test('bots favor repair when damaged and pickups when unarmed',()=>{
 const ship={hp:30,shields:25,missileAmmo:20,pickup:null,position:vec(),settings:{hp:150,shields:100}};
 const p=[{id:'repair',type:'repair',active:true,position:vec(10,0,0)},{id:'railgun',type:'railgun',active:true,position:vec(8,0,0)}];
 assert.equal(chooseBotPickup(ship,p)?.type,'repair');
 ship.hp=150;assert.equal(chooseBotPickup(ship,p)?.type,'railgun');
 assert.equal(botPickupPreference(ship,{type:'railgun',active:false}),-Infinity);
});
test('special ammunition and cooldown are both required',()=>{
 const ship={specialAmmo:2,specialCD:0,hp:45};assert.ok(specialReady(ship));
 ship.specialCD=1;assert.equal(specialReady(ship),false);ship.specialCD=0;ship.specialAmmo=0;assert.equal(specialReady(ship),false);
});
