import Link from "next/link";
import { capitalizeFirstLetter } from "~/lib/functions";
import { getServerAuthSession } from "~/server/auth";
import AuthForm from "./components/AuthForm";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

export default async function Home() {
  const session = await getServerAuthSession();

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
      {session ? (
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
      ) : (
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-lg">
            Ingresa con tu usuario para poder continuar
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Si es tu primer inicio de sesión, se creará una cuenta en este
            portal con el nombre de tu cuenta
          </p>
          <AuthForm />
        </div>
      )}
    </div>
  );
}
