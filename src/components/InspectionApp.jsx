import { Component, useState, useRef, useCallback, useEffect } from "react";
import jsPDF from "jspdf";
import fisalrentLogo from "@/assets/fisalrent-logo.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v).replace(/\r?\n/g, " ");
    return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(";"), ...rows.map(r => headers.map(h => esc(r[h])).join(";"))].join("\n");
}

function exportCSV(rows, filename) {
  downloadBlob("\uFEFF" + toCSV(rows), filename, "text/csv;charset=utf-8;");
}

function exportListPDF(title, rows, filename) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 12;
  doc.setFillColor(8, 12, 18); doc.rect(0, 0, pageW, 22, "F");
  doc.setFillColor(245, 184, 0); doc.rect(0, 22, pageW, 1.2, "F");
  doc.setTextColor(245, 184, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("FISALRENT", margin, 12);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(title, margin, 18);
  doc.setFontSize(9); doc.text(new Date().toLocaleString("es-ES"), pageW - margin, 12, { align: "right" });
  doc.text(`Total: ${rows.length}`, pageW - margin, 18, { align: "right" });

  let y = 30;
  doc.setTextColor(30, 30, 30); doc.setFontSize(9);
  if (!rows.length) {
    doc.text("Sin datos.", margin, y);
  } else {
    const headers = Object.keys(rows[0]);
    const colW = (pageW - margin * 2) / headers.length;
    doc.setFont("helvetica", "bold"); doc.setFillColor(230, 230, 230);
    doc.rect(margin, y - 4, pageW - margin * 2, 6, "F");
    headers.forEach((h, i) => doc.text(String(h), margin + i * colW + 1, y));
    y += 5;
    doc.setFont("helvetica", "normal");
    rows.forEach((r, idx) => {
      if (y > pageH - 15) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(margin, y - 4, pageW - margin * 2, 6, "F"); }
      headers.forEach((h, i) => {
        const raw = r[h] == null ? "" : String(r[h]).replace(/\r?\n/g, " ");
        const txt = doc.splitTextToSize(raw, colW - 2)[0] || "";
        doc.text(txt, margin + i * colW + 1, y);
      });
      y += 5;
    });
  }
  doc.save(filename);
}

const exportBtnStyle = { background: "none", border: "1px solid #cdd6e1", borderRadius: 6, padding: "6px 12px", color: "#94a3b8", fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" };


function generateInspectionPDF(insp) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 14;
  let y = 14;

  // Header band
  doc.setFillColor(8, 12, 18);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setFillColor(245, 184, 0);
  doc.rect(0, 26, pageW, 1.5, "F");
  doc.setTextColor(245, 184, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FISALRENT", margin, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Informe de inspeccion de maquinaria Komatsu", margin, 20);
  doc.setFontSize(9);
  doc.text(insp.date, pageW - margin, 13, { align: "right" });
  doc.text(`ID: ${insp.id}`, pageW - margin, 20, { align: "right" });
  y = 36;

  // Type badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(insp.type === "salida" ? 59 : 245, insp.type === "salida" ? 130 : 158, insp.type === "salida" ? 246 : 11);
  doc.text(insp.type === "salida" ? "INSPECCION DE SALIDA" : "INSPECCION DE ENTRADA", margin, y);
  y += 8;

  // Machine block
  doc.setDrawColor(220);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(insp.machine.name, margin + 4, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`${insp.machine.serial}  -  ${insp.machine.category}`, margin + 4, y + 14);
  doc.text(`Combustible: ${insp.fuelLevel}    Horas/Km: ${insp.km || "-"}`, margin + 4, y + 19);
  y += 28;

  // Data section
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos de la inspeccion", margin, y);
  y += 5;
  doc.setDrawColor(245, 184, 0);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const rows = [
    ["Cliente", insp.client],
    ["Operario", insp.operator],
    ["Firma", insp.signName],
  ];
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v || "-"), margin + 28, y);
    y += 5.5;
  });
  y += 3;

  // Checklist
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Checklist tecnico", margin, y);
  y += 5;
  doc.setDrawColor(245, 184, 0);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(9);
  Object.entries(insp.checklist).forEach(([id, status]) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const colors = { ok: [16, 185, 129], defecto: [239, 68, 68], "n/a": [120, 120, 120] };
    const labels = { ok: "OK", defecto: "DEFECTO", "n/a": "N/A" };
    const [r, g, b] = colors[status];
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin, y - 3.5, 22, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(labels[status], margin + 11, y, { align: "center" });
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.text(id, margin + 26, y);
    const note = insp.checkNotes?.[id];
    if (note) {
      doc.setTextColor(120, 120, 120);
      doc.text(`- ${note}`, margin + 70, y);
    }
    y += 6;
  });
  y += 3;

  // Damages
  if (insp.damages.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`Desperfectos registrados (${insp.damages.length})`, margin, y);
    y += 5;
    doc.setDrawColor(245, 184, 0);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(9);
    insp.damages.forEach(d => {
      if (y > 275) { doc.addPage(); y = 20; }
      const sevColor = d.severity === "grave" ? [239, 68, 68] : d.severity === "moderado" ? [245, 158, 11] : [120, 120, 120];
      doc.setFillColor(...sevColor);
      doc.roundedRect(margin, y - 3.5, 22, 5, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(String(d.severity || "leve").toUpperCase(), margin + 11, y, { align: "center" });
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.text(`${d.zone} - ${d.type}`, margin + 26, y);
      y += 5;
      if (d.desc) {
        doc.setTextColor(110, 110, 110);
        const lines = doc.splitTextToSize(d.desc, pageW - margin * 2 - 26);
        doc.text(lines, margin + 26, y);
        y += lines.length * 4.5;
      }
      y += 2;
    });
  }

  // Notes
  if (insp.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("Notas generales", margin, y);
    y += 5;
    doc.setDrawColor(245, 184, 0);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(insp.notes, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5;
  }

  // Photos
  const inspPhotos = Array.isArray(insp.photos) ? insp.photos : [];
  if (inspPhotos.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`Fotografias (${inspPhotos.length})`, margin, y);
    y += 4;
    doc.setDrawColor(245, 184, 0);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    const colW = (pageW - margin * 2 - 6) / 2;
    const rowH = 60;
    let col = 0;
    inspPhotos.forEach(p => {
      if (y + rowH > 285) { doc.addPage(); y = 20; col = 0; }
      const x = margin + col * (colW + 6);
      try {
        doc.addImage(p.src, "JPEG", x, y, colW, rowH, undefined, "FAST");
      } catch (e) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("(imagen no disponible)", x + 2, y + 8);
      }
      col++;
      if (col >= 2) { col = 0; y += rowH + 6; }
    });
  }

  // Footer on each page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`FISALRENT - Informe de inspeccion - ${insp.machine.name}`, margin, 292);
    doc.text(`Pagina ${i} / ${pages}`, pageW - margin, 292, { align: "right" });
  }

  const safeName = `${insp.machine.name}-${insp.type}-${insp.id}`.replace(/[^a-z0-9\-]/gi, "_");
  doc.save(`Inspeccion_${safeName}.pdf`);
}



const CHECKLIST = [
  { id: "motor", label: "Motor / Arranque", icon: "⚙️", group: "Motor" },
  { id: "aceite", label: "Nivel de aceite", icon: "🛢️", group: "Motor" },
  { id: "refrigerante", label: "Nivel refrigerante", icon: "🌡️", group: "Motor" },
  { id: "hidraulico", label: "Sistema hidráulico", icon: "🔩", group: "Hidráulica" },
  { id: "mangueras", label: "Mangueras / Fugas", icon: "💧", group: "Hidráulica" },
  { id: "neumaticos", label: "Neumáticos", icon: "🛞", group: "Ruedas" },
  { id: "orugas", label: "Orugas", icon: "⛓️", group: "Orugas" },
  { id: "frenos", label: "Frenos", icon: "🛑", group: "Rodadura" },
  { id: "luces", label: "Luces y señalización", icon: "💡", group: "Eléctrico" },
  { id: "bateria", label: "Batería", icon: "🔋", group: "Eléctrico" },
  { id: "cabina", label: "Cabina / Asiento", icon: "🪑", group: "Cabina" },
  { id: "cinturon", label: "Cinturón de seguridad", icon: "🔐", group: "Cabina" },
  { id: "extint", label: "Extintor", icon: "🧯", group: "Seguridad" },
  { id: "cazo", label: "Cazo", icon: "🪣", group: "Cazo" },
  { id: "cazo_dientes", label: "Dientes del cazo", icon: "🦷", group: "Cazo" },
  { id: "cazo_bulones", label: "Bulones / Pasadores del cazo", icon: "🔗", group: "Cazo" },
  { id: "caja_carga", label: "Caja de carga", icon: "🗜️", group: "Caja" },
  { id: "caja_desgaste", label: "Desgaste de caja", icon: "🔩", group: "Caja" },
  { id: "caja_fugas", label: "Fugas / Grietas en caja", icon: "💧", group: "Caja" },
  { id: "escalera", label: "Escalera / Peldaños", icon: "🪜", group: "Escalera" },
  
  { id: "escalera_barandilla", label: "Barandilla / Pasamanos", icon: "🛡️", group: "Escalera" },
  
  { id: "docs", label: "Documentación / Manual", icon: "📋", group: "Documentación" },
];

// Almacén local (IndexedDB) para el borrador de la inspección en curso; admite fotos grandes.
function draftDB(op, value) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open("fisalrent-draft", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("draft");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("draft", op === "get" ? "readonly" : "readwrite");
      const store = tx.objectStore("draft");
      const r = op === "get" ? store.get("current") : op === "set" ? store.put(value, "current") : store.delete("current");
      r.onsuccess = () => { resolve(op === "get" ? r.result : null); db.close(); };
      r.onerror = () => { reject(r.error); db.close(); };
    };
  });
}

const DAMAGE_ZONES = [
  { id: "frontal", label: "Frontal", x: 42, y: 10 },
  { id: "trasera", label: "Trasera", x: 42, y: 75 },
  { id: "lateral_izq", label: "Lateral Izq.", x: 5, y: 42 },
  { id: "lateral_der", label: "Lateral Der.", x: 79, y: 42 },
  { id: "superior", label: "Superior", x: 42, y: 42 },
  { id: "cabina", label: "Cabina", x: 25, y: 28 },
  { id: "brazo", label: "Brazo/Pluma", x: 65, y: 28 },
  { id: "tren_rod", label: "Tren rodaje", x: 42, y: 62 },
];

