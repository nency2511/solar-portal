/* =========================
   Solar Portal (LocalStorage Demo) — UPDATED
   ✅ Admin: Daily summary (Monthly/Yearly) + Graph + Download
   ✅ Admin: Last 10 days (Table/Graph)
   ✅ Admin: Maintenance date filter auto apply + pagination
   ✅ Admin: Photos 3 per page + date filter auto apply + pagination
   ✅ LOGIN: Users now fetched from Google Sheet (Apps Script API)
========================= */

// ✅ Google Sheet Users API (Apps Script Web App)
const USERS_API_URL =
  "https://script.google.com/macros/s/AKfycbwZOhQDaa35qA1ul5OdnKUpzJzllH_IpE2QBA9ZunCkU9CPHBOG3qHr9kT6YJZ8nOap/exec";

const LS_KEYS = {
  USERS: "sp_users",
  ADMIN: "sp_admin",
  SESSION: "sp_session",
  GEN: "sp_generation_entries",
  MNT: "sp_maintenance_entries",
  PHO: "sp_photo_entries",
};

const ADMIN_STATIC = { email: "admin@solar.com", password: "Admin@123", name: "Solar Admin" };

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
   ✅ SEED (UPDATED)
   - ❌ Removed static demo user seeding
   - ✅ Keep admin + data arrays seeding
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
   ✅ LAST 15 DAYS FIXED WINDOW HELPERS (NEW)
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
   ✅ GOOGLE SHEET LOGIN HELPERS (NEW)
   Expected API JSON:
   [
     { userId:"u101", name:"Ravi Patel", password:"User@101" },
     ...
   ]
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

    // ✅ convert to app format: {id, name, password}
    const list = users.map(u => ({
      id: String(u.userId || "").trim(),
      name: String(u.name || "").trim(),
      password: String(u.password || "").trim(),
    })).filter(u => u.id && u.password);

    // ✅ optional cache (so if sheet is down later, app still works)
    if (list.length) lsSet(LS_KEYS.USERS, list);

    return list;
  } catch (err) {
    console.error(err);
    // fallback: cached users (if any)
    return lsGet(LS_KEYS.USERS, []);
  }
}

