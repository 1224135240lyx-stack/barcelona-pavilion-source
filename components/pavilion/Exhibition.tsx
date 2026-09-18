'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Box,Layers3,Scissors,RotateCcw,Plus,Minus,Maximize,Minimize,Info,Map as MapIcon,ChevronDown,ChevronUp,Eye,EyeOff,X,MoveUpRight,ArrowUpRight} from 'lucide-react';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Slider} from '@/components/ui/slider';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {defaults,type State,type Mode,type View} from './config';
import type {Engine,Position} from './engine';
import {walls,pools,platform,columns,roofs,stair,detail} from './plan';
import {registerPavilionTools} from './webmcp';
const groupNames:Record<string,string>={roof:'屋面',columns:'十字柱',travertine:'洞石墙',green:'绿色大理石墙',onyx:'缟玛瑙墙',glass:'玻璃',base:'基座',pools:'水池',furniture:'家具',sculpture:'雕塑'};
const modes=[{id:'orbit',text:'外观探索',Icon:Box},{id:'roof',text:'打开屋顶',Icon:Layers3},{id:'explode',text:'建筑分解',Icon:MoveUpRight},{id:'section',text:'剖切观察',Icon:Scissors}] as const;
export default function Exhibition(){
 const host=useRef<HTMLDivElement>(null),engine=useRef<Engine|null>(null),latestState=useRef(''),lastCamera=useRef(0);
 const [s,setS]=useState<State>({...defaults}),[clean,setClean]=useState(false),[about,setAbout]=useState(false),[map,setMap]=useState(false);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selected,setSelected]=useState<string[]>([]);
 const [backend,setBackend]=useState(''),[moving,setMoving]=useState(false),[camera,setCamera]=useState<Position>({x:62,z:69,angle:0});
 const cleanMode=useCallback((value:boolean)=>{setClean(value);if(value){setAbout(false);engine.current?.select(null);}},[]);
 useEffect(()=>{
  let live=true,instance:Engine|undefined;setReady(false);setError('');latestState.current='';
  (async()=>{try{
   const {Engine}=await import('./engine');await new Promise(requestAnimationFrame);if(!live||!host.current)return;
   instance=new Engine(host.current,snapshot=>{
    if(!live)return;const value=JSON.stringify(snapshot.state);
    if(value!==latestState.current){latestState.current=value;setS(snapshot.state);}
    setBackend(snapshot.backend);setMoving(snapshot.moving);
    if(performance.now()-lastCamera.current>180||!snapshot.moving){setCamera(snapshot.camera);lastCamera.current=performance.now();}
   },value=>live&&setSelected(value),message=>{if(live){setError(message);setReady(false);}});
   engine.current=instance;
   if(innerWidth<700)instance.set({quality:'balanced'});
   if(live)setReady(true);
  }catch(e){instance?.dispose();if(host.current)host.current.replaceChildren();engine.current=null;if(live){setError('模型未能加载，请重新加载。');console.error('Pavilion initialization failed',e);}}})();
  return()=>{live=false;instance?.dispose();engine.current=null;};
 },[retry]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,select,textarea,[role="slider"],[role="dialog"]'))return;if(e.code==='Escape')cleanMode(false);if(e.code==='KeyH'&&!e.repeat){e.preventDefault();setClean(v=>{if(!v){setAbout(false);engine.current?.select(null);}return !v;});}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[cleanMode]);
 useEffect(()=>registerPavilionTools(()=>engine.current,cleanMode),[cleanMode]);
 const update=(patch:Partial<State>)=>engine.current?.set(patch);
 const changeMode=(value:string)=>engine.current?.mode((value||'orbit') as Mode);
 const reset=()=>engine.current?.reset();
 const onMap=(e:React.MouseEvent<SVGSVGElement>)=>{const r=e.currentTarget.getBoundingClientRect();engine.current?.focus(-2+(e.clientX-r.left)/r.width*61,-9+(e.clientY-r.top)/r.height*30);};
 return <main className={'exhibition '+(clean?'clean':'')} data-mode={s.mode}>
  <div ref={host} className="scene-host"/>
  {(!ready||error)&&<div className="loading" role="status"><Box size={32}/><span className="eyebrow">BARCELONA PAVILION</span><h2>{error?'暂时无法进入展览':'空间，正在展开'}</h2><p>{error||'正在准备石材、玻璃与水面'}</p>{error?<button className="solid" onClick={()=>setRetry(v=>v+1)}><RotateCcw size={16}/>重新加载</button>:<div className="load-track"><i/></div>}</div>}
  <div className="ui chrome" inert={clean}>
  <header className="header"><div className="identity"><span className="eyebrow">空间档案 <i/> ARCHITECTURE IN SPACE</span><h1>巴塞罗那德国馆</h1><div className="english">Barcelona Pavilion</div><p>Ludwig Mies van der Rohe & Lilly Reich</p>{backend==='software'&&<span className="render-note">轻量模型 · 当前浏览器不支持 WebGL</span>}</div><div className="header-buttons"><button onClick={()=>setAbout(true)} title="参考来源与重建说明"><Info size={18}/><span>关于建筑</span></button><i/><button aria-label="纯净展示" title="纯净展示 · H" disabled={!ready} onClick={()=>cleanMode(true)}><Maximize size={18}/></button></div></header>
  <div className="caption"><i/><span>建筑与流动空间</span><small>EXTERIOR & CONTINUITY</small></div>
  <div className="camera-tools"><button aria-label="放大" disabled={!ready} onClick={()=>engine.current?.zoom(1.15)}><Plus size={18}/></button><button aria-label="缩小" disabled={!ready} onClick={()=>engine.current?.zoom(1/1.15)}><Minus size={18}/></button><i/><button aria-label="一键复位" title="还原建筑与默认视角" disabled={!ready} onClick={reset}><RotateCcw size={18}/></button></div>
  {!!selected.length&&<div className="selection"><span className="eyebrow">构件</span><strong>{selected[0]}</strong><div><button onClick={()=>update({hidden:[...new Set([...s.hidden,selected[1]])]})}><EyeOff size={14}/>隐藏{groupNames[selected[1]]}</button><button aria-label="取消构件选择" onClick={()=>engine.current?.select(null)}><X size={16}/></button></div></div>}
  {!!s.hidden.length&&<button className="restore" onClick={()=>update({hidden:[]})}><Eye size={16}/>显示全部构件</button>}
  <div className="map-wrap"><Collapsible open={map} onOpenChange={setMap}><CollapsibleContent><div className="map-panel"><div className="map-heading"><span>平面导航</span><small>与模型坐标同步</small></div><svg viewBox="-2 -9 61 30" preserveAspectRatio="none" role="img" aria-label="平面图，点击定位观察中心" onClick={onMap}>
   {platform.map((p,i)=><rect key={'p'+i} x={p.x} y={p.z} width={p.w} height={p.d} fill="#e6dfcf" stroke="#ada38d" strokeWidth=".1"/>)}
   {pools.map(p=><rect key={p.name} x={p.x} y={p.z} width={p.w} height={p.d} fill="#adc0b2"/>)}
   {roofs.map((p,i)=><rect key={'r'+i} x={p.x} y={p.z} width={p.w} height={p.d} fill="none" stroke="#aaa18d" strokeWidth=".1" strokeDasharray=".5 .5"/>)}
   {walls.map((w,i)=><rect key={'w'+i} x={w.x} y={w.z} width={Math.max(w.w,.15)} height={Math.max(w.d,.15)} fill={w.kind==='onyx'?'#b49a6a':['glass','frost'].includes(w.kind)?'#8ba39b':'#46564a'}/>)}
   {columns.map((c,i)=><path key={'c'+i} d={'M'+(c.x-.2)+' '+c.z+'h.4 M'+c.x+' '+(c.z-.2)+'v.4'} stroke="#46564a" strokeWidth=".12"/>)}
   {Array.from({length:detail.steps},(_,i)=><path key={'s'+i} d={'M'+(stair.x+i*stair.w/detail.steps)+' '+stair.z+'v'+stair.d} stroke="#858078" strokeWidth=".08"/>)}
   <g transform={'translate('+Math.max(-.5,Math.min(57,camera.x))+' '+Math.max(-8,Math.min(20,camera.z))+') rotate('+(camera.angle*180/Math.PI)+')'}><path d="M0 0L-1.8 -3.5Q0 -4.4 1.8 -3.5Z" fill="#46564a" opacity=".17"/><path d="M0 -1.2L.8 .8L0 .4L-.8 .8Z" fill="#46564a"/></g>
  </svg><div className="map-foot"><span>▲ 观察方向</span><span>点击定位观察中心</span></div></div></CollapsibleContent><CollapsibleTrigger className="map-toggle"><MapIcon size={16}/>{map?'收起平面':'平面导航'}{map?<ChevronDown size={14}/>:<ChevronUp size={14}/>}</CollapsibleTrigger></Collapsible></div>
  <div className="bottom">
   <div className="mode-controls">
    {s.mode==='roof'&&<span className="mode-note">{moving?'屋面平滑展开中':'屋面已抬升 · 再次点击合上'}</span>}
    {s.mode==='explode'&&<div className="adjust"><div className="adjust-head"><span id="expand-label">展开程度</span><small>{s.expand}%</small><button onClick={()=>changeMode('orbit')}><RotateCcw size={14}/>还原</button></div><Slider aria-label="展开程度" value={[s.expand]} onValueChange={([v])=>update({expand:v})}/><p>基座 → 墙体 → 玻璃 → 十字柱 → 屋面</p><div className="legend"><span>屋面</span><span>柱</span><span>玻璃</span><span>墙</span><span>基座</span></div></div>}
    {s.mode==='section'&&<div className="adjust"><div className="adjust-head"><span>剖切位置</span><small>{s.cut}%</small><ToggleGroup type="single" value={s.axis} aria-label="剖切方向" onValueChange={v=>v&&update({axis:v as 'x'|'z'})}><ToggleGroupItem value="z">纵向</ToggleGroupItem><ToggleGroupItem value="x">横向</ToggleGroupItem></ToggleGroup></div><Slider aria-label="剖切位置" value={[s.cut]} onValueChange={([v])=>update({cut:v})}/><p>{moving?'正在还原构件，随后启用剖切':'香槟金表示建筑实体截面'}</p></div>}
    <ToggleGroup type="single" value={s.view} onValueChange={v=>v&&engine.current?.view(v as View)} className="views" aria-label="快捷视角" disabled={!ready}>{[['overall','整体'],['entry','入口'],['pool','水池'],['court','庭院'],['top','顶视']].map(([id,label])=><ToggleGroupItem value={id} key={id}>{label}</ToggleGroupItem>)}</ToggleGroup>
   </div>
   <ToggleGroup type="single" value={s.mode} onValueChange={changeMode} className="toolbar" aria-label="建筑观察模式" disabled={!ready}>{modes.map(({id,text,Icon})=><ToggleGroupItem key={id} value={id}><Icon size={18}/><span>{text}</span></ToggleGroupItem>)}</ToggleGroup>
   <div className="hint">拖动旋转 · 滚轮缩放 · 右键 / 双指平移 · H 隐藏界面</div>
  </div>
  <footer className="footer"><span>BARCELONA, SPAIN <i>/</i> 比例复原 · 非测绘模型</span>{backend==='software'?<span>轻量着色显示</span>:<Select value={s.quality} onValueChange={v=>update({quality:v as 'high'|'balanced'})} disabled={!ready||backend==='software'}><SelectTrigger aria-label="画质设置"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="high">精细画质</SelectItem><SelectItem value="balanced">流畅画质</SelectItem></SelectContent></Select>}</footer>
  </div>
  {clean&&<button className="clean-exit" onClick={()=>cleanMode(false)} aria-label="退出纯净展示"><Minimize size={16}/>退出纯净展示 <small>Esc / H</small></button>}
  <Sheet open={about} onOpenChange={setAbout}><SheetContent className="about"><SheetHeader><span className="eyebrow">ABOUT THE PAVILION</span><SheetTitle>关于建筑</SheetTitle><SheetDescription>巴塞罗那德国馆 · Barcelona Pavilion</SheetDescription></SheetHeader><div className="about-body"><dl>{[['设计','Ludwig Mies van der Rohe / Lilly Reich'],['年代','1929 原建 / 1986 重建'],['地点','Montjuïc, Barcelona'],['重建','Ignasi de Solà-Morales / Cristian Cirici / Fernando Ramos']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><h3>连续的空间</h3><p>薄屋面、十字形金属柱与自由布置的墙面组织出连续的空间。两个水池与洞石平台连接内外，金色缟玛瑙墙成为主空间的视觉中心。</p><h3>材料</h3><div className="materials">{[['#cabea4','罗马洞石'],['#46594b','绿色大理石'],['#b78b47','金色缟玛瑙'],['#bfcac3','玻璃与镀铬金属']].map(([c,t])=><span key={t}><i style={{background:c}}/>{t}</span>)}</div><h3>参考资料</h3><ol>{[['https://miesbcn.com/ca/el-pavello/','基金会 · 建筑、材料与常设实景'],['https://miesbcn.com/wp-content/uploads/2026/02/Mies_plano_A3PNG-1-scaled.png','基金会现状平面图（2026 年公开版本）'],['https://miesbcn.com/wp-content/uploads/2014/04/planol-entorn.pdf','基金会屋顶与场地平面图']].map(([u,t])=><li key={u}><a href={u} target="_blank" rel="noreferrer">{t}<ArrowUpRight size={15}/></a></li>)}</ol><h3>示意重建说明</h3><p>依据基金会现状平面、屋顶图及常设实景自行建立三维模型，不混用历史初稿或临时艺术装置。平面上方对应原图上方，并非正北。后侧平台按图面保守补齐，场外景观未作测绘重建。</p><p>公开图纸不足以核定全部尺寸。模型尺度、墙厚、屋面构造、池深及附属空间细节按图面比例保守近似，不可用于测绘或施工。</p><p>石材为依据材料外观制作的程序纹理，并非现场扫描。家具布置为参考复原，金属支架和软包细节保守简化。Georg Kolbe 的《Dawn》保留举臂姿态与池中位置，人体为简化轮廓，不是原作数字扫描。</p><p>不包含地下设备区。分解展示空间构成，不代表施工顺序；香槟金剖切面表示基座、墙体、柱和屋面的实体截面；家具与雕塑只作裁剪，不作实体封口。</p><h3>渲染说明</h3><p>支持 WebGL 2 时显示石材纹理、金属与玻璃环境反射、实时水面倒影及自然光阴影。显卡不可用时，同一三维几何与交互自动切换为轻量着色显示；轻量模式不代表写实材质效果。</p></div></SheetContent></Sheet>
 </main>;
}
