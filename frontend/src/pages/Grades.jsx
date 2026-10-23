import { useEffect, useState } from "react";
import { errMessage, getAll, post } from "../api";
import { Empty, ErrorBox, Field, PageHeader, Spinner, SuccessBox } from "../components/ui";

// Deux types seulement : la moyenne des devoirs ("moyenne de classe") et la composition
const ASSESSMENTS = [
  { value: "DEVOIR", label: "Devoir (moyenne de classe)" },
  { value: "COMPOSITION", label: "Composition" },
];

export default function Grades() {
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [assessment, setAssessment] = useState("DEVOIR");
  const [sequence, setSequence] = useState(1);
  const [enrollments, setEnrollments] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // La composition n'a qu'une note par élève : son numéro est toujours 1
  const seq = assessment === "COMPOSITION" ? 1 : Number(sequence) || 1;

  useEffect(() => {
    getAll("/school-years/").then((ys) => {
      setYears(ys);
      const current = ys.find((y) => y.is_current);
      if (current) setYearId(current.id);
    }).catch((e) => setError(errMessage(e)));
    getAll("/classrooms/").then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    setPeriodId(""); setPeriods([]);
    if (!yearId) return;
    getAll("/periods/", { school_year: yearId }).then(setPeriods).catch(() => {});
  }, [yearId]);

  useEffect(() => {
    setSubjectId(""); setAssignments([]); setEnrollments([]); setValues({});
    if (!classId || !yearId) return;
    setLoading(true);
    Promise.all([
      getAll("/teaching-assignments/", { class_room: classId, school_year: yearId }),
      getAll("/enrollments/", { class_room: classId, school_year: yearId }),
    ]).then(([assigns, enrs]) => {
      setAssignments(assigns);
      setEnrollments(enrs);
      setValues(Object.fromEntries(enrs.map((e) => [e.id, { value: "" }])));
    }).catch((e) => setError(errMessage(e))).finally(() => setLoading(false));
  }, [classId, yearId]);

  // Pré-remplissage avec les notes déjà saisies
  useEffect(() => {
    if (!periodId || !subjectId || enrollments.length === 0) return;
    // on vide d'abord les champs, puis on remet les notes existantes
    setValues(Object.fromEntries(enrollments.map((e) => [e.id, { value: "" }])));
    getAll("/grades/", { period: periodId, subject: subjectId, assessment_type: assessment })
      .then((grades) => {
        const ids = new Set(enrollments.map((e) => e.id));
        setValues((prev) => {
          const next = { ...prev };
          grades.filter((g) => Number(g.sequence) === seq && ids.has(g.enrollment_id))
            .forEach((g) => { next[g.enrollment_id] = { value: String(g.value) }; });
          return next;
        });
      }).catch(() => {});
  }, [periodId, subjectId, assessment, seq, enrollments]);

  const setVal = (id, v) => setValues((prev) => ({ ...prev, [id]: { value: v } }));

  async function save() {
    const notes = enrollments
      .filter((e) => values[e.id] && values[e.id].value !== "")
      .map((e) => ({
        enrollment_id: e.id,
        value: parseFloat(values[e.id].value),
        coefficient: 1,
      }));
    if (notes.length === 0) { setError("Aucune note saisie."); return; }
    setSaving(true); setError(""); setMsg("");
    try {
      const res = await post("/grades/bulk/", {
        class_room_id: Number(classId), subject_id: Number(subjectId),
        period_id: Number(periodId), assessment_type: assessment,
        sequence: seq, notes,
      });
      setMsg(`${res.enregistrees} note(s) enregistrée(s) — les parents concernés ont été notifiés.`);
    } catch (e) { setError(errMessage(e)); }
    finally { setSaving(false); }
  }

  const ready = periodId && classId && subjectId && enrollments.length > 0;

  return (
    <div>
      <PageHeader title="Saisie des notes"
        subtitle="Choisir classe, matière et période puis saisir les notes (§4.9)" />
      <ErrorBox error={error} />
      <SuccessBox>{msg}</SuccessBox>

      <div className="card">
        <div className="form-grid">
          <Field label="Année scolaire">
            <select className="input" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">—</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </Field>
          <Field label="Période">
            <select className="input" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">—</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Classe">
            <select className="input" value={classId}
                    onChange={(e) => setClassId(e.target.value)}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Matière (coefficient)">
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">—</option>
              {assignments.map((a) => (
                <option key={a.subject} value={a.subject}>
                  {a.subject_name} (coef {a.coefficient})
                </option>))}
            </select>
          </Field>
          <Field label="Type d'évaluation">
            <select className="input" value={assessment} onChange={(e) => setAssessment(e.target.value)}>
              {ASSESSMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          {assessment === "DEVOIR" && (
            <Field label="N° du devoir (1, 2, 3…)">
              <input className="input" type="number" min={1} value={sequence}
                     onChange={(e) => setSequence(e.target.value)} />
            </Field>
          )}
        </div>
        <p className="hint">
          Les devoirs d'une matière sont moyennés : c'est la « moyenne de classe ». La composition
          n'a qu'une note par élève. Moyenne de la matière = (moyenne des devoirs + composition) / 2.
        </p>
        {periods.find((p) => String(p.id) === periodId)?.is_locked && (
          <div className="alert alert-error">Cette période est verrouillée : saisie impossible.</div>
        )}
      </div>

      {loading && <Spinner />}
      {ready && !loading && (
        <div className="card">
          <h2>
            {classes.find((c) => String(c.id) === classId)?.name}, notes /20
            {assessment === "DEVOIR" ? `, devoir n° ${seq}` : ", composition"}
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Élève</th><th>Matricule</th><th>Note /20</th></tr></thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td><b>{e.student.last_name}</b> {e.student.first_name}</td>
                    <td>{e.student.matricule}</td>
                    <td><input className="input input-mini" type="number" min="0" max="20"
                               step="0.25" value={values[e.id]?.value ?? ""}
                               onChange={(ev) => setVal(e.id, ev.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Laisser vide pour ne pas enregistrer un élève. Après la saisie,
             relancez « Calculer les bulletins » pour mettre à jour les moyennes.</p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer les notes"}
            </button>
          </div>
        </div>
      )}
      {!ready && !loading && <div className="card"><Empty
        message="Sélectionnez l'année, la période, la classe et la matière pour afficher la liste des élèves" /></div>}
    </div>
  );
}
