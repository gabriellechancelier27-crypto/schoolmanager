import { useEffect, useState } from "react";
import { errMessage, getAll, post } from "../api";
import { Badge, Empty, ErrorBox, FormModal, PageHeader, SuccessBox } from "../components/ui";

export default function SchoolYearPage() {
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showYear, setShowYear] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);

  useEffect(() => {
    getAll("/school-years/").then((ys) => {
      setYears(ys);
      setYearId((prev) => prev || String((ys.find((y) => y.is_current) || ys[0])?.id || ""));
    }).catch((e) => setError(errMessage(e)));
  }, [tick]);

  useEffect(() => {
    if (!yearId) { setPeriods([]); return; }
    getAll("/periods/", { school_year: yearId }).then(setPeriods).catch(() => {});
  }, [yearId, tick]);

  async function addYear(form) {
    await post("/school-years/", form);
    setShowYear(false); setMsg("Année scolaire créée."); setTick((t) => t + 1);
  }

  async function addPeriod(form) {
    await post("/periods/", { ...form, school_year: Number(form.school_year || yearId), order: Number(form.order || 1) });
    setShowPeriod(false); setMsg("Période créée."); setTick((t) => t + 1);
  }

  async function archive(y) {
    if (!window.confirm(`Archiver l'année ${y.label} ?`)) return;
    await post(`/school-years/${y.id}/archive/`);
    setMsg("Année archivée."); setTick((t) => t + 1);
  }

  async function toggleLock(p) {
    await post(`/periods/${p.id}/${p.is_locked ? "unlock" : "lock"}/`);
    setTick((t) => t + 1);
  }

  return (
    <div>
      <PageHeader title="Années scolaires & périodes"
        subtitle="Historique, trimestres et verrouillage des résultats (§5.2)">
        <button className="btn btn-primary" onClick={() => setShowPeriod(true)}>+ Période</button>
        <button className="btn" onClick={() => setShowYear(true)}>+ Année</button>
      </PageHeader>
      <ErrorBox error={error} />
      <SuccessBox>{msg}</SuccessBox>

      <div className="card">
        <h2>Années</h2>
        {years.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Libellé</th><th>Début</th><th>Fin</th><th>État</th><th /></tr></thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.id} className={String(y.id) === yearId ? "row-selected" : ""}>
                    <td><b>{y.label}</b></td><td>{y.start_date}</td><td>{y.end_date}</td>
                    <td>
                      {y.is_current && <Badge tone="green">En cours</Badge>}{" "}
                      {y.is_archived && <Badge tone="gray">Archivée</Badge>}
                    </td>
                    <td className="row-actions">
                      <button className="btn btn-sm" onClick={() => setYearId(String(y.id))}>Périodes</button>
                      {!y.is_archived && !y.is_current &&
                        <button className="btn btn-sm" onClick={() => archive(y)}>Archiver</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Périodes {yearId && `— ${years.find((y) => String(y.id) === yearId)?.label || ""}`}</h2>
        {periods.length === 0 ? <Empty message="Aucune période définie" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nom</th><th>Début</th><th>Fin</th><th>Résultats</th><th /></tr></thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td><td>{p.start_date}</td><td>{p.end_date}</td>
                    <td><Badge tone={p.is_locked ? "red" : "green"}>
                          {p.is_locked ? "Verrouillés" : "Ouverts"}</Badge></td>
                    <td><button className="btn btn-sm" onClick={() => toggleLock(p)}>
                          {p.is_locked ? "Déverrouiller" : "Verrouiller"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Verrouiller une période interdit toute saisie ou modification de notes.</p>
      </div>

      {showYear && (
        <FormModal title="Nouvelle année scolaire" fields={[
          { name: "label", label: "Libellé (ex. 2026-2027)" },
          { name: "start_date", label: "Début", type: "date" },
          { name: "end_date", label: "Fin", type: "date" },
          { name: "is_current", label: "Année en cours", type: "checkbox",
            checkLabel: "Définir comme année en cours", required: false },
        ]} onClose={() => setShowYear(false)} onSave={addYear} />)}
      {showPeriod && (
        <FormModal title="Nouvelle période" fields={[
          { name: "name", label: "Nom (ex. Trimestre 1)" },
          { name: "order", label: "Ordre", type: "number", min: 1 },
          { name: "start_date", label: "Début", type: "date" },
          { name: "end_date", label: "Fin", type: "date" },
          { name: "school_year", label: "Année scolaire", type: "select",
            options: years.map((y) => ({ value: y.id, label: y.label })) },
        ]} initial={{ school_year: yearId }}
          onClose={() => setShowPeriod(false)} onSave={addPeriod} />)}
    </div>
  );
}