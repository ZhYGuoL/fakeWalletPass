/**
 * Admin dashboard HTML, served only by the token-gated GET /api/admin-events
 * route (never shipped as a static asset, so it can't be found by browsing).
 * The client script authenticates via the session cookie set on first load,
 * so no token is stored in the page or the URL. All dynamic HTML is built by
 * string concatenation (no template placeholders) so this whole file is a
 * plain literal with nothing to interpolate.
 */

export const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Tracker</title>
<style>
:root{--bg:#fff;--bg2:#fafafa;--border:#ebebeb;--border2:#d9d9d9;--fg:#171717;--fg2:#666;--muted:#8f8f8f;--accent:#006bff;--danger:#e5484d;--radius:8px;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#000;--bg2:#0e0e0e;--border:#222;--border2:#333;--fg:#ededed;--fg2:#a0a0a0;--muted:#7d7d7d;--accent:#3b9dff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-size:14px;line-height:1.5}
.wrap{max-width:960px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:1.4rem;letter-spacing:-.02em;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 24px;font-size:.85rem}
.card{border:1px solid var(--border);border-radius:12px;background:var(--bg2);padding:16px;margin-bottom:20px}
.card h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 12px;font-weight:600}
label{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:4px}
input,select{width:100%;height:38px;padding:0 10px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--fg);font:inherit}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.grid .full{grid-column:1/-1}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button{height:38px;padding:0 14px;border:1px solid var(--fg);border-radius:var(--radius);background:var(--fg);color:var(--bg);font:inherit;font-weight:500;cursor:pointer}
button.ghost{background:transparent;color:var(--fg);border-color:var(--border2)}
button.danger{background:transparent;color:var(--danger);border-color:transparent;padding:0 8px}
table{width:100%;border-collapse:collapse;margin-top:4px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--border);font-size:.85rem;vertical-align:middle}
th{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
td.count input{width:74px;height:32px;text-align:right;font-variant-numeric:tabular-nums}
.name{font-weight:600}.host{color:var(--fg2);font-size:.78rem}
.chip{display:inline-block;padding:1px 7px;border:1px solid var(--border2);border-radius:999px;font-size:.68rem;color:var(--fg2)}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:8px 16px;border-radius:999px;font-size:.82rem;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.show{opacity:1}
.mono{font-family:ui-monospace,"SF Mono",Menlo,monospace}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="wrap">
<h1>Ticket Tracker</h1>
<p class="sub">Set each event's "tickets created" count. Counts also rise on their own as passes are made.</p>

<div class="card">
<h2>Actions</h2>
<div class="row">
<button class="ghost" onclick="load()">Reload</button>
<button class="ghost" onclick="reseed()">Reset to seed</button>
</div>
</div>

<div class="card">
<h2>Create / update event</h2>
<div class="grid">
<div class="full"><label>Event name</label><input id="f-name" placeholder="Stripe Presents: Made in San Francisco" /></div>
<div><label>Host</label><input id="f-host" placeholder="Stripe . S09" /></div>
<div><label>Location</label><input id="f-location" placeholder="San Francisco, CA" /></div>
<div><label>Status</label><input id="f-status" placeholder="Sold out / Open" /></div>
<div><label>Tickets created</label><input id="f-count" type="number" min="0" placeholder="0" /></div>
<div class="full"><label>Luma URL (the event key)</label><input id="f-url" class="mono" placeholder="https://luma.com/xggm2di5" /></div>
</div>
<div class="row" style="margin-top:12px">
<button onclick="upsert()">Save event</button>
<button class="ghost" onclick="clearForm()">Clear</button>
</div>
</div>

<div class="card">
<h2>Events (<span id="count">0</span>) . sorted by tickets</h2>
<table><thead><tr><th>#</th><th>Event</th><th>Status</th><th>Tickets</th><th></th></tr></thead>
<tbody id="rows"></tbody></table>
</div>
</div>
<div class="toast" id="toast"></div>

<script>
(function(){try{var u=new URL(location.href);if(u.searchParams.has("token")){u.searchParams.delete("token");history.replaceState({},document.title,u.pathname+(u.search?u.search:""));}}catch(e){}})();
var $=function(id){return document.getElementById(id);};
function toast(m){var t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove("show");},1800);}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}
async function api(method,body){
var res=await fetch("/api/admin-events",{method:method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,credentials:"same-origin"});
var data=await res.json().catch(function(){return {};});
if(!res.ok)throw new Error(data.error||("HTTP "+res.status));
return data;
}
async function load(){
try{var data=await api("GET");render(data.events||[]);$("count").textContent=(data.events||[]).length;}
catch(e){toast(e.message);}
}
function pad2(n){n=String(n);return n.length<2?"0"+n:n;}
function render(events){
var rows=events.map(function(e,i){
return "<tr>"
+"<td class=\\"mono\\" style=\\"color:var(--muted)\\">"+pad2(i+1)+"</td>"
+"<td><div class=\\"name\\">"+esc(e.name)+"</div><div class=\\"host\\">"+esc(e.host)+" . <a href=\\""+esc(e.url)+"\\" target=\\"_blank\\" rel=\\"noreferrer\\">luma</a></div></td>"
+"<td><span class=\\"chip\\">"+esc(e.status||"-")+"</span></td>"
+"<td class=\\"count\\"><input type=\\"number\\" min=\\"0\\" value=\\""+e.ticketsCreated+"\\" data-slug=\\""+esc(e.slug)+"\\" onchange=\\"setCount(this.dataset.slug,this.value)\\" /></td>"
+"<td><button class=\\"danger\\" data-slug=\\""+esc(e.slug)+"\\" onclick=\\"removeEvent(this.dataset.slug)\\">Delete</button></td>"
+"</tr>";
}).join("");
$("rows").innerHTML=rows||"<tr><td colspan=\\"5\\" style=\\"color:var(--muted)\\">No events yet.</td></tr>";
}
async function setCount(slug,value){try{await api("POST",{action:"setCount",slug:slug,ticketsCreated:Number(value)});toast("Count updated");load();}catch(e){toast(e.message);}}
async function upsert(){
var event={name:$("f-name").value.trim(),host:$("f-host").value.trim(),location:$("f-location").value.trim(),status:$("f-status").value.trim(),url:$("f-url").value.trim(),ticketsCreated:Number($("f-count").value||0)};
if(!event.name||!event.url){toast("Name and Luma URL are required");return;}
try{await api("POST",{action:"upsert",event:event});toast("Saved");clearForm();load();}catch(e){toast(e.message);}
}
async function removeEvent(slug){if(!confirm("Delete this event?"))return;try{await api("POST",{action:"delete",slug:slug});toast("Deleted");load();}catch(e){toast(e.message);}}
async function reseed(){if(!confirm("Reset all events back to the seeded leaderboard? This overwrites current counts."))return;try{await api("POST",{action:"reseed"});toast("Reseeded");load();}catch(e){toast(e.message);}}
function clearForm(){["f-name","f-host","f-location","f-status","f-url","f-count"].forEach(function(id){$(id).value="";});}
load();
</script>
</body>
</html>`;

// Login page: password posts in a form body (never in a URL) and, on success,
// the server sets the session cookie so the dashboard loads on reload.
export const LOGIN_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" /><title>Sign in</title>
<style>
:root{--bg:#fff;--bg2:#fafafa;--border:#d9d9d9;--fg:#171717;--muted:#8f8f8f;--accent:#006bff;--danger:#e5484d;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#000;--bg2:#0e0e0e;--border:#333;--fg:#ededed;--muted:#7d7d7d;--accent:#3b9dff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);display:grid;place-items:center;min-height:100vh}
.card{width:min(92vw,340px);border:1px solid var(--border);border-radius:14px;background:var(--bg2);padding:24px}
h1{font-size:1.1rem;margin:0 0 4px}p{color:var(--muted);font-size:.85rem;margin:0 0 18px}
input{width:100%;height:42px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
button{width:100%;height:42px;margin-top:12px;border:0;border-radius:8px;background:var(--fg);color:var(--bg);font:inherit;font-weight:600;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}.err{color:var(--danger);font-size:.82rem;margin-top:10px;min-height:1em}
</style></head><body>
<form class="card" id="f">
<h1>Ticket Tracker</h1><p>Enter the admin password.</p>
<input id="pw" type="password" autocomplete="current-password" placeholder="Password" autofocus />
<button id="b" type="submit">Sign in</button>
<div class="err" id="e"></div>
</form>
<script>
var f=document.getElementById('f'),pw=document.getElementById('pw'),b=document.getElementById('b'),e=document.getElementById('e');
f.addEventListener('submit',async function(ev){ev.preventDefault();b.disabled=true;e.textContent='';
try{var r=await fetch('/api/admin-events',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'login',password:pw.value})});
var d=await r.json().catch(function(){return{};});
if(r.ok){location.href='/api/admin-events?ui=1';return;}
e.textContent=d.error||('Error '+r.status);}catch(x){e.textContent='Network error';}
b.disabled=false;pw.value='';pw.focus();});
</script></body></html>`;
