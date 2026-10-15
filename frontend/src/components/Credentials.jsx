import { useState } from "react";
import { errMessage, post } from "../api";

export function genPassword(length = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#";
  let password = "";

  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  return password;
}

export function CredentialsModal({
  title = "Identifiants de connexion",
  username,
  password,
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  async function copyCredentials() {
    const text = `Identifiant : ${username}\nMot de passe : ${password}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-sm" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="form-grid">
          <div>
            <label className="label">Identifiant</label>
            <div className="input">{username}</div>
          </div>

          <div>
            <label className="label">Mot de passe</label>
            <div className="input">{password}</div>
          </div>
        </div>

        <p className="hint">
          Conservez ces identifiants et transmettez-les à la personne concernée.
        </p>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={copyCredentials}>
            {copied ? "✓ Copié" : "Copier les identifiants"}
          </button>

          <button className="btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccessButton({ kind, item, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState(null);

  const labels = {
    teacher: "enseignant",
    parent: "parent",
    student: "élève",
  };

  async function createAccess() {
    const label = labels[kind] || "utilisateur";

    if (
      !window.confirm(
        `Créer un accès de connexion pour ce ${label} ?`
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await post("/users/create-access/", {
        kind,
        id: item.id,
      });

      setCredentials(data);

      if (onDone) {
        onDone();
      }
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-sm"
        onClick={createAccess}
        disabled={loading}
        title="Créer un accès de connexion"
      >
        {loading ? "Création..." : "Créer un accès"}
      </button>

      {error && (
        <div className="error-text" style={{ marginTop: 6 }}>
          {error}
        </div>
      )}

      {credentials && (
        <CredentialsModal
          title="Accès créé"
          username={credentials.username}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}
    </>
  );
}