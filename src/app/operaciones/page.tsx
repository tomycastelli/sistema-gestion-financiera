import { api } from "~/trpc/server";
import { ManageOperationsCard } from "../components/ManageOperationsCard";
import { UploadOperationsCard } from "../components/UploadOperationsCard";

export default async function Page() {
  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <div className="flex h-full w-full flex-col">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Operaciones
      </h1>
      <div className="grid grid-cols-1 gap-12 lg:flex lg:flex-row lg:items-start lg:justify-center lg:space-x-12">
        {userPermissions?.find(
          (permission) =>
            permission.name === "ADMIN" ||
            permission.name === "OPERATIONS_CREATE" ||
            permission.name === "OPERATIONS_CREATE_SOME",
        ) && <UploadOperationsCard />}
        {userPermissions?.find(
          (permission) =>
            permission.name === "ADMIN" ||
            permission.name === "OPERATIONS_VISUALIZE" ||
            permission.name === "OPERATIONS_VISUALIZE_SOME",
        ) && <ManageOperationsCard />}
      </div>
    </div>
  );
}
