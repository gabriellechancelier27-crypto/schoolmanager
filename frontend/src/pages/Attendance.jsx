import { useEffect, useState } from "react";
import { ROLES, can, useAuth } from "../auth";
import { errMessage, getAll, get, post, useList } from "../api";
import { Badge, Empty, ErrorBox, Field, PageHeader, Pagination,
         Spinner, StatCard, SuccessBox, todayStr } from "../components/ui";

const STATUS_LABELS = { PRESENT: "Présent", ABSENT: "Absent", LATE: "Retard", EXCUSED: "Justifiée" };

export default function Attendance() {
  const { user } = useAuth();
  const canCall = can(user, ROLES.GRADES);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [enrollments, setEnrollments] = useState([]);
  const [entries, setEntries] = useState({});
  const [stats, setStats] = useState(null);
  const [tick, setTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const recent = useList("/attendance/", { status: "ABSENT" });

  useEffect(() => {
    Promise.all([getAll("/classrooms/"), getAll("/subjects/"), getAll("/school-years/")])
      .then(([c, s, y]) => {
        setClasses(c); setSubjects(s); setYears(y);
        const current = y.find((yr) => yr.is_current);
        if (current) setYearId(current.id);
      }).catch((e) => setError(errMessage(e)));
  }, []);

  useEffect(() => {
    setEntries({}); setEnrollments([]);
    if (!classId || !yearId) return;
    getAll("/enrollments/", { class_room: classId, school_year: yearId }).then((enrs) => {
      setEnrollments(enrs);
      setEntries(Object.fromEntries(
        enrs.map((e) => [e.student.id, { status: "PRESENT", minutes_late: 0, reason: "" }])));
    }).catch((e) => setError(errMessage(e)));
  }, [classId, yearId]);

  useEffect(() => {
    get("/attendance/stats/", { class_room: classId || undefined })
      .then(setStats).catch(() => {});
  }, [classId, tick]);

  const setEntry = (id, field, value) =>
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  async function submit() {
    setSaving(true); setError(""); setMsg("");
    try {
      const res = await post("/attendance/call/", {
        class_room_id: Number(classId), school_year_id: Number(yearId),
        subject_id: subjectId ? Number(subjectId) : undefined, date,
        entries: enrollments.map((e) => ({
          student_id: e.student.id,
          status: entries[e.student.id]?.status || "PRESENT",
          minutes_late: Number(entries[e.student.id]?.minutes_late) || 0,
          reason: entries[e.student.id]?.reason || "",
        })),
      });
      setMsg(`Appel enregistré (${res.enregistres} élèves) — parents notifiés des absences.`);
      setTick((t) => t + 1); recent.reload();
    } catch (e) { setError(errMessage(e)); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Présences" subtitle="Appel, absences, retards et statistiques (§4.12)" />
      <ErrorBox error={error || recent.error} />
      <SuccessBox>{msg}</SuccessBox>

      {canCall && (
        <div className="card">
          <h2>Faire l'appel</h2>
          <div className="form-grid">
            <Field label="Classe">
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={date}
                     onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Matière (optionnelle)">
              <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">—</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          {classId && (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Élève</th><th>Statut</th><th>Retard (min) / Motif</th></tr></thead>
                  <tbody>
                    {enrollments.map((e) => {
                      const entry = entries[e.student.id] || { status: "PRESENT", minutes_late: 0, reason: "" };
                      return (
                        <tr key={e.id}>
                          <td><b>{e.student.last_name}</b> {e.student.first_name}</td>
                          <td>
                            <div className="radio-group">
                              {Object.keys(STATUS_LABELS).map((st) => (
                                <label key={st} className="att-opt">
                                  <input type="radio" checked={entry.status === st}
                                         onChange={() => setEntry(e.student.id, "status", st)} />
                                  {STATUS_LABELS[st]}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td>
                            {entry.status === "LATE" && (
                              <input className="input input-mini" type="number" min="0"
                                placeholder="min" value={entry.minutes_late}
                                onChange={(ev) => setEntry(e.student.id, "minutes_late", ev.target.value)} />)}
                            {entry.status !== "PRESENT" && (
                              <input className="input input-mini" placeholder="Motif"
                                value={entry.reason}
                                onChange={(ev) => setEntry(e.student.id, "reason", ev.target.value)} />)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={submit} disabled={saving || !enrollments.length}>
                  {saving ? "Enregistrement…" : "Enregistrer l'appel"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stats && stats.total > 0 && (
        <div className="stat-grid">
          <StatCard label="Absences" value={stats.absents} hint={`${stats.taux_absenteisme} % d'absentéisme`} />
          <StatCard label="Retards" value={stats.retards} />
          <StatCard label="Justifiées" value={stats.justifiees} />
          <StatCard label="Présences" value={stats.presents} />
        </div>
      )}

      <div className="card">
        <h2>Dernières absences</h2>
        {recent.loading ? <Spinner /> : (
          recent.items.length === 0 ? <Empty message="Aucune absence enregistrée" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Élève</th><th>Classe</th><th>Matière</th><th>Motif</th></tr></thead>
                <tbody>
                  {recent.items.map((a) => (
                    <tr key={a.id}>
                      <td>{a.date}</td><td>{a.student}</td><td>{a.class_name}</td>
                      <td>{a.subject_name || "—"}</td><td>{a.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        <Pagination page={recent.page} setPage={recent.setPage}
                    next={recent.next} previous={recent.previous} count={recent.count} />
      </div>
    </div>
  );
}