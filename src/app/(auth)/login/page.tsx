import { getServerAuthSession } from "~/server/auth";
import AuthForm from "../../components/AuthForm";

const login = async () => {
  const session = await getServerAuthSession();

  return (
    <div className="text-dark border-dark m-auto flex flex-col items-center space-y-4 rounded-3xl border-2 bg-white p-8 text-lg">
      <h1>
        Ingresar al portal de <span className="font-bold">Maika.</span>
      </h1>
      <p className="w-48 text-sm">
        Si es tu primer inicio de sesión, se creará una cuenta en este portal
        con el nombre de tu cuenta de Google
      </p>
      <AuthForm user={session?.user} />
    </div>
  );
};

export default login;
