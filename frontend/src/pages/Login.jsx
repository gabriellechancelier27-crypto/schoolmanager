import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errMessage } from "../api";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await login(form.username, form.password); navigate("/"); }
    catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-logo">SM</span>
          <div><b>School</b>Manager<br /><small>Gestion scolaire intégrée</small></div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-field">
          <label>Nom d'utilisateur</label>
          <input className="input" value={form.username} autoFocus required
                 onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="form-field">
          <label>Mot de passe</label>
          <input className="input" type="password" value={form.password} required
                 onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
        <div className="demo-accounts">
          Comptes de démo (mot de passe <code>demo1234</code>) :<br />
          <code>admin</code> · <code>directeur</code> · <code>comptable</code> ·
          <code>prof_maths</code> · <code>parent1</code> · <code>eleve1</code>
        </div>
      </form>
    </div>
  );
}