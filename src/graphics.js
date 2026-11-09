import pc from './engine.js';
import {lcg} from './rules.js';
const rnd=lcg(12771);
export const c=(hex)=>{const s=hex.replace('#','');return new pc.Color(...[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255));};
export function material(hex,glow=0){const m=new pc.StandardMaterial();m.diffuse=c(hex);m.metalness=glow?0:.38;m.gloss=.73;if(glow){m.useLighting=false;m.emissive=c(hex);m.emissiveIntensity=glow;}m.update();return m;}
// Transparent additive-looking material used by planetary atmospheres, rings,
// solar wavefronts and breakup shells. V10 called this without defining it,
// which caused the entire 3D engine initialization to fail.
export function emissiveMaterial(hex,opacity=1,intensity=1.7){
 const m=material(hex,intensity);
 m.opacity=Math.max(0,Math.min(1,opacity));
 if(m.opacity<1){m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;}
 m.update();
 return m;
}
export function add(parent,name,type,at,scale,mat,rotate){const e=new pc.Entity(name);e.addComponent('render',{type,material:mat});e.setLocalPosition(...at);e.setLocalScale(...scale);if(rotate)e.setLocalEulerAngles(...rotate);parent.addChild(e);return e;}
export function hullTexture(app,primary,accent){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const x=canvas.getContext('2d');
 const grad=x.createLinearGradient(0,0,512,512);grad.addColorStop(0,'#344757');grad.addColorStop(.48,primary);grad.addColorStop(1,'#091421');x.fillStyle=grad;x.fillRect(0,0,512,512);
 x.strokeStyle='#98adbb';x.lineWidth=2;x.globalAlpha=.38;
 for(let i=10;i<512;i+=56){x.beginPath();x.moveTo(i,0);x.lineTo(i,512);x.stroke()}
 for(let i=18;i<512;i+=48){x.beginPath();x.moveTo(0,i);x.lineTo(512,i);x.stroke()}
 x.globalAlpha=.3;x.strokeStyle='#d9eaf5';for(let i=0;i<28;i++){x.strokeRect((i%7)*73+7,Math.floor(i/7)*120+25,34+(i%3)*8,26)}
 x.globalAlpha=.65;x.fillStyle=accent;for(const k of [84,266,435])x.fillRect(168,k,176,6);
 const tex=new pc.Texture(app.graphicsDevice,{format:pc.PIXELFORMAT_RGBA8,mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR});tex.setSource(canvas);return tex;
}
export function buildShip(app,id,klass,color){
 const root=new pc.Entity(`Vessel ${id}`);app.root.addChild(root);
 const tex=hullTexture(app,klass==='dreadnought'?'#273342':klass==='interceptor'?'#244455':'#4b4040',color);
 const hull=material('#b5c6d4'),armour=material(klass==='fighter'?'#b7a7a0':'#889fb0'),black=material('#08111d'),trim=material('#dce7ec'),engine=material(color,2.4),lights=material('#b5eaff',1.9);
 hull.diffuseMap=tex;hull.update();armour.diffuseMap=tex;armour.update();
 const wide=klass==='dreadnought'?1.35:klass==='interceptor'?.78:1;
 const length=klass==='interceptor'?1.2:klass==='dreadnought'?1.45:1;
 add(root,'Armored spine','box',[0,0,0],[.76*wide,.38,2.65*length],hull);
 add(root,'Nose wedge','box',[0,.01,-1.32*length],[.69,.27,1.15*length],armour,[9,0,0]);
 add(root,'Canopy','sphere',[0,.22,-.79*length],[.48,.24,.78],black);
 add(root,'Canopy sheen','sphere',[0,.29,-.82*length],[.34,.11,.58],lights);
 add(root,'Radar tip','cone',[0,0,-2.0*length],[.12,.6,.12],trim,[90,0,0]);
 for(const s of [-1,1]){
  const sw=s*wide;
  add(root,'Swept main wing','box',[sw*.93,-.07,.29],[1.55*wide,.11,1.34*length],armour,[0,s*17,s*5]);
  add(root,'Wingtip leading-edge','box',[sw*1.78,.01,-.14],[.16,.11,.9*length],trim,[0,s*17,0]);
  add(root,'Engine nacelle','cylinder',[sw*1.2,-.14,1.04],[.26,.9,.26],hull,[90,0,0]);
  add(root,'Engine core','cylinder',[sw*1.2,-.14,1.47],[.2,.22,.2],engine,[90,0,0]);
  add(root,'Aft stabilizer','box',[sw*.41,.32,.9],[.12,.62,.74],armour,[0,0,s*18]);
  add(root,'Wing marker','box',[sw*1.23,.01,-.08],[.06,.04,.54],engine);
 }
 if(klass==='dreadnought'){
  add(root,'Fortified upper deck','box',[0,.40,.45],[1.4,.34,1.55],armour);
  add(root,'Upper turret housing','sphere',[0,.71,-.32],[.52,.29,.63],black);
  for(const s of [-1,1])add(root,'Forward rail cannon','cylinder',[s*.38,.45,-1.16],[.07,1.08,.07],trim,[90,0,0]);
 }else if(klass==='interceptor'){
  add(root,'Sharp ventral keel','box',[0,-.30,.28],[.14,.52,1.65],armour);
 }else add(root,'Central dorsal fin','box',[0,.42,.93],[.14,.65,.8],armour);
 const thrusts=[];for(const s of [-1,0,1])thrusts.push(add(root,'Glowing thruster','cone',[s*1.2*wide,-.14,1.69],[.15,.38,.15],engine,[90,0,0]));
 const scales={interceptor:.22,fighter:.275,dreadnought:.35};const size=scales[klass];root.setLocalScale(size,size,size);
 root.enabled=true;
 return {root,thrusts,size};
}
export function makeFragmentMesh(device){
 const v=[[0,1.13,0],[.99,.18,.22],[.42,.15,.92],[-.59,.17,.80],[-1,.05,-.26],[-.13,.12,-.97],[.28,-.96,.20]];
 const faces=[[0,1,2],[0,2,3],[0,3,4],[0,4,5],[0,5,1],[6,2,1],[6,3,2],[6,4,3],[6,5,4],[6,1,5]];
 const p=[],n=[],uv=[];
 for(let i=0;i<v.length;i++){const [x,y,z]=v[i],rr=Math.sqrt(x*x+y*y+z*z)||1;p.push(x,y,z);n.push(x/rr,y/rr,z/rr);uv.push(.5+Math.atan2(z,x)/(2*Math.PI),.5+Math.asin(y/rr)/Math.PI)}
 const m=new pc.Mesh(device);m.setPositions(p);m.setNormals(n);m.setUvs(0,uv);m.setIndices(faces.flat());m.update();return m;
}
export function fragment(app,mesh,material,name){const ent=new pc.Entity(name);ent.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material,ent)]});app.root.addChild(ent);return ent;}
export function randBetween(lo,hi){return lo+(hi-lo)*rnd()}