/* =========================
   LOGIN PAGE  ✅ UPDATED (Sheet users)
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

  // ✅ USERS from Sheet (instead of static local)
  const users = await getUsersForLogin();

  // demo users UI (if you show it)
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
   USER PAGE (UNCHANGED LOGIC)
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

  // Generation submit
 // ✅ Google Form (Generation) config
const GEN_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLSfOJ61at9CSII4oWE4wGHdUafpYMPChrmkK8385-vqAiozw1Q/formResponse";

// ✅ entry ids
const GEN_ENTRY_USER_ID = "entry.1974299693";  // User ID
const GEN_ENTRY_DATE    = "entry.2137798723";  // Date
const GEN_ENTRY_ASH     = "entry.614917472";   // Ashiana
const GEN_ENTRY_DAR     = "entry.728178038";   // Darpan

function postToGoogleForm(url, payloadObj) {
  // NOTE: no-cors => browser won't give response, but submission works
  return fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payloadObj).toString(),
  });
}

$("#genForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const sess = getSession();
  const loggedUserId = sess?.userId || ""; // ✅ u101/u102 etc. (from login)

  const date = $("#genDate")?.value || nowStamp().isoDate;

  const ash = $("#genUnitsAshiyana").value.trim();
  const dar = $("#genUnitsDarpan").value.trim();

  const ashOk = ash !== "" && Number(ash) >= 0;
  const darOk = dar !== "" && Number(dar) >= 0;

  if (!loggedUserId) return toastErr("Session missing", "Please login again.");
  if (!ashOk && !darOk) return toastErr("Invalid units", "Enter Ashiyana or Darpan units (or both).");

  // ✅ Prepare Google Form payload
  const payload = {};
  payload[GEN_ENTRY_USER_ID] = loggedUserId;
  payload[GEN_ENTRY_DATE] = date;

  // Optional: if blank, send empty string
  payload[GEN_ENTRY_ASH] = ashOk ? ash : "";
  payload[GEN_ENTRY_DAR] = darOk ? dar : "";

  try {
    await postToGoogleForm(GEN_FORM_BASE, payload);

    // Clear UI
    $("#genUnitsAshiyana").value = "";
    $("#genUnitsDarpan").value = "";
    // genDate already readonly/auto, keep it

    toastOk("Submitted!", "Saved to Google Sheet successfully.");
  } catch (err) {
    console.error(err);
    toastErr("Failed", "Could not submit. Please try again.");
  }
});



 // ✅ Google Form (Maintenance) config
// ✅ Google Form (Maintenance) submit URL
const MNT_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLScoTlpED27u8V2QmCoS97YLLuiYeGdlxe0dSTEVqFTdWUVZ0w/formResponse";

// ✅ entry ids (Maintenance)
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

// ✅ MUST: helper (paste once, reuse for gen/mnt/etc.)
async function postToGoogleForm(url, payloadObj) {
  const params = new URLSearchParams();
  Object.entries(payloadObj).forEach(([k, v]) => {
    params.append(k, v == null ? "" : String(v));
  });

  // NOTE: no-cors => we can't read response, but submission works if payload is valid
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: params.toString(),
  });
}

// ✅ Maintenance submit (REPLACE your old localStorage submit with this)
$("#mntForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = nowStamp();

  const date = $("#mntDate")?.value || t.isoDate;

  const plant = ($("#mntPlant")?.value || "").trim();
  const om = ($("#omStaff")?.value || "").trim();
  const sec = ($("#securityCount")?.value || "").trim();
  const cleaning = ($("#cleaningHours")?.value || "").trim();
  const breakdown = ($("#breakdownYes")?.value || "No").trim();

  // ✅ Validations
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

  // ✅ Prepare Google Form payload
  const payload = {};
  payload[MNT_ENTRY_DATE] = date;
  payload[MNT_ENTRY_PLANT] = plant;
  payload[MNT_ENTRY_OM] = om;
  payload[MNT_ENTRY_SECURITY] = sec;
  payload[MNT_ENTRY_CLEANING] = cleaning;
  payload[MNT_ENTRY_BREAKDOWN] = breakdown;

  // ✅ Always send (empty ok)
  payload[MNT_ENTRY_BREAKHRS] = breakdown === "Yes" ? (breakHrs || "0") : "";
  payload[MNT_ENTRY_BREAKFROM] = breakdown === "Yes" ? breakFrom : "";
  payload[MNT_ENTRY_BREAKTO] = breakdown === "Yes" ? breakTo : "";
  payload[MNT_ENTRY_BREAKREASON] = breakdown === "Yes" ? breakReason : "";

  try {
    await postToGoogleForm(MNT_FORM_BASE, payload);

    // ✅ Clear UI (same as before)
    $("#omStaff").value = "";
    $("#securityCount").value = "";
    $("#cleaningHours").value = "1";
    $("#breakdownYes").value = "No";

    toggleBreak?.();
    fillUserDatesOnly?.();

    userViewState.mnt.page = 1;

    // ✅ IMPORTANT: you removed LS, so this table won't auto-update from LS.
    // renderUserTables(me.id); // keep only if you later fetch maintenance from sheet

    toastOk("Submitted!", "Maintenance saved to Google Sheet successfully.");
  } catch (err) {
    console.error(err);
    toastErr("Failed", "Could not submit maintenance. Please try again.");
  }
});



  // Photo upload
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

    const period = $("#photoPeriod").value;
    const plant = document.querySelector('input[name="plantPhoto"]:checked')?.value || "Ashiyana";
    const files = photoFile.files ? Array.from(photoFile.files) : [];
    if (!files.length) return toastErr("No file", "Please choose image(s).");

    const entries = lsGet(LS_KEYS.PHO, []);
    for (const f of files) {
      const b64 = await toBase64(f);
      entries.push({
        id: cryptoId(), userId: me.id, userName: me.name,
        plant, period, imageData: b64,
        isoDate: t.isoDate, time: t.time, timestamp: t.display,
        createdAt: Date.now()
      });
    }
    lsSet(LS_KEYS.PHO, entries);

    $("#photoPeriod").value = "Daily";
    photoFile.value = "";
    imgPreviewWrap?.classList.add("hidden");
    fillUserDatesOnly();

    userViewState.pho.page = 1;
    renderUserPhotos(me.id);
    toastOk("Saved!", "Photograph(s) stored successfully.");
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

async function renderUserTables(userId) {
  /* =========================
     ✅ GEN (from Google Sheet via Apps Script)
  ========================= */
  const gState = userViewState.gen;

  let genAll = [];
  try {
    const url = `${GEN_API_URL}?action=gen&userId=${encodeURIComponent(userId)}&from=${encodeURIComponent(gState.from || "")}&to=${encodeURIComponent(gState.to || "")}`;
    const res = await fetch(url);
    const data = await res.json();

    // expected: { ok:true, rows:[ {isoDate:"2026-01-16", ash:454, dar:222}, ... ] }
    const rows = (data?.rows || []);

    // convert into table rows: Date | Plant | Units
    genAll = [];
    for (const r of rows) {
      if (r.ash !== "" && r.ash !== null && r.ash !== undefined) {
        genAll.push({ isoDate: r.isoDate, plant: "Ashiyana", units: Number(r.ash || 0) });
      }
      if (r.dar !== "" && r.dar !== null && r.dar !== undefined) {
        genAll.push({ isoDate: r.isoDate, plant: "Darpan", units: Number(r.dar || 0) });
      }
    }

    // latest first
    genAll.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));
  } catch (err) {
    console.error(err);
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

  $("#genPageInfo") && ($("#genPageInfo").textContent = `Page ${genPaged.page} / ${genPaged.totalPages} • ${genPaged.total} items`);
  $("#genPrev") && ($("#genPrev").disabled = genPaged.page <= 1);
  $("#genNext") && ($("#genNext").disabled = genPaged.page >= genPaged.totalPages);

  /* =========================
     ✅ MNT (same as before - LocalStorage)
  ========================= */
  const mState = userViewState.mnt;

  const mntAll = lsGet(LS_KEYS.MNT, [])
    .filter(x => x.userId === userId)
    .filter(x => withinDateRange(x.isoDate, mState.from, mState.to))
    .sort((a, b) => b.createdAt - a.createdAt);

  const mntPaged = paginate(mntAll, mState.page, mState.perPage);
  userViewState.mnt.page = mntPaged.page;

  const mntBody = $("#userMntTable tbody");
  if (mntBody) {
    mntBody.innerHTML =
      mntPaged.items.map(r => `
        <tr>
          <td>${r.isoDate}</td>
          <td>${r.plant}</td>
          <td>${r.omStaff}</td>
          <td>${r.securityCount}</td>
          <td>${r.cleaningHours}</td>
          <td>${r.breakdown}${r.breakdown === "Yes" ? " ⚠️" : ""}</td>
        </tr>
      `).join("") || `<tr><td colspan="6" class="muted">No logs yet.</td></tr>`;
  }

  $("#mntPageInfo") && ($("#mntPageInfo").textContent = `Page ${mntPaged.page} / ${mntPaged.totalPages} • ${mntPaged.total} items`);
  $("#mntPrev") && ($("#mntPrev").disabled = mntPaged.page <= 1);
  $("#mntNext") && ($("#mntNext").disabled = mntPaged.page >= mntPaged.totalPages);
}


