// src/pages/ParentsPage.jsx
import Crud from "./Crud";
import { ROLES } from "../auth";

export default function ParentsPage() {
  return (
    <Crud title="Parents / Tuteurs" subtitle="Profils et nombre d'enfants"
      endpoint="/parents/" roles={ROLES.MANAGERS}
      searchPlaceholder="Nom, téléphone, email…"
      columns={[
        { key: "last_name", label: "Nom" },
        { key: "first_name", label: "Prénom" },
        { key: "phone", label: "Téléphone" },
        { key: "email", label: "Email" },
        { key: "profession", label: "Profession" },
        { key: "children_count", label: "Enfants" },
      ]}
      fields={[
        { name: "first_name", label: "Prénom" },
        { name: "last_name", label: "Nom" },
        { name: "phone", label: "Téléphone", required: false },
        { name: "email", label: "Email", type: "email", required: false },
        { name: "profession", label: "Profession", required: false },
        { name: "address", label: "Adresse", required: false },
      ]} />
  );
}