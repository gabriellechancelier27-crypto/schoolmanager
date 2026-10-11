import { useEffect, useState } from "react";
import { ROLES, can, useAuth } from "../auth";
import { api, downloadFile, errMessage, getAll, mediaUrl, patch, post, useList } from "../api";
import { Badge, Empty, ErrorBox, Field, FormModal, Modal, PageHeader,
         Pagination, Spinner, SuccessBox } from "../components/ui";
import { AccessButton } from "../components/Credentials";

const FIELDS = [
  { name: "first_name", label: "Prénom" },
  { name: "last_name", label: "Nom" },
  { name: "gender", label: "Sexe", type: "select",
    options: [{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }] },
  { name: "birth_date", label: "Date de naissance", type: "date", required: false },
  { name: "birth_place", label: "Lieu de naissance", required: false },
  { name: "phone", label: "Téléphone", required: false },
  { name: "status", label: "Statut", type: "select", options: [
    { value: "ACTIVE", label: "Actif" }, { value: "INACTIVE", label: "Inactif" },
    { value: "GRADUATED", label: "Diplômé" }, { value: "TRANSFERRED", label: "Transféré" }] },
];

const RELATIONS = [["PERE", "Père"], ["MERE", "Mère"], ["TUTEUR", "Tuteur / Tutrice"], ["AUTRE", "Autre"]];

function Avatar({ student }) {
  const src = mediaUrl(student.photo);
  if (src) return <img className="avatar" src={src} alt="" />;
  return <span className="avatar">{(student.first_name?.[0] || "") + (student.last_name?.[0] || "")}</span>;
}

