import Crud from "./Crud";
import { ROLES } from "../auth";
import { Badge } from "../components/ui";

const CATEGORIES = [
  { value: "LITTERAIRE", label: "Matières littéraires" },
  { value: "SCIENTIFIQUE", label: "Matières scientifiques" },
  { value: "AUTRE", label: "Autres (EPS, etc.)" },
];
const TONES = { LITTERAIRE: "blue", SCIENTIFIQUE: "green", AUTRE: "gray" };

export default function SubjectsPage() {
  return (
    <Crud title="Matières" subtitle="Matières enseignées et regroupement sur le bulletin"
      endpoint="/subjects/" roles={ROLES.MANAGERS}
      searchPlaceholder="Nom, code…"
      columns={[
        { key: "name", label: "Matière" },
        { key: "code", label: "Code" },
        { key: "category", label: "Catégorie du bulletin", render: (s) => (
          <Badge tone={TONES[s.category] || "gray"}>
            {CATEGORIES.find((c) => c.value === s.category)?.label || s.category}</Badge>) },
        { key: "default_coefficient", label: "Coefficient par défaut" },
      ]}
      fields={[
        { name: "name", label: "Nom" },
        { name: "code", label: "Code", required: false },
        { name: "category", label: "Catégorie du bulletin", type: "select", options: CATEGORIES },
        { name: "default_coefficient", label: "Coefficient par défaut",
          type: "number", step: "0.5", min: "0.5" },
      ]} />
  );
}
