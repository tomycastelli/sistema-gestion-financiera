import { api } from "~/trpc/server";
import Whitelist from "./Whitelist";

const Page = async () => {
  const initialEmails = await api.users.getWhitelist.query();

  return (
    <div className="flex flex-col space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Whitelist</h1>
      <p>Maneja que emails pueden ingresar a la applicación</p>
      <Whitelist initialEmails={initialEmails} />
    </div>
  );
};

export default Page;
