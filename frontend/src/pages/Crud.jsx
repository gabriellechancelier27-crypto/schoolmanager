import { useState } from "react";
import { can, useAuth } from "../auth";
import { del, patch, post, useList } from "../api";
import { Empty, ErrorBox, FormModal, PageHeader, Pagination, Spinner } from "../components/ui";

export default function Crud({ title, subtitle, endpoint, columns, fields, roles,
                               searchPlaceholder, rowExtra }) {
  const { user } = useAuth();
  const canWrite = can(user, roles);
  const isAdmin = can(user, ["SCHOOL_ADMIN"]);
  const showActions = canWrite || (rowExtra && isAdmin);
  const list = useList(endpoint);
  const [editing, setEditing] = useState(null);

  async function save(form) {
    if (editing.id) await patch(`${endpoint}${editing.id}/`, form);
    else await post(endpoint, form);
    setEditing(null);
    list.reload();
  }

  async function remove(item) {
    if (!window.confirm("Confirmer la suppression ?")) return;
    try { await del(`${endpoint}${item.id}/`); list.reload(); }
    catch (e) { alert("Suppression impossible : cet élément est probablement lié à d'autres données."); }
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}>
        {canWrite && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Ajouter</button>}
      </PageHeader>
      <div className="card">
        <div className="toolbar">
          <input className="input search" placeholder={searchPlaceholder || "Rechercher…"}
                 value={list.input} onChange={(e) => list.setInput(e.target.value)} />
        </div>
        {list.loading ? <Spinner /> : <ErrorBox error={list.error} />}
        {!list.loading && !list.error && (
          list.items.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{showActions && <th />}</tr>
                </thead>
                <tbody>
                  {list.items.map((item) => (
                    <tr key={item.id}>
                      {columns.map((c) => (
                        <td key={c.key}>{c.render ? c.render(item) : (item[c.key] ?? "—")}</td>
                      ))}
                      {showActions && (
                        <td className="row-actions">
                          {rowExtra && isAdmin && rowExtra(item, list.reload)}
                          {canWrite && (
                            <>
                              <button className="btn btn-sm" onClick={() => setEditing(item)}>Modifier</button>
                              <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>Suppr.</button>
                            </>
                          )}
                        </td>
                      )}
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
      {editing && (
        <FormModal title={editing.id ? "Modifier" : "Ajouter"} fields={fields}
          initial={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}