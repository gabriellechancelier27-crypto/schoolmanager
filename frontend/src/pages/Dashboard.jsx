import { useEffect, useState } from "react";
import { get, errMessage } from "../api";
import { Empty, ErrorBox, PageHeader, Spinner, StatCard, fmtFCFA } from "../components/ui";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    get("/dashboard/").then(setData).catch((e) => setError(errMessage(e)));
  }, []);

  if (error) return <><PageHeader title="Tableau de bord" /><ErrorBox error={error} /></>;
  if (!data) return <div className="page-center"><Spinner /></div>;

  // Super administrateur
  if (data.etablissements !== undefined) return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue globale de la plateforme" />
      <div className="stat-grid">
        <StatCard label="Établissements" value={data.etablissements} />
        <StatCard label="Établissements actifs" value={data.etablissements_actifs} />
        <StatCard label="Utilisateurs" value={data.utilisateurs} />
      </div>
    </div>
  );

  // Personnel de l'établissement (§4.1)
  if (data.eleves !== undefined) return (
    <div>
      <PageHeader title="Tableau de bord" subtitle={data.annee_scolaire} />
      <div className="stat-grid">
        <StatCard label="Élèves actifs" value={data.eleves}
                  hint={`${data.garcons} garçons · ${data.filles} filles`} />
        <StatCard label="Enseignants" value={data.enseignants} />
        <StatCard label="Classes" value={data.classes} />
        <StatCard label="Inscriptions" value={data.inscriptions} />
        <StatCard label="Absences (30 jours)" value={data.absences_30j} />
      </div>
      {data.recettes !== undefined && (
        <div className="card">
          <h2>Situation financière — {data.annee_scolaire}</h2>
          <div className="stat-grid">
            <StatCard label="Recettes" value={fmtFCFA(data.recettes)} />
            <StatCard label="Dépenses" value={fmtFCFA(data.depenses)} />
            <StatCard label="Solde" value={fmtFCFA(data.solde)} />
            <StatCard label="Impayés" value={fmtFCFA(data.impayes)} />
            <StatCard label="Taux de recouvrement" value={`${data.taux_recouvrement} %`} />
          </div>
        </div>
      )}
    </div>
  );

  // Parent (§3.6)
  if (data.enfants) return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Suivi de mes enfants" />
      <div className="card">
        <h2>Mes enfants</h2>
        {data.enfants.length === 0
          ? <Empty message="Aucun enfant associé à votre compte" />
          : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th>Moyenne</th><th>Rang</th></tr></thead>
                <tbody>
                  {data.enfants.map((c) => (
                    <tr key={c.matricule}>
                      <td><b>{c.eleve}</b></td><td>{c.matricule}</td>
                      <td>{c.classe || "—"}</td>
                      <td>{c.moyenne ?? "—"}</td><td>{c.rang ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );

  // Élève (§3.7)
  return (
    <div>
      <PageHeader title="Mon tableau de bord" />
      <div className="stat-grid">
        <StatCard label="Ma moyenne" value={data.moyenne} />
        <StatCard label="Mon rang" value={data.rang} />
        <StatCard label="Mention" value={data.mention} />
        <StatCard label="Mes absences" value={data.absences} />
        <StatCard label="Mes retards" value={data.retards} />
      </div>
    </div>
  );
}