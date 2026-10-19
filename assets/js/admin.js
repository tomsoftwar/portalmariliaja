import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, deleteUser
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, query, orderBy, updateDoc, where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = s => document.querySelector(s);
const loginPanel = $("#login-panel"), editor = $("#editor-panel");
const loginMsg = $("#login-message"), adminMsg = $("#admin-message");
const form = $("#news-form"), content = $("#content");
let currentUser = null, currentProfile = null, isAdmin = false;

function message(el, t, type = "") {
  if (!el) return;
  el.textContent = t;
  el.className = "message " + type;
}
function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
async function profileFor(user) {
  const snap = await getDoc(doc(db, "admins", user.uid));
  if (!snap.exists() || snap.data().ativo !== true) return null;
  const data = snap.data();
  // Compatibilidade: contas antigas sem "perfil" continuam administradoras.
  return { ...data, perfil: data.perfil || "admin" };
}
function activeAdmin() {
  return !!currentUser && !!currentProfile && currentProfile.ativo === true &&
    currentProfile.perfil === "admin";
}
function addCollaboratorPanel() {
  if ($("#collaborators-panel")) return;
  const section = document.createElement("section");
  section.id = "collaborators-panel";
  section.className = "panel";
  section.innerHTML = `
    <div class="section-heading"><h2>Colaboradores</h2></div>
    <p class="help">Cadastre contas que poderão publicar e administrar somente as próprias notícias.</p>
    <form id="collaborator-form">
      <label>Nome do colaborador *<input id="collab-name" required maxlength="100" placeholder="Nome completo"></label>
      <label>E-mail *<input id="collab-email" type="email" required autocomplete="off" placeholder="colaborador@exemplo.com"></label>
      <label>Senha temporária *<input id="collab-password" type="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo de 6 caracteres"></label>
      <div class="actions"><button class="btn" type="submit">Cadastrar colaborador</button></div>
      <p id="collab-message" class="message" role="status"></p>
    </form>
    <div id="collaborators-list" class="admin-news-list">Carregando colaboradores...</div>`;
  editor.appendChild(section);
  $("#collaborator-form").addEventListener("submit", createCollaborator);
}
async function createCollaborator(e) {
  e.preventDefault();
  if (!activeAdmin()) return message($("#collab-message"), "Somente administradores podem cadastrar colaboradores.", "error");
  const btn = $("#collaborator-form").querySelector('[type="submit"]');
  const name = $("#collab-name").value.trim();
  const email = $("#collab-email").value.trim();
  const password = $("#collab-password").value;
  btn.disabled = true;
  message($("#collab-message"), "Cadastrando conta...");
  let secondaryApp, secondaryUser;
  try {
    // App secundário evita desconectar o administrador atual ao criar a conta.
    secondaryApp = initializeApp(auth.app.options, "mariliaja-user-" + Date.now());
    const secondaryAuth = (await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")).getAuth(secondaryApp);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    secondaryUser = credential.user;
    await setDoc(doc(db, "admins", secondaryUser.uid), {
      nome: name, email, perfil: "colaborador", ativo: true,
      criadoPor: currentUser.uid, criadoEm: serverTimestamp()
    });
    message($("#collab-message"), "Colaborador cadastrado com sucesso.", "success");
    $("#collaborator-form").reset();
    await loadCollaborators();
  } catch (err) {
    console.error(err);
    // Se o documento de perfil falhar, tenta remover a conta recém-criada.
    if (secondaryUser) {
      try {
        const secondaryAuth = (await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")).getAuth(secondaryApp);
        await deleteUser(secondaryUser);
      } catch (cleanupError) { console.warn("Não foi possível desfazer a criação da conta:", cleanupError); }
    }
    const text = err.code === "auth/email-already-in-use" ? "Este e-mail já possui uma conta no Firebase Authentication." :
      err.code === "auth/weak-password" ? "A senha é muito fraca. Use pelo menos 6 caracteres." :
      err.code === "permission-denied" ? "O Firebase recusou a criação do perfil. Publique primeiro as novas regras do Firestore." :
      "Não foi possível cadastrar. Confira se o método E-mail/senha está ativado no Firebase Authentication.";
    message($("#collab-message"), text, "error");
  } finally {
    if (secondaryApp) { try { await deleteApp(secondaryApp); } catch {} }
    btn.disabled = false;
  }
}
async function loadCollaborators() {
  const box = $("#collaborators-list");
  if (!box || !activeAdmin()) return;
  box.textContent = "Carregando colaboradores...";
  try {
    const snap = await getDocs(collection(db, "admins"));
    const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .filter(x => x.perfil === "colaborador");
    if (!rows.length) { box.innerHTML = '<div class="empty">Nenhum colaborador cadastrado.</div>'; return; }
    box.innerHTML = rows.map(x => `<div class="admin-item">
      <div><strong>${esc(x.nome || x.email || "Colaborador")}</strong>
      <small>${esc(x.email || "")} · ${x.ativo === true ? "Ativo" : "Desativado"}</small></div>
      <div class="admin-item-actions"><button class="delete-btn" data-toggle-user="${esc(x.uid)}" data-active="${x.ativo === true ? "true" : "false"}">${x.ativo === true ? "Desativar" : "Reativar"}</button></div>
    </div>`).join("");
    box.querySelectorAll("[data-toggle-user]").forEach(b => b.addEventListener("click", async () => {
      const uid = b.dataset.toggleUser, wasActive = b.dataset.active === "true";
      if (!confirm(`${wasActive ? "Desativar" : "Reativar"} este colaborador?`)) return;
      try {
        await updateDoc(doc(db, "admins", uid), { ativo: !wasActive });
        await loadCollaborators();
      } catch (err) {
        console.error(err);
        message($("#collab-message"), "Não foi possível alterar o colaborador. Confira as regras do Firestore.", "error");
      }
    }));
  } catch (err) {
    console.error(err);
    box.innerHTML = '<div class="empty">Erro ao carregar colaboradores. Confira as regras do Firestore.</div>';
  }
}


// Gerenciamento de anúncios: somente administradores podem cadastrar/editar/excluir.
const adsPanel = $("#ads-panel");
const adForm = $("#ad-form");
const adMsg = $("#ad-message");
const adEsc = esc;
function adMessage(text, type = "") { if (adMsg) message(adMsg, text, type); }
function validHttpUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}
function resetAdForm() {
  if (!adForm) return;
  adForm.reset(); $("#ad-id").value = ""; $("#ad-active").checked = true; adMessage("");
}
async function loadAdsAdmin() {
  const box = $("#ads-list");
  if (!box || !activeAdmin()) return;
  box.innerHTML = '<div class="empty">Carregando anúncios...</div>';
  try {
    const snap = await getDocs(query(collection(db, "anuncios"), orderBy("updatedAt", "desc")));
    if (!snap.docs.length) { box.innerHTML = '<div class="empty">Nenhum anúncio cadastrado.</div>'; return; }
    box.innerHTML = snap.docs.map(d => {
      const x = d.data();
      return `<div class="admin-item"><div><strong>${adEsc(x.name || "Anunciante")}</strong><small>${adEsc(({top:"Topo",middle:"Meio",bottom:"Final"})[x.placement] || "Meio")} · ${x.active === true ? "Ativo" : "Inativo"}</small></div><div class="admin-item-actions"><button class="edit-btn" type="button" data-ad-edit="${adEsc(d.id)}">Editar</button><button class="delete-btn" type="button" data-ad-delete="${adEsc(d.id)}">Excluir</button></div></div>`;
    }).join("");
    box.querySelectorAll("[data-ad-edit]").forEach(b => b.onclick = async () => {
      const s = await getDoc(doc(db, "anuncios", b.dataset.adEdit)); if (!s.exists()) return;
      const x = s.data();
      $("#ad-id").value = s.id; $("#ad-name").value = x.name || ""; $("#ad-image").value = x.imageUrl || "";
      $("#ad-link").value = x.linkUrl || ""; $("#ad-placement").value = x.placement || "middle"; $("#ad-active").checked = x.active === true;
      adForm.scrollIntoView({behavior:"smooth"}); adMessage("Editando anúncio. Salve para publicar as alterações.", "success");
    });
    box.querySelectorAll("[data-ad-delete]").forEach(b => b.onclick = async () => {
      if (!confirm("Excluir este anúncio?")) return;
      try { await deleteDoc(doc(db, "anuncios", b.dataset.adDelete)); await loadAdsAdmin(); adMessage("Anúncio excluído.", "success"); }
      catch (err) { console.error(err); adMessage("Não foi possível excluir. Confira as regras do Firestore.", "error"); }
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = '<div class="empty">Erro ao carregar anúncios. Confira as regras do Firestore para a coleção anuncios.</div>';
  }
}
if (adForm) {
  adForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!activeAdmin()) return adMessage("Somente administradores podem gerenciar anúncios.", "error");
    const btn = adForm.querySelector('[type="submit"]'); btn.disabled = true; adMessage("Salvando anúncio...");
    try {
      const imageUrl = $("#ad-image").value.trim(), linkUrl = $("#ad-link").value.trim();
      if (!validHttpUrl(imageUrl) || !validHttpUrl(linkUrl)) throw new Error("url");
      const id = $("#ad-id").value || crypto.randomUUID();
      await setDoc(doc(db, "anuncios", id), {
        name: $("#ad-name").value.trim(), imageUrl, linkUrl, placement: $("#ad-placement").value,
        active: $("#ad-active").checked, updatedAt: serverTimestamp(),
        createdBy: currentUser.uid
      }, {merge:true});
      resetAdForm(); adMessage("Anúncio salvo. Ele poderá aparecer no portal conforme o local escolhido.", "success"); await loadAdsAdmin();
    } catch (err) {
      console.error(err);
      adMessage(err.message === "url" ? "Informe URLs válidas começando por https:// ou http://." :
        err.code === "permission-denied" ? "O Firebase recusou a gravação. É necessário permitir o gerenciamento da coleção anuncios nas regras do Firestore." :
        "Não foi possível salvar o anúncio. Confira o Firebase.", "error");
    } finally { btn.disabled = false; }
  });
  $("#ad-clear").addEventListener("click", resetAdForm);
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  currentProfile = null;
  isAdmin = false;
  if (!user) {
    loginPanel.classList.remove("hidden"); editor.classList.add("hidden"); return;
  }
  try {
    currentProfile = await profileFor(user);
    if (!currentProfile) {
      await signOut(auth);
      loginPanel.classList.remove("hidden"); editor.classList.add("hidden");
      message(loginMsg, "Esta conta não está ativa ou não tem permissão.", "error");
      return;
    }
    isAdmin = currentProfile.perfil === "admin";
    if (adsPanel) adsPanel.classList.toggle("hidden", !isAdmin);
    loginPanel.classList.add("hidden"); editor.classList.remove("hidden");
    loadDraftsList().catch(console.error);
    if (!isAdmin) {
      const collabPanel = $("#collaborators-panel");
      if (collabPanel) collabPanel.remove();
      $("#news-form").querySelector('[type="submit"]').textContent = "Publicar / salvar minha notícia";
      const heading = $(".admin-list-heading h2");
      if (heading) heading.textContent = "Minhas notícias";
    } else {
      addCollaboratorPanel();
      await loadCollaborators();
    }
    await loadAdminNews();
    if (activeAdmin()) await loadAdsAdmin();
  } catch (err) {
    console.error(err);
    message(loginMsg, "Falha ao validar o usuário. Confira as regras do Firestore.", "error");
  }
});
$("#login-form").addEventListener("submit", async e => {
  e.preventDefault(); message(loginMsg, "Entrando...");
  try { await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value); }
  catch (err) { console.error(err); message(loginMsg, "Não foi possível entrar. Confira e-mail, senha e a configuração do Firebase.", "error"); }
});
$("#logout").addEventListener("click", () => signOut(auth));

