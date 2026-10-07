import type {Point} from './model';
import type {Section} from './track';
// Reduce display geometry while retaining confidence/source transitions and every gap.
// Full original and reconstructed samples remain in the processing worker for export.
export function displaySections(sections:Section[],limit=10000):Section[] {
 const result:Section[]=[];const stride=Math.max(1,Math.ceil(sections.length/limit));let count=0;
 for(const s of sections){const previous=result.at(-1);if(previous&&s.confidence!=='gap'&&previous.confidence===s.confidence&&previous.b.time===s.a.time&&previous.a.source===s.a.source&&count<stride){previous.b=s.b;count++;}else{result.push({...s});count=1;}}
 return result;
}
export function displayPoints(points:Point[],limit=12000):Point[] {const stride=Math.max(1,Math.ceil(points.length/limit));return points.filter((_,i)=>i%stride===0||i===points.length-1);}
