import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errMessage } from "../api";
import Icon from "../components/Icon";

const POINTS = [
  "Notes, moyennes et classements calculés automatiquement",
  "Bulletins et reçus de paiement en PDF",
  "Présences, absences et suivi des impayés",
  "Un accès personnel pour chaque parent, élève et enseignant",
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
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
      <section className="login-hero">
        <div className="hero-brand">
          <span className="brand-logo">SM</span>
          <span className="brand-name">School<b>Manager</b></span>
        </div>
        <h2>La vie de l'école, au même endroit.</h2>
        <p>Une plateforme pour suivre les élèves, les notes, les présences et les finances de votre établissement.</p>
        <ul className="hero-points">
          {POINTS.map((p, i) => (
            <li key={p} style={{ "--i": i }}>
              <span className="tick"><Icon name="check" size={14} /></span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h1>Connexion</h1>
          <p className="subtitle">Entrez les identifiants fournis par votre établissement.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="form-field">
            <label htmlFor="username">Nom d'utilisateur</label>
            <input id="username" className="input" value={form.username} autoFocus required
                   autoComplete="username"
                   onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="password">Mot de passe</label>
            <div className="pw-wrap">
              <input id="password" className="input" type={show ? "text" : "password"}
                     value={form.password} required autoComplete="current-password"
                     onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="pw-toggle" onClick={() => setShow(!show)}
                      aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                <Icon name={show ? "eyeOff" : "eye"} size={18} />
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Connexion en cours…" : "Se connecter"}
          </button>
          <div className="demo-accounts">
            Comptes de démonstration, mot de passe <code>demo1234</code> :<br />
            <code>admin</code> <code>directeur</code> <code>comptable</code>{" "}
            <code>prof_maths</code> <code>parent1</code> <code>eleve1</code>
          </div>
        </form>
      </div>
    </div>
  );
}
