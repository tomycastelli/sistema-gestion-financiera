"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, type FC } from "react";
import { createQueryString, isDarkEnough } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { useCuentasStore } from "~/stores/cuentasStore";

interface TabSwitcherProps {
  uiColor: string | undefined;
  selectedEntityId: string | undefined;
  selectedTag: string | undefined;
}

const TabSwitcher: FC<TabSwitcherProps> = ({ uiColor }) => {
  const searchParams = useSearchParams();
  const {
    setDestinationEntityId,
    setToDate,
    setFromDate,
    setSelectedCurrency,
  } = useCuentasStore();

  const selectedTab = searchParams.get("cuenta") ?? "resumen";

  useEffect(() => {
    if (selectedTab) {
      setDestinationEntityId(undefined);
      setToDate(undefined);
      setFromDate(undefined);
      setSelectedCurrency(undefined);
    }
  }, [
    selectedTab,
    setDestinationEntityId,
    setToDate,
    setFromDate,
    setSelectedCurrency,
  ]);

  const [parent] = useAutoAnimate();

  return (
    <div
      ref={parent}
      className="grid grid-cols-3 rounded-xl bg-primary-foreground p-1 text-sm"
    >
      <Link
        prefetch={false}
        href={{
          pathname: "/cuentas",
          query: createQueryString(searchParams, "cuenta", "resumen"),
        }}
        style={{
          backgroundColor: selectedTab === "resumen" ? uiColor : undefined,
        }}
        className={cn(
          selectedTab === "resumen" && "bg-muted font-bold",
          selectedTab === "resumen" &&
            uiColor &&
            isDarkEnough(uiColor) &&
            "text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Resumen
      </Link>
      <Link
        prefetch={false}
        href={{
          pathname: "/cuentas",
          query: createQueryString(searchParams, "cuenta", "caja"),
        }}
        style={{
          backgroundColor:
            selectedTab !== "cuenta_corriente" ? uiColor : undefined,
        }}
        className={cn(
          selectedTab === "caja" && "bg-muted font-bold",
          selectedTab === "caja" &&
            uiColor &&
            isDarkEnough(uiColor) &&
            "text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Caja
      </Link>
      <Link
        prefetch={false}
        href={{
          pathname: "/cuentas",
          query: createQueryString(searchParams, "cuenta", "cuenta_corriente"),
        }}
        style={{
          backgroundColor:
            selectedTab === "cuenta_corriente" ? uiColor : undefined,
        }}
        className={cn(
          selectedTab === "cuenta_corriente" && "bg-muted font-bold",
          selectedTab === "cuenta_corriente" &&
            uiColor &&
            isDarkEnough(uiColor) &&
            "text-white",
          "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-muted",
        )}
      >
        Cuenta corriente
      </Link>
    </div>
  );
};

export default TabSwitcher;