const DAMAGE_TYPES = ["Arañazo", "Abolladura", "Rotura", "Corrosión", "Deformación", "Otro"];

const STATUS_CONFIG = {
  ok: { color: "#10b981", label: "OK", icon: "✓" },
  defecto: { color: "#ef4444", label: "Defecto", icon: "✗" },
  "n/a": { color: "#475569", label: "N/A", icon: "—" },
};

function PhotoCapture({ photos, onAdd, onRemove }) {
  const fileRef = useRef();

  // Low-memory compression: decode via object URL (no huge base64 copy of the original)
  const compress = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", 0.6);
        canvas.width = 0; canvas.height = 0;
        resolve(out);
      } catch (e) { reject(e); }
      finally { URL.revokeObjectURL(url); img.src = ""; }
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });

  const handleFile = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    for (const file of files) {
      try {
        const src = await compress(file);
        onAdd({ id: Date.now() + Math.random(), src, name: file.name, size: (file.size / 1024).toFixed(0) + "KB", ts: new Date().toLocaleTimeString() });
      } catch (err) { console.error(err); }
    }
  };


  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFile} style={{ display: "none" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
        <button onClick={() => fileRef.current.click()} style={{ background: "#ffffff", border: "2px dashed #cdd6e1", borderRadius: 10, padding: "24px 10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#475569", transition: "all 0.2s", fontFamily: "inherit" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#d5af2a"; e.currentTarget.style.color = "#d5af2a"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#cdd6e1"; e.currentTarget.style.color = "#475569"; }}>
          <span style={{ fontSize: 28 }}>📷</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Añadir foto</span>
        </button>
        {photos.map(p => (
          <div key={p.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #e3e8ef", aspectRatio: "1" }}>
            <img src={p.src} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
            <div style={{ position: "absolute", bottom: 6, left: 6, right: 6 }}>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{p.ts}</div>
            </div>
            <button onClick={() => onRemove(p.id)} style={{ position: "absolute", top: 6, right: 6, background: "#ef4444", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Si algo falla dentro de un paso del informe, se muestra un aviso en ese paso
// en lugar de cerrar toda la app (y se conservan los datos ya introducidos).
class StepBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Error en el paso del informe:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#ef444410", border: "1px solid #ef444440", borderRadius: 10, padding: 20, color: "#fca5a5", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ Algo ha fallado en este paso, pero tu inspección no se ha perdido.</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>{String(this.state.error?.message || this.state.error)}</div>
          <button type="button" onClick={() => this.setState({ error: null })} style={{ background: "#d5af2a", border: "none", borderRadius: 6, padding: "8px 16px", color: "#0f172a", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DamageMapper({ damages, onAdd, onRemove, machine }) {
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({ type: "Arañazo", desc: "", severity: "leve" });
  const [justAdded, setJustAdded] = useState(false);
  const list = Array.isArray(damages) ? damages.filter(d => d && typeof d === "object") : [];

  const handleZoneClick = (zoneId) => {
    setActive(active === zoneId ? null : zoneId);
    setJustAdded(false);
  };

  const handleAdd = () => {
    if (!active) return;
    onAdd({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, zone: active, type: String(form.type || ""), desc: String(form.desc || ""), severity: String(form.severity || "leve") });
    setActive(null);
    setForm({ type: "Arañazo", desc: "", severity: "leve" });
    setJustAdded(true);
  };

  const zoneHasDamage = (zoneId) => list.some(d => d.zone === zoneId);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {/* Visual map */}
        <div>
          <p style={{ fontSize: 11, color: "#475569", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>Toca una zona para marcar desperfecto</p>
          <div style={{ position: "relative", background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 12, padding: "16px", aspectRatio: "1" }}>
            {/* Machine silhouette grid */}
            <div style={{ position: "absolute", inset: "16px", border: "1px solid #e3e8ef", borderRadius: 8, background: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(30,42,61,0.3) 10px, rgba(30,42,61,0.3) 11px)" }} />
            <div style={{ position: "absolute", inset: "28px", border: "2px solid #e3e8ef", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 72, opacity: 0.35, lineHeight: 1 }}>{machine?.image || "🚜"}</span>
              {machine && (
                <div style={{ textAlign: "center", opacity: 0.6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5 }}>{machine.name}</div>
                  <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{machine.serial}</div>
                </div>
              )}
            </div>
            {DAMAGE_ZONES.map(zone => {
              const hasDmg = zoneHasDamage(zone.id);
              const isActive = active === zone.id;
              return (
                <button type="button" key={zone.id} onClick={() => handleZoneClick(zone.id)} style={{
                  position: "absolute", left: `${zone.x}%`, top: `${zone.y}%`, transform: "translate(-50%,-50%)",
                  width: isActive ? 36 : 28, height: isActive ? 36 : 28, borderRadius: "50%",
                  border: `2px solid ${isActive ? "#d5af2a" : hasDmg ? "#ef4444" : "#cdd6e1"}`,
                  background: isActive ? "#d5af2a20" : hasDmg ? "#ef444420" : "#ffffff",
                  cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: isActive ? "#d5af2a" : hasDmg ? "#ef4444" : "#475569", fontWeight: 800,
                  zIndex: 2, fontFamily: "inherit",
                  boxShadow: isActive ? "0 0 12px #d5af2a40" : hasDmg ? "0 0 8px #ef444440" : "none"
                }}>
                  {hasDmg ? "!" : "+"}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11 }}>
            <span style={{ color: "#475569" }}>⬤ Sin daño</span>
            <span style={{ color: "#ef4444" }}>⬤ Con daño</span>
            <span style={{ color: "#d5af2a" }}>⬤ Seleccionado</span>
          </div>
        </div>

        {/* Form / legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active ? (
            <div style={{ background: "#ffffff", border: "1px solid #d5af2a40", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d5af2a", marginBottom: 12 }}>
                📍 {DAMAGE_ZONES.find(z => z.id === active)?.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} style={{ background: "#ffffff", border: "1px solid #cdd6e1", borderRadius: 6, padding: "8px 10px", color: "#1e293b", fontFamily: "inherit", fontSize: 13 }}>
                  {DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <div style={{ display: "flex", gap: 6 }}>
                  {["leve","moderado","grave"].map(s => (
                    <button type="button" key={s} onClick={() => setForm(p => ({...p, severity: s}))} style={{
                      flex: 1, padding: "7px 4px", border: `1px solid ${form.severity === s ? (s==="leve"?"#10b981":s==="moderado"?"#f59e0b":"#ef4444") : "#cdd6e1"}`,
                      background: form.severity === s ? (s==="leve"?"#10b98115":s==="moderado"?"#f59e0b15":"#ef444415") : "transparent",
                      color: form.severity === s ? (s==="leve"?"#10b981":s==="moderado"?"#f59e0b":"#ef4444") : "#475569",
                      borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: 0.5, textTransform: "capitalize"
                    }}>{s}</button>
                  ))}
                </div>
                <textarea value={form.desc} onChange={e => setForm(p => ({...p, desc: e.target.value}))} placeholder="Descripción del desperfecto..." rows={3} style={{ background: "#ffffff", border: "1px solid #cdd6e1", borderRadius: 6, padding: "8px 10px", color: "#1e293b", fontFamily: "inherit", fontSize: 13, resize: "none", outline: "none" }} />
                <button type="button" onClick={handleAdd} style={{ background: "#d5af2a", border: "none", borderRadius: 6, padding: "10px", color: "#0f172a", fontFamily: "inherit", fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                  Registrar Desperfecto
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 10, padding: 16, color: "#475569", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{justAdded ? "✅" : "👆"}</div>
              {justAdded && <p style={{ fontSize: 12, color: "#10b981", fontWeight: 700, marginBottom: 6 }}>Desperfecto registrado correctamente</p>}
              <p style={{ fontSize: 12 }}>{justAdded ? "Puedes marcar otra zona o pulsar Siguiente para continuar" : "Selecciona una zona en el diagrama para registrar un desperfecto"}</p>
            </div>
          )}

          {/* Damage list */}
          {list.length > 0 && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Desperfectos registrados</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {list.map((d, i) => (
                  <div key={`${d.id}-${i}`} style={{ background: "#ffffff", border: `1px solid ${d.severity==="grave"?"#ef444440":d.severity==="moderado"?"#f59e0b40":"#10b98140"}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{DAMAGE_ZONES.find(z=>z.id===d.zone)?.label} · {d.type}</div>
                      {d.desc && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{d.desc}</div>}
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: d.severity==="grave"?"#ef4444":d.severity==="moderado"?"#f59e0b":"#10b981", marginTop: 4, display: "inline-block" }}>● {d.severity}</span>
                    </div>
                    <button type="button" onClick={() => onRemove(d.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: "0 4px", fontFamily: "inherit" }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Datos", "Checklist", "Fotos", "Desperfectos", "Firma & Envío"];

export default function InspectionApp() {
  const [view, setView] = useState("home"); // home | new | history | fleet
  const [step, setStep] = useState(0);
  const [inspType, setInspType] = useState(null); // "salida" | "entrada"
  const [inspections, setInspections] = useState([]);
  const [fleet, setFleet] = useState({});
  const [fleetFilter, setFleetFilter] = useState("all");
  const [customMachines, setCustomMachines] = useState([]);
  const [clients, setClients] = useState([]);
  const [dailyChecks, setDailyChecks] = useState([]);
  const [checkFilters, setCheckFilters] = useState({ client: "", machine: "", date: "" });
  const [hideMissingAlert, setHideMissingAlert] = useState(false);

  const [clientForm, setClientForm] = useState({ name: "", cif: "", contact: "", phone: "", email: "", site: "" });
  const [editingClientId, setEditingClientId] = useState(null);

  // Initial load from Lovable Cloud + realtime sync (shared across all users/devices)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [insR, flR, cmR, clR, dcR] = await Promise.all([
        supabase.from("inspections").select("summary").order("created_at", { ascending: false }),
        supabase.from("fleet").select("machine_id, data"),
        supabase.from("custom_machines").select("data").order("created_at", { ascending: true }),
        supabase.from("clients").select("*").order("created_at", { ascending: true }),
        supabase.from("daily_checks").select("summary, check_date").order("check_date", { ascending: false }).limit(500),
      ]);
      if (cancelled) return;
      if (insR.error) console.error(insR.error);
      if (insR.data) setInspections(insR.data.map(r => r.summary).filter(Boolean));
      if (clR.error) console.error(clR.error);
      if (clR.data) setClients(clR.data);
      if (dcR.error) console.error(dcR.error);
      if (dcR.data) setDailyChecks(dcR.data.map(r => r.summary).filter(Boolean));
      if (flR.data) {
        const obj = {};
        flR.data.forEach(r => { obj[r.machine_id] = r.data; });
        setFleet(obj);
      }
      if (cmR.data) setCustomMachines(cmR.data.map(r => r.data));
    })();

    const channel = supabase
      .channel("fisalrent-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "inspections" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new.summary || payload.new.data;
          if (!row) return;
          setInspections(prev => prev.some(i => String(i.id) === String(row.id)) ? prev : [row, ...prev]);
        } else if (payload.eventType === "DELETE") {
          setInspections(prev => prev.filter(i => String(i.id) !== String(payload.old.id)));
        }
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "fleet" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setFleet(prev => { const n = { ...prev }; delete n[payload.old.machine_id]; return n; });
        } else {
          setFleet(prev => ({ ...prev, [payload.new.machine_id]: payload.new.data }));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_machines" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setCustomMachines(prev => prev.some(m => String(m.id) === String(payload.new.data.id)) ? prev : [...prev, payload.new.data]);
        } else if (payload.eventType === "DELETE") {
          setCustomMachines(prev => prev.filter(m => String(m.id) !== String(payload.old.id)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setClients(prev => prev.filter(c => c.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setClients(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new]);
        } else {
          setClients(prev => prev.map(c => (c.id === payload.new.id ? payload.new : c)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setDailyChecks(prev => prev.filter(d => String(d.id) !== String(payload.old.id)));
        } else {
          const row = payload.new.summary;
          if (!row) return;
          setDailyChecks(prev => [row, ...prev.filter(d => String(d.id) !== String(row.id))]);
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const updateFleet = (machineId, patch) => {
    setFleet(prev => {
      const next = { ...(prev[machineId] || {}), ...patch };
      supabase.from("fleet").upsert({ machine_id: String(machineId), data: next, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) console.error(error); });
      return { ...prev, [machineId]: next };
    });
  };
  const [expandedMachine, setExpandedMachine] = useState(null);



  const allMachines = customMachines;

  // Form state
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [client, setClient] = useState("");
  const [operator, setOperator] = useState("");
  const [km, setKm] = useState("");
  const [fuelLevel, setFuelLevel] = useState("3/4");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState(() => Object.fromEntries(CHECKLIST.map(c => [c.id, "ok"])));
  const [checkNotes, setCheckNotes] = useState({});
  const [photos, setPhotos] = useState([]);
  const [damages, setDamages] = useState([]);
  const [signName, setSignName] = useState("");
  const [notification, setNotification] = useState(null);

  // Machine management form state
  const [machineForm, setMachineForm] = useState({ name: "", serial: "", category: "", image: "🚜" });
  const MACHINE_ICONS = ["🚜", "🏗️", "🚛", "🦺", "⛏️", "🔧", "⚙️", "🏭"];

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // El listado del historial se carga sin fotos (rendimiento). Al pedir el PDF
  // se recupera la inspección completa desde la base de datos.
  const downloadPDF = async (insp) => {
    let full = insp;
    const needsPhotos = !Array.isArray(insp.photos) || (insp.photoCount > 0 && insp.photos.length === 0);
    if (needsPhotos && insp.type !== "alquiler") {
      const { data, error } = await supabase.from("inspections").select("data").eq("id", String(insp.id)).maybeSingle();
      if (error) console.error(error);
      if (data?.data) full = data.data;
    }
    try { generateInspectionPDF({ ...full, photos: Array.isArray(full.photos) ? full.photos : [] }); }
    catch (e) { console.error(e); notify("Error al generar el PDF", "error"); }
  };



  // ---- Borrador automático de la inspección en curso (sobrevive a recargas/cierres) ----
  const draftLoaded = useRef(false);
  useEffect(() => {
    let alive = true;
    draftDB("get").then(d => {
      if (!alive) return;
      draftLoaded.current = true;
      if (!d || !d.inspType) return;
      setView("new"); setStep(d.step || 0); setInspType(d.inspType); setSelectedMachine(d.selectedMachine || null);
      setClient(d.client || ""); setOperator(d.operator || ""); setKm(d.km || ""); setFuelLevel(d.fuelLevel || "3/4"); setNotes(d.notes || "");
      if (d.checklist) setChecklist(prev => ({ ...prev, ...d.checklist }));
      setCheckNotes(d.checkNotes || {}); setPhotos(d.photos || []); setDamages(d.damages || []); setSignName(d.signName || "");
      notify("📝 Se ha recuperado la inspección que tenías a medias");
    }).catch(() => { draftLoaded.current = true; });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!draftLoaded.current) return;
    if (!inspType) return;
    const t = setTimeout(() => {
      draftDB("set", { step, inspType, selectedMachine, client, operator, km, fuelLevel, notes, checklist, checkNotes, photos, damages, signName }).catch(e => console.error(e));
    }, 400);
    return () => clearTimeout(t);
  }, [step, inspType, selectedMachine, client, operator, km, fuelLevel, notes, checklist, checkNotes, photos, damages, signName]);

  const resetForm = () => {
    setStep(0); setInspType(null); setSelectedMachine(null);
    setClient(""); setOperator(""); setKm(""); setFuelLevel("3/4"); setNotes("");
    setChecklist(Object.fromEntries(CHECKLIST.map(c => [c.id, "ok"])));
    setCheckNotes({}); setPhotos([]); setDamages([]); setSignName("");
    draftDB("clear").catch(() => {});
  };

  const handleSubmit = async () => {
    if (!signName.trim()) { notify("Introduce el nombre para la firma", "error"); return; }
    const insp = {
      id: Date.now(),
      type: inspType,
      machine: selectedMachine,
      client, operator, km, fuelLevel, notes,
      checklist: { ...checklist }, checkNotes: { ...checkNotes },
      photos: [...photos], damages: [...damages],
      signName, date: new Date().toLocaleString("es-ES"),
      defectCount: damages.length,
      failCount: Object.values(checklist).filter(v => v === "defecto").length,
    };
    const currentType = inspType;
    setInspections(prev => [insp, ...prev]);
    try { generateInspectionPDF(insp); } catch (e) { console.error(e); }
    resetForm();
    setView("history");

    const { error } = await supabase.from("inspections").insert({ id: String(insp.id), data: insp });
    if (error) {
      console.error(error);
      setInspections(prev => prev.filter(i => String(i.id) !== String(insp.id)));
      notify("Error al guardar la inspección: " + error.message, "error");
      return;
    }
    notify(currentType === "salida" ? "✅ Inspección de salida registrada · PDF descargado" : "✅ Inspección de entrada registrada · PDF descargado");
  };


  const canProceed = () => {
    if (step === 0) return selectedMachine && client && operator;
    return true;
  };

  const groups = [...new Set(CHECKLIST.map(c => c.group))];
  const defectItems = CHECKLIST.filter(c => checklist[c.id] === "defecto");
  const overallStatus = damages.length === 0 && defectItems.length === 0 ? "ok" : damages.some(d => d.severity === "grave") || defectItems.length > 2 ? "grave" : "aviso";

  const FUEL_LEVELS = ["Vacío", "1/4", "1/2", "3/4", "Lleno"];

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#f1f3f7", minHeight: "100vh", color: "#1e293b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #ffffff; } ::-webkit-scrollbar-thumb { background: #d5af2a; border-radius: 3px; }
        button { cursor: pointer; }
        textarea, input, select { outline: none; }
        .check-btn { background: none; border: 1.5px solid #e3e8ef; border-radius: 6px; padding: 6px 12px; color: #475569; font-family: inherit; font-size: 11px; font-weight: 500; letter-spacing: 0.5px; cursor: pointer; transition: all 0.15s; }
        .check-btn.ok { border-color: #10b981; color: #10b981; background: #10b98112; }
        .check-btn.defecto { border-color: #ef4444; color: #ef4444; background: #ef444412; }
        .check-btn.na { border-color: #475569; color: #94a3b8; background: #47556920; }
        .step-dot { width: 8px; height: 8px; border-radius: 50%; transition: all 0.3s; }
        .notif { position: fixed; top: 16px; right: 16px; padding: 12px 18px; border-radius: 8px; font-size: 12px; font-weight: 500; z-index: 200; animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { transform: translateY(-16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .insp-card { background: #ffffff; border: 1px solid #e3e8ef; border-radius: 10px; padding: 16px; transition: border-color 0.2s; }
        .insp-card:hover { border-color: #cdd6e1; }
        .field-label { font-size: 10px; color: #475569; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 6px; }
        .field-input { background: #ffffff; border: 1px solid #e3e8ef; border-radius: 6px; padding: 10px 12px; color: #1e293b; font-family: inherit; font-size: 13px; width: 100%; transition: border-color 0.2s; }
        .field-input:focus { border-color: #d5af2a; }
        .type-card { background: #ffffff; border: 2px solid #e3e8ef; border-radius: 14px; padding: 28px 20px; cursor: pointer; text-align: center; transition: all 0.25s; flex: 1; }
        .type-card:hover { transform: translateY(-3px); }
      `}</style>

      {notification && (
        <div className="notif" style={{ background: notification.type === "error" ? "#ef4444" : "#d5af2a", color: notification.type === "error" ? "#ffffff" : "#0f172a" }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e3e8ef", padding: "14px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={fisalrentLogo.url} alt="FISALRENT" style={{ height: 40, width: "auto", background: "#fff", padding: "4px 8px", borderRadius: 6 }} />
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, textTransform: "uppercase", borderLeft: "1px solid #e3e8ef", paddingLeft: 12 }}>
              Inspección de<br/>maquinaria Komatsu
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {[["home","🏠 Inicio"],["new","+ Nueva Inspección"],["machines","⚙️ Máquinas"],["fleet","🚛 Flota"],["clients","👥 Clientes"],["checks","📋 Partes diarios"],["history","📁 Historial"]].map(([v, label]) => (
              <button key={v} onClick={() => { if (v !== "new") { setView(v); resetForm(); } else { setView("new"); setStep(0); } }}
                style={{ background: view === v ? "#d5af2a15" : "none", border: `1px solid ${view === v ? "#d5af2a" : "#e3e8ef"}`, borderRadius: 6, padding: "7px 14px", color: view === v ? "#d5af2a" : "#64748b", fontFamily: "inherit", fontSize: 11, fontWeight: 500, letterSpacing: 0.5, transition: "all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

        {/* HOME */}
        {view === "home" && (
          <div>
            <div style={{ textAlign: "center", padding: "40px 0 48px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "#0f172a", letterSpacing: -1, marginBottom: 12 }}>
                Inspecciones de <span style={{ color: "#d5af2a" }}>Maquinaria</span>
              </div>
              <p style={{ color: "#475569", fontSize: 14, maxWidth: 480, margin: "0 auto 32px" }}>
                Registra el estado de cada máquina antes de la salida y a la vuelta con fotos, checklist técnico y mapa de desperfectos.
              </p>
              <button onClick={() => setView("new")} style={{ background: "#d5af2a", border: "none", borderRadius: 10, padding: "14px 36px", color: "#0f172a", fontFamily: "inherit", fontSize: 13, fontWeight: 500, letterSpacing: 1, cursor: "pointer" }}>
                + Nueva Inspección
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 40 }}>
              {[
                { icon: "🚜", title: "Inspección de Salida", desc: "Documenta el estado antes de la entrega al cliente", color: "#3b82f6" },
                { icon: "🔄", title: "Inspección de Entrada", desc: "Revisa y compara el estado a la devolución", color: "#f59e0b" },
                { icon: "📊", title: "Historial Completo", desc: "Accede a todos los registros anteriores", color: "#10b981" },
              ].map((item, i) => (
                <div key={i} className="insp-card" style={{ textAlign: "center", padding: 24 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>{item.title}</div>
                  <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {inspections.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, marginBottom: 14 }}>Últimas inspecciones</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {inspections.slice(0, 3).map(insp => (
                    <div key={insp.id} className="insp-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 24 }}>{insp.machine.image}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{insp.machine.name}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{insp.client} · {insp.date}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: insp.type === "alquiler" ? "#10b98120" : insp.type === "salida" ? "#3b82f620" : "#f59e0b20", color: insp.type === "alquiler" ? "#10b981" : insp.type === "salida" ? "#3b82f6" : "#f59e0b", border: `1px solid ${insp.type === "alquiler" ? "#10b98140" : insp.type === "salida" ? "#3b82f640" : "#f59e0b40"}` }}>
                        {insp.type === "alquiler" ? "📦 ALQUILER" : insp.type === "salida" ? "↑ SALIDA" : "↓ ENTRADA"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NEW INSPECTION */}
        {view === "new" && (
          <div>
            {/* Type selection */}
            {!inspType ? (
              <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 20 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Nueva Inspección</div>
                <p style={{ color: "#475569", fontSize: 13, marginBottom: 32 }}>¿Es una inspección de salida o de entrada?</p>
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    { type: "salida", icon: "🚀", title: "Inspección de SALIDA", desc: "La máquina sale a cliente. Documenta su estado actual.", color: "#3b82f6" },
                    { type: "entrada", icon: "🏁", title: "Inspección de ENTRADA", desc: "La máquina regresa. Compara y registra novedades.", color: "#f59e0b" },
                  ].map(opt => (
                    <button key={opt.type} className="type-card" onClick={() => setInspType(opt.type)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = opt.color; e.currentTarget.style.boxShadow = `0 0 20px ${opt.color}20`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e3e8ef"; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>{opt.icon}</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>{opt.title}</div>
                      <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {/* Step indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32, background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "14px 20px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`, background: "linear-gradient(90deg, #d5af2a10, transparent)", transition: "width 0.4s ease" }} />
                  {STEPS.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, gap: 8, position: "relative" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${i <= step ? "#d5af2a" : "#cdd6e1"}`, background: i < step ? "#d5af2a" : i === step ? "#d5af2a20" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: i < step ? "#0f172a" : i === step ? "#d5af2a" : "#475569", fontWeight: 700, flexShrink: 0, transition: "all 0.3s" }}>
                        {i < step ? "✓" : i + 1}
                      </div>
                      <span style={{ fontSize: 10, color: i === step ? "#d5af2a" : i < step ? "#64748b" : "#cdd6e1", fontWeight: 500, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{s}</span>
                      {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? "#d5af2a40" : "#e3e8ef", margin: "0 8px" }} />}
                    </div>
                  ))}
                </div>

                {/* Badge */}
                <div style={{ display: "flex", gap: 10, marginBottom: 24, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: inspType === "salida" ? "#3b82f620" : "#f59e0b20", color: inspType === "salida" ? "#3b82f6" : "#f59e0b", border: `1px solid ${inspType === "salida" ? "#3b82f640" : "#f59e0b40"}`, letterSpacing: 1, textTransform: "uppercase" }}>
                    {inspType === "salida" ? "↑ SALIDA" : "↓ ENTRADA"}
                  </span>
                  {selectedMachine && <span style={{ fontSize: 12, color: "#64748b" }}>{selectedMachine.image} {selectedMachine.name}</span>}
                </div>

                {/* STEP 0: DATOS */}
                {step === 0 && (
                  <div>
                    <SectionTitle>Datos de la Inspección</SectionTitle>
                    <div style={{ display: "grid", gap: 20 }}>
                      <div>
                        <label className="field-label">Selecciona la máquina *</label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                          {allMachines.map(m => (
                            <button key={m.id} onClick={() => setSelectedMachine(m)} style={{
                              background: selectedMachine?.id === m.id ? "#d5af2a15" : "#ffffff",
                              border: `1.5px solid ${selectedMachine?.id === m.id ? "#d5af2a" : "#e3e8ef"}`,
                              borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", transition: "all 0.2s", fontFamily: "inherit"
                            }}>
                              <span style={{ fontSize: 24 }}>{m.image}</span>
                              <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: selectedMachine?.id === m.id ? "#d5af2a" : "#1e293b" }}>{m.name}</div>
                                <div style={{ fontSize: 10, color: "#475569" }}>{m.serial}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label className="field-label">Cliente / Empresa *</label>
                          <input className="field-input" placeholder="Nombre del cliente..." value={client} onChange={e => setClient(e.target.value)} />
                        </div>
                        <div>
                          <label className="field-label">Operario responsable *</label>
                          <input className="field-input" placeholder="Nombre del operario..." value={operator} onChange={e => setOperator(e.target.value)} />
                        </div>
                        <div>
                          <label className="field-label">Horómetro / Km actuales</label>
                          <input className="field-input" placeholder="ej. 1520 h" value={km} onChange={e => setKm(e.target.value)} />
                        </div>
                        <div>
                          <label className="field-label">Nivel de combustible</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            {FUEL_LEVELS.map(f => (
                              <button key={f} onClick={() => setFuelLevel(f)} style={{ flex: 1, padding: "8px 4px", border: `1px solid ${fuelLevel === f ? "#d5af2a" : "#e3e8ef"}`, background: fuelLevel === f ? "#d5af2a15" : "#ffffff", color: fuelLevel === f ? "#d5af2a" : "#475569", borderRadius: 6, fontSize: 10, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s" }}>{f}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="field-label">Notas generales</label>
                        <textarea className="field-input" rows={3} placeholder="Observaciones iniciales..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: "none" }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 1: CHECKLIST */}
                {step === 1 && (
                  <div>
                    <SectionTitle>Checklist Técnico</SectionTitle>
                    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                      {[["ok", "#10b981"], ["defecto", "#ef4444"], ["n/a", "#475569"]].map(([s, c]) => (
                        <div key={s} style={{ fontSize: 11, color: c, border: `1px solid ${c}40`, padding: "4px 10px", borderRadius: 12 }}>
                          {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}: {Object.values(checklist).filter(v => v === s).length}
                        </div>
                      ))}
                    </div>
                    {groups.map(group => (
                      <div key={group} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #e3e8ef" }}>{group}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {CHECKLIST.filter(c => c.group === group).map(item => (
                            <div key={item.id} style={{ background: "#ffffff", border: `1px solid ${checklist[item.id] === "defecto" ? "#ef444430" : "#e3e8ef"}`, borderRadius: 8, padding: "10px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 13, color: "#94a3b8" }}>{item.icon} {item.label}</span>
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                  {["ok", "defecto", "n/a"].map(s => (
                                    <button key={s} className={`check-btn ${checklist[item.id] === s ? s === "n/a" ? "na" : s : ""}`} onClick={() => setChecklist(p => ({ ...p, [item.id]: s }))}>
                                      {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {checklist[item.id] === "defecto" && (
                                <input className="field-input" style={{ marginTop: 8, fontSize: 12, padding: "7px 10px" }} placeholder="Describe el defecto encontrado..." value={checkNotes[item.id] || ""} onChange={e => setCheckNotes(p => ({ ...p, [item.id]: e.target.value }))} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 2: FOTOS */}
                {step === 2 && (
                  <div>
                    <SectionTitle>Registro Fotográfico</SectionTitle>
                    <p style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>Añade fotos del estado actual de la máquina. Puedes usar la cámara del dispositivo.</p>
                    <PhotoCapture photos={photos} onAdd={p => setPhotos(prev => [...prev, p])} onRemove={id => setPhotos(prev => prev.filter(p => p.id !== id))} />
                    {photos.length === 0 && (
                      <div style={{ background: "#ffffff", border: "1px dashed #cdd6e1", borderRadius: 10, padding: 24, textAlign: "center", marginTop: 16, color: "#475569", fontSize: 12 }}>
                        ⚠️ Se recomienda añadir al menos 4 fotos (frontal, trasera y laterales)
                      </div>
                    )}
                    {photos.length > 0 && (
                      <div style={{ marginTop: 16, padding: "10px 14px", background: "#d5af2a10", border: "1px solid #d5af2a30", borderRadius: 8, fontSize: 12, color: "#d5af2a" }}>
                        ✓ {photos.length} foto{photos.length > 1 ? "s" : ""} registrada{photos.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: DESPERFECTOS */}
                {step === 3 && (
                  <div>
                    <SectionTitle>Mapa de Desperfectos</SectionTitle>
                    <p style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>Marca las zonas afectadas en el diagrama y detalla el tipo y gravedad.</p>
                    <StepBoundary><DamageMapper machine={selectedMachine} damages={damages} onAdd={d => setDamages(prev => [...(Array.isArray(prev) ? prev : []), d])} onRemove={id => setDamages(prev => (Array.isArray(prev) ? prev : []).filter(d => d && d.id !== id))} /></StepBoundary>
                    {damages.length === 0 && (
                      <div style={{ marginTop: 16, padding: "10px 14px", background: "#10b98110", border: "1px solid #10b98130", borderRadius: 8, fontSize: 12, color: "#10b981" }}>
                        ✓ Sin desperfectos registrados
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 4: FIRMA */}
                {step === 4 && (
                  <div>
                    <SectionTitle>Resumen y Firma</SectionTitle>
                    {/* Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                      {[
                        ["Máquina", `${selectedMachine?.image} ${selectedMachine?.name}`],
                        ["Cliente", client],
                        ["Operario", operator],
                        ["Combustible", fuelLevel],
                        ["Horómetro", km || "—"],
                        ["Fotos", `${photos.length} foto${photos.length !== 1 ? "s" : ""}`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{k}</div>
                          <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Alert summary */}
                    <div style={{ background: overallStatus === "ok" ? "#10b98112" : overallStatus === "aviso" ? "#f59e0b12" : "#ef444412", border: `1px solid ${overallStatus === "ok" ? "#10b98130" : overallStatus === "aviso" ? "#f59e0b30" : "#ef444430"}`, borderRadius: 10, padding: "16px 18px", marginBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: overallStatus === "ok" ? "#10b981" : overallStatus === "aviso" ? "#f59e0b" : "#ef4444", marginBottom: 8 }}>
                        {overallStatus === "ok" ? "✅ Sin incidencias" : overallStatus === "aviso" ? "⚠️ Incidencias leves" : "🚨 Incidencias graves"}
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748b" }}>
                        <span>Checklist: {Object.values(checklist).filter(v => v === "defecto").length} defectos</span>
                        <span>Desperfectos: {damages.length}</span>
                        {damages.some(d => d.severity === "grave") && <span style={{ color: "#ef4444" }}>⚠ {damages.filter(d => d.severity === "grave").length} graves</span>}
                      </div>
                    </div>

                    {/* Signature */}
                    <div style={{ background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 10, padding: 20 }}>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>Confirmo que los datos de esta inspección son correctos:</div>
                      <label className="field-label">Nombre completo del firmante *</label>
                      <input className="field-input" placeholder="Nombre y apellidos..." value={signName} onChange={e => setSignName(e.target.value)} />
                      <div style={{ marginTop: 12, fontSize: 11, color: "#475569" }}>
                        📅 Fecha y hora: {new Date().toLocaleString("es-ES")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, paddingTop: 20, borderTop: "1px solid #e3e8ef" }}>
                  <button onClick={() => step === 0 ? setInspType(null) : setStep(p => p - 1)} style={{ background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 8, padding: "11px 22px", color: "#64748b", fontFamily: "inherit", fontSize: 12, fontWeight: 500, letterSpacing: 0.5, transition: "all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#cdd6e1"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#e3e8ef"}>
                    ← Atrás
                  </button>
                  {step < STEPS.length - 1 ? (
                    <button onClick={() => { if (!canProceed()) { notify("Completa los campos obligatorios", "error"); return; } setStep(p => p + 1); }} style={{ background: "#d5af2a", border: "none", borderRadius: 8, padding: "11px 28px", color: "#0f172a", fontFamily: "inherit", fontSize: 12, fontWeight: 500, letterSpacing: 1, cursor: "pointer", opacity: canProceed() ? 1 : 0.5 }}>
                      Siguiente →
                    </button>
                  ) : (
                    <button onClick={handleSubmit} style={{ background: "#d5af2a", border: "none", borderRadius: 8, padding: "11px 28px", color: "#0f172a", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>
                      ✓ Finalizar Inspección
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLIENTES */}
        {view === "clients" && (
          <div>
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Clientes</div>
                <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Fichas de cliente y código de acceso al portal del parte diario</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={exportBtnStyle} onClick={() => exportCSV(clients.map(c => ({
                  Cliente: c.name, CIF: c.cif || "", Contacto: c.contact || "", Telefono: c.phone || "", Email: c.email || "", Obra: c.site || "", Codigo: c.access_code, Activo: c.active ? "Si" : "No",
                })), `clientes_${new Date().toISOString().slice(0,10)}.csv`)}>⬇ CSV</button>
                <button style={exportBtnStyle} onClick={() => exportListPDF("Listado de Clientes", clients.map(c => ({
                  Cliente: c.name, Contacto: c.contact || "", Telefono: c.phone || "", Codigo: c.access_code, Activo: c.active ? "Si" : "No",
                })), `clientes_${new Date().toISOString().slice(0,10)}.pdf`)}>⬇ PDF</button>
              </div>
            </div>

            <div className="insp-card" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d5af2a", marginBottom: 16 }}>{editingClientId ? "✏️ Editar cliente" : "+ Alta de cliente"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="field-label">Nombre / Empresa *</label><input className="field-input" value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} placeholder="Construcciones Ejemplo S.L." /></div>
                <div><label className="field-label">CIF</label><input className="field-input" value={clientForm.cif} onChange={e => setClientForm(p => ({ ...p, cif: e.target.value }))} placeholder="B12345678" /></div>
                <div><label className="field-label">Persona de contacto</label><input className="field-input" value={clientForm.contact} onChange={e => setClientForm(p => ({ ...p, contact: e.target.value }))} placeholder="Nombre y apellidos" /></div>
                <div><label className="field-label">Teléfono</label><input className="field-input" value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="600 000 000" /></div>
                <div><label className="field-label">Email</label><input className="field-input" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="cliente@empresa.com" /></div>
                <div><label className="field-label">Obra / Dirección</label><input className="field-input" value={clientForm.site} onChange={e => setClientForm(p => ({ ...p, site: e.target.value }))} placeholder="Obra o zona habitual" /></div>
              </div>
              <button
                onClick={async () => {
                  if (!clientForm.name.trim()) { notify("Indica el nombre del cliente", "error"); return; }
                  if (editingClientId) {
                    const updates = { name: clientForm.name.trim(), cif: clientForm.cif, contact: clientForm.contact, phone: clientForm.phone, email: clientForm.email, site: clientForm.site };
                    const { error } = await supabase.from("clients").update(updates).eq("id", editingClientId);
                    if (error) { notify(`No se pudo guardar: ${error.message}`, "error"); return; }
                    setClients(prev => prev.map(x => x.id === editingClientId ? { ...x, ...updates } : x));
                    setEditingClientId(null);
                    setClientForm({ name: "", cif: "", contact: "", phone: "", email: "", site: "" });
                    notify("Cliente actualizado");
                    return;
                  }
                  const code = `FISAL-${Math.floor(1000 + Math.random() * 9000)}`;
                  const row = { id: `c${Date.now()}`, name: clientForm.name.trim(), cif: clientForm.cif, contact: clientForm.contact, phone: clientForm.phone, email: clientForm.email, site: clientForm.site, access_code: code, active: true };
                  const { error } = await supabase.from("clients").insert(row);
                  if (error) { notify(`No se pudo guardar: ${error.message}`, "error"); return; }
                  setClients(prev => prev.some(c => c.id === row.id) ? prev : [...prev, row]);
                  setClientForm({ name: "", cif: "", contact: "", phone: "", email: "", site: "" });
                  notify(`Cliente creado · código ${code}`);
                 }}
                style={{ marginTop: 16, background: "#d5af2a", border: "none", borderRadius: 8, padding: "11px 22px", color: "#0f172a", fontFamily: "inherit", fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                {editingClientId ? "Guardar cambios" : "Crear cliente"}
              </button>
              {editingClientId && (
                <button onClick={() => { setEditingClientId(null); setClientForm({ name: "", cif: "", contact: "", phone: "", email: "", site: "" }); }}
                  style={{ marginTop: 16, marginLeft: 10, background: "transparent", border: "1px solid #334155", borderRadius: 8, padding: "11px 22px", color: "#94a3b8", fontFamily: "inherit", fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                  Cancelar
                </button>
              )}
            </div>

            {clients.length === 0 ? (
              <div className="insp-card" style={{ textAlign: "center", color: "#475569", fontSize: 13 }}>Todavía no hay clientes dados de alta.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {clients.map(c => {
                  const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/cliente`;
                  const machinesOf = allMachines.filter(m => (fleet[m.id] || {}).clientId === c.id);
                  return (
                    <div key={c.id} className="insp-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                            {[c.cif, c.contact, c.phone, c.email, c.site].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>🚜 {machinesOf.length} máquina{machinesOf.length === 1 ? "" : "s"} asignada{machinesOf.length === 1 ? "" : "s"}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#d5af2a", letterSpacing: 1 }}>{c.access_code}</div>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 12, background: c.active ? "#10b98120" : "#ef444420", color: c.active ? "#10b981" : "#ef4444", border: `1px solid ${c.active ? "#10b98140" : "#ef444440"}` }}>
                            {c.active ? "ACCESO ACTIVO" : "ACCESO DESACTIVADO"}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        <button style={exportBtnStyle} onClick={() => {
                          const text = `Portal FISALRENT: ${portalUrl}\nTu código de acceso: ${c.access_code}`;
                          navigator.clipboard?.writeText(text);
                          notify("Enlace y código copiados");
                        }}>📋 Copiar enlace y código</button>
                        <a style={{ ...exportBtnStyle, textDecoration: "none", display: "inline-block" }} target="_blank" rel="noreferrer"
                          href={`https://wa.me/?text=${encodeURIComponent(`Portal FISALRENT: ${portalUrl} — Tu código de acceso: ${c.access_code}`)}`}>💬 Enviar por WhatsApp</a>
                        <button style={exportBtnStyle} onClick={async () => {
                          const { error } = await supabase.from("clients").update({ active: !c.active }).eq("id", c.id);
                          if (error) { notify("No se pudo cambiar el acceso", "error"); return; }
                          setClients(prev => prev.map(x => x.id === c.id ? { ...x, active: !c.active } : x));
                          notify(c.active ? "Acceso desactivado" : "Acceso activado");
                        }}>{c.active ? "🚫 Desactivar acceso" : "✅ Activar acceso"}</button>
                        <button style={exportBtnStyle} onClick={() => {
                          setEditingClientId(c.id);
                          setClientForm({ name: c.name || "", cif: c.cif || "", contact: c.contact || "", phone: c.phone || "", email: c.email || "", site: c.site || "" });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>✏️ Editar</button>
                        <button style={{ ...exportBtnStyle, color: "#ef4444" }} onClick={async () => {
                          if (!confirm(`¿Eliminar el cliente ${c.name}?`)) return;
                          const { error } = await supabase.from("clients").delete().eq("id", c.id);
                          if (error) { notify("No se pudo eliminar", "error"); return; }
                          setClients(prev => prev.filter(x => x.id !== c.id));
                          notify("Cliente eliminado");
                        }}>🗑 Eliminar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PARTES DIARIOS */}
        {view === "checks" && (() => {
          const today = new Date().toISOString().slice(0, 10);
          const filtered = dailyChecks.filter(d =>
            (!checkFilters.client || String(d.clientId) === checkFilters.client) &&
            (!checkFilters.machine || String(d.machineId) === checkFilters.machine) &&
            (!checkFilters.date || d.date === checkFilters.date)
          );
          const rentedMissing = allMachines.filter(m => {
            const f = fleet[m.id] || {};
            return f.clientId && !dailyChecks.some(d => String(d.machineId) === String(m.id) && d.date === today);
          });
          const rows = filtered.map(d => ({
            Fecha: d.date, Cliente: d.clientName || "", Maquina: d.machineName || "", Serie: d.machineSerial || "",
            Operador: d.operator || "", Horas: d.hours || "",
            Estado: d.incident || d.hasFailures ? "Con incidencia" : "Correcto",
            Incidencia: d.incidentDesc || "", Fotos: d.photoCount ?? 0,
          }));
          return (
            <div>
              <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Partes diarios</div>
                  <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Partes enviados por los clientes desde el portal</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={exportBtnStyle} onClick={() => exportCSV(rows, `partes_diarios_${today}.csv`)}>⬇ CSV</button>
                  <button style={exportBtnStyle} onClick={() => exportListPDF("Partes diarios de máquina", rows, `partes_diarios_${today}.pdf`)}>⬇ PDF</button>
                </div>
              </div>

              {rentedMissing.length > 0 && !hideMissingAlert && (
                <div style={{ background: "#d5af2a12", border: "1px solid #d5af2a40", borderRadius: 10, padding: 14, marginBottom: 18, position: "relative" }}>
                  <button
                    onClick={() => setHideMissingAlert(true)}
                    title="Ocultar aviso"
                    style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: "none", color: "#d5af2a", fontSize: 16, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}
                  >✕</button>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#d5af2a", marginBottom: 6 }}>⏰ Sin parte de hoy ({rentedMissing.length})</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{rentedMissing.map(m => m.name).join(" · ")}</div>
                </div>
              )}


              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div>
                  <label className="field-label">Cliente</label>
                  <select className="field-input" value={checkFilters.client} onChange={e => setCheckFilters(p => ({ ...p, client: e.target.value }))}>
                    <option value="">Todos</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Máquina</label>
                  <select className="field-input" value={checkFilters.machine} onChange={e => setCheckFilters(p => ({ ...p, machine: e.target.value }))}>
                    <option value="">Todas</option>
                    {allMachines.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Fecha</label>
                  <input type="date" className="field-input" value={checkFilters.date} onChange={e => setCheckFilters(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="insp-card" style={{ textAlign: "center", color: "#475569", fontSize: 13 }}>Aún no hay partes diarios con esos filtros.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filtered.map(d => {
                    const bad = d.incident || d.hasFailures;
                    return (
                      <div key={`${d.machineId}_${d.date}`} className="insp-card" style={{ borderLeft: `3px solid ${bad ? "#ef4444" : "#10b981"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{d.machineName} <span style={{ color: "#475569", fontWeight: 400 }}>· {d.machineSerial}</span></div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{d.date} · 👤 {d.clientName} · 👷 {d.operator} {d.hours ? `· ⏱ ${d.hours} h` : ""}</div>
                            {d.incidentDesc && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>⚠️ {d.incidentDesc}</div>}
                            {d.checks && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                {Object.entries(d.checks).filter(([, v]) => v !== "ok").map(([k, v]) => (
                                  <span key={k} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: v === "fallo" ? "#ef444420" : "#f59e0b20", color: v === "fallo" ? "#ef4444" : "#f59e0b" }}>{k}: {v}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 14, background: bad ? "#ef444420" : "#10b98120", color: bad ? "#ef4444" : "#10b981", border: `1px solid ${bad ? "#ef444440" : "#10b98140"}` }}>
                              {bad ? "CON INCIDENCIA" : "CORRECTO"} {d.photoCount ? `· 📷 ${d.photoCount}` : ""}
                            </span>
                            <button
                              style={{ background: "#ef444418", border: "1px solid #ef444440", color: "#ef4444", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              onClick={async () => {
                                if (!window.confirm(`¿Eliminar el parte diario de ${d.machineName} del ${d.date}?`)) return;
                                let q = supabase.from("daily_checks").delete();
                                q = d.id ? q.eq("id", String(d.id)) : q.eq("machine_id", String(d.machineId)).eq("check_date", d.date);
                                const { error } = await q;
                                if (error) { notify("No se pudo eliminar el parte", "error"); return; }
                                setDailyChecks(prev => prev.filter(x => (d.id ? String(x.id) !== String(d.id) : !(String(x.machineId) === String(d.machineId) && x.date === d.date))));
                                notify("Parte diario eliminado");
                              }}
                            >🗑 Eliminar</button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}


        {/* FLEET */}
        {view === "fleet" && (
          <div>
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Gestión de Flota</div>
                <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Alquileres activos, ubicación, extintor y próxima revisión</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(() => {
                  const rows = allMachines.map(m => {
                    const f = fleet[m.id] || {};
                    return {
                      Maquina: m.name, Serie: m.serial, Categoria: m.category,
                      Estado: f.client && f.client.trim() ? "Alquilada" : "Disponible",
                      Cliente: f.client || "", Ubicacion: f.location || "",
                      InicioAlquiler: f.rentStart || "", FinAlquiler: f.rentEnd || "",
                      Extintor: f.extinguisherDate || "",
                    };
                  });
                  return (
                    <>
                      <button style={exportBtnStyle} onClick={() => exportCSV(rows, `flota_${new Date().toISOString().slice(0,10)}.csv`)}>⬇ CSV</button>
                      <button style={exportBtnStyle} onClick={() => exportListPDF("Registro de Flota", rows, `flota_${new Date().toISOString().slice(0,10)}.pdf`)}>⬇ PDF</button>
                    </>
                  );
                })()}
              </div>
            </div>


            {(() => {
              const today = new Date();
              const stats = allMachines.reduce((acc, m) => {
                const f = fleet[m.id] || {};
                if (f.client && f.client.trim()) acc.rented++;
                else acc.available++;
                if (f.extinguisherDate) {
                  const d = new Date(f.extinguisherDate);
                  const diff = (d - today) / (1000 * 60 * 60 * 24);
                  if (diff < 0) acc.expired++;
                  else if (diff < 30) acc.soon++;
                }
                return acc;
              }, { rented: 0, available: 0, expired: 0, soon: 0 });
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Alquiladas", value: stats.rented, color: "#d5af2a", filter: "rented" },
                    { label: "Disponibles", value: stats.available, color: "#10b981", filter: "available" },
                    { label: "Extintor <30 días", value: stats.soon, color: "#f59e0b" },
                    { label: "Extintor caducado", value: stats.expired, color: "#ef4444" },
                  ].map(s => {
                    const isActive = s.filter && fleetFilter === s.filter;
                    const clickable = !!s.filter;
                    return (
                      <div
                        key={s.label}
                        className="insp-card"
                        onClick={() => {
                          if (!clickable) return;
                          setFleetFilter(isActive ? "all" : s.filter);
                        }}
                        style={{
                          textAlign: "center",
                          padding: 14,
                          cursor: clickable ? "pointer" : "default",
                          outline: isActive ? `2px solid ${s.color}` : "none",
                          outlineOffset: isActive ? 2 : 0,
                          opacity: clickable && fleetFilter !== "all" && !isActive ? 0.6 : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 4 }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allMachines.filter(m => {
                if (fleetFilter === "all") return true;
                const f = fleet[m.id] || {};
                const isRented = f.client && f.client.trim();
                if (fleetFilter === "rented") return isRented;
                if (fleetFilter === "available") return !isRented;
                return true;
              }).map(m => {
                const f = fleet[m.id] || {};
                const isRented = f.client && f.client.trim();
                const isOpen = expandedMachine === m.id;
                let extStatus = null;
                if (f.extinguisherDate) {
                  const d = new Date(f.extinguisherDate);
                  const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
                  if (diff < 0) extStatus = { color: "#ef4444", label: "⚠ Extintor CADUCADO" };
                  else if (diff < 30) extStatus = { color: "#f59e0b", label: `⏰ Extintor en ${Math.ceil(diff)} días` };
                  else extStatus = { color: "#10b981", label: `✓ Extintor OK (${Math.ceil(diff)} días)` };
                }
                return (
                  <div key={m.id} className="insp-card" style={{ padding: 0, overflow: "hidden" }}>
                    <div onClick={() => setExpandedMachine(isOpen ? null : m.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, cursor: "pointer" }}>
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ fontSize: 30 }}>{m.image}</div>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{m.serial} · {m.category}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: isRented ? "#d5af2a20" : "#10b98120", color: isRented ? "#d5af2a" : "#10b981", border: `1px solid ${isRented ? "#d5af2a40" : "#10b98140"}`, letterSpacing: 0.8 }}>
                              {isRented ? "ALQUILADA" : "DISPONIBLE"}
                            </span>
                            {isRented && <span style={{ fontSize: 11, color: "#94a3b8" }}>👤 {f.client}</span>}
                            {isRented && f.location && <span style={{ fontSize: 11, color: "#94a3b8" }}>📍 {f.location}</span>}
                            {f.hasExtinguisher
                              ? <span style={{ fontSize: 11, color: "#94a3b8" }}>🧯 Con extintor</span>
                              : <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440", letterSpacing: 0.8 }}>🚫 SIN EXTINTOR</span>}
                          </div>
                          {extStatus && (
                            <div style={{ fontSize: 10, color: extStatus.color, marginTop: 6, fontWeight: 600 }}>{extStatus.label}</div>
                          )}
                          {isRented && f.rentEnd && (() => {
                            const today = new Date(); today.setHours(0,0,0,0);
                            const end = new Date(f.rentEnd); end.setHours(0,0,0,0);
                            const days = Math.round((end - today) / 86400000);
                            if (days < 0) return <div style={{ fontSize: 10, color: "#ef4444", marginTop: 6, fontWeight: 700 }}>⚠️ Alquiler vencido hace {Math.abs(days)} día{Math.abs(days)===1?"":"s"}</div>;
                            if (days === 0) return <div style={{ fontSize: 10, color: "#ef4444", marginTop: 6, fontWeight: 700 }}>⚠️ El alquiler finaliza HOY</div>;
                            if (days <= 5) return <div style={{ fontSize: 10, color: "#d5af2a", marginTop: 6, fontWeight: 700 }}>⏰ Alquiler finaliza en {days} día{days===1?"":"s"} ({f.rentEnd})</div>;
                            return null;
                          })()}
                        </div>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 18 }}>{isOpen ? "▴" : "▾"}</div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: 16, borderTop: "1px solid #e3e8ef", background: "#f8fafc", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label className="field-label">Cliente que la tiene</label>
                          <select
                            className="field-input"
                            value={f.clientId || ""}
                            onChange={e => {
                              const c = clients.find(x => x.id === e.target.value);
                              updateFleet(m.id, { clientId: c ? c.id : "", client: c ? c.name : "" });
                            }}
                          >
                            <option value="">— Sin cliente (disponible) —</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
                            {f.clientId
                              ? "Este cliente verá la máquina en su portal de parte diario."
                              : (f.client ? `Cliente actual sin ficha: ${f.client}. Selecciónalo de la lista para darle acceso al portal.` : "Da de alta el cliente en la sección Clientes para poder asignarlo.")}
                          </div>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label className="field-label">Ubicación / Obra</label>
                          <input className="field-input" value={f.location || ""} onChange={e => updateFleet(m.id, { location: e.target.value })} placeholder="Dirección, obra o zona" />
                        </div>
                        <div>
                          <label className="field-label">Fecha inicio alquiler</label>
                          <input type="date" className="field-input" value={f.rentStart || ""} onChange={e => updateFleet(m.id, { rentStart: e.target.value })} />
                        </div>
                        <div>
                          <label className="field-label">Fecha fin / prevista</label>
                          <input type="date" className="field-input" value={f.rentEnd || ""} onChange={e => updateFleet(m.id, { rentEnd: e.target.value })} />
                        </div>
                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16, alignItems: "center", padding: "10px 12px", background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 6 }}>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#1e293b", fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!f.hasExtinguisher} onChange={e => updateFleet(m.id, { hasExtinguisher: e.target.checked })} style={{ accentColor: "#d5af2a", width: 16, height: 16 }} />
                            🧯 La máquina lleva extintor
                          </label>
                        </div>
                        {f.hasExtinguisher && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label className="field-label">Próxima fecha de revisión del extintor</label>
                            <input type="date" className="field-input" value={f.extinguisherDate || ""} onChange={e => updateFleet(m.id, { extinguisherDate: e.target.value })} />
                          </div>
                        )}
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label className="field-label">📎 Documentación de la máquina</label>
                          <div style={{ background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 6, padding: 12 }}>
                            {(f.documents || []).length === 0 && (
                              <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>Sin documentos. Sube ITV, ficha técnica, seguro, manuales, etc.</div>
                            )}
                            {(f.documents || []).length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                                {(f.documents || []).map((doc, idx) => (
                                  <div key={doc.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 4 }}>
                                    <div style={{ fontSize: 12, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                                      📄 {doc.name}
                                      <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8 }}>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("es-ES") : ""}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button onClick={async () => {
                                        const { data, error } = await supabase.storage.from("machine-docs").createSignedUrl(doc.path, 3600);
                                        if (error) { notify("Error al abrir documento", "error"); return; }
                                        window.open(data.signedUrl, "_blank");
                                      }} style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 4, padding: "4px 10px", color: "#d5af2a", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>Ver</button>
                                      <button onClick={async () => {
                                        if (!confirm("¿Eliminar este documento?")) return;
                                        await supabase.storage.from("machine-docs").remove([doc.path]);
                                        const next = (f.documents || []).filter((_, i) => i !== idx);
                                        updateFleet(m.id, { documents: next });
                                        notify("Documento eliminado");
                                      }} style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 4, padding: "4px 10px", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>Eliminar</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <label style={{ display: "inline-block", background: "#d5af2a20", border: "1px dashed #d5af2a60", borderRadius: 6, padding: "8px 14px", color: "#d5af2a", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.8 }}>
                              + Subir documento
                              <input type="file" style={{ display: "none" }} onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 20 * 1024 * 1024) { notify("Máximo 20MB por archivo", "error"); return; }
                                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                                const path = `${m.id}/${Date.now()}_${safeName}`;
                                notify("Subiendo documento...");
                                const { error } = await supabase.storage.from("machine-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
                                if (error) { notify("Error al subir: " + error.message, "error"); return; }
                                const newDoc = { name: file.name, path, uploadedAt: new Date().toISOString(), size: file.size };
                                const next = [...(f.documents || []), newDoc];
                                updateFleet(m.id, { documents: next });
                                notify("✅ Documento subido");
                                e.target.value = "";
                              }} />
                            </label>
                          </div>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label className="field-label">Notas</label>
                          <textarea className="field-input" rows={2} value={f.notes || ""} onChange={e => updateFleet(m.id, { notes: e.target.value })} placeholder="Observaciones sobre el alquiler" style={{ resize: "vertical", fontFamily: "inherit" }} />
                        </div>
                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={async () => {
                            if (!f.client) { notify("Sin cliente asignado · nada que archivar", "error"); return; }
                            if (!confirm("¿Liberar la máquina y archivar el alquiler en el historial?")) return;
                            const today = new Date().toISOString().slice(0, 10);
                            const clientNorm = (f.client || "").toLowerCase().trim();
                            const usedIds = new Set();
                            inspections.forEach(i => { if (i.type === "alquiler" && Array.isArray(i.relatedInspectionIds)) i.relatedInspectionIds.forEach(id => usedIds.add(String(id))); });
                            const related = inspections.filter(i => i.type !== "alquiler" && i.machine?.id === m.id && (i.client || "").toLowerCase().trim() === clientNorm && !usedIds.has(String(i.id)));
                            const rental = {
                              id: "rental-" + Date.now(),
                              type: "alquiler",
                              machine: { id: m.id, name: m.name, image: m.image },
                              client: f.client,
                              location: f.location || "",
                              rentStart: f.rentStart || "",
                              rentEnd: f.rentEnd || today,
                              releasedAt: today,
                              date: today,
                              notes: f.notes || "",
                              documents: f.documents || [],
                              relatedInspectionIds: related.map(i => i.id),
                              // compat fields for legacy renderers
                              operator: "—", fuelLevel: "—", km: "", photos: [], failCount: 0, defectCount: 0, signName: f.client,
                            };
                            const { error } = await supabase.from("inspections").insert({ id: String(rental.id), data: rental });
                            if (error) { notify("Error al archivar: " + error.message, "error"); return; }
                            setInspections(prev => [rental, ...prev]);
                            updateFleet(m.id, { client: "", location: "", rentStart: "", rentEnd: "", notes: "", documents: [] });
                            notify("Alquiler archivado en el historial");
                          }}
                            style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 6, padding: "8px 14px", color: "#94a3b8", fontFamily: "inherit", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, cursor: "pointer" }}>
                            Liberar máquina
                          </button>
                          <button onClick={() => { setExpandedMachine(null); notify("✅ Datos guardados"); }}
                            style={{ background: "#d5af2a", border: "none", borderRadius: 6, padding: "8px 16px", color: "#0f172a", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MACHINES */}
        {view === "machines" && (
          <div>
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Gestión de Máquinas</div>
                <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Añade máquinas para usar en inspecciones y flota</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(() => {
                  const rows = customMachines.map(m => ({ Nombre: m.name, Serie: m.serial, Categoria: m.category, Icono: m.image }));
                  return (
                    <>
                      <button style={exportBtnStyle} onClick={() => exportCSV(rows, `maquinas_${new Date().toISOString().slice(0,10)}.csv`)}>⬇ CSV</button>
                      <button style={exportBtnStyle} onClick={() => exportListPDF("Listado de Máquinas", rows, `maquinas_${new Date().toISOString().slice(0,10)}.pdf`)}>⬇ PDF</button>
                    </>
                  );
                })()}
              </div>
            </div>


            {/* Add machine form */}
            <div className="insp-card" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d5af2a", marginBottom: 16 }}>+ Añadir nueva máquina</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="field-label">Nombre de la máquina *</label>
                  <input className="field-input" placeholder="ej. Komatsu PC210LC-10" value={machineForm.name} onChange={e => setMachineForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Número de serie *</label>
                  <input className="field-input" placeholder="ej. S/N K60365" value={machineForm.serial} onChange={e => setMachineForm(p => ({ ...p, serial: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Categoría *</label>
                  <input className="field-input" placeholder="ej. Excavadora" value={machineForm.category} onChange={e => setMachineForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Icono</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {MACHINE_ICONS.map(icon => (
                      <button key={icon} onClick={() => setMachineForm(p => ({ ...p, image: icon }))} style={{
                        width: 36, height: 36, borderRadius: 8, border: `2px solid ${machineForm.image === icon ? "#d5af2a" : "#e3e8ef"}`,
                        background: machineForm.image === icon ? "#d5af2a20" : "#ffffff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                      }}>{icon}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => {
                  if (!machineForm.name.trim() || !machineForm.serial.trim() || !machineForm.category.trim()) {
                    notify("Completa nombre, serie y categoría", "error"); return;
                  }
                  const newMachine = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    name: machineForm.name.trim(),
                    serial: machineForm.serial.trim(),
                    category: machineForm.category.trim(),
                    image: machineForm.image,
                  };
                  setCustomMachines(prev => [...prev, newMachine]);
                  supabase.from("custom_machines").insert({ id: String(newMachine.id), data: newMachine }).then(({ error }) => { if (error) console.error(error); });

                  setMachineForm({ name: "", serial: "", category: "", image: "🚜" });
                  notify("✅ Máquina añadida correctamente");
                }} style={{ background: "#d5af2a", border: "none", borderRadius: 8, padding: "10px 24px", color: "#0f172a", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>
                  Añadir máquina
                </button>
              </div>
            </div>

            {/* List */}
            {(() => {
              const machinesList = customMachines;
              return (
                <>
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, marginBottom: 14 }}>Todas las máquinas ({machinesList.length})</div>
                  {machinesList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#475569", border: "1px dashed #cdd6e1", borderRadius: 10 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
                      <p style={{ fontSize: 13 }}>No hay máquinas registradas</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {machinesList.map(m => (
                        <div key={m.id} className="insp-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
                          <span style={{ fontSize: 24 }}>{m.image}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: "#475569" }}>{m.serial} · {m.category}</div>
                          </div>
                          <button onClick={() => { setCustomMachines(prev => prev.filter(cm => cm.id !== m.id)); supabase.from("custom_machines").delete().eq("id", String(m.id)).then(({ error }) => { if (error) console.error(error); }); notify("Máquina eliminada"); }}
                            style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 6, padding: "6px 12px", color: "#94a3b8", fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* HISTORY */}
        {view === "history" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Historial de Inspecciones</div>
                <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{inspections.length} inspección{inspections.length !== 1 ? "es" : ""} registrada{inspections.length !== 1 ? "s" : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(() => {
                  const rows = inspections.map(i => ({
                    ID: i.id, Fecha: i.date || "", Tipo: i.type || "",
                    Maquina: i.machine?.name || "", Serie: i.machine?.serial || "",
                    Cliente: i.client || "", Ubicacion: i.location || "",
                    InicioAlquiler: i.rentStart || "", FinAlquiler: i.rentEnd || "",
                    Notas: i.notes || "",
                  }));
                  return (
                    <>
                      <button style={exportBtnStyle} onClick={() => exportCSV(rows, `historial_${new Date().toISOString().slice(0,10)}.csv`)}>⬇ CSV</button>
                      <button style={exportBtnStyle} onClick={() => exportListPDF("Historial de Inspecciones", rows, `historial_${new Date().toISOString().slice(0,10)}.pdf`)}>⬇ PDF</button>
                    </>
                  );
                })()}
                <button onClick={() => setView("new")} style={{ background: "#d5af2a", border: "none", borderRadius: 8, padding: "10px 20px", color: "#0f172a", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>
                  + Nueva
                </button>
              </div>

            </div>

            {inspections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#475569" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <p style={{ fontSize: 14 }}>No hay inspecciones registradas aún</p>
                <button onClick={() => setView("new")} style={{ marginTop: 16, background: "none", border: "1px solid #cdd6e1", borderRadius: 8, padding: "10px 20px", color: "#64748b", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                  Crear primera inspección
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(() => {
                  const attached = new Set();
                  inspections.forEach(i => { if (i.type === "alquiler" && Array.isArray(i.relatedInspectionIds)) i.relatedInspectionIds.forEach(id => attached.add(String(id))); });
                  return inspections.filter(i => !attached.has(String(i.id))).map(insp => {
                  if (insp.type === "alquiler") {
                    const related = inspections.filter(i => (insp.relatedInspectionIds || []).map(String).includes(String(i.id)));
                    return (
                      <div key={insp.id} className="insp-card" style={{ borderLeft: "3px solid #10b981" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                            <div style={{ fontSize: 32, marginTop: 2 }}>{insp.machine.image}</div>
                            <div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{insp.machine.name}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", letterSpacing: 1 }}>📦 ALQUILER</span>
                              </div>
                              <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>👤 {insp.client}</div>
                              {insp.location && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>📍 {insp.location}</div>}
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                                {insp.rentStart || "—"} → {insp.rentEnd || insp.releasedAt}
                              </div>
                              {insp.notes && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, fontStyle: "italic" }}>{insp.notes}</div>}
                            </div>
                          </div>
                          <button onClick={async () => {
                            if (!confirm("¿Eliminar este alquiler del historial? Las inspecciones asociadas seguirán visibles.")) return;
                            const { error } = await supabase.from("inspections").delete().eq("id", String(insp.id));
                            if (error) { notify("Error al eliminar: " + error.message, "error"); return; }
                            setInspections(prev => prev.filter(i => String(i.id) !== String(insp.id)));
                            notify("Alquiler eliminado");
                          }} style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 6, padding: "6px 12px", color: "#ef4444", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            🗑️
                          </button>
                        </div>
                        {insp.documents && insp.documents.length > 0 && (
                          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {insp.documents.map(d => (
                              <a key={d.id} href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "4px 10px", background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 6, color: "#94a3b8", textDecoration: "none" }}>📄 {d.name}</a>
                            ))}
                          </div>
                        )}
                        {related.length > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e3e8ef" }}>
                            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Inspecciones asociadas ({related.length})</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {related.map(r => (
                                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 6 }}>
                                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: r.type === "salida" ? "#3b82f620" : "#f59e0b20", color: r.type === "salida" ? "#3b82f6" : "#f59e0b", border: `1px solid ${r.type === "salida" ? "#3b82f640" : "#f59e0b40"}`, letterSpacing: 0.5 }}>
                                      {r.type === "salida" ? "↑ SALIDA" : "↓ ENTRADA"}
                                    </span>
                                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.date} · {r.operator}</span>
                                    <span style={{ fontSize: 10, color: r.defectCount + r.failCount > 0 ? "#f59e0b" : "#10b981" }}>
                                      {r.defectCount + r.failCount > 0 ? `⚠ ${r.defectCount + r.failCount} incidencias` : "✓ OK"}
                                    </span>
                                  </div>
                                  <button onClick={() => downloadPDF(r)} style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 4, padding: "4px 10px", color: "#d5af2a", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>⬇ PDF</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                  <div key={insp.id} className="insp-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 32, marginTop: 2 }}>{insp.machine.image}</div>
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{insp.machine.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: insp.type === "salida" ? "#3b82f620" : "#f59e0b20", color: insp.type === "salida" ? "#3b82f6" : "#f59e0b", border: `1px solid ${insp.type === "salida" ? "#3b82f640" : "#f59e0b40"}`, letterSpacing: 1 }}>
                              {insp.type === "salida" ? "↑ SALIDA" : "↓ ENTRADA"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#475569" }}>
                            {insp.client} · {insp.operator} · {insp.date}
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "#64748b" }}>⛽ {insp.fuelLevel}</span>
                            {insp.km && <span style={{ fontSize: 11, color: "#64748b" }}>⏱ {insp.km}</span>}
                            <span style={{ fontSize: 11, color: "#64748b" }}>📷 {Array.isArray(insp.photos) ? insp.photos.length : (insp.photoCount || 0)} fotos</span>
                            <span style={{ fontSize: 11, color: insp.failCount > 0 ? "#ef4444" : "#64748b" }}>🔧 {insp.failCount} defectos checklist</span>
                            <span style={{ fontSize: 11, color: insp.defectCount > 0 ? "#f59e0b" : "#64748b" }}>⚠️ {insp.defectCount} desperfectos</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, fontSize: 11, color: "#475569" }}>
                        <div>✍️ {insp.signName}</div>
                        <div style={{ padding: "3px 8px", background: insp.defectCount === 0 && insp.failCount === 0 ? "#10b98115" : "#f59e0b15", color: insp.defectCount === 0 && insp.failCount === 0 ? "#10b981" : "#f59e0b", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
                          {insp.defectCount === 0 && insp.failCount === 0 ? "✓ SIN INCIDENCIAS" : "⚠ CON INCIDENCIAS"}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => downloadPDF(insp)} style={{ background: "#d5af2a", border: "none", borderRadius: 6, padding: "6px 12px", color: "#0f172a", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>
                            ⬇ PDF
                          </button>
                          <button onClick={async () => {
                            if (!confirm("¿Eliminar esta inspección del historial?")) return;
                            const { error } = await supabase.from("inspections").delete().eq("id", String(insp.id));
                            if (error) { notify("Error al eliminar: " + error.message, "error"); return; }
                            setInspections(prev => prev.filter(i => String(i.id) !== String(insp.id)));
                            notify("Inspección eliminada");
                          }} style={{ background: "none", border: "1px solid #cdd6e1", borderRadius: 6, padding: "6px 12px", color: "#ef4444", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Photos preview */}
                    {Array.isArray(insp.photos) && insp.photos.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                        {insp.photos.slice(0, 6).map(p => (
                          <img key={p.id} src={p.src} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid #e3e8ef", flexShrink: 0 }} />
                        ))}
                        {insp.photos.length > 6 && <div style={{ width: 60, height: 60, background: "#ffffff", border: "1px solid #e3e8ef", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 11, flexShrink: 0 }}>+{insp.photos.length - 6}</div>}
                      </div>
                    )}
                  </div>
                  );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20, paddingBottom: 10, borderBottom: "1px solid #e3e8ef" }}>
      {children}
    </div>
  );
}
