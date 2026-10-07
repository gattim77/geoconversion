import {limits,type Point,type Confidence} from './model';
export const policy={goodSeconds:180,maxSeconds:900,maxSpeed:55,maxAccuracy:100,recordedSeconds:15,continuitySpeedRatio:8,overlapSeconds:120};
export function distance(a:Point,b:Point):number {const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
export function classify(a:Point,b:Point,previous?:Point):Confidence {
 const dt=(b.time-a.time)/1000,speed=dt>0?distance(a,b)/dt:Infinity;
 if(dt<=0||dt>policy.maxSeconds||speed>policy.maxSpeed||a.fileId===b.fileId&&a.segment!==b.segment)return 'gap';
 const poor=Math.max(a.accuracy||0,b.accuracy||0)>policy.maxAccuracy||a.quality<35||b.quality<35;
 const prevSpeed=previous&&(a.time>previous.time)?distance(previous,a)/((a.time-previous.time)/1000):undefined;
 const discontinuous=prevSpeed!=null&&speed>10&&speed>Math.max(1,prevSpeed)*policy.continuitySpeedRatio;
 if(!poor&&!discontinuous&&dt<=policy.recordedSeconds&&a.source!=='Google Timeline'&&b.source!=='Google Timeline')return 'recorded';
 return !poor&&!discontinuous&&dt<=policy.goodSeconds?'good':'uncertain';
}
export function merge(points:Point[]):Point[] {
 // Coverage is formed only by plausible consecutive samples. Sparse workouts cannot suppress a better track across an outage.
 const groups=new Map<string,Point[]>();for(const p of points){const k=p.fileId+'|'+p.segment;const a=groups.get(k)||[];a.push(p);groups.set(k,a);}
 const coverage:{a:number;b:number;rank:number;key:string}[]=[];
 for(const [key,ps] of groups){ps.sort((a,b)=>a.time-b.time);for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],seconds=(b.time-a.time)/1000;if(seconds<=policy.overlapSeconds&&classify(a,b)!=='gap')coverage.push({a:a.time,b:b.time,rank:Math.min(a.quality,b.quality)+(seconds<=15?10:0),key});}}
 coverage.sort((a,b)=>a.a-b.a);const sorted=[...points].sort((a,b)=>a.time-b.time||b.quality-a.quality),out:Point[]=[];let cursor=0,active:typeof coverage=[];
 for(const p of sorted){while(cursor<coverage.length&&coverage[cursor].a<=p.time)active.push(coverage[cursor++]);active=active.filter(c=>c.b>=p.time);if(active.some(c=>c.key!==p.fileId+'|'+p.segment&&c.rank>p.quality+10))continue;
 const last=out.at(-1);if(last?.time===p.time){if(p.quality>last.quality)out[out.length-1]=p;continue;}out.push(p);}
 return out;
}
export interface Section {a:Point;b:Point;confidence:Confidence;}
export function reconstruct(original:Point[],seconds=10):{points:Point[];sections:Section[];gaps:number;metres:number} {
 if(![0,5,10,30].includes(seconds))throw new Error('Choose original, 5, 10 or 30 seconds.');
 const out:Point[]=[],sections:Section[]=[];let gaps=0,metres=0;
 for(let i=0;i<original.length;i++){const a=original[i],b=original[i+1];out.push(a);if(!b)continue;const confidence=classify(a,b,original[i-1]);sections.push({a,b,confidence});if(confidence==='gap'){gaps++;continue;}metres+=distance(a,b);
 if(seconds)for(let t=a.time+seconds*1000;t<b.time;t+=seconds*1000){if(out.length>=limits.outputPoints)throw new Error('Selected interval exceeds 500,000 output points. Shorten the range or choose a lower sampling density.');const f=(t-a.time)/(b.time-a.time),dlon=((b.lon-a.lon+540)%360)-180;out.push({...a,time:t,lat:a.lat+(b.lat-a.lat)*f,lon:((a.lon+dlon*f+540)%360)-180,alt:a.alt!=null&&b.alt!=null?a.alt+(b.alt-a.alt)*f:undefined,generated:true,confidence:confidence==='recorded'?'good':confidence,quality:confidence==='uncertain'?20:50});}}
 if(out.length>limits.outputPoints)throw new Error('Output exceeds the 500,000 point limit.');return {points:out,sections,gaps,metres};
}
