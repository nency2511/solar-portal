/* =========================
   Solar Portal (LocalStorage Demo) — UPDATED
   ✅ Admin: Daily summary (Monthly/Yearly) + Graph + Download
   ✅ Admin: Last 10 days (Table/Graph)
   ✅ Maintenance: Submit to Google Form (Sheet backend)
   ✅ Maintenance: Fetch from Sheet via API (optional) + fallback LS
   ✅ Photos: LocalStorage (as-is)
   ✅ LOGIN: Users now fetched from Google Sheet (Apps Script API)
========================= */

// ✅ Google Sheet Users API (Apps Script Web App)
const USERS_API_URL =
  "https://script.google.com/macros/s/AKfycbwZOhQDaa35qA1ul5OdnKUpzJzllH_IpE2QBA9ZunCkU9CPHBOG3qHr9kT6YJZ8nOap/exec";

// ✅ GEN API (you already have)
const GEN_API_URL =
  "https://script.google.com/macros/s/AKfycbyiaL1GeXhcafI1yNta3Ckue1Y-RDyEzBP7nFcFw-lok8RZQzAzosaGgUro-ppXCwab/exec";

/*
✅ IMPORTANT (NEW):
Maintenance logs fetch ke liye aapko bhi ek Apps Script JSON API chahiye (GEN jaisa).
Jab aap banake doge, yaha paste kar dena.

Example:
const MNT_API_URL = "https://script.google.com/macros/s/AKfycbxxxx/exec";
*/
const MNT_API_URL =
  "https://script.google.com/macros/s/AKfycbx1gXmBGZZanCvVMsrEI5KAYn6sdscMwjz4i44O8A6Qf5O5NvmJxk6nHUA5-VEWspQGNQ/exec";
 // <-- paste maintenance sheet API here (optional)

const PHOTO_WEBHOOK_URL = "https://fsgdme.app.n8n.cloud/webhook/83c53409-1837-4ae3-8952-c2f1a036f8fd";
const PHOTO_API_URL =
  "https://script.google.com/macros/s/AKfycbyb7BW0xLN2siAcbm7E0IiHe1dc02km0QZ3FgQWzsLmEzeAc6ce0LkaODPYafajmEAN/exec";

 
const LS_KEYS = {
  USERS: "sp_users",
  ADMIN: "sp_admin",
  SESSION: "sp_session",
  GEN: "sp_generation_entries",
  MNT: "sp_maintenance_entries",
  PHO: "sp_photo_entries",
};

const ADMIN_STATIC = { email: "admin@solar.com", password: "Admin@1234", name: "Solar Admin" };

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function safeJSONParse(v, fallback) {
  try { return JSON.parse(v) ?? fallback; } catch { return fallback; }
}
function lsGet(key, fallback) { return safeJSONParse(localStorage.getItem(key), fallback); }
function lsSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function pad2(n) { return String(n).padStart(2, "0"); }

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return {
    isoDate: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}:${ss}`,
    display: `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  };
}

/* =========================
   ✅ SEED
========================= */
function seedIfNeeded() {
  const admin = lsGet(LS_KEYS.ADMIN, null);
  if (!admin) lsSet(LS_KEYS.ADMIN, ADMIN_STATIC);

  if (!localStorage.getItem(LS_KEYS.GEN)) lsSet(LS_KEYS.GEN, []);
  if (!localStorage.getItem(LS_KEYS.MNT)) lsSet(LS_KEYS.MNT, []);
  if (!localStorage.getItem(LS_KEYS.PHO)) lsSet(LS_KEYS.PHO, []);
}

function setSession(sess) { lsSet(LS_KEYS.SESSION, sess); }
function getSession() { return lsGet(LS_KEYS.SESSION, null); }
function clearSession() { localStorage.removeItem(LS_KEYS.SESSION); }

