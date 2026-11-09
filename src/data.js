// Solar-system battle sandbox. Major planet and moon radii proportional to their
// approximate physical mean radii (Jupiter=270 gameplay units). Travel distances
// and the Sun are artistically compressed; no orbital ephemeris is implied.
export const JUPITER_RADIUS=270;
const scale=km=>Math.max(.22,Number((JUPITER_RADIUS*km/69911).toFixed(3)));
const entries=[
 ['sun','SUN','star',696340,'sun',[0,0,0],Infinity,'#ffbd63'],
 ['mercury','MERCURY','planet',2439.7,'mercury',[235,3,-70],1450,'#abaeb5'],
 ['venus','VENUS','planet',6051.8,'venus',[360,-18,165],1820,'#e3b88f'],
 ['earth','EARTH','planet',6371,'earth',[515,0,-90],2100,'#70baff'],
 ['mars','MARS','planet',3389.5,'mars',[670,12,-425],1780,'#db8065'],
 ['ceres','CERES','dwarf',469.7,'ceres',[900,18,270],720,'#c4bcb2'],
 ['jupiter','JUPITER','planet',69911,'jupiter',[1140,0,80],3800,'#deb69b'],
 ['saturn','SATURN','planet',58232,'saturn',[-1250,40,340],3400,'#ecd6a9'],
 ['uranus','URANUS','planet',25362,'uranus',[-1450,40,-1050],2500,'#aadadf'],
 ['neptune','NEPTUNE','planet',24622,'neptune',[680,-20,-2110],2600,'#688fe8'],
 ['pluto','PLUTO','dwarf',1188.3,'pluto',[-620,-65,2340],890,'#d2c0af'],
 ['haumea','HAUMEA','dwarf',800,'haumea',[-1030,75,2510],830,'#d6d4c4'],
 ['makemake','MAKEMAKE','dwarf',715,'makemake',[160,85,2630],830,'#c89f8e'],
 ['eris','ERIS','dwarf',1163,'eris',[-1650,-40,2050],920,'#d7d7e1'],
 // Moon names and radii. Unmapped moons use representative fallback texture maps.
 ['moon','MOON','moon',1737.4,'moon',null,400,'#c3c5cf','earth',72,1.95],
 ['phobos','PHOBOS','moon',11.27,'moon',null,150,'#a99b8a','mars',38,.7],
 ['deimos','DEIMOS','moon',6.2,'moon',null,145,'#b4a9a3','mars',52,3.0],
 ['io','IO','moon',1821.6,'io',null,460,'#ecd27a','jupiter',355,1.35],
 ['europa','EUROPA','moon',1560.8,'europa',null,440,'#e7ded0','jupiter',415,2.4],
 ['ganymede','GANYMEDE','moon',2634.1,'ganymede',null,540,'#b9ada1','jupiter',525,3.85],
 ['callisto','CALLISTO','moon',2410.3,'callisto',null,510,'#a5a09e','jupiter',655,5.1],
 ['titan','TITAN','moon',2574.7,'titan',null,480,'#e4b76b','saturn',320,1.2],
 ['enceladus','ENCELADUS','moon',252.1,'enceladus',null,340,'#d9e7f4','saturn',256,2.95],
 ['mimas','MIMAS','moon',198.2,'moon',null,320,'#bcc5cf','saturn',284,4.35],
 ['rhea','RHEA','moon',763.8,'ganymede',null,400,'#c8c6c0','saturn',390,3.7],
 ['dione','DIONE','moon',561.4,'enceladus',null,380,'#ded9d4','saturn',460,5.4],
 ['iapetus','IAPETUS','moon',734.5,'callisto',null,420,'#9e9b93','saturn',560,2.2],
 ['miranda','MIRANDA','moon',235.8,'moon',null,300,'#acb1bc','uranus',160,1.55],
 ['ariel','ARIEL','moon',578.9,'enceladus',null,340,'#bdcacc','uranus',200,4.9],
 ['umbriel','UMBRIEL','moon',584.7,'callisto',null,320,'#949aa0','uranus',230,3.25],
 ['titania','TITANIA','moon',788.9,'ganymede',null,420,'#bec6c8','uranus',285,.4],
 ['oberon','OBERON','moon',761.4,'callisto',null,400,'#a5afb4','uranus',333,2.0],
 ['triton','TRITON','moon',1353.4,'triton',null,550,'#bdc0c7','neptune',255,1.3],
 ['nereid','NEREID','moon',170,'moon',null,300,'#acb2bc','neptune',330,4.8],
 ['charon','CHARON','moon',606,'pluto',null,420,'#9a9999','pluto',45,3.3],
 ['dysnomia','DYSNOMIA','moon',350,'moon',null,340,'#c4c9d2','eris',48,.9]
];
const all=[];const byId={};
for(const [id,name,group,km,texture,pos,hp,color,parent,orbit,angle] of entries){
 const r=group==='star'?112:scale(km);
 let xyz=pos;
 if(parent){const source=byId[parent];xyz=[source.pos[0]+Math.cos(angle)*orbit,source.pos[1]+Math.sin(angle*.83)*orbit*.16,source.pos[2]+Math.sin(angle)*orbit];}
 const v={id,name,group,kind:group==='star'?'Star':group==='moon'?'Moon':group==='dwarf'?'Dwarf planet':'Planet',size:r,radiusKm:km,texture,pos:xyz,hp,color,parent:parent||null};
 all.push(v);byId[id]=v;
}
export const BODIES=all;
export const BY_BODY_ID=byId;
export const ARENA_NAME='THE OORT FRONTIER';
export const OORT_INNER_RADIUS=3150;
export const OORT_VISUAL_RADIUS=3260;
