import * as T from 'three';
import {lighting,surfaceConfig,qualityConfig,type State} from './config';

export function backgroundTexture(){
 const width=2,height=256,data=new Uint8Array(width*height*4),top=new T.Color('#ffffff'),bottom=new T.Color(lighting.skyTop),color=new T.Color();
 for(let y=0;y<height;y++){
  const t=y/(height-1);color.copy(bottom).lerp(top,t).convertLinearToSRGB();
  for(let x=0;x<width;x++)data.set([color.r*255,color.g*255,color.b*255,255],(y*width+x)*4);
 }
 const texture=new T.DataTexture(data,width,height,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}

/** Discrete distance budgets, with hysteresis; never resize reflection targets per frame. */
export function renderBudget(quality:State['quality'],distance:number,narrow:boolean,previous=''){
 const q=qualityConfig[quality];const far=previous.endsWith('far')?distance>90:distance>110;
 const near=previous.endsWith('near')?distance<50:distance<40;
 const band=far?'far':near?'near':'middle',mobile=narrow||quality==='balanced';
 return {key:(mobile?'mobile-':'')+quality+'-'+band,shadow:mobile||far?1024:q.shadow,reflection:mobile?256:far?320:near?640:512,dpr:Math.min(q.dpr,narrow?1.25:1.5),detail:T.MathUtils.clamp(1-(distance-surfaceConfig.nearDistance)/(surfaceConfig.farDistance-surfaceConfig.nearDistance)*.65,.35,1)};
}