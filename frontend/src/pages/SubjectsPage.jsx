// src/pages/SubjectsPage.jsx
import Crud from "./Crud";
import { ROLES } from "../auth";

export default function SubjectsPage() {
  return (
    <Crud title="Matières" subtitle="Matières enseignées dans l'établissement"
      endpoint="/subjects/" roles={ROLES.MANAGERS}
      searchPlaceholder="Nom, code…"
      columns={[
        { key: "name", label: "Matière" },
        { key: "code", label: "Code" },
        { key: "default_coefficient", label: "Coefficient par défaut" },
      ]}
      fields={[
        { name: "name", label: "Nom" },
        { name: "code", label: "Code", required: false },
        { name: "default_coefficient", label: "Coefficient par défaut",
          type: "number", step: "0.5", min: "0.5" },
      ]} />
  );
}