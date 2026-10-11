import { useEffect, useState } from "react";
import { ROLES, can, useAuth } from "../auth";
import { downloadFile, errMessage, getAll, post, useList } from "../api";
import { Badge, Empty, ErrorBox, Field, PageHeader, Pagination,
         Spinner, StatCard, SuccessBox } from "../components/ui";

const MENTION_TONES = { "Très bien": "green", "Bien": "blue", "Assez bien": "yellow",
  "Passable": "orange", "Insuffisant": "red" };

export default function ReportCards() {
  const { user } = useAuth();
  const canCompute = can(user, ROLES.MANAGERS);
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const list = useList("/report-cards/",
    { period: periodId || undefined, classe: classId || undefined });

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

  async function compute() {
    setBusy(true); setError(""); setMsg(""); setStats(null);
    try {
      setStats(await post("/report-cards/compute/",
        { class_room_id: Number(classId), period_id: Number(periodId) }));
      setMsg("Bulletins calculés : moyennes, classements et notifications envoyées.");
      list.setPage(1); list.reload();
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  }

  async function validate(id) {
    try { await post(`/report-cards/${id}/validate/`); list.reload(); }
    catch (e) { setError(errMessage(e)); }
  }

  return (
    <div>
      <PageHeader title="Bulletins & classement"
        subtitle="Calcul automatique des moyennes et édition PDF (§4.10, §4.11)">
        {canCompute && (
          <button className="btn btn-primary" disabled={!classId || !periodId || busy}
                  onClick={compute}>
            {busy ? "Calcul en cours…" : "Calculer les bulletins"}
          </button>)}
      </PageHeader>
      <ErrorBox error={error || list.error} />
      <SuccessBox>{msg}</SuccessBox>

      <div className="card">
        <div className="form-grid">
          <Field label="Année">
            <select className="input" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">—</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </Field>
          <Field label="Période">
            <select className="input" value={periodId}
                    onChange={(e) => { setPeriodId(e.target.value); list.setPage(1); }}>
              <option value="">Toutes</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Classe">
            <select className="input" value={classId}
                    onChange={(e) => { setClassId(e.target.value); list.setPage(1); }}>
              <option value="">Toutes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <StatCard label="Moyenne de classe" value={stats.moyenne_de_classe} />
          <StatCard label="Meilleur élève" value={stats.meilleur_eleve}
                    hint={`${stats.meilleure_moyenne} / 20`} />
          <StatCard label="Effectif évalué" value={stats.effectif_evalue} />
          <StatCard label="Taux de réussite" value={`${stats.taux_de_reussite} %`} />
        </div>
      )}

      <div className="card">
        {list.loading ? <Spinner /> : (
          list.items.length === 0 ? <Empty message="Aucun bulletin — lancez le calcul" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Rang</th><th>Élève</th><th>Classe</th><th>Période</th>
                            <th>Moyenne</th><th>Mention</th><th>Abs.</th><th>Ret.</th>
                            <th>État</th><th /></tr></thead>
                <tbody>
                  {list.items.map((rc) => (
                    <tr key={rc.id}>
                      <td><b>{rc.rank ?? "—"}</b></td>
                      <td>{rc.student}</td>
                      <td>{rc.class_name}</td>
                      <td>{rc.period_name}</td>
                      <td><b>{rc.average ?? "—"}</b></td>
                      <td><Badge tone={MENTION_TONES[rc.mention] || "gray"}>{rc.mention || "—"}</Badge></td>
                      <td>{rc.absences_count}</td>
                      <td>{rc.lates_count}</td>
                      <td><Badge tone={rc.is_validated ? "green" : "yellow"}>
                            {rc.is_validated ? "Validé" : "Provisoire"}</Badge></td>
                      <td className="row-actions">
                        <button className="btn btn-sm"
                                onClick={() => downloadFile(`/report-cards/${rc.id}/pdf/`,
                                  `bulletin_${rc.matricule}.pdf`)}>PDF</button>
                        {canCompute && !rc.is_validated && (
                          <button className="btn btn-sm" onClick={() => validate(rc.id)}>Valider</button>)}
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
    </div>
  );
}