import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {Decoder,Stream} from '@garmin/fitsdk';
import {point,limits,timestamp,type Point,type Imported,type Format} from './model';
const array=(v:any):any[]=>v==null?[]:Array.isArray(v)?v:[v];
const xmlParser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',removeNSPrefix:true,processEntities:false,parseTagValue:false});
function xml(text:string):any {if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('XML declarations containing DTDs or entities are not supported.');const v=XMLValidator.validate(text);if(v!==true)throw new Error('Malformed XML: '+v.err.msg);return xmlParser.parse(text);}
function coord(value:any):[number,number]|null {if(value?.latLng)value=value.latLng;if(value?.latitudeE7!=null)return [value.latitudeE7/1e7,value.longitudeE7/1e7];if(value?.latitude!=null)return [value.latitude,value.longitude];if(typeof value!=='string')return null;const m=value.replace(/^geo:/,'').replace(/°/g,'').match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/);return m?[Number(m[1]),Number(m[2])]:null;}
export function parseTimeline(text:string,id:string):Imported {
 let json:any;try{json=JSON.parse(text);}catch{throw new Error('Malformed JSON. Export Timeline data again from your phone.');}const ps:Point[]=[],warnings:string[]=[];let skipped=0;
 const add=(v:any,t:any,segment:string,quality=40)=>{const c=coord(v);const p=c&&point({time:t,lat:c[0],lon:c[1],accuracy:v?.accuracy??v?.accuracyMeters},'Google Timeline',id,segment,quality);if(p)ps.push(p);else skipped++;};
 const segments=Array.isArray(json)?json:json.semanticSegments||json.timelineObjects;
 if(Array.isArray(segments))segments.forEach((s:any,i:number)=>{
  const key=String(i);const activity=s.activitySegment;const visit=s.placeVisit;
  const start=s.startTime||activity?.duration?.startTimestamp||visit?.duration?.startTimestamp;
  const end=s.endTime||activity?.duration?.endTimestamp||visit?.duration?.endTimestamp;
  for(const p of s.timelinePath||s.simplifiedRawPath?.points||activity?.simplifiedRawPath?.points||[]){const time=p.time||p.timestamp||p.timestampMs||(p.durationMinutesOffsetFromStartTime!=null?timestamp(start)+Number(p.durationMinutesOffsetFromStartTime)*60000:null);add(p.point||p.location||p,time,key);}
  if(s.activity){add(s.activity.start,start,key,30);add(s.activity.end,end,key,30);}
  if(activity){add(activity.startLocation,start,key,30);add(activity.endLocation,end,key,30);}
  const location=s.visit?.topCandidate?.placeLocation?.latLng||s.visit?.topCandidate?.placeLocation||visit?.location;
  if(location){add(location,start,key,25);add(location,end,key,25);}
 });
 else if(Array.isArray(json.locations))json.locations.forEach((p:any)=>add(p,p.timestamp||p.timestampMs,'0'));
 else if(Array.isArray(json.rawSignals)){for(const s of json.rawSignals){const l=s.position||s.location;if(l)add(l.point||l.location||l,l.timestamp||s.timestamp,'raw');}}
 else throw new Error('Unsupported Google Timeline schema. Expected semanticSegments, a Timeline segment array, locations or rawSignals.');
 if(skipped)warnings.push(`${skipped} entries without valid timestamped coordinates were skipped.`);return finish('Google Timeline',ps,warnings);
}
export function parseXml(text:string,id:string,apple=false):Imported {
 const doc=xml(text),ps:Point[]=[],warnings:string[]=[];let format:Format='GPX',segment=0,skipped=0;
 const add=(raw:any)=>{const p=point(raw,format,id,String(segment),apple?95:85);if(p)ps.push(p);else skipped++;};
 if(doc.gpx){format=apple?'Apple Health':'GPX';for(const trk of array(doc.gpx.trk))for(const seg of array(trk.trkseg)){segment++;for(const p of array(seg.trkpt))add({time:p.time,lat:p['@lat'],lon:p['@lon'],alt:p.ele,accuracy:p.extensions?.accuracy});}for(const route of array(doc.gpx.rte)){segment++;for(const p of array(route.rtept))add({time:p.time,lat:p['@lat'],lon:p['@lon'],alt:p.ele});}}
 else if(doc.TrainingCenterDatabase){format='TCX';for(const a of array(doc.TrainingCenterDatabase.Activities?.Activity))for(const l of array(a.Lap))for(const track of array(l.Track)){segment++;for(const p of array(track.Trackpoint))add({time:p.Time,lat:p.Position?.LatitudeDegrees,lon:p.Position?.LongitudeDegrees,alt:p.AltitudeMeters});}}
 else if(doc.kml){format='KML/KMZ';const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,val] of Object.entries(v)){if(k==='Track'){for(const trk of array(val)){segment++;const times=array(trk.when),coords=array(trk.coord);coords.forEach((c:string,i:number)=>{const [lon,lat,alt]=String(c).trim().split(/\s+/);add({time:times[i],lat,lon,alt});});}}else if(k==='Placemark'){for(const p of array(val)){if(p.Point?.coordinates&&p.TimeStamp?.when){segment++;const [lon,lat,alt]=String(p.Point.coordinates).trim().split(',');add({time:p.TimeStamp.when,lat,lon,alt});}walk(p);}}else if(k!=='@')for(const x of array(val))walk(x);}};walk(doc.kml);}
 else if(Object.hasOwn(doc,'HealthData'))throw new Error('Apple Health export detected, but this XML contains no GPS routes. Select export.zip or the GPX files in workout-routes. Unrelated health records are not processed.');
 else throw new Error('Unsupported XML. Expected GPX, TCX, KML or an Apple Health route archive.');
 if(skipped)warnings.push(`${skipped} points without valid coordinates or timezone-qualified timestamps were skipped.`);return finish(format,ps,warnings);
}
export function parseCsv(text:string,id:string):Imported {
 const delimiter=text.split(/\r?\n/)[0].includes(';')?';':',';const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Malformed CSV: an unterminated quoted field was found.');if(cell||row.length){row.push(cell);rows.push(row);}const headers=(rows.shift()||[]).map(h=>h.trim().toLowerCase().replace(/[ _-]/g,''));
 const find=(names:string[])=>headers.findIndex(h=>names.includes(h));const t=find(['timestamp','time','datetime','date','utctime']),lat=find(['latitude','lat']),lon=find(['longitude','lon','lng']),alt=find(['altitude','elevation','ele']),acc=find(['accuracy','horizontalaccuracy']);
 if([t,lat,lon].some(i=>i<0))throw new Error('CSV must contain timestamp, latitude and longitude columns. Timestamps must include Z or a UTC offset.');
 const ps:Point[]=[],warnings:string[]=[];let skipped=0;for(const r of rows){if(r.every(x=>!x.trim()))continue;const p=point({time:r[t],lat:r[lat],lon:r[lon],alt:r[alt],accuracy:r[acc]},'CSV',id);if(p)ps.push(p);else skipped++;}if(skipped)warnings.push(`${skipped} invalid CSV rows were skipped.`);return finish('CSV',ps,warnings);
}
export function parseFit(bytes:Uint8Array,id:string):Imported {
 const stream=Stream.fromByteArray(bytes),decoder=new Decoder(stream);if(!decoder.isFIT()||!decoder.checkIntegrity())throw new Error('Corrupted FIT file: header or checksum validation failed.');const {messages,errors}=decoder.read();if(errors?.length)throw new Error('FIT decoding failed. The file may be truncated or unsupported.');const ps:Point[]=[];for(const r of messages.recordMesgs||[]){const p=point({time:r.timestamp instanceof Date?r.timestamp.toISOString():r.timestamp,lat:r.positionLat==null?null:r.positionLat*180/2147483648,lon:r.positionLong==null?null:r.positionLong*180/2147483648,alt:r.enhancedAltitude??r.altitude,speed:r.enhancedSpeed??r.speed},'FIT',id);if(p)ps.push(p);}return finish('FIT',ps,[]);
}
function finish(format:Format,points:Point[],warnings:string[]):Imported {if(!points.length)throw new Error(`${format} detected, but no valid timestamped GPS coordinates were found. Route timestamps must include a timezone.`);if(points.length>limits.points)throw new Error('More than 1,000,000 GPS samples. Split the export into smaller files.');points.sort((a,b)=>a.time-b.time);return {format,points,warnings};}
export async function parseFile(file:File,id:string):Promise<Imported> {
 if(file.size>limits.fileBytes)throw new Error('File exceeds 128 MB. Split the export or select individual workout GPX routes.');if(!file.size)throw new Error('This file is empty.');const bytes=new Uint8Array(await file.arrayBuffer());return parseBytes(bytes,file.name,id);
}
export function parseBytes(bytes:Uint8Array,name:string,id:string):Imported {
 if(bytes.length>limits.fileBytes)throw new Error('File exceeds 128 MB.');
 if(bytes[0]===80&&bytes[1]===75)return parseArchive(bytes,id);
 if(new TextDecoder().decode(bytes.slice(8,12))==='.FIT')return parseFit(bytes,id);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').trim();
 if(text.startsWith('{')||text.startsWith('['))return parseTimeline(text,id);if(text.startsWith('<'))return parseXml(text,id,/workout[-_]routes/i.test(name));if(/\.fit$/i.test(name))throw new Error('Invalid FIT signature. The file is corrupted.');return parseCsv(text,id);
}
function parseArchive(bytes:Uint8Array,id:string):Imported {
 // Inspect central-directory declared sizes before decompression. Never extract entries to a filesystem.
 let expanded=0,entries=0;for(let i=0;i+46<bytes.length;i++){if(bytes[i]===80&&bytes[i+1]===75&&bytes[i+2]===1&&bytes[i+3]===2){const v=new DataView(bytes.buffer,bytes.byteOffset+i),flags=v.getUint16(8,true),size=v.getUint32(24,true);if(flags&1)throw new Error('Encrypted ZIP archives are not supported. Export an unencrypted route archive.');expanded+=size;entries++;if(size===0xffffffff||expanded>limits.expandedBytes||entries>limits.archiveEntries)throw new Error('Archive exceeds safe extraction limits (256 MB / 5,000 entries). Choose individual route files.');}}
 const ps:Point[]=[],warnings:string[]=[];let apple=false;let files:Record<string,Uint8Array>;
 try{files=unzipSync(bytes,{filter:e=>/\.(gpx|kml)$/i.test(e.name)&&e.originalSize<=limits.fileBytes});}catch{throw new Error('Archive could not be decoded. It may be corrupted, encrypted or use unsupported compression.');}
 for(const [name,data] of Object.entries(files)){const isApple=/workout[-_]routes/i.test(name);apple||=isApple;const result=parseXml(new TextDecoder().decode(data),id+'/'+name,isApple);ps.push(...result.points);warnings.push(...result.warnings);if(ps.length>limits.points)throw new Error('Archive exceeds 1,000,000 GPS samples.');}
 if(!ps.length)throw new Error('Archive detected, but no workout GPX routes or timed KML tracks were found. Apple Health exports need workout-routes/*.gpx. Unrelated health data was not extracted.');return finish(apple?'Apple Health':'KML/KMZ',ps,warnings);
}