// Starship-inspired independent bridge: layered wall panels, luminous tactical consoles,
// panoramic forward canopy. Everything is actual PlayCanvas geometry, not a flat overlay.
function deckMaterial(app,base,accent){
 const canv=document.createElement('canvas');canv.width=canv.height=512;
 const x=canv.getContext('2d');const gr=x.createLinearGradient(0,0,512,512);
 gr.addColorStop(0,'#a2b3be');gr.addColorStop(.2,base);gr.addColorStop(.68,base);gr.addColorStop(1,'#172433');
 x.fillStyle=gr;x.fillRect(0,0,512,512);
 x.strokeStyle='#c5d6df';x.lineWidth=2;x.globalAlpha=.35;
 for(let y=20;y<512;y+=71){x.strokeRect(12,y,488,57);x.fillStyle='#101e2a';x.fillRect(29,y+8,17,40);x.fillStyle=gr;}
 for(let i=0;i<16;i++){const xx=48+(i%4)*109,yy=47+Math.floor(i/4)*115;
 x.fillStyle=i%3===0?accent:'#28394a';x.globalAlpha=.4;x.fillRect(xx,yy,67,5);x.fillRect(xx+11,yy+12,41,2);}
 x.globalAlpha=1;
 const t=new pc.Texture(app.graphicsDevice,{format:pc.PIXELFORMAT_RGBA8,mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR});t.setSource(canv);
 const m=material('#a9c9dc');m.diffuseMap=t;m.metalness=.42;m.gloss=.82;m.update();return m;
}
function instrumentMaterial(app,accent='#69d7ef'){
 if(!app)return material('#102a3b',.6);
 const can=document.createElement('canvas');can.width=512;can.height=256;
 const x=can.getContext('2d');const g=x.createLinearGradient(0,0,512,256);
 g.addColorStop(0,'#0b2434');g.addColorStop(.6,'#031a28');g.addColorStop(1,'#071320');x.fillStyle=g;x.fillRect(0,0,512,256);
 x.strokeStyle='rgba(106,215,249,.22)';x.lineWidth=1;
 for(let i=0;i<512;i+=24){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();}
 for(let j=0;j<256;j+=22){x.beginPath();x.moveTo(0,j);x.lineTo(512,j);x.stroke();}
 x.strokeStyle=accent;x.lineWidth=3;x.globalAlpha=.6;
 for(let rr=27;rr<=105;rr+=26){x.beginPath();x.arc(156,128,rr,0,Math.PI*2);x.stroke();}
 x.globalAlpha=.8;x.beginPath();x.moveTo(156,128);x.lineTo(234,49);x.stroke();x.globalAlpha=1;
 x.fillStyle=accent;x.font='bold 18px monospace';x.fillText('ATHENA / TACTICAL',289,40);
 x.fillStyle='#91aec6';x.font='13px monospace';x.fillText('HELM // ACTIVE',290,74);
 x.fillText('ORBITAL FRAME',290,100);x.fillText('SENSOR ARRAY',290,125);
 x.fillStyle='#b2f4ff';for(let i=0;i<6;i++){x.fillRect(288,143+i*16,130-i*13,6);x.fillRect(432,143+i*16,21,6);}
 const tex=new pc.Texture(app.graphicsDevice,{format:pc.PIXELFORMAT_RGBA8,mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR});tex.setSource(can);
 const m=material('#ffffff');m.useLighting=false;m.diffuseMap=tex;m.emissiveMap=tex;m.emissiveIntensity=.95;m.update();return m;
}
export function buildCockpit(camera,klass,color,layerId=null,app=null){
 const cockpit=new pc.Entity('Starship command bridge / '+klass);camera.addChild(cockpit);
 const shell=app?deckMaterial(app,klass==='dreadnought'?'#303645':klass==='interceptor'?'#1d3b4b':'#334352',color):material('#637b8c');
 const porcelain=material('#becdd4'),brushed=material('#455e72'),edge=material('#a3bdcd');
 const under=material('#081521'),glass=instrumentMaterial(app,color),phosphor=material('#6addf5',1.9),alert=material('#fbb17c',1.6),accent=material(color,1.4);
 const wide=klass==='dreadnought'?1.28:klass==='interceptor'?.85:1.08;
 const panel=(name,pos,scale,mat,rotation)=>add(cockpit,name,'box',pos,scale,mat,rotation);
 // Bright bridge sidewalls and sculpted window frame. Centre remains almost clear.
 panel('Command deck floor',[0,-1.62,-2.15],[3.5*wide,.25,4],under);
 panel('Forward flight console',[0,-.85,-1.56],[2.8*wide,.34,1.05],shell,[-17,0,0]);
 panel('Forward console interactive glass',[0,-.64,-1.62],[2.05*wide,.03,.75],glass,[-17,0,0]);
 panel('Continuous canopy upper rim',[0,1.26,-2.5],[3.9*wide,.19,.3],shell);
 panel('Starboard panorama arch',[1.86*wide,.1,-2.38],[.14,2.38,.27],edge,[0,0,-12]);
 panel('Port panorama arch',[-1.86*wide,.1,-2.38],[.14,2.38,.27],edge,[0,0,12]);
 panel('Bridge overhead display housing',[0,1.22,-2.2],[1.25,.15,.53],brushed);
 panel('Overhead heading light',[0,1.13,-2.18],[.91,.028,.1],phosphor);
 for(const sign of [-1,1]){
   panel('Lower side armoring',[sign*1.51*wide,-.91,-1.48],[.48,.69,1.62],shell,[0,sign*12,0]);
   panel('Curved side workstation',[sign*1.08*wide,-.66,-1.48],[1.15,.24,.87],porcelain,[-16,sign*15,0]);
   panel('Side instrument display',[sign*1.08*wide,-.523,-1.52],[.89,.025,.58],glass,[-16,sign*15,0]);
   panel('Luminous rail',[sign*1.32*wide,-.38,-1.7],[.038,.026,.85],phosphor,[-16,sign*15,0]);
   for(let i=0;i<7;i++)panel('Tactical telemetry LED',[sign*(.81+i*.07)*wide,-.498,-1.51],[.045,.023,.16],i%3===0?alert:phosphor,[-16,sign*15,0]);
 }
 for(let i=0;i<11;i++)panel('Helm capacitive control',[(-5+i)*.17,-.577,-1.66],[.075,.025,.08],i%4===0?alert:phosphor,[-17,0,0]);
 panel('Vessel controls pedestal',[0,-1.06,-.88],[.52,.72,.66],brushed,[14,0,0]);
 panel('Main helm encoder',[0,-.87,-.83],[.42,.26,.42],porcelain);
 for(const sign of [-1,1])panel('Cockpit seat armrest',[sign*.82,-1.16,-.52],[.24,.17,.8],edge);
 if(klass==='dreadnought')for(const sign of [-1,1])panel('Command blast sash',[sign*.82,1.17,-2.34],[.16,1.26,.2],brushed,[0,0,sign*16]);
 if(klass==='interceptor')panel('Spectre narrow central collimator',[0,1.2,-2.32],[.05,.22,.12],phosphor);
 // V10 complete pressurised cockpit envelope. Clear forward canopy only: no holes in
 // peripheral walls, deck, overhead shell or behind the pilot. Original geometry.
 const gasket=material('#07111a'),seam=material('#758da2'),copper=material('#d5a77b'),navBlue=material('#54c9ef',1.85);
 const armour=app?deckMaterial(app,klass==='dreadnought'?'#34343e':'#283846',color):shell;
 // Overlapping subpanels conceal corners and structural discontinuities.
 panel('Continuous keel / deck underlay',[0,-1.75,-1.35],[4.85*wide,.36,6.1],armour);
 panel('Aft cockpit bulkhead behind pilot',[0,-.10,1.24],[4.7*wide,3.58,.38],shell);
 panel('Aft canopy overhead roof',[0,1.64,-.18],[4.7*wide,.31,3.0],armour);
 panel('Overhead acoustic liner',[0,1.42,-.28],[3.35*wide,.11,2.8],gasket);
 for(const side of [-1,1]){
  const x=side*2.02*wide;
  panel('Continuous sealed sidewall',[x,-.33,-.31],[.42,3.67,3.75],armour,[0,0,side*4]);
  panel('Side thermal liner',[side*1.82*wide,-.27,.38],[.055,2.15,1.84],gasket,[0,0,side*5]);
  panel('Side sensor cluster',[side*1.72*wide,-.16,-.20],[.11,.62,.96],glass,[0,0,side*9]);
  panel('Galley seal / pressure joint',[side*1.68*wide,1.24,-.70],[.21,.31,1.6],seam);
  panel('Peripheral light conductor',[side*1.73*wide,-.83,-1.60],[.08,.07,2.55],navBlue);
  panel('Overhead canopy brace',[side*1.46*wide,1.44,-1.50],[.18,.20,2.1],shell,[0,side*7,0]);
  panel('Panorama armoured frame',[side*1.89*wide,.16,-2.72],[.24,2.6,.24],seam,[0,0,side*10]);
  panel('Panorama angle gusset',[side*1.65*wide,1.27,-2.64],[.55,.15,.36],shell,[0,0,side*13]);
  for(let k=0;k<5;k++){
   panel('Inner sidewall rib',[side*1.72*wide,-1.07+k*.44,.58],[.09,.07,1.4],seam,[0,0,side*4]);
   panel('Helm command indicators',[side*(.52+k*.22)*wide,-.54,-1.51],[.12,.018,.08],k%2?accent:phosphor,[-17,0,0]);
  }
  panel('Hinged armoured chair side',[side*.72,-1.25,.18],[.22,.56,1.03],brushed,[0,0,side*8]);
  panel('Chair back bolster',[side*.46,-.9,.59],[.48,.8,.30],shell,[0,0,side*4]);
 }
 panel('Forward pressure seal / sill',[0,-1.15,-2.61],[3.7*wide,.27,.36],armour);
 panel('Dorsal centre navigation housing',[0,1.43,-2.62],[1.2,.22,.45],shell);
 panel('Dorsal central caution bar',[0,1.3,-2.48],[.78,.05,.055],alert);
 for(let i=0;i<8;i++){
  const x=(-3.5+i)*.21*wide;
  panel('Tactical top rail slot',[x,1.31,-2.45],[.09,.035,.13],i===4?alert:navBlue);
  panel('Main console lightline',[x,-.49,-1.79],[.11,.025,.07],i%3===0?copper:phosphor,[-17,0,0]);
 }
 if(klass==='dreadnought'){
  panel('Titan blast curtain / upper frame',[0,1.18,-2.85],[2.5,.18,.28],armour);
  panel('Titan port shielded sensor',[-1.4,-.42,-1.22],[.50,.31,.87],glass);
  panel('Titan starboard shielded sensor',[1.4,-.42,-1.22],[.50,.31,.87],glass);
 }else if(klass==='interceptor'){
  for(const side of [-1,1])panel('Spectre canopy rail',[side*.57,.9,-2.57],[.09,1.28,.16],seam,[0,0,side*10]);
 }else{
  panel('Vanguard bridge combiner',[0,1.10,-2.5],[.62,.12,.13],navBlue);
 }
 if(layerId!==null){const applyLayer=e=>{if(e.render)e.render.layers=[layerId];for(const child of e.children)applyLayer(child)};applyLayer(cockpit);}
 cockpit.enabled=false;return cockpit;
}
export function buildWeaponSprite(app,missile,origin,mat){
 const ent=new pc.Entity(missile?'Guided thermal missile':'High energy plasma bolt');app.root.addChild(ent);ent.setPosition(origin);
 if(missile){
  add(ent,'Missile fuselage','cylinder',[0,0,0],[.18,.54,.18],material('#bac9d4'),[90,0,0]);
  add(ent,'Fusing nose','cone',[0,0,-.33],[.21,.32,.21],material('#f6dfc1'),[90,0,0]);
  for(const s of [-1,1])add(ent,'Missile guidance fin','box',[s*.17,0,.21],[.12,.04,.26],material('#788da3'));
  add(ent,'Ion burn','cone',[0,0,.37],[.13,.42,.13],mat,[90,0,0]);
 }else{
  add(ent,'Plasma core','sphere',[0,0,0],[.13,.13,.6],mat);
  add(ent,'Plasma corona','sphere',[0,0,.25],[.25,.21,.52],material('#d2faff',1.7));
 }
 return ent;
}