function renderUserPhotos(userId) {
  const pState = userViewState.pho;
  const listAll = lsGet(LS_KEYS.PHO, [])
    .filter(x => x.userId === userId)
    .filter(x => withinDateRange(x.isoDate, pState.from, pState.to))
    .sort((a, b) => b.createdAt - a.createdAt);

  const paged = paginate(listAll, pState.page, pState.perPage);
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
    <div class="photoCard" data-img="${escapeAttr(p.imageData)}" data-meta="${escapeAttr(photoMeta(p))}">
      <img src="${p.imageData}" alt="photo"/>
      <div class="photoMeta">
        <div class="t">${p.period} • ${p.plant}</div>
        <div class="s">${p.isoDate} ${p.time}</div>
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
    tab: "monthly",   // ✅ monthly | yearly
    mode: "table"     // table | graph
  },
  last10: {
    mode: "table",     // table | graph
    from: "",
    to: "",
    days: 15           // ✅ fixed 15-day window
  },
  mnt: { from: "", to: "", page: 1, perPage: 10 },
  pho: { from: "", to: "", page: 1, perPage: 3 },
};

function initAdminPage() {
  seedIfNeeded();
  if (!requireRole("admin")) return;

  $("#adminLogout")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });

  // Sidebar nav
  $all(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".navBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const sec = btn.dataset.section;
      $all(".panel").forEach(p => p.classList.remove("show"));
      $("#sec-" + sec)?.classList.add("show");
    });
  });

  // Vertical tabs (Monthly/Yearly only)
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

  // Summary Table/Graph toggle
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

  // Download chart button (for summary chart)
  $("#downloadChartBtn")?.addEventListener("click", () => {
    if (!summaryChartInstance) return;
    const a = document.createElement("a");
    a.href = summaryChartInstance.toBase64Image();
    a.download = `solar_${adminState.summary.tab}_chart.png`;
    a.click();
  });

  // Last 10 days Table/Graph toggle
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

  /* ✅ NEW: Last 15 days fixed window auto filter (From -> auto To) */
  bindAutoFixedWindowFilter({
    fromSel: "#last10FromAdmin",
    toSel: "#last10ToAdmin",
    stateObj: adminState.last10,
    days: adminState.last10.days,
    onChange: () => renderAdminLast10Days(),
  });

  /* ✅ NEW: default last 15 days = today-14 to today */
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

  // Maintenance auto date filter + pagination
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

  // Photos auto date filter + pagination
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

  // Hide both tab tables when graph mode
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
function getAllGenRows() {
  return lsGet(LS_KEYS.GEN, []).slice().sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function groupByDate(rows) {
  const map = new Map(); // date -> {Ashiyana, Darpan}
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
  return dates; // desc order
}

function fmtShortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(dt);
}

