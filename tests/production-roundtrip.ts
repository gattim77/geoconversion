import {readFileSync,writeFileSync} from 'node:fs';import {parseXml} from '../src/parsers';
const text=readFileSync('../../outputs/2027-03-18-geoconversion.gpx','utf8');const r=parseXml(text,'production');
const result={points:r.points.length,segments:new Set(r.points.map(p=>p.segment)).size,source:r.format,utcTimestamps:(text.match(/<time>[^<]+Z<\/time>/g)||[]).length,monotonic:r.points.every((p,i)=>!i||p.time>r.points[i-1].time)};
if(result.points!==92||result.segments!==2||!result.monotonic||result.utcTimestamps!==92)throw new Error('Production round-trip did not match expected synthetic track.');writeFileSync('../../outputs/production-gpx-validation.json',JSON.stringify(result,null,2));console.log(result);
