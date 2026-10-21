import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ROLES, useAuth } from "../auth";
import Icon from "./Icon";

// Menu regroupé par domaine ; la visibilité dépend du rôle (comme avant).
const GROUPS = [
  {
    items: [
      { to: "/", label: "Tableau de bord", icon: "dashboard", end: true },
      { to: "/etablissements", label: "Établissements", icon: "school", superOnly: true },
    ],
  },
  {
    title: "Scolarité",
    items: [
      { to: "/eleves", label: "Élèves", icon: "students", roles: [...ROLES.STAFF, "PARENT"] },
      { to: "/parents", label: "Parents", icon: "parents", roles: ROLES.MANAGERS },
      { to: "/enseignants", label: "Enseignants", icon: "teachers", roles: [...ROLES.MANAGERS, "TEACHER"] },
      { to: "/classes", label: "Classes & matières", icon: "classes", roles: ROLES.STAFF },
      { to: "/inscriptions", label: "Inscriptions", icon: "inscriptions", roles: ROLES.MANAGERS },
      { to: "/matieres", label: "Matières", icon: "subjects", roles: ROLES.STAFF },
      { to: "/annee", label: "Année scolaire", icon: "year", roles: ROLES.MANAGERS },
    ],
  },
  {
    title: "Évaluations",
    items: [
      { to: "/notes", label: "Saisie des notes", icon: "grades", roles: ROLES.GRADES, end: true },
      { to: "/notes/historique", label: "Historique des notes", icon: "history", roles: ROLES.GRADES },
      { to: "/bulletins", label: "Bulletins & classement", icon: "reports" },
    ],
  },
  {
    title: "Vie de l'école",
    items: [
      { to: "/presences", label: "Présences", icon: "attendance" },
      { to: "/finance", label: "Finance", icon: "finance", roles: [...ROLES.FINANCE, "PARENT"] },
      { to: "/communication", label: "Communication", icon: "communication" },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/comptes", label: "Comptes", icon: "accounts", roles: ["SCHOOL_ADMIN"] },
      { to: "/profil", label: "Mon profil", icon: "profile", everyone: true },
    ],
  },
];

const ROLE_LABELS = {
  SUPER_ADMIN: "Super admin", SCHOOL_ADMIN: "Administrateur", DIRECTOR: "Directeur",
  TEACHER: "Enseignant", ACCOUNTANT: "Comptable", PARENT: "Parent", STUDENT: "Élève",
};

// Le super admin gère la plateforme (établissements) ; les autres pages dépendent d'un établissement.
function visible(item, user) {
  if (item.everyone) return true;
  if (user.role === "SUPER_ADMIN") return item.superOnly || item.to === "/";
  if (item.superOnly) return false;
  return !item.roles || item.roles.includes(user.role);
}

function initials(user) {
  const a = (user.first_name || "").trim()[0] || "";
  const b = (user.last_name || "").trim()[0] || "";
  return (a + b || (user.username || "?")[0]).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-logo">SM</span>
          <span className="brand-name">School<b>Manager</b></span>
        </div>
        <nav aria-label="Navigation principale">
          {GROUPS.map((group, i) => {
            const items = group.items.filter((m) => visible(m, user));
            if (items.length === 0) return null;
            return (
              <div className="menu-group" key={group.title || i}>
                {group.title && <div className="menu-group-title">{group.title}</div>}
                {items.map((m) => (
                  <NavLink key={m.to} to={m.to} end={m.end}
                    className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
                    onClick={() => setOpen(false)}>
                    <Icon name={m.icon} size={19} />
                    <span>{m.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">Devise : FCFA · v1.3</div>
      </aside>
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Ouvrir le menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-title">{user.school_name || "Plateforme SchoolManager"}</div>
          <div className="topbar-user">
            <Link to="/profil" className="user-chip" title="Mon profil">
              <span className="user-avatar">{initials(user)}</span>
              <span className="user-meta">
                <span className="user-name">{user.first_name} {user.last_name}</span>
                <span className="user-role">{ROLE_LABELS[user.role] || user.role}</span>
              </span>
            </Link>
            <button className="btn btn-sm btn-logout" onClick={handleLogout}>
              <Icon name="logout" size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page" key={location.pathname}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
