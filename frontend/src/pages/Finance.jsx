import { useEffect, useState } from "react";
import { ROLES, can, useAuth } from "../auth";
import { del, downloadFile, errMessage, getAll, get, patch, post, useList } from "../api";
import { Badge, Empty, ErrorBox, Field, FormModal, Modal, PageHeader,
         Pagination, Spinner, SuccessBox, fmtFCFA, todayStr } from "../components/ui";

const METHODS = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile Money", VIREMENT: "Virement", CHEQUE: "Chèque" };
const EXPENSE_CATS = [
  ["SALAIRES", "Salaires"], ["FOURNITURES", "Fournitures"], ["EAU", "Eau"],
  ["ELECTRICITE", "Électricité"], ["ENTRETIEN", "Entretien"], ["MATERIEL", "Matériel"],
  ["TRANSPORT", "Transport"], ["AUTRE", "Autre"],
];
const SITUATION_TONES = { SOLDE: "green", PARTIEL: "yellow", IMPAYE: "red" };

export default function Finance() {
  const { user } = useAuth();
  const isStaff = can(user, ROLES.FINANCE);
  const isManager = can(user, ROLES.MANAGERS);
  const tabs = isStaff ? ["paiements", "impayes", "depenses"] : ["paiements"];
  const [tab, setTab] = useState("paiements");
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [fees, setFees] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  // Paiements
  const payments = useList("/payments/");
  const [showPay, setShowPay] = useState(false);
  const [pf, setPf] = useState({});
  const [pfEnrollments, setPfEnrollments] = useState([]);
  const [pfError, setPfError] = useState("");
  const [editPay, setEditPay] = useState(null);

  // Impayés
  const [outClass, setOutClass] = useState("");
  const [outstanding, setOutstanding] = useState(null);

  // Dépenses : null = fermé, {} = nouvelle, objet = modification
  const expenses = useList("/expenses/");
  const [expEditing, setExpEditing] = useState(null);

  useEffect(() => {
    Promise.all([getAll("/classrooms/"), getAll("/school-years/")]).then(([c, y]) => {
      setClasses(c); setYears(y);
      const current = y.find((yr) => yr.is_current);
      if (current) setYearId(current.id);
    }).catch((e) => setError(errMessage(e)));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    getAll("/fees/", { school_year: yearId }).then(setFees).catch(() => {});
  }, [yearId]);

  useEffect(() => {
    if (tab !== "impayes") return;
    get("/payments/outstanding/", { classe: outClass || undefined })
      .then(setOutstanding).catch((e) => setError(errMessage(e)));
  }, [tab, outClass, tick]);

  useEffect(() => {
    if (!pf.class_room || !yearId) { setPfEnrollments([]); return; }
    getAll("/enrollments/", { class_room: pf.class_room, school_year: yearId })
      .then(setPfEnrollments).catch(() => {});
  }, [pf.class_room, yearId]);

  function openPayModal() {
    setPf({ method: "ESPECES", paid_at: todayStr() });
    setPfError("");
    setShowPay(true);
  }

  async function savePayment() {
    try {
      await post("/payments/", {
        enrollment_id: Number(pf.enrollment),
        fee_id: pf.fee ? Number(pf.fee) : null,
        amount: Number(pf.amount),
        method: pf.method || "ESPECES",
        reference: pf.reference || "",
        paid_at: pf.paid_at || todayStr(),
      });
      setShowPay(false);
      setError("");
      setMsg("Paiement enregistré — reçu numéroté généré et parent notifié.");
      payments.reload();
      setTick((t) => t + 1);
    } catch (e) { setPfError(errMessage(e)); }
  }

  async function savePaymentEdit(form) {
    await patch(`/payments/${editPay.id}/`, {
      amount: form.amount, method: form.method,
      fee_id: form.fee_id === "" || form.fee_id === null ? null : Number(form.fee_id),
      paid_at: form.paid_at, reference: form.reference || "",
    });
    setEditPay(null); setError(""); setMsg("Paiement modifié (opération journalisée).");
    payments.reload(); setTick((t) => t + 1);
  }

  async function removePayment(p) {
    if (!window.confirm(`Supprimer le paiement ${p.receipt_number} (${fmtFCFA(p.amount)}) ? `
      + "Cette opération est journalisée.")) return;
    try {
      await del(`/payments/${p.id}/`);
      setError(""); setMsg("Paiement supprimé.");
      payments.reload(); setTick((t) => t + 1);
    } catch (e) { setMsg(""); setError(errMessage(e)); }
  }

  async function saveExpense(form) {
    const body = {
      category: form.category, label: form.label, amount: form.amount,
      date: form.date, description: form.description || "",
    };
    if (expEditing.id) await patch(`/expenses/${expEditing.id}/`, body);
    else await post("/expenses/", { ...body, school_year: yearId || undefined });
    setExpEditing(null); setError(""); setMsg("Dépense enregistrée.");
    expenses.reload();
  }

  async function removeExpense(x) {
    if (!window.confirm(`Supprimer la dépense « ${x.label} » ?`)) return;
    try {
      await del(`/expenses/${x.id}/`);
      setError(""); setMsg("Dépense supprimée.");
      expenses.reload();
    } catch (e) { setMsg(""); setError(errMessage(e)); }
  }

  return (
    <div>
      <PageHeader title="Finance" subtitle="Paiements, reçus, impayés et dépenses (§6)">
        {isStaff && tab === "paiements" &&
          <button className="btn btn-primary" onClick={openPayModal}>+ Paiement</button>}
        {isStaff && tab === "depenses" &&
          <button className="btn btn-primary"
                  onClick={() => setExpEditing({ date: todayStr(), category: "AUTRE" })}>
            + Dépense</button>}
      </PageHeader>
      <ErrorBox error={error} />
      <SuccessBox>{msg}</SuccessBox>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "paiements" ? "Paiements" : t === "impayes" ? "Impayés" : "Dépenses"}
          </button>
        ))}
      </div>

      {tab === "paiements" && (
        <div className="card">
          <div className="toolbar">
            <input className="input search" placeholder="N° reçu, matricule, nom…"
                   value={payments.input} onChange={(e) => payments.setInput(e.target.value)} />
          </div>
          {payments.loading ? <Spinner /> : (
            payments.items.length === 0 ? <Empty message="Aucun paiement" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>N° reçu</th><th>Élève</th><th>Classe</th><th>Frais</th>
                              <th>Montant</th><th>Mode</th><th>Date</th><th /></tr></thead>
                  <tbody>
                    {payments.items.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.receipt_number}</b></td>
                        <td>{p.student}</td><td>{p.class_name}</td>
                        <td>{p.fee_label || "—"}</td>
                        <td><b>{fmtFCFA(p.amount)}</b></td>
                        <td>{METHODS[p.method] || p.method}</td>
                        <td>{p.paid_at}</td>
                        <td className="row-actions">
                          <button className="btn btn-sm"
                            onClick={() => downloadFile(`/payments/${p.id}/pdf/`,
                              `recu_${p.receipt_number}.pdf`)}>Reçu PDF</button>
                          {isStaff && <button className="btn btn-sm" onClick={() => setEditPay(p)}>Modifier</button>}
                          {isManager && <button className="btn btn-sm btn-danger"
                            onClick={() => removePayment(p)}>Suppr.</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          <Pagination page={payments.page} setPage={payments.setPage}
                      next={payments.next} previous={payments.previous} count={payments.count} />
        </div>
      )}

      {tab === "impayes" && (
        <div className="card">
          <div className="toolbar">
            <select className="input" value={outClass} onChange={(e) => setOutClass(e.target.value)}>
              <option value="">Toutes les classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!outstanding ? <Spinner /> : outstanding.length === 0
            ? <Empty message="Aucun impayé" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th>Dû</th>
                            <th>Payé</th><th>Reste</th><th>Situation</th></tr></thead>
                <tbody>
                  {outstanding.map((o) => (
                    <tr key={o.inscription}>
                      <td><b>{o.eleve}</b></td><td>{o.matricule}</td><td>{o.classe}</td>
                      <td>{fmtFCFA(o.du)}</td><td>{fmtFCFA(o.paye)}</td>
                      <td><b>{fmtFCFA(o.reste)}</b></td>
                      <td><Badge tone={SITUATION_TONES[o.situation]}>{o.situation}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "depenses" && (
        <div className="card">
          {expenses.loading ? <Spinner /> : (
            expenses.items.length === 0 ? <Empty message="Aucune dépense" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th>Montant</th><th /></tr></thead>
                  <tbody>
                    {expenses.items.map((x) => (
                      <tr key={x.id}>
                        <td>{x.date}</td>
                        <td><Badge tone="blue">{EXPENSE_CATS.find(([v]) => v === x.category)?.[1] || x.category}</Badge></td>
                        <td>{x.label}</td>
                        <td><b>{fmtFCFA(x.amount)}</b></td>
                        <td className="row-actions">
                          <button className="btn btn-sm" onClick={() => setExpEditing(x)}>Modifier</button>
                          <button className="btn btn-sm btn-danger" onClick={() => removeExpense(x)}>Suppr.</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          <Pagination page={expenses.page} setPage={expenses.setPage}
                      next={expenses.next} previous={expenses.previous} count={expenses.count} />
        </div>
      )}

      {/* Modale nouveau paiement */}
      <Modal title="Enregistrer un paiement" open={showPay} onClose={() => setShowPay(false)}>
        {pfError && <div className="alert alert-error">{pfError}</div>}
        <div className="form-grid">
          <Field label="Classe">
            <select className="input" value={pf.class_room || ""}
                    onChange={(e) => setPf({ ...pf, class_room: e.target.value, enrollment: "" })}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Élève (inscription)">
            <select className="input" value={pf.enrollment || ""}
                    onChange={(e) => setPf({ ...pf, enrollment: e.target.value })}>
              <option value="">—</option>
              {pfEnrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.student.last_name} {e.student.first_name} ({e.student.matricule})
                </option>))}
            </select>
          </Field>
          <Field label="Frais concerné">
            <select className="input" value={pf.fee || ""}
                    onChange={(e) => setPf({ ...pf, fee: e.target.value })}>
              <option value="">— (aucun)</option>
              {fees.map((f) => <option key={f.id} value={f.id}>{f.label} — {fmtFCFA(f.amount)}</option>)}
            </select>
          </Field>
          <Field label="Montant (FCFA)">
            <input className="input" type="number" min="1" value={pf.amount || ""}
                   onChange={(e) => setPf({ ...pf, amount: e.target.value })} />
          </Field>
          <Field label="Mode de paiement">
            <select className="input" value={pf.method || "ESPECES"}
                    onChange={(e) => setPf({ ...pf, method: e.target.value })}>
              {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={pf.paid_at || todayStr()}
                   onChange={(e) => setPf({ ...pf, paid_at: e.target.value })} />
          </Field>
          <Field label="Référence (ex. transaction Mobile Money)">
            <input className="input" value={pf.reference || ""}
                   onChange={(e) => setPf({ ...pf, reference: e.target.value })} />
          </Field>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => setShowPay(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={savePayment}
                  disabled={!pf.enrollment || !pf.amount}>Enregistrer</button>
        </div>
      </Modal>

      {/* Modale modification de paiement */}
      {editPay && (
        <FormModal title={`Modifier le paiement ${editPay.receipt_number}`}
          fields={[
            { name: "amount", label: "Montant (FCFA)", type: "number", step: "0.01", min: "0.01" },
            { name: "method", label: "Mode", type: "select",
              options: Object.entries(METHODS).map(([value, label]) => ({ value, label })) },
            { name: "fee_id", label: "Frais concerné", type: "select", required: false,
              options: fees.map((f) => ({ value: f.id, label: `${f.label} — ${fmtFCFA(f.amount)}` })) },
            { name: "paid_at", label: "Date", type: "date" },
            { name: "reference", label: "Référence", required: false, full: true },
          ]}
          initial={editPay} onClose={() => setEditPay(null)} onSave={savePaymentEdit} />
      )}

      {/* Modale dépense (création / modification) */}
      {expEditing && (
        <FormModal title={expEditing.id ? "Modifier la dépense" : "Nouvelle dépense"}
          fields={[
            { name: "category", label: "Catégorie", type: "select",
              options: EXPENSE_CATS.map(([v, l]) => ({ value: v, label: l })) },
            { name: "label", label: "Libellé" },
            { name: "amount", label: "Montant (FCFA)", type: "number", step: "0.01", min: "0.01" },
            { name: "date", label: "Date", type: "date" },
            { name: "description", label: "Description", type: "textarea", required: false, full: true },
          ]}
          initial={expEditing} onClose={() => setExpEditing(null)} onSave={saveExpense} />
      )}
    </div>
  );
}