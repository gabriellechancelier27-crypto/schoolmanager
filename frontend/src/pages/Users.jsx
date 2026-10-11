import { useState } from "react";
import { useAuth } from "../auth";
import { errMessage, patch, post, useList } from "../api";
import { Badge, Empty, ErrorBox, FormModal, PageHeader, Pagination,
         Spinner, SuccessBox } from "../components/ui";
import { CredentialsModal, genPassword } from "../components/Credentials";

const ROLE_LABELS = {
  SCHOOL_ADMIN: "Administrateur", DIRECTOR: "Directeur", TEACHER: "Enseignant",
  ACCOUNTANT: "Comptable", PARENT: "Parent", STUDENT: "Élève",
};

const NEW_FIELDS = [
  { name: "first_name", label: "Prénom" },
  { name: "last_name", label: "Nom" },
  { name: "username", label: "Identifiant de connexion" },
  { name: "role", label: "Rôle", type: "select", options: [
    { value: "DIRECTOR", label: "Directeur" },
    { value: "ACCOUNTANT", label: "Comptable" },
    { value: "SCHOOL_ADMIN", label: "Administrateur" }] },
  { name: "email", label: "Email", type: "email", required: false },
  { name: "phone", label: "Téléphone", required: false },
  { name: "password", label: "Mot de passe (vide = généré automatiquement)",
    required: false, full: true },
];

const EDIT_FIELDS = [
  { name: "first_name", label: "Prénom" },
  { name: "last_name", label: "Nom" },
  { name: "email", label: "Email", type: "email", required: false },
  { name: "phone", label: "Téléphone", required: false },
];

export default function Users() {
  const { user: me } = useAuth();
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const list = useList("/users/", { role: role || undefined, is_active: active || undefined });
  const [modal, setModal] = useState(null); // {type: "new"} | {type: "edit", item}
  const [creds, setCreds] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function createUser(form) {
    const password = form.password || genPassword();
    const body = {
      username: form.username.trim(), first_name: form.first_name,
      last_name: form.last_name, role: form.role, password,
    };
    if (form.email) body.email = form.email;
    if (form.phone) body.phone = form.phone;
    const created = await post("/users/", body);
    setModal(null); setErr(""); setMsg("Compte créé.");
    setCreds({ title: "Compte créé", username: created.username, password });
    list.reload();
  }

  async function editUser(form) {
    await patch(`/users/${modal.item.id}/`, {
      first_name: form.first_name, last_name: form.last_name,
      email: form.email || "", phone: form.phone || "",
    });
    setModal(null); setErr(""); setMsg("Compte modifié.");
    list.reload();
  }

  async function resetPassword(u) {
    if (!window.confirm(`Générer un nouveau mot de passe pour « ${u.username} » ? `
        + "L'ancien ne fonctionnera plus.")) return;
    try {
      const data = await post(`/users/${u.id}/reset-password/`, {});
      setErr(""); setMsg("");
      setCreds({ title: "Nouveau mot de passe", username: data.username, password: data.password });
    } catch (e) { setMsg(""); setErr(errMessage(e)); }
  }

  async function toggleActive(u) {
    const verb = u.is_active ? "désactiver" : "réactiver";
    if (!window.confirm(`Voulez-vous ${verb} le compte « ${u.username} » ?`
        + (u.is_active ? " Cette personne ne pourra plus se connecter." : ""))) return;
    try {
      await post(`/users/${u.id}/set-active/`, { is_active: !u.is_active });
      setErr(""); setMsg(`Compte ${u.is_active ? "désactivé" : "réactivé"}.`);
      list.reload();
    } catch (e) { setMsg(""); setErr(errMessage(e)); }
  }

  return (
    <div>
      <PageHeader title="Comptes utilisateurs"
        subtitle="Accès à la plateforme : mots de passe, activation, désactivation">
        <button className="btn btn-primary" onClick={() => setModal({ type: "new" })}>
          + Nouveau compte</button>
      </PageHeader>
      <SuccessBox>{msg}</SuccessBox>
      <ErrorBox error={err || list.error} />
      <p className="hint" style={{ marginBottom: 12 }}>
        Pour un enseignant, un parent ou un élève, utilisez plutôt le bouton « Créer un accès »
        sur sa fiche (pages Enseignants, Parents, Élèves) : le compte est alors relié à la fiche.
      </p>
      <div className="card">
        <div className="toolbar">
          <input className="input search" placeholder="Identifiant, nom…"
                 value={list.input} onChange={(e) => list.setInput(e.target.value)} />
          <select className="input" value={role}
                  onChange={(e) => { setRole(e.target.value); list.setPage(1); }}>
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input" value={active}
                  onChange={(e) => { setActive(e.target.value); list.setPage(1); }}>
            <option value="">Tous les statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Désactivés</option>
          </select>
        </div>
        {list.loading ? <Spinner /> : list.items.length === 0
          ? <Empty message="Aucun compte" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Identifiant</th><th>Nom</th><th>Rôle</th><th>Fiche reliée</th>
                          <th>Dernière connexion</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.username}</b></td>
                    <td>{u.last_name} {u.first_name}</td>
                    <td><Badge tone="blue">{ROLE_LABELS[u.role] || u.role}</Badge></td>
                    <td>{u.linked_to || "—"}</td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString("fr-FR") : "Jamais"}</td>
                    <td><Badge tone={u.is_active ? "green" : "red"}>
                          {u.is_active ? "Actif" : "Désactivé"}</Badge></td>
                    <td className="row-actions">
                      <button className="btn btn-sm" onClick={() => setModal({ type: "edit", item: u })}>
                        Modifier</button>
                      <button className="btn btn-sm" onClick={() => resetPassword(u)}>
                        Mot de passe</button>
                      {u.id !== me.id && (
                        <button className={`btn btn-sm ${u.is_active ? "btn-danger" : ""}`}
                                onClick={() => toggleActive(u)}>
                          {u.is_active ? "Désactiver" : "Réactiver"}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={list.page} setPage={list.setPage}
                    next={list.next} previous={list.previous} count={list.count} />
      </div>

      {modal?.type === "new" && (
        <FormModal title="Nouveau compte" fields={NEW_FIELDS} initial={{ role: "ACCOUNTANT" }}
                   onClose={() => setModal(null)} onSave={createUser} />)}
      {modal?.type === "edit" && (
        <FormModal title={`Modifier — ${modal.item.username}`} fields={EDIT_FIELDS}
                   initial={modal.item} onClose={() => setModal(null)} onSave={editUser} />)}
      {creds && (
        <CredentialsModal title={creds.title} username={creds.username}
                          password={creds.password} onClose={() => setCreds(null)} />)}
    </div>
  );
}