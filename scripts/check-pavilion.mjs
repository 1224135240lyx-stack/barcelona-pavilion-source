// CPU geometry/state regression; deliberately not a substitute for GPU visual QA.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as T from 'three';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=await mkdtemp(path.join(root,'.pavilion-check-'));
try{
 for(const name of ['plan','config','materials','model','contact-lighting','rendering']){
  const source=await readFile(path.join(root,'components/pavilion',name+'.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '\.\/(plan|config|materials|contact-lighting)'/g,"from './$1.js'");
  await writeFile(path.join(dir,name+'.js'),js);
 }
 const {defaults,nextState,groupOffsets,GROUPS}=await import(pathToFileURL(path.join(dir,'config.js')));
 const {LEVEL,H,detail,pools,columns,roofs,walls,inside}=await import(pathToFileURL(path.join(dir,'plan.js')));
 for(const value of [-1,101,NaN,Infinity])assert.throws(()=>nextState(defaults,{cut:value}));
 assert.throws(()=>nextState(defaults,{mode:'walk'}));assert.throws(()=>nextState(defaults,{mode:'tour'}));
 assert.throws(()=>nextState(defaults,{hidden:['unknown']}));
 const exploded=groupOffsets(nextState(defaults,{mode:'explode',expand:85}));
 assert(exploded.green+H<exploded.glass);assert(exploded.glass+H<exploded.columns);assert(exploded.columns+H<exploded.roof);
 for(const mode of ['roof','explode','section','orbit']){
  const s=nextState(defaults,{mode});assert.equal(s.mode,mode);
  const zero=groupOffsets(nextState(s,{mode:'orbit'}));assert(GROUPS.every(k=>zero[k]===0));
  assert.equal(nextState(s,{view:'top'}).mode,'orbit');
 }
 assert.equal(nextState({...defaults,view:'top'},{mode:'explode'}).view,'overall');
 // Canvas pixels are allocated to construct real material/geometry objects; no fake GPU.
 globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};
 const {createModel}=await import(pathToFileURL(path.join(dir,'model.js')));
 const model=createModel();model.root.updateMatrixWorld(true);
 // Validate the actual shader customization contract and PBR data conventions.
 let vertices=0;
 model.root.traverse(o=>{if(o.isMesh){vertices+=o.geometry.attributes.position.count;const ao=o.geometry.attributes.contactAO;if(ao)for(const value of ao.array)assert(value>=0&&value<=1);}});
 for(const mat of Object.values(model.materials)){
  if(mat.map){assert.equal(mat.map.colorSpace,T.SRGBColorSpace);assert.equal(mat.roughnessMap.colorSpace,T.NoColorSpace);assert.equal(mat.normalMap.colorSpace,T.NoColorSpace);}
  const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};
  mat.onBeforeCompile(shader,{});assert(shader.vertexShader.includes('vContactAO = contactAO;'));assert(shader.fragmentShader.includes('reflectedLight.indirectDiffuse *= contactVisibility;'));
  if(mat.name==='glass')assert(shader.fragmentShader.includes('diffuseColor.a = mix(0.13, 0.50'));
 }
 const {renderBudget}=await import(pathToFileURL(path.join(dir,'rendering.js')));
 assert.equal(renderBudget('high',130,false).shadow,1024);assert.equal(renderBudget('high',25,false).reflection,640);assert.equal(renderBudget('high',25,true).reflection,256);
 console.log('Render contracts PASS; vertices:',vertices);
 const bounds=o=>new T.Box3().setFromObject(o),near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
 assert.equal(columns.length,8);assert.equal(pools.length,2);
 for(const o of model.groups.columns.children){near(bounds(o).min.y,LEVEL+(o.name==='柱脚'?0:.02));near(bounds(o).max.y,o.name==='柱脚'?LEVEL+.02:LEVEL+H);}
 for(const o of model.groups.roof.children)near(bounds(o).min.y,LEVEL+H);
 for(const c of columns){assert(roofs.some(r=>inside(c.x,c.z,r)));assert(!pools.some(r=>inside(c.x,c.z,r)));}
 for(const w of walls.filter(w=>['glass','frost'].includes(w.kind)))assert(roofs.some(r=>inside(w.x+w.w/2,w.z+w.d/2,r)));
 for(const p of pools){
  const bottom=model.groups.pools.children.find(o=>o.name===p.name+'池底');near(bounds(bottom).max.y,detail.poolSlab);
  const water=model.groups.pools.children.find(o=>o.name===p.name+'水面');near(water.position.y,detail.waterLevel);
  assert(detail.waterLevel>detail.poolSlab&&detail.waterLevel<LEVEL);
 }
 const structural=model.solids.filter(o=>!['furniture','sculpture'].includes(o.userData.group));
 const boxes=structural.map(bounds),overlaps=[];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  const penetration=['x','y','z'].map(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]));
  if(penetration.every(v=>v>1e-5))overlaps.push([structural[i].name,structural[j].name,penetration]);
 }
 assert.deepEqual(overlaps,[],'Structural solids must meet without volume overlaps');
 for(const o of model.pick){const pos=o.geometry.attributes.position;for(const value of pos.array)assert(Number.isFinite(value));}
 for(const [key,g]of Object.entries(model.groups))g.position.y=exploded[key];
 for(const [key,g]of Object.entries(model.groups))g.position.y=groupOffsets(defaults)[key];
 assert(Object.values(model.groups).every(g=>g.position.y===0));
 console.log(JSON.stringify({result:'PASS',columns:columns.length,pools:pools.length,structuralSolids:structural.length,checkedPairs:boxes.length*(boxes.length-1)/2,volumeOverlaps:overlaps.length,groups:Object.keys(model.groups).length}));
 model.dispose();
}finally{await rm(dir,{recursive:true,force:true});delete globalThis.document;}
