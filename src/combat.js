import pc from './engine.js';
import {SHIP_CLASSES,assignTeams,applyDamage,findWinner,segmentSphere,clamp,lcg,calculatePlanetDamage,predictIntercept,advanceLock} from './rules.js';
import {buildShip,buildCockpit,buildWeaponSprite,material,add} from './graphics.js';
import {PICKUPS,SPECIALS,MISSILE,missileStep,oortForce,radialDamage,chooseBotPickup,specialReady} from './warfare.js';
const V=(x=0,y=0,z=0)=>new pc.Vec3(x,y,z),FWD=V(0,0,-1),UP=V(0,1,0),RIGHT=V(1,0,0);
const random=lcg(91455),local=(q,v)=>q.transformVector(v,V());
const HORIZON=850;
const DEG=180/Math.PI;
const colorBySlot=['#72eaff','#ffd09e','#ff8f8a','#ba9cff'];

export class ArenaGame{
 constructor(app,universe,{mode='teams',humans=2,difficulty='standard',p1='fighter',p2='interceptor',assist=.14}={},callback=()=>{}){
  this.app=app;this.universe=universe;this.callback=callback;this.mode=mode;this.humans=humans;this.difficulty=difficulty;this.assist=clamp(assist,0,.35);
  this.elapsed=0;this.over=false;this.paused=false;this.ships=[];this.projectiles=[];this.decoys=[];this.pickups=[];this.flashes=[];this.kills=[];this.frameCount=0;this.planetsDestroyed=0;this.projectilesFired=0;
  const assignments=assignTeams(mode,humans);const choices=[p1,humans===2?p2:'fighter','fighter','dreadnought'];
  const spots=[[1450,12,100],[1467,-8,106],[1460,10,65],[1485,-9,58]];
  for(const slot of assignments){
   const klass=choices[slot.slot],settings=SHIP_CLASSES[klass]||SHIP_CLASSES.fighter,position=V(...spots[slot.slot]);
   const model=buildShip(app,slot.slot,klass,colorBySlot[slot.slot]);model.root.setPosition(position);
   model.root.lookAt(slot.slot<2?V(1470,0,75):V(1455,0,95));
   const rotation=model.root.getRotation().clone();let camera=null,cockpit=null;
   if(slot.human){camera=new pc.Entity('Pilot '+(slot.slot+1)+' / independent combat camera');camera.addComponent('camera',{nearClip:.015,farClip:8800,fov:67,clearColor:new pc.Color(.002,.004,.013),priority:slot.slot});
    camera.camera.rect=humans===1?new pc.Vec4(0,0,1,1):slot.slot===0?new pc.Vec4(0,.5,1,.5):new pc.Vec4(0,0,1,.5);
    app.root.addChild(camera);
    const bridgeLayer=new pc.Layer({name:'Pilot '+slot.slot+' isolated cockpit',clearDepthBuffer:true});
    app.scene.layers.push(bridgeLayer);camera.camera.layers=[...camera.camera.layers,bridgeLayer.id];
    cockpit=buildCockpit(camera,klass,colorBySlot[slot.slot],bridgeLayer.id,app);}
   this.ships.push({id:slot.slot,name:slot.human?'PILOT '+(slot.slot+1):'ACE '+(slot.slot-humans+1),human:slot.human,team:slot.team,klass,settings,model,camera,cockpit,
    position,rotation,vel:V(),omega:V(),hp:settings.hp,shields:settings.shields,laserCD:0,missileCD:0,laserHeat:0,missileAmmo:settings.missileAmmo,decoys:settings.decoys,decoyCD:0,
    kills:0,damage:0,alive:true,target:null,lockProgress:0,locked:false,lockMode:'ships',lockNotified:false,view:'chase',zoom:false,cameraShake:0,
    lastImpact:0,shotFlash:0,impactCooldown:0,boosting:false,fireIndex:0,invulnerability:0,
    pickup:null,pickupCD:0,overcharge:0,disabled:0,specialAmmo:SPECIALS[klass].charges,specialCD:0,specialCharging:0,botPickupGoal:null});
  }
  this.weaponMats=colorBySlot.map(c=>material(c,3.0));this.missileMat=material('#ffbc77',3.1);
  this.spawnPickups();
 }
 spawnPickups(){
  const types=['railgun','repair','scatter','resupply','emp','overcharge','railgun','repair','scatter','resupply','emp','overcharge','railgun','resupply','repair','scatter'];
  const base=V(1530,0,80);
  for(let i=0;i<types.length;i++){
   const type=types[i],t=PICKUPS[type],a=i*2.39996,ring=i<8?42:105;
   const pos=base.clone().add(V(Math.cos(a)*ring,Math.sin(a*1.2)*35,Math.sin(a)*ring));
   const ent=new pc.Entity('Salvage beacon / '+t.name);this.app.root.addChild(ent);ent.setPosition(pos);
   const casing=material('#203143'),accent=material(t.color,2.3),baseMat=material('#91a2b4');
   add(ent,'Weapon cache reactor','box',[0,0,0],[1.10,1.10,1.10],casing,[25,35,10]);
   add(ent,'Emissive signal core','sphere',[0,0,0],[.88,.88,.88],accent);
   add(ent,'High-vis upper fin','box',[0,1.05,0],[.16,.48,.16],baseMat);
   for(const side of [-1,1])add(ent,'Salvage ring fin','box',[side*.78,0,0],[.23,.32,.66],baseMat,[0,0,side*30]);
   this.pickups.push({id:'cache-'+i,type,position:pos,ent,active:true,cooldown:0,radius:3.3,angle:random()*6.28});
  }
 }
 updatePickups(dt){
  for(const p of this.pickups){if(!p.active){p.cooldown-=dt;if(p.cooldown<=0){p.active=true;p.ent.enabled=true;this.callback('pickupSpawn',{type:p.type});}continue;}
   p.angle+=dt;p.ent.rotateLocal(0,dt*24,dt*11);p.ent.setPosition(p.position.x,p.position.y+Math.sin(p.angle*1.4)*.7,p.position.z);
   for(const ship of this.ships){if(ship.hp<=0||ship.position.distance(p.position)>p.radius+ship.settings.radius)continue;
    if(this.collectPickup(ship,p))break;
   }
  }
 }
 collectPickup(ship,p){if(!p.active||!ship||ship.hp<=0)return false;const item=PICKUPS[p.type];
  if(item.kind==='weapon')ship.pickup={type:p.type,ammo:item.ammo};
  else if(p.type==='repair'){ship.hp=Math.min(ship.settings.hp,ship.hp+70);ship.shields=Math.min(ship.settings.shields,ship.shields+65);}
  else if(p.type==='resupply'){ship.missileAmmo+=12;ship.decoys+=2;}
  else if(p.type==='overcharge'){ship.overcharge=item.duration;}
  p.active=false;p.cooldown=item.respawn;p.ent.enabled=false;
  this.universe.burst(p.position,item.color,13,5,.38);
  this.callback('pickup',{pilot:ship.id,type:p.type,name:item.name,ammo:ship.pickup?.ammo});return true;
 }
 shootPickup(ship){if(!ship||!ship.pickup||ship.pickup.ammo<=0||ship.pickupCD>0||ship.hp<=0||ship.disabled>0)return false;
  const type=ship.pickup.type;ship.pickup.ammo--;ship.pickupCD=type==='railgun'?1.25:type==='scatter'?.75:3.3;
  if(type==='railgun'){this.startProjectile(ship,'railgun');}
  else if(type==='scatter'){for(let i=0;i<9;i++)this.startProjectile(ship,'scatter',{spread:.094,damage:8});}
  else if(type==='emp'){
   this.universe.burst(ship.position,'#b894ff',38,22,1.5);
   for(const e of this.enemiesFor(ship))if(e.position.distance(ship.position)<85){e.shields=Math.max(0,e.shields-25);e.disabled=Math.max(e.disabled,4.5);e.locked=false;e.lockProgress=0;}
  }
  this.callback('pickupWeapon',{pilot:ship.id,type});
  if(ship.pickup.ammo<=0)ship.pickup=null;return true;
 }
 triggerSpecial(ship){if(!ship||!specialReady(ship)||this.over||ship.disabled>0)return false;
  const spec=SPECIALS[ship.klass];ship.specialAmmo--;ship.specialCD=spec.cooldown;
  if(ship.klass==='interceptor'){
   const enemyList=this.enemiesFor(ship);for(let i=0;i<spec.count;i++){
    this.startProjectile(ship,'missile',{damage:spec.damage,spread:.22});
    const proj=this.projectiles[this.projectiles.length-1];const foe=enemyList[i%Math.max(1,enemyList.length)];
    proj.target=foe?{kind:'ship',id:foe.id}:null;proj.life=MISSILE.lifetime;
   }
  }else if(ship.klass==='fighter'){ship.specialCharging=spec.charge;}
  else this.startProjectile(ship,'nuke',{damage:spec.damage});
  this.callback('special',{pilot:ship.id,type:ship.klass,name:spec.name});return true;
 }
 fireNova(ship){const f=local(ship.rotation,FWD),start=ship.position.clone().add(f.clone().mulScalar(1));
  const reach=SPECIALS.fighter.range,end=start.clone().add(f.clone().mulScalar(reach));
  let stop=reach;for(const b of this.universe.worlds.values())if(b.alive){const t=segmentSphere(start,end,b.position,b.radius);if(t!=null)stop=Math.min(stop,reach*t);}
  const point=start.clone().add(f.clone().mulScalar(stop));
  const beam=add(this.app.root,'NOVA PULSE / blast corridor','cylinder',[(start.x+point.x)/2,(start.y+point.y)/2,(start.z+point.z)/2],[1.8,Math.max(.01,stop/2),1.8],material('#79e9ff',3.4),[90,0,0]);
  // pc.Cylinder's long dimension is local Y; align that axis with the firing vector.
  beam.lookAt(point);beam.rotateLocal(90,0,0);
  this.flashes.push({ent:beam,life:.34,max:.34,size:1.8,kind:'beam'});
  for(const enemy of this.enemiesFor(ship)){
   if(segmentSphere(start,point,enemy.position,enemy.settings.radius+3)!=null)this.hurtShip(enemy,SPECIALS.fighter.damage,ship.id,'nova');
  }
  for(const b of this.universe.worlds.values())if(b.alive&&b.group!=='star'){
   if(segmentSphere(start,point,b.position,b.radius)!=null&&this.universe.damagePlanet(b,240,ship.id,f.clone().mulScalar(100)))this.planetsDestroyed++;
  }
  this.universe.burst(point,'#b3fcff',39,15,.75);
  this.callback('nova',{pilot:ship.id});
 }
 detonateWarhead(point,shipOwner){
  const r=SPECIALS.dreadnought.radius,owner=this.ships[shipOwner];
  const shockMat=material('#fda36b',2.4);shockMat.opacity=.13;shockMat.blendType=pc.BLEND_NORMAL;shockMat.depthWrite=false;shockMat.cull=pc.CULLFACE_NONE;shockMat.update();
  const shock=add(this.app.root,'CATACLYSM / expanding shock front','sphere',[point.x,point.y,point.z],[1,1,1],shockMat);
  this.flashes.push({ent:shock,life:1.4,max:1.4,size:r*2,kind:'shock'});
  this.universe.burst(point,'#fff1d0',60,41,2.0);
  for(const ship of this.ships){if(ship.hp<=0||ship.id===shipOwner||ship.team===owner?.team)continue;
   const dmg=radialDamage(ship.position.distance(point),r,SPECIALS.dreadnought.damage);
   if(dmg>0){this.hurtShip(ship,dmg,shipOwner,'nuke');const away=ship.position.clone().sub(point);if(away.length()>.001)ship.vel.add(away.normalize().mulScalar(dmg*.11));}
  }
  for(const b of this.universe.worlds.values())if(b.alive&&b.group!=='star'){
   const dmg=radialDamage(Math.max(0,b.position.distance(point)-b.radius),r,1200);
   if(dmg>0&&this.universe.damagePlanet(b,dmg,shipOwner,V()))this.planetsDestroyed++;
  }
  for(const a of this.universe.asteroids)if(a.alive){a.hp-=radialDamage(a.position.distance(point),r,500);if(a.hp<=0)this.universe.destroyAsteroid(a,shipOwner);}
  this.callback('nuke',{pilot:shipOwner});
 }
 humanShip(i){return this.ships.find(s=>s.human&&s.id===i)}
 enemiesFor(s){return this.ships.filter(o=>o.hp>0&&o.id!==s.id&&o.team!==s.team)}
 targetInfo(ref){if(!ref)return null;
  if(ref.kind==='ship'){const o=this.ships[ref.id];return o?.hp>0?{id:o.id,name:o.name,kind:'ship',position:o.position,vel:o.vel,radius:o.settings.radius,hp:o.hp,maxHp:o.settings.hp,shields:o.shields,maxShields:o.settings.shields,team:o.team}:null;}
  const b=this.universe.get(ref.id);return b?.alive?{id:b.id,name:b.name,kind:'planet',position:b.position,vel:V(),radius:b.radius,hp:b.hp,maxHp:b.maxHp}:null;
 }
 lineOfSight(a,b,excludeBody=null){for(const planet of this.universe.worlds.values()){if(!planet.alive||planet.id===excludeBody)continue;
   const t=segmentSphere(a,b,planet.position,planet.radius+.3);if(t!==null&&t<.97)return false;}
  for(const obj of this.universe.structures){if(!obj.alive)continue;const t=segmentSphere(a,b,obj.position,obj.radius);if(t!==null&&t<.95)return false;}
  return true;
 }
 // Prefer what is close to the center of the player's aim, not simply the closest ship.
 optionsForTarget(ship){const candidates=ship.lockMode==='worlds'
  ?[...this.universe.worlds.values()].filter(b=>b.alive&&b.group!=='star'&&!b.exploding).map(b=>({kind:'planet',id:b.id,position:b.position}))
  :this.enemiesFor(ship).map(s=>({kind:'ship',id:s.id,position:s.position}));
  const f=local(ship.rotation,FWD);
  return candidates.map(t=>{const d=t.position.clone().sub(ship.position);return {...t,distance:d.length(),aim:Math.max(-1,d.clone().normalize().dot(f))};})
   .sort((a,b)=>(b.aim-a.aim)*3+(a.distance-b.distance)/500);
 }
 cycleTarget(ship,step=1){if(!ship)return;const targets=this.optionsForTarget(ship);if(!targets.length){ship.target=null;ship.lockProgress=0;ship.locked=false;return;}
  const index=targets.findIndex(t=>ship.target?.kind===t.kind&&ship.target?.id===t.id);
  const i=index<0?0:(index+step+targets.length)%targets.length;
  ship.target={kind:targets[i].kind,id:targets[i].id};ship.lockProgress=0;ship.locked=false;ship.lockNotified=false;this.callback('target',{pilot:ship.id,id:ship.target.id});
 }
 selectWorld(ship,id){if(!ship||!this.universe.get(id)?.alive||id==='sun')return false;
  ship.lockMode='worlds';ship.target={kind:'planet',id};ship.lockProgress=0;ship.locked=false;
  this.callback('target',{pilot:ship.id,id});return true;
 }
 toggleTargetMode(ship){if(!ship)return;ship.lockMode=ship.lockMode==='ships'?'worlds':'ships';ship.target=null;this.cycleTarget(ship,0);this.callback('targetMode',{pilot:ship.id,mode:ship.lockMode});}
 toggleView(ship){if(!ship?.camera)return;ship.view=ship.view==='chase'?'cockpit':'chase';ship.cockpit.enabled=ship.view==='cockpit';this.callback('view',{pilot:ship.id,view:ship.view});}
 toggleZoom(ship){if(!ship?.camera)return;ship.zoom=!ship.zoom;this.callback('zoom',{pilot:ship.id,zoom:ship.zoom});}
 updateLocks(dt){for(const s of this.ships){if(s.hp<=0)continue;
   if(!this.targetInfo(s.target)){s.target=null;s.locked=false;s.lockProgress=0;}
   if(!s.target){const best=this.optionsForTarget(s).find(t=>t.aim>.38&&t.distance<720);if(best)s.target={kind:best.kind,id:best.id};}
   const target=this.targetInfo(s.target);if(!target||target.kind!=='ship'){s.lockProgress=0;s.locked=false;continue;}
   const dir=target.position.clone().sub(s.position),dist=dir.length();const facing=local(s.rotation,FWD).dot(dir.clone().normalize());
   const eligible=s.disabled<=0&&dist<750&&dist>1&&facing>Math.cos(26*Math.PI/180)&&this.lineOfSight(s.position,target.position);
   const prev=s.locked;const result=advanceLock(s.lockProgress,eligible,dt,s.settings.lockTime);
   s.lockProgress=result.progress;s.locked=result.locked;
   if(s.locked&&!prev){this.callback('lock',{pilot:s.id,id:target.id});}
  }}
 launchDecoy(ship){
  if(!ship||ship.hp<=0||ship.decoys<=0||ship.decoyCD>0)return false;
  ship.decoys--;ship.decoyCD=7.6;
  const back=local(ship.rotation,FWD).mulScalar(-1),right=local(ship.rotation,RIGHT);
  const pos=ship.position.clone().add(back.clone().mulScalar(1.05));
  const root=new pc.Entity('Autonomous electronic warfare decoy satellite');this.app.root.addChild(root);root.setPosition(pos);
  const shell=material('#c8dce8'),panel=material('#26465f'),beacon=material('#6bedf7',2.7);
  add(root,'Decoy smart sphere','sphere',[0,0,0],[.21,.21,.21],shell);
  for(const side of [-1,1]){
   add(root,'Deployable solar wing','box',[side*.36,0,0],[.48,.035,.19],panel);
   add(root,'Antenna post','cylinder',[side*.12,.24,0],[.025,.3,.025],shell);
  }
  add(root,'Blinking infrared lure','sphere',[0,.23,0],[.07,.07,.07],beacon);
  const vel=ship.vel.clone().add(back.clone().mulScalar(5)).add(right.clone().mulScalar((ship.id%2?1:-1)*2));
  this.decoys.push({position:pos,vel,ent:root,life:9,owner:ship.id,team:ship.team,radius:.36});
  this.callback('decoy',{pilot:ship.id});return true;
 }
 startProjectile(ship,type,extra={}){const missile=type==='missile'||type==='nuke',f=local(ship.rotation,FWD),r=local(ship.rotation,RIGHT),u=local(ship.rotation,UP);
  ship.fireIndex++;const side=ship.fireIndex%2===0?1:-1;
  const at=ship.position.clone().add(f.clone().mulScalar(ship.settings.radius*1.5)).add(r.clone().mulScalar(side*ship.settings.radius*.68));
  // Soft aim attraction is small and only activates within a narrow cone.
  // It never guarantees a hit; the reticle lead marker still drives accurate shooting.
  if(!missile&&ship.human&&this.assist>0){const info=this.targetInfo(ship.target);
   if(info?.kind==='ship'){const point=predictIntercept(at,info.position,info.vel,ship.vel,132).point;
    const desired=V(point.x,point.y,point.z).sub(at).normalize(),angle=Math.acos(clamp(f.dot(desired),-1,1)),limit=.18;
    if(angle<limit)f.lerp(f,desired,this.assist*(1-angle/limit)).normalize();
   }}
  if(extra.spread){f.add(V((random()-.5)*extra.spread,(random()-.5)*extra.spread,(random()-.5)*extra.spread)).normalize();}
  const speed=type==='nuke'?87:missile?MISSILE.initialSpeed:type==='railgun'?295:type==='scatter'?105:132;
  const projectile={owner:ship.id,team:ship.team,type,position:at,velocity:f.clone().mulScalar(speed).add(ship.vel.clone().mulScalar(.45)),
   damage:extra.damage??(type==='nuke'?SPECIALS.dreadnought.damage:missile?ship.settings.missileDamage:type==='railgun'?92:type==='scatter'?8:ship.settings.laserDamage*(ship.overcharge>0?1.6:1)),
   life:type==='nuke'?4.3:missile?MISSILE.lifetime:type==='railgun'?5.5:4.4,age:0,target:type==='missile'&&ship.locked?{...ship.target}:null,decoy:null,
   radius:type==='nuke'?.55:missile?.17:.095,launchDirection:f.clone(),trailHistory:[],lostContact:0,lastKnown:null};
  projectile.entity=buildWeaponSprite(this.app,missile,at,missile?this.missileMat:this.weaponMats[ship.id]);
  projectile.trail=Array.from({length:missile?7:5},(_,i)=>{const ent=add(this.app.root,'Energy exhaust trail','sphere',[at.x,at.y,at.z],[.10,.10,.10],missile?this.missileMat:this.weaponMats[ship.id]);return ent});
  this.projectiles.push(projectile);this.projectilesFired++;ship.shotFlash=.15;
  this.callback('shoot',{owner:ship.id,type});
 }
 shoot(ship,type){if(!ship||ship.hp<=0||this.paused||this.over)return false;
  if(type==='missile'){
   if(ship.missileCD>0||ship.missileAmmo<=0)return false;
   if(ship.lockMode==='ships'&&!ship.locked)return false;
   ship.missileAmmo--;ship.missileCD=ship.settings.missileDelay;this.startProjectile(ship,type);return true;
  }
  if(ship.laserCD>0||ship.laserHeat>.92)return false;
  ship.laserCD=ship.settings.laserDelay;ship.laserHeat=clamp(ship.laserHeat+.16,0,1.12);
  this.startProjectile(ship,type);return true;
 }
 hurtShip(ship,amount,attacker=null,cause='weapons'){if(!ship||ship.hp<=0)return;
  if(cause!=='laser'&&cause!=='missile'&&ship.impactCooldown>0)return;
  ship.impactCooldown=cause==='laser'?.045:.25;
  const result=applyDamage(ship,amount);ship.shotFlash=.22;ship.cameraShake=Math.min(.5,ship.cameraShake+amount/220);
  this.universe.burst(ship.position,result.absorbed>0?'#5adfff':'#ff9986',Math.min(14,4+Math.round(amount/12)),6);
  if(attacker!=null&&attacker!==ship.id&&this.ships[attacker])this.ships[attacker].damage+=result.dealt;
  if(result.killed){ship.alive=false;ship.model.root.enabled=false;ship.cockpit&&(ship.cockpit.enabled=false);
   this.universe.burst(ship.position,'#ffc4a5',33,16);
   if(attacker!=null&&attacker!==ship.id&&this.ships[attacker]){this.ships[attacker].kills++;this.kills.push({by:attacker,victim:ship.id});}
   this.callback('kill',{by:attacker,victim:ship.id,cause});const winner=findWinner(this.ships);if(winner){this.over=true;this.callback('winner',winner);}
  }
 }
 hitProjectile(p,last){let hit=null,minimum=Infinity;const end=p.position;
  const test=(kind,o,r,pos)=>{const t=segmentSphere(last,end,pos,r);if(t!==null&&t<minimum){minimum=t;hit={kind,o}}};
  for(const ship of this.ships)if(ship.hp>0&&ship.id!==p.owner&&ship.team!==p.team)test('ship',ship,ship.settings.radius+.21,ship.position);
  for(const b of this.universe.worlds.values())if(b.alive)test('planet',b,b.radius,b.position);
  for(const a of this.universe.asteroids)if(a.alive)test('asteroid',a,a.radius,a.position);
  for(const s of this.universe.structures)if(s.alive)test('structure',s,s.radius,s.position);
  for(const d of this.universe.debris)test('debris',d,d.radius*.9,d.pos);
  if(!hit)return false;
  const point=last.clone().lerp(last,end,minimum),obj=hit.o;
  this.universe.burst(point,p.type==='missile'||p.type==='nuke'?'#ffad72':'#a6f6ff',p.type==='missile'?24:9,p.type==='missile'?12:5);
  if(p.type==='nuke'){this.detonateWarhead(point,p.owner);return true;}
  if(hit.kind==='ship')this.hurtShip(obj,p.damage,p.owner,p.type);
  if(hit.kind==='planet'){
   const broken=this.universe.damagePlanet(obj,calculatePlanetDamage(p.type,p.damage),p.owner,p.velocity);
   if(broken){this.planetsDestroyed++;for(const s of this.ships)if(s.target?.kind==='planet'&&s.target.id===obj.id)s.target=null;}
  }
  if(hit.kind==='asteroid'){obj.hp-=p.damage*(p.type==='missile'?2.6:1);if(obj.hp<=0)this.universe.destroyAsteroid(obj,p.owner);}
  if(hit.kind==='structure'){obj.hp-=p.damage;if(obj.hp<=0)this.universe.destroyStructure(obj,p.owner);}
  if(hit.kind==='debris'){obj.hp-=p.damage;if(obj.hp<=0){obj.ent.destroy();this.universe.debris.splice(this.universe.debris.indexOf(obj),1)}else obj.vel.add(p.velocity.clone().normalize().mulScalar(1.5));}
  return true;
 }
 // Angularly constrained pursuit. Missiles accelerate and cannot turn instantly.
 moveProjectiles(dt){for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i],last=p.position.clone();p.age+=dt;p.life-=dt;
   if(p.type==='missile'){
    let aim=null,targetVelocity=V();
    if(p.decoy&&p.decoy.life>0){aim=p.decoy.position.clone();targetVelocity=p.decoy.vel.clone();}
    else if(p.target){const info=this.targetInfo(p.target);
     if(info&&info.position.distance(p.position)<MISSILE.sensorRange){
      const visible=this.lineOfSight(p.position,info.position);
      if(visible){p.lastKnown=info.position.clone();p.lostContact=0;}else p.lostContact+=dt;
      if(p.lostContact<=MISSILE.memorySeconds){aim=visible?info.position.clone():p.lastKnown?.clone();targetVelocity=visible?info.vel.clone():V();}
      if(aim)for(const decoy of this.decoys){if(decoy.team===p.team||decoy.life<=0)continue;
       if(decoy.position.distance(p.position)<125&&decoy.position.distance(p.position)<info.position.distance(p.position)*1.85){p.decoy=decoy;aim=decoy.position.clone();targetVelocity=decoy.vel.clone();break;}
      }
     }else p.lostContact+=dt;
     if(p.lostContact>MISSILE.memorySeconds)p.target=null;
    }
    if(aim){const v=missileStep(p.velocity,p.position,aim,targetVelocity,dt);p.velocity.set(v.x,v.y,v.z);}
    else{const speed=Math.min(MISSILE.maxSpeed,p.velocity.length()+dt*MISSILE.acceleration);
     p.velocity.normalize().mulScalar(speed);}
   }
   p.position.add(p.velocity.clone().mulScalar(dt));p.entity.setPosition(p.position);p.entity.lookAt(p.position.clone().add(p.velocity));
   const iceHit=this.universe.checkOortWall(p.position,last,p.radius).blocked;
   if(iceHit){p.life=0;}
   p.trailHistory.unshift(last);if(p.trailHistory.length>p.trail.length)p.trailHistory.pop();p.trail.forEach((ent,j)=>{const pos=p.trailHistory[Math.min(j,p.trailHistory.length-1)]||p.position;ent.setPosition(pos);const sz=(1-j/p.trail.length)*(p.type==='missile'?.23:.16);ent.setLocalScale(sz,sz,sz)});
   let decoyHit=false;if(p.type==='missile')for(const d of this.decoys){if(d.team===p.team||d.life<=0)continue;if(segmentSphere(last,p.position,d.position,d.radius+.34)!==null){d.life=0;this.universe.burst(d.position,'#b2f8ff',26,17);decoyHit=true;break}}
   const hit=decoyHit||this.hitProjectile(p,last);
   if(p.type==='nuke'&&!hit&&p.life<=0)this.detonateWarhead(p.position,p.owner);
   if(hit||p.life<=0){p.entity.destroy();p.trail.forEach(e=>e.destroy());this.projectiles.splice(i,1);}
  }
  for(let i=this.decoys.length-1;i>=0;i--){const d=this.decoys[i];d.life-=dt;
   d.position.add(d.vel.clone().mulScalar(dt));d.vel.mulScalar(Math.exp(-dt*.09));
   const wall=this.universe.checkOortWall(d.position,d.position,d.radius);if(wall.blocked){d.position.set(wall.contact.x,wall.contact.y,wall.contact.z);d.life=0;this.universe.oortBurst(d.position);}
   d.ent.setPosition(d.position);d.ent.rotateLocal(0,dt*55,dt*15);
   if(d.life<=0){d.ent.destroy();this.decoys.splice(i,1)}
  }
 }
 steerHuman(s,dt,input){const cfg=s.settings;
  const dx=clamp(input.mouseX||0,-100,100)*.0028*cfg.turn;
  const dy=clamp(input.mouseY||0,-100,100)*.0028*cfg.turn;
  s.omega.y+=(input.yaw||0)*cfg.turn*dt+dx;s.omega.x+=(input.pitch||0)*cfg.turn*dt+dy;s.omega.z+=(input.roll||0)*cfg.turn*dt;
  s.omega.mulScalar(Math.exp(-dt*3.9));const cap=cfg.turn*.9;
  for(const axis of ['x','y','z'])s.omega[axis]=clamp(s.omega[axis],-cap,cap);
  const qy=new pc.Quat().setFromAxisAngle(UP,s.omega.y*dt*DEG),qx=new pc.Quat().setFromAxisAngle(RIGHT,s.omega.x*dt*DEG),qz=new pc.Quat().setFromAxisAngle(FWD,s.omega.z*dt*DEG);
  s.rotation.mul(qy).mul(qx).mul(qz).normalize();
  const f=local(s.rotation,FWD),r=local(s.rotation,RIGHT),u=local(s.rotation,UP);
  s.boosting=!!input.boost;
  s.vel.add(f.clone().mulScalar((input.thrust||0)*cfg.acceleration*dt*(s.boosting?1.43:1)));
  s.vel.add(r.mulScalar((input.strafe||0)*cfg.acceleration*.60*dt));s.vel.add(u.mulScalar((input.vertical||0)*cfg.acceleration*.60*dt));
  if(input.brake&&s.vel.length()>.01){const reduction=Math.min(s.vel.length(),cfg.acceleration*.85*dt);s.vel.sub(s.vel.clone().normalize().mulScalar(reduction))}
  if(s.disabled<=0){if(input.primary)this.shoot(s,'laser');if(input.secondary)this.shoot(s,'missile');if(input.pickup)this.shootPickup(s);if(input.special)this.triggerSpecial(s);}
  if(s.vel.length()>cfg.maxSpeed)s.vel.mulScalar(cfg.maxSpeed/s.vel.length());
 }
 steerBot(s,dt){const enemies=this.enemiesFor(s);if(!enemies.length)return;
  enemies.sort((a,b)=>a.position.distance(s.position)-b.position.distance(s.position));const target=enemies[0];
  if(s.target?.kind!=='ship'||s.target.id!==target.id){s.target={kind:'ship',id:target.id};s.lockProgress=0;s.locked=false;}
  const intercept=predictIntercept(s.position,target.position,target.vel,s.vel,132);
  const aim=V(intercept.point.x,intercept.point.y,intercept.point.z);
  const pickup=chooseBotPickup(s,this.pickups);
  // Supply runs are a real combat decision: damage, ammunition and rarity change priority.
  const pickupPriority=pickup&&s.position.distance(pickup.position)<155&&
   (s.hp<s.settings.hp*.62||s.missileAmmo<5||!s.pickup||s.klass==='interceptor'&&s.overcharge<=0);
  if(pickupPriority){aim.copy(pickup.position);s.botPickupGoal=pickup.id;}else s.botPickupGoal=null;
  const delta=aim.clone().sub(s.position),range=delta.length();
  const dodge=V();for(const body of this.universe.worlds.values()){if(!body.alive)continue;const offset=s.position.clone().sub(body.position),d=offset.length()-body.radius;if(d<26&&d>0)dodge.add(offset.normalize().mulScalar((26-d)*2))}
  for(const a of this.universe.asteroids){if(!a.alive)continue;const offset=s.position.clone().sub(a.position),d=offset.length()-a.radius;if(d<6&&d>0)dodge.add(offset.normalize().mulScalar((6-d)*2))}
  for(const chunk of this.universe.debris){const offset=s.position.clone().sub(chunk.pos),d=offset.length()-chunk.radius;if(d<9&&d>0)dodge.add(offset.normalize().mulScalar((9-d)*1.8))}
  const iceDist=this.universe.OORT_INNER_RADIUS-s.position.length();
  if(iceDist<130){const back=s.position.clone().mulScalar(-1).normalize();dodge.add(back.mulScalar((130-iceDist)*.95));}
  aim.add(dodge);
  const ghost=s.model.root;ghost.setPosition(s.position);ghost.lookAt(aim);const wanted=ghost.getRotation().clone();
  const difficultyTurn=this.difficulty==='veteran'?1.9:this.difficulty==='rookie'?.7:1.25;
  s.rotation.slerp(s.rotation,wanted,clamp(dt*difficultyTurn,0,1));
  const f=local(s.rotation,FWD),facing=f.dot(delta.clone().normalize());
  const approach=range>27?1:range<12?-.45:.15;
  s.vel.add(f.clone().mulScalar(s.settings.acceleration*dt*approach*.7));
  if(range<14&&s.vel.length()>2.5)s.vel.sub(s.vel.clone().normalize().mulScalar(Math.min(s.vel.length(),s.settings.acceleration*.45*dt)));
  s.vel.add(local(s.rotation,RIGHT).mulScalar(Math.sin(this.elapsed*.6+s.id*3.1)*dt*1.4));
  const cap=s.settings.maxSpeed*.67;if(s.vel.length()>cap)s.vel.mulScalar(cap/s.vel.length());
  if(s.disabled<=0&&this.elapsed>3&&!pickupPriority&&facing>.978&&range<145&&this.lineOfSight(s.position,target.position)&&random()>(this.difficulty==='veteran'?.23:this.difficulty==='rookie'?.67:.42))this.shoot(s,'laser');
  if(s.disabled<=0&&this.elapsed>5&&s.locked&&range<180&&random()>(this.difficulty==='veteran'?.89:.978))this.shoot(s,'missile');
  if(s.disabled<=0){
   if(s.pickup?.ammo>0&&range<125&&facing>.80&&random()>(this.difficulty==='veteran'?.92:.978))this.shootPickup(s);
   if(specialReady(s)&&range<175&&facing>.82&&random()>(this.difficulty==='veteran'?.989:this.difficulty==='rookie'?.9992:.994))this.triggerSpecial(s);
  }
  const inbound=this.projectiles.find(p=>p.type==='missile'&&p.target?.id===s.id&&p.target.kind==='ship'&&p.team!==s.team&&p.position.distance(s.position)<100);
  if(inbound&&s.decoys>0&&random()>(this.difficulty==='rookie'?.997:.96))this.launchDecoy(s);
 }
 moveShips(dt,inputs){for(const s of this.ships){if(s.hp<=0)continue;
   s.laserCD=Math.max(0,s.laserCD-dt);s.missileCD=Math.max(0,s.missileCD-dt);s.laserHeat=Math.max(0,s.laserHeat-dt*.23);
   s.decoyCD=Math.max(0,s.decoyCD-dt);s.pickupCD=Math.max(0,s.pickupCD-dt);s.specialCD=Math.max(0,s.specialCD-dt);s.overcharge=Math.max(0,s.overcharge-dt);s.disabled=Math.max(0,s.disabled-dt);
   if(s.specialCharging>0){s.specialCharging-=dt;if(s.specialCharging<=0&&s.hp>0)this.fireNova(s);}
   s.impactCooldown=Math.max(0,s.impactCooldown-dt);s.cameraShake=Math.max(0,s.cameraShake-dt*.55);
   const before=s.position.clone();if(s.human)this.steerHuman(s,dt,inputs[s.id]||{});else this.steerBot(s,dt);
   const pull=oortForce(s.position,s.vel,this.universe.OORT_INNER_RADIUS);s.vel.add(V(pull.x,pull.y,pull.z).mulScalar(dt));
   s.vel.mulScalar(Math.exp(-dt*.012));s.position.add(s.vel.clone().mulScalar(dt));
   const wall=this.universe.checkOortWall(s.position,before,s.settings.radius);
   if(wall.blocked){
    const normal=V(wall.normal.x,wall.normal.y,wall.normal.z),outwardSpeed=Math.max(0,s.vel.dot(normal));
    s.position.set(wall.contact.x,wall.contact.y,wall.contact.z);
    if(outwardSpeed>0)s.vel.sub(normal.clone().mulScalar(outwardSpeed*1.1));
    s.cameraShake=Math.min(.5,s.cameraShake+.2);
    if(s.impactCooldown<=0){this.callback('oortImpact',{pilot:s.id,speed:outwardSpeed});s.impactCooldown=1.5;}
   }
   for(const planet of this.universe.worlds.values()){if(!planet.alive)continue;
    const radius=planet.radius+s.settings.radius*.8;if(segmentSphere(before,s.position,planet.position,radius)===null)continue;
    const n=s.position.clone().sub(planet.position);if(n.length()<.01)n.set(0,1,0);n.normalize();
    s.position.copy(planet.position).add(n.clone().mulScalar(radius+.3));const approach=Math.max(0,-s.vel.dot(n));
    this.hurtShip(s,10+approach*4,null,'planet impact');s.vel.sub(n.clone().mulScalar(Math.min(0,s.vel.dot(n))*1.7)).mulScalar(.48);break;
   }
   for(const structure of this.universe.structures){if(!structure.alive)continue;const d=s.position.distance(structure.position);if(d>structure.radius+s.settings.radius)continue;this.hurtShip(s,22,null,'structure collision');structure.hp-=20;if(structure.hp<=0)this.universe.destroyStructure(structure,s.id);const n=s.position.clone().sub(structure.position).normalize();s.position.add(n.mulScalar(2));s.vel.mulScalar(-.28)}
   for(const a of this.universe.asteroids){if(!a.alive)continue;const d=s.position.distance(a.position);if(d>=a.radius+s.settings.radius)continue;
    const normal=s.position.clone().sub(a.position).normalize(),speed=Math.max(0,-s.vel.dot(normal));this.hurtShip(s,8+speed*2,null,'asteroid collision');
    s.position.copy(a.position).add(normal.clone().mulScalar(a.radius+s.settings.radius+.15));s.vel.add(normal.mulScalar(Math.max(1,speed*1.2)));a.hp-=speed*3;if(a.hp<=0)this.universe.destroyAsteroid(a,s.id);
   }
   for(const d of this.universe.debris){const off=s.position.clone().sub(d.pos),dist=off.length(),radius=s.settings.radius+d.radius;if(dist>=radius||dist<.0001)continue;
    const n=off.normalize(),relative=s.vel.clone().sub(d.vel),impact=Math.max(0,-relative.dot(n));if(impact>.5){this.hurtShip(s,6+impact*2,null,'rubble impact');s.vel.add(n.clone().mulScalar(impact*.6));d.vel.sub(n.clone().mulScalar(impact*.25))}s.position.copy(d.pos).add(n.mulScalar(radius+.06));
   }
   s.model.root.setPosition(s.position);s.model.root.setRotation(s.rotation);s.model.thrusts.forEach(e=>e.setLocalScale(.15,s.boosting?.59:.36,.15));
  }
  for(let i=0;i<this.ships.length;i++)for(let j=i+1;j<this.ships.length;j++){const a=this.ships[i],b=this.ships[j];if(a.hp<=0||b.hp<=0)continue;
   const dir=a.position.clone().sub(b.position),len=dir.length(),r=a.settings.radius+b.settings.radius;if(len>=r||len<.0001)continue;
   const n=dir.normalize(),closing=Math.max(0,(b.vel.dot(n)-a.vel.dot(n))*.8);
   a.position.add(n.clone().mulScalar((r-len)*.52));b.position.sub(n.clone().mulScalar((r-len)*.52));a.vel.add(n.clone().mulScalar(closing));b.vel.sub(n.clone().mulScalar(closing));
   if(closing>2){this.hurtShip(a,closing*2.6,b.id,'ship collision');this.hurtShip(b,closing*2.6,a.id,'ship collision')}
  }
 }
 updateCamera(s,dt){if(!s.camera)return;
  const forward=local(s.rotation,FWD),up=local(s.rotation,UP),right=local(s.rotation,RIGHT);
  let desired;if(s.view==='cockpit'){desired=s.position.clone().add(forward.clone().mulScalar(s.settings.radius*1.45)).add(up.clone().mulScalar(.20));s.camera.setPosition(desired);s.camera.setRotation(s.rotation);}
  else{desired=s.position.clone().sub(forward.clone().mulScalar(s.klass==='dreadnought'?2.9:2.2)).add(up.clone().mulScalar(s.klass==='dreadnought'?1.15:.86));const blend=1-Math.exp(-dt*7.3);const pos=s.camera.getPosition().clone();s.camera.setPosition(pos.clone().lerp(pos,desired,blend));s.camera.lookAt(s.position.clone().add(forward.clone().mulScalar(13)));}
  if(s.cameraShake>.01){s.camera.translateLocal((random()-.5)*s.cameraShake*.3,(random()-.5)*s.cameraShake*.3,0)}
  const targetFov=s.zoom?(s.view==='cockpit'?35:42):s.view==='cockpit'?53:s.boosting?62:57;s.camera.camera.fov+=(targetFov-s.camera.camera.fov)*(1-Math.exp(-dt*5));
 }
 update(dt,inputs){if(this.over||this.paused)return;dt=clamp(dt,0,.04);this.elapsed+=dt;this.frameCount++;
  // Target locks update both human and bot systems; acquired locks are not instant.
  this.moveShips(dt,inputs);this.updateLocks(dt);this.moveProjectiles(dt);this.updatePickups(dt);this.universe.update(dt);
  for(let i=this.flashes.length-1;i>=0;i--){const fx=this.flashes[i];fx.life-=dt;if(fx.kind==='shock'){const progress=1-fx.life/fx.max;const scale=Math.max(.1,fx.size*progress);fx.ent.setLocalScale(scale,scale,scale);}
   if(fx.life<=0){fx.ent.destroy();this.flashes.splice(i,1);}}
  for(const ship of this.ships){if(ship.hp<=0)continue;const exposure=this.universe.checkSolarPulse(ship.position,ship.id);if(!exposure)continue;
   if(exposure.shadowed)this.callback('solarShelter',{pilot:ship.id});
   else{this.hurtShip(ship,exposure.damage,null,'solar wind');ship.vel.add(exposure.direction.mulScalar(exposure.impulse));this.callback('solarHit',{pilot:ship.id,damage:exposure.damage});}
  }
  for(const s of this.ships)if(s.human)this.updateCamera(s,dt);
  if(this.frameCount%2===0){const winner=findWinner(this.ships);if(winner&&!this.over){this.over=true;this.callback('winner',winner)}}
 }
 getLead(ship){const info=this.targetInfo(ship.target);if(!info)return null;
  const estimate=predictIntercept(ship.position,info.position,info.vel,ship.vel,132);return V(estimate.point.x,estimate.point.y,estimate.point.z);
 }
 incoming(ship){return this.projectiles.filter(p=>p.type==='missile'&&p.team!==ship.team&&p.target?.kind==='ship'&&p.target.id===ship.id).length;}
 getShipStatus(s){const target=this.targetInfo(s.target);return {id:s.id,name:s.name,klass:s.klass,hp:s.hp,hpMax:s.settings.hp,shield:s.shields,shieldMax:s.settings.shields,
  speed:s.vel.length(),laserCD:s.laserCD,laserHeat:s.laserHeat,missileCD:s.missileCD,missileAmmo:s.missileAmmo,decoys:s.decoys,decoyCD:s.decoyCD,
  pickup:s.pickup?.type||null,pickupAmmo:s.pickup?.ammo||0,special:SPECIALS[s.klass].name,specialAmmo:s.specialAmmo,specialCD:s.specialCD,specialCharging:s.specialCharging,overcharge:s.overcharge,disabled:s.disabled,
  target:target?.name||'NO TARGET',targetHp:target?.hp,targetHpMax:target?.maxHp,targetShields:target?.shields,range:target?s.position.distance(target.position):null,
  lockProgress:s.lockProgress,locked:s.locked,lockMode:s.lockMode,kills:s.kills,damage:s.damage,team:s.team,alive:s.hp>0,view:s.view,zoom:s.zoom,incoming:this.incoming(s)};}
}
