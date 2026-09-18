import type {Engine} from './engine';
import type {Mode,View,State} from './config';
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown|Promise<unknown>};
type Context={registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>};
export function registerPavilionTools(getEngine:()=>Engine|null,clean:(v:boolean)=>void){
 const context=(document as Document&{modelContext?:Context}).modelContext;
 if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 const engine=()=>{const e=getEngine();if(!e||e.disposed)throw new Error('模型尚未准备好');return e;};
 const object=(input:unknown,keys:string[])=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('输入必须是对象');const r=input as Record<string,unknown>;if(Object.keys(r).some(k=>!keys.includes(k)))throw new Error('未知参数');return r;};
 const register=(name:string,title:string,description:string,properties:object,required:string[],execute:Tool['execute'])=>{
  Promise.resolve(context.registerTool({name,title,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute},{signal:lifecycle.signal})).catch(()=>{});
 };
 register('navigate_pavilion_view','切换建筑视角','切换整体、入口、水池、庭院或顶视图。',{view:{type:'string',enum:['overall','entry','pool','court','top']}},['view'],async input=>{const r=object(input,['view']),e=engine();if(typeof r.view!=='string')throw new Error('必须指定视角');e.view(r.view as View);return e.settled();});
 register('set_pavilion_mode','设置建筑观察模式','设置互斥的外观、开顶、分解、剖切模式；clean 隐藏界面，其他模式恢复界面。',{mode:{type:'string',enum:['orbit','roof','explode','section','clean']}},['mode'],async input=>{const r=object(input,['mode']),e=engine();if(typeof r.mode!=='string')throw new Error('必须指定模式');if(r.mode==='clean'){clean(true);return{clean:true};}e.mode(r.mode as Mode);clean(false);return e.settled();});
 register('adjust_pavilion_analysis','调整建筑模型','调整展开程度、竖向剖切位置或方向。reset=true 精确还原模型和视角。',{expand:{type:'number',minimum:0,maximum:100},cut:{type:'number',minimum:0,maximum:100},axis:{type:'string',enum:['x','z']},reset:{type:'boolean'}},[],async input=>{const r=object(input,['expand','cut','axis','reset']),e=engine();if(r.reset!==undefined&&typeof r.reset!=='boolean')throw new Error('reset 必须为布尔值');if(r.reset){e.reset();clean(false);}else {const {reset,...patch}=r;void reset;if(!Object.keys(patch).length)throw new Error('至少提供一个调整参数');e.set(patch as Partial<State>);}return e.settled();});
 return()=>lifecycle.abort();
}
