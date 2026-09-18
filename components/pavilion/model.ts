import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {materials,stoneUV} from './materials';
import {lighting,surfaceConfig} from './config';
import {contactLighting} from './contact-lighting';
import {LEVEL,H,walls,roofs,columns,pools,platform,stair,inside,detail,sculpture} from './plan';
export function createModel(renderer?:T.WebGLRenderer){
 const root=new T.Group(),context=new T.Group(),groups:Record<string,T.Group>={};
 for(const key of ['roof','columns','travertine','green','onyx','glass','base','pools','furniture','sculpture']){const g=new T.Group();g.name=key;groups[key]=g;root.add(g);}
 const {m,textures}=materials(renderer),solids:T.Mesh[]=[],pick:T.Mesh[]=[],mirrors:Reflector[]=[],extras:T.Material[]=[];
 function box(g:T.Group,name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,solid=true){const subdivide=solid&&['travertine','green','onyx','roof','pool'].includes(mat.name);const cell=surfaceConfig.contactGrid;const geo=new T.BoxGeometry(w,h,d,subdivide?Math.ceil(w/cell):1,subdivide?Math.ceil(h/cell):1,subdivide?Math.ceil(d/cell):1);stoneUV(geo,x,y,z,w,h,d,mat.name);const o=new T.Mesh(geo,mat);o.position.set(x+w/2,y+h/2,z+d/2);o.name=name;o.userData.group=g.name;o.castShadow=mat.name!=='seam';o.receiveShadow=true;g.add(o);pick.push(o);if(solid){o.userData.solid=true;solids.push(o);}return o;}
 const xs=[...new Set([...platform.flatMap(p=>[p.x,p.x+p.w]),...pools.flatMap(p=>[p.x,p.x+p.w]),stair.x,stair.x+stair.w])].sort((a,b)=>a-b),zs=[...new Set([...platform.flatMap(p=>[p.z,p.z+p.d]),...pools.flatMap(p=>[p.z,p.z+p.d]),stair.z,stair.z+stair.d])].sort((a,b)=>a-b);
 const groundOK=(x:number,z:number)=>platform.some(p=>inside(x,z,p))&&!pools.some(p=>inside(x,z,p,.01))&&!inside(x,z,stair);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)if(groundOK((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2))box(groups.base,'洞石平台',xs[i],0,zs[j],xs[i+1]-xs[i],LEVEL,zs[j+1]-zs[j],m.travertine);
 for(let i=0;i<detail.steps;i++)box(groups.base,'入口台阶',stair.x+i*stair.w/detail.steps,0,stair.z,stair.w/detail.steps,LEVEL*(detail.steps-i)/detail.steps,stair.d,m.travertine);
 const positions:number[]=[];for(let x=0;x<=56.6;x+=1.1)for(let z=-7.9;z<18.75;z+=.1)if(groundOK(x,z+.05))positions.push(x,LEVEL+.004,z,x,LEVEL+.004,z+.1);for(let z=-7.9;z<=18.75;z+=1.1)for(let x=0;x<56.6;x+=.1)if(groundOK(x+.05,z))positions.push(x,LEVEL+.004,z,x+.1,LEVEL+.004,z);
 const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));const lineMat=new T.LineBasicMaterial({color:0x7f7865,transparent:true,opacity:.14});extras.push(lineMat);const joints=new T.LineSegments(geom,lineMat);groups.base.add(joints);
 for(const w of walls){const g=groups[w.kind==='frost'?'glass':w.kind],isGlass=['glass','frost'].includes(w.kind),o=box(g,w.name,w.x,LEVEL,w.z,w.w,H,w.d,m[w.kind],!isGlass);if(isGlass){o.castShadow=false;const horizontal=w.w>w.d,len=horizontal?w.w:w.d,n=Math.ceil(len/1.5);for(let i=0;i<=n;i++)box(g,'玻璃竖框',w.x+(horizontal?len*i/n:0)-.018,LEVEL,w.z+(horizontal?0:len*i/n)-.018,.036,H,.036,m.metal,false);for(const y of [LEVEL+.01,LEVEL+H-.025])box(g,'玻璃横框',w.x-.005,y,w.z-.005,w.w+.01,.025,w.d+.01,m.metal,false);}else{const horizontal=w.w>w.d,len=horizontal?w.w:w.d,step=w.kind==='onyx'?len/4:1.1;for(let t=step;t<len-.05;t+=step)box(g,'石板接缝',w.x+(horizontal?t:-.001),LEVEL,w.z+(horizontal?-.001:t),horizontal?.007:w.w+.002,H,horizontal?w.d+.002:.007,m.seam,false);if(w.kind!=='onyx')box(g,'石板水平缝',w.x-.001,LEVEL+H/2,w.z-.001,w.w+.002,.006,w.d+.002,m.seam,false);}}
 for(const c of columns){const a=detail.columnWidth,b=detail.columnWeb,foot=.02;
 box(groups.columns,'十字柱 · 中腹板',c.x-a/2,LEVEL+foot,c.z-b/2,a,H-foot,b,m.metal);
 for(const side of [-1,1])box(groups.columns,'十字柱 · 翼缘',c.x-b/2,LEVEL+foot,c.z+(side<0?-a/2:b/2),b,H-foot,(a-b)/2,m.metal);
 box(groups.columns,'柱脚',c.x-.11,LEVEL,c.z-.11,.22,foot,.22,m.metal);}
 for(const [i,r]of roofs.entries()){
  const e=.025;box(groups.roof,i?'附属屋面':'主屋面',r.x+e,LEVEL+H,r.z+e,r.w-2*e,detail.roofThickness,r.d-2*e,m.roof);
  for(const [x,z,w,d]of [[r.x,r.z,e,r.d],[r.x+r.w-e,r.z,e,r.d],[r.x+e,r.z,r.w-2*e,e],[r.x+e,r.z+r.d-e,r.w-2*e,e]])box(groups.roof,'屋面薄金属收边',x,LEVEL+H,z,w,detail.roofThickness,d,m.rim);
 }
 for(const p of pools){box(groups.pools,p.name+'池底',p.x,detail.poolBottom,p.z,p.w,detail.poolSlab,p.d,m.pool);for(const [x,z,w,d]of [[p.x,p.z,.07,p.d],[p.x+p.w-.07,p.z,.07,p.d],[p.x+.07,p.z,p.w-.14,.07],[p.x+.07,p.z+p.d-.07,p.w-.14,.07]])box(groups.pools,p.name+'池壁',x,detail.poolSlab,z,w,LEVEL-detail.poolSlab,d,m.travertine);
 const water=new T.Mesh(new T.PlaneGeometry(p.w-.14,p.d-.14),m.water);water.rotation.x=-Math.PI/2;water.position.set(p.x+p.w/2,detail.waterLevel,p.z+p.d/2);water.name=p.name+'水面';water.userData.group='pools';water.renderOrder=1;water.receiveShadow=true;groups.pools.add(water);pick.push(water);
 if(!renderer)continue;
 const r=new Reflector(new T.PlaneGeometry(p.w-.16,p.d-.16),{textureWidth:640,textureHeight:640,multisample:0,color:0x71857a,clipBias:.002});
 r.rotation.x=-Math.PI/2;r.position.copy(water.position);r.position.y+=.002;r.name='平静水面倒影';
 const mat=r.material as T.ShaderMaterial;mat.transparent=true;mat.depthWrite=false;r.renderOrder=2;
 mat.uniforms.ripple={value:surfaceConfig.waterRipple};
 mat.vertexShader=mat.vertexShader.replace('varying vec4 vUv;','varying vec4 vUv; varying vec3 vWaterWorld;').replace('vUv = textureMatrix * vec4( position, 1.0 );','vUv = textureMatrix * vec4( position, 1.0 ); vWaterWorld = (modelMatrix * vec4(position,1.0)).xyz;');
 mat.fragmentShader=mat.fragmentShader.replace('uniform vec3 color;','uniform vec3 color; uniform float ripple; varying vec3 vWaterWorld;')
 .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec4 uvw=vUv;
  vec2 waves=vec2(sin(vWaterWorld.x*5.0+vWaterWorld.z*2.6),cos(vWaterWorld.z*6.0-vWaterWorld.x*1.8));
  uvw.xy+=waves*ripple*uvw.w; vec4 base=texture2DProj(tDiffuse,uvw);
  float grazing=1.0-clamp(normalize(cameraPosition-vWaterWorld).y,0.0,1.0);
  float fresnel=0.10+0.57*pow(grazing,4.0);`)
 .replace('vec4( blendOverlay( base.rgb, color ), 1.0 )','vec4(mix(base.rgb,color,.035),fresnel)');
 extras.push(mat);groups.pools.add(r);mirrors.push(r);}
 // Planar reflections are refreshed only while the scene actually redraws. Nested
 // mirrors and the transparent water film are excluded from reflection captures.
 for(const r of mirrors){const orig=r.onBeforeRender;const others=mirrors.filter(o=>o!==r);const films=groups.pools.children.filter(o=>o.userData.group==='pools'&&o.name.endsWith('水面'));const skip=[...others,...films];const prev:boolean[]=[];
 r.onBeforeRender=function(...args){skip.forEach((o,i)=>{prev[i]=o.visible;o.visible=false;});const gpu=args[0];const shadowUpdate=gpu.shadowMap.needsUpdate;gpu.shadowMap.needsUpdate=false;
 try{orig.apply(this,args);}finally{skip.forEach((o,i)=>o.visible=prev[i]);gpu.shadowMap.needsUpdate=shadowUpdate;}};}

 box(groups.furniture,'洞石长凳',7.8,LEVEL+.36,2.49,16.9,.14,.68,m.travertine);for(let x=8.2;x<24.5;x+=2.9)box(groups.furniture,'长凳支座',x,LEVEL,2.56,.2,.36,.53,m.travertine);
 box(groups.furniture,'深色地毯',39.35,LEVEL+.008,7.1,4.65,.012,3.82,m.rug,false);
 function rod(g:T.Group,a:number[],b:number[],r:number,mat:T.Material,r2=r){const aa=new T.Vector3(a[0],a[1],a[2]),bb=new T.Vector3(b[0],b[1],b[2]),o=new T.Mesh(new T.CylinderGeometry(r2,r,aa.distanceTo(bb),16),mat);o.position.copy(aa).add(bb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bb.sub(aa).normalize());o.castShadow=true;g.add(o);return o;}
 function chair(x:number,z:number,stool=false){const g=new T.Group();g.position.set(x,LEVEL,z);groups.furniture.add(g);for(const side of [-.34,.34]){
 const curves=stool?[[[side,.018,.3],[side,.23,0],[side,.44,-.29]],[[side,.018,-.31],[side,.23,0],[side,.44,.3]]]:[[[side,.018,.3],[side,.24,.08],[side,.46,-.26],[side,.88,-.40]],[[side,.018,-.31],[side,.17,-.09],[side,.38,.22],[side,.44,.3]]];
 for(const coords of curves){const curve=new T.CatmullRomCurve3(coords.map(p=>new T.Vector3(...p as [number,number,number]))),rail=new T.Mesh(new T.TubeGeometry(curve,16,.016,6,false),m.metal);rail.castShadow=true;g.add(rail);}
 }
 const cushion=(y:number,z:number,w:number,h:number,d:number,rot=0)=>{const o=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,.025),m.leather);o.position.set(0,y,z);o.rotation.x=rot;o.name=stool?'巴塞罗那脚凳':'巴塞罗那椅';o.userData.group='furniture';o.castShadow=true;o.receiveShadow=true;g.add(o);pick.push(o);};cushion(.45,0,.75,.12,.69,-.06);if(!stool)cushion(.74,-.31,.75,.53,.095,-.22);
 for(let a=0;a<4;a++)for(let b=0;b<4;b++){const o=new T.Mesh(new T.SphereGeometry(.012,6,6),m.leather);o.scale.y=.22;o.position.set(-.27+a*.18,.515,-.25+b*.17);g.add(o);}}
 chair(40.5,8.5);chair(42.6,8.5);chair(40.38,9.72,true);chair(42.48,9.72,true);
 const sg=new T.Group();sg.position.set(sculpture.x,sculpture.pedestal,sculpture.z);sg.rotation.y=-.35;groups.sculpture.add(sg);box(groups.sculpture,'雕塑基座',sculpture.x-.32,detail.poolSlab,sculpture.z-.32,.64,sculpture.pedestal-detail.poolSlab,.64,m.bronze);
 const ell=(p:number[],s:number[])=>{const o=new T.Mesh(new T.SphereGeometry(1,24,18),m.bronze);o.position.set(p[0],p[1],p[2]);o.scale.set(s[0],s[1],s[2]);o.name='Dawn 雕塑（轮廓示意）';o.userData.group='sculpture';o.castShadow=true;sg.add(o);pick.push(o);};
 const limb=(a:number[],b:number[],r:number,r2:number)=>{rod(sg,a,b,r,m.bronze,r2);ell(a,[r,r,r]);ell(b,[r2,r2,r2]);};ell([0,1.24,0],[.24,.27,.17]);ell([.015,1.59,-.035],[.24,.35,.16]);ell([.04,1.99,-.035],[.135,.18,.13]);limb([-.13,1.19,0],[-.16,.65,-.01],.115,.078);limb([-.16,.65,-.01],[-.2,.12,.055],.075,.045);limb([.13,1.19,.015],[.22,.69,.11],.12,.077);limb([.22,.69,.11],[.18,.12,.18],.073,.041);ell([-.2,.055,.1],[.07,.06,.14]);ell([.18,.055,.22],[.066,.056,.12]);limb([-.2,1.79,-.03],[-.47,2.1,-.02],.085,.057);limb([-.47,2.1,-.02],[-.13,2.3,.03],.055,.042);limb([.2,1.8,-.04],[.38,2.13,-.14],.08,.054);limb([.38,2.13,-.14],[.1,2.33,-.035],.052,.036);ell([-.08,2.3,.035],[.095,.045,.035]);ell([.05,2.33,-.02],[.08,.04,.032]);
 const ground=new T.Mesh(new T.PlaneGeometry(300,300),m.ground);ground.userData.context=true;ground.rotation.x=-Math.PI/2;ground.position.set(26,-.02,4);ground.receiveShadow=true;context.add(ground);
 // Context geometry is deliberately neutral: unverified tree locations are omitted.
 let env:T.WebGLRenderTarget|undefined;
 if(renderer){const sky=new Sky();sky.scale.setScalar(1000);sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.1;sky.material.uniforms.sunPosition.value.fromArray(lighting.sunPosition).sub(new T.Vector3().fromArray(lighting.sunTarget)).normalize();const es=new T.Scene();const earth=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.MeshBasicMaterial({color:0x6f756c}));earth.rotation.x=-Math.PI/2;earth.position.y=-2;es.add(sky,earth);const pm=new T.PMREMGenerator(renderer),result=pm.fromScene(es,.05);env=result;pm.dispose();sky.geometry.dispose();sky.material.dispose();earth.geometry.dispose();earth.material.dispose();}
 const contact=contactLighting(root,context,solids,Object.values(m));
 return {root,context,groups,solids,pick,mirrors,contact,joints,materials:m,allMaterials:[...Object.values(m),...extras],env:env?.texture??null,dispose(){for(const g of [root,context])g.traverse(o=>{if((o as T.Mesh).geometry)(o as T.Mesh).geometry.dispose();});Object.values(m).forEach(m=>m.dispose());extras.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());mirrors.forEach(r=>r.getRenderTarget().dispose());env?.dispose();}};
}
