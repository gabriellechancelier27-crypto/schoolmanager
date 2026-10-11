import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ROLES, useAuth } from "../auth";

const MENU = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/etablissements", label: "Établissements", superOnly: true },
  { to: "/eleves", label: "Élèves", roles: [...ROLES.STAFF, "PARENT"] },
  { to: "/parents", label: "Parents", roles: ROLES.MANAGERS },
  { to: "/enseignants", label: "Enseignants", roles: [...ROLES.MANAGERS, "TEACHER"] },
  { to: "/classes", label: "Classes & matières", roles: ROLES.STAFF },
  { to: "/inscriptions", label: "Inscriptions", roles: ROLES.MANAGERS },
  { to: "/matieres", label: "Matières", roles: ROLES.STAFF },
  { to: "/annee", label: "Année scolaire", roles: ROLES.MANAGERS },
  { to: "/notes", label: "Saisie des notes", roles: ROLES.GRADES, end: true },
  { to: "/notes/historique", label: "Historique des notes", roles: ROLES.GRADES },
  { to: "/bulletins", label: "Bulletins & classement" },
  { to: "/presences", label: "Présences" },
  { to: "/finance", label: "Finance", roles: [...ROLES.FINANCE, "PARENT"] },
  { to: "/communication", label: "Communication" },
];

const ROLE_LABELS = {
  SUPER_ADMIN: "Super admin", SCHOOL_ADMIN: "Administrateur", DIRECTOR: "Directeur",
  TEACHER: "Enseignant", ACCOUNTANT: "Comptable", PARENT: "Parent", STUDENT: "Élève",
};

// Le super admin gère la plateforme (établissements) ; les autres pages dépendent d'un établissement.
function visible(item, user) {
  if (user.role === "SUPER_ADMIN") return item.superOnly || item.to === "/";
  if (item.superOnly) return false;
  return !item.roles || item.roles.includes(user.role);
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-logo">SM</span>
          <span>School<b>Manager</b></span>
        </div>
        <nav>
          {MENU.filter((m) => visible(m, user)).map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}
              className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">Devise : FCFA · v1.1</div>
      </aside>
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(!open)}>☰</button>
          <div className="topbar-title">{user.school_name || "Plateforme SchoolManager"}</div>
          <div className="topbar-user">
            <span className="topbar-name">{user.first_name} {user.last_name}</span>
            <span className="badge tone-blue">{ROLE_LABELS[user.role] || user.role}</span>
            <button className="btn btn-sm" onClick={handleLogout}>Déconnexion</button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}