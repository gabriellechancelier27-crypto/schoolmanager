import Crud from "./Crud";
import { ROLES } from "../auth";
import { Badge } from "../components/ui";
import { AccessButton } from "../components/Credentials";

export default function ParentsPage() {
  return (
    <Crud title="Parents / Tuteurs" subtitle="Profils, enfants et accès à la plateforme"
      endpoint="/parents/" roles={ROLES.MANAGERS}
      searchPlaceholder="Nom, téléphone, email…"
      rowExtra={(p, reload) => <AccessButton kind="parent" item={p} onDone={reload} />}
      columns={[
        { key: "last_name", label: "Nom" },
        { key: "first_name", label: "Prénom" },
        { key: "phone", label: "Téléphone" },
        { key: "email", label: "Email" },
        { key: "profession", label: "Profession" },
        { key: "children_count", label: "Enfants" },
        { key: "user", label: "Accès", render: (p) => (
          <Badge tone={p.user ? "green" : "gray"}>{p.user ? "Actif" : "Aucun"}</Badge>) },
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