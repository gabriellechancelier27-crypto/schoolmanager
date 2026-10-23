import { useEffect, useState } from "react";
import { del, errMessage, getAll, patch, useList } from "../api";
import { Badge, Empty, ErrorBox, FormModal, PageHeader, Pagination,
         Spinner, SuccessBox } from "../components/ui";

// Les deux types actuels ; les autres libellés servent seulement aux anciennes notes
const TYPES = { DEVOIR: "Devoir", COMPOSITION: "Composition",
                INTERROGATION: "Devoir (ancien type)", PRATIQUE: "Devoir (ancien type)" };

export default function GradesHistory() {
  const [periods, setPeriods] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const list = useList("/grades/", {
    period: periodId || undefined, subject: subjectId || undefined,
  });

  useEffect(() => {
    getAll("/periods/").then(setPeriods).catch(() => {});
    getAll("/subjects/").then(setSubjects).catch(() => {});
  }, []);

  async function save(form) {
    await patch(`/grades/${editing.id}/`, { value: form.value });
    setEditing(null); setError("");
    setMsg("Note modifiée (opération journalisée). Relancez « Calculer les bulletins » pour mettre à jour les moyennes.");
    list.reload();
  }

  async function remove(g) {
    if (!window.confirm(`Supprimer la note ${g.value}/20 de ${g.student} en ${g.subject_name} ?`)) return;
    try {
      await del(`/grades/${g.id}/`);
      setError("");
      setMsg("Note supprimée (opération journalisée). Relancez « Calculer les bulletins » pour mettre à jour les moyennes.");
      list.reload();
    } catch (e) { setMsg(""); setError(errMessage(e)); }
  }

  return (
    <div>
      <PageHeader title="Historique des notes"
        subtitle="Corriger ou supprimer une note déjà enregistrée" />
      <SuccessBox>{msg}</SuccessBox>
      <ErrorBox error={error || list.error} />
      <div className="card">
        <div className="toolbar">
          <input className="input search" placeholder="Élève, matricule…"
                 value={list.input} onChange={(e) => list.setInput(e.target.value)} />
          <select className="input" value={periodId}
                  onChange={(e) => { setPeriodId(e.target.value); list.setPage(1); }}>
            <option value="">Toutes les périodes</option>
            {periods.map((p) => <option key={p.id} value={p.id}>
              {p.name} ({p.school_year_label})</option>)}
          </select>
          <select className="input" value={subjectId}
                  onChange={(e) => { setSubjectId(e.target.value); list.setPage(1); }}>
            <option value="">Toutes les matières</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {list.loading ? <Spinner /> : list.items.length === 0
          ? <Empty message="Aucune note enregistrée" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Élève</th><th>Classe</th><th>Matière</th><th>Période</th>
                          <th>Type</th><th>N°</th><th>Note</th><th /></tr></thead>
              <tbody>
                {list.items.map((g) => (
                  <tr key={g.id}>
                    <td><b>{g.student}</b><br /><span className="muted">{g.matricule}</span></td>
                    <td>{g.class_name}</td>
                    <td>{g.subject_name}</td>
                    <td>{g.period_name}</td>
                    <td><Badge tone={g.assessment_type === "COMPOSITION" ? "yellow" : "blue"}>
                          {TYPES[g.assessment_type] || g.assessment_type}</Badge></td>
                    <td>{g.sequence}</td>
                    <td><b>{g.value}</b> / 20</td>
                    <td className="row-actions">
                      <button className="btn btn-sm" onClick={() => setEditing(g)}>Modifier</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(g)}>Suppr.</button>
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

      {editing && (
        <FormModal title={`Modifier la note, ${editing.student} (${editing.subject_name})`}
          fields={[
            { name: "value", label: "Note /20", type: "number", step: "0.01", min: 0, max: 20 },
          ]}
          initial={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}
