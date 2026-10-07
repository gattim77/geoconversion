export const formats=['Google Timeline','Apple Health','GPX','FIT','TCX','KML/KMZ','CSV','unknown'] as const;
export const events=['processed','conversion_success','conversion_failed','gpx_export','application_error'] as const;
export function sizeBucket(bytes:number):string {return bytes<1048576?'under_1mb':bytes<10485760?'1_to_10mb':bytes<52428800?'10_to_50mb':'50_to_128mb';}
export function telemetry(event:typeof events[number],format:string='unknown',milliseconds=0,bytes=0):void {
 const payload={event,format:formats.includes(format as any)?format:'unknown',durationMs:Math.min(600000,Math.max(0,Math.round(milliseconds))),sizeBucket:sizeBucket(bytes)};
 void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',keepalive:true}).catch(()=>{});
}
