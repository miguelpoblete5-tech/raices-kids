import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import {
  Sprout,
  Users,
  CalendarDays,
  Lock,
  ExternalLink,
  X,
  Shuffle,
  Check,
  ChevronRight,
  Trash2,
  ArrowLeft,
  Plus,
  Heart,
} from "lucide-react";

/* ---------- constantes ---------- */

// Emails que pueden ver el panel de Admin. Agregá o sacá emails acá.
const ADMIN_EMAILS = ["miguelpoblete5@gmail.com"];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const K = {
  volunteers: "raices_volunteers",
  assignments: "raices_assignments",
  materials: "raices_materials",
  config: "raices_config",
  events: "raices_events",
};

/* ---------- utilidades ---------- */

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sundaysOfMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const out = [];
  for (let day = 1; day <= days; day++) {
    const d = new Date(y, m - 1, day);
    if (d.getDay() === 0) {
      out.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }
  return out;
}

function formatDateLong(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

const FILES_SCHEMA = [
  { key: "estudioMaestro", label: "Estudio del Maestro" },
  { key: "planificacion", label: "Planificación de la clase" },
  { key: "video1", label: "Video 1" },
  { key: "video2", label: "Video 2" },
  { key: "video3", label: "Video 3" },
  { key: "anexo", label: "Anexo" },
  { key: "notaPadres", label: "Nota para papás" },
];

function emptyFilesObject() {
  return FILES_SCHEMA.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});
}

function defaultMaterial() {
  return { title: "", desc: "", files: emptyFilesObject() };
}

// Convierte "biper.com/x" en "https://biper.com/x" para que el link abra bien
// (sin esto, un enlace sin protocolo no navega dentro del artefacto).
function normalizeUrl(raw) {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// Abre el link en una pestaña nueva desde un click de botón (más confiable
// dentro del artefacto que depender de la navegación nativa del <a>).
function openInNewTab(raw) {
  const url = normalizeUrl(raw);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignForDate(volunteers, date) {
  const available = volunteers.filter((v) => v.availability.includes(date));
  const maestros = shuffle(available.filter((v) => v.role === "maestro"));
  let asistentes = shuffle(available.filter((v) => v.role === "asistente"));

  let peques = [];
  let grandes = [];

  if (maestros.length >= 2) {
    peques.push({ id: maestros[0].id, name: maestros[0].name, tag: "maestro" });
    grandes.push({ id: maestros[1].id, name: maestros[1].name, tag: "maestro" });
    const extra = maestros.slice(2).map((v) => ({ id: v.id, name: v.name, tag: "maestro" }));
    asistentes = shuffle([...asistentes, ...extra]);
  } else if (maestros.length === 1) {
    const target = Math.random() < 0.5 ? peques : grandes;
    target.push({ id: maestros[0].id, name: maestros[0].name, tag: "maestro" });
  }

  asistentes.forEach((a) => {
    const dest = peques.length <= grandes.length ? peques : grandes;
    dest.push({ id: a.id, name: a.name, tag: "asistente" });
  });

  return { peques, grandes };
}

/* ---------- almacenamiento (Supabase) ---------- */

async function loadKey(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return fallback;
    return data.value ?? fallback;
  } catch (e) {
    console.error("storage error (load)", e);
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    const { error } = await supabase
      .from("app_state")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) {
      console.error("storage error (save)", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("storage error (save)", e);
    return false;
  }
}

// Guarda y después vuelve a leer para confirmar que quedó realmente persistido
// (protege contra cortes de red pasajeros).
async function saveKeyVerified(key, value) {
  const ok = await saveKey(key, value);
  if (!ok) return false;
  try {
    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return false;
    return JSON.stringify(data.value) === JSON.stringify(value);
  } catch {
    return false;
  }
}

/* ---------- estilos globales ---------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Work+Sans:wght@400;500;600&display=swap');

      .rk-root {
        --soil: #26301f;
        --soil-light: #3a4930;
        --leaf: #6f8f4f;
        --leaf-light: #9ab97c;
        --clay: #b5643c;
        --clay-light: #d68a5f;
        --paper: #f6f2e6;
        --paper-warm: #efe8d4;
        --ink: #232920;
        font-family: 'Work Sans', sans-serif;
        color: var(--ink);
        background: var(--paper);
        min-height: 100%;
        width: 100%;
      }
      .rk-serif { font-family: 'Fraunces', serif; }

      .rk-scroll {
        max-width: 720px;
        margin: 0 auto;
        padding: 28px 20px 60px;
      }

      .rk-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 22px;
      }
      .rk-header .badge {
        width: 44px; height: 44px;
        border-radius: 50% 50% 50% 8px;
        background: var(--soil);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .rk-title { font-size: 26px; font-weight: 600; line-height: 1.1; color: var(--soil); }
      .rk-tagline { font-size: 13px; color: var(--soil-light); opacity: 0.8; margin-top: 2px; }

      .rk-nav {
        display: flex;
        gap: 6px;
        margin-bottom: 24px;
        border-bottom: 2px solid var(--paper-warm);
        padding-bottom: 0;
      }
      .rk-nav button {
        border: none;
        background: transparent;
        font-family: 'Work Sans', sans-serif;
        font-size: 14px;
        font-weight: 500;
        padding: 9px 14px 11px;
        cursor: pointer;
        color: var(--soil-light);
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: color 0.15s;
      }
      .rk-nav button.active {
        color: var(--soil);
        border-bottom-color: var(--clay);
      }
      .rk-nav button:hover { color: var(--soil); }

      .rk-card {
        background: white;
        border-radius: 6px 6px 6px 20px;
        border: 1px solid var(--paper-warm);
        padding: 22px;
        margin-bottom: 16px;
      }

      .rk-label { font-size: 12.5px; font-weight: 600; color: var(--soil-light); margin-bottom: 6px; display: block; }

      .rk-input {
        width: 100%;
        border: 1.5px solid var(--paper-warm);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 15px;
        font-family: 'Work Sans', sans-serif;
        color: var(--ink);
        background: var(--paper);
        box-sizing: border-box;
      }
      .rk-input:focus { outline: none; border-color: var(--leaf); }

      .rk-btn {
        border: none;
        border-radius: 8px;
        padding: 11px 20px;
        font-size: 14.5px;
        font-weight: 600;
        font-family: 'Work Sans', sans-serif;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: opacity 0.15s, transform 0.1s;
      }
      .rk-btn:active { transform: scale(0.98); }
      .rk-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .rk-btn-primary { background: var(--soil); color: var(--paper); }
      .rk-btn-primary:hover:not(:disabled) { background: var(--soil-light); }
      .rk-btn-accent { background: var(--clay); color: white; }
      .rk-btn-accent:hover:not(:disabled) { background: var(--clay-light); }
      .rk-btn-ghost { background: transparent; color: var(--soil); border: 1.5px solid var(--paper-warm); }
      .rk-btn-ghost:hover { border-color: var(--leaf); }
      .rk-btn-danger { background: transparent; color: #a33; border: 1.5px solid #e8d0d0; }

      .rk-role-pick {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .rk-role-opt {
        border: 1.5px solid var(--paper-warm);
        border-radius: 10px;
        padding: 14px;
        cursor: pointer;
        text-align: center;
        font-weight: 500;
        transition: all 0.12s;
      }
      .rk-role-opt.selected {
        border-color: var(--leaf);
        background: #f2f6ec;
        color: var(--soil);
      }

      .rk-day-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 8px;
      }
      .rk-day-chip {
        border: 1.5px solid var(--paper-warm);
        border-radius: 8px;
        padding: 10px 6px;
        text-align: center;
        cursor: pointer;
        font-size: 13.5px;
        font-weight: 500;
        transition: all 0.12s;
      }
      .rk-day-chip.selected {
        background: var(--leaf);
        border-color: var(--leaf);
        color: white;
      }

      .rk-sunday-card {
        border: 1.5px solid var(--paper-warm);
        border-radius: 6px 6px 6px 16px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .rk-sunday-head {
        background: var(--soil);
        color: var(--paper);
        padding: 10px 16px;
        font-weight: 600;
        font-size: 14.5px;
      }
      .rk-sunday-body {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .rk-group-col {
        padding: 14px 16px;
        border-right: 1px solid var(--paper-warm);
      }
      .rk-group-col:last-child { border-right: none; }
      .rk-group-label {
        font-size: 11.5px;
        font-weight: 700;
        color: var(--soil-light);
        margin-bottom: 8px;
      }
      .rk-person-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 9px;
        border-radius: 6px;
        margin-bottom: 5px;
        font-size: 13.5px;
        cursor: pointer;
        background: var(--paper);
      }
      .rk-person-row:hover { background: var(--paper-warm); }
      .rk-person-row.mine {
        background: #fbeee2;
        border: 1.5px solid var(--clay-light);
      }
      .rk-tag {
        font-size: 10.5px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 20px;
      }
      .rk-tag.maestro { background: var(--soil); color: var(--paper); }
      .rk-tag.asistente { background: var(--leaf-light); color: var(--soil); }

      .rk-modal-backdrop {
        position: fixed; inset: 0;
        background: rgba(35,41,32,0.55);
        display: flex; align-items: center; justify-content: center;
        z-index: 50;
        padding: 20px;
      }
      .rk-modal {
        background: white;
        border-radius: 8px 8px 8px 24px;
        padding: 26px;
        max-width: 420px;
        width: 100%;
        position: relative;
      }
      .rk-modal-close {
        position: absolute; top: 14px; right: 14px;
        cursor: pointer; color: var(--soil-light);
        background: none; border: none;
      }

      .rk-empty {
        text-align: center;
        padding: 30px 16px;
        color: var(--soil-light);
        font-size: 14px;
      }

      .rk-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .rk-table th { text-align: left; font-size: 11.5px; color: var(--soil-light); padding: 6px 8px; border-bottom: 1.5px solid var(--paper-warm); }
      .rk-table td { padding: 8px; border-bottom: 1px solid var(--paper-warm); vertical-align: top; }

      @media (max-width: 480px) {
        .rk-sunday-body { grid-template-columns: 1fr; }
        .rk-group-col { border-right: none; border-bottom: 1px solid var(--paper-warm); }
      }
    `}</style>
  );
}

/* ---------- iconito raíz ---------- */
function RootIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v9" stroke="#f6f2e6" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 11c-2 1-3 3-3 6M12 11c2 1 3 3 3 6M12 13c-1.2 0.6-2 1.8-2.5 3.6M12 13c1.2 0.6 2 1.8 2.5 3.6" stroke="#f6f2e6" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="4" r="2.4" fill="#9ab97c" />
    </svg>
  );
}

