import { useState } from "react";
import { errMessage, patch, post, useList } from "../api";
import { Badge, Empty, ErrorBox, FormModal, PageHeader, Pagination,
         Spinner, SuccessBox } from "../components/ui";

const SCHOOL_FIELDS = [
  { name: "name", label: "Nom de l'établissement", full: true },
  { name: "code", label: "Code court et unique (ex. LYCDEM)" },
  { name: "city", label: "Ville", required: false },
  { name: "address", label: "Adresse", required: false, full: true },
  { name: "phone", label: "Téléphone", required: false },
  { name: "email", label: "Email", type: "email", required: false },
  { name: "currency", label: "Devise" },
  { name: "pass_mark", label: "Moyenne de passage", type: "number", step: "0.5", min: 0, max: 20 },
];

const ADMIN_FIELDS = [
  { name: "first_name", label: "Prénom de l'administrateur" },
  { name: "last_name", label: "Nom de l'administrateur" },
  { name: "username", label: "Identifiant de connexion" },
  { name: "password", label: "Mot de passe (8 caractères min.)", type: "password" },
];

function pick(form, fields) {
  const body = {};
  fields.forEach((f) => {
    if (form[f.name] !== undefined && form[f.name] !== null) body[f.name] = form[f.name];
  });
  return body;
}

export default function Schools() {
  const list = useList("/schools/");
  const [modal, setModal] = useState(null); // {type: "new" | "edit" | "admin", school?}
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function createSchool(form) {
    const school = await post("/schools/", {
      ...pick(form, SCHOOL_FIELDS.filter((f) => f.name !== "code")),
      code: form.code.trim().toUpperCase().replace(/\s+/g, ""),
      currency: form.currency || "FCFA",
      pass_mark: form.pass_mark || 10,
    });
    setModal(null);
    try {
      await post("/users/", {
        username: form.admin_username, first_name: form.admin_first_name,
        last_name: form.admin_last_name, password: form.admin_password,
        role: "SCHOOL_ADMIN", school: school.id,
      });
      setMsg(`Établissement « ${school.name} » créé avec son administrateur « ${form.admin_username} ».`);
      setError("");
    } catch (e) {
      setMsg("");
      setError(`Établissement créé, mais l'administrateur n'a pas pu l'être : ${errMessage(e)} `
        + "Utilisez « + Administrateur » sur la ligne de l'établissement.");
    }
    list.reload();
  }

  async function editSchool(form) {
    await patch(`/schools/${modal.school.id}/`, pick(form, SCHOOL_FIELDS));
    setModal(null); setMsg("Établissement modifié."); list.reload();
  }

  async function addAdmin(form) {
    await post("/users/", { ...pick(form, ADMIN_FIELDS), role: "SCHOOL_ADMIN", school: modal.school.id });
    setModal(null); setMsg(`Administrateur « ${form.username} » créé.`); setError("");
  }

  async function toggle(s) {
    const action = s.is_active ? "désactiver" : "réactiver";
    if (!window.confirm(`Voulez-vous ${action} « ${s.name} » ?`
        + (s.is_active ? " Ses utilisateurs ne pourront plus se connecter." : ""))) return;
    try {
      await patch(`/schools/${s.id}/`, { is_active: !s.is_active });
      setMsg(`Établissement ${s.is_active ? "désactivé" : "réactivé"}.`); setError("");
      list.reload();
    } catch (e) { setError(errMessage(e)); }
  }

  return (
    <div>
      <PageHeader title="Établissements" subtitle="Gestion de la plateforme (super administrateur)">
        <button className="btn btn-primary" onClick={() => setModal({ type: "new" })}>
          + Nouvel établissement</button>
      </PageHeader>
      <SuccessBox>{msg}</SuccessBox>
      <ErrorBox error={error || list.error} />
      <div className="card">
        <div className="toolbar">
          <input className="input search" placeholder="Nom, code, ville…"
                 value={list.input} onChange={(e) => list.setInput(e.target.value)} />
        </div>
        {list.loading ? <Spinner /> : list.items.length === 0
          ? <Empty message="Aucun établissement" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nom</th><th>Code</th><th>Ville</th><th>Téléphone</th>
                          <th>Devise</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {list.items.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td><td>{s.code}</td><td>{s.city || "—"}</td>
                    <td>{s.phone || "—"}</td><td>{s.currency}</td>
                    <td><Badge tone={s.is_active ? "green" : "red"}>
                          {s.is_active ? "Actif" : "Désactivé"}</Badge></td>
                    <td className="row-actions">
                      <button className="btn btn-sm" onClick={() => setModal({ type: "edit", school: s })}>Modifier</button>
                      <button className="btn btn-sm" onClick={() => setModal({ type: "admin", school: s })}>+ Administrateur</button>
                      <button className="btn btn-sm" onClick={() => toggle(s)}>
                        {s.is_active ? "Désactiver" : "Réactiver"}</button>
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
        <FormModal title="Nouvel établissement"
          fields={[...SCHOOL_FIELDS, ...ADMIN_FIELDS.map((f) => ({ ...f, name: `admin_${f.name}` }))]}
          initial={{ currency: "FCFA", pass_mark: 10 }}
          onClose={() => setModal(null)} onSave={createSchool} />)}
      {modal?.type === "edit" && (
        <FormModal title={`Modifier — ${modal.school.name}`} fields={SCHOOL_FIELDS}
          initial={modal.school} onClose={() => setModal(null)} onSave={editSchool} />)}
      {modal?.type === "admin" && (
        <FormModal title={`Nouvel administrateur — ${modal.school.name}`} fields={ADMIN_FIELDS}
          onClose={() => setModal(null)} onSave={addAdmin} />)}
    </div>
  );
}