import { type ReactNode } from "react";
import { Separator } from "../components/ui/separator";
import Sidebar from "./Sidebar";

interface UsersLayoutProps {
  children: ReactNode;
}

export default function UsersLayout({ children }: UsersLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 p-1">
        <h1 className="text-2xl font-semibold tracking-tighter">Usuarios</h1>
        <p className="text-muted-foreground">
          Ajustes y preferencias de usuario
        </p>
      </div>
      <Separator />
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <Sidebar />
        </aside>
        <div className="flex-1 lg:max-w-full">{children}</div>
      </div>
    </div>
  );
}