/* =========================
   ADMIN: DAILY UNITS SUMMARY
========================= */
function renderAdminDailyUnitsSummary() {
  const rows = getAllGenRows();
  groupByDate(rows);

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
  const ym = today.slice(0, 7); // YYYY-MM

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
  const curMonth = now.getMonth() + 1; // 1..12

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
  const map = new Map(); // year -> {A,D}
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
   ADMIN: LAST 15 DAYS (FIXED RANGE)
========================= */
function renderAdminLast10Days() {
  const rows = getAllGenRows();
  const byDate = groupByDate(rows);

  const n = adminState.last10.days || 15;

  let dates = [];
  if (adminState.last10.from && adminState.last10.to) {
    dates = buildDateList(adminState.last10.from, adminState.last10.to);
  } else {
    dates = getLastNDates(n).slice().reverse();
  }

  // latest first
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
        {
          label: "Ashiyana",
          data: aData,
          backgroundColor: "rgba(37,199,199,.55)",
          borderColor: "rgba(37,199,199,.9)",
          borderWidth: 1,
          borderRadius: 6,
          stack: "stack1"
        },
        {
          label: "Darpan",
          data: dData,
          backgroundColor: "rgba(11,42,60,.50)",
          borderColor: "rgba(11,42,60,.85)",
          borderWidth: 1,
          borderRadius: 6,
          stack: "stack1"
        }
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
   ADMIN: MAINTENANCE (AUTO FILTER + PAGINATION)
========================= */
function renderAdminMaintenance() {
  const state = adminState.mnt;

  const all = lsGet(LS_KEYS.MNT, [])
    .filter(r => withinDateRange(r.isoDate, state.from, state.to))
    .sort((a, b) => b.createdAt - a.createdAt);

  const paged = paginate(all, state.page, state.perPage);
  adminState.mnt.page = paged.page;

  const body = $("#adminMntTable tbody");
  if (body) {
    body.innerHTML =
      paged.items.map(r => `
        <tr>
          <td>${r.isoDate}</td>
          <td>${r.userName || ""}</td>
          <td>${r.plant || ""}</td>
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
   ADMIN: PHOTOS (3 PER PAGE + AUTO FILTER + PAGINATION)
========================= */
function renderAdminPhotos() {
  const state = adminState.pho;

  const all = lsGet(LS_KEYS.PHO, [])
    .filter(r => withinDateRange(r.isoDate, state.from, state.to))
    .sort((a, b) => b.createdAt - a.createdAt);

  const paged = paginate(all, state.page, state.perPage);
  adminState.pho.page = paged.page;

  const grid = $("#adminPhotoGrid");
  if (!grid) return;

  if (paged.total === 0) {
    grid.innerHTML = `<div class="muted">No photos found.</div>`;
  } else {
    grid.innerHTML = paged.items.map(p => `
      <div class="photoCard" data-img="${escapeAttr(p.imageData)}" data-meta="${escapeAttr(photoMeta(p))}">
        <img src="${p.imageData}" alt="photo"/>
        <div class="photoMeta">
          <div class="t">${p.period} • ${p.plant}</div>
          <div class="s">${p.userName} • ${p.timestamp}</div>
        </div>
      </div>
    `).join("");
    bindPhotoCards(grid);
  }

  $("#adminPhotoCount") && ($("#adminPhotoCount").textContent = `${paged.total} items`);
  $("#phoPageInfoAdmin") && ($("#phoPageInfoAdmin").textContent = `Page ${paged.page} / ${paged.totalPages} • ${paged.total} items`);
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
  return `${p.userName} (${p.userId}) • ${p.period} • ${p.plant} • ${p.timestamp}`;
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

