// PlayCanvas-independent V10 game rules. Shared by simulation and Node tests.
export const PICKUPS={
 railgun:{name:'RAILGUN',color:'#9ee8ff',ammo:7,respawn:36,rarity:'RARE',kind:'weapon'},
 scatter:{name:'PLASMA SCATTER',color:'#ffae70',ammo:24,respawn:28,rarity:'TACTICAL',kind:'weapon'},
 emp:{name:'EMP DISRUPTOR',color:'#be91ff',ammo:3,respawn:38,rarity:'RARE',kind:'weapon'},
 overcharge:{name:'OVERRIDE CORE',color:'#f5d685',duration:24,respawn:36,rarity:'BOOST',kind:'boost'},
 repair:{name:'NANITE REPAIR',color:'#89f1ad',respawn:29,rarity:'SUPPLY',kind:'supply'},
 resupply:{name:'ORDNANCE CACHE',color:'#7fc6fc',respawn:28,rarity:'SUPPLY',kind:'supply'}
};
export const SPECIALS={
 interceptor:{name:'SPECTRE SWARM',charges:3,cooldown:26,damage:26,count:10},
 fighter:{name:'NOVA PULSE',charges:4,cooldown:21,damage:105,charge:1.4,range:190},
 dreadnought:{name:'CATACLYSM WARHEAD',charges:2,cooldown:36,damage:190,radius:85}
};
export const MISSILE={initialSpeed:115,maxSpeed:230,acceleration:105,lifetime:72,turnRate:5.25,sensorRange:4100,memorySeconds:20};
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const len=v=>Math.hypot(v.x,v.y,v.z);
const unit=v=>{const d=len(v)||1;return {x:v.x/d,y:v.y/d,z:v.z/d}};
export function missileStep(velocity,position,target,targetVelocity,dt,params=MISSILE){
 const sp=Math.max(1,len(velocity));const delta={x:target.x-position.x,y:target.y-position.y,z:target.z-position.z};
 const t=clamp(len(delta)/Math.max(1,sp),0,3.5);
 const desired=unit({x:delta.x+(targetVelocity?.x||0)*t,y:delta.y+(targetVelocity?.y||0)*t,z:delta.z+(targetVelocity?.z||0)*t});
 const dir=unit(velocity),dot=clamp(dir.x*desired.x+dir.y*desired.y+dir.z*desired.z,-1,1),angle=Math.acos(dot);
 const fraction=angle>1e-5?Math.min(1,params.turnRate*dt/angle):1;
 let curved;
 if(angle<1e-5||fraction>=1){curved=desired;}
 else if(dot<-.999){
  // Exact reversal: linear vector interpolation cannot rotate opposite vectors.
  const axis=Math.abs(dir.y)<.75?unit({x:-dir.z,y:0,z:dir.x}):unit({x:dir.y,y:-dir.x,z:0});
  const turn=Math.min(angle,params.turnRate*dt);
  curved=unit({x:dir.x*Math.cos(turn)+axis.x*Math.sin(turn),y:dir.y*Math.cos(turn)+axis.y*Math.sin(turn),z:dir.z*Math.cos(turn)+axis.z*Math.sin(turn)});
 }else{
  const denom=Math.sin(angle),a=Math.sin((1-fraction)*angle)/denom,b=Math.sin(fraction*angle)/denom;
  curved=unit({x:dir.x*a+desired.x*b,y:dir.y*a+desired.y*b,z:dir.z*a+desired.z*b});
 }
 const nextSpeed=Math.min(params.maxSpeed,sp+params.acceleration*dt);
 return {x:curved.x*nextSpeed,y:curved.y*nextSpeed,z:curved.z*nextSpeed};
}
export function oortForce(position,velocity,radius=3150,margin=255){
 const distance=len(position),remaining=radius-distance;
 if(distance<1||remaining>margin)return {x:0,y:0,z:0,proximity:0};
 const t=clamp((margin-remaining)/margin,0,1.5);
 const radial=(position.x*velocity.x+position.y*velocity.y+position.z*velocity.z)/distance;
 const magnitude=(t*t*105)+Math.max(0,radial)*t*2.8;
 return {x:-position.x/distance*magnitude,y:-position.y/distance*magnitude,z:-position.z/distance*magnitude,proximity:clamp(t,0,1)};
}
export function radialDamage(distance,radius,maxDamage){return distance>=radius?0:maxDamage*Math.pow(1-distance/radius,1.5)};
export function botPickupPreference(ship,pickup){
 if(!pickup.active)return -Infinity;
 const hpRatio=ship.hp/(ship.settings?.hp||ship.hp||1),shRatio=ship.shields/(ship.settings?.shields||ship.shields||1);
 if(pickup.type==='repair')return hpRatio<.55?150:hpRatio<.85?65:5;
 if(pickup.type==='resupply')return ship.missileAmmo<4?110:ship.missileAmmo<9?50:6;
 if(pickup.type==='overcharge')return ship.overcharge>0?0:65;
 if(ship.pickup?.ammo>0)return 12;
 return pickup.type==='railgun'?85:pickup.type==='emp'?65:75;
}
export function chooseBotPickup(ship,pickups){let chosen=null,best=0;for(const p of pickups){const score=botPickupPreference(ship,p)-Math.hypot(p.position.x-ship.position.x,p.position.y-ship.position.y,p.position.z-ship.position.z)*.14;
 if(score>best){best=score;chosen=p;}}return chosen;}
export function specialReady(ship){return ship.specialAmmo>0&&ship.specialCD<=0&&ship.hp>0;}
