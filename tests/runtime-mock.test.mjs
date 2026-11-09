import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rules from '../src/rules.js';
import * as warfare from '../src/warfare.js';
class Vec3 {
 constructor(x=0,y=0,z=0){this.set(x,y,z)}
 set(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;return this}
 clone(){return new Vec3(this.x,this.y,this.z)}
 copy(v){return this.set(v.x,v.y,v.z)}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
 mulScalar(v){this.x*=v;this.y*=v;this.z*=v;return this}
 length(){return Math.hypot(this.x,this.y,this.z)}
 distance(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z}
 normalize(){const l=this.length()||1;return this.mulScalar(1/l)}
 lerp(a,b,t){return this.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t)}
}
class Quat {
 clone(){return new Quat()}
 transformVector(v,out=new Vec3()){return out.copy(v)}
 setFromAxisAngle(){return this}
 mul(){return this}
 normalize(){return this}
 slerp(){return this}
}
class Entity {
 constructor(name='fake'){this.name=name;this.children=[];this.enabled=true;this.position=new Vec3();this.rotation=new Quat()}
 addChild(e){this.children.push(e);e.parent=this}
 addComponent(type,opts){this[type]={...opts};if(type==='camera')this.camera.layers=[0,1,2];return this}
 setPosition(...v){return this.position.copy(v.length===1?v[0]:new Vec3(...v))}
 setLocalPosition(...v){return this.setPosition(...v)}
 getPosition(){return this.position.clone()}
 setRotation(v){this.rotation=v.clone()}
 getRotation(){return this.rotation.clone()}
 lookAt(){return this}
 setLocalScale(){return this}
 setLocalEulerAngles(){return this}
 rotateLocal(){return this}
 translateLocal(){return this}
 destroy(){this.enabled=false}
}
const pc={Vec3,Quat,Entity,Layer:class {constructor(){this.id=3}},Vec4:class{},Color:class{},BLEND_NORMAL:1,CULLFACE_NONE:0};
const graphics={
 buildShip(){return {root:new Entity('ship'),thrusts:[new Entity('exhaust')],size:.2}},
 buildCockpit(){return new Entity('cockpit')},buildWeaponSprite(){return new Entity('weapon')},
 material(){return {update(){}}},add(parent,name){const e=new Entity(name);parent.addChild(e);return e}
};
const source=readFileSync(new URL('../src/combat.js',import.meta.url),'utf8')
 .replace(/^import .*?;\s*$/gm,'').replace('export class ArenaGame','class ArenaGame');
const compiled=new Function('pc','rules','graphics','warfare',`
 const {SHIP_CLASSES,assignTeams,applyDamage,findWinner,segmentSphere,clamp,lcg,calculatePlanetDamage,predictIntercept,advanceLock}=rules;
 const {buildShip,buildCockpit,buildWeaponSprite,material,add}=graphics;
 const {PICKUPS,SPECIALS,MISSILE,missileStep,oortForce,radialDamage,chooseBotPickup,specialReady}=warfare;
 ${source}\nreturn ArenaGame;`);
