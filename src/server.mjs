const formats=['Google Timeline','Apple Health','GPX','FIT','TCX','KML/KMZ','CSV','unknown'];
const events=['processed','conversion_success','conversion_failed','gpx_export','application_error'];
const buckets=['under_1mb','1_to_10mb','10_to_50mb','50_to_128mb'];
export function sanitizeEvent(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='durationMs,event,format,sizeBucket')return null;
 if(!events.includes(body.event)||!formats.includes(body.format)||!buckets.includes(body.sizeBucket)||!Number.isInteger(body.durationMs)||body.durationMs<0||body.durationMs>600000)return null;
 return {event:body.event,format:body.format,durationMs:body.durationMs,sizeBucket:body.sizeBucket};
}
function secure(response){const r=new Response(response.body,response);r.headers.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; worker-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'");r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','strict-origin-when-cross-origin');r.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');return r;}
const json=(value,status=200)=>secure(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
async function send(env,event,country){if(!env.ADMIN)return false;try{const response=await env.ADMIN.fetch('https://geoconversion.telemetry.internal/aggregate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...event,country:/^[A-Z]{2}$/.test(country)?country:'Unknown'})});return response.ok;}catch{return false;}}
export async function handle(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname==='/api/version')return json({commit:env.COMMIT_SHA||'development',version:env.VERSION?.id||null});
 if(url.pathname==='/api/events'){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Invalid event origin'},403);
  if(Number(request.headers.get('Content-Length'))>512)return json({error:'Event too large'},413);
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing event'},400);let chunks=[],size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();return json({error:'Event too large'},413);}chunks.push(value);}let body;try{body=JSON.parse(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(c=>[...c]))));}catch{return json({error:'Invalid aggregate event'},400);}
  const event=sanitizeEvent(body);if(!event)return json({error:'Only predefined aggregate operational events are accepted'},400);
  const delivered=await send(env,event,request.cf?.country||'Unknown');return json({accepted:delivered},delivered?200:503);
 }
 if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
 if(!['GET','HEAD'].includes(request.method))return json({error:'No file upload endpoint exists'},405);
 const response=await env.ASSETS.fetch(request);
 if(url.pathname==='/'&&request.method==='GET'&&response.status===200)ctx.waitUntil(send(env,{event:'page_view',format:'unknown',durationMs:0,sizeBucket:'none'},request.cf?.country||'Unknown'));
 return secure(response);
}
export default {fetch:handle};
