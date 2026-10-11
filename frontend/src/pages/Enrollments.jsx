import { useEffect, useState } from "react";
import { del, errMessage, getAll, get, patch, post, useList } from "../api";
import { Badge, Empty, ErrorBox, Field, FormModal, Modal, PageHeader,
         Pagination, Spinner, SuccessBox } from "../components/ui";

const STATUS = [
  { value: "ACTIVE", label: "Active" },
  { value: "CANCELLED", label: "Annulée" },
  { value: "TRANSFERRED", label: "Transfert" },
];

export default function Enrollments() {
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const list = useList("/enrollments/", { school_year: yearId || undefined });
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [student, setStudent] = useState(null);
  const [classRoom, setClassRoom] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([getAll("/school-years/"), getAll("/classrooms/")]).then(([y, c]) => {
      setYears(y); setClasses(c);
      const current = y.find((yr) => yr.is_current);
      if (current) setYearId(current.id);
    }).catch((e) => setErr(errMessage(e)));
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      get("/students/", { search: q }).then((d) => setResults(d.results)).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  async function save() {
    if (!student || !classRoom || !yearId) { setErr("Élève, classe et année obligatoires."); return; }
    try {
      await post("/enrollments/", {
        student_id: student.id, class_room_id: Number(classRoom), school_year_id: Number(yearId),
      });
      setShow(false); setStudent(null); setQ(""); setClassRoom("");
      setErr(""); setMsg("Inscription enregistrée."); list.reload();
    } catch (e) { setErr(errMessage(e)); }
  }

  function openEdit(e) {
    // l'API ne renvoie que le nom de la classe : on retrouve son identifiant
    const cls = classes.find((c) => c.name === e.class_room_name);
    setEditing({ id: e.id, class_room_id: cls ? cls.id : "", status: e.status,
                 title: `${e.student.last_name} ${e.student.first_name}` });
  }

  async function saveEdit(form) {
    await patch(`/enrollments/${editing.id}/`, {
      class_room_id: Number(form.class_room_id), status: form.status,
    });
    setEditing(null); setErr(""); setMsg("Inscription modifiée."); list.reload();
  }

  async function remove(e) {
    if (!window.confirm(`Supprimer l'inscription de ${e.student.last_name} ${e.student.first_name} ? `
      + "Impossible si des notes ou des paiements y sont liés.")) return;
    try {
      await del(`/enrollments/${e.id}/`);
      setErr(""); setMsg("Inscription supprimée."); list.reload();
    } catch (x) { setMsg(""); setErr(errMessage(x)); }
  }

  return (
    <div>
      <PageHeader title="Inscriptions & réinscriptions"
        subtitle="Associer un élève à une classe pour une année scolaire">
        <button className="btn btn-primary" onClick={() => { setShow(true); setErr(""); }}>+ Inscription</button>
      </PageHeader>
      <SuccessBox>{msg}</SuccessBox>
      <ErrorBox error={err || list.error} />
      <div className="card">
        <div className="toolbar">
          <select className="input" value={yearId}
                  onChange={(e) => { setYearId(e.target.value); list.setPage(1); }}>
            <option value="">Toutes les années</option>
            {years.map((y) => <option key={y.id} value={y.id}>
              {y.label}{y.is_current ? " (en cours)" : ""}</option>)}
          </select>
          <input className="input search" placeholder="Rechercher un élève…"
                 value={list.input} onChange={(e) => list.setInput(e.target.value)} />
        </div>
        {list.loading ? <Spinner /> : (
          list.items.length === 0 ? <Empty message="Aucune inscription" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Matricule</th><th>Élève</th><th>Classe</th>
                            <th>Année</th><th>Date</th><th>Statut</th><th /></tr></thead>
                <tbody>
                  {list.items.map((e) => (
                    <tr key={e.id}>
                      <td>{e.student.matricule}</td>
                      <td><b>{e.student.last_name}</b> {e.student.first_name}</td>
                      <td>{e.class_room_name}</td>
                      <td>{e.school_year_label}</td>
                      <td>{e.date}</td>
                      <td><Badge tone={e.status === "ACTIVE" ? "green" : "gray"}>{e.status}</Badge></td>
                      <td className="row-actions">
                        <button className="btn btn-sm" onClick={() => openEdit(e)}>Modifier</button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(e)}>Suppr.</button>
                      </td>
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

      <Modal title="Nouvelle inscription" open={show} onClose={() => setShow(false)}>
        {err && <div className="alert alert-error">{err}</div>}
        <Field label="Rechercher un élève (nom ou matricule)">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </Field>
        {!student && q && (
          <div className="student-picker">
            {results.map((s) => (
              <button key={s.id} className="picker-item" onClick={() => setStudent(s)}>
                <b>{s.last_name} {s.first_name}</b> <span className="muted">{s.matricule}</span>
              </button>
            ))}
            {results.length === 0 && <p className="muted">Aucun résultat…</p>}
          </div>
        )}
        {student && (
          <p className="alert alert-success">
            Élève sélectionné : <b>{student.last_name} {student.first_name}</b> ({student.matricule}){" "}
            <button className="btn btn-sm" onClick={() => setStudent(null)}>Changer</button>
          </p>
        )}
        <Field label="Classe">
          <select className="input" value={classRoom} onChange={(e) => setClassRoom(e.target.value)}>
            <option value="">—</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Année scolaire">
          <select className="input" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </Field>
        <div className="modal-actions">
          <button className="btn" onClick={() => setShow(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={!student || !classRoom}>
            Inscrire
          </button>
        </div>
      </Modal>

      {editing && (
        <FormModal title={`Modifier l'inscription — ${editing.title}`}
          fields={[
            { name: "class_room_id", label: "Classe", type: "select",
              options: classes.map((c) => ({ value: c.id, label: c.name })) },
            { name: "status", label: "Statut", type: "select", options: STATUS },
          ]}
          initial={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      )}
    </div>
  );
}