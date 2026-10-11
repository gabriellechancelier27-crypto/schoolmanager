import Crud from "./Crud";
import { ROLES } from "../auth";
import { Badge } from "../components/ui";
import { AccessButton } from "../components/Credentials";

export default function Teachers() {
  return (
    <Crud title="Enseignants" subtitle="Identité, coordonnées, statut et accès à la plateforme"
      endpoint="/teachers/" roles={ROLES.MANAGERS}
      searchPlaceholder="Nom, matricule, téléphone…"
      rowExtra={(t, reload) => <AccessButton kind="teacher" item={t} onDone={reload} />}
      columns={[
        { key: "matricule", label: "Matricule" },
        { key: "last_name", label: "Nom" },
        { key: "first_name", label: "Prénom" },
        { key: "phone", label: "Téléphone" },
        { key: "email", label: "Email" },
        { key: "status", label: "Statut", render: (t) => (
          <Badge tone={t.status === "ACTIVE" ? "green" : "gray"}>
            {t.status === "ACTIVE" ? "Actif" : "Inactif"}</Badge>) },
        { key: "user", label: "Accès", render: (t) => (
          <Badge tone={t.user ? "green" : "gray"}>{t.user ? "Actif" : "Aucun"}</Badge>) },
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