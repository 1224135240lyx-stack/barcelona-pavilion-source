import * as T from 'three';
import {surfaceConfig} from './config';

// Small, deterministic PBR sets. Albedo is sRGB; roughness/normal are linear data.
// Maps are periodic at their boundaries and use metre-scaled UVs rather than per-box stretching.
export function materials(renderer?:T.WebGLRenderer){
 const textures:T.Texture[]=[];const size=surfaceConfig.textureSize;
 const noise=(x:number,y:number,px:number,py:number)=>{
  const hash=(a:number,b:number)=>{a=((a%px)+px)%px;b=((b%py)+py)%py;const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
  const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,s=u*u*(3-2*u),t=v*v*(3-2*v);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(i,j),hash(i+1,j),s),T.MathUtils.lerp(hash(i,j+1),hash(i+1,j+1),s),t);
 };
 const map=(data:Uint8Array,color=false)=>{
  const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
  t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;
  t.anisotropy=Math.min(surfaceConfig.stoneAnisotropy,renderer?.capabilities.getMaxAnisotropy()??1);t.needsUpdate=true;textures.push(t);return t;
 };
 function stone(kind:string){
  const color=new Uint8Array(size*size*4),rough=new Uint8Array(color.length),normal=new Uint8Array(color.length),height=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   let u=x/size,v=y/size;if(kind==='onyx')u=Math.abs(u-.5)*2;
   const a=noise(u*4,v*5,4,5),b=noise(u*13+9,v*16,13,16),fine=noise(u*170,v*170,170,170),n=a*.65+b*.35;
   let col:number[],r:number,h:number;
   if(kind==='travertine'){
    const strata=noise(u*3+noise(u*8,v*9,8,9)*.35,v*110,3,110);
    const pores=Math.max(0,noise(u*240,v*150,240,150)-.64)*2.8;
    const tone=(strata-.5)*19+(n-.5)*13-pores*35;
    col=[192+tone,180+tone,155+tone];r=.69+fine*.12+pores*.12;h=(strata-.5)*.0005-pores*.0018;
   }else if(kind==='pebble'){
    const grain=noise(u*145,v*145,145,145);col=[70+grain*39,75+grain*35,59+grain*29];r=.88+grain*.1;h=grain*.002;
   }else{
    const warped=noise(u*6+3*a,v*6+2*b,6,6),vein=Math.pow(Math.max(0,1-Math.abs(warped-.51)*28),2);
    const micro=Math.max(0,1-Math.abs(noise(u*32+n,v*25,32,25)-.53)*60)*.16;
    col=kind==='onyx'?[142+n*55+vein*30,86+n*54+vein*43,32+n*45+vein*54]:[22+n*25+(vein+micro)*75,42+n*27+(vein+micro)*74,35+n*25+(vein+micro)*68];
    col=col.map(k=>k+(fine-.5)*4);r=(kind==='onyx'?.25:.23)+fine*.10+vein*.025;h=(fine-.5)*.00018+vein*.00009;
   }
   const i=(y*size+x)*4;color.set([...col.map(k=>Math.round(T.MathUtils.clamp(k,0,255))),255],i);
   const rv=Math.round(T.MathUtils.clamp(r,0,1)*255);rough.set([rv,rv,rv,255],i);height[y*size+x]=h;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const at=(a:number,b:number)=>height[((b+size)%size)*size+(a+size)%size];
   const dx=(at(x+1,y)-at(x-1,y))*size/8,dy=(at(x,y+1)-at(x,y-1))*size/8;
   const inv=1/Math.hypot(dx,dy,1),i=(y*size+x)*4;
   normal.set([Math.round((-dx*inv*.5+.5)*255),Math.round((-dy*inv*.5+.5)*255),Math.round((inv*.5+.5)*255),255],i);
  }
  return {map:map(color,true),roughnessMap:map(rough),normalMap:map(normal),roughness:1};
 }
 const trav=stone('travertine'),green=stone('green'),onyx=stone('onyx'),pebble=stone('pebble');
 const m:Record<string,T.MeshStandardMaterial|T.MeshPhysicalMaterial>={
  travertine:new T.MeshStandardMaterial({...trav}),
  green:new T.MeshPhysicalMaterial({...green,metalness:0,envMapIntensity:.8,clearcoat:.08,clearcoatRoughness:.3}),
  onyx:new T.MeshPhysicalMaterial({...onyx,metalness:0,envMapIntensity:.7,clearcoat:.06,clearcoatRoughness:.34}),
  glass:new T.MeshPhysicalMaterial({color:0xc4d7cd,metalness:0,roughness:.085,transparent:true,opacity:.22,ior:1.52,specularIntensity:1,envMapIntensity:1.05,side:T.FrontSide,depthWrite:false}),
  frost:new T.MeshStandardMaterial({color:0xcdd2c7,roughness:.6,transparent:true,opacity:.84,emissive:0xa3b0a0,emissiveIntensity:.025,side:T.FrontSide,depthWrite:false}),
  metal:new T.MeshStandardMaterial({color:0xb7c0c0,metalness:1,roughness:.22,envMapIntensity:1.1}),
  roof:new T.MeshStandardMaterial({color:0xcac9c1,roughness:.84}),
  rim:new T.MeshStandardMaterial({color:0x9aa5a4,metalness:.7,roughness:.27}),
  pool:new T.MeshStandardMaterial({...pebble}),
  leather:new T.MeshStandardMaterial({color:0xd4cbbb,roughness:.64}),
  bronze:new T.MeshStandardMaterial({color:0x454c39,metalness:.68,roughness:.48}),
  seam:new T.MeshStandardMaterial({color:0x908774,roughness:1}),
  water:new T.MeshPhysicalMaterial({color:0x718d7d,metalness:0,roughness:.13,transparent:true,opacity:.19,ior:1.333,envMapIntensity:.55,depthWrite:false,side:T.FrontSide}),
  ground:new T.MeshStandardMaterial({color:0xcec9be,metalness:0,roughness:1,envMapIntensity:.08,transparent:true,opacity:.0,depthWrite:false}),
  rug:new T.MeshStandardMaterial({color:0x302e29,roughness:1}),
 };
 // Stable Fresnel alpha on one outward-facing side avoids four-layer box-glass accumulation.
 m.glass.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`diffuseColor.a = mix(0.13, 0.50, pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 5.0));\n#include <opaque_fragment>`);
 };
 m.glass.customProgramCacheKey=()=> 'pavilion-glass-fresnel-v1';
 // Let the unchanged ground receiver dissolve into the warm sky; keep its real cast shadows.
 m.ground.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 vGroundXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundXZ=(modelMatrix*vec4(position,1.0)).xz;');
  shader.fragmentShader='varying vec2 vGroundXZ;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= 1.0-smoothstep(32.0,72.0,length(vGroundXZ-vec2(28.0,6.0)));\n#include <opaque_fragment>');
 };
 m.ground.customProgramCacheKey=()=> 'pavilion-ground-fade-v1';
 for(const [key,mat]of Object.entries(m)){mat.name=key;mat.dithering=true;mat.userData.previewColor=({travertine:'#c0b49b',green:'#354e40',onyx:'#b3833c',pool:'#526350'} as Record<string,string>)[key]??'#'+mat.color.getHexString();}
 return {m,textures};
}

/** Metre-based face UVs preserve density across slab cells and wall lengths. */
export function stoneUV(geometry:T.BoxGeometry,x:number,y:number,z:number,w:number,h:number,d:number,kind:string){
 if(!['travertine','green','onyx','pool'].includes(kind))return;
 const pos=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
 for(let i=0;i<pos.count;i++){
  const px=pos.getX(i)+w/2,pz=pos.getZ(i)+d/2,py=pos.getY(i)+h/2;
  let u:number,v:number;
  if(Math.abs(normal.getY(i))>.5){u=(x+px)/4;v=(z+pz)/4;}
  else if(kind==='onyx'){u=w>d?px/w:pz/d;v=py/h;}
  else{u=(Math.abs(normal.getX(i))>.5?z+pz:x+px)/(kind==='green'?5:4);v=(y+py)/(kind==='green'?3.1:2);}
  uv.setXY(i,u,v);
 }
 uv.needsUpdate=true;
}
