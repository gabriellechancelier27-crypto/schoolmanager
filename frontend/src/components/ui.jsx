import { useState } from "react";
import { errMessage } from "../api";

export const fmtFCFA = (n) =>
  n === null || n === undefined ? "—"
  : new Intl.NumberFormat("fr-FR").format(Number(n)) + " FCFA";

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function Spinner() { return <div className="spinner" />; }

export function ErrorBox({ error }) {
  return error ? <div className="alert alert-error">{error}</div> : null;
}

export function SuccessBox({ children }) {
  return children ? <div className="alert alert-success">{children}</div> : null;
}

export function Badge({ children, tone = "gray" }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      <div className="page-header-actions">{children}</div>
    </div>
  );
}

export function Modal({ title, open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="modal-overlay"
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} type="button">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, setPage, next, previous, count }) {
  if (!count) return null;
  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={!previous} onClick={() => setPage(page - 1)}>← Précédent</button>
      <span>Page {page} · {count} résultat(s)</span>
      <button className="btn btn-sm" disabled={!next} onClick={() => setPage(page + 1)}>Suivant →</button>
    </div>
  );
}

export function Empty({ message = "Aucune donnée" }) {
  return <div className="empty">{message}</div>;
}

export function Field({ label, children }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/** Modale de formulaire pilotée par une configuration de champs. */
export function FormModal({ title, fields, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...(initial || {}) }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try { await onSave(form); } catch (err) { setError(errMessage(err)); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={title} open onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {fields.map((f) => (
          <div className={`form-field ${f.full ? "full" : ""}`} key={f.name}>
            <label>{f.label}</label>
            {f.type === "select" ? (
              <select className="input" value={form[f.name] ?? ""} required={f.required !== false}
                      onChange={(e) => set(f.name, e.target.value)}>
                <option value="">—</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea className="input" rows={3} value={form[f.name] ?? ""} required={f.required !== false}
                        onChange={(e) => set(f.name, e.target.value)} />
            ) : f.type === "checkbox" ? (
              <label className="radio-group">
                <input type="checkbox" checked={!!form[f.name]}
                       onChange={(e) => set(f.name, e.target.checked)} />
                {f.checkLabel || "Oui"}
              </label>
            ) : (
              <input className="input" type={f.type || "text"} step={f.step} min={f.min} max={f.max}
                     value={form[f.name] ?? ""} required={f.required !== false}
                     onChange={(e) => set(f.name, e.target.value)} />
            )}
          </div>
        ))}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}