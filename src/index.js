const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function verifyAccess(request,env){
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN)return false;
  const parts=token.split(".");if(parts.length!==3)return false;
  try{
    const h=JSON.parse(new TextDecoder().decode(b64(parts[0])));
    const p=JSON.parse(new TextDecoder().decode(b64(parts[1])));
    const now=Math.floor(Date.now()/1000);
    const issuer="https://"+env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,"").replace(/\/$/,"");
    if(h.alg!=="RS256"||!h.kid||p.iss!==issuer||!Array.isArray(p.aud)||!p.aud.includes(env.ACCESS_AUD)||!p.exp||p.exp<=now||!p.iat||p.iat>now+60)return false;
    const res=await fetch(issuer+"/cdn-cgi/access/certs",{cf:{cacheTtl:300,cacheEverything:true}});
    if(!res.ok)return false;
    const certs=await res.json();const jwk=certs.keys?.find(k=>k.kid===h.kid&&k.kty==="RSA");
    if(!jwk)return false;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch{return false}
}
const html=`<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FINCONTROL</title>
<style>:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0b1220;color:#e8efff}*{box-sizing:border-box}body{margin:0}header{padding:22px max(24px,calc((100vw - 1100px)/2));border-bottom:1px solid #253249;background:#111b2d;display:flex;align-items:center;justify-content:space-between}h1{font-size:23px;margin:0}header small{color:#8ba0c0}main{max-width:1100px;margin:30px auto;padding:0 20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.card,section{background:#131f32;border:1px solid #2a3a55;border-radius:14px;padding:22px}.card label{display:block;color:#a4b4ce;font-size:13px}.card strong{font-size:28px;display:block;margin-top:10px}.positive{color:#5ee0b4}.negative{color:#ff9d9d}section{margin-top:22px}h2{font-size:18px;margin:0 0 16px}form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}input,select,button{background:#0b1423;color:#f2f5ff;border:1px solid #3a4c67;border-radius:8px;padding:12px;font:inherit;min-width:0}button{background:#3479e7;border:0;cursor:pointer;font-weight:600}button:disabled{opacity:.5}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:12px;border-bottom:1px solid #2c3b52}th{color:#a4b4ce}#notice{min-height:22px;color:#ffcc85}.muted{color:#91a5c4;font-size:13px}.scroll{overflow-x:auto}</style>
<header><div><h1>◈ FINCONTROL</h1><small>Особистий фінансовий кабінет</small></div><small>Приватний доступ</small></header>
<main><div class="cards"><div class="card"><label>Фактичні доходи</label><strong id="income">—</strong></div><div class="card"><label>Фактичні витрати</label><strong id="expenses">—</strong></div><div class="card"><label>Платежі за боргами</label><strong id="debts">—</strong></div><div class="card"><label>Баланс операцій</label><strong id="balance">—</strong></div></div>
<section><h2>Додати операцію</h2><form id="entry"><input type="date" name="entry_date" required><select name="kind"><option value="income">Дохід</option><option value="expense">Витрата</option><option value="debt_payment">Погашення боргу</option></select><select name="status"><option value="actual">Фактично</option><option value="planned">Заплановано</option></select><input name="category" placeholder="Категорія" maxlength="80" required><input type="number" name="amount" placeholder="Сума, ₴" step=".01" min=".01" required><input name="description" placeholder="Примітка" maxlength="300"><button type="submit">Зберегти</button></form><p id="notice" role="status"></p></section>
<section><h2>Операції</h2><p class="muted">Планові операції не включаються у фактичний баланс. Початкові суми боргів не внесено як транзакції.</p><div class="scroll"><table><thead><tr><th>Дата</th><th>Тип</th><th>Категорія</th><th>Сума</th><th>Статус</th><th>Примітка</th></tr></thead><tbody id="rows"><tr><td colspan="6">Завантаження…</td></tr></tbody></table></div><p><button id="export" type="button">Експорт CSV</button></p></section></main>
<script>
const fmt=n=>new Intl.NumberFormat("uk-UA",{style:"currency",currency:"UAH"}).format(n);
const kinds={income:"Дохід",expense:"Витрата",debt_payment:"Борг"};
let entries=[];
function cell(tr,value){const td=document.createElement("td");td.textContent=String(value??"");tr.append(td)}
function draw(){
const actual=entries.filter(x=>x.status==="actual");
const sum=k=>actual.filter(x=>x.kind===k).reduce((s,x)=>s+x.amount_cents/100,0);
const inc=sum("income"),exp=sum("expense"),debt=sum("debt_payment");
for(const [id,n] of [["income",inc],["expenses",exp],["debts",debt],["balance",inc-exp-debt]])document.getElementById(id).textContent=fmt(n);
const tbody=document.getElementById("rows");tbody.replaceChildren();
if(!entries.length){const tr=document.createElement("tr");cell(tr,"Операцій поки немає");tbody.append(tr)}
for(const x of entries){const tr=document.createElement("tr");[x.entry_date,kinds[x.kind]||x.kind,x.category,fmt(x.amount_cents/100),x.status==="planned"?"План":"Факт",x.description].forEach(v=>cell(tr,v));tbody.append(tr)}
}
async function load(){const r=await fetch("/api/entries");if(!r.ok)throw Error("Не вдалося прочитати записи ("+r.status+")");entries=await r.json();draw()}
const today=new Date();const localDay=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");document.querySelector('[name="entry_date"]').value=localDay;
document.getElementById("entry").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const btn=f.querySelector("button");btn.disabled=true;const notice=document.getElementById("notice");notice.textContent="Збереження…";try{const body=Object.fromEntries(new FormData(f));body.amount=Number(body.amount);const r=await fetch("/api/entries",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw Error("Помилка збереження ("+r.status+")");await load();notice.textContent="Збережено";f.elements.amount.value="";f.elements.description.value=""}catch(err){notice.textContent=err.message}finally{btn.disabled=false}});
document.getElementById("export").addEventListener("click",()=>{const esc=x=>'"'+String(x??"").replace(/"/g,'""')+'"';const cols=["entry_date","kind","category","amount_cents","status","description"];const csv="\uFEFF"+[cols.join(";"),...entries.map(x=>cols.map(k=>esc(x[k])).join(";"))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="fincontrol-entries.csv";a.click();URL.revokeObjectURL(url)});
load().catch(err=>{document.getElementById("notice").textContent=err.message;document.getElementById("rows").textContent="Немає доступу до даних"});
</script></html>`;
export default {async fetch(request,env){
  if(!env.DB||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN)return json({error:"FINCONTROL configuration incomplete"},503);
  if(!await verifyAccess(request,env))return json({error:"Unauthorized"},401);
  const url=new URL(request.url);
  if(url.pathname==="/"&&request.method==="GET")return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
  if(url.pathname==="/api/entries"&&request.method==="GET"){try{const r=await env.DB.prepare("SELECT * FROM entries ORDER BY entry_date DESC, created_at DESC LIMIT 2000").all();return json(r.results)}catch{return json({error:"Database unavailable"},503)}}
  if(url.pathname==="/api/entries"&&request.method==="POST"){
    let b;try{b=await request.json()}catch{return json({error:"Invalid JSON"},400)}
    if(!b||typeof b!=="object"||Array.isArray(b))return json({error:"Invalid input"},400);
    const amount=typeof b.amount==="number"?b.amount:NaN;
    const validDate=typeof b.entry_date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(b.entry_date)&&!Number.isNaN(Date.parse(b.entry_date))&&new Date(b.entry_date).toISOString().slice(0,10)===b.entry_date;
    if(!validDate||!["income","expense","debt_payment"].includes(b.kind)||!["planned","actual"].includes(b.status)||typeof b.category!=="string"||!b.category.trim()||b.category.length>80||typeof b.description!=="string"||b.description.length>300||!Number.isFinite(amount)||amount<=0||amount>100000000||Math.abs(Math.round(amount*100)-amount*100)>1e-7)return json({error:"Invalid input"},400);
    try{const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO entries(id,entry_date,kind,category,amount_cents,description,status) VALUES(?,?,?,?,?,?,?)").bind(id,b.entry_date,b.kind,b.category.trim(),Math.round(amount*100),b.description,b.status).run();return json({id},201)}catch{return json({error:"Database unavailable"},503)}
  }
  return json({error:"Not found"},404);
}};