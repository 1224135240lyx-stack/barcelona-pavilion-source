import * as T from 'three';
import {lighting,surfaceConfig} from './config';

/** Same geometry and clipping as WebGL. Lightweight diffuse texture/shadow preview;
 * no claim to reproduce GPU specular, normal maps or planar reflections. */
type Vertex={world:T.Vector3;uv:T.Vector2;ao:number;day:number};
type Screen={x:number;y:number;z:number;inv:number;u:number;v:number;light:number};
type Face={p:Screen[];depth:number;color:number[];alpha:number;map?:{data:Uint8Array;width:number;height:number}};
export class SoftwareRenderer {
 readonly domElement=document.createElement('canvas');
 private ctx:CanvasRenderingContext2D;
 private width=1;private height=1;private depth=new Float64Array(1);private pixels:ImageData;
 private logicalWidth=1;private logicalHeight=1;private interactive=false;
 private mips=new WeakMap<object,NonNullable<Face['map']>[]>();
 private meshCache=new WeakMap<T.Mesh,{matrix:T.Matrix4;points:Vertex[];normals:T.Vector3[];box:T.Box3}>();
 private linear=Float32Array.from({length:256},(_,v)=>T.ColorManagement.colorSpaceToWorking(new T.Color().setRGB(v/255,v/255,v/255),T.SRGBColorSpace).r);
 private display=Uint8Array.from({length:4096},(_,i)=>{const x=i/2048*lighting.exposure;const tone=T.MathUtils.clamp(x*(2.51*x+.03)/(x*(2.43*x+.59)+.14),0,1);return Math.round(new T.Color().setRGB(tone,tone,tone).convertLinearToSRGB().r*255);});
 constructor(){const ctx=this.domElement.getContext('2d');if(!ctx)throw new Error('浏览器不支持画布');this.ctx=ctx;this.pixels=ctx.createImageData(1,1);}
 setSize(w:number,h:number){this.logicalWidth=w;this.logicalHeight=h;const scale=Math.min(1,(this.interactive?640:1000)/w,(this.interactive?440:760)/h);this.width=Math.round(w*scale);this.height=Math.round(h*scale);this.domElement.width=this.width;this.domElement.height=this.height;this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';this.depth=new Float64Array(this.width*this.height);this.pixels=this.ctx.createImageData(this.width,this.height);}
 setInteractive(value:boolean){if(value===this.interactive)return;this.interactive=value;this.setSize(this.logicalWidth,this.logicalHeight);}
 render(scene:T.Scene,camera:T.Camera){
  const w=this.width,h=this.height,data=this.pixels.data,depth=this.depth;depth.fill(Infinity);
  const top=new T.Color(lighting.skyTop).convertLinearToSRGB(),bottom=new T.Color(lighting.skyHorizon).convertLinearToSRGB();
  for(let y=0;y<h;y++){const t=y/h;const r=(top.r*(1-t)+bottom.r*t)*255,g=(top.g*(1-t)+bottom.g*t)*255,b=(top.b*(1-t)+bottom.b*t)*255;for(let x=0;x<w;x++){const i=(y*w+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}}
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),pe=projection.elements;
  const transparent:Face[]=[];
  const sun=new T.Vector3().fromArray(lighting.sunPosition).sub(new T.Vector3().fromArray(lighting.sunTarget)).normalize();
  const raster=(face:Face)=>{
   for(let j=1;j<face.p.length-1;j++){
    const [a,b,c]=[face.p[0],face.p[j],face.p[j+1]];
    const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<.0001)continue;
    const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));
    const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const px=x+.5,py=y+.5,u=((b.x-px)*(c.y-py)-(b.y-py)*(c.x-px))/area,v=((c.x-px)*(a.y-py)-(c.y-py)*(a.x-px))/area,t=1-u-v;
     if(u<0||v<0||t<0)continue;const z=u*a.z+v*b.z+t*c.z,k=y*w+x;if(z>depth[k]+1e-10)continue;
     const inv=1/(u*a.inv+v*b.inv+t*c.inv),light=(u*a.light+v*b.light+t*c.light)*inv,q=k*4,alpha=face.alpha;
     let texel=-1;
     if(face.map){const tx=(u*a.u+v*b.u+t*c.u)*inv,ty=(u*a.v+v*b.v+t*c.v)*inv;texel=(Math.floor((ty-Math.floor(ty))*face.map.height)*face.map.width+Math.floor((tx-Math.floor(tx))*face.map.width))*4;}
     for(let n=0;n<3;n++){const albedo=texel<0?face.color[n]:this.linear[face.map!.data[texel+n]];const col=this.display[Math.min(4095,Math.max(0,Math.round(albedo*light*2048)))];data[q+n]=col*alpha+data[q+n]*(1-alpha);}
     if(alpha>=.99)depth[k]=z;
    }
   }
  };
  const clip=(poly:Vertex[],plane:T.Plane)=>{
   const out:Vertex[]=[];
   for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane.distanceToPoint(a.world),db=plane.distanceToPoint(b.world);if(da>=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push({world:a.world.clone().lerp(b.world,t),uv:a.uv.clone().lerp(b.uv,t),ao:T.MathUtils.lerp(a.ao,b.ao,t),day:T.MathUtils.lerp(a.day,b.day,t)});}}
   return out;
  };
  const frustum=new T.Frustum().setFromProjectionMatrix(projection);
  const cameraDirection=camera.getWorldDirection(new T.Vector3()).negate();
  scene.traverseVisible(obj=>{
   const mesh=obj as T.Mesh;if(!mesh.isMesh||obj.userData.context)return;
   const geometry=mesh.geometry,mat=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshStandardMaterial;
   if(!geometry||!mat.visible||mat.type==='ShaderMaterial'||mat.name==='seam')return;
   const vertices=geometry.attributes.position;if(!vertices)return;
   const uv=geometry.attributes.uv,ao=geometry.attributes.contactAO,day=geometry.attributes.daylight;
   const index=geometry.index,count=index?.count??vertices.count,base=mat.color??new T.Color('#b9b5a9');
   let cached=this.meshCache.get(mesh);
   if(!cached||!cached.matrix.equals(mesh.matrixWorld)){
    const points:Vertex[]=[];for(let i=0;i<vertices.count;i++)points.push({world:new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(obj.matrixWorld),uv:uv?new T.Vector2(uv.getX(i),uv.getY(i)):new T.Vector2(),ao:ao?.getX(i)??1,day:day?.getX(i)??1});
    const normals:T.Vector3[]=[];for(let i=0;i<count;i+=3){const a=points[index?index.getX(i):i].world,b=points[index?index.getX(i+1):i+1].world,c=points[index?index.getX(i+2):i+2].world;normals.push(new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).normalize());}
    cached={matrix:mesh.matrixWorld.clone(),points,normals,box:new T.Box3().setFromPoints(points.map(p=>p.world))};this.meshCache.set(mesh,cached);
   }
   if(!frustum.intersectsBox(cached.box))return;
   const box=cached.box,center=box.getCenter(new T.Vector3()),half=box.getSize(new T.Vector3()).multiplyScalar(.5);
   const needsClip=frustum.planes.some(p=>p.distanceToPoint(center)<Math.abs(p.normal.x)*half.x+Math.abs(p.normal.y)*half.y+Math.abs(p.normal.z)*half.z);
   const planes=[...(mat.clippingPlanes??[]),...(needsClip?frustum.planes:[])],points=cached.points;
   const strength=mat.userData.contactStrength?.value??0,bake=strength/surfaceConfig.contactStrength;
   const image=mat.map?.image as Face['map'];const texture=image?.data?image:undefined;
   for(let i=0;i<count;i+=3){
    let poly=[0,1,2].map(j=>points[index?index.getX(i+j):i+j]);if(!poly.every(Boolean))continue;
    const n=cached.normals[i/3],origin=poly[0].world;
    const facing=camera instanceof T.OrthographicCamera?n.dot(cameraDirection):n.x*(camera.position.x-origin.x)+n.y*(camera.position.y-origin.y)+n.z*(camera.position.z-origin.z);
    if(mat.side!==T.DoubleSide&&facing<=0)continue;
    for(const plane of planes){poly=clip(poly,plane);if(poly.length<3)break;}if(poly.length<3)continue;
    const ndl=Math.max(0,n.dot(sun));
    const p=poly.map(vertex=>{const v=vertex.world,q=v.clone().applyMatrix4(projection),inv=1/(pe[3]*v.x+pe[7]*v.y+pe[11]*v.z+pe[15]);
     const ambient=.39*(1-strength*(1-vertex.ao)),direct=.95*ndl*(1-bake*(1-vertex.day)*.84);
     return{x:(q.x*.5+.5)*w,y:(-q.y*.5+.5)*h,z:q.z,inv,u:vertex.uv.x*inv,v:vertex.uv.y*inv,light:(ambient+direct)*inv};});
    let sampled=texture;
    if(texture){
     let levels=this.mips.get(texture);
     if(!levels){levels=[texture];let last=texture;while(last.width>8){const width=last.width/2,height=last.height/2,pixels=new Uint8Array(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<4;c++){const k=(y*2*last.width+x*2)*4+c;pixels[(y*width+x)*4+c]=(last.data[k]+last.data[k+4]+last.data[k+last.width*4]+last.data[k+last.width*4+4])/4;}last={data:pixels,width,height};levels.push(last);}this.mips.set(texture,levels);}
     const screen=Math.max(1,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y));const texels=poly[1].uv.distanceTo(poly[0].uv)*texture.width;
     sampled=levels[Math.min(levels.length-1,Math.max(0,Math.floor(Math.log2(texels/screen))))];
    }
    const face={p,depth:p.reduce((a,v)=>a+v.z,0)/p.length,color:[base.r,base.g,base.b],alpha:mat.transparent?mat.opacity:1,map:sampled};
    if(face.alpha<.99)transparent.push(face);else raster(face);
   }
  });
  transparent.sort((a,b)=>b.depth-a.depth);transparent.forEach(raster);
  this.ctx.putImageData(this.pixels,0,0);
 }
 dispose(){this.domElement.width=this.domElement.height=1;this.depth=new Float64Array(0);}
}
