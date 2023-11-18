import Link from "next/link";
import { capitalizeFirstLetter } from "~/lib/functions";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

export default function Home() {
  const panels = [
    {
      name: "operaciones",
      description: "Visualizar y gestionar operaciones y transacciones",
    },
    {
      name: "cuentas",
      description: "Acceder a las cuentas de las entidades",
    },
    {
      name: "entidades",
      description: "Crear, editar o borrar entidades",
    },
    {
      name: "usuarios",
      description: "Gestionar los roles, permisos, y datos de los usuarios",
    },
  ];

  return (
    <div className="mt-12 flex h-full w-full flex-col items-center justify-center">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Bienvenido al portal de Maika!
      </h1>
      <div className="grid w-full grid-cols-4 gap-8">
        {panels.map((panel) => (
          <Link
            key={panel.name}
            href={
              panel.name === "cuentas"
                ? { pathname: `/${panel.name}`, query: { tag: "maika" } }
                : { pathname: `/${panel.name}` }
            }
            className="flex transition-all hover:scale-110"
          >
            <Card className="h-28 w-96">
              <CardHeader>
                <CardTitle>{capitalizeFirstLetter(panel.name)}</CardTitle>
                <CardDescription>{panel.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