function requireRole(role) {
  const sess = getSession();
  if (!sess || sess.role !== role) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

function toastOk(title, text) {
  if (window.Swal) {
    Swal.fire({ icon: "success", title, text, timer: 1400, showConfirmButton: false });
  } else alert(`${title}\n${text}`);
}
function toastErr(title, text) {
  if (window.Swal) {
    Swal.fire({ icon: "error", title, text });
  } else alert(`${title}\n${text}`);
}

function fmtUnits(n) {
  const num = Number(n || 0);
  return (Math.round(num * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cryptoId() { return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16); }
function escapeAttr(str) { return String(str).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* =========================
   ✅ ONE UNIVERSAL GOOGLE FORM POST HELPER (ONLY ONCE)
========================= */
function postToGoogleForm(url, payloadObj) {
  const iframeName = "hidden_iframe_mnt";

  // create iframe once
  let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }

  // create form
  const form = document.createElement("form");
  form.action = url;              // ✅ MUST be .../formResponse
  form.method = "POST";
  form.target = iframeName;

  Object.entries(payloadObj || {}).forEach(([k, v]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v == null ? "" : String(v);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}



/* =========================
   PAGINATION + FILTER HELPERS
========================= */
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function paginate(list, page, perPage) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = clamp(page, 1, totalPages);
  const start = (p - 1) * perPage;
  const items = list.slice(start, start + perPage);
  return { items, page: p, total, totalPages };
}

function withinDateRange(isoDate, from, to) {
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

function normalizeRange(from, to) {
  const f = from || "";
  const t = to || "";
  if (f && !t) return { from: f, to: f };
  if (!f && t) return { from: t, to: t };
  return { from: f, to: t };
}

function bindAutoDateFilter({ fromSel, toSel, stateObj, onChange }) {
  const fromEl = $(fromSel);
  const toEl = $(toSel);
  if (!fromEl || !toEl) return;

  const fire = () => {
    const nr = normalizeRange(fromEl.value || "", toEl.value || "");
    stateObj.from = nr.from;
    stateObj.to = nr.to;
    stateObj.page = 1;
    onChange?.();
  };

  fromEl.addEventListener("change", fire);
  toEl.addEventListener("change", fire);
}

/* =========================
   ✅ LAST 15 DAYS FIXED WINDOW HELPERS
========================= */
function addDaysISO(isoDate, addDays) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + addDays);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function buildDateList(fromISO, toISO) {
  const out = [];
  if (!fromISO || !toISO) return out;

  let cur = fromISO;
  while (cur <= toISO) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
    if (out.length > 400) break;
  }
  return out;
}

function bindAutoFixedWindowFilter({ fromSel, toSel, stateObj, days, onChange }) {
  const fromEl = $(fromSel);
  const toEl = $(toSel);
  if (!fromEl || !toEl) return;

  const fire = () => {
    const f = fromEl.value || "";
    if (!f) {
      stateObj.from = "";
      stateObj.to = "";
      toEl.value = "";
      onChange?.();
      return;
    }

    const t = addDaysISO(f, (days || 15) - 1);
    stateObj.from = f;
    stateObj.to = t;

    toEl.value = t;
    toEl.min = f;
    toEl.max = t;

    onChange?.();
  };

  fromEl.addEventListener("change", fire);
}

/* =========================
   ✅ GOOGLE SHEET LOGIN HELPERS
========================= */
async function fetchUsersFromSheet() {
  const res = await fetch(USERS_API_URL, { method: "GET" });
  if (!res.ok) throw new Error("Users API failed: " + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function getUsersForLogin() {
  try {
    const users = await fetchUsersFromSheet();
    const list = users.map(u => ({
      id: String(u.userId || "").trim(),
      name: String(u.name || "").trim(),
      password: String(u.password || "").trim(),
    })).filter(u => u.id && u.password);

    if (list.length) lsSet(LS_KEYS.USERS, list);
    return list;
  } catch (err) {
    console.error(err);
    return lsGet(LS_KEYS.USERS, []);
  }
}

/* =========================
   LOGIN PAGE
========================= */
async function initLoginPage() {
  seedIfNeeded();

  const tabUser = $("#tabUser");
  const tabAdmin = $("#tabAdmin");
  const userForm = $("#userLoginForm");
  const adminForm = $("#adminLoginForm");
  const demoUsersWrap = $("#demoUsers");

  const sess = getSession();
  if (sess?.role === "user") window.location.href = "user.html";
  if (sess?.role === "admin") window.location.href = "admin.html";

  tabUser?.addEventListener("click", () => {
    tabUser.classList.add("active");
    tabAdmin.classList.remove("active");
    userForm.classList.remove("hidden");
    adminForm.classList.add("hidden");
  });

  tabAdmin?.addEventListener("click", () => {
    tabAdmin.classList.add("active");
    tabUser.classList.remove("active");
    adminForm.classList.remove("hidden");
    userForm.classList.add("hidden");
  });

  const users = await getUsersForLogin();
  if (Array.isArray(users) && users.length) lsSet(LS_KEYS.USERS, users);

  if (demoUsersWrap) {
    if (!users.length) {
      demoUsersWrap.innerHTML = `<div class="muted">No users loaded (Sheet API not reachable).</div>`;
    } else {
      demoUsersWrap.innerHTML = users.map(u => `
        <div class="demoUser">
          <div>
            <b>${u.name}</b><br/>
            <span>ID: ${u.id}</span>
          </div>
          <div><span>${u.password}</span></div>
        </div>
      `).join("");
    }
  }

  userForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const uid = $("#userId").value.trim();
    const upass = $("#userPass").value.trim();

    const u = users.find(x => x.id === uid && x.password === upass);
    if (!u) return toastErr("Login failed", "Invalid User ID or Password.");

    setSession({ role: "user", userId: u.id, loginAt: Date.now() });
    localStorage.setItem("sp_current_user", JSON.stringify(u));

    toastOk("Welcome!", `Hello ${u.name}`);
    setTimeout(() => window.location.href = "user.html", 350);
  });

  adminForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#adminEmail").value.trim();
    const pass = $("#adminPass").value.trim();
    const admin = lsGet(LS_KEYS.ADMIN, ADMIN_STATIC);

    if (email !== admin.email || pass !== admin.password) {
      return toastErr("Login failed", "Invalid Admin credentials.");
    }

    setSession({ role: "admin", loginAt: Date.now() });
    toastOk("Welcome!", "Admin access granted.");
    setTimeout(() => window.location.href = "admin.html", 350);
  });
}

/* =========================
   USER PAGE
========================= */
const userViewState = {
  gen: { from: "", to: "", page: 1, perPage: 8 },
  mnt: { from: "", to: "", page: 1, perPage: 8 },
  pho: { from: "", to: "", page: 1, perPage: 6 },
};

function initUserPage() {
  seedIfNeeded();
  if (!requireRole("user")) return;

  const sess = getSession();
  const users = lsGet(LS_KEYS.USERS, []);
  const me = users.find(u => u.id === sess.userId);
  if (!me) {
    clearSession();
    window.location.href = "index.html";
    return;
  }

  $("#userGreeting") && ($("#userGreeting").textContent = `Hi, ${me.name} 👋`);
  $("#profileName") && ($("#profileName").textContent = me.name);
  $("#avatarLetter") && ($("#avatarLetter").textContent = (me.name?.[0] || "U").toUpperCase());

  const profileBtn = $("#profileBtn");
  const profileMenu = $("#profileMenu");
  profileBtn?.addEventListener("click", () => profileMenu.classList.toggle("hidden"));
  document.addEventListener("click", (e) => {
    if (!profileBtn?.contains(e.target) && !profileMenu?.contains(e.target)) {
      profileMenu?.classList.add("hidden");
    }
  });

  $("#logoutBtn")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });

  $all(".navBtn").forEach(btn => {
   btn.addEventListener("click", () => {
  $all(".navBtn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const sec = btn.dataset.section;
  $all(".panel").forEach(p => p.classList.remove("show"));
  $("#sec-" + sec)?.classList.add("show");

  fillUserDatesOnly();

  // ✅ refresh on open
  if (sec === "pho") renderUserPhotos(me.id);
  if (sec === "gen" || sec === "mnt") renderUserTables(me.id);
});

  });

  function fillUserDatesOnly() {
    const t = nowStamp();
    $("#genDate") && ($("#genDate").value = t.isoDate);
    $("#mntDate") && ($("#mntDate").value = t.isoDate);
    $("#photoDate") && ($("#photoDate").value = t.isoDate);
  }
  fillUserDatesOnly();

  const breakdownSel = $("#breakdownYes");
  const breakBox = $("#breakBox");
  function toggleBreak() {
    const val = breakdownSel?.value;
    if (!breakBox) return;
    if (val === "Yes") {
      breakBox.classList.remove("hidden");
    } else {
      breakBox.classList.add("hidden");
      $("#breakHours") && ($("#breakHours").value = "");
      $("#breakFrom") && ($("#breakFrom").value = "");
      $("#breakTo") && ($("#breakTo").value = "");
      $("#breakReason") && ($("#breakReason").value = "");
    }
  }
  breakdownSel?.addEventListener("change", toggleBreak);
  toggleBreak();

  /* =========================
     ✅ GEN SUBMIT (Google Form)
  ========================= */
  const GEN_FORM_BASE =
    "https://docs.google.com/forms/d/e/1FAIpQLSfOJ61at9CSII4oWE4wGHdUafpYMPChrmkK8385-vqAiozw1Q/formResponse";

  const GEN_ENTRY_USER_ID = "entry.1974299693";
  const GEN_ENTRY_DATE    = "entry.2137798723";
  const GEN_ENTRY_ASH     = "entry.614917472";
  const GEN_ENTRY_DAR     = "entry.728178038";

  $("#genForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sess = getSession();
    const loggedUserId = sess?.userId || "";
    const date = $("#genDate")?.value || nowStamp().isoDate;

    const ash = $("#genUnitsAshiyana").value.trim();
    const dar = $("#genUnitsDarpan").value.trim();

    const ashOk = ash !== "" && Number(ash) >= 0;
    const darOk = dar !== "" && Number(dar) >= 0;

    if (!loggedUserId) return toastErr("Session missing", "Please login again.");
    if (!ashOk && !darOk) return toastErr("Invalid units", "Enter Ashiyana or Darpan units (or both).");

    const payload = {};
    payload[GEN_ENTRY_USER_ID] = loggedUserId;
    payload[GEN_ENTRY_DATE] = date;
    payload[GEN_ENTRY_ASH] = ashOk ? ash : "";
    payload[GEN_ENTRY_DAR] = darOk ? dar : "";

    try {
      await postToGoogleForm(GEN_FORM_BASE, payload);

      $("#genUnitsAshiyana").value = "";
      $("#genUnitsDarpan").value = "";

      toastOk("Submitted!", "Saved to Google Sheet successfully.");

      // small delay then refresh
      setTimeout(() => renderUserTables(me.id), 1200);
    } catch (err) {
      console.error(err);
      toastErr("Failed", "Could not submit. Please try again.");
    }
  });

  /* =========================
     ✅ MAINTENANCE SUBMIT (Google Form)
     ✅ viewform -> formResponse (sir wala change)
     ✅ + userId entry added
  ========================= */
  const MNT_FORM_BASE =
    "https://docs.google.com/forms/d/e/1FAIpQLScoTlpED27u8V2QmCoS97YLLuiYeGdlxe0dSTEVqFTdWUVZ0w/formResponse";

  const MNT_ENTRY_DATE        = "entry.2055755283";
  const MNT_ENTRY_PLANT       = "entry.1535385882";
  const MNT_ENTRY_OM          = "entry.428958107";
  const MNT_ENTRY_SECURITY    = "entry.1530388072";
  const MNT_ENTRY_CLEANING    = "entry.115155756";
  const MNT_ENTRY_BREAKDOWN   = "entry.357119222";
  const MNT_ENTRY_BREAKHRS    = "entry.1039751489";
  const MNT_ENTRY_BREAKFROM   = "entry.30921687";
  const MNT_ENTRY_BREAKTO     = "entry.848833855";
  const MNT_ENTRY_BREAKREASON = "entry.159566579";
  const MNT_ENTRY_USERID      = "entry.1447036759"; // ✅ NEW: userid

  $("#mntForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = nowStamp();

    const sess = getSession();
    const loggedUserId = sess?.userId || "";
    if (!loggedUserId) return toastErr("Session missing", "Please login again.");

    const date = $("#mntDate")?.value || t.isoDate;

    const plant = ($("#mntPlant")?.value || "").trim();
    const om = ($("#omStaff")?.value || "").trim();
    const sec = ($("#securityCount")?.value || "").trim();
    const cleaning = ($("#cleaningHours")?.value || "").trim();
    const breakdown = ($("#breakdownYes")?.value || "No").trim();

    if (!plant) return toastErr("Invalid", "Please select Plant.");

    const omOk = om !== "" && Number(om) >= 0;
    const secOk = sec !== "" && Number(sec) >= 0;
    const cleaningOk = cleaning !== "" && Number(cleaning) >= 0;

    if (!omOk) return toastErr("Invalid", "Enter valid O&M staff count.");
    if (!secOk) return toastErr("Invalid", "Enter valid security count.");
    if (!cleaningOk) return toastErr("Invalid", "Enter valid cleaning hours.");

    let breakHrs = "";
    let breakFrom = "";
    let breakTo = "";
    let breakReason = "";

    if (breakdown === "Yes") {
      breakHrs = ($("#breakHours")?.value || "").trim();
      breakFrom = ($("#breakFrom")?.value || "").trim();
      breakTo = ($("#breakTo")?.value || "").trim();
      breakReason = ($("#breakReason")?.value || "").trim();

      if (breakHrs !== "" && Number(breakHrs) < 0) {
        return toastErr("Invalid", "Break hours cannot be negative.");
      }
    }

    const payload = {};
    payload[MNT_ENTRY_DATE] = date;
    payload[MNT_ENTRY_PLANT] = plant;
    payload[MNT_ENTRY_OM] = om;
    payload[MNT_ENTRY_SECURITY] = sec;
    payload[MNT_ENTRY_CLEANING] = cleaning;
    payload[MNT_ENTRY_BREAKDOWN] = breakdown;

    payload[MNT_ENTRY_BREAKHRS] = breakdown === "Yes" ? (breakHrs || "0") : "";
    payload[MNT_ENTRY_BREAKFROM] = breakdown === "Yes" ? breakFrom : "";
    payload[MNT_ENTRY_BREAKTO] = breakdown === "Yes" ? breakTo : "";
    payload[MNT_ENTRY_BREAKREASON] = breakdown === "Yes" ? breakReason : "";

    // ✅ NEW: userId send to sheet
    payload[MNT_ENTRY_USERID] = loggedUserId;

    try {
    postToGoogleForm(MNT_FORM_BASE, payload);


      $("#omStaff").value = "";
      $("#securityCount").value = "";
      $("#cleaningHours").value = "1";
      $("#breakdownYes").value = "No";

      toggleBreak?.();
      fillUserDatesOnly?.();

      userViewState.mnt.page = 1;

      toastOk("Submitted!", "Maintenance saved to Google Sheet successfully.");

      // ✅ small delay then refresh
      setTimeout(() => renderUserTables(me.id), 1200);
    } catch (err) {
      console.error(err);
      toastErr("Failed", "Could not submit maintenance. Please try again.");
    }
  });

  /* =========================
     PHOTO UPLOAD (LOCALSTORAGE AS-IS)
  ========================= */
  const photoFile = $("#photoFile");
  const imgPreviewWrap = $("#imgPreviewWrap");
  const imgPreview = $("#imgPreview");

  photoFile?.addEventListener("change", async () => {
    const files = photoFile.files ? Array.from(photoFile.files) : [];
    if (!files.length) {
      imgPreviewWrap?.classList.add("hidden");
      return;
    }
    const b64 = await toBase64(files[0]);
    imgPreview.src = b64;
    imgPreviewWrap?.classList.remove("hidden");
  });

 $("#photoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const t = nowStamp();
  const sess = getSession();
  const loggedUserId = sess?.userId || "";
  if (!loggedUserId) return toastErr("Session missing", "Please login again.");

  const period = $("#photoPeriod").value;
  const plant = document.querySelector('input[name="plantPhoto"]:checked')?.value || "Ashiana";

  const photoFile = $("#photoFile");
  const files = photoFile?.files ? Array.from(photoFile.files) : [];
  if (!files.length) return toastErr("No file", "Please choose image(s).");

  try {
    const fd = new FormData();

    // ✅ metadata fields
    fd.append("userId", loggedUserId);
    fd.append("userName", ($("#profileName")?.textContent || "").trim());
    fd.append("date", $("#photoDate")?.value || t.isoDate);
    fd.append("period", period);
    fd.append("plant", plant);

    // ✅ IMPORTANT: key name must match n8n "Field Name for Binary Data" = photos
    for (const f of files) {
      fd.append("photos", f, f.name);
    }

    const res = await fetch(PHOTO_WEBHOOK_URL, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed: ${res.status} ${text}`);
    }

    // success
    $("#photoPeriod").value = "Daily";
    photoFile.value = "";
    $("#imgPreviewWrap")?.classList.add("hidden");

    toastOk("Uploaded!", "Photos sent to n8n successfully.");
  } catch (err) {
    console.error(err);
    toastErr("Failed", "Could not upload photos. Please try again.");
  }
});


  bindAutoDateFilter({ fromSel: "#genFrom", toSel: "#genTo", stateObj: userViewState.gen, onChange: () => renderUserTables(me.id) });
  bindAutoDateFilter({ fromSel: "#mntFrom", toSel: "#mntTo", stateObj: userViewState.mnt, onChange: () => renderUserTables(me.id) });
  bindAutoDateFilter({ fromSel: "#phoFrom", toSel: "#phoTo", stateObj: userViewState.pho, onChange: () => renderUserPhotos(me.id) });

  $("#genPrev")?.addEventListener("click", () => { userViewState.gen.page = Math.max(1, userViewState.gen.page - 1); renderUserTables(me.id); });
  $("#genNext")?.addEventListener("click", () => { userViewState.gen.page += 1; renderUserTables(me.id); });
  $("#mntPrev")?.addEventListener("click", () => { userViewState.mnt.page = Math.max(1, userViewState.mnt.page - 1); renderUserTables(me.id); });
  $("#mntNext")?.addEventListener("click", () => { userViewState.mnt.page += 1; renderUserTables(me.id); });
  $("#phoPrev")?.addEventListener("click", () => { userViewState.pho.page = Math.max(1, userViewState.pho.page - 1); renderUserPhotos(me.id); });
  $("#phoNext")?.addEventListener("click", () => { userViewState.pho.page += 1; renderUserPhotos(me.id); });

  initImageModal();
  renderUserTables(me.id);
  renderUserPhotos(me.id);
}

/* =========================
   USER: TABLES (GEN from API, MNT from API optional)
========================= */
async function renderUserTables(userId) {
  /* ---------- GEN ---------- */
  const gState = userViewState.gen;

  let genAll = [];
  try {
    const res = await fetch(GEN_API_URL);
    const raw = await res.json();

    const uid = String(userId || "").trim();

    const pick = (obj, keyName) => {
      const k = Object.keys(obj || {}).find(k => k.trim() === keyName.trim());
      return k ? obj[k] : "";
    };

    const rows = Array.isArray(raw) ? raw : [];

    const filtered = rows
      .filter(r => String(pick(r, "User ID")).trim() === uid || String(pick(r, "  User ID  ")).trim() === uid)
      .filter(r => {
        const d = String(pick(r, "Date") || "").trim();
        return d && withinDateRange(d, gState.from, gState.to);
      });

    genAll = [];
    for (const r of filtered) {
      const isoDate = String(pick(r, "Date") || "").trim();

      const ashRaw = pick(r, "Ashiana Generation Units (kWh)");
      const darRaw = pick(r, "Darpan Generation Units (kWh)");

      const ash = ashRaw === "" ? "" : Number(ashRaw);
      const dar = darRaw === "" ? "" : Number(darRaw);

      const ts = new Date(pick(r, "Timestamp")).getTime() || 0;

      if (ashRaw !== "" && !Number.isNaN(ash)) genAll.push({ isoDate, plant: "Aashiana ", units: ash, ts });
      if (darRaw !== "" && !Number.isNaN(dar)) genAll.push({ isoDate, plant: "Darpan", units: dar, ts });
    }

    genAll.sort((a, b) => (b.ts || 0) - (a.ts || 0));


    // ✅ Auto-fill Gen date filters (From = earliest entry, To = today) — only once
const fromEl = $("#genFrom");
const toEl = $("#genTo");

if (!gState.from && !gState.to) {
  const today = nowStamp().isoDate;

  // earliest date from all user entries
  const minDate = genAll.length
    ? genAll.reduce((min, r) => (r.isoDate < min ? r.isoDate : min), genAll[0].isoDate)
    : today;

  gState.from = minDate;
  gState.to = today;

  if (fromEl) fromEl.value = minDate;
  if (toEl) toEl.value = today;
}

  } catch (err) {
    console.error("GEN fetch failed:", err);
    genAll = [];
  }

  const genPaged = paginate(genAll, gState.page, gState.perPage);
  userViewState.gen.page = genPaged.page;

  const genBody = $("#userGenTable tbody");
  if (genBody) {
    genBody.innerHTML =
      genPaged.items.map(r => `
        <tr>
          <td>${r.isoDate}</td>
          <td>${r.plant}</td>
          <td class="right">${fmtUnits(r.units)}</td>
        </tr>
      `).join("") || `<tr><td colspan="3" class="muted">No entries yet.</td></tr>`;
  }

  $("#genPageInfo") && ($("#genPageInfo").textContent =
    `Page ${genPaged.page} / ${genPaged.totalPages} • ${genPaged.total} items`);
  $("#genPrev") && ($("#genPrev").disabled = genPaged.page <= 1);
  $("#genNext") && ($("#genNext").disabled = genPaged.page >= genPaged.totalPages);

  /* ---------- MNT ---------- */
  const mState = userViewState.mnt;
  let mntAll = [];

  // ✅ your JSON uses these exact keys:
  // "Date", "Select Plant", "O&M Staff Present (count)", "Security Present (count)",
  // "Cleaning Hours", "Breakdown?", "Breakdown Hours", "Breakdown Time Range -from",
  // "Breakdown Time Range -to", "Breakdown Reason", "User Id", "Timestamp"

  if (MNT_API_URL) {
    try {
      const res = await fetch(MNT_API_URL);
      const rows = await res.json();

      const uid = String(userId || "").trim();
      const isValidISO = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "").trim());

      mntAll = (Array.isArray(rows) ? rows : [])
        // ✅ remove header/test/junk rows
        .filter(r => isValidISO(r["Date"]))
        // ✅ only logged-in user rows
        .filter(r => String(r["User Id"] || "").trim() === uid)
        // ✅ date filter
        .filter(r => withinDateRange(String(r["Date"]).trim(), mState.from, mState.to))
        // ✅ normalize to our internal structure
        .map(r => ({
          isoDate: String(r["Date"]).trim(),
          plant: String(r["Select Plant"] || "").trim(),
          omStaff: String(r["O&M Staff Present (count)"] ?? "").trim(),
          securityCount: String(r["Security Present (count)"] ?? "").trim(),
          cleaningHours: String(r["Cleaning Hours"] ?? "").trim(),
          breakdown: String(r["Breakdown?"] || "").trim(),
          ts: new Date(r["Timestamp"]).getTime() || 0,
        }))
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
// ✅ Auto-fill Maintenance date filters (From = earliest log, To = today) — only once
const mFromEl = $("#mntFrom");
const mToEl = $("#mntTo");

if (!mState.from && !mState.to) {
  const today = nowStamp().isoDate;

  const minDate = mntAll.length
    ? mntAll.reduce((min, r) => (r.isoDate < min ? r.isoDate : min), mntAll[0].isoDate)
    : today;

  mState.from = minDate;
  mState.to = today;

  if (mFromEl) mFromEl.value = minDate;
  if (mToEl) mToEl.value = today;
}

    } catch (e) {
      console.error("MNT fetch failed:", e);
      mntAll = [];
    }
  } else {
    // fallback local (unchanged)
    mntAll = lsGet(LS_KEYS.MNT, [])
      .filter(x => x.userId === userId)
      .filter(x => withinDateRange(x.isoDate, mState.from, mState.to))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  const mntPaged = paginate(mntAll, mState.page, mState.perPage);
  userViewState.mnt.page = mntPaged.page;

  const mntBody = $("#userMntTable tbody");
  if (mntBody) {
    mntBody.innerHTML =
      mntPaged.items.map(r => `
        <tr>
          <td>${r.isoDate}</td>
          <td>${r.plant === "Ashiana" ? "Aashiana" : r.plant}</td>

          <td>${r.omStaff}</td>
          <td>${r.securityCount}</td>
          <td>${r.cleaningHours}</td>
          <td>${r.breakdown}${r.breakdown === "Yes" ? " ⚠️" : ""}</td>
        </tr>
      `).join("") || `<tr><td colspan="6" class="muted">No logs yet.</td></tr>`;
  }

  $("#mntPageInfo") && ($("#mntPageInfo").textContent =
    `Page ${mntPaged.page} / ${mntPaged.totalPages} • ${mntPaged.total} items`);
  $("#mntPrev") && ($("#mntPrev").disabled = mntPaged.page <= 1);
  $("#mntNext") && ($("#mntNext").disabled = mntPaged.page >= mntPaged.totalPages);
}

async function renderUserPhotos(userId) {
  const pState = userViewState.pho;

  let all = [];
  try {
    all = await fetchUserPhotosFromSheet(userId);
  } catch (e) {
    console.error("User PHOTO fetch failed:", e);
    all = [];
  }

  // ✅ Auto-fill Photo date filters (From = earliest photo date, To = today) — only once
  const pFromEl = $("#phoFrom");
  const pToEl = $("#phoTo");

  if (!pState.from && !pState.to) {
    const today = nowStamp().isoDate;

    const minDate = all.length
      ? all.reduce((min, r) => (r.isoDate < min ? r.isoDate : min), all[0].isoDate)
      : today;

    pState.from = minDate;
    pState.to = today;

    if (pFromEl) pFromEl.value = minDate;
    if (pToEl) pToEl.value = today;
  }

  // ✅ date filter
  const filtered = all.filter(r => withinDateRange(r.isoDate, pState.from, pState.to));

  // ✅ paginate
  const paged = paginate(filtered, pState.page, pState.perPage);
  userViewState.pho.page = paged.page;

  const grid = $("#userPhotoGrid");
  if (!grid) return;

  if (paged.total === 0) {
    grid.innerHTML = `<div class="muted">No photos uploaded yet.</div>`;
    $("#phoPageInfo") && ($("#phoPageInfo").textContent = `Page 1 / 1 • 0 items`);
    $("#phoPrev") && ($("#phoPrev").disabled = true);
    $("#phoNext") && ($("#phoNext").disabled = true);
    return;
  }

  grid.innerHTML = paged.items.map(p => `
    <div class="photoCard"
         data-img="${escapeAttr(p.imageUrl)}"
         data-meta="${escapeAttr(`${p.userName} • ${p.plant} • ${p.timestamp}`)}">
      <img src="${escapeAttr(p.imageUrl)}" alt="photo"/>
      <div class="photoMeta">
        <div class="t">${escapeAttr(p.period)} • ${escapeAttr(p.plant)}</div>
        <div class="s">${escapeAttr(p.userName)} • ${escapeAttr(p.timestamp)}</div>
      </div>
    </div>
  `).join("");

  bindPhotoCards(grid);

  $("#phoPageInfo") && ($("#phoPageInfo").textContent = `Page ${paged.page} / ${paged.totalPages} • ${paged.total} items`);
  $("#phoPrev") && ($("#phoPrev").disabled = paged.page <= 1);
  $("#phoNext") && ($("#phoNext").disabled = paged.page >= paged.totalPages);
}

/* =========================
   ADMIN PAGE — SUMMARY + FILTERS
========================= */
let summaryChartInstance = null;
let last10ChartInstance = null;

const adminState = {
  summary: {
    tab: "monthly",
    mode: "table"
  },
  last10: {
    mode: "table",
    from: "",
    to: "",
    days: 15
  },
  mnt: { from: "", to: "", page: 1, perPage: 10 },
  pho: { from: "", to: "", page: 1, perPage: 3 },
};

function initAdminPage() {
  seedIfNeeded();
  if (!requireRole("admin")) return;

 function bindAdminLogout() {
  const doLogout = () => {
    clearSession();
    window.location.href = "index.html";
  };

  $("#adminLogout")?.addEventListener("click", doLogout);      // sidebar (mobile)
  $("#adminLogoutTop")?.addEventListener("click", doLogout);   // top header (web)
}
  bindAdminLogout();

  $all(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".navBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const sec = btn.dataset.section;
      $all(".panel").forEach(p => p.classList.remove("show"));
      $("#sec-" + sec)?.classList.add("show");
    });
  });

  $all(".sumTabBtn").forEach(b => {
    b.addEventListener("click", () => {
      $all(".sumTabBtn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");

      adminState.summary.tab = b.dataset.sumtab;

      $all(".sumTabPanel").forEach(p => p.classList.remove("show"));
      $("#sumtab-" + adminState.summary.tab)?.classList.add("show");

      renderAdminDailyUnitsSummary();
    });
  });

  $("#sumViewTableBtn")?.addEventListener("click", () => {
    adminState.summary.mode = "table";
    setSummaryModeUI();
    renderAdminDailyUnitsSummary();
  });

  $("#sumViewGraphBtn")?.addEventListener("click", () => {
    adminState.summary.mode = "graph";
    setSummaryModeUI();
    renderAdminDailyUnitsSummary();
  });

  $("#downloadChartBtn")?.addEventListener("click", () => {
    if (!summaryChartInstance) return;
    const a = document.createElement("a");
    a.href = summaryChartInstance.toBase64Image();
    a.download = `solar_${adminState.summary.tab}_chart.png`;
    a.click();
  });

  $("#last10TableBtn")?.addEventListener("click", () => {
    adminState.last10.mode = "table";
    setLast10ModeUI();
    renderAdminLast10Days();
  });
  $("#last10GraphBtn")?.addEventListener("click", () => {
    adminState.last10.mode = "graph";
    setLast10ModeUI();
    renderAdminLast10Days();
  });

  bindAutoFixedWindowFilter({
    fromSel: "#last10FromAdmin",
    toSel: "#last10ToAdmin",
    stateObj: adminState.last10,
    days: adminState.last10.days,
    onChange: () => renderAdminLast10Days(),
  });

  (function setDefaultLast10Range() {
    const fromEl = $("#last10FromAdmin");
    const toEl = $("#last10ToAdmin");
    if (!fromEl || !toEl) return;

    const today = nowStamp().isoDate;
    const from = addDaysISO(today, -(adminState.last10.days - 1));
    const to = today;

    fromEl.value = from;
    toEl.value = to;

    adminState.last10.from = from;
    adminState.last10.to = to;

    toEl.min = from;
    toEl.max = to;
  })();

  bindAutoDateFilter({
    fromSel: "#mntFromAdmin",
    toSel: "#mntToAdmin",
    stateObj: adminState.mnt,
    onChange: () => renderAdminMaintenance(),
  });

  $("#mntPrevAdmin")?.addEventListener("click", () => {
    adminState.mnt.page = Math.max(1, adminState.mnt.page - 1);
    renderAdminMaintenance();
  });
  $("#mntNextAdmin")?.addEventListener("click", () => {
    adminState.mnt.page += 1;
    renderAdminMaintenance();
  });

  bindAutoDateFilter({
    fromSel: "#phoFromAdmin",
    toSel: "#phoToAdmin",
    stateObj: adminState.pho,
    onChange: () => renderAdminPhotos(),
  });

  $("#phoPrevAdmin")?.addEventListener("click", () => {
    adminState.pho.page = Math.max(1, adminState.pho.page - 1);
    renderAdminPhotos();
  });
  $("#phoNextAdmin")?.addEventListener("click", () => {
    adminState.pho.page += 1;
    renderAdminPhotos();
  });

  initImageModal();
  setSummaryModeUI();
  setLast10ModeUI();
  renderAdminDailyUnitsSummary();
  renderAdminLast10Days();
  renderAdminMaintenance();
  renderAdminPhotos();
}

/* ---------- Admin UI Mode helpers ---------- */
function setSummaryModeUI() {
  const isGraph = adminState.summary.mode === "graph";
  $("#sumViewTableBtn")?.classList.toggle("active", !isGraph);
  $("#sumViewGraphBtn")?.classList.toggle("active", isGraph);

  $("#downloadChartBtn")?.classList.toggle("hidden", !isGraph);
  $("#sumGraphWrap")?.classList.toggle("hidden", !isGraph);

  $("#sumMonthlyTableWrap")?.classList.toggle("hidden", isGraph);
  $("#sumYearlyTableWrap")?.classList.toggle("hidden", isGraph);
}

function setLast10ModeUI() {
  const isGraph = adminState.last10.mode === "graph";
  $("#last10TableBtn")?.classList.toggle("active", !isGraph);
  $("#last10GraphBtn")?.classList.toggle("active", isGraph);
  $("#last10TableWrap")?.classList.toggle("hidden", isGraph);
  $("#last10GraphWrap")?.classList.toggle("hidden", !isGraph);
}

/* =========================
   DATA HELPERS (GEN)
========================= */
async function getAllGenRows() {
  const res = await fetch(GEN_API_URL);
  if (!res.ok) throw new Error("GEN API failed: " + res.status);

  const raw = await res.json();
  const rows = Array.isArray(raw) ? raw : [];

  const pick = (obj, keyName) => {
    const k = Object.keys(obj || {}).find(k => String(k).trim() === String(keyName).trim());
    return k ? obj[k] : "";
  };

  const out = [];

  for (const r of rows) {
    const isoDate = String(pick(r, "Date") || "").trim();
    if (!isoDate) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;

    const ashRaw = pick(r, "Ashiana Generation Units (kWh)");
    const darRaw = pick(r, "Darpan Generation Units (kWh)");

    const ash = ashRaw === "" ? NaN : Number(ashRaw);
    const dar = darRaw === "" ? NaN : Number(darRaw);

    const ts = new Date(pick(r, "Timestamp")).getTime() || 0;
    const userId = String(pick(r, "User ID") || pick(r, "  User ID  ") || "").trim();

    if (ashRaw !== "" && !Number.isNaN(ash)) out.push({ isoDate, plant: "Ashiyana", units: ash, ts, userId });
    if (darRaw !== "" && !Number.isNaN(dar)) out.push({ isoDate, plant: "Darpan", units: dar, ts, userId });
  }

  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

function groupByDate(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.isoDate)) map.set(r.isoDate, { Ashiyana: 0, Darpan: 0 });
    const obj = map.get(r.isoDate);
    obj[r.plant] = (obj[r.plant] || 0) + Number(r.units || 0);
  }
  return map;
}

function getLastNDates(n) {
  const dates = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    const yyyy = x.getFullYear();
    const mm = pad2(x.getMonth() + 1);
    const dd = pad2(x.getDate());
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

function fmtShortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(dt);
}

/* =========================
   ADMIN: DAILY UNITS SUMMARY
========================= */
async function renderAdminDailyUnitsSummary() {
  let rows = [];
  try {
    rows = await getAllGenRows();
  } catch (e) {
    console.error(e);
    rows = [];
  }

  renderAdminPeriodTotals(rows);
  renderAdminMonthlyTableCurrentYear(rows);
  renderAdminYearlyTable(rows);

  if (adminState.summary.mode === "graph") {
    renderSummaryChartForTab(rows);
  }
}

function renderAdminPeriodTotals(rows) {
  const today = nowStamp().isoDate;
  const y = today.slice(0, 4);
  const ym = today.slice(0, 7);

  const sum = (filterFn, plant) =>
    rows.filter(r => filterFn(r) && r.plant === plant).reduce((s, r) => s + Number(r.units || 0), 0);

  const tA = sum(r => r.isoDate === today, "Ashiyana");
  const tD = sum(r => r.isoDate === today, "Darpan");

  const mA = sum(r => r.isoDate.startsWith(ym), "Ashiyana");
  const mD = sum(r => r.isoDate.startsWith(ym), "Darpan");

  const yA = sum(r => r.isoDate.startsWith(y + "-"), "Ashiyana");
  const yD = sum(r => r.isoDate.startsWith(y + "-"), "Darpan");

  const body = $("#adminPeriodTotalsBody");
  if (!body) return;

  const tr = (label, a, d) => `
    <tr>
      <td>${label}</td>
      <td class="right">${fmtUnits(a)}</td>
      <td class="right">${fmtUnits(d)}</td>
      <td class="right">${fmtUnits(a + d)}</td>
    </tr>
  `;

  body.innerHTML = [
    tr("Today", tA, tD),
    tr("This Month", mA, mD),
    tr("This Year", yA, yD),
  ].join("");
}

function renderAdminMonthlyTableCurrentYear(rows) {
  const tbody = $("#adminMonthlyBody");
  if (!tbody) return;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthMap = new Map();

  for (const r of rows) {
    if (!r.isoDate?.startsWith(curYear + "-")) continue;
    const mm = r.isoDate.slice(5, 7);
    if (!monthMap.has(mm)) monthMap.set(mm, { Ashiyana: 0, Darpan: 0 });
    const obj = monthMap.get(mm);
    obj[r.plant] = (obj[r.plant] || 0) + Number(r.units || 0);
  }

  const months = [];
  for (let m = 1; m <= curMonth; m++) months.push(pad2(m));

  let grandA = 0, grandD = 0;

  tbody.innerHTML =
    months.map(mm => {
      const a = monthMap.get(mm)?.Ashiyana || 0;
      const d = monthMap.get(mm)?.Darpan || 0;
      grandA += a; grandD += d;

      return `
        <tr>
          <td>${monthNames[Number(mm) - 1]}-${String(curYear).slice(2)}</td>
          <td class="right">${fmtUnits(a)}</td>
          <td class="right">${fmtUnits(d)}</td>
          <td class="right">${fmtUnits(a + d)}</td>
        </tr>
      `;
    }).join("") +
    `
      <tr class="totRow">
        <td><b>Total</b></td>
        <td class="right"><b>${fmtUnits(grandA)}</b></td>
        <td class="right"><b>${fmtUnits(grandD)}</b></td>
        <td class="right"><b>${fmtUnits(grandA + grandD)}</b></td>
      </tr>
    `;
}

function renderAdminYearlyTable(rows) {
  const map = new Map();
  for (const r of rows) {
    const yr = r.isoDate.slice(0, 4);
    if (!map.has(yr)) map.set(yr, { Ashiyana: 0, Darpan: 0 });
    map.get(yr)[r.plant] = (map.get(yr)[r.plant] || 0) + Number(r.units || 0);
  }

  const years = Array.from(map.keys()).sort((a, b) => Number(b) - Number(a)).slice(0, 8);
  const body = $("#adminYearlyBody");
  if (!body) return;

  body.innerHTML = years.map(y => {
    const obj = map.get(y) || { Ashiyana: 0, Darpan: 0 };
    const a = obj.Ashiyana || 0;
    const d = obj.Darpan || 0;
    return `
      <tr>
        <td>${y}</td>
        <td class="right">${fmtUnits(a)}</td>
        <td class="right">${fmtUnits(d)}</td>
        <td class="right">${fmtUnits(a + d)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="4" class="muted">No data yet.</td></tr>`;
}

function renderSummaryChartForTab(rows) {
  const tab = adminState.summary.tab;

  let labels = [];
  let aData = [];
  let dData = [];

  if (tab === "monthly") {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const monthMap = new Map();
    for (const r of rows) {
      if (!r.isoDate?.startsWith(curYear + "-")) continue;
      const mm = r.isoDate.slice(5, 7);
      if (!monthMap.has(mm)) monthMap.set(mm, { Ashiyana: 0, Darpan: 0 });
      monthMap.get(mm)[r.plant] = (monthMap.get(mm)[r.plant] || 0) + Number(r.units || 0);
    }

    const months = [];
    for (let m = 1; m <= curMonth; m++) months.push(pad2(m));

    labels = months.map(mm => `${monthNames[Number(mm) - 1]}-${String(curYear).slice(2)}`);
    aData = months.map(mm => (monthMap.get(mm)?.Ashiyana || 0));
    dData = months.map(mm => (monthMap.get(mm)?.Darpan || 0));
  }

  if (tab === "yearly") {
    const map = new Map();
    for (const r of rows) {
      const yr = r.isoDate.slice(0, 4);
      if (!map.has(yr)) map.set(yr, { Ashiyana: 0, Darpan: 0 });
      map.get(yr)[r.plant] = (map.get(yr)[r.plant] || 0) + Number(r.units || 0);
    }
    labels = Array.from(map.keys()).sort((a, b) => Number(a) - Number(b)).slice(-8);
    aData = labels.map(y => (map.get(y)?.Ashiyana || 0));
    dData = labels.map(y => (map.get(y)?.Darpan || 0));
  }

  renderStackChart("#summaryChart", "summary", labels, aData, dData, `${tab.toUpperCase()} Units`);
}

/* =========================
   ADMIN: LAST 15 DAYS
========================= */
async function renderAdminLast10Days() {
  let rows = [];
  try {
    rows = await getAllGenRows();
  } catch (e) {
    console.error(e);
    rows = [];
  }

  const byDate = groupByDate(rows);

  let dates = [];
  if (adminState.last10.from && adminState.last10.to) {
    dates = buildDateList(adminState.last10.from, adminState.last10.to);
  } else {
    dates = getLastNDates(adminState.last10.days || 15).slice().reverse();
  }

  dates = dates.slice().sort((a, b) => b.localeCompare(a));

  const body = $("#adminLast10Body");
  if (body) {
    body.innerHTML = dates.map(dt => {
      const obj = byDate.get(dt) || { Ashiyana: 0, Darpan: 0 };
      const a = obj.Ashiyana || 0;
      const d = obj.Darpan || 0;
      return `
        <tr>
          <td>${fmtShortDate(dt)}</td>
          <td class="right">${fmtUnits(d)}</td>
          <td class="right">${fmtUnits(a)}</td>
          <td class="right">${fmtUnits(a + d)}</td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="4" class="muted">No data found.</td></tr>`;
  }

  if (adminState.last10.mode === "graph") {
    const labels = dates.map(fmtShortDate);
    const aData = dates.map(dt => (byDate.get(dt)?.Ashiyana || 0));
    const dData = dates.map(dt => (byDate.get(dt)?.Darpan || 0));
    renderStackChart("#last10Chart", "last10", labels, aData, dData, `Last ${dates.length} Days Units`);
  }
}

/* =========================
   CHART RENDERERS
========================= */
function renderStackChart(canvasSel, instanceKey, labels, aData, dData, title) {
  const canvas = $(canvasSel);
  if (!canvas || !window.Chart) return;

  let inst = (instanceKey === "summary") ? summaryChartInstance : last10ChartInstance;
  if (inst) { inst.destroy(); inst = null; }

  const ctx = canvas.getContext("2d");
  const newInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Aashiana", data: aData, backgroundColor: "rgba(37,199,199,.55)", borderColor: "rgba(37,199,199,.9)", borderWidth: 1, borderRadius: 6, stack: "stack1" },
        { label: "Darpan", data: dData, backgroundColor: "rgba(11,42,60,.50)", borderColor: "rgba(11,42,60,.85)", borderWidth: 1, borderRadius: 6, stack: "stack1" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title },
        tooltip: {
          callbacks: {
            footer: (items) => {
              const sum = items.reduce((s, it) => s + Number(it.raw || 0), 0);
              return `Total: ${fmtUnits(sum)}`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { color: "rgba(12,26,36,.08)" } }
      }
    }
  });

  if (instanceKey === "summary") summaryChartInstance = newInst;
  else last10ChartInstance = newInst;
}

/* =========================
   ADMIN: MAINTENANCE
   ✅ If MNT_API_URL exists => fetch sheet
   ✅ else fallback LS
========================= */
async function renderAdminMaintenance() {
  const state = adminState.mnt;

  // 1) Load ALL rows first (no date filter here)
  let allRows = [];

  if (MNT_API_URL) {
    try {
      const res = await fetch(MNT_API_URL);
      const rows = await res.json();

      const isValidISO = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "").trim());

      allRows = (Array.isArray(rows) ? rows : [])
        .filter(r => isValidISO(r["Date"]))
        .map(r => {
          const isoDate = String(r["Date"]).trim();
          const ts = new Date(r["Timestamp"]).getTime() || 0;

          return {
            isoDate,
            userId: String(r["User Id"] || "").trim(),
            userName: "", // optional
            plant: String(r["Select Plant"] || "").trim(),
            omStaff: String(r["O&M Staff Present (count)"] ?? "").trim(),
            securityCount: String(r["Security Present (count)"] ?? "").trim(),
            cleaningHours: String(r["Cleaning Hours"] ?? "").trim(),
            breakdown: String(r["Breakdown?"] || "").trim(),
            breakdownHours: String(r["Breakdown Hours"] ?? "").trim(),
            breakdownFrom: String(r["Breakdown Time Range -from"] ?? "").trim(),
            breakdownTo: String(r["Breakdown Time Range -to"] ?? "").trim(),
            breakdownReason: String(r["Breakdown Reason"] ?? "").trim(),
            ts
          };
        })
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));

    } catch (e) {
      console.error("Admin MNT fetch failed:", e);
      allRows = [];
    }
  } else {
    // fallback local
    allRows = (lsGet(LS_KEYS.MNT, []) || [])
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(x => ({
        isoDate: x.isoDate,
        userId: x.userId,
        userName: x.userName || "",
        plant: x.plant || "",
        omStaff: x.omStaff ?? "",
        securityCount: x.securityCount ?? "",
        cleaningHours: x.cleaningHours ?? "",
        breakdown: x.breakdown ?? "",
        breakdownHours: x.breakdownHours ?? "",
        breakdownFrom: x.breakdownFrom ?? "",
        breakdownTo: x.breakdownTo ?? "",
        breakdownReason: x.breakdownReason ?? "",
        ts: x.createdAt || 0
      }));
  }

  // 2) ✅ Set default From = earliest entry, To = today (ONLY ONCE)
  const fromEl = $("#mntFromAdmin");
  const toEl = $("#mntToAdmin");

  if (!state.from && !state.to) {
    const today = nowStamp().isoDate;

    const minDate = allRows.length
      ? allRows.reduce((min, r) => (r.isoDate < min ? r.isoDate : min), allRows[0].isoDate)
      : today;

    state.from = minDate;
    state.to = today;

    if (fromEl) fromEl.value = minDate;  // ✅ yyyy-mm-dd
    if (toEl) toEl.value = today;        // ✅ yyyy-mm-dd
  }

  // 3) Now apply date filter
  const filtered = allRows.filter(r => withinDateRange(r.isoDate, state.from, state.to));

  // 4) paginate + render
  const paged = paginate(filtered, state.page, state.perPage);
  adminState.mnt.page = paged.page;

  const body = $("#adminMntTable tbody");
  if (body) {
    body.innerHTML =
      paged.items.map(r => `
        <tr>
          <td>${r.isoDate}</td>
          <td>${r.userName || r.userId || ""}</td>
          <td>${r.plant === "Ashiana" ? "Aashiana" : r.plant}</td>
          <td class="right">${r.omStaff ?? ""}</td>
          <td class="right">${r.securityCount ?? ""}</td>
          <td class="right">${r.cleaningHours ?? ""}</td>
          <td>${r.breakdown || ""}</td>
          <td class="right">${r.breakdown === "Yes" ? (r.breakdownHours ?? "") : ""}</td>
          <td>${r.breakdown === "Yes" ? `${r.breakdownFrom || ""} - ${r.breakdownTo || ""}` : ""}</td>
          <td>${r.breakdown === "Yes" ? (r.breakdownReason || "") : ""}</td>
        </tr>
      `).join("") || `<tr><td colspan="10" class="muted">No maintenance logs found.</td></tr>`;
  }

  $("#adminMntCount") && ($("#adminMntCount").textContent = `${paged.total} rows`);
  $("#mntPageInfo") && ($("#mntPageInfo").textContent = `Page ${paged.page} / ${paged.totalPages} • ${paged.total} items`);
  $("#mntPrevAdmin") && ($("#mntPrevAdmin").disabled = paged.page <= 1);
  $("#mntNextAdmin") && ($("#mntNextAdmin").disabled = paged.page >= paged.totalPages);
}

/* =========================
   ADMIN: PHOTOS (local)
========================= */
async function renderAdminPhotos() {
  const state = adminState.pho;

  let all = [];
  try {
    all = await fetchAdminPhotosFromSheet();
  } catch (e) {
    console.error("Admin PHOTO fetch failed:", e);
    all = [];
  }

  // ✅ Auto-fill default range ONLY ONCE:
  // From = earliest photo date, To = today
  const fromEl = $("#phoFromAdmin");
  const toEl = $("#phoToAdmin");

  if (!state.from && !state.to) {
    const today = nowStamp().isoDate;

    const minDate = all.length
      ? all.reduce((min, r) => (r.isoDate < min ? r.isoDate : min), all[0].isoDate)
      : today;

    state.from = minDate;
    state.to = today;

    if (fromEl) fromEl.value = minDate;
    if (toEl) toEl.value = today;
  }

  // ✅ Apply date filter
  const filtered = all.filter(r => withinDateRange(r.isoDate, state.from, state.to));

  // ✅ paginate (3 per page already in your state)
  const paged = paginate(filtered, state.page, state.perPage);
  adminState.pho.page = paged.page;

  const grid = $("#adminPhotoGrid");
  if (!grid) return;

  if (paged.total === 0) {
    grid.innerHTML = `<div class="muted">No photos found.</div>`;
  } else {
    grid.innerHTML = paged.items.map(p => `
      <div class="photoCard" data-img="${escapeAttr(p.imageUrl)}" data-meta="${escapeAttr(photoMeta(p))}">
        <img src="${escapeAttr(p.imageUrl)}" alt="photo"/>
        <div class="photoMeta">
          <div class="t">${escapeAttr(p.plant)}</div>
          <div class="s">${escapeAttr(p.userName)} • ${escapeAttr(p.timestamp)}</div>
        </div>
      </div>
    `).join("");
    bindPhotoCards(grid);
  }

  $("#adminPhotoCount") && ($("#adminPhotoCount").textContent = `${paged.total} items`);
  $("#phoPageInfoAdmin") && ($("#phoPageInfoAdmin").textContent =
    `Page ${paged.page} / ${paged.totalPages} • ${paged.total} items`);

  $("#phoPrevAdmin") && ($("#phoPrevAdmin").disabled = paged.page <= 1);
  $("#phoNextAdmin") && ($("#phoNextAdmin").disabled = paged.page >= paged.totalPages);
}


/* =========================
   IMAGE MODAL
========================= */
function initImageModal() {
  const modal = $("#imgModal");
  if (!modal) return;

  modal.addEventListener("click", (e) => {
    const close = e.target?.dataset?.close;
    if (close) modal.classList.add("hidden");
  });
}

function bindPhotoCards(container) {
  container.querySelectorAll(".photoCard").forEach(card => {
    card.addEventListener("click", () => {
      const modal = $("#imgModal");
      const img = $("#modalImg");
      const meta = $("#modalMeta");
      if (!modal || !img || !meta) return;

      img.src = card.dataset.img;
      meta.textContent = card.dataset.meta || "";
      modal.classList.remove("hidden");
    });
  });
}

function photoMeta(p) {
  return `${p.userName} • ${p.plant} • ${p.timestamp}`;
}

/* =========================
   BOOT
========================= */
(function boot() {
  const page = document.body?.dataset?.page;
  if (page === "login") initLoginPage();
  if (page === "user") initUserPage();
  if (page === "admin") initAdminPage();
})();

/* ✅ Mobile sticky sidebar */
(function mobileStickyTabs() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const mq = window.matchMedia("(max-width: 980px)");
  let lastY = window.scrollY;

  function onScroll() {
    if (!mq.matches) return;
    const y = window.scrollY;
    const goingDown = y > lastY;

    if (Math.abs(y - lastY) > 8) {
      sidebar.classList.toggle("stickyHidden", goingDown && y > 120);
      lastY = y;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
})();



// photograph fetching helper in admin view 
function parseDmyTimestampToMs(s) {
  // "20/01/2026 11:08:08"
  const str = String(s || "").trim();
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
  const hh = Number(m[4]), mi = Number(m[5]), ss = Number(m[6]);
  return new Date(yyyy, mm - 1, dd, hh, mi, ss).getTime() || 0;
}

function driveToImgSrc(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  let id = "";
  const m1 = u.match(/\/file\/d\/([^/]+)/);
  if (m1?.[1]) id = m1[1];

  if (!id) {
    const m2 = u.match(/[?&]id=([^&]+)/);
    if (m2?.[1]) id = m2[1];
  }

  if (!id) return u;

  // ✅ Thumbnail works better for previews
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
}


function pickAny(obj, keys) {
  const map = obj || {};
  for (const k of keys) {
    if (k in map) return map[k];
  }
  // fallback: case-insensitive match
  const lower = Object.keys(map).reduce((a, x) => (a[x.toLowerCase()] = x, a), {});
  for (const k of keys) {
    const real = lower[String(k).toLowerCase()];
    if (real) return map[real];
  }
  return "";
}

async function fetchAdminPhotosFromSheet() {
  const res = await fetch(PHOTO_API_URL, { method: "GET" });
  if (!res.ok) throw new Error("PHOTO API failed: " + res.status);

  const raw = await res.json();
  const rows = Array.isArray(raw) ? raw : [];

  const out = [];

  for (const r of rows) {
    const isoDate = String(pickAny(r, ["DATE", "Date", "date"])).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;

    const userName = String(pickAny(r, ["USER NAME", "User Name", "USER_NAME", "userName"])).trim();
    const plant = String(pickAny(r, ["PLANT", "Plant", "plant"])).trim();
    const period = String(pickAny(r, ["PERIOD", "Period", "period"])).trim();

    const tsText = String(pickAny(r, ["TIMESTAMP", "Timestamp", "timestamp"])).trim();
    const ts = parseDmyTimestampToMs(tsText);

    const fileStr = String(pickAny(r, ["FILE", "File", "file"])).trim();
    const links = fileStr.split(",").map(x => x.trim()).filter(Boolean);

    for (const link of links) {
      out.push({
        isoDate,
        userName,
        plant,
        period,
        timestamp: tsText,
        ts,
        imageUrl: driveToImgSrc(link),
      });
    }
  }

  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

// user side photograph fetch

async function fetchUserPhotosFromSheet(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [];

  const res = await fetch(PHOTO_API_URL, { method: "GET" });
  if (!res.ok) throw new Error("PHOTO API failed: " + res.status);

  const raw = await res.json();
  const rows = Array.isArray(raw) ? raw : [];

  const out = [];

  for (const r of rows) {
    const rowUid = String(pickAny(r, ["USERID", "UserId", "userId", "User ID"])).trim();
    if (rowUid !== uid) continue;

    const isoDate = String(pickAny(r, ["DATE", "Date", "date"])).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;

    const userName = String(pickAny(r, ["USER NAME", "User Name", "userName"])).trim();
    const plant = String(pickAny(r, ["PLANT", "Plant", "plant"])).trim();
    const period = String(pickAny(r, ["PERIOD", "Period", "period"])).trim();

    const tsText = String(pickAny(r, ["TIMESTAMP", "Timestamp", "timestamp"])).trim();
    const ts = parseDmyTimestampToMs(tsText);

    const fileStr = String(pickAny(r, ["FILE", "File", "file"])).trim();
    const links = fileStr.split(",").map(x => x.trim()).filter(Boolean);

    for (const link of links) {
      out.push({
        isoDate,
        userId: rowUid,
        userName,
        plant,
        period,
        timestamp: tsText,
        ts,
        imageUrl: driveToImgSrc(link), // thumbnail preview
      });
    }
  }

  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}


// ✅ USER logout buttons (ONE consistent logout)
function doUserLogout() {
  try {
    clearSession(); // removes sp_session
    localStorage.removeItem("sp_current_user"); // optional but good
  } catch (e) {}

  window.location.href = "index.html";
}

["userLogout", "userLogoutTop", "logoutBtn"].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener("click", doUserLogout);
});
