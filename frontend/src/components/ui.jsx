import { useEffect, useRef, useState } from "react";
import { errMessage, fieldErrorsFrom } from "../api";
import Icon from "./Icon";

export const fmtFCFA = (n) =>
  n === null || n === undefined ? "—"
  : new Intl.NumberFormat("fr-FR").format(Number(n)) + " FCFA";

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fait monter un nombre de 0 à sa valeur (désactivé si l'utilisateur réduit les animations). */
export function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const n = Number(target);
    if (!Number.isFinite(n)) return undefined;
    if (reducedMotion()) { setVal(n); return undefined; }
    let raf;
    let start;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(n * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function Spinner() { return <div className="spinner" role="status" aria-label="Chargement" />; }

export function Skeleton({ height = 16, width = "100%", className = "" }) {
  return <div className={`skeleton ${className}`} style={{ height, width }} />;
}

export function ErrorBox({ error }) {
  return error ? <div className="alert alert-error" role="alert">{error}</div> : null;
}

export function SuccessBox({ children }) {
  return children ? <div className="alert alert-success" role="status">{children}</div> : null;
}

export function Badge({ children, tone = "gray" }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

/**
 * Carte de chiffre clé.
 * - value numérique : le nombre monte jusqu'à sa valeur (format = mise en forme facultative)
 * - icon : nom d'icône ; tone : blue | green | amber | coral | slate ; unit : petit texte après le nombre (ex. FCFA)
 */
export function StatCard({ label, value, hint, icon, tone = "blue", format, unit }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const animated = useCountUp(isNum ? value : 0);
  let shown = value ?? "—";
  if (isNum) {
    if (format) shown = format(animated);
    else if (Number.isInteger(value)) shown = new Intl.NumberFormat("fr-FR").format(Math.round(animated));
    else shown = (Math.round(animated * 10) / 10).toLocaleString("fr-FR");
  }
  return (
    <div className={`stat-card stat-${tone}`}>
      {icon && <span className="stat-icon"><Icon name={icon} size={22} /></span>}
      <div className="stat-body">
        <div className="stat-value">{shown}{unit && <small>{unit}</small>}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, open, onClose, children, wide }) {
  const dialogRef = useRef(null);

  // Accessibilité : le focus entre dans la boîte de dialogue, y est piégé pendant
  // l'ouverture (Tab / Maj+Tab), et est restitué à l'élément déclencheur à la fermeture.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = dialogRef.current;
    const raf = requestAnimationFrame(() => {
      const firstField = node?.querySelector("input:not([type=hidden]), select, textarea");
      const firstButton = node?.querySelector("button:not([disabled])");
      (firstField || firstButton || node)?.focus?.();
    });
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !node) return;
      const list = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay"
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} ref={dialogRef} tabIndex={-1}
           role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, setPage, next, previous, count }) {
  const [goto, setGoto] = useState("");
  if (!count) return null;
  const goTo = (e) => {
    e.preventDefault();
    const n = parseInt(goto, 10);
    if (Number.isFinite(n) && n >= 1 && (n <= page || next)) { setPage(n); setGoto(""); }
  };
  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={!previous} onClick={() => setPage(page - 1)}>← Précédent</button>
      <span>Page <b>{page}</b> · {count} résultat(s)</span>
      <button className="btn btn-sm" disabled={!next} onClick={() => setPage(page + 1)}>Suivant →</button>
      <form className="pagination-goto" onSubmit={goTo}>
        <label htmlFor="page-goto">Aller à la page</label>
        <input id="page-goto" className="input goto-input" type="number" min="1" value={goto}
               placeholder={String(page)} onChange={(e) => setGoto(e.target.value)} />
        <button className="btn btn-sm">OK</button>
      </form>
    </div>
  );
}

export function Empty({ message = "Aucune donnée" }) {
  return (
    <div className="empty">
      <Icon name="inbox" size={30} />
      <span>{message}</span>
    </div>
  );
}

export function Field({ label, htmlFor, children }) {
  return (
    <div className="form-field">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <label>{label}</label>}
      {children}
    </div>
  );
}

/** Modale de formulaire pilotée par une configuration de champs.
 *  Les erreurs de validation Django sont affichées sous le champ concerné. */
export function FormModal({ title, fields, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...(initial || {}) }));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => (fe[name] ? { ...fe, [name]: undefined } : fe));
  };

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError(""); setFieldErrors({});
    try { await onSave(form); }
    catch (err) {
      const fe = fieldErrorsFrom(err);
      if (Object.keys(fe).length) setFieldErrors(fe);
      else setError(errMessage(err));
    }
    finally { setSaving(false); }
  }

  return (
    <Modal title={title} open onClose={onClose}>
      <form onSubmit={submit} className="form-grid" noValidate>
        {fields.map((f) => {
          const id = `fm-${f.name}`;
          const fe = fieldErrors[f.name];
          const invalid = fe ? { "aria-invalid": true } : {};
          return (
            <div className={`form-field ${f.full ? "full" : ""}`} key={f.name}>
              <label htmlFor={id}>{f.label}</label>
              {f.type === "select" ? (
                <select id={id} className={`input ${fe ? "invalid" : ""}`} value={form[f.name] ?? ""}
                        required={f.required !== false} {...invalid}
                        onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} className={`input ${fe ? "invalid" : ""}`} rows={3}
                          value={form[f.name] ?? ""} required={f.required !== false} {...invalid}
                          onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === "checkbox" ? (
                <label className="radio-group">
                  <input id={id} type="checkbox" checked={!!form[f.name]}
                         onChange={(e) => set(f.name, e.target.checked)} />
                  {f.checkLabel || "Oui"}
                </label>
              ) : (
                <input id={id} className={`input ${fe ? "invalid" : ""}`} type={f.type || "text"}
                       step={f.step} min={f.min} max={f.max} value={form[f.name] ?? ""}
                       required={f.required !== false} {...invalid}
                       onChange={(e) => set(f.name, e.target.value)} />
              )}
              {fe && <p className="field-error" role="alert">{fe}</p>}
            </div>
          );
        })}
        {error && <p className="error-text" role="alert">{error}</p>}
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