const ArenaGame=compiled(pc,rules,graphics,warfare);
function setup(cls='interceptor'){
 const worlds=new Map([['sun',{id:'sun',name:'Sun',group:'star',position:new Vec3(0,0,0),radius:112,alive:true,hp:Infinity}],['jupiter',{id:'jupiter',name:'Jupiter',group:'planet',position:new Vec3(1140,0,80),radius:270,alive:true,hp:4000,maxHp:4000}]]);
 const universe={worlds,asteroids:[],structures:[],debris:[],OORT_INNER_RADIUS:3150,
  burst(){},update(){},checkSolarPulse(){return null},checkOortWall(){return {blocked:false}},damagePlanet(){return false},destroyAsteroid(){},destroyStructure(){},oortBurst(){},solarState(){return {seconds:30}}};
 const app={root:new Entity('app root'),scene:{layers:[]}};
 const events=[],game=new ArenaGame(app,universe,{mode:'teams',humans:1,p1:cls},(type,data)=>events.push({type,data}));
 return {game,ship:game.ships[0],events,universe};
}
test('combat construction creates four ships, modes and 16 collectible caches',()=>{
 const {game}=setup();assert.equal(game.ships.length,4);assert.equal(game.ships.filter(s=>s.human).length,1);
 assert.equal(game.pickups.length,16);assert.equal(game.pickups[0].ent.enabled,true);
});
test('physical pickup collection equips railgun and consumes magazine',()=>{
 const {game,ship}=setup();const cache=game.pickups.find(p=>p.type==='railgun');
 ship.position.copy(cache.position);game.updatePickups(.04);assert.equal(cache.active,false);
 assert.equal(ship.pickup?.type,'railgun');const count=ship.pickup.ammo;
 assert.equal(game.shootPickup(ship),true);assert.equal(ship.pickup.ammo,count-1);
 assert.ok(game.projectiles.find(p=>p.type==='railgun'));
});
test('Spectre swarm creates ten guided missiles without lock',()=>{
 const {game,ship}=setup('interceptor');assert.equal(ship.locked,false);assert.equal(game.triggerSpecial(ship),true);
 assert.equal(game.projectiles.length,10);assert.ok(game.projectiles.every(p=>p.type==='missile'&&p.life>=60&&p.target));
 assert.equal(ship.specialAmmo,2);
});
test('Titan warhead explodes with radial damage and shockwave',()=>{
 const {game,ship}=setup('dreadnought');assert.equal(game.triggerSpecial(ship),true);
 const missile=game.projectiles.at(-1);assert.equal(missile.type,'nuke');
 const enemy=game.ships[2];enemy.position.copy(ship.position).add(new Vec3(12,0,0));
 const before=enemy.shields;game.detonateWarhead(enemy.position.clone(),ship.id);
 assert.ok(enemy.shields<before);assert.ok(game.flashes.length>0);
});
test('Vanguard pulse charges before creating beam and applying damage',()=>{
 const {game,ship}=setup('fighter');assert.equal(game.triggerSpecial(ship),true);
 assert.ok(ship.specialCharging>1);assert.equal(game.flashes.length,0);
 game.fireNova(ship);assert.ok(game.flashes.some(x=>x.kind==='beam'));
});
test('EMP disables enemy lock and shield temporarily',()=>{
 const {game,ship}=setup();ship.pickup={type:'emp',ammo:2};
 const foe=game.ships[2];foe.position.copy(ship.position).add(new Vec3(10,0,0));foe.locked=true;
 game.shootPickup(ship);assert.equal(foe.locked,false);assert.ok(foe.disabled>4);
});
test('resupply, overcharge and repair apply independently to live vessels',()=>{
 const {game,ship}=setup();ship.hp=20;ship.shields=10;ship.missileAmmo=1;
 for(const type of ['repair','resupply','overcharge']){
  const p=game.pickups.find(x=>x.type===type);assert.equal(game.collectPickup(ship,p),true);
 }
 assert.ok(ship.hp>20&&ship.shields>10&&ship.missileAmmo>1&&ship.overcharge>0);
});
test('one update ticks physics, pickups, missiles and cooldowns without throwing',()=>{
 const {game,ship}=setup();ship.position.set(1490,0,100);ship.pickupCD=1;
 game.update(.016,{0:{thrust:1}});
 assert.ok(game.elapsed>0&&ship.pickupCD<1);
});

test('AI actively selects reachable weapon pickups instead of only chasing',()=>{
 const {game}=setup();const bot=game.ships[2];game.steerBot(bot,.04);
 assert.ok(bot.botPickupGoal?.startsWith('cache-'));
});
test('fired guided missiles remain in motion with strong acceleration after 1 frame',()=>{
 const {game,ship}=setup();ship.target={kind:'ship',id:2};ship.locked=true;ship.missileAmmo=10;
 assert.equal(game.shoot(ship,'missile'),true);const p=game.projectiles.at(-1);const before=p.velocity.length();
 game.moveProjectiles(.04);assert.ok(p.velocity.length()>before);assert.ok(p.life>60);
});
