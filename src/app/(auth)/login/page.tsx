import { signOut } from "next-auth/react";
import { Button } from "~/app/components/ui/button";
import { getServerAuthSession } from "~/server/auth";
import AuthForm from "../../components/AuthForm";

const login = async () => {
  const session = await getServerAuthSession();

  const logout = async () => {
    await signOut();
  };

  return (
    <div className="text-dark border-dark m-auto flex flex-col items-center space-y-4 rounded-3xl border-2 bg-white p-8 text-lg">
      <h1>
        Ingresar al portal de <span className="font-bold">Maika.</span>
      </h1>
      <p className="w-48 text-sm">
        Si es tu primer inicio de sesión, se creará una cuenta en este portal
        con el nombre de tu cuenta de Google
      </p>
      {session ? (
        <div>
          <h2>{`Bienvenido ${session.user.name}`}</h2>
          <Button onClick={logout}>Logout</Button>
        </div>
      ) : (
        <AuthForm />
      )}
    </div>
  );
};

export default login;
