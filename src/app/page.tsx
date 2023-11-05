import { ManageOperationsCard } from "./components/ManageOperationsCard";
import { UploadOperationsCard } from "./components/UploadOperationsCard";

export default function Home() {
  return (
    <div className="flex h-full w-full flex-col">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Bienvenido al portal de Maika!
      </h1>
      <div className="grid grid-cols-1 justify-items-center gap-8 md:grid-cols-3">
        <UploadOperationsCard />
        <ManageOperationsCard />
        <UploadOperationsCard />
      </div>
    </div>
  );
}
