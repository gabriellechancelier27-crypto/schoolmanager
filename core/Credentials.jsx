import { useState } from "react";
import { can, useAuth } from "../auth";
import { errMessage, post } from "../api";
import { Field, Modal } from "./ui";

const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genPassword(length = 10) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => CHARS[n % CHARS.length]).join("");
}

/** Affiche l'identifiant et le mot de passe provisoire (une seule fois). */
export function CredentialsModal({ title, username, password, onClose }) {
  const [copied, setCopied] = useState(false);
  const text =
    `SchoolManager\nAdresse : ${window.location.origin}\n` +
    `Identifiant : ${username}\nMot de passe provisoire : ${password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // copie manuelle possible depuis la zone de texte
    }
  }

  return (
    <Modal title={title} open onClose={onClose}>
      <div className="alert alert-success">
        Notez ces informations maintenant : le mot de passe ne sera plus affiché.
      </div>
      <div className="cred-box">
        <div className="cred-row"><span>Identifiant</span><code>{username}</code></div>
        <div className="cred-row"><span>Mot de passe provisoire</span><code>{password}</code></div>
      </div>
      <textarea className="input cred-text" readOnly rows={4} value={text}
                onFocus={(e) => e.target.select()} />
      <p className="hint">
        Transmettez-les à la personne, qui pourra changer son mot de passe dans « Mon profil ».
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={copy}>{copied ? "Copié ✓" : "Copier"}</button>
        <button className="btn btn-primary" onClick={onClose}>Terminé</button>
      </div>
    </Modal>
  );
}

/** Bouton « Créer un accès » : visible pour l'administrateur, sur les fiches sans compte. */
export function AccessButton({ kind, item, onDone }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const showButton = can(user, ["SCHOOL_ADMIN"]) && !item.user;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const body = { kind, id: item.id };
      if (form.username.trim()) body.username = form.username.trim();
      if (form.password) body.password = form.password;
      const data = await post("/users/create-access/", body);
      setOpen(false);
      setForm({ username: "", password: "" });
      setResult(data); // la liste ne se recharge qu'à la fermeture, pour garder cette fenêtre ouverte
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function closeResult() {
    setResult(null);
    if (onDone) onDone();
  }

  return (
    <>
      {showButton && (
        <button className="btn btn-sm btn-primary"
                onClick={() => { setError(""); setOpen(true); }}>
          Créer un accès
        </button>
      )}
      {open && (
        <Modal title={`Créer un accès — ${item.last_name} ${item.first_name}`}
               open onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            {error && <div className="alert alert-error">{error}</div>}
            <Field label="Identifiant (laisser vide pour le générer)">
              <input className="input" value={form.username} autoFocus
                     placeholder="ex. jean.mensah"
                     onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="Mot de passe provisoire (laisser vide pour le générer)">
              <input className="input" value={form.password}
                     placeholder="8 caractères minimum"
                     onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Création…" : "Créer l'accès"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {result && (
        <CredentialsModal title="Accès créé" username={result.username}
                          password={result.password} onClose={closeResult} />
      )}
    </>
  );
}