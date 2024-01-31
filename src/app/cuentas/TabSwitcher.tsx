"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";

const TabSwitcher = () => {
  const searchParams = useSearchParams();
  const selectedTab = searchParams.get("cuenta");
  const selectedTag = searchParams.get("tag");
  const selectedEntityId = searchParams.get("entidad");

  type QueryParams = {
    cuenta?: string;
    pagina?: string;
    entidad?: string;
    tag?: string;
  };

  const resumenQuery: QueryParams = {};

  const currentAcountQuery: QueryParams = {
    cuenta: "cuenta_corriente",
  };

  const cashQuery: QueryParams = {
    cuenta: "caja",
  };

  if (selectedEntityId) {
    currentAcountQuery.entidad = selectedEntityId;
    cashQuery.entidad = selectedEntityId;
    resumenQuery.entidad = selectedEntityId;
  } else if (selectedTag) {
    currentAcountQuery.tag = selectedTag;
    cashQuery.tag = selectedTag;
    resumenQuery.tag = selectedTag;
  }

  return (
    <div className="grid w-[400px] grid-cols-3 rounded-xl bg-primary-foreground p-1 text-sm">
      <Link
        prefetch={false}
        href={{ pathname: "/cuentas", query: resumenQuery }}
        className={cn(
          !selectedTab && "bg-primary font-semibold text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Resumen
      </Link>
      <Link
        prefetch={false}
        href={{
          pathname: "/cuentas",
          query: cashQuery,
        }}
        className={cn(
          selectedTab === "caja" && "bg-primary font-semibold text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Caja
      </Link>
      <Link
        prefetch={false}
        href={{
          pathname: "/cuentas",
          query: currentAcountQuery,
        }}
        className={cn(
          selectedTab === "cuenta_corriente" &&
            "bg-primary font-semibold text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Cuenta corriente
      </Link>
    </div>
  );
};

export default TabSwitcher;
