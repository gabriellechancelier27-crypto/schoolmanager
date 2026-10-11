import { useEffect, useState } from "react";
import { ROLES, can, useAuth } from "../auth";
import { errMessage, getAll, post, useList } from "../api";
import { Badge, Empty, ErrorBox, Field, Modal, PageHeader,
         Spinner, SuccessBox } from "../components/ui";

const ROLE_OPTIONS = [
  ["SCHOOL_ADMIN", "Administrateurs"], ["DIRECTOR", "Directeurs"], ["TEACHER", "Enseignants"],
  ["ACCOUNTANT", "Comptables"], ["PARENT", "Parents"], ["STUDENT", "Élèves"],
];

const targetLabel = (a) =>
  a.target === "ALL" ? "Tous" :
  a.target === "CLASS" ? `Classe ${a.class_room_name}` :
  `Rôle : ${ROLE_OPTIONS.find(([v]) => v === a.role)?.[1] || a.role}`;

export default function Communication() {
  const { user } = useAuth();
  const canPublish = can(user, ROLES.MANAGERS);
  const [tab, setTab] = useState("annonces");
  const annonces = useList("/announcements/");
  const notifications = useList("/notifications/");
  const [show, setShow] = useState(false);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ target: "ALL" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (canPublish) getAll("/classrooms/").then(setClasses).catch(() => {});
  }, [canPublish]);

  async function publish() {
    try {
      await post("/announcements/", {
        title: form.title, body: form.body, target: form.target,
        class_room: form.target === "CLASS" ? Number(form.class_room) : undefined,
        role: form.target === "ROLE" ? form.role : undefined,
      });
      setShow(false); setForm({ target: "ALL" });
      setMsg("Annonce publiée — les destinataires ont été notifiés.");
      annonces.reload();
    } catch (e) { setError(errMessage(e)); }
  }

  async function markRead(id) {
    await post(`/notifications/${id}/read/`);
    notifications.reload();
  }

  async function markAll() {
    await post("/notifications/read-all/");
    notifications.reload();
  }

  return (
    <div>
      <PageHeader title="Communication" subtitle="Annonces et notifications (§4.18, §4.19)">
        {canPublish && tab === "annonces" &&
          <button className="btn btn-primary" onClick={() => { setShow(true); setError(""); }}>
            + Publier une annonce</button>}
        {tab === "notifications" &&
          <button className="btn" onClick={markAll}>Tout marquer comme lu</button>}
      </PageHeader>
      <ErrorBox error={error || annonces.error || notifications.error} />
      <SuccessBox>{msg}</SuccessBox>

      <div className="tabs">
        <button className={`tab ${tab === "annonces" ? "active" : ""}`}
                onClick={() => setTab("annonces")}>Annonces</button>
        <button className={`tab ${tab === "notifications" ? "active" : ""}`}
                onClick={() => setTab("notifications")}>Notifications</button>
      </div>

      {tab === "annonces" && (
        annonces.loading ? <Spinner /> : annonces.items.length === 0
          ? <Empty message="Aucune annonce" /> : (
          <div>
            {annonces.items.map((a) => (
              <div className="card" key={a.id}>
                <div className="announce-head">
                  <b>{a.title}</b>
                  <span className="muted">
                    {new Date(a.published_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="announce-body">{a.body}</div>
                <Badge tone="blue">{targetLabel(a)}</Badge>{" "}
                <span className="muted">{a.author_name}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "notifications" && (
        <div className="card">
          {notifications.loading ? <Spinner /> : notifications.items.length === 0
            ? <Empty message="Aucune notification" /> : (
            <div>
              {notifications.items.map((n) => (
                <div className="notif-item" key={n.id}>
                  {n.is_read ? <span className="notif-dot" /> : <span className="notif-unread" />}
                  <div style={{ flex: 1 }}>
                    <b>{n.title}</b>{" "}
                    <span className="muted">
                      {new Date(n.created_at).toLocaleString("fr-FR")}
                    </span>
                    <p>{n.message}</p>
                  </div>
                  {!n.is_read &&
                    <button className="btn btn-sm" onClick={() => markRead(n.id)}>Marquer lue</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal title="Publier une annonce" open={show} onClose={() => setShow(false)}>
        {error && <div className="alert alert-error">{error}</div>}
        <Field label="Titre">
          <input className="input" value={form.title || ""}
                 onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Contenu">
          <textarea className="input" rows={4} value={form.body || ""}
                    onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <Field label="Destinataires">
          <select className="input" value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}>
            <option value="ALL">Tous</option>
            <option value="CLASS">Une classe</option>
            <option value="ROLE">Un rôle</option>
          </select>
        </Field>
        {form.target === "CLASS" && (
          <Field label="Classe">
            <select className="input" value={form.class_room || ""}
                    onChange={(e) => setForm({ ...form, class_room: e.target.value })}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {form.target === "ROLE" && (
          <Field label="Rôle">
            <select className="input" value={form.role || ""}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="">—</option>
              {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={() => setShow(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={publish}
                  disabled={!form.title || !form.body}>Publier</button>
        </div>
      </Modal>
    </div>
  );
}