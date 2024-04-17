import { type ReactNode } from "react";
import { Separator } from "../components/ui/separator";
import Sidebar from "./Sidebar";

interface UsersLayoutProps {
  children: ReactNode;
}

export default function UsersLayout({ children }: UsersLayoutProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tighter">Preferencias</h1>
      <Separator />
      <div className="flex flex-col gap-y-8 lg:flex-row lg:gap-x-12 lg:gap-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <Sidebar />
        </aside>
        <div className="flex-1 lg:max-w-full">{children}</div>
      </div>
    </div>
  );
}
