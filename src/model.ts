export type Format='Google Timeline'|'Apple Health'|'GPX'|'FIT'|'TCX'|'KML/KMZ'|'CSV';
export type Confidence='recorded'|'good'|'uncertain'|'gap';
export interface Point {time:number;lat:number;lon:number;alt?:number;accuracy?:number;speed?:number;source:Format;fileId:string;segment:string;quality:number;generated:boolean;confidence:Confidence;}
export interface Imported {format:Format;points:Point[];warnings:string[];}
export const limits={fileBytes:128*1024*1024,expandedBytes:256*1024*1024,points:1000000,outputPoints:500000,files:20,archiveEntries:5000};
export function timestamp(value:unknown):number {
 if(typeof value==='number'||typeof value==='string'&&/^\d{10,16}$/.test(value)){const n=Number(value);return n<1e11?n*1000:n;}
 if(typeof value!=='string'||!/(Z|[+-]\d{2}:?\d{2})$/.test(value.trim()))return NaN;
 return Date.parse(value);
}
export function point(raw:{time:unknown;lat:unknown;lon:unknown;alt?:unknown;accuracy?:unknown;speed?:unknown},source:Format,fileId:string,segment='0',quality=source==='Google Timeline'?40:85):Point|null {
 const time=timestamp(raw.time),lat=raw.lat==null||raw.lat===''?NaN:Number(raw.lat),lon=raw.lon==null||raw.lon===''?NaN:Number(raw.lon);
 if(!Number.isFinite(time)||time<0||time>8640000000000000||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const p:Point={time,lat,lon,source,fileId,segment,quality,generated:false,confidence:quality<35?'uncertain':'recorded'};
 for(const key of ['alt','accuracy','speed'] as const){if(raw[key]!=null&&Number.isFinite(Number(raw[key])))p[key]=Number(raw[key]);}
 if(p.accuracy!=null&&p.accuracy<0)delete p.accuracy;
 return p;
}
