import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROLES, can, useAuth } from "../auth";
import { get, errMessage } from "../api";
import Icon from "../components/Icon";
import { Empty, ErrorBox, Skeleton, fmtFCFA, useCountUp } from "../components/ui";

const money = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const num = (v) => Number(v ?? 0);
const initialsOf = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/** Passe à true peu après l'affichage : déclenche les transitions CSS (barres, anneau). */
function useReady(delay = 120) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

function todayLabel() {
  const s = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Head({ user, subtitle, actions }) {
  return (
    <div className="dash-head">
      <div>
        <p className="dash-date">{todayLabel()}</p>
        <h1>{greeting()}, {user.first_name || user.username}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions.length > 0 && (
        <div className="quick-actions">
          {actions.map((a, i) => (
            <Link key={a.to} to={a.to} className={`btn ${i === 0 ? "btn-primary" : ""}`}>
              <Icon name={a.icon} size={17} />
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bandeau de chiffres clés : un seul bloc, séparateurs fins, sans cartes empilées. */
function KpiBand({ items }) {
  return (
    <section className="kpi-band" aria-label="Chiffres clés">
      {items.map((it) => (
        <div className={`kpi ${it.tone}`} key={it.label}>
          <span className="stat-icon"><Icon name={it.icon} size={20} /></span>
          <div className="kpi-body" style={{ minWidth: 0 }}>
            <div className="kpi-value">
              {it.value}{it.unit && <small>{it.unit}</small>}
            </div>
            <div className="kpi-label">{it.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

function GenderSplit({ boys, girls }) {
  const ready = useReady();
  const total = boys + girls;
  const pb = total ? (boys / total) * 100 : 0;
  const pg = total ? (girls / total) * 100 : 0;
  return (
    <>
      <div className="split" role="img" aria-label={`${boys} garçons, ${girls} filles`}>
        <span className="boys" style={{ width: ready ? `${pb}%` : "0%" }} />
        <span className="girls" style={{ width: ready ? `${pg}%` : "0%" }} />
      </div>
      <div className="legend">
        <span><i className="dot boys" /> {boys} garçons ({Math.round(pb)} %)</span>
        <span><i className="dot girls" /> {girls} filles ({Math.round(pg)} %)</span>
      </div>
    </>
  );
}

function Ring({ pct }) {
  const ready = useReady();
  const r = 52;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, num(pct)));
  const shown = useCountUp(p, 1000);
  return (
    <div className="ring">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={`Taux de recouvrement : ${p} %`}>
        <circle className="ring-track" cx="70" cy="70" r={r} />
        <circle className="ring-bar" cx="70" cy="70" r={r} transform="rotate(-90 70 70)"
                strokeDasharray={C} strokeDashoffset={ready ? C * (1 - p / 100) : C} />
      </svg>
      <div className="ring-text"><b>{(Math.round(shown * 10) / 10).toLocaleString("fr-FR")}</b><span>%</span></div>
    </div>
  );
}

function Bars({ income, expense }) {
  const ready = useReady();
  const max = Math.max(income, expense, 1);
  const rows = [
    { label: "Recettes", value: income, cls: "in" },
    { label: "Dépenses", value: expense, cls: "out" },
  ];
  return (
    <div className="bars">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-label"><span>{row.label}</span><b>{fmtFCFA(row.value)}</b></div>
          <div className="bar-track">
            <span className={`bar-fill ${row.cls}`} style={{ width: ready ? `${(row.value / max) * 100}%` : "0%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get("/dashboard/").then(setData).catch((e) => setError(errMessage(e)));
  }, []);

  const isSuper = user.role === "SUPER_ADMIN";
  const actions = isSuper
    ? [{ to: "/etablissements", label: "Gérer les établissements", icon: "school" }]
    : [
        { to: "/inscriptions", label: "Inscrire un élève", icon: "inscriptions", roles: ROLES.MANAGERS },
        { to: "/presences", label: "Faire l'appel", icon: "attendance", roles: ROLES.GRADES },
        { to: "/notes", label: "Saisir des notes", icon: "grades", roles: ROLES.GRADES },
        { to: "/finance", label: "Enregistrer un paiement", icon: "finance", roles: ROLES.FINANCE },
      ].filter((a) => ["PARENT", "STUDENT"].includes(user.role) ? false : can(user, a.roles)).slice(0, 3);

  if (error) return <div className="dash"><Head user={user} actions={[]} /><ErrorBox error={error} /></div>;

  if (!data) {
    return (
      <div className="dash">
        <Head user={user} actions={[]} />
        <div className="kpi-band">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={66} />)}
        </div>
      </div>
    );
  }

  // Super administrateur
  if (data.etablissements !== undefined) {
    return (
      <div className="dash">
        <Head user={user} subtitle="Vue d'ensemble de la plateforme" actions={actions} />
        <KpiBand items={[
          { label: "Établissements", value: money(num(data.etablissements)), icon: "school", tone: "blue" },
          { label: "Établissements actifs", value: money(num(data.etablissements_actifs)), icon: "check", tone: "green" },
          { label: "Utilisateurs", value: money(num(data.utilisateurs)), icon: "parents", tone: "amber" },
        ]} />
      </div>
    );
  }

  const subtitle = [data.etablissement, data.annee_scolaire && `année ${data.annee_scolaire}`]
    .filter(Boolean).join(", ");
  const band = [
    { label: "Élèves actifs", value: money(num(data.eleves)), icon: "students", tone: "blue" },
    { label: "Enseignants", value: money(num(data.enseignants)), icon: "teachers", tone: "green" },
    { label: "Classes", value: money(num(data.classes)), icon: "classes", tone: "amber" },
    { label: "Absences (30 j)", value: money(num(data.absences_30j)), icon: "attendance", tone: "coral" },
  ];

  // Personnel de l'établissement (§4.1)
  if (data.eleves !== undefined) {
    return (
      <div className="dash">
        <Head user={user} subtitle={subtitle} actions={actions} />
        <KpiBand items={band} />
        <div className="dash-grid">
          {data.recettes !== undefined && (
            <section className="card fin-card">
              <div className="fin-ring">
                <Ring pct={data.taux_recouvrement} />
                <p>des sommes dues ont été encaissées</p>
              </div>
              <div className="fin-bars">
                <h2>Situation financière {data.annee_scolaire && `· ${data.annee_scolaire}`}</h2>
                <Bars income={num(data.recettes)} expense={num(data.depenses)} />
                <div className="fin-stats">
                  <div className="fin-stat"><b>{fmtFCFA(num(data.solde))}</b><span>Solde</span></div>
                  <div className="fin-stat"><b>{fmtFCFA(num(data.impayes))}</b><span>Impayés</span></div>
                  <div className="fin-stat"><b>{money(num(data.inscriptions))}</b><span>Inscriptions</span></div>
                </div>
              </div>
            </section>
          )}
          {data.eleves > 0 && (
            <section className="card">
              <h2>Effectifs {data.annee_scolaire && `· ${data.annee_scolaire}`}</h2>
              <GenderSplit boys={num(data.garcons)} girls={num(data.filles)} />
            </section>
          )}
        </div>
      </div>
    );
  }

  // Parent (§3.6)
  if (data.enfants) {
    return (
      <div className="dash">
        <Head user={user} subtitle="Le suivi de vos enfants" actions={[]} />
        {data.enfants.length === 0 ? (
          <div className="card"><Empty message="Aucun enfant n'est encore relié à votre compte" /></div>
        ) : (
          <div className="child-grid">
            {data.enfants.map((c) => (
              <article className="child-card" key={c.matricule}>
                <div className="child-id">
                  <span className="user-avatar">{initialsOf(c.eleve)}</span>
                  <div>
                    <b>{c.eleve}</b>
                    <div className="muted">{c.classe || "Sans classe"}, matricule {c.matricule}</div>
                  </div>
                </div>
                <div className="child-stats">
                  <div><b>{c.moyenne ?? "—"}</b><span>Moyenne</span></div>
                  <div><b>{c.rang ?? "—"}</b><span>Rang</span></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Élève (§3.7)
  return (
    <div className="dash">
      <Head user={user} subtitle={subtitle || "Votre parcours"} actions={[]} />
      <KpiBand items={[
        { label: "Ma moyenne", value: data.moyenne != null ? num(data.moyenne).toFixed(2).replace(".", ",") : "—",
          unit: "/20", icon: "reports", tone: "blue" },
        { label: "Mon rang", value: data.rang != null ? num(data.rang) : "—", icon: "grades", tone: "green" },
        { label: "Mention", value: data.mention || "—", icon: "check", tone: "amber" },
        { label: "Mes absences", value: num(data.absences), icon: "attendance", tone: "coral" },
        { label: "Mes retards", value: num(data.retards), icon: "history", tone: "slate" },
      ]} />
    </div>
  );
}
