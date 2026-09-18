import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createModel} from './model';
import {SoftwareRenderer} from './software-renderer';
import {defaults,nextState,groupOffsets,cameraConfig,animation,lighting,surfaceConfig,type State,type Mode,type View} from './config';
import {bounds} from './plan';
import {backgroundTexture,renderBudget} from './rendering';
export {defaults,type State,type Mode,type View} from './config';
export type Position={x:number,z:number,angle:number};
type Snapshot={state:State;camera:Position;backend:'webgl'|'software';offsets:Record<string,number>;cutActive:boolean;moving:boolean};
export class Engine{
 scene=new T.Scene();background=backgroundTexture();budgetKey='';shadowDirty=true;renderSamples=0;renderTotal=0;
 camera=new T.PerspectiveCamera(cameraConfig.fov,1,cameraConfig.near,cameraConfig.far);
 ortho=new T.OrthographicCamera(-36,36,24,-24,cameraConfig.near,cameraConfig.far);
 active:T.PerspectiveCamera|T.OrthographicCamera=this.camera;
 renderer:T.WebGLRenderer|SoftwareRenderer;gpu:T.WebGLRenderer|undefined;
 controls:OrbitControls;model:ReturnType<typeof createModel>;
 state:State=nextState(defaults,{});light:T.DirectionalLight;
 backend:'webgl'|'software'='webgl';disposed=false;frame=0;last=0;reportTime=0;dirty=true;cutActive=false;
 offsets:Record<string,number>=groupOffsets(defaults);
 tween:null|{from:T.Vector3;to:T.Vector3;start:T.Vector3;end:T.Vector3;t:number}=null;
 selection:T.BoxHelper|null=null;selected:T.Object3D|null=null;
 clip=new T.Plane();capRoot=new T.Group();capMaterial=new T.MeshStandardMaterial({color:0xb19b6f,roughness:.87,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
 caps:{mesh:T.Mesh;source:T.Mesh;bounds:T.Box3}[]=[];
 observer:ResizeObserver;down=[0,0];ray=new T.Raycaster();pointer=new T.Vector2();direction=new T.Vector3();
 reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 constructor(public host:HTMLElement,public onSnapshot:(s:Snapshot)=>void,public onSelect:(v:string[])=>void,public onError:(v:string)=>void){
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'default'});
  if(context){this.gpu=new T.WebGLRenderer({canvas,context,antialias:true});this.renderer=this.gpu;}
  else{this.backend='software';this.renderer=new SoftwareRenderer();}
  this.scene.background=this.background;
  if(this.gpu){const r=this.gpu;r.localClippingEnabled=true;r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=lighting.exposure;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFShadowMap;r.shadowMap.autoUpdate=false;}
  this.host.appendChild(this.renderer.domElement);
  const el=this.renderer.domElement;el.tabIndex=0;el.setAttribute('aria-label','建筑模型：拖动旋转，滚轮缩放，右键或双指平移');el.dataset.backend=this.backend;
  this.camera.position.fromArray(cameraConfig.views.overall.position);this.controls=new OrbitControls(this.camera,el);
  this.controls.target.fromArray(cameraConfig.target);this.controls.enableDamping=true;this.controls.dampingFactor=.09;
  this.controls.minDistance=cameraConfig.minDistance;this.controls.maxDistance=cameraConfig.maxDistance;
  this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.minPolarAngle=.025;this.controls.screenSpacePanning=true;
  this.controls.minZoom=.45;this.controls.maxZoom=4;this.controls.update();
  this.model=createModel(this.gpu);this.scene.add(this.model.root,this.model.context,this.capRoot);
  this.scene.environment=this.model.env;this.scene.environmentIntensity=lighting.environment;
  this.scene.add(new T.HemisphereLight(0xd7e1e6,0x7d7766,lighting.hemisphere));
  this.light=new T.DirectionalLight(0xfff5e6,lighting.sun);this.light.position.fromArray(lighting.sunPosition);
  this.light.target.position.fromArray(lighting.sunTarget);this.light.castShadow=true;
  Object.assign(this.light.shadow.camera,{left:-43,right:43,top:35,bottom:-28,near:.5,far:130});this.light.shadow.normalBias=lighting.normalBias;this.light.shadow.bias=lighting.shadowBias;this.light.shadow.radius=lighting.shadowRadius;
  this.scene.add(this.light,this.light.target);
  this.model.root.updateMatrixWorld(true);
  const capGeometry=new T.PlaneGeometry(1,1);
  for(const source of this.model.solids){const mesh=new T.Mesh(capGeometry,this.capMaterial);mesh.visible=false;this.capRoot.add(mesh);this.caps.push({mesh,source,bounds:new T.Box3().setFromObject(source)});}
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
  this.controls.addEventListener('start',this.interrupt);this.controls.addEventListener('change',this.invalidate);
  el.addEventListener('pointerdown',this.pointerDown);el.addEventListener('pointerup',this.pointerUp);
  el.addEventListener('webglcontextlost',this.contextLost);document.addEventListener('visibilitychange',this.visibility);
  this.applyQuality();this.resize();this.emit();this.invalidate();
 }
 snapshot():Snapshot{return{state:{...this.state,hidden:[...this.state.hidden]},camera:{x:this.active.position.x,z:this.active.position.z,angle:Math.atan2(this.active.getWorldDirection(this.direction).x,-this.direction.z)},backend:this.backend,offsets:{...this.offsets},cutActive:this.cutActive,moving:!!this.tween||this.hasGroupMotion()};}
 emit(){const snap=this.snapshot();this.host.dataset.scene=JSON.stringify(snap);this.onSnapshot(snap);}
 set(patch:Partial<State>){
  const old=this.state;this.state=nextState(old,patch);
  if(patch.mode!==undefined){this.select(null);}
  for(const [key,g]of Object.entries(this.model.groups))g.visible=!this.state.hidden.includes(key);
  if(this.selected&&this.state.hidden.includes(this.selected.userData.group))this.select(null);
  if(old.quality!==this.state.quality)this.applyQuality();
  if(old.view!==this.state.view)this.setView(this.state.view);
  this.applyClipping();this.dirty=true;this.emit();this.invalidate();return this.state;
 }
 mode(mode:Mode){return this.set({mode});}
 view(view:View){this.set({view});if(this.state.view===view)this.setView(view);}
 setView(id:View){
  this.tween=null;this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=true;
  if(id==='top'){
   this.active=this.ortho;this.ortho.zoom=1;this.ortho.position.set(28,100,5.5);this.ortho.up.set(0,0,-1);this.ortho.lookAt(28,0,5.5);this.ortho.updateProjectionMatrix();
   this.controls.object=this.ortho;this.controls.minPolarAngle=0;this.controls.target.set(28,0,5.5);this.controls.enableRotate=false;this.controls.update();this.invalidate();return;
  }
  this.active=this.camera;this.controls.object=this.camera;this.controls.minPolarAngle=.025;this.controls.enableRotate=true;
  const p=cameraConfig.views[id],to=new T.Vector3().fromArray(p.position),target=new T.Vector3().fromArray(p.target);
  if(id==='overall'&&this.camera.aspect<1.25)to.sub(target).multiplyScalar(Math.max(1,1.25/this.camera.aspect)).add(target);
  this.tween={from:this.camera.position.clone(),to,start:this.controls.target.clone(),end:target,t:0};
  this.invalidate();
 }
 reset(){const quality=this.state.quality;this.state=nextState(defaults,{quality});this.select(null);Object.values(this.model.groups).forEach(g=>g.visible=true);this.setView('overall');this.applyClipping();this.emit();this.invalidate();}
 focus(x:number,z:number){if(!Number.isFinite(x)||!Number.isFinite(z))return;const point=new T.Vector3(T.MathUtils.clamp(x,bounds.x[0],bounds.x[1]),1,T.MathUtils.clamp(z,bounds.z[0],bounds.z[1]));const delta=point.clone().sub(this.controls.target);this.active.position.add(delta);this.controls.target.copy(point);this.tween=null;this.controls.update();this.emit();this.invalidate();}
 zoom(amount:number){this.interrupt();if(this.active===this.ortho){this.ortho.zoom=T.MathUtils.clamp(this.ortho.zoom*amount,.45,4);this.ortho.updateProjectionMatrix();}else{const d=this.camera.position.clone().sub(this.controls.target);this.camera.position.copy(this.controls.target).add(d.setLength(T.MathUtils.clamp(d.length()/amount,cameraConfig.minDistance,cameraConfig.maxDistance)));}this.controls.update();this.emit();this.invalidate();}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const oldAspect=this.camera.aspect;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const hh=Math.max(21,34/(w/h));Object.assign(this.ortho,{left:-hh*w/h,right:hh*w/h,top:hh,bottom:-hh});this.ortho.updateProjectionMatrix();if(this.state.view==='overall'&&Math.abs(oldAspect-w/h)>.1)this.setView('overall');this.invalidate();}
 applyQuality(){
  const distance=this.active===this.ortho?80/this.ortho.zoom:this.camera.position.distanceTo(this.controls.target);
  const q=renderBudget(this.state.quality,distance,this.host.clientWidth<700,this.budgetKey);
  if(q.key!==this.budgetKey){this.budgetKey=q.key;if(this.gpu){
   this.gpu.setPixelRatio(Math.min(devicePixelRatio,q.dpr));
   if(this.light.shadow.mapSize.x!==q.shadow){this.light.shadow.mapSize.set(q.shadow,q.shadow);this.light.shadow.map?.dispose();this.light.shadow.map=null;}
   this.light.shadow.radius=lighting.shadowRadius*q.shadow/2048;this.shadowDirty=true;
  }
  for(const r of this.model.mirrors)r.getRenderTarget().setSize(q.reflection,q.reflection);}
  for(const name of ['travertine','green','onyx','pool'])this.model.materials[name].normalScale.setScalar(q.detail);
  (this.model.joints.material as T.LineBasicMaterial).opacity=.07+.07*q.detail;
  this.dirty=true;
 }

 hasGroupMotion(){const target=groupOffsets(this.state);return Object.keys(target).some(k=>this.offsets[k]!==target[k]);}
 applyClipping(){
  const active=this.state.mode==='section'&&!this.hasGroupMotion(),changed=active!==this.cutActive;this.cutActive=active;
  const range=bounds[this.state.axis];this.clip.normal.set(this.state.axis==='x'?-1:0,0,this.state.axis==='z'?-1:0);this.clip.constant=T.MathUtils.lerp(range[0],range[1],this.state.cut/100);
  for(const mat of this.model.allMaterials){if(mat.name==='ground'||mat.type==='ShaderMaterial')continue;mat.clippingPlanes=active?[this.clip]:[];mat.clipShadows=true;if(changed)mat.needsUpdate=true;}
  this.model.mirrors.forEach(r=>r.visible=!active&&this.state.mode!=='explode');
  const separated=Math.max(...Object.values(this.offsets));this.model.contact.strength.value=active||this.state.hidden.length?0:surfaceConfig.contactStrength*Math.exp(-separated*10);
  this.shadowDirty=true;
  for(const cap of this.caps){const {mesh,source,bounds:b}=cap;const v=this.clip.constant,n=this.state.axis;mesh.visible=active&&!!source.parent?.visible&&v>b.min[n]+.00001&&v<b.max[n]-.00001;
   if(!mesh.visible)continue;b.getCenter(mesh.position);mesh.position[n]=v-.0002;mesh.rotation.set(0,n==='x'?Math.PI/2:0,0);mesh.scale.set(n==='x'?b.max.z-b.min.z:b.max.x-b.min.x,b.max.y-b.min.y,1);
  }
  this.dirty=true;
 }
 select(o:T.Object3D|null){this.selected=o;if(this.selection){this.scene.remove(this.selection);this.selection.geometry.dispose();(this.selection.material as T.Material).dispose();this.selection=null;}if(o){this.selection=new T.BoxHelper(o,0xaa9365);this.scene.add(this.selection);this.onSelect([o.name,o.userData.group]);}else this.onSelect([]);this.invalidate();}
 pointerDown=(e:PointerEvent)=>{this.down=[e.clientX,e.clientY];};
 pointerUp=(e:PointerEvent)=>{if(e.button!==0||Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>4)return;const b=this.host.getBoundingClientRect();this.ray.setFromCamera(this.pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),this.active);const hit=this.ray.intersectObjects(this.model.pick,false).find(h=>{let o:T.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent;}return !this.cutActive||this.clip.distanceToPoint(h.point)>=0;});this.select(hit?.object??null);};
 interrupt=()=>{this.tween=null;this.invalidate();};
 contextLost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(this.frame);this.frame=0;this.onError('显卡连接已中断。请重新加载模型；若显卡不可用，将自动进入轻量模式。');};
 visibility=()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else{this.last=0;this.invalidate();}};
 invalidate=()=>{this.dirty=true;if(!this.disposed&&!this.frame&&!document.hidden)this.frame=requestAnimationFrame(this.animate);};
 animate=(time:number)=>{
  this.frame=0;if(this.disposed)return;
  const dt=Math.min((time-this.last)/1000||1/60,.05);this.last=time;let changed=false;
  const targets=groupOffsets(this.state);
  for(const [key,target]of Object.entries(targets)){if(this.offsets[key]===target)continue;const value=this.reduced?target:T.MathUtils.damp(this.offsets[key],target,animation.damping,dt);this.offsets[key]=Math.abs(value-target)<animation.snap?target:value;this.model.groups[key].position.y=this.offsets[key];changed=true;}
  if(changed)this.applyClipping();
  if(this.tween){const t=this.tween;t.t=this.reduced?1:Math.min(1,t.t+dt/animation.seconds);const a=t.t*t.t*(3-2*t.t);this.camera.position.lerpVectors(t.from,t.to,a);this.controls.target.lerpVectors(t.start,t.end,a);if(t.t===1)this.tween=null;changed=true;}
  const orbitChanged=this.controls.update();
  if(this.dirty||changed||orbitChanged){this.applyQuality();if(this.gpu&&(changed||this.shadowDirty))this.gpu.shadowMap.needsUpdate=true;this.selection?.update();if(this.renderer instanceof SoftwareRenderer)this.renderer.setInteractive(!!this.tween||this.hasGroupMotion()||orbitChanged);const start=performance.now();this.renderer.render(this.scene,this.active);const elapsed=performance.now()-start;this.renderSamples++;this.renderTotal+=elapsed;this.host.dataset.renderMetrics=JSON.stringify({backend:this.backend,frameMs:Math.round(elapsed),meanMs:Math.round(this.renderTotal/this.renderSamples),frames:this.renderSamples,budget:this.budgetKey,contact:this.model.contact.strength.value});this.dirty=false;this.shadowDirty=false;this.emit();}
  if(this.tween||this.hasGroupMotion()||orbitChanged)this.invalidate();
 };
 async settled(){const start=performance.now();while((this.tween||this.hasGroupMotion())&&!this.disposed&&performance.now()-start<5000)await new Promise(requestAnimationFrame);if(this.disposed)throw new Error('展览已关闭');return this.snapshot();}
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.controls.removeEventListener('start',this.interrupt);this.controls.removeEventListener('change',this.invalidate);this.controls.dispose();const el=this.renderer.domElement;el.removeEventListener('pointerdown',this.pointerDown);el.removeEventListener('pointerup',this.pointerUp);el.removeEventListener('webglcontextlost',this.contextLost);document.removeEventListener('visibilitychange',this.visibility);this.select(null);this.model.dispose();this.background.dispose();this.caps[0]?.mesh.geometry.dispose();this.capMaterial.dispose();this.light.shadow.map?.dispose();this.renderer.dispose();el.remove();}
}
