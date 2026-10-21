import { useRef, useState } from "react";
import { useAuth } from "../auth";
import { errMessage, patch, post } from "../api";
import { ErrorBox, Field, PageHeader, SuccessBox } from "../components/ui";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super administrateur", SCHOOL_ADMIN: "Administrateur", DIRECTOR: "Directeur",
  TEACHER: "Enseignant", ACCOUNTANT: "Comptable", PARENT: "Parent", STUDENT: "Élève",
};

const EMPTY_PWD = { old_password: "", new_password: "", confirm: "" };

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [info, setInfo] = useState({
    first_name: user.first_name || "", last_name: user.last_name || "",
    email: user.email || "", phone: user.phone || "",
  });
  const [pwd, setPwd] = useState(EMPTY_PWD);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [msgPwd, setMsgPwd] = useState("");
  const [errPwd, setErrPwd] = useState("");
  const [busyInfo, setBusyInfo] = useState(false);
  const [busyPwd, setBusyPwd] = useState(false);
  // Verrous immédiats : un double clic ne doit jamais envoyer deux requêtes
  const infoLock = useRef(false);
  const pwdLock = useRef(false);

  async function saveInfo(e) {
    e.preventDefault();
    if (infoLock.current) return;
    infoLock.current = true;
    setBusyInfo(true); setErr(""); setMsg("");
    try {
      await patch("/me/", info);
      await refreshUser();
      setMsg("Profil mis à jour.");
    } catch (x) {
      setErr(errMessage(x));
    } finally {
      infoLock.current = false;
      setBusyInfo(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pwdLock.current) return;
    setErrPwd(""); setMsgPwd("");
    if (pwd.new_password !== pwd.confirm) {
      setErrPwd("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    pwdLock.current = true;
    setBusyPwd(true);
    try {
      await post("/me/password/", {
        old_password: pwd.old_password, new_password: pwd.new_password,
      });
      setPwd(EMPTY_PWD);
      setErrPwd("");
      setMsgPwd("Mot de passe modifié. Utilisez-le à votre prochaine connexion.");
    } catch (x) {
      setErrPwd(errMessage(x));
    } finally {
      pwdLock.current = false;
      setBusyPwd(false);
    }
  }

  return (
    <div>
      <PageHeader title="Mon profil"
        subtitle={`${user.username}, ${ROLE_LABELS[user.role] || user.role}`
          + (user.school_name ? `, ${user.school_name}` : "")} />
      <div className="grid-2">
        <form className="card" onSubmit={saveInfo}>
          <h2>Mes informations</h2>
          <SuccessBox>{msg}</SuccessBox>
          <ErrorBox error={err} />
          <div className="form-grid">
            <Field label="Prénom">
              <input className="input" value={info.first_name}
                     onChange={(e) => setInfo({ ...info, first_name: e.target.value })} />
            </Field>
            <Field label="Nom">
              <input className="input" value={info.last_name}
                     onChange={(e) => setInfo({ ...info, last_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={info.email}
                     onChange={(e) => setInfo({ ...info, email: e.target.value })} />
            </Field>
            <Field label="Téléphone">
              <input className="input" value={info.phone}
                     onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" disabled={busyInfo}>
              {busyInfo ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>

        <form className="card" onSubmit={savePassword}>
          <h2>Changer mon mot de passe</h2>
          <SuccessBox>{msgPwd}</SuccessBox>
          <ErrorBox error={errPwd} />
          <Field label="Mot de passe actuel">
            <input className="input" type="password" value={pwd.old_password} required
                   autoComplete="current-password"
                   onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })} />
          </Field>
          <Field label="Nouveau mot de passe (8 caractères minimum)">
            <input className="input" type="password" value={pwd.new_password} required
                   minLength={8} autoComplete="new-password"
                   onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} />
          </Field>
          <Field label="Confirmer le nouveau mot de passe">
            <input className="input" type="password" value={pwd.confirm} required
                   minLength={8} autoComplete="new-password"
                   onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
          </Field>
          <div className="modal-actions">
            <button className="btn btn-primary" disabled={busyPwd}>
              {busyPwd ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