// Ferramentas de texto e mídia.
document.querySelectorAll("[data-cmd]").forEach(b => b.addEventListener("click", () => {
  content.focus(); document.execCommand(b.dataset.cmd, false, null);
}));
$("#insert-link").onclick = () => {
  const u = prompt("Cole a URL do link (https://...)");
  if (u && /^https?:\/\//i.test(u)) { content.focus(); document.execCommand("createLink", false, u); }
};
$("#insert-image").onclick = () => {
  const u = prompt("Cole a URL pública da imagem (https://...)");
  if (u && /^https?:\/\//i.test(u)) {
    content.focus();
    document.execCommand("insertHTML", false, `<p><img src="${esc(u)}" alt="Imagem da notícia" style="max-width:100%;height:auto"></p>`);
  }
};
$("#insert-video").onclick = () => {
  const u = prompt("Cole o link de um vídeo do YouTube");
  if (!u) return;
  let id = "";
  try { const x = new URL(u); id = x.hostname.includes("youtu.be") ? x.pathname.slice(1) : x.searchParams.get("v") || x.pathname.split("/embed/")[1]?.split("/")[0] || ""; } catch {}
  if (id && /^[\w-]{6,}$/.test(id)) {
    content.focus();
    document.execCommand("insertHTML", false, `<p><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vídeo do YouTube" width="560" height="315" allowfullscreen loading="lazy"></iframe></p>`);
  } else alert("Link do YouTube não reconhecido.");
};

const draftMsg = $("#draft-message");
let draftTimer = null;
function draftStorageKey() {
  return currentUser?.uid ? `mariliaja_news_draft_${currentUser.uid}` : "mariliaja_news_draft_guest";
}
function readEditorFields() {
  return {
    newsId: $("#news-id").value,
    title: $("#title").value,
    summary: $("#summary").value,
    content: content.innerHTML,
    category: $("#category").value,
    imageUrl: $("#imageUrl").value,
    imageCaption: $("#imageCaption").value,
    videoUrl: $("#videoUrl").value,
    featured: $("#featured").checked,
    savedAt: new Date().toISOString()
  };
}
function applyDraft(d) {
  $("#news-id").value = d.newsId || "";
  $("#title").value = d.title || "";
  $("#summary").value = d.summary || "";
  content.innerHTML = d.content || "";
  $("#category").value = d.category || "Cidade";
  $("#imageUrl").value = d.imageUrl || "";
  $("#imageCaption").value = d.imageCaption || "";
  $("#videoUrl").value = d.videoUrl || "";
  $("#featured").checked = !!d.featured;
}
async function saveDraft(showMessage = true) {
  try {
    if (!currentUser || !currentProfile || currentProfile.ativo !== true) {
      if (showMessage) message(draftMsg, "Entre no painel para salvar o rascunho.", "error");
      return false;
    }
    const d = readEditorFields();
    if (!d.title.trim() && !d.summary.trim() && !content.innerText.trim() && !d.imageUrl && !d.videoUrl) {
      if (showMessage) message(draftMsg, "Preencha ao menos o título, resumo ou conteúdo antes de salvar.", "error");
      return false;
    }
    const draftId = d.newsId || ("novo_" + currentUser.uid);
    await setDoc(doc(db, "rascunhos", draftId), {
      ...d, authorId: currentUser.uid, authorEmail: currentUser.email || "",
      updatedAt: serverTimestamp(), savedAt: new Date().toISOString()
    }, { merge: true });
    try { localStorage.setItem(draftStorageKey(), JSON.stringify(d)); } catch {}
    if (showMessage) message(draftMsg, "Rascunho salvo no painel. A notícia ainda NÃO foi publicada.", "success");
    await loadDraftsList();
    return true;
  } catch (err) {
    console.error(err);
    if (showMessage) message(draftMsg, err.code === "permission-denied" ? "O Firebase bloqueou o rascunho. Atualize as regras do Firestore para permitir a coleção rascunhos." : "Não foi possível salvar o rascunho no painel.", "error");
    return false;
  }
}
async function recoverDraft(showMessage = true, draftId = null) {
  try {
    let d = null;
    if (draftId) {
      const snap = await getDoc(doc(db, "rascunhos", draftId));
      if (snap.exists()) d = snap.data();
    } else {
      const draftsQuery = activeAdmin()
        ? query(collection(db, "rascunhos"), orderBy("updatedAt", "desc"))
        : query(collection(db, "rascunhos"), where("authorId", "==", currentUser.uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(draftsQuery);
      if (snap.docs.length) { draftId = snap.docs[0].id; d = snap.docs[0].data(); }
    }
    if (!d) {
      try { const raw = localStorage.getItem(draftStorageKey()); if (raw) d = JSON.parse(raw); } catch {}
    }
    if (!d) {
      if (showMessage) message(draftMsg, "Nenhum rascunho foi encontrado no painel.", "error");
      return false;
    }
    if (($("#title").value.trim() || $("#summary").value.trim() || content.innerText.trim()) &&
        !confirm("Recuperar o rascunho substituirá o conteúdo que está no editor. Deseja continuar?")) return false;
    applyDraft(d);
    if (showMessage) message(draftMsg, "Rascunho recuperado. Você pode continuar editando e publicar quando estiver pronto.", "success");
    return true;
  } catch (err) {
    console.error(err);
    if (showMessage) message(draftMsg, err.code === "permission-denied" ? "O Firebase bloqueou a leitura dos rascunhos. Confira as regras do Firestore." : "Não foi possível recuperar o rascunho.", "error");
    return false;
  }
}
async function loadDraftsList() {
  const old = $("#drafts-list");
  if (!old || !currentUser) return;
  try {
    const draftsQuery = activeAdmin()
      ? query(collection(db, "rascunhos"), orderBy("updatedAt", "desc"))
      : query(collection(db, "rascunhos"), where("authorId", "==", currentUser.uid), orderBy("updatedAt", "desc"));
    const snap = await getDocs(draftsQuery);
    const docs = snap.docs;
    old.innerHTML = docs.length ? docs.map(x => {
      const d=x.data();
      return `<div class="admin-news-item"><div><strong>${esc(d.title || "Rascunho sem título")}</strong><p>${esc(d.category || "Geral")} · Não publicado</p></div><button type="button" class="btn btn-light" data-draft-load="${esc(x.id)}">Continuar edição</button></div>`;
    }).join("") : '<p class="help">Nenhum rascunho salvo no painel ainda.</p>';
    old.querySelectorAll("[data-draft-load]").forEach(b => b.addEventListener("click", () => recoverDraft(true, b.dataset.draftLoad)));
  } catch(err) {
    console.error(err);
    old.innerHTML = '<p class="help">Não foi possível carregar a lista de rascunhos. Confira as regras do Firestore.</p>';
  }
}
function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { try { localStorage.setItem(draftStorageKey(), JSON.stringify(readEditorFields())); } catch {} }, 700);
}
["#title", "#summary", "#category", "#imageUrl", "#imageCaption", "#videoUrl", "#featured"].forEach(sel => {
  const el = $(sel);
  el.addEventListener("input", scheduleDraftSave);
  el.addEventListener("change", scheduleDraftSave);
});
content.addEventListener("input", scheduleDraftSave);
$("#save-draft").addEventListener("click", () => saveDraft(true));
function resetForm() {
  form.reset(); $("#news-id").value = ""; content.innerHTML = ""; message(adminMsg, "");
  message(draftMsg, "Formulário limpo. O rascunho salvo continua disponível para recuperação.");
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || !currentProfile || currentProfile.ativo !== true) return message(adminMsg, "Entre novamente para publicar.", "error");
  const button = form.querySelector('[type="submit"]'); button.disabled = true; message(adminMsg, "Salvando conteúdo...");
  try {
    const id = $("#news-id").value || crypto.randomUUID();
    const oldSnap = $("#news-id").value ? await getDoc(doc(db, "noticias", id)) : null;
    const old = oldSnap?.exists() ? oldSnap.data() : null;
    if (old && !activeAdmin() && old.authorId !== currentUser.uid) throw new Error("not owner");
    const payload = {
      title: $("#title").value.trim(), summary: $("#summary").value.trim(),
      content: content.innerHTML, category: $("#category").value,
      imageUrl: $("#imageUrl").value.trim(), imageCaption: $("#imageCaption").value.trim(),
      videoUrl: $("#videoUrl").value.trim(), isFeatured: $("#featured").checked,
      authorSignature: old?.authorSignature || currentUser.email || "Redação MARÍLIAJÁ",
      createdAt: old?.createdAt || serverTimestamp(), updatedAt: serverTimestamp()
    };
    // Não transfere a autoria quando um administrador edita uma notícia de outra pessoa.
    if (old && Object.prototype.hasOwnProperty.call(old, "authorId")) payload.authorId = old.authorId;
    else if (!old) payload.authorId = currentUser.uid;
    await setDoc(doc(db, "noticias", id), payload, { merge: true });
    message(adminMsg, "Conteúdo salvo no banco e disponível aos visitantes.", "success");
    try { localStorage.removeItem(draftStorageKey()); } catch {}
    resetForm(); message(draftMsg, "Notícia publicada. O rascunho deste editor foi removido.", "success"); await loadAdminNews();
  } catch (err) {
    console.error(err);
    message(adminMsg, err.message === "not owner" ? "Você só pode editar notícias publicadas por você." :
      err.code === "permission-denied" ? "O Firebase recusou a gravação. Publique e confira as novas regras do Firestore." :
      "Não foi possível salvar. Confira a configuração do Firebase.", "error");
  } finally { button.disabled = false; }
});
async function loadAdminNews() {
  const box = $("#admin-news-list"); box.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const snap = await getDocs(query(collection(db, "noticias"), orderBy("createdAt", "desc")));
    const docs = snap.docs.filter(d => activeAdmin() || d.data().authorId === currentUser?.uid);
    if (!docs.length) { box.innerHTML = '<div class="empty">Nenhum conteúdo publicado ainda.</div>'; return; }
    box.innerHTML = docs.map(d => {
      const x = d.data();
      const canManage = activeAdmin() || x.authorId === currentUser?.uid;
      return `<div class="admin-item"><div><strong>${esc(x.title || x.titulo || "Sem título")}</strong>
        <small>${esc(x.category || x.categoria || "Geral")}${x.videoUrl ? " · vídeo" : ""}${activeAdmin() && x.authorSignature ? " · " + esc(x.authorSignature) : ""}</small></div>
        <div class="admin-item-actions">${canManage ? `<button class="edit-btn" data-edit="${esc(d.id)}">Editar</button><button class="delete-btn" data-delete="${esc(d.id)}">Excluir</button>` : ""}</div></div>`;
    }).join("");
    box.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editNews(b.dataset.edit));
    box.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => removeNews(b.dataset.delete));
  } catch (err) {
    console.error(err); box.innerHTML = '<div class="empty">Erro ao carregar a lista. Confira as regras do Firestore.</div>';
  }
}
async function editNews(id) {
  try {
    const s = await getDoc(doc(db, "noticias", id)); if (!s.exists()) return;
    const x = s.data();
    if (!activeAdmin() && x.authorId !== currentUser?.uid) return message(adminMsg, "Você só pode editar notícias publicadas por você.", "error");
    $("#news-id").value = id; $("#title").value = x.title || x.titulo || "";
    $("#summary").value = x.summary || x.resumo || ""; content.innerHTML = x.content || x.conteudo || "";
    $("#category").value = x.category || x.categoria || "Cidade"; $("#imageUrl").value = x.imageUrl || x.imagem || "";
    $("#imageCaption").value = x.imageCaption || x.legendaImagem || ""; $("#videoUrl").value = x.videoUrl || "";
    $("#featured").checked = !!(x.isFeatured || x.destaque);
    form.scrollIntoView({ behavior: "smooth" }); message(adminMsg, "Editando conteúdo. Ao salvar, as alterações serão publicadas.", "success");
  } catch (err) { console.error(err); message(adminMsg, "Não foi possível abrir para edição.", "error"); }
}
async function removeNews(id) {
  if (!confirm("Tem certeza de que deseja excluir este conteúdo?")) return;
  try {
    const s = await getDoc(doc(db, "noticias", id));
    if (!s.exists()) return;
    if (!activeAdmin() && s.data().authorId !== currentUser?.uid) return message(adminMsg, "Você só pode excluir notícias publicadas por você.", "error");
    await deleteDoc(doc(db, "noticias", id)); message(adminMsg, "Conteúdo excluído.", "success"); await loadAdminNews();
  } catch (err) { console.error(err); message(adminMsg, "Não foi possível excluir. Confira as regras do Firestore.", "error"); }
}
$("#refresh").addEventListener("click", loadAdminNews);
