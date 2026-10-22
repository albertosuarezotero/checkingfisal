import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import fisalrentLogo from "@/assets/fisalrent-logo.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "fisalrent_client_session";

export const PORTAL_CHECKLIST = [
  { id: "niveles", label: "Niveles (aceite / refrigerante)", icon: "🛢️" },
  { id: "fugas", label: "Fugas", icon: "💧" },
  { id: "luces", label: "Luces y señalización", icon: "💡" },
  { id: "rodadura", label: "Neumáticos / Orugas", icon: "🛞" },
  { id: "cazo_caja", label: "Cazo / Caja de carga", icon: "🪣" },
  { id: "escalera", label: "Escalera / Peldaños", icon: "🪜" },
  { id: "seguridad", label: "Seguridad (extintor, cinturón)", icon: "🧯" },
];

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function setSession(c) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(c));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const page = { minHeight: "100vh", background: "#f1f3f7", color: "#1e293b", fontFamily: "'DM Sans', system-ui, sans-serif" };
const card = { background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 12, padding: 18 };
const input = { width: "100%", background: "#ffffff", border: "1px solid #cdd6e1", borderRadius: 8, padding: "11px 12px", color: "#1e293b", fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" };
const label = { fontSize: 10, color: "#64748b", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, display: "block" };
const primaryBtn = { width: "100%", background: "#f5b800", border: "none", borderRadius: 10, padding: "14px", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" };

function PortalHeader({ subtitle, onExit }) {
  return (
    <div style={{ background: "#ffffff", borderBottom: "1px solid #e3e8ef", padding: "14px 18px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={fisalrentLogo.url} alt="FISALRENT" style={{ height: 34, width: "auto", background: "#fff", padding: "4px 8px", borderRadius: 6 }} />
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase" }}>{subtitle}</div>
        </div>
        {onExit && (
          <button onClick={onExit} style={{ background: "none", border: "1px solid #e3e8ef", borderRadius: 6, padding: "7px 12px", color: "#64748b", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
            Salir
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- login */

export function ClientLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s?.id) navigate({ to: "/cliente/maquinas" });
  }, [navigate]);

  const enter = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("clients")
      .select("id, name, access_code, active")
      .eq("access_code", clean)
      .maybeSingle();
    setLoading(false);
    if (err) { setError("No se pudo conectar. Inténtalo de nuevo."); return; }
    if (!data) { setError("Código no válido. Revísalo con FISALRENT."); return; }
    if (!data.active) { setError("Este acceso está desactivado. Contacta con FISALRENT."); return; }
    setSession({ id: data.id, name: data.name, code: data.access_code });
    navigate({ to: "/cliente/maquinas" });
  };

  return (
    <div style={page}>
      <PortalHeader subtitle="Portal de cliente" />
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          Parte <span style={{ color: "#f5b800" }}>diario</span>
        </div>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 28 }}>
          Introduce el código que te ha facilitado FISALRENT para ver tus máquinas alquiladas.
        </p>
        <div style={card}>
          <label style={label}>Código de cliente</label>
          <input
            style={{ ...input, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") enter(); }}
            placeholder="FISAL-0000"
          />
          {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>{error}</div>}
          <div style={{ marginTop: 16 }}>
            <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} disabled={loading} onClick={enter}>
              {loading ? "Comprobando…" : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- machines */

export function ClientMachines() {
  const navigate = useNavigate();
  const [session, setSess] = useState(null);
  const [machines, setMachines] = useState([]);
  const [checkedToday, setCheckedToday] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s?.id) { navigate({ to: "/cliente" }); return; }
    setSess(s);
    (async () => {
      const [flR, cmR, dcR] = await Promise.all([
        supabase.from("fleet").select("machine_id, data"),
        supabase.from("custom_machines").select("data"),
        supabase.from("daily_checks").select("machine_id").eq("client_id", s.id).eq("check_date", todayISO()),
      ]);
      const mine = (flR.data || []).filter((r) => r.data && r.data.clientId === s.id);
      const byId = {};
      (cmR.data || []).forEach((r) => { byId[String(r.data.id)] = r.data; });
      setMachines(mine.map((r) => ({ ...(byId[String(r.machine_id)] || { id: r.machine_id, name: r.machine_id, image: "🚜" }), fleet: r.data })));
      const done = {};
      (dcR.data || []).forEach((r) => { done[String(r.machine_id)] = true; });
      setCheckedToday(done);
      setLoading(false);
    })();
  }, [navigate]);

  const exit = () => { clearSession(); navigate({ to: "/cliente" }); };

  return (
    <div style={page}>
      <PortalHeader subtitle="Portal de cliente" onExit={exit} />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
          Hola, {session?.name || "cliente"}
        </div>
        <p style={{ color: "#475569", fontSize: 13, margin: "4px 0 24px" }}>
          Tus máquinas alquiladas. Rellena el parte diario de cada una.
        </p>

        {loading && <div style={{ color: "#475569", fontSize: 13 }}>Cargando…</div>}

        {!loading && machines.length === 0 && (
          <div style={{ ...card, textAlign: "center", color: "#475569", fontSize: 13 }}>
            No tienes máquinas alquiladas ahora mismo.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {machines.map((m) => {
            const done = checkedToday[String(m.id)];
            return (
              <button
                key={m.id}
                onClick={() => navigate({ to: "/cliente/parte/$machineId", params: { machineId: String(m.id) } })}
                style={{ ...card, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, width: "100%", fontFamily: "inherit" }}
              >
                <div style={{ fontSize: 30 }}>{m.image}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{m.serial} {m.fleet?.location ? `· 📍 ${m.fleet.location}` : ""}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "5px 10px", borderRadius: 14, letterSpacing: 0.6, background: done ? "#10b98120" : "#f5b80020", color: done ? "#10b981" : "#f5b800", border: `1px solid ${done ? "#10b98140" : "#f5b80040"}` }}>
                  {done ? "PARTE ENVIADO ✓" : "PENDIENTE HOY"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- daily check */

function compress(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: ((t.clientX - r.left) / r.width) * c.width, y: ((t.clientY - r.top) / r.height) * c.height };
  };

  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = "#f5b800"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onChange(null); };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width: "100%", height: 150, background: "#ffffff", border: "1px dashed #cdd6e1", borderRadius: 8, touchAction: "none" }}
      />
      <button onClick={clear} style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 6, padding: "6px 12px", color: "#64748b", fontFamily: "inherit", fontSize: 11, cursor: "pointer", marginTop: 8 }}>
        Borrar firma
      </button>
    </div>
  );
}

export function ClientDailyCheck({ machineId }) {
  const navigate = useNavigate();
  const [session, setSess] = useState(null);
  const [machine, setMachine] = useState(null);
  const [checks, setChecks] = useState(() => Object.fromEntries(PORTAL_CHECKLIST.map((c) => [c.id, "ok"])));
  const [hours, setHours] = useState("");
  const [operator, setOperator] = useState("");
  const [incident, setIncident] = useState(false);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [photos, setPhotos] = useState([]);
  const [signature, setSignature] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const notify = useCallback((text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s?.id) { navigate({ to: "/cliente" }); return; }
    setSess(s);
    (async () => {
      const [cmR, dcR] = await Promise.all([
        supabase.from("custom_machines").select("data").eq("id", String(machineId)).maybeSingle(),
        supabase.from("daily_checks").select("summary, check_date").eq("machine_id", String(machineId)).eq("client_id", s.id).order("check_date", { ascending: false }).limit(15),
      ]);
      setMachine(cmR.data?.data || { id: machineId, name: machineId, image: "🚜" });
      setHistory((dcR.data || []).map((r) => r.summary).filter(Boolean));
      const today = (dcR.data || []).find((r) => r.check_date === todayISO());
      if (today?.summary) {
        const t = today.summary;
        setChecks((p) => ({ ...p, ...(t.checks || {}) }));
        setHours(t.hours || "");
        setOperator(t.operator || "");
        setIncident(!!t.incident);
        setIncidentDesc(t.incidentDesc || "");
      }
    })();
  }, [machineId, navigate]);

  const addPhotos = async (files) => {
    const list = Array.from(files).slice(0, 6);
    const out = [];
    for (const f of list) out.push(await compress(f));
    setPhotos((p) => [...p, ...out].slice(0, 8));
  };

  const submit = async () => {
    if (!operator.trim()) { notify("Indica el nombre del operador", "error"); return; }
    if (incident && !incidentDesc.trim()) { notify("Describe la incidencia", "error"); return; }
    setSaving(true);
    const date = todayISO();
    const record = {
      id: `${machineId}_${date}`,
      clientId: session.id,
      clientName: session.name,
      machineId: String(machineId),
      machineName: machine?.name || String(machineId),
      machineSerial: machine?.serial || "",
      date,
      createdAt: new Date().toISOString(),
      checks,
      hours,
      operator,
      incident,
      incidentDesc,
      signature,
      photos,
      hasFailures: Object.values(checks).some((v) => v !== "ok"),
    };
    const { error } = await supabase.from("daily_checks").upsert(
      { id: record.id, client_id: session.id, machine_id: String(machineId), check_date: date, data: record },
      { onConflict: "machine_id,check_date" },
    );
    setSaving(false);
    if (error) { notify(`No se pudo guardar: ${error.message}`, "error"); return; }
    notify("Parte diario enviado ✓");
    const { photos: _p, signature: _s, ...summary } = record;
    setHistory((h) => [{ ...summary, photoCount: photos.length }, ...h.filter((x) => x.date !== date)]);
    setPhotos([]);
    setTimeout(() => navigate({ to: "/cliente/maquinas" }), 1200);
  };

  return (
    <div style={page}>
      <PortalHeader subtitle="Parte diario" onExit={() => navigate({ to: "/cliente/maquinas" })} />
      {msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 50, background: msg.type === "error" ? "#ef444420" : "#10b98120", border: `1px solid ${msg.type === "error" ? "#ef4444" : "#10b981"}`, color: msg.type === "error" ? "#ef4444" : "#10b981", borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 700 }}>
          {msg.text}
        </div>
      )}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 32 }}>{machine?.image || "🚜"}</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{machine?.name || "Máquina"}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>{machine?.serial} · {new Date().toLocaleDateString("es-ES")}</div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f5b800", marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Checklist rápido</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PORTAL_CHECKLIST.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e3e8ef", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 13, color: "#1e293b" }}>{c.icon} {c.label}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["ok", "OK", "#10b981"], ["atencion", "Atención", "#f59e0b"], ["fallo", "Fallo", "#ef4444"]].map(([v, l, col]) => (
                    <button key={v} onClick={() => setChecks((p) => ({ ...p, [c.id]: v }))}
                      style={{ border: `1px solid ${checks[c.id] === v ? col : "#cdd6e1"}`, background: checks[c.id] === v ? `${col}20` : "transparent", color: checks[c.id] === v ? col : "#475569", borderRadius: 6, padding: "5px 9px", fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={label}>Horómetro (horas)</label>
            <input style={input} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Ej. 4.520" inputMode="decimal" />
          </div>
          <div>
            <label style={label}>Operador</label>
            <input style={input} value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nombre y apellidos" />
          </div>
        </div>

        <div style={card}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", color: "#1e293b", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={incident} onChange={(e) => setIncident(e.target.checked)} style={{ accentColor: "#ef4444", width: 16, height: 16 }} />
            ⚠️ Hay una incidencia que comunicar
          </label>
          {incident && (
            <textarea rows={3} value={incidentDesc} onChange={(e) => setIncidentDesc(e.target.value)} placeholder="Describe la incidencia…"
              style={{ ...input, marginTop: 12, resize: "none" }} />
          )}
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f5b800", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Fotos</div>
          <label style={{ display: "inline-block", background: "#f5b80020", border: "1px dashed #f5b80060", borderRadius: 8, padding: "10px 16px", color: "#f5b800", fontSize: 11, fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.8 }}>
            📷 Añadir fotos
            <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => addPhotos(e.target.files)} style={{ display: "none" }} />
          </label>
          {photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginTop: 12 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={p} alt={`Foto ${i + 1}`} style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 6, border: "1px solid #e3e8ef" }} />
                  <button onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ position: "absolute", top: 3, right: 3, background: "#ffffffcc", border: "none", color: "#ef4444", borderRadius: 4, cursor: "pointer", fontSize: 12, padding: "0 5px" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f5b800", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Firma del operador</div>
          <SignaturePad onChange={setSignature} />
        </div>

        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={submit}>
          {saving ? "Enviando…" : "Enviar parte diario"}
        </button>

        {history.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Mis partes anteriores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.map((h) => (
                <div key={h.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1px solid #e3e8ef", borderRadius: 8, padding: "9px 12px", fontSize: 12 }}>
                  <span style={{ color: "#1e293b" }}>{h.date} · {h.operator}</span>
                  <span style={{ color: h.incident || h.hasFailures ? "#ef4444" : "#10b981", fontWeight: 700, fontSize: 11 }}>
                    {h.incident || h.hasFailures ? "⚠ Con incidencia" : "✓ Correcto"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
