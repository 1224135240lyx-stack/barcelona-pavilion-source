import * as T from 'three';
import {surfaceConfig,lighting} from './config';

/** Bake short-range hemisphere visibility once, using the existing solid bounds.
 * It only modulates indirect light, never darkens direct sunlight. No screen-space pass.
 * Disable the bake when assembly, clipping or visibility changes invalidate it. */
export function contactLighting(root:T.Group,context:T.Group,solids:T.Mesh[],materials:T.Material[]){
 root.updateMatrixWorld(true);context.updateMatrixWorld(true);
 const boxes=solids.map(mesh=>({mesh,box:new T.Box3().setFromObject(mesh)}));
 // Neutral ground is a receiver/occluder, not a new architectural component.
 boxes.push({mesh:null as unknown as T.Mesh,box:new T.Box3(new T.Vector3(-124,-.05,-146),new T.Vector3(176,-.02,154))});
 const strength={value:surfaceConfig.contactStrength},radius=surfaceConfig.contactRadius;
 const point=new T.Vector3(),normal=new T.Vector3(),hit=new T.Vector3(),ray=new T.Ray(),normalMatrix=new T.Matrix3();
 const samples=Array.from({length:10},(_,i)=>{const z=Math.sqrt(1-(i+.5)/10),r=Math.sqrt(1-z*z),a=i*2.399963;return new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z);});
 const up=new T.Vector3(0,0,1),basis=new T.Quaternion(),direction=new T.Vector3();
 const sunlight=new T.Vector3().fromArray(lighting.sunPosition).sub(new T.Vector3().fromArray(lighting.sunTarget)).normalize();
 const bake=(obj:T.Object3D)=>{
  const mesh=obj as T.Mesh;if(!mesh.isMesh)return;const geometry=mesh.geometry;
  if((mesh.material as T.Material).type==='ShaderMaterial')return;
  const pos=geometry.attributes.position,norm=geometry.attributes.normal,values=new Float32Array(pos.count).fill(1),daylight=new Float32Array(pos.count).fill(1);
  const region=new T.Box3().setFromObject(mesh).expandByScalar(radius);
  const nearby=boxes.filter(b=>b.mesh!==mesh&&b.box.intersectsBox(region));
  normalMatrix.getNormalMatrix(mesh.matrixWorld);
  if(norm&&!mesh.userData.context)for(let i=0;i<pos.count;i++){
   point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(norm,i).applyNormalMatrix(normalMatrix);
   ray.origin.copy(point).addScaledVector(normal,.006);basis.setFromUnitVectors(up,normal);let blocked=0;
   for(const sample of samples){ray.direction.copy(direction.copy(sample).applyQuaternion(basis));let nearest=radius;
    for(const b of nearby)if(ray.intersectBox(b.box,hit))nearest=Math.min(nearest,hit.distanceTo(ray.origin));
    blocked+=Math.pow(1-nearest/radius,1.2);
   }
   values[i]=1-blocked/samples.length;
   // The non-WebGL viewer can reuse this coarse diffuse visibility; GPU uses real shadows.
   if(normal.dot(sunlight)>.01){ray.direction.copy(sunlight);for(const b of boxes)if(b.mesh!==mesh&&ray.intersectBox(b.box,hit)&&hit.distanceTo(ray.origin)<100){daylight[i]=0;break;}}
  }
  geometry.setAttribute('contactAO',new T.BufferAttribute(values,1));
  geometry.setAttribute('daylight',new T.BufferAttribute(daylight,1));
 };
 root.traverse(bake);context.traverse(bake);
 for(const material of materials){const mat=material as T.MeshStandardMaterial;if(!mat.isMeshStandardMaterial)continue;
  const prior=mat.onBeforeCompile;
  mat.onBeforeCompile=(shader,renderer)=>{
   prior.call(mat,shader,renderer);shader.uniforms.contactStrength=strength;
   shader.vertexShader='attribute float contactAO; varying float vContactAO;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvContactAO = contactAO;');
   shader.fragmentShader='uniform float contactStrength; varying float vContactAO;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
    float contactVisibility = mix(1.0, max(0.25, vContactAO), contactStrength);
    reflectedLight.indirectDiffuse *= contactVisibility;
    reflectedLight.indirectSpecular *= mix(1.0, contactVisibility, 0.35);`);
  };
  const priorKey=mat.customProgramCacheKey.bind(mat);const key=priorKey();mat.customProgramCacheKey=()=>key+'|contact-v1';
  mat.userData.contactStrength=strength;
 }
 return {strength};
}
