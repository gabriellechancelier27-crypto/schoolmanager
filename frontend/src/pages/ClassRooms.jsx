import { useEffect, useState } from "react";
import { ROLES, can, useAuth } from "../auth";
import { errMessage, getAll, post } from "../api";
import { Empty, ErrorBox, FormModal, PageHeader, SuccessBox } from "../components/ui";

export default function ClassRooms() {
  const { user } = useAuth();
  const canWrite = can(user, ROLES.MANAGERS);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [selected, setSelected] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showClass, setShowClass] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  useEffect(() => {
    Promise.all([getAll("/classrooms/"), getAll("/teachers/"), getAll("/subjects/"), getAll("/school-years/")])
      .then(([c, t, s, y]) => {
        setClasses(c); setTeachers(t); setSubjects(s); setYears(y);
        const current = y.find((yr) => yr.is_current);
        if (current) setYearId(current.id);
      })
      .catch((e) => setError(errMessage(e)));
  }, [tick]);

  useEffect(() => {
    if (!selected || !yearId) { setAssignments([]); return; }
    getAll("/teaching-assignments/", { class_room: selected, school_year: yearId })
      .then(setAssignments).catch((e) => setError(errMessage(e)));
  }, [selected, yearId, tick]);

  async function addClass(form) {
    await post("/classrooms/", form);
    setShowClass(false); setMsg("Classe créée."); setTick((t) => t + 1);
  }

  async function addAssignment(form) {
    await post("/teaching-assignments/", {
      teacher: Number(form.teacher), subject: Number(form.subject),
      class_room: Number(form.class_room || selected),
      school_year: Number(form.school_year || yearId),
      coefficient: form.coefficient || 1,
    });
    setShowAssign(false); setMsg("Affectation enregistrée."); setTick((t) => t + 1);
    setSelected(String(form.class_room || selected));
  }

  const teacherOpts = teachers.map((t) => ({ value: t.id, label: `${t.last_name} ${t.first_name}` }));
  const classOpts = classes.map((c) => ({ value: c.id, label: c.name }));
  const classFields = [
    { name: "name", label: "Nom (ex. 6ème A)" },
    { name: "level", label: "Niveau", required: false },
    { name: "serie", label: "Série", required: false },
    { name: "capacity", label: "Capacité", type: "number", min: 1 },
    { name: "main_teacher", label: "Professeur principal", type: "select",
      required: false, options: teacherOpts },
  ];
  const assignFields = [
    { name: "teacher", label: "Enseignant", type: "select", options: teacherOpts },
    { name: "subject", label: "Matière", type: "select",
      options: subjects.map((s) => ({ value: s.id, label: s.name })) },
    { name: "class_room", label: "Classe", type: "select", options: classOpts },
    { name: "school_year", label: "Année scolaire", type: "select",
      options: years.map((y) => ({ value: y.id, label: y.label })) },
    { name: "coefficient", label: "Coefficient", type: "number", step: "0.5", min: "0.5" },
  ];
  const selectedName = classes.find((c) => c.id === Number(selected))?.name || "";

  return (
    <div>
      <PageHeader title="Classes & matières"
        subtitle="Classes, effectifs et affectations enseignant/matière">
        {canWrite && (
          <>
            <button className="btn btn-primary" onClick={() => setShowAssign(true)}>+ Affectation</button>
            <button className="btn" onClick={() => setShowClass(true)}>+ Classe</button>
          </>
        )}
      </PageHeader>
      <ErrorBox error={error} />
      <SuccessBox>{msg}</SuccessBox>

      <div className="card">
        <h2>Classes</h2>
        {classes.length === 0 ? <Empty message="Aucune classe" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nom</th><th>Niveau</th><th>Série</th><th>Effectif</th>
                          <th>Prof. principal</th><th /></tr></thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className={selected && Number(selected) === c.id ? "row-selected" : ""}>
                    <td><b>{c.name}</b></td><td>{c.level || "—"}</td><td>{c.serie || "—"}</td>
                    <td>{c.student_count} / {c.capacity}</td>
                    <td>{c.main_teacher_name || "—"}</td>
                    <td><button className="btn btn-sm" onClick={() => setSelected(String(c.id))}>
                          Affectations</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Affectations {selectedName && `— ${selectedName}`}</h2>
        <div className="toolbar">
          <select className="input" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="">Année…</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choisir une classe…</option>
            {classOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {!selected ? <Empty message="Sélectionnez une classe pour voir ses matières et coefficients" />
          : assignments.length === 0 ? <Empty message="Aucune affectation pour cette classe" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Enseignant</th><th>Matière</th><th>Coefficient</th></tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}><td>{a.teacher_name}</td><td>{a.subject_name}</td>
                    <td><b>{a.coefficient}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showClass && (
        <FormModal title="Nouvelle classe" fields={classFields} initial={{ capacity: 60 }}
          onClose={() => setShowClass(false)} onSave={addClass} />)}
      {showAssign && (
        <FormModal title="Nouvelle affectation" fields={assignFields}
          initial={{ class_room: selected, school_year: yearId, coefficient: 1 }}
          onClose={() => setShowAssign(false)} onSave={addAssignment} />)}
    </div>
  );
}