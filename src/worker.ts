import {displaySections,displayPoints} from './display';
import {parseFile} from './parsers';
import {merge,reconstruct} from './track';
import {exportGpx} from './export';
import type {Point} from './model';
let files=new Map<string,Point[]>();
self.onmessage=async({data})=>{try{if(data.type==='clear'){files.clear();self.postMessage({type:'cleared',id:data.id});return;}if(data.type==='remove'){files.delete(data.fileId);self.postMessage({type:'removed',id:data.id});return;}if(data.type==='import'){self.postMessage({type:'progress',id:data.id,message:'Reading and validating locally…'});const r=await parseFile(data.file,data.fileId);if([...files.values()].reduce((n,p)=>n+p.length,0)+r.points.length>1000000)throw new Error('Combined imports exceed 1,000,000 points. Remove a source or use smaller files.');files.set(data.fileId,r.points);self.postMessage({type:'imported',id:data.id,format:r.format,count:r.points.length,start:r.points[0].time,end:r.points.at(-1)!.time,warnings:r.warnings});return;}
 if(data.type==='reconstruct'||data.type==='export'){const original=merge([...files.values()].flat().filter(p=>p.time>=data.start&&p.time<=data.end));const r=reconstruct(original,data.seconds);if(data.type==='export'){self.postMessage({type:'exported',id:data.id,gpx:exportGpx(r.points,data.originalOnly)});return;}const display=displayPoints(r.points);self.postMessage({type:'track',id:data.id,...r,points:display,sections:displaySections(r.sections),originalCount:original.length,generatedCount:r.points.length-original.length,totalCount:r.points.length,start:original[0]?.time,end:original.at(-1)?.time});}}
 catch(e){self.postMessage({type:'error',id:data.id,message:e instanceof Error?e.message:'File processing failed: unsupported input.'});}};
