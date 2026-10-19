
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = s => document.querySelector(s);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

function cleanHtml(html = "") {
  const t = document.createElement("template");
  t.innerHTML = html;

  t.content.querySelectorAll("script,style,object,embed,form").forEach(n => n.remove());

  t.content.querySelectorAll("*").forEach(n => {
    [...n.attributes].forEach(a => {
      if (
        a.name.toLowerCase().startsWith("on") ||
        ((a.name === "href" || a.name === "src") &&
          /^\s*javascript:/i.test(a.value))
      ) {
        n.removeAttribute(a.name);
      }
    });
  });

  return t.innerHTML;
}

function safeUrl(value) {
  try {
    const u = new URL(value, location.href);
    if (u.protocol === "https:" || u.protocol === "http:") {
      return u.href;
    }
  } catch {}
  return "";
}

function adMarkup(ad) {
  const image = safeUrl(ad.imageUrl);
  const link = safeUrl(ad.linkUrl);

  if (!image || !link || ad.active !== true) return "";

  return `
    <a class="sponsor-banner"
       href="${esc(link)}"
       target="_blank"
       rel="noopener sponsored"
       aria-label="Publicidade: ${esc(ad.name || "Anunciante")}">
      <img src="${esc(image)}"
           alt="${esc(ad.name || "Publicidade")}"
           loading="lazy">
      <span>Publicidade · ${esc(ad.name || "Anunciante")}</span>
    </a>
  `;
}

async function loadAdvertisements() {
  try {
    const snap = await getDocs(collection(db, "anuncios"));
    const ads = snap.docs.map(d => d.data())
      .filter(ad => ad.active === true);

    const placements = {
      top: document.querySelector(".ad-top"),
      middle: document.querySelector(".ad-middle"),
      bottom: document.querySelector(".ad-bottom")
    };

    for (const [placement, slot] of Object.entries(placements)) {
      if (!slot) continue;

      const ad = ads.find(item => item.placement === placement);
      const markup = ad ? adMarkup(ad) : "";

      if (markup) {
        slot.innerHTML = markup;
        slot.classList.add("ad-filled");
      } else {
        slot.innerHTML = `
          <span>PUBLICIDADE</span>
          <strong>ESPAÇO PARA ANÚNCIO</strong>
        `;
        slot.classList.remove("ad-filled");
      }
    }
  } catch (error) {
    console.error("Erro ao carregar anúncios:", error);
  }
}

function vid(url = "") {
  try {
    const x = new URL(url);

    if (x.hostname.includes("youtu.be")) {
      return x.pathname.slice(1);
    }

    if (x.hostname.includes("youtube.com")) {
      return x.searchParams.get("v") ||
        x.pathname.split("/embed/")[1]?.split("/")[0] ||
        "";
    }
  } catch {}

  return "";
}

async function loadArticle() {
  const id = new URLSearchParams(location.search).get("id");

  if (!id) {
    $("#article-status").textContent = "Notícia não informada.";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "noticias", id));

    if (!snap.exists()) {
      throw new Error("Notícia não encontrada");
    }

    const x = snap.data();
    const title = x.title || x.titulo || "Notícia MARÍLIAJÁ";

    const dt = x.createdAt?.toDate
      ? x.createdAt.toDate()
      : new Date(x.data || Date.now());

    const url = encodeURIComponent(location.href);
    const encodedTitle = encodeURIComponent(title);
    const imageUrl = safeUrl(x.imageUrl || x.imagem);

    document.title = title + " | MARÍLIAJÁ";
    $("#article-status").textContent = "";

    $("#article-content").innerHTML = `
      <article class="article">
        <span class="category">${esc(x.category || x.categoria || "Geral")}</span>
        <h1>${esc(title)}</h1>

        <p class="article-summary">${esc(x.summary || x.resumo || "")}</p>

        <p class="meta">
          ${esc(new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "long"
          }).format(dt))}
          · MARÍLIAJÁ
        </p>

        ${imageUrl ? `
          <figure>
            <img class="article-image"
                 src="${esc(imageUrl)}"
                 alt="${esc(x.imageCaption || title)}">
            <figcaption>${esc(x.imageCaption || "")}</figcaption>
          </figure>
        ` : ""}

        ${x.videoUrl && vid(x.videoUrl) ? `
          <div class="article-video">
            <iframe
              src="https://www.youtube-nocookie.com/embed/${esc(vid(x.videoUrl))}"
              title="${esc(title)}"
              allowfullscreen
              loading="lazy">
            </iframe>
          </div>
        ` : ""}

        <div class="article-body">
          ${cleanHtml(x.content || x.conteudo || "")}
        </div>

        <div class="share-row">
          <span>Compartilhe:</span>

          <a class="share whatsapp"
             target="_blank"
             rel="noopener"
             href="https://wa.me/?text=${encodedTitle}%20${url}">
            WhatsApp
          </a>

          <a class="share facebook"
             target="_blank"
             rel="noopener"
             href="https://www.facebook.com/sharer/sharer.php?u=${url}">
            Facebook
          </a>

          <button class="share instagram" id="copy" type="button">
            Insta
          </button>
        </div>
      </article>
    `;

    $("#copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        $("#copy").textContent = "Link copiado!";
      } catch {
        prompt("Copie o link da notícia:", location.href);
      }
    });

  } catch (error) {
    console.error("Erro ao carregar notícia:", error);
    $("#article-status").textContent =
      "Não foi possível encontrar esta notícia.";
  }
}

loadArticle();
loadAdvertisements();