/* ---------- app principal ---------- */

export default function RaicesKids() {
  const [tab, setTab] = useState("mi");
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [volunteers, setVolunteers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [materials, setMaterials] = useState({});
  const [config, setConfig] = useState({ month: currentYearMonth() });

  const [pickName, setPickName] = useState("");
  const [me, setMe] = useState(null); // volunteer object once identificado
  const [stage, setStage] = useState("register"); // register | saving | save-failed | status

  const [pickRole, setPickRole] = useState(null);
  const [pickDays, setPickDays] = useState([]);
  const [pickEventIds, setPickEventIds] = useState([]);

  const [modalInfo, setModalInfo] = useState(null); // {kind:'sunday', date, group} | {kind:'evento', eventId}

  const [adminError, setAdminError] = useState("");
  const [adminMonthDraft, setAdminMonthDraft] = useState(config.month);
  const [savingMsg, setSavingMsg] = useState("");
  const [materialsDraft, setMaterialsDraft] = useState({});
  const [savedDates, setSavedDates] = useState({}); // {date: true} muestra "Guardado" un instante
  const [events, setEvents] = useState([]);

  const loadAll = useCallback(async () => {
    const [v, a, m, c, ev] = await Promise.all([
      loadKey(K.volunteers, []),
      loadKey(K.assignments, {}),
      loadKey(K.materials, {}),
      loadKey(K.config, { month: currentYearMonth() }),
      loadKey(K.events, []),
    ]);
    setVolunteers(v);
    setAssignments(a);
    setMaterials(m);
    setMaterialsDraft(m);
    setConfig(c);
    setAdminMonthDraft(c.month);
    setEvents(ev);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Una vez logueado, busca si ya existe un anotado con este email.
  // Si no existe, arranca el formulario de anotación; si existe, muestra su estado.
  useEffect(() => {
    if (!session) return;
    const found = volunteers.find((v) => v.email === session.user.email);
    if (found) {
      setMe(found);
      setStage((s) => (s === "register" ? "status" : s));
    } else if (stage !== "saving" && stage !== "save-failed") {
      setMe(null);
      setStage("register");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, volunteers]);

  async function signUp(email, password) {
    setAuthError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
  }

  async function signIn(email, password) {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const sundays = sundaysOfMonth(config.month);

  function toggleDay(d) {
    setPickDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function toggleEventPick(id) {
    setPickEventIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submitRegistration() {
    if (!session || !pickName.trim() || !pickRole || pickDays.length === 0) return;
    const newVol = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: session.user.email,
      name: pickName.trim(),
      role: pickRole,
      availability: pickDays,
      eventInterest: pickEventIds,
      month: config.month,
    };
    const updated = [...volunteers, newVol];
    setVolunteers(updated);
    setStage("saving");

    let ok = await saveKeyVerified(K.volunteers, updated);
    if (!ok) {
      // reintenta una vez más por si fue un problema de red pasajero
      ok = await saveKeyVerified(K.volunteers, updated);
    }

    if (ok) {
      setMe(newVol);
      setStage("status");
    } else {
      setMe(newVol);
      setStage("save-failed");
    }
  }

  async function retryRegistration() {
    if (!me) return;
    setStage("saving");
    const updated = [...volunteers.filter((v) => v.id !== me.id), me];
    let ok = await saveKeyVerified(K.volunteers, updated);
    if (!ok) ok = await saveKeyVerified(K.volunteers, updated);
    if (ok) {
      setVolunteers(updated);
      setStage("status");
    } else {
      setStage("save-failed");
    }
  }

  async function addVolunteerManually(name, role, days) {
    if (!name.trim() || !role || days.length === 0) return;
    const newVol = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      role,
      availability: days,
      eventInterest: [],
      month: config.month,
    };
    const updated = [...volunteers, newVol];
    setVolunteers(updated);
    await saveKey(K.volunteers, updated);
    flashSaved(`${name.trim()} fue agregado/a.`);
  }

  /* ---- admin ---- */
  const isAdmin = !!session && ADMIN_EMAILS.includes(session.user.email);

  async function saveMonth() {
    const c = { ...config, month: adminMonthDraft };
    setConfig(c);
    await saveKey(K.config, c);
    flashSaved("Mes actualizado.");
  }

  async function generateAssignments() {
    const days = sundaysOfMonth(config.month);
    const result = {};
    days.forEach((d) => {
      result[d] = assignForDate(volunteers, d);
    });
    setAssignments(result);
    await saveKey(K.assignments, result);
    flashSaved("¡Equipos sorteados!");
  }

  async function clearAssignments() {
    setAssignments({});
    await saveKey(K.assignments, {});
    flashSaved("Asignaciones borradas.");
  }

  async function clearVolunteers() {
    setVolunteers([]);
    await saveKey(K.volunteers, []);
    flashSaved("Anotaciones borradas.");
  }

  // Edita el borrador local nomás; todavía no se guarda hasta tocar "Guardar"
  function updateMaterialField(date, group, field, value) {
    const key = `${date}_${group}`;
    setMaterialsDraft((prev) => {
      const current = prev[key] || defaultMaterial();
      const updated =
        field === "title" || field === "desc"
          ? { ...current, [field]: value }
          : { ...current, files: { ...current.files, [field]: value } };
      return { ...prev, [key]: updated };
    });
  }

  // Guarda los materiales de un domingo puntual (peques + grandes) en el almacenamiento compartido
  async function saveMaterialsForDate(date) {
    setMaterials(materialsDraft);
    await saveKey(K.materials, materialsDraft);
    setSavedDates((prev) => ({ ...prev, [date]: true }));
    setTimeout(() => setSavedDates((prev) => ({ ...prev, [date]: false })), 2500);
  }

  /* ---- ajuste manual de equipos ---- */
  async function addToAssignment(date, group, volunteerId, tag) {
    const vol = volunteers.find((v) => v.id === volunteerId);
    if (!vol) return;
    const day = assignments[date] || { peques: [], grandes: [] };
    const alreadyThere =
      day.peques.some((p) => p.id === volunteerId) || day.grandes.some((p) => p.id === volunteerId);
    if (alreadyThere) return;
    const updatedDay = { ...day, [group]: [...day[group], { id: vol.id, name: vol.name, tag }] };
    const updated = { ...assignments, [date]: updatedDay };
    setAssignments(updated);
    await saveKey(K.assignments, updated);
    flashSaved("Equipo actualizado.");
  }

  async function removeFromAssignment(date, group, volunteerId) {
    const day = assignments[date] || { peques: [], grandes: [] };
    const updatedDay = { ...day, [group]: day[group].filter((p) => p.id !== volunteerId) };
    const updated = { ...assignments, [date]: updatedDay };
    setAssignments(updated);
    await saveKey(K.assignments, updated);
    flashSaved("Persona quitada del equipo.");
  }

  async function changeTagInAssignment(date, group, volunteerId, newTag) {
    const day = assignments[date] || { peques: [], grandes: [] };
    const updatedDay = {
      ...day,
      [group]: day[group].map((p) => (p.id === volunteerId ? { ...p, tag: newTag } : p)),
    };
    const updated = { ...assignments, [date]: updatedDay };
    setAssignments(updated);
    await saveKey(K.assignments, updated);
    flashSaved("Etiqueta actualizada.");
  }

  function flashSaved(msg) {
    setSavingMsg(msg);
    setTimeout(() => setSavingMsg(""), 2200);
  }

  /* ---- eventos especiales ---- */
  async function addEvent(date, title, instructions) {
    if (!date || !title.trim()) return;
    const newEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date,
      title: title.trim(),
      instructions: (instructions || "").trim(),
      team: [],
      files: emptyFilesObject(),
    };
    const updated = [...events, newEvent].sort((a, b) => a.date.localeCompare(b.date));
    setEvents(updated);
    await saveKey(K.events, updated);
    flashSaved("Evento creado.");
  }

  async function updateEvent(id, patch) {
    const updated = events.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev));
    setEvents(updated);
    await saveKey(K.events, updated);
  }

  async function deleteEvent(id) {
    const updated = events.filter((ev) => ev.id !== id);
    setEvents(updated);
    await saveKey(K.events, updated);
    flashSaved("Evento borrado.");
  }

  async function addToEventTeam(eventId, volunteerId) {
    const vol = volunteers.find((v) => v.id === volunteerId);
    const ev = events.find((e) => e.id === eventId);
    if (!vol || !ev || ev.team.some((p) => p.id === volunteerId)) return;
    await updateEvent(eventId, { team: [...ev.team, { id: vol.id, name: vol.name }] });
    flashSaved("Agregado al equipo del evento.");
  }

  async function removeFromEventTeam(eventId, volunteerId) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    await updateEvent(eventId, { team: ev.team.filter((p) => p.id !== volunteerId) });
    flashSaved("Sacado del equipo del evento.");
  }

  async function toggleEventInterest(eventId) {
    if (!me) return;
    const current = me.eventInterest || [];
    const has = current.includes(eventId);
    const newInterest = has ? current.filter((id) => id !== eventId) : [...current, eventId];
    const updatedVols = volunteers.map((v) => (v.id === me.id ? { ...v, eventInterest: newInterest } : v));
    setVolunteers(updatedVols);
    setMe({ ...me, eventInterest: newInterest });
    await saveKey(K.volunteers, updatedVols);
  }

  /* ---- helpers de vista ---- */
  function myAssignmentsList() {
    if (!me) return [];
    const out = [];
    sundays.forEach((d) => {
      const day = assignments[d];
      if (!day) return;
      ["peques", "grandes"].forEach((g) => {
        if (day[g]?.some((p) => p.id === me.id)) {
          out.push({ kind: "sunday", date: d, group: g });
        }
      });
    });
    events.forEach((ev) => {
      if (ev.team.some((p) => p.id === me.id)) {
        out.push({ kind: "evento", date: ev.date, eventId: ev.id, title: ev.title });
      }
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  const upcomingEvents = events.filter((ev) => ev.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date));

  const monthLabel = (() => {
    const [y, m] = config.month.split("-");
    return `${MESES[Number(m) - 1][0].toUpperCase()}${MESES[Number(m) - 1].slice(1)} ${y}`;
  })();

  if (loading) {
    return (
      <div className="rk-root">
        <GlobalStyle />
        <div className="rk-scroll">
          <p style={{ color: "var(--soil-light)" }}>Cargando Raíces Kids…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rk-root">
      <GlobalStyle />
      <div className="rk-scroll">
        <div className="rk-header">
          <div className="badge">
            <RootIcon />
          </div>
          <div>
            <div className="rk-title rk-serif">Raíces Kids</div>
            <div className="rk-tagline">Equipo de servicio · escuela bíblica infantil</div>
          </div>
        </div>

        <div className="rk-nav">
          <button className={tab === "mi" ? "active" : ""} onClick={() => setTab("mi")}>
            Mi anotación
          </button>
          <button className={tab === "cal" ? "active" : ""} onClick={() => setTab("cal")}>
            Calendario
          </button>
          <button className={tab === "padres" ? "active" : ""} onClick={() => setTab("padres")}>
            Padres
          </button>
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            Admin
          </button>
        </div>

        {tab === "mi" && (
          <MiAnotacion
            stage={stage}
            authLoading={authLoading}
            session={session}
            authError={authError}
            signIn={signIn}
            signUp={signUp}
            signOut={signOut}
            pickName={pickName}
            setPickName={setPickName}
            pickRole={pickRole}
            setPickRole={setPickRole}
            pickDays={pickDays}
            toggleDay={toggleDay}
            sundays={sundays}
            monthLabel={monthLabel}
            submitRegistration={submitRegistration}
            retryRegistration={retryRegistration}
            me={me}
            myAssignments={myAssignmentsList()}
            openModal={setModalInfo}
            upcomingEvents={upcomingEvents}
            pickEventIds={pickEventIds}
            toggleEventPick={toggleEventPick}
            toggleEventInterest={toggleEventInterest}
          />
        )}

        {tab === "cal" && (
          <Calendario
            sundays={sundays}
            monthLabel={monthLabel}
            assignments={assignments}
            me={me}
            openModal={setModalInfo}
            events={events}
          />
        )}

        {tab === "padres" && (
          <PadresSection sundays={sundays} monthLabel={monthLabel} materials={materials} />
        )}

        {tab === "admin" && authLoading && (
          <div className="rk-card">
            <p style={{ fontSize: 14 }}>Verificando sesión…</p>
          </div>
        )}

        {tab === "admin" && !authLoading && !session && (
          <AdminLogin authError={authError} signIn={signIn} signUp={signUp} />
        )}

        {tab === "admin" && !authLoading && session && !isAdmin && (
          <div className="rk-card">
            <span className="rk-serif" style={{ fontSize: 18, fontWeight: 600 }}>
              Sin permisos de administrador
            </span>
            <p style={{ fontSize: 13.5, marginTop: 8 }}>
              La cuenta <strong>{session.user.email}</strong> no está autorizada para ver
              el panel de Admin.
            </p>
            <button className="rk-btn rk-btn-ghost" style={{ marginTop: 12, padding: "6px 12px", fontSize: 13 }} onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
        )}

        {tab === "admin" && !authLoading && session && isAdmin && (
          <AdminPanel
            config={config}
            adminMonthDraft={adminMonthDraft}
            setAdminMonthDraft={setAdminMonthDraft}
            saveMonth={saveMonth}
            volunteers={volunteers}
            sundays={sundays}
            monthLabel={monthLabel}
            generateAssignments={generateAssignments}
            clearAssignments={clearAssignments}
            clearVolunteers={clearVolunteers}
            assignments={assignments}
            materialsDraft={materialsDraft}
            updateMaterialField={updateMaterialField}
            saveMaterialsForDate={saveMaterialsForDate}
            savedDates={savedDates}
            addToAssignment={addToAssignment}
            removeFromAssignment={removeFromAssignment}
            changeTagInAssignment={changeTagInAssignment}
            savingMsg={savingMsg}
            events={events}
            addEvent={addEvent}
            updateEvent={updateEvent}
            deleteEvent={deleteEvent}
            addToEventTeam={addToEventTeam}
            removeFromEventTeam={removeFromEventTeam}
            adminLogout={signOut}
            addVolunteerManually={addVolunteerManually}
          />
        )}
      </div>

      {modalInfo && (
        <MaterialModal
          info={modalInfo}
          materials={materials}
          assignments={assignments}
          events={events}
          close={() => setModalInfo(null)}
        />
      )}
    </div>
  );
}

/* ---------- login / registro por email y contraseña (reutilizable) ---------- */

function EmailAuthForm({ authError, signIn, signUp, title }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setSending(true);
    if (mode === "signin") {
      await signIn(email.trim(), password);
    } else {
      await signUp(email.trim(), password);
    }
    setSending(false);
  }

  return (
    <div className="rk-card" style={{ maxWidth: 360 }}>
      {title && (
        <span className="rk-serif" style={{ fontSize: 18, fontWeight: 600, display: "block", marginBottom: 12 }}>
          {title}
        </span>
      )}
      <div className="rk-nav" style={{ marginBottom: 16, borderBottom: "2px solid var(--paper-warm)" }}>
        <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
          Iniciar sesión
        </button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
          Crear cuenta
        </button>
      </div>

      <span className="rk-label">Email</span>
      <input
        className="rk-input"
        type="email"
        style={{ marginBottom: 10 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <span className="rk-label">Contraseña</span>
      <input
        className="rk-input"
        type="password"
        style={{ marginBottom: 14 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
      {authError && <p style={{ color: "#a33", fontSize: 13, marginBottom: 10 }}>{authError}</p>}
      <button className="rk-btn rk-btn-primary" type="button" onClick={handleSubmit} disabled={sending}>
        {mode === "signin" ? "Ingresar" : "Crear cuenta"}
      </button>
      {mode === "signup" && (
        <p style={{ fontSize: 12.5, color: "var(--soil-light)", marginTop: 10 }}>
          Con este email y contraseña vas a poder entrar después para ver tus asignaciones.
        </p>
      )}
    </div>
  );
}

/* ---------- tab: mi anotación ---------- */

function MiAnotacion({
  stage, authLoading, session, authError, signIn, signUp, signOut,
  pickName, setPickName, pickRole, setPickRole,
  pickDays, toggleDay, sundays, monthLabel, submitRegistration, retryRegistration, me,
  myAssignments, openModal, upcomingEvents, pickEventIds, toggleEventPick,
  toggleEventInterest,
}) {
  if (authLoading) {
    return (
      <div className="rk-card">
        <p style={{ fontSize: 14 }}>Verificando sesión…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <EmailAuthForm
        authError={authError}
        signIn={signIn}
        signUp={signUp}
        title="Entrá con tu cuenta para anotarte"
      />
    );
  }

  if (stage === "register") {
    return (
      <div className="rk-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: "var(--soil-light)" }}>{session.user.email}</span>
          <button className="rk-btn rk-btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
        <div style={{ marginBottom: 18 }}>
          <span className="rk-serif" style={{ fontSize: 19, fontWeight: 600 }}>
            ¡Hola!
          </span>
          <p style={{ fontSize: 13.5, color: "var(--soil-light)", marginTop: 4 }}>
            Todavía no estás anotado/a. Completá tus datos y elegí los domingos de {monthLabel} en los que podés servir.
          </p>
        </div>

        <span className="rk-label">Tu nombre</span>
        <input
          className="rk-input"
          placeholder="Nombre y apellido"
          style={{ marginBottom: 18 }}
          value={pickName}
          onChange={(e) => setPickName(e.target.value)}
        />

        <span className="rk-label">Tu rol</span>
        <div className="rk-role-pick" style={{ marginBottom: 18 }}>
          <div
            className={`rk-role-opt ${pickRole === "maestro" ? "selected" : ""}`}
            onClick={() => setPickRole("maestro")}
          >
            Maestro/a
          </div>
          <div
            className={`rk-role-opt ${pickRole === "asistente" ? "selected" : ""}`}
            onClick={() => setPickRole("asistente")}
          >
            Asistente
          </div>
        </div>

        <span className="rk-label">Domingos disponibles</span>
        <div className="rk-day-grid" style={{ marginBottom: 20 }}>
          {sundays.map((d) => (
            <div
              key={d}
              className={`rk-day-chip ${pickDays.includes(d) ? "selected" : ""}`}
              onClick={() => toggleDay(d)}
            >
              {formatDateLong(d)}
            </div>
          ))}
        </div>

        {upcomingEvents.length > 0 && (
          <>
            <span className="rk-label">Eventos especiales (opcional)</span>
            <div className="rk-day-grid" style={{ marginBottom: 20 }}>
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`rk-day-chip ${pickEventIds.includes(ev.id) ? "selected" : ""}`}
                  onClick={() => toggleEventPick(ev.id)}
                  title={ev.title}
                >
                  {formatDateLong(ev.date)} · {ev.title}
                </div>
              ))}
            </div>
          </>
        )}

        <button
          className="rk-btn rk-btn-accent"
          disabled={!pickName.trim() || !pickRole || pickDays.length === 0}
          onClick={submitRegistration}
        >
          <Check size={16} /> Confirmar anotación
        </button>
      </div>
    );
  }

  if (stage === "saving") {
    return (
      <div className="rk-card">
        <p style={{ fontSize: 14 }}>Guardando tu anotación…</p>
      </div>
    );
  }

  if (stage === "save-failed" && me) {
    const resumen =
      `Anotación Raíces Kids\n` +
      `Nombre: ${me.name}\n` +
      `Rol: ${me.role === "maestro" ? "Maestro/a" : "Asistente"}\n` +
      `Disponibilidad: ${me.availability.map((d) => formatDateLong(d)).join(", ")}`;

    return (
      <div className="rk-card">
        <span className="rk-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--clay)" }}>
          No pudimos guardar tu anotación
        </span>
        <p style={{ fontSize: 13.5, marginTop: 8 }}>
          Puede ser un problema pasajero de conexión, o que tu cuenta de Claude no tenga
          acceso al guardado compartido. Probá lo siguiente:
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <button className="rk-btn rk-btn-accent" onClick={retryRegistration}>
            Reintentar
          </button>
          <button
            className="rk-btn rk-btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(resumen);
            }}
          >
            Copiar mis datos
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--soil-light)" }}>
          Si el reintento no funciona, tocá "Copiar mis datos" y enviaselos por WhatsApp
          al director para que te anote a mano desde el panel de Admin.
        </p>
      </div>
    );
  }

  if (stage === "status" && me) {
    return (
      <div>
        <div className="rk-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--soil-light)" }}>{session.user.email}</span>
            <button className="rk-btn rk-btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
          <span className="rk-serif" style={{ fontSize: 19, fontWeight: 600 }}>
            ¡Gracias, {me.name}!
          </span>
          <p style={{ fontSize: 14, marginTop: 6 }}>
            Ya estás anotado/a como{" "}
            <strong>{me.role === "maestro" ? "maestro/a" : "asistente"}</strong> para{" "}
            {monthLabel}.
          </p>
          <span className="rk-label" style={{ marginTop: 14 }}>
            Tu disponibilidad
          </span>
          <div className="rk-day-grid">
            {me.availability.map((d) => (
              <div key={d} className="rk-day-chip selected" style={{ cursor: "default" }}>
                {formatDateLong(d)}
              </div>
            ))}
          </div>
        </div>

        {upcomingEvents.length > 0 && (
          <div className="rk-card">
            <span className="rk-label">Eventos especiales</span>
            <p style={{ fontSize: 13, color: "var(--soil-light)", marginBottom: 10 }}>
              Marcá si querés sumarte a alguno; el director arma el equipo con los interesados.
            </p>
            {upcomingEvents.map((ev) => {
              const interested = (me.eventInterest || []).includes(ev.id);
              return (
                <div key={ev.id} className="rk-person-row" style={{ cursor: "default", marginBottom: 6 }}>
                  <span>
                    {formatDateLong(ev.date)} · {ev.title}
                  </span>
                  <button
                    className={interested ? "rk-btn rk-btn-ghost" : "rk-btn rk-btn-accent"}
                    style={{ padding: "5px 12px", fontSize: 12.5 }}
                    onClick={() => toggleEventInterest(ev.id)}
                  >
                    {interested ? "Ya anotado ✓" : "Sumarme"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="rk-card">
          <span className="rk-label">Tus asignaciones</span>
          {myAssignments.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--soil-light)" }}>
              Todavía no se sortearon los equipos, o no te tocó ningún domingo. Volvé a
              entrar más adelante para ver tu calendario.
            </p>
          ) : (
            myAssignments.map((a) => (
              <div
                key={a.kind === "sunday" ? a.date + a.group : a.eventId}
                className="rk-person-row mine"
                style={{ marginBottom: 8 }}
                onClick={() =>
                  a.kind === "sunday"
                    ? openModal({ kind: "sunday", date: a.date, group: a.group })
                    : openModal({ kind: "evento", eventId: a.eventId })
                }
              >
                <span>
                  {a.kind === "sunday"
                    ? `${formatDateLong(a.date)} · ${a.group === "peques" ? "Peques" : "Grandes"}`
                    : `${formatDateLong(a.date)} · ${a.title} (evento especial)`}
                </span>
                <ExternalLink size={14} />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}

/* ---------- tab: calendario público ---------- */

function Calendario({ sundays, monthLabel, assignments, me, openModal, events }) {
  const anyAssigned = Object.keys(assignments).length > 0;

  const items = [
    ...sundays.map((d) => ({ kind: "sunday", date: d })),
    ...events.map((ev) => ({ kind: "evento", date: ev.date, event: ev })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <CalendarDays size={18} color="var(--soil-light)" />
        <span className="rk-serif" style={{ fontSize: 18, fontWeight: 600 }}>
          {monthLabel}
        </span>
      </div>

      {!anyAssigned && events.length === 0 && (
        <div className="rk-card rk-empty">
          Los equipos todavía no fueron sorteados. Cuando el director genere la
          asignación, vas a ver acá quién sirve cada domingo.
        </div>
      )}

      {items.map((item) => {
        if (item.kind === "sunday") {
          const d = item.date;
          const day = assignments[d];
          return (
            <div key={d} className="rk-sunday-card">
              <div className="rk-sunday-head">{formatDateLong(d)}</div>
              <div className="rk-sunday-body">
                {["peques", "grandes"].map((g) => (
                  <div key={g} className="rk-group-col">
                    <div className="rk-group-label">{g === "peques" ? "PEQUES" : "GRANDES"}</div>
                    {day && day[g] && day[g].length > 0 ? (
                      day[g].map((p) => (
                        <div
                          key={p.id}
                          className={`rk-person-row ${me && p.id === me.id ? "mine" : ""}`}
                          onClick={() => openModal({ kind: "sunday", date: d, group: g })}
                        >
                          <span>{p.name}</span>
                          <span className={`rk-tag ${p.tag}`}>
                            {p.tag === "maestro" ? "Maestro/a" : "Asist."}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 12.5, color: "var(--soil-light)" }}>Sin asignar</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const ev = item.event;
        return (
          <div key={ev.id} className="rk-sunday-card">
            <div className="rk-sunday-head" style={{ background: "var(--clay)", display: "flex", justifyContent: "space-between" }}>
              <span>
                {formatDateLong(ev.date)} · {ev.title}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>EVENTO ESPECIAL</span>
            </div>
            <div style={{ padding: "14px 16px" }}>
              {ev.team.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--soil-light)" }}>Equipo sin armar todavía</p>
              ) : (
                ev.team.map((p) => (
                  <div
                    key={p.id}
                    className={`rk-person-row ${me && p.id === me.id ? "mine" : ""}`}
                    onClick={() => openModal({ kind: "evento", eventId: ev.id })}
                  >
                    <span>{p.name}</span>
                    <ExternalLink size={13} />
                  </div>
                ))
              )}
              {ev.team.length === 0 && (
                <button
                  className="rk-btn rk-btn-ghost"
                  style={{ marginTop: 6, padding: "6px 12px", fontSize: 12.5 }}
                  onClick={() => openModal({ kind: "evento", eventId: ev.id })}
                >
                  Ver indicaciones
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- modal de material ---------- */

function MaterialModal({ info, materials, assignments, events, close }) {
  if (info.kind === "evento") {
    const ev = events.find((e) => e.id === info.eventId);
    if (!ev) return null;
    const hasFiles = ev.files && Object.values(ev.files).some((v) => v);
    return (
      <div className="rk-modal-backdrop" onClick={close}>
        <div className="rk-modal" onClick={(e) => e.stopPropagation()}>
          <button className="rk-modal-close" onClick={close}>
            <X size={20} />
          </button>
          <span className="rk-label">{formatDateLong(ev.date)} · Evento especial</span>
          <div className="rk-serif" style={{ fontSize: 20, fontWeight: 600, margin: "6px 0 10px" }}>
            {ev.title}
          </div>
          {ev.instructions && (
            <p style={{ fontSize: 14, marginBottom: 14, whiteSpace: "pre-wrap" }}>{ev.instructions}</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FILES_SCHEMA.map(({ key: fkey, label }) => {
              const link = ev.files?.[fkey];
              if (!link) return null;
              return (
                <button
                  key={fkey}
                  type="button"
                  onClick={() => openInNewTab(link)}
                  className="rk-btn rk-btn-primary"
                  style={{ justifyContent: "space-between", width: "100%" }}
                >
                  {label} <ExternalLink size={15} />
                </button>
              );
            })}
            {!hasFiles && (
              <p style={{ fontSize: 13, color: "var(--soil-light)" }}>
                El director todavía no cargó materiales para este evento.
              </p>
            )}
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--paper-warm)" }}>
            <span className="rk-label">Equipo de este evento</span>
            {ev.team.length === 0 && <p style={{ fontSize: 13 }}>Sin asignar todavía.</p>}
            {ev.team.map((p) => (
              <div key={p.id} style={{ fontSize: 13.5, marginBottom: 3 }}>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const key = `${info.date}_${info.group}`;
  const mat = materials[key];
  const team = assignments[info.date]?.[info.group] || [];
  const hasFiles = mat?.files && Object.values(mat.files).some((v) => v);

  return (
    <div className="rk-modal-backdrop" onClick={close}>
      <div className="rk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rk-modal-close" onClick={close}>
          <X size={20} />
        </button>
        <span className="rk-label">
          {formatDateLong(info.date)} · {info.group === "peques" ? "Peques" : "Grandes"}
        </span>
        <div className="rk-serif" style={{ fontSize: 20, fontWeight: 600, margin: "6px 0 10px" }}>
          {mat?.title || "Material aún no cargado"}
        </div>
        {mat?.desc && <p style={{ fontSize: 14, marginBottom: 14 }}>{mat.desc}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FILES_SCHEMA.map(({ key: fkey, label }) => {
            const link = mat?.files?.[fkey];
            if (!link) return null;
            return (
              <button
                key={fkey}
                type="button"
                onClick={() => openInNewTab(link)}
                className="rk-btn rk-btn-primary"
                style={{ justifyContent: "space-between", width: "100%" }}
              >
                {label} <ExternalLink size={15} />
              </button>
            );
          })}
          {!hasFiles && (
            <p style={{ fontSize: 13, color: "var(--soil-light)" }}>
              El director todavía no cargó los materiales de esta clase.
            </p>
          )}
        </div>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--paper-warm)" }}>
          <span className="rk-label">Equipo de este día</span>
          {team.length === 0 && <p style={{ fontSize: 13 }}>Sin asignar todavía.</p>}
          {team.map((p) => (
            <div key={p.id} style={{ fontSize: 13.5, marginBottom: 3 }}>
              {p.name} — {p.tag === "maestro" ? "Maestro/a" : "Asistente"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- tab: padres ---------- */

function PadresSection({ sundays, monthLabel, materials }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Heart size={18} color="var(--soil-light)" />
        <span className="rk-serif" style={{ fontSize: 18, fontWeight: 600 }}>
          Nota para papás · {monthLabel}
        </span>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--soil-light)", marginBottom: 16 }}>
        Acá vas a encontrar, domingo a domingo, la nota con lo que trabajó tu hijo/a en su
        clase.
      </p>
      {sundays.map((d) => (
        <div key={d} className="rk-sunday-card">
          <div className="rk-sunday-head">{formatDateLong(d)}</div>
          <div className="rk-sunday-body">
            {["peques", "grandes"].map((g) => {
              const mat = materials[`${d}_${g}`];
              const link = mat?.files?.notaPadres;
              return (
                <div key={g} className="rk-group-col">
                  <div className="rk-group-label">{g === "peques" ? "PEQUES" : "GRANDES"}</div>
                  {link ? (
                    <button
                      type="button"
                      onClick={() => openInNewTab(link)}
                      className="rk-btn rk-btn-ghost"
                      style={{ fontSize: 13, padding: "8px 12px" }}
                    >
                      Ver nota <ExternalLink size={13} />
                    </button>
                  ) : (
                    <p style={{ fontSize: 12.5, color: "var(--soil-light)" }}>Todavía no cargada</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- admin: alta manual de voluntario ---------- */

function ManualVolunteerForm({ sundays, onAdd }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [days, setDays] = useState([]);

  function toggle(d) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function handleSubmit() {
    onAdd(name, role, days);
    setName("");
    setRole("");
    setDays([]);
  }

  return (
    <div>
      <input
        className="rk-input"
        placeholder="Nombre y apellido"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div className="rk-role-pick" style={{ marginBottom: 8 }}>
        <div className={`rk-role-opt ${role === "maestro" ? "selected" : ""}`} onClick={() => setRole("maestro")}>
          Maestro/a
        </div>
        <div className={`rk-role-opt ${role === "asistente" ? "selected" : ""}`} onClick={() => setRole("asistente")}>
          Asistente
        </div>
      </div>
      <div className="rk-day-grid" style={{ marginBottom: 10 }}>
        {sundays.map((d) => (
          <div key={d} className={`rk-day-chip ${days.includes(d) ? "selected" : ""}`} onClick={() => toggle(d)}>
            {formatDateLong(d)}
          </div>
        ))}
      </div>
      <button
        className="rk-btn rk-btn-ghost"
        onClick={handleSubmit}
        disabled={!name.trim() || !role || days.length === 0}
      >
        <Plus size={14} /> Agregar voluntario
      </button>
    </div>
  );
}

/* ---------- admin: login ---------- */

function AdminLogin({ authError, signIn, signUp }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Lock size={16} color="var(--soil-light)" />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Acceso del director</span>
      </div>
      <EmailAuthForm authError={authError} signIn={signIn} signUp={signUp} />
    </div>
  );
}

/* ---------- admin: panel ---------- */

function AdminPanel({
  config, adminMonthDraft, setAdminMonthDraft, saveMonth, volunteers, sundays,
  monthLabel, generateAssignments, clearAssignments, clearVolunteers, assignments,
  materialsDraft, updateMaterialField, saveMaterialsForDate, savedDates,
  addToAssignment, removeFromAssignment, changeTagInAssignment, savingMsg,
  events, addEvent, updateEvent, deleteEvent, addToEventTeam, removeFromEventTeam,
  adminLogout, addVolunteerManually,
}) {
  const [confirmClearV, setConfirmClearV] = useState(false);
  const [confirmClearA, setConfirmClearA] = useState(false);
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventInstr, setNewEventInstr] = useState("");

  function handleCreateEvent() {
    addEvent(newEventDate, newEventTitle, newEventInstr);
    setNewEventDate("");
    setNewEventTitle("");
    setNewEventInstr("");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button className="rk-btn rk-btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={adminLogout}>
          Cerrar sesión
        </button>
      </div>

      {savingMsg && (
        <div style={{ background: "#f2f6ec", color: "var(--soil)", padding: "8px 14px", borderRadius: 8, fontSize: 13.5, marginBottom: 14 }}>
          {savingMsg}
        </div>
      )}

      <div className="rk-card">
        <span className="rk-label">Mes de servicio</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="month"
            className="rk-input"
            value={adminMonthDraft}
            onChange={(e) => setAdminMonthDraft(e.target.value)}
          />
          <button className="rk-btn rk-btn-ghost" onClick={saveMonth}>
            Guardar
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--soil-light)", marginTop: 8 }}>
          Mes activo actual: {monthLabel}. Cambiar el mes abre nuevos domingos para que
          el equipo se anote.
        </p>
      </div>

      <div className="rk-card">
        <span className="rk-label">Agregar voluntario manualmente</span>
        <p style={{ fontSize: 13, color: "var(--soil-light)", marginBottom: 12 }}>
          Para cuando alguien te mande sus datos por WhatsApp porque no se le pudo
          guardar la anotación automática.
        </p>
        <ManualVolunteerForm sundays={sundays} onAdd={addVolunteerManually} />
      </div>

      <div className="rk-card">
        <span className="rk-label">Anotados ({volunteers.length})</span>
        {volunteers.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--soil-light)" }}>Todavía nadie se anotó.</p>
        ) : (
          <table className="rk-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Disponibilidad</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.role === "maestro" ? "Maestro/a" : "Asistente"}</td>
                  <td>{v.availability.map((d) => formatDateLong(d)).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {confirmClearV ? (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            ¿Borrar todas las anotaciones? Esta acción no se puede deshacer.
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="rk-btn rk-btn-danger" onClick={() => { clearVolunteers(); setConfirmClearV(false); }}>
                Sí, borrar
              </button>
              <button className="rk-btn rk-btn-ghost" onClick={() => setConfirmClearV(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          volunteers.length > 0 && (
            <button
              className="rk-btn rk-btn-danger"
              style={{ marginTop: 12 }}
              onClick={() => setConfirmClearV(true)}
            >
              <Trash2 size={14} /> Borrar anotaciones
            </button>
          )
        )}
      </div>

      <div className="rk-card">
        <span className="rk-label">Sorteo de equipos</span>
        <p style={{ fontSize: 13.5, marginBottom: 12 }}>
          Reparte a cada anotado en Peques o Grandes para cada domingo de {monthLabel},
          priorizando 1 maestro/a por grupo y equilibrando el resto con asistentes.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="rk-btn rk-btn-accent" onClick={generateAssignments}>
            <Shuffle size={15} /> Sortear equipos
          </button>
          {Object.keys(assignments).length > 0 && !confirmClearA && (
            <button className="rk-btn rk-btn-danger" onClick={() => setConfirmClearA(true)}>
              <Trash2 size={14} /> Borrar sorteo
            </button>
          )}
        </div>
        {confirmClearA && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            ¿Borrar el sorteo actual?
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="rk-btn rk-btn-danger" onClick={() => { clearAssignments(); setConfirmClearA(false); }}>
                Sí, borrar
              </button>
              <button className="rk-btn rk-btn-ghost" onClick={() => setConfirmClearA(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rk-card">
        <span className="rk-label">Ajustar equipos manualmente</span>
        <p style={{ fontSize: 13, color: "var(--soil-light)", marginBottom: 14 }}>
          Sacá, agregá o cambiá la etiqueta de alguien para un domingo puntual, por si el
          sorteo automático necesita un retoque.
        </p>
        {sundays.map((d) => (
          <ManualAssignRow
            key={d}
            date={d}
            day={assignments[d] || { peques: [], grandes: [] }}
            volunteers={volunteers}
            addToAssignment={addToAssignment}
            removeFromAssignment={removeFromAssignment}
            changeTagInAssignment={changeTagInAssignment}
          />
        ))}
      </div>

      <div className="rk-card">
        <span className="rk-label">Eventos especiales</span>
        <p style={{ fontSize: 13, color: "var(--soil-light)", marginBottom: 14 }}>
          Actividades puntuales fuera de los domingos (salidas, actos, campamentos) —
          cada una con su propio equipo, indicaciones y materiales.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 8 }}>
          <input
            type="date"
            className="rk-input"
            value={newEventDate}
            onChange={(e) => setNewEventDate(e.target.value)}
          />
          <input
            className="rk-input"
            placeholder="Título del evento (ej: Salida especial)"
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
          />
        </div>
        <textarea
          className="rk-input"
          rows={2}
          placeholder="Indicaciones o tareas (podés completarlo después)"
          value={newEventInstr}
          onChange={(e) => setNewEventInstr(e.target.value)}
          style={{ marginBottom: 10, resize: "vertical" }}
        />
        <button
          className="rk-btn rk-btn-accent"
          onClick={handleCreateEvent}
          disabled={!newEventDate || !newEventTitle.trim()}
        >
          <Plus size={15} /> Crear evento
        </button>

        {events.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--soil-light)", marginTop: 16 }}>
            Todavía no hay eventos especiales cargados.
          </p>
        ) : (
          <div style={{ marginTop: 18 }}>
            {events.map((ev) => (
              <EventAdminCard
                key={ev.id}
                event={ev}
                volunteers={volunteers}
                updateEvent={updateEvent}
                deleteEvent={deleteEvent}
                addToEventTeam={addToEventTeam}
                removeFromEventTeam={removeFromEventTeam}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rk-card">
        <span className="rk-label">Materiales por domingo</span>
        <p style={{ fontSize: 13, color: "var(--soil-light)", marginBottom: 14 }}>
          Cargá el título de la clase, una descripción breve y los links de Biper para
          cada archivo. Los cambios quedan en borrador hasta que tocás "Guardar este
          domingo".
        </p>
        {sundays.map((d) => (
          <MaterialDayEditor
            key={d}
            date={d}
            materialsDraft={materialsDraft}
            updateMaterialField={updateMaterialField}
            saveMaterialsForDate={saveMaterialsForDate}
            saved={savedDates[d]}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- admin: ajuste manual de un domingo ---------- */

function ManualAssignRow({ date, day, volunteers, addToAssignment, removeFromAssignment, changeTagInAssignment }) {
  const [open, setOpen] = useState(false);
  const [addGroup, setAddGroup] = useState("peques");
  const [addVolunteerId, setAddVolunteerId] = useState("");
  const [addTag, setAddTag] = useState("asistente");

  const assignedIds = new Set([...day.peques.map((p) => p.id), ...day.grandes.map((p) => p.id)]);
  const availableToAdd = volunteers.filter((v) => !assignedIds.has(v.id));

  function handleAdd() {
    if (!addVolunteerId) return;
    addToAssignment(date, addGroup, addVolunteerId, addTag);
    setAddVolunteerId("");
  }

  return (
    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--paper-warm)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{formatDateLong(date)}</span>
        <span style={{ fontSize: 12.5, color: "var(--soil-light)" }}>
          {day.peques.length + day.grandes.length} personas · {open ? "cerrar" : "editar"}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {["peques", "grandes"].map((g) => (
            <div key={g}>
              <div className="rk-group-label">{g === "peques" ? "PEQUES" : "GRANDES"}</div>
              {day[g].length === 0 && (
                <p style={{ fontSize: 12.5, color: "var(--soil-light)" }}>Nadie asignado.</p>
              )}
              {day[g].map((p) => (
                <div key={p.id} className="rk-person-row">
                  <span>{p.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select
                      value={p.tag}
                      onChange={(e) => changeTagInAssignment(date, g, p.id, e.target.value)}
                      style={{ fontSize: 12, border: "1px solid var(--paper-warm)", borderRadius: 6, padding: "2px 4px" }}
                    >
                      <option value="maestro">Maestro/a</option>
                      <option value="asistente">Asistente</option>
                    </select>
                    <button
                      className="rk-btn rk-btn-danger"
                      style={{ padding: "3px 8px", fontSize: 12 }}
                      onClick={() => removeFromAssignment(date, g, p.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
            <select
              className="rk-input"
              style={{ width: "auto" }}
              value={addVolunteerId}
              onChange={(e) => setAddVolunteerId(e.target.value)}
            >
              <option value="">Agregar a alguien…</option>
              {availableToAdd.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.role === "maestro" ? "maestro/a" : "asistente"})
                </option>
              ))}
            </select>
            <select className="rk-input" style={{ width: "auto" }} value={addGroup} onChange={(e) => setAddGroup(e.target.value)}>
              <option value="peques">Peques</option>
              <option value="grandes">Grandes</option>
            </select>
            <select className="rk-input" style={{ width: "auto" }} value={addTag} onChange={(e) => setAddTag(e.target.value)}>
              <option value="maestro">Como maestro/a</option>
              <option value="asistente">Como asistente</option>
            </select>
            <button className="rk-btn rk-btn-ghost" onClick={handleAdd} disabled={!addVolunteerId}>
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- admin: tarjeta de un evento especial ---------- */

function EventAdminCard({ event, volunteers, updateEvent, deleteEvent, addToEventTeam, removeFromEventTeam }) {
  const [open, setOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event.title);
  const [instrDraft, setInstrDraft] = useState(event.instructions);
  const [filesDraft, setFilesDraft] = useState(event.files || emptyFilesObject());
  const [saved, setSaved] = useState(false);
  const [addVolunteerId, setAddVolunteerId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assignedIds = new Set(event.team.map((p) => p.id));
  const availableToAdd = volunteers.filter((v) => !assignedIds.has(v.id));
  const interested = volunteers.filter((v) => (v.eventInterest || []).includes(event.id));

  async function handleSave() {
    await updateEvent(event.id, { title: titleDraft, instructions: instrDraft, files: filesDraft });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  function handleAdd() {
    if (!addVolunteerId) return;
    addToEventTeam(event.id, addVolunteerId);
    setAddVolunteerId("");
  }

  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--paper-warm)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {formatDateLong(event.date)} · {event.title}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--soil-light)" }}>
          {event.team.length} en el equipo · {open ? "cerrar" : "editar"}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <span className="rk-label">Título del evento</span>
          <input
            className="rk-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <span className="rk-label">Indicaciones / tareas</span>
          <textarea
            className="rk-input"
            rows={3}
            value={instrDraft}
            onChange={(e) => setInstrDraft(e.target.value)}
            style={{ marginBottom: 10, resize: "vertical" }}
          />

          <span className="rk-label">Archivos</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {FILES_SCHEMA.map(({ key: fkey, label }) => (
              <input
                key={fkey}
                className="rk-input"
                placeholder={`Link · ${label}`}
                value={filesDraft[fkey] || ""}
                onChange={(e) => setFilesDraft({ ...filesDraft, [fkey]: e.target.value })}
              />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {saved && (
              <span style={{ fontSize: 12.5, color: "var(--leaf)", display: "flex", alignItems: "center", gap: 4 }}>
                <Check size={13} /> Guardado
              </span>
            )}
            <button className="rk-btn rk-btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={handleSave}>
              Guardar cambios
            </button>
          </div>

          <span className="rk-label">Equipo del evento</span>
          {event.team.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--soil-light)" }}>Nadie asignado todavía.</p>
          )}
          {event.team.map((p) => (
            <div key={p.id} className="rk-person-row">
              <span>{p.name}</span>
              <button
                className="rk-btn rk-btn-danger"
                style={{ padding: "3px 8px", fontSize: 12 }}
                onClick={() => removeFromEventTeam(event.id, p.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <select
              className="rk-input"
              style={{ width: "auto" }}
              value={addVolunteerId}
              onChange={(e) => setAddVolunteerId(e.target.value)}
            >
              <option value="">Agregar a alguien…</option>
              {availableToAdd.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {(v.eventInterest || []).includes(event.id) ? " ⭐ interesado/a" : ""}
                </option>
              ))}
            </select>
            <button className="rk-btn rk-btn-ghost" onClick={handleAdd} disabled={!addVolunteerId}>
              <Plus size={14} /> Agregar
            </button>
          </div>
          {interested.length > 0 && (
            <p style={{ fontSize: 12, color: "var(--soil-light)", marginTop: 8 }}>
              ⭐ Marcaron interés: {interested.map((v) => v.name).join(", ")}
            </p>
          )}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--paper-warm)" }}>
            {confirmDelete ? (
              <div style={{ fontSize: 13 }}>
                ¿Borrar este evento? Esta acción no se puede deshacer.
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="rk-btn rk-btn-danger" onClick={() => deleteEvent(event.id)}>
                    Sí, borrar
                  </button>
                  <button className="rk-btn rk-btn-ghost" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button className="rk-btn rk-btn-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Borrar evento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialDayEditor({ date, materialsDraft, updateMaterialField, saveMaterialsForDate, saved }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--paper-warm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{formatDateLong(date)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saved && (
            <span style={{ fontSize: 12.5, color: "var(--leaf)", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={13} /> Guardado
            </span>
          )}
          <button className="rk-btn rk-btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => saveMaterialsForDate(date)}>
            Guardar este domingo
          </button>
        </div>
      </div>
      {["peques", "grandes"].map((g) => {
        const key = `${date}_${g}`;
        const mat = materialsDraft[key] || defaultMaterial();
        return (
          <div key={g} style={{ marginBottom: 12 }}>
            <span className="rk-label" style={{ marginBottom: 4 }}>
              {g === "peques" ? "Peques" : "Grandes"}
            </span>
            <input
              className="rk-input"
              placeholder="Título de la clase"
              style={{ marginBottom: 6 }}
              value={mat.title}
              onChange={(e) => updateMaterialField(date, g, "title", e.target.value)}
            />
            <input
              className="rk-input"
              placeholder="Descripción breve"
              style={{ marginBottom: 6 }}
              value={mat.desc}
              onChange={(e) => updateMaterialField(date, g, "desc", e.target.value)}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {FILES_SCHEMA.map(({ key: fkey, label }) => (
                <input
                  key={fkey}
                  className="rk-input"
                  placeholder={`Link · ${label}`}
                  value={mat.files?.[fkey] || ""}
                  onChange={(e) => updateMaterialField(date, g, fkey, e.target.value)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
