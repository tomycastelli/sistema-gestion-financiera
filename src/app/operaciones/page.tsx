import { ManageOperationsCard } from "../components/ManageOperationsCard";
import { UploadOperationsCard } from "../components/UploadOperationsCard";

export default function Page() {
  return (
    <div className="flex h-full w-full flex-col">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Operaciones
      </h1>
      <div className="grid grid-cols-1 gap-12 lg:flex lg:flex-row lg:items-start lg:justify-center lg:space-x-12">
        <UploadOperationsCard />
        <ManageOperationsCard />
      </div>
    </div>
  );
}
