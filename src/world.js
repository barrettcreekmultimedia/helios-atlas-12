import pc from './engine.js';
import {BODIES,OORT_INNER_RADIUS,OORT_VISUAL_RADIUS} from './data.js';
import {textureCandidates} from './atlas.js';
import {clamp,lcg,shadowedFromSun,SOLAR_PULSE,reachesSolarFront,iceFieldContact} from './rules.js';
import {material,emissiveMaterial as makeEmissive,add,fragment,makeFragmentMesh,randBetween} from './graphics.js';
const TAU=Math.PI*2,rng=lcg(927811);
const V=(x=0,y=0,z=0)=>new pc.Vec3(x,y,z);
const rand=(a,b)=>a+(b-a)*rng();
function sphereMesh(device){const p=[],norm=[],uv=[],idx=[],stacks=64,slices=128;
 for(let i=0;i<=stacks;i++){const lat=Math.PI/2-i*Math.PI/stacks;for(let j=0;j<=slices;j++){const lon=-Math.PI+j*TAU/slices;const x=Math.cos(lat)*Math.sin(lon),y=Math.sin(lat),z=-Math.cos(lat)*Math.cos(lon);p.push(x*.5,y*.5,z*.5);norm.push(x,y,z);uv.push(j/slices,1-i/stacks)}}
 for(let i=0;i<stacks;i++)for(let j=0;j<slices;j++){const a=i*(slices+1)+j,b=a+1,d=a+slices+1,e=d+1;idx.push(a,b,d,b,e,d)}
 const mesh=new pc.Mesh(device);mesh.setPositions(p);mesh.setNormals(norm);mesh.setUvs(0,uv);mesh.setIndices(idx);mesh.update();return mesh;
}
function tryTexture(device,urls,done){let k=0;function attempt(){if(k>=urls.length)return;const url=urls[k++],img=new Image();img.crossOrigin='anonymous';img.onload=()=>{try{const t=new pc.Texture(device,{format:pc.PIXELFORMAT_RGBA8,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,mipmaps:true});t.addressU=pc.ADDRESS_REPEAT;t.addressV=pc.ADDRESS_CLAMP_TO_EDGE;t.setSource(img);done(t,url)}catch(e){attempt()}};img.onerror=attempt;img.src=url;}attempt()}
// One texture-mapped celestial sphere instead of thousands of ice meshes and star entities.
// The equirectangular panorama is a bundled original procedural artwork.
function createCosmos(app){
 const root=new pc.Entity('360 degree Milky Way panorama');app.root.addChild(root);
 const mesh=sphereMesh(app.graphicsDevice),texMat=new pc.StandardMaterial();
 texMat.useLighting=false;texMat.diffuse=new pc.Color(1,1,1);texMat.emissive=new pc.Color(1,1,1);texMat.emissiveIntensity=1.25;
 texMat.cull=pc.CULLFACE_NONE;texMat.depthWrite=false;texMat.update();
 root.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,texMat,root)]});
 root.setLocalScale(2*4200,2*4200,2*4200);
 tryTexture(app.graphicsDevice,['assets/sky/cosmic-panorama.webp'],tex=>{
  texMat.diffuseMap=tex;texMat.emissiveMap=tex;texMat.update();
 });
 return root;
}
// Procedural ring bands; only Saturn/Uranus, scaled to each planet.
function makeRings(app,body){
 const parent=new pc.Entity(body.name+' orbital ice ring system');body.root.addChild(parent);
 parent.setLocalEulerAngles(body.id==='uranus'?81:24,0,body.id==='uranus'?15:11);
 const bands=body.id==='saturn'?[[1.20,1.35,.37,'#c2a687'],[1.38,1.61,.61,'#f2dfbd'],[1.67,1.98,.62,'#b99f7e'],[2.04,2.23,.42,'#e4d2b6']]:[[1.36,1.40,.28,'#99bfc5'],[1.6,1.66,.25,'#87b2bd']];
 for(const [r0,r1,alpha,col] of bands){const positions=[],uv=[],idx=[],N=90;
  for(let k=0;k<=N;k++){const a=k/N*TAU;for(const r of [r0,r1]){positions.push(Math.cos(a)*r*body.radius,0,Math.sin(a)*r*body.radius);uv.push(k/N,(r-r0)/(r1-r0))}if(k<N){const j=k*2;idx.push(j,j+2,j+1,j+1,j+2,j+3)}}
  const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(positions);mesh.setUvs(0,uv);mesh.setIndices(idx);mesh.update();
  const mat=makeEmissive(col,alpha);const e=new pc.Entity('Ring band');e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat,e)]});parent.addChild(e);
 }
}
export function createUniverse(app,onEvent=()=>{},quality='balanced'){
 const globe=sphereMesh(app.graphicsDevice),shardMesh=makeFragmentMesh(app.graphicsDevice);
 const worlds=new Map(),debris=[],effects=[],asteroids=[],structures=[],ruptures=[];
 const cosmos=createCosmos(app);
 const oortIce=[]; // V10: boundary is a cheap navigational force, not a field of meshes.
 app.scene.ambientLight=new pc.Color(.30,.35,.40);
 const sunLight=new pc.Entity('Helios directional starlight');sunLight.addComponent('light',{type:'directional',color:new pc.Color(1,.85,.74),intensity:2.9,castShadows:false});sunLight.setLocalEulerAngles(55,12,-10);app.root.addChild(sunLight);
 const sunPoint=new pc.Entity('Central star illumination');sunPoint.addComponent('light',{type:'point',color:new pc.Color(1,.53,.26),range:1250,intensity:8});app.root.addChild(sunPoint);
 for(const d of BODIES){
  const root=new pc.Entity(d.name);app.root.addChild(root);root.setPosition(...d.pos);
  const visual=new pc.Entity('Cartographic world / '+d.name);root.addChild(visual);
  const surface=new pc.StandardMaterial();surface.diffuse=new pc.Color(1,1,1);surface.emissive=d.group==='star'?new pc.Color(1,.72,.35):new pc.Color(.16,.14,.15);surface.emissiveIntensity=d.group==='star'?2.7:.32;surface.gloss=.22;surface.update();
  visual.addComponent('render',{meshInstances:[new pc.MeshInstance(globe,surface,visual)]});visual.setLocalScale(d.size*2,d.size*2,d.size*2);
  tryTexture(app.graphicsDevice,[`assets/${d.texture}.jpg`],tex=>{surface.diffuseMap=tex;if(d.group==='star')surface.emissiveMap=tex;surface.update()});
  // V10 uses bundled textures only: no remote image dependencies or CORS issues.
  if(d.id==='sun'){
   const halo=add(root,'Inner solar corona','sphere',[0,0,0],[d.size*2.22,d.size*2.22,d.size*2.22],makeEmissive('#fbaa54',.065));
   halo.enabled=true;
  }else if(d.group==='planet'){
   add(root,'Outer atmosphere','sphere',[0,0,0],[d.size*2.032,d.size*2.032,d.size*2.032],makeEmissive(d.id==='jupiter'?'#a9c8e8':d.id==='mars'?'#fd987e':'#8ac9ff',.085));
  }
  const b={id:d.id,name:d.name,kind:d.kind,group:d.group,data:d,root,visual,material:surface,position:V(...d.pos),radius:d.size,alive:true,exploding:false,maxHp:d.hp,hp:d.hp,hitFlash:0,scars:[],rupture:null};worlds.set(d.id,b);
  if(d.id==='saturn'||d.id==='uranus')makeRings(app,b);
 }
 // Mining rubble is distributed in the far orbital environment, not across the combat centre.
 const rockMaterials=['#69717e','#8d8d92','#a18d86','#615a66'].map(x=>material(x));
 for(let i=0;i<(quality==='performance'?105:quality==='balanced'?175:240);i++){
  const aroundJupiter=i<188,angle=rng()*TAU,rad=aroundJupiter?340+rng()*360:740+rng()*155;
  const position=aroundJupiter?V(1140+Math.cos(angle)*rad,(rng()-.5)*140,80+Math.sin(angle)*rad):V(Math.cos(angle)*rad,(rng()-.5)*80,Math.sin(angle)*rad);
  if([...worlds.values()].some(b=>position.distance(b.position)<b.radius+6))continue;
  const radius=.55+rng()*2.2;
  const ent=fragment(app,shardMesh,rockMaterials[i%rockMaterials.length],'Destroyable asteroid '+i);
  ent.setPosition(position);ent.setLocalScale(radius*1.2,radius*(.5+rng()),radius*.9);ent.setLocalEulerAngles(rng()*360,rng()*360,rng()*360);
  asteroids.push({id:'rock-'+i,ent,position,radius,hp:48+radius*22,alive:true});
 }
 // Satellites are now compact sensor relays, not enormous stations or giant artificial moons.
 const stationMat=material('#647c91'),pane=material('#72d9ed',1.5),solarPanel=material('#244c67');
 const structureOffsets=[[1490,18,92],[1480,-22,-170],[1595,34,220],[1090,90,-336]];
 for(let i=0;i<structureOffsets.length;i++){
  const position=V(...structureOffsets[i]),root=new pc.Entity('Compact frontier satellite '+(i+1));app.root.addChild(root);root.setPosition(position);
  add(root,'Core','box',[0,0,0],[.56,.36,.86],stationMat);add(root,'Lens','sphere',[0,.61,-.8],[.29,.25,.29],pane);
  for(const sign of [-1,1]){add(root,'Solar truss','box',[sign*1.65,0,0],[.8,.05,.09],stationMat);add(root,'Folding solar wing','box',[sign*2.75,0,0],[1.1,.035,.56],solarPanel);}
  structures.push({id:'relay-'+i,name:'RELAY '+(i+1),ent:root,position,radius:1.25,hp:125,alive:true});
 }
 function effect(name,kind,pos,vel,life,mat,size){
  const e=add(app.root,name,kind,[pos.x,pos.y,pos.z],[size,size,size],mat);
  effects.push({ent:e,pos:pos.clone(),vel:vel.clone(),life,age:0,size});return e;
 }
 function burst(position,hex,count=16,power=7,scale=1){const m=material(hex,2.8);count=Math.min(60,count);
  for(let i=0;i<count;i++){
   const n=V(rand(-1,1),rand(-1,1),rand(-1,1));if(n.length()<.01)n.set(0,1,0);n.normalize();
   effect('Plasma burst particle','sphere',position,n.clone().mulScalar(rand(power*.25,power)),rand(.35,1.25),m,rand(.22,.65)*scale);
  }
  while(effects.length>(quality==='performance'?170:quality==='balanced'?320:520)){effects.shift().ent.destroy();}
 }
 const rockCore=material('#ff9b60',2.1),slag=material('#3b2c2e'),metal=material('#88949d');
 function spawnShards(body,origin,impactVelocity,count=24){
  const crust=material(body.data.color);crust.diffuseMap=body.material.diffuseMap;crust.metalness=.1;crust.gloss=.2;crust.update();
  const possibleMats=body.group==='planet'?[crust,slag,crust,rockCore]:[crust,slag,metal];
  for(let i=0;i<count;i++){
   const n=V(rand(-1,1),rand(-1,1),rand(-1,1));if(n.length()<.01)n.set(0,1,0);n.normalize();
   const sr=body.radius*rand(.014,.068),pos=origin.clone().add(n.clone().mulScalar(body.radius*rand(.28,.94)));
   const ent=fragment(app,shardMesh,possibleMats[i%possibleMats.length],'Irregular fractured world crust');
   ent.setPosition(pos);ent.setLocalScale(sr*rand(.56,1.6),sr*rand(.38,1.25),sr*rand(.45,1.5));ent.setLocalEulerAngles(rand(0,360),rand(0,360),rand(0,360));
   const molten=i%5===0?add(ent,'Exposed glowing core','sphere',[0,.2,0],[.18,.12,.28],rockCore):null;
   const vel=n.clone().mulScalar(rand(10,39)).add(impactVelocity?.clone().mulScalar(.035)||V());
   debris.push({ent,pos,vel,radius:sr*.7,hp:Math.max(16,sr*24),rot:V(rand(-45,45),rand(-60,60),rand(-45,45)),source:body.id,molten});
  }
  while(debris.length>(quality==='performance'?135:quality==='balanced'?210:295)){debris.shift().ent.destroy();}
 }
 function startRupture(body,source,velocity){
  if(!body?.alive||body.group==='star'||body.exploding)return false;
  body.hp=0;body.exploding=true;body.rupture={age:0,duration:3.6,velocity:velocity?.clone()||V(),source,emitted:0,shock:[]};ruptures.push(body);
  const glow=makeEmissive('#ffb384',.12);
  for(let k=0;k<3;k++){
   const shell=add(app.root,'Planetary breach shock front','sphere',[...body.data.pos],[body.radius*2.0,body.radius*2.0,body.radius*2.0],glow);
   body.rupture.shock.push(shell);
  }
  burst(body.position,'#fff0d2',46,rand(9,26),Math.max(1,body.radius*.04));
  onEvent('planetRupture',{id:body.id,name:body.name,by:source});
  return true;
 }
 function explodeWorld(b,source,velocity){return startRupture(b,source,velocity)}
 function damagePlanet(b,amount,by,vel){if(!b?.alive||b.group==='star'||b.exploding)return false;
  b.hp=Math.max(0,b.hp-amount);b.hitFlash=.35;
  if(b.hp===0)return startRupture(b,by,vel);
  if(b.scars.length<16){const n=V(rand(-1,1),rand(-1,1),rand(-1,1)).normalize();const hit=add(b.root,'Glowing crust fracture','sphere',[n.x*b.radius*1.003,n.y*b.radius*1.003,n.z*b.radius*1.003],[b.radius*.05,b.radius*.012,b.radius*.075],makeEmissive('#f17d64',.5));hit.lookAt(n.clone().mulScalar(b.radius*2));b.scars.push(hit)}
  return false;
 }
 function destroyAsteroid(a,by){if(!a?.alive)return;a.alive=false;a.ent.enabled=false;burst(a.position,'#ffc29d',18,11);
  for(let i=0;i<5;i++){const n=V(rand(-1,1),rand(-1,1),rand(-1,1)).normalize(),r=a.radius*.33,pos=a.position.clone().add(n.clone().mulScalar(a.radius*.45));const ent=fragment(app,shardMesh,rockMaterials[i%rockMaterials.length],'Angular asteroid shrapnel');ent.setPosition(pos);ent.setLocalScale(r*1.4,r*.6,r);debris.push({ent,pos,vel:n.mulScalar(rand(3,10)),radius:r,hp:12,rot:V(26,38,40),source:'asteroid'});}onEvent('asteroidDestroyed',{by});
 }
 function destroyStructure(s,by){if(!s?.alive)return;s.alive=false;s.ent.enabled=false;burst(s.position,'#78d8ff',28,13);
  for(let i=0;i<10;i++){const n=V(rand(-1,1),rand(-1,1),rand(-1,1)).normalize(),r=rand(.25,1),pos=s.position.clone().add(n.clone().mulScalar(rand(1,2)));const ent=fragment(app,shardMesh,stationMat,'Satellite wreckage');ent.setPosition(pos);ent.setLocalScale(r,r*.6,r*1.4);debris.push({ent,pos,vel:n.mulScalar(rand(5,14)),radius:r,hp:16,rot:V(31,18,42),source:s.id});}onEvent('structureDestroyed',{id:s.id,name:s.name,by});
 }
 // Solar winds: timed warnings followed by a visible outgoing spherical wave. Blocking
 // by planets is exact segment/sphere occlusion, not a proximity power-up.
 const sun=worlds.get('sun');let clock=0,nextPulse=30,pulse=null;
 function warningClock(){return Math.max(0,nextPulse-clock)}
 function startPulse(){
  const r=sun.radius+5;
  const materialA=makeEmissive('#8ad9fd',.115),materialB=makeEmissive('#ffc48f',.075);
  const shells=[add(app.root,'Solar bow wave / blue plasma','sphere',[0,0,0],[r*2,r*2,r*2],materialA),add(app.root,'Solar bow wave / coronal front','sphere',[0,0,0],[r*1.97,r*1.97,r*1.97],materialB)];
  pulse={id:clock,oldRadius:r,radius:r,hit:new Set(),shells,age:0,active:true};
  onEvent('solarPulse',{message:'CORONAL MASS EJECTION · SEEK PLANETARY SHADOW'});
 }
 function solarState(){return {active:!!pulse,seconds:warningClock(),radius:pulse?.radius||0,warning:warningClock()<=SOLAR_PULSE.warning,period:SOLAR_PULSE.interval};}
 function checkSolarPulse(shipPos,shipId){
  if(!pulse||!pulse.active||pulse.hit.has(shipId))return null;
  const distance=shipPos.distance(sun.position);
  if(!reachesSolarFront(distance,pulse.oldRadius-1.5,pulse.radius+1.5))return null;
  pulse.hit.add(shipId);
  const shadowed=shadowedFromSun(sun.position,shipPos,[...worlds.values()].filter(b=>b.group==='planet'&&b.alive));
  return {shadowed,damage:shadowed?0:SOLAR_PULSE.damage,impulse:shadowed?0:9,direction:shipPos.clone().sub(sun.position).normalize()};
 }
 function checkOortWall(position,previous=position,radius=0){
  return iceFieldContact(position,previous,OORT_INNER_RADIUS-Math.max(0,radius));
 }
 function oortBurst(point){burst(point,'#8cbaff',5,2,.3);}
 function update(dt){
  clock+=dt;
  if(!pulse&&clock-dt<nextPulse-SOLAR_PULSE.warning&&clock>=nextPulse-SOLAR_PULSE.warning)onEvent('solarWarning',{seconds:SOLAR_PULSE.warning});
  if(!pulse&&clock>=nextPulse)startPulse();
  if(pulse){pulse.age+=dt;pulse.oldRadius=pulse.radius;pulse.radius+=SOLAR_PULSE.speed*dt;
   const radius=pulse.radius;
   pulse.shells.forEach((shell,i)=>{shell.setLocalScale(radius*2*(i?1.016:1),radius*2*(i?1.016:1),radius*2*(i?1.016:1));shell.render.material.opacity=Math.max(.018,.115*(1-radius/SOLAR_PULSE.maxRadius));shell.render.material.update()});
   if(radius>=SOLAR_PULSE.maxRadius){pulse.shells.forEach(e=>e.destroy());pulse=null;nextPulse=clock+SOLAR_PULSE.interval;}
  }
  for(const b of worlds.values()){if(!b.alive)continue;b.visual.rotateLocal(0,dt*(b.group==='star'?1.2:b.id==='jupiter'?.65:.27),0);
   if(b.hitFlash>0){b.hitFlash=Math.max(0,b.hitFlash-dt);b.material.emissiveIntensity=.32+b.hitFlash*4;b.material.update();}
  }
  for(let j=ruptures.length-1;j>=0;j--){const b=ruptures[j],fx=b.rupture;fx.age+=dt;
   const t=Math.min(1,fx.age/fx.duration);
   b.material.blendType=pc.BLEND_NORMAL;b.material.depthWrite=false;b.material.opacity=Math.max(.006,1-Math.pow(t,1.35));b.material.emissiveIntensity=.8+Math.sin(fx.age*20)*.7+2*t;b.material.update();
   b.visual.setLocalScale(b.radius*2*(1+.035*Math.sin(fx.age*16)),b.radius*2*(1+.025*Math.cos(fx.age*13)),b.radius*2*(1+.032*Math.sin(fx.age*19)));
   const goal=Math.floor(t*(b.id==='jupiter'?94:58));if(goal>fx.emitted){const count=Math.min(13,goal-fx.emitted);spawnShards(b,b.position,fx.velocity,count);fx.emitted+=count;}
   for(let k=0;k<fx.shock.length;k++){const scale=b.radius*2*(1+t*(k+1)*.55);fx.shock[k].setLocalScale(scale,scale,scale);}
   if(fx.age>=fx.duration){b.alive=false;b.exploding=false;b.root.enabled=false;fx.shock.forEach(e=>e.destroy());ruptures.splice(j,1);onEvent('planetDestroyed',{id:b.id,name:b.name,by:fx.source});}
  }
  for(const d of debris){d.pos.add(d.vel.clone().mulScalar(dt));d.vel.mulScalar(Math.exp(-dt*.005));
   const wall=checkOortWall(d.pos,d.pos,d.radius);if(wall.blocked){d.pos.set(wall.contact.x,wall.contact.y,wall.contact.z);const n=V(wall.normal.x,wall.normal.y,wall.normal.z);const radial=d.vel.dot(n);if(radial>0)d.vel.sub(n.mulScalar(radial*1.5));}
   d.ent.setPosition(d.pos);d.ent.rotateLocal(d.rot.x*dt,d.rot.y*dt,d.rot.z*dt);
   for(const b of worlds.values()){if(!b.alive||b.exploding)continue;const off=d.pos.clone().sub(b.position),len=off.length();if(len<b.radius+d.radius){const n=off.normalize();d.pos.copy(b.position).add(n.clone().mulScalar(b.radius+d.radius+.1));const inward=d.vel.dot(n);if(inward<0)d.vel.sub(n.mulScalar(inward*1.4));break}}
  }
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;e.pos.add(e.vel.clone().mulScalar(dt));e.ent.setPosition(e.pos);const f=Math.max(.01,(1-e.age/e.life)*e.size);e.ent.setLocalScale(f,f,f);if(e.age>e.life){e.ent.destroy();effects.splice(i,1)}}
 }
 return {worlds,asteroids,structures,debris,oortIce,cosmos,checkOortWall,oortBurst,OORT_INNER_RADIUS,update,burst,damagePlanet,destroyAsteroid,destroyStructure,explodeWorld,spawnShards,solarState,checkSolarPulse,get(id){return worlds.get(id)}};
}
