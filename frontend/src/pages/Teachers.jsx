// src/pages/Teachers.jsx
import Crud from "./Crud";
import { ROLES } from "../auth";
import { Badge } from "../components/ui";

export default function Teachers() {
  return (
    <Crud title="Enseignants" subtitle="Identité, coordonnées et statut"
      endpoint="/teachers/" roles={ROLES.MANAGERS}
      searchPlaceholder="Nom, matricule, téléphone…"
      columns={[
        { key: "matricule", label: "Matricule" },
        { key: "last_name", label: "Nom" },
        { key: "first_name", label: "Prénom" },
        { key: "phone", label: "Téléphone" },
        { key: "email", label: "Email" },
        { key: "status", label: "Statut", render: (t) => (
          <Badge tone={t.status === "ACTIVE" ? "green" : "gray"}>
            {t.status === "ACTIVE" ? "Actif" : "Inactif"}</Badge>) },
      ]}
      fields={[
        { name: "first_name", label: "Prénom" },
        { name: "last_name", label: "Nom" },
        { name: "gender", label: "Sexe", type: "select", required: false,
          options: [{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }] },
        { name: "phone", label: "Téléphone", required: false },
        { name: "email", label: "Email", type: "email", required: false },
        { name: "status", label: "Statut", type: "select", options: [
          { value: "ACTIVE", label: "Actif" }, { value: "INACTIVE", label: "Inactif" }] },
      ]} />
  );
}