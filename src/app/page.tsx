import dynamic from "next/dynamic";
import Link from "next/link";
import { getUser } from "~/server/auth";
import { Icons } from "./components/ui/Icons";
import { Button } from "./components/ui/button";
const AuthForm = dynamic(() => import("./components/AuthForm"));
const EntitiesMenuCard = dynamic(() => import("./components/EntitiesMenuCard"));
const OperationsMenuCard = dynamic(
  () => import("./components/OperationsMenuCard"),
);
const UsersMenuCard = dynamic(() => import("./components/UsersMenuCard"));
const AccountsMenuCard = dynamic(() => import("./components/AccountsMenuCard"));

export default async function Home() {
  const user = await getUser();

  return (
    <div className="mt-12 flex h-full w-full flex-col items-center justify-center">
      <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight">
        Bienvenido al portal de Maika
      </h1>
      {user ? (
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OperationsMenuCard userId={user.id} />
            <AccountsMenuCard />
            <EntitiesMenuCard />
            <UsersMenuCard />
          </div>
          <div className="flex flex-row items-center justify-center space-x-4">
            <Link href={"/documentacion"} prefetch={false}>
              <Button variant="outline" className="flex flex-row space-x-2 p-6">
                <p>Documentación</p>
                <Icons.info className="h-4" />
              </Button>
            </Link>
            <Link href={"/cotizaciones"} prefetch={false}>
              <Button variant="outline" className="flex flex-row space-x-2 p-6">
                <p>Cotizaciones</p>
                <Icons.exchangeArrows className="h-4" />
              </Button>
            </Link>
            <Link href={"/logs"} prefetch={false}>
              <Button variant="outline" className="flex flex-row space-x-2 p-6">
                <p>Logs</p>
                <Icons.currentAccount className="h-4" />
              </Button>
            </Link>
            <Link href={"/peticiones"} prefetch={false}>
              <Button variant="outline" className="flex flex-row space-x-2 p-6">
                <p>Peticiones</p>
                <Icons.editing className="h-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-lg">
            Ingresá con tu usuario para poder continuar
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
