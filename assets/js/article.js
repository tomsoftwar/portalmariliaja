import {db} from "./firebase.js";import{doc,getDoc,updateDoc,increment,collection,getDocs}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";const $=s=>document.querySelector(s);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));function cleanHtml(html=""){const t=document.createElement("template");t.innerHTML=html; t.content.querySelectorAll("script,style,object,embed,form").forEach(n=>n.remove());t.content.querySelectorAll("*").forEach(n=>[...n.attributes].forEach(a=>{if(a.name.toLowerCase().startsWith("on")||((a.name==="href"||a.name==="src")&&/^\s*javascript:/i.test(a.value)))n.removeAttribute(a.name)}));return t.innerHTML}function vid(u=""){try{let x=new URL(u);if(x.hostname.includes("youtu.be"))return x.pathname.slice(1);if(x.hostname.includes("youtube.com"))return x.searchParams.get("v")||x.pathname.split("/embed/")[1]?.split("/")[0]||""}catch{}return""}const id=new URLSearchParams(location.search).get("id");if(!id){$("#article-status").textContent="Notícia não informada."}else try{const s=await getDoc(doc(db,"noticias",id));if(!s.exists())throw Error("notfound");const x=s.data(),title=x.title||x.titulo||"Notícia MARÍLIAJÁ",dt=x.createdAt?.toDate?x.createdAt.toDate():new Date(x.data||Date.now()),url=encodeURIComponent(location.href),t=encodeURIComponent(title);document.title=title+" | MARÍLIAJÁ";$("#article-status").textContent="";
try { const key="mariliaja_view_"+id; if(!sessionStorage.getItem(key)){ await updateDoc(doc(db,"noticias",id),{views:increment(1)}); sessionStorage.setItem(key,"1"); } } catch(err) { console.warn("Contagem de visualizações indisponível:",err); }
$("#article-content").innerHTML=`<article class="article"><span class="category">${esc(x.category||x.categoria||"Geral")}</span><h1>${esc(title)}</h1><p class="article-summary">${esc(x.summary||x.resumo||"")}</p><p class="meta">${esc(new Intl.DateTimeFormat("pt-BR",{dateStyle:"long"}).format(dt))} · MARÍLIAJÁ</p>${x.imageUrl||x.imagem?`<figure><img class="article-image" src="${esc(x.imageUrl||x.imagem)}" alt="${esc(x.imageCaption||title)}"><figcaption>${esc(x.imageCaption||"")}</figcaption></figure>`:""}${x.videoUrl&&vid(x.videoUrl)?`<div class="article-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(vid(x.videoUrl))}" title="${esc(title)}" allowfullscreen loading="lazy"></iframe></div>`:""}<div class="article-body">${cleanHtml(x.content||x.conteudo||"")}</div><div class="share-row"><span>Compartilhe:</span><a class="share whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=${t}%20${url}">WhatsApp</a><a class="share facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${url}">Facebook</a><button class="share instagram" id="copy">Instagram</button></div></article>`;$("#copy").onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$("#copy").textContent="Link copiado!"}catch{prompt("Copie o link",location.href)}}}catch(e){$("#article-status").textContent="Não foi possível encontrar esta notícia."}
function atualizarRelogio() {
  const agora = new Date();
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const segundos = String(agora.getSeconds()).padStart(2, '0');

  document.getElementById('relogio').textContent = `${horas}:${minutos}:${segundos}`;
}

// Atualiza a cada 1000 milissegundos (1 segundo)
setInterval(atualizarRelogio, 1000);

// Executa uma vez logo ao carregar a página
atualizarRelogio();


// Carrega os banners cadastrados no painel também dentro das páginas individuais de notícia.
function safeAdUrl(v){try{const u=new URL(v,location.href);return ["https:","http:"].includes(u.protocol)?u.href:""}catch{return ""}}
function renderAd(a){const image=safeAdUrl(a.imageUrl),link=safeAdUrl(a.linkUrl);if(!image||!link||a.active!==true)return "";const name=esc(a.name||"Anunciante");return `<a class="sponsor-banner" href="${esc(link)}" target="_blank" rel="sponsored noopener noreferrer"><img src="${esc(image)}" alt="Publicidade: ${name}" loading="lazy"><span>Publicidade · ${name}</span></a>`}
async function loadArticleAds(){try{const snap=await getDocs(collection(db,"anuncios"));const ads=snap.docs.map(d=>d.data()).filter(a=>a.active===true);for(const place of ["top","middle","bottom"]){const slots=[...document.querySelectorAll(".ad-"+place)];const matching=ads.filter(a=>a.placement===place);slots.forEach((slot,i)=>{const ad=matching[i%Math.max(matching.length,1)];if(ad){slot.innerHTML=renderAd(ad);slot.classList.add("ad-filled")}})}}catch(err){console.warn("Anúncios indisponíveis nesta notícia:",err)}}
loadArticleAds();
