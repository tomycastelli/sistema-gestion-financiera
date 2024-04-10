"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FC } from "react";
import { isDarkEnough } from "~/lib/functions";
import { cn } from "~/lib/utils";

interface TabSwitcherProps {
  uiColor: string | undefined
  selectedEntityId: string | undefined
  selectedTag: string | undefined
}

const TabSwitcher: FC<TabSwitcherProps> = ({ uiColor, selectedEntityId, selectedTag }) => {
  const searchParams = useSearchParams();
  const selectedTab = searchParams.get("cuenta");

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

  const [parent] = useAutoAnimate();

  return (
    <div ref={parent} className="grid grid-cols-3 rounded-xl bg-primary-foreground p-1 text-sm">
      <Link
        prefetch={false}
        href={{ pathname: "/cuentas", query: resumenQuery }}
        style={{ backgroundColor: !selectedTab ? uiColor : undefined }}
        className={cn(
          !selectedTab && "font-semibold",
          !selectedTab && uiColor && isDarkEnough(uiColor) && "text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:opacity-80",
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
        style={{ backgroundColor: selectedTab === "caja" ? uiColor : undefined }}
        className={cn(
          selectedTab === "caja" && "font-semibold",
          selectedTab === "caja" && uiColor && isDarkEnough(uiColor) && "text-white",
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
        style={{ backgroundColor: selectedTab === "cuenta_corriente" ? uiColor : undefined }}
        className={cn(
          selectedTab === "cuenta_corriente" &&
          "font-semibold",
          selectedTab === "cuenta_corriente" && uiColor && isDarkEnough(uiColor) && "text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Cuenta corriente
      </Link>
    </div>
  );
};

export default TabSwitcher;
