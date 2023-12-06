import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import AccountsMenuCard from "./components/AccountsMenuCard";
import AuthForm from "./components/AuthForm";
import EntitiesMenuCard from "./components/EntitiesMenuCard";
import OperationsMenuCard from "./components/OperationsMenuCard";
import UsersMenuCard from "./components/UsersMenuCard";
import { Icons } from "./components/ui/Icons";
import { Button } from "./components/ui/button";

export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <div className="mt-12 flex h-full w-full flex-col items-center justify-center">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Bienvenido al portal de Maika!
      </h1>
      {session ? (
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OperationsMenuCard userId={session.user.id} />
            <AccountsMenuCard />
            <EntitiesMenuCard />
            <UsersMenuCard />
          </div>
          <Link href={"/guia"}>
            <Button variant="outline" className="flex flex-row space-x-2 p-6">
              <p>Guía del sistema</p>
              <Icons.info className="h-4" />
            </Button>
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
