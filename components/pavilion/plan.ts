// Proportions digitized from Fundació Mies van der Rohe's 2026 public plan.
// Approximate local metres; axes follow drawing orientation, not geographical north.
export type Rect={x:number,z:number,w:number,d:number};
export const LEVEL=.72,H=3.1;
export const detail={roofThickness:.23,roofEdge:.04,glassFrame:.028,columnWidth:.19,columnWeb:.045,tile:1.1,steps:7,
 poolBottom:0,poolSlab:.18,waterLevel:.56,poolRim:.07};
export const walls=[
 ['平台西墙','travertine',0,-5.7,.22,23.52],['水池端墙','travertine',.22,17.6,7.8,.22],['长凳背墙','travertine',7.4,2.05,21.1,.22],
 ['附属空间北墙','travertine',.22,-5.7,9.05,.22],['附属空间东墙','travertine',9.05,-5.48,.22,5.48],['附属隔墙','travertine',4.5,-5.48,.12,2.05],['附属隔墙','travertine',4.5,-2.55,.12,2.55],['附属服务墙','travertine',4.62,-4.17,4.43,.12],
 ['入口绿大理石墙','green',26.9,10.45,9.7,.23],['金色缟玛瑙墙','onyx',39.5,6,6.08,.22],['水院北墙','green',40.8,.92,14.92,.22],['水院东墙','green',55.5,1.14,.22,12.10],['水院南墙','green',44.8,13.24,10.92,.22],
 ['主空间北玻璃','glass',32.3,3.63,11.1,.035],['主空间南玻璃','glass',32.3,13.25,12.5,.035],['水院玻璃','glass',48.5,3.15,.035,7.95],['乳白玻璃西面','frost',33.4,3.665,.045,6.785],['乳白玻璃东面','frost',34.22,3.665,.045,6.785],['附属前玻璃','glass',.22,-.04,6.55,.035],['附属前玻璃','glass',8.02,-.04,1.03,.035],
].map(([name,kind,x,z,w,d])=>({name:name as string,kind:kind as string,x:x as number,z:z as number,w:w as number,d:d as number}));
export const roofs=[{x:25.6,z:0,w:25.45,d:14.38},{x:-.55,z:-6.25,w:10.4,d:10.42}];
export const columns=[27.875,34.875,41.875,48.875].flatMap(x=>[3.31,11.06].map(z=>({x,z})));
export const pools=[{name:'大水池',x:.22,z:7.75,w:22.08,d:9.85},{name:'小水院',x:51.05,z:1.14,w:4.45,d:12.1}];
export const platform=[{x:0,z:0,w:56.6,d:14.4},{x:-1,z:14.4,w:43.25,d:4.35},{x:0,z:-5.7,w:9.27,d:5.7},
 // Rear access terrace visible in the official current plan; landscape stairs omitted.
 {x:26.9,z:-7.9,w:8.6,d:7.9}];
export const stair={x:38.9,z:14.4,w:3.35,d:3.3};
export const furniture=[{x:7.8,z:2.49,w:16.9,d:.68},{x:40.08,z:8.1,w:.84,d:.84},{x:42.18,z:8.1,w:.84,d:.84},{x:40,z:9.35,w:.75,d:.75},{x:42.1,z:9.35,w:.75,d:.75}];
export const sculpture={x:53.4,z:2.95,pedestal:.58};
export const bounds={x:[-1.05,56.65],z:[-7.95,18.8]};
export function inside(x:number,z:number,r:Rect,p=0){return x>r.x-p&&x<r.x+r.w+p&&z>r.z-p&&z<r.z+r.d+p;}