/** Gestion des parents / tuteurs liés à un élève. */
function ParentsModal({ student, onClose, onSaved }) {
  const [all, setAll] = useState([]);
  const [links, setLinks] = useState(() =>
    (student.parents || []).map((sp) => ({
      parent_id: sp.parent.id,
      name: `${sp.parent.last_name} ${sp.parent.first_name}`,
      relation: sp.relation,
    })));
  const [parentId, setParentId] = useState("");
  const [relation, setRelation] = useState("TUTEUR");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAll("/parents/").then(setAll).catch((e) => setError(errMessage(e)));
  }, []);

  const available = all.filter((p) => !links.some((l) => l.parent_id === p.id));

  function add() {
    const p = all.find((x) => x.id === Number(parentId));
    if (!p) return;
    setLinks([...links, { parent_id: p.id, name: `${p.last_name} ${p.first_name}`, relation }]);
    setParentId("");
  }

  const changeRelation = (id, rel) =>
    setLinks(links.map((l) => (l.parent_id === id ? { ...l, relation: rel } : l)));
  const remove = (id) => setLinks(links.filter((l) => l.parent_id !== id));

  async function save() {
    setSaving(true); setError("");
    try {
      await patch(`/students/${student.id}/`, {
        links: links.map(({ parent_id, relation: rel }) => ({ parent_id, relation: rel })),
      });
      onSaved();
    } catch (e) { setError(errMessage(e)); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Parents / tuteurs — ${student.last_name} ${student.first_name}`} open onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      {links.length === 0 ? <Empty message="Aucun parent lié à cet élève" /> : (
        <table className="table">
          <tbody>
            {links.map((l) => (
              <tr key={l.parent_id}>
                <td><b>{l.name}</b></td>
                <td>
                  <select className="input" value={l.relation}
                          onChange={(e) => changeRelation(l.parent_id, e.target.value)}>
                    {RELATIONS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                  </select>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={() => remove(l.parent_id)}>
                      Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="form-grid" style={{ marginTop: 14 }}>
        <Field label="Ajouter un parent">
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">—</option>
            {available.map((p) => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
          </select>
        </Field>
        <Field label="Relation">
          <select className="input" value={relation} onChange={(e) => setRelation(e.target.value)}>
            {RELATIONS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
          </select>
        </Field>
      </div>
      <p className="hint">
        Le parent doit d'abord exister dans la page « Parents ». Il verra les notes de l'élève
        une fois son accès créé et relié à cet élève.
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={add} disabled={!parentId}>+ Ajouter à la liste</button>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

export default function Students() {
  const { user } = useAuth();
  const canWrite = can(user, ROLES.MANAGERS);
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState([]);
  const list = useList("/students/", classId ? { classe: classId } : {});
  const [editing, setEditing] = useState(null);
  const [parentsOf, setParentsOf] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { getAll("/classrooms/").then(setClasses).catch(() => {}); }, []);

  async function save(form) {
    // On n'envoie que les champs éditables (jamais l'URL de la photo)
    const body = {};
    FIELDS.forEach((f) => {
      let v = form[f.name];
      if (v === undefined || v === null) return;
      if (v === "" && f.type === "date") v = null;
      body[f.name] = v;
    });
    if (editing.id) await patch(`/students/${editing.id}/`, body);
    else await post("/students/", body);
    setEditing(null);
    setErr("");
    setMsg("Élève enregistré avec succès.");
    list.reload();
  }

  async function toggleStatus(s) {
    try {
      await patch(`/students/${s.id}/`, { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      list.reload();
    } catch (e) { setErr(errMessage(e)); }
  }

  async function uploadPhoto(student, e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("Image trop lourde (2 Mo maximum)."); return; }
    const fd = new FormData();
    fd.append("photo", file);
    try {
      await api.post(`/students/${student.id}/photo/`, fd);
      setErr(""); setMsg("Photo enregistrée.");
      list.reload();
    } catch (x) { setErr(errMessage(x)); }
  }

  async function doImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/students/import/", fd);
      setMsg(`Import terminé : ${data.crees} créé(s), ${data.mis_a_jour} mis à jour.`);
      list.reload();
    } catch (e2) { setErr(errMessage(e2)); }
    e.target.value = "";
  }

  return (
    <div>
      <PageHeader title="Élèves"
        subtitle={user.role === "PARENT" ? "Vos enfants" : "Effectif de l'établissement"}>
        {canWrite && (
          <>
            <label className="btn">
              Importer Excel
              <input type="file" accept=".xlsx,.xls" hidden onChange={doImport} />
            </label>
            <button className="btn"
                    onClick={() => downloadFile("/students/export/", "eleves.xlsx")}>
              Exporter Excel
            </button>
            <button className="btn btn-primary"
                    onClick={() => setEditing({ status: "ACTIVE" })}>+ Ajouter</button>
          </>
        )}
      </PageHeader>
      <SuccessBox>{msg}</SuccessBox>
      <ErrorBox error={err || list.error} />
      <div className="card">
        <div className="toolbar">
          <input className="input search" placeholder="Matricule, nom, prénom…"
                 value={list.input} onChange={(e) => list.setInput(e.target.value)} />
          <select className="input" value={classId}
                  onChange={(e) => { setClassId(e.target.value); list.setPage(1); }}>
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {list.loading ? <Spinner /> : (
          list.items.length === 0 ? <Empty message="Aucun élève trouvé" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th /><th>Matricule</th><th>Nom & prénom</th><th>Sexe</th>
                      <th>Classe</th><th>Parents</th><th>Statut</th>
                      {canWrite && <th>Accès</th>}{canWrite && <th />}</tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s.id}>
                      <td><Avatar student={s} /></td>
                      <td>{s.matricule}</td>
                      <td><b>{s.last_name}</b> {s.first_name}</td>
                      <td>{s.gender}</td>
                      <td>{s.current_class || "—"}</td>
                      <td>{s.parents?.length
                        ? s.parents.map((p) => `${p.parent.last_name} ${p.parent.first_name}`).join(", ")
                        : "—"}</td>
                      <td><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>
                            {s.status === "ACTIVE" ? "Actif" : s.status}</Badge></td>
                      {canWrite && (
                        <td><Badge tone={s.user ? "green" : "gray"}>{s.user ? "Actif" : "Aucun"}</Badge></td>
                      )}
                      {canWrite && (
                        <td className="row-actions">
                          <AccessButton kind="student" item={s} onDone={list.reload} />
                          <button className="btn btn-sm" onClick={() => setEditing(s)}>Modifier</button>
                          <button className="btn btn-sm" onClick={() => setParentsOf(s)}>Parents</button>
                          <label className="btn btn-sm">
                            Photo
                            <input type="file" accept="image/*" hidden
                                   onChange={(e) => uploadPhoto(s, e)} />
                          </label>
                          <button className="btn btn-sm" onClick={() => toggleStatus(s)}>
                            {s.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        <Pagination page={list.page} setPage={list.setPage}
                    next={list.next} previous={list.previous} count={list.count} />
      </div>
      {editing && (
        <FormModal title={editing.id ? "Modifier l'élève" : "Nouvel élève"}
          fields={FIELDS} initial={editing}
          onClose={() => setEditing(null)} onSave={save} />
      )}
      {parentsOf && (
        <ParentsModal student={parentsOf} onClose={() => setParentsOf(null)}
          onSaved={() => { setParentsOf(null); setMsg("Parents mis à jour."); list.reload(); }} />
      )}
    </div>
  );
}