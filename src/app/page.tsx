import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import AuthForm from "./components/AuthForm";
import OperationsMenuCard from "./components/OperationsMenuCard";
import { Card, CardHeader, CardTitle } from "./components/ui/card";

export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <div className="mt-12 flex h-full w-full flex-col items-center justify-center">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Bienvenido al portal de Maika!
      </h1>
      {session ? (
        <div className="grid w-full grid-cols-4 gap-4">
          <OperationsMenuCard userId={session.user.id} />
          <Link href={"/cuentas"}>
            <Card>
              <CardHeader>
                <CardTitle>Cuentas</CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href={"/entidades"}>
            <Card>
              <CardHeader>
                <CardTitle>Entidades</CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href={"/usuarios"}>
            <Card>
              <CardHeader>
                <CardTitle>Usuarios</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-lg">
            Ingresa con tu usuario para poder continuar
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Si es tu primer inicio de sesión, se creará un usuario en este
            portal con el nombre de tu cuenta
          </p>
          <AuthForm />
        </div>
      )}
    </div>
  );
}
