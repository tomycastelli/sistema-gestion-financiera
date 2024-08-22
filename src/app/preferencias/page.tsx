import { api } from "~/trpc/server";
import SettingsForm from "./SettingsForm";

const Page = async () => {
  const globalSettings = await api.globalSettings.getAll.query();
  const userPermissions = await api.users.getAllPermissions.query();

  const isAdmin = !!userPermissions.find((p) => p.name === "ADMIN");

  return (
    <div className="flex flex-col gap-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Ajustes globales
      </h1>
      <SettingsForm initialSettings={globalSettings} isAdmin={isAdmin} />
    </div>
  );
};

export default Page;
