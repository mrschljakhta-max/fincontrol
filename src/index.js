// FINCONTROL API starter. Not production-ready until Cloudflare Access protects ALL routes.
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default {async fetch(request,env){
  // Never serve financial information before authentication is configured.
  if(!env.DB || !env.ACCESS_AUD)return json({error:"Setup incomplete: configure D1 and Cloudflare Access before use"},503);
  const url=new URL(request.url);
  if(url.pathname==="/")return new Response("<!doctype html><html lang='uk'><meta charset='utf-8'><title>FINCONTROL</title><body style='font:18px system-ui;background:#101827;color:white;padding:3rem'><h1>FINCONTROL</h1><p>API підготовлено. Доступ до фінансових даних потребує Cloudflare Access.</p></body></html>",{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  if(!url.pathname.startsWith("/api/"))return json({error:"Not found"},404);
  // Access edge policy must verify the JWT for the entire hostname. Header alone is not proof.
  if(!request.headers.get("Cf-Access-Jwt-Assertion"))return json({error:"Unauthorized"},401);
  try {
    if(url.pathname==="/api/entries"&&request.method==="GET"){const r=await env.DB.prepare("SELECT * FROM entries ORDER BY entry_date DESC, created_at DESC LIMIT 2000").all();return json(r.results)}
    if(url.pathname==="/api/entries"&&request.method==="POST"){
      const b=await request.json();const amount=Number(b.amount);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(b.entry_date)||!["income","expense","debt_payment"].includes(b.kind)||!["planned","actual"].includes(b.status)||typeof b.category!=="string"||!b.category.trim()||b.category.length>80||typeof b.description!=="string"||b.description.length>300||!Number.isFinite(amount)||amount<=0||amount>100000000)return json({error:"Invalid input"},400);
      const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO entries(id,entry_date,kind,category,amount_cents,description,status) VALUES(?,?,?,?,?,?,?)").bind(id,b.entry_date,b.kind,b.category.trim(),Math.round(amount*100),b.description,b.status).run();return json({id},201)
    }
    return json({error:"Not found"},404);
  }catch{return json({error:"Request failed"},500)}
}};