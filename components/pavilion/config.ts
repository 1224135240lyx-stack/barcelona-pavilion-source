// Display and animation parameters, independent of the renderer.
export type Mode = 'orbit' | 'roof' | 'explode' | 'section';
export type View = 'overall' | 'entry' | 'pool' | 'court' | 'top';
export type State = {mode:Mode; view:View; expand:number; cut:number; axis:'x'|'z'; quality:'high'|'balanced'; hidden:string[]};
export const defaults:State = {mode:'orbit',view:'overall',expand:85,cut:60,axis:'z',quality:'high',hidden:[]};
export const GROUPS = ['base','pools','furniture','sculpture','travertine','green','onyx','glass','columns','roof'] as const;
export const cameraConfig = {
  fov:38, near:.15, far:650, minDistance:5, maxDistance:400,
  target:[28,1.1,6.5],
  views:{
    overall:{position:[62,36,69],target:[28,1.1,6.5]},
    entry:{position:[47,8.4,27],target:[36.8,1.6,8]},
    pool:{position:[14,7,32],target:[31,1.6,6.6]},
    court:{position:[58,11,26],target:[49.5,1.6,6.6]},
  },
};
export const animation = {seconds:1.05,damping:6,snap:.0001,roofLift:6.5,
  // Clear gaps at the default 85%; 0 is exactly assembled. Base remains the datum.
  explode:{base:0,pools:0,furniture:0,sculpture:0,travertine:4,green:4,onyx:4,glass:8.4,columns:12.8,roof:17.2}};
export const lighting={background:'#fff7ee',skyTop:'#fffcf9',skyHorizon:'#ffffff',exposure:.75,environment:.10,hemisphere:6.62,sun:6.25,sunPosition:[4,27,33],sunTarget:[28,0,6],shadowBias:-.00006,normalBias:.008,shadowRadius:2.2};
export const qualityConfig={high:{dpr:1.5,reflection:640,shadow:2048},balanced:{dpr:1,reflection:320,shadow:1024}};
export const surfaceConfig={textureSize:512,stoneAnisotropy:4,contactRadius:.65,contactStrength:.5,contactGrid:.55,waterRipple:.0012,nearDistance:45,farDistance:100};
export function nextState(state:State,patch:Partial<State>):State {
  if(patch.mode!==undefined&&!['orbit','roof','explode','section'].includes(patch.mode))throw new Error('未知观察模式');
  if(patch.view!==undefined&&!['overall','entry','pool','court','top'].includes(patch.view))throw new Error('未知视角');
  if(patch.axis!==undefined&&!['x','z'].includes(patch.axis))throw new Error('未知剖切方向');
  if(patch.quality!==undefined&&!['high','balanced'].includes(patch.quality))throw new Error('未知画质');
  for(const key of ['expand','cut'] as const)if(patch[key]!==undefined&&(!Number.isFinite(patch[key])||patch[key]!<0||patch[key]!>100))throw new Error('参数必须是 0–100 的有限数值');
  const next={...state,...patch,hidden:[...(patch.hidden??state.hidden)]};
  if(next.hidden.some(k=>!GROUPS.includes(k as typeof GROUPS[number])))throw new Error('未知构件分组');
  // Top projection cannot explain vertical separation: restore a spatial view.
  if(patch.view==='top')next.mode='orbit';
  if(patch.mode&&['roof','explode','section'].includes(patch.mode)&&next.view==='top')next.view='overall';
  return next;
}
export function groupOffsets(state:State):Record<string,number>{
  return Object.fromEntries(GROUPS.map(key=>[key,state.mode==='explode'?animation.explode[key]*state.expand/100:state.mode==='roof'&&key==='roof'?animation.roofLift:0]));
}
