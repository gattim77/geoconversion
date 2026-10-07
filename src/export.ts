import {XMLValidator} from 'fast-xml-parser';
import {type Point} from './model';
import {classify} from './track';
export function exportGpx(points:Point[],originalOnly=false):string {
 const ps=originalOnly?points.filter(p=>!p.generated):points;if(!ps.length)throw new Error('No GPS points in this interval.');let previous:Point|undefined;
 let text='<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoConversion" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>GeoConversion track</name><trkseg>';
 for(const p of ps){if(!Number.isFinite(p.time)||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180||previous&&p.time<=previous.time)throw new Error('GPX validation failed: invalid or unordered GPS samples.');if(previous&&classify(previous,p)==='gap')text+='</trkseg><trkseg>';text+=`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.alt!=null?`<ele>${p.alt.toFixed(2)}</ele>`:''}<time>${new Date(p.time).toISOString()}</time></trkpt>`;previous=p;}
 text+='</trkseg></trk></gpx>';if(XMLValidator.validate(text)!==true)throw new Error('Generated GPX failed XML validation.');return text;
}
