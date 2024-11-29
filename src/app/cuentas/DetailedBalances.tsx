"use client";

import { type User } from "lucia";
import { useTheme } from "next-themes";
import { useState, type FC } from "react";
import { toast } from "sonner";
import { z } from "zod";
import useSearch from "~/hooks/useSearch";
import { lightenColor, numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import CustomPagination from "../components/CustomPagination";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import moment from "moment";

interface DetailedBalancesProps {
  entities: RouterOutputs["entities"]["getAll"];
  uiColor: string | undefined;
  isFetching: boolean;
  selectedEntity: RouterOutputs["entities"]["getAll"][number] | undefined;
  user: User | null;
  balances: RouterOutputs["movements"]["getBalancesByEntities"];
  selectedTag: string | undefined;
  latestExchangeRates: RouterOutputs["exchangeRates"]["getLatestExchangeRates"];
}

const DetailedBalances: FC<DetailedBalancesProps> = ({
  entities,
  uiColor,
  isFetching,
  user,
  selectedEntity,
  balances,
  selectedTag,
  latestExchangeRates,
}) => {
  const [accountListToAdd, setAccountListToAdd] = useState<number[]>([]);
  const [isListSelection, setIsListSelection] = useState<boolean>(false);

  const [detailedBalancesPage, setDetailedBalancesPage] = useState<number>(1);
  const pageSize = 8;

  const [isEditListSelection, setIsEditListSelection] = useState<
    number | undefined
  >(undefined);

  const [onlyListEntities, setOnlyListEntities] = useState<boolean>(false);

  const { theme } = useTheme();

  const isDark = theme === "dark";

  const transformedBalancesSchema = z.object({
    entity: z.object({
      id: z.number().int(),
      name: z.string(),
      tagName: z.string(),
    }),
    data: z.array(z.object({ currency: z.string(), balance: z.number() })),
  });

  const unifyAmount = (currency: string, amount: number) => {
    if (latestExchangeRates.length === 0) return 0;
    if (currency === "usd") return amount;
    const rate =
      latestExchangeRates.find((rate) => rate.currency === currency)?.rate ?? 0;
    if (currency === "usdt") {
      return amount * (1 + rate / 100);
    }
    return amount / rate;
  };

  let detailedBalances: z.infer<typeof transformedBalancesSchema>[] = [];

  if (selectedEntity?.id) {
    detailedBalances = balances.reduce(
      (acc, balance) => {
        let entityEntry = acc.find(
          (entry) =>
            entry.entity.id ===
            (balance.selectedEntity?.id === selectedEntity.id
              ? balance.otherEntity.id
              : balance.selectedEntity.id),
        );

        if (!entityEntry) {
          entityEntry = {
            entity:
              balance.selectedEntity?.id === selectedEntity.id
                ? balance.otherEntity
                : balance.selectedEntity,
            data: [
              {
                balance: 0,
                currency: "unified",
              },
            ],
          };
          acc.push(entityEntry);
        }

        const balanceMultiplier =
          entityEntry.entity.id === balance.selectedEntity?.id ? -1 : 1;

        let dataEntry = entityEntry.data.find(
          (d) => d.currency === balance.currency,
        );

        if (!dataEntry) {
          dataEntry = {
            currency: balance.currency,
            balance: 0,
          };
          entityEntry.data.push(dataEntry);
        }

        dataEntry.balance += balance.balance * balanceMultiplier;
        entityEntry.data[0]!.balance += unifyAmount(
          balance.currency,
          balance.balance * balanceMultiplier,
        );

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );
  } else if (selectedTag) {
    // Quiero que aparezcan dos asientos en el caso de el tag ser el mismo
    detailedBalances = balances
      .filter((obj) => obj.selectedEntity.tagName !== obj.otherEntity.tagName)
      .reduce(
        (acc, balance) => {
          const myPOVEntity =
            selectedTag === balance.selectedEntity.tagName
              ? balance.otherEntity
              : balance.selectedEntity;
          let entityEntry = acc.find(
            (entry) => entry.entity.id === myPOVEntity.id,
          );

          if (!entityEntry) {
            entityEntry = {
              entity: myPOVEntity,
              data: [
                {
                  currency: "unified",
                  balance: 0,
                },
              ],
            };
            acc.push(entityEntry);
          }

          const balanceMultiplier =
            entityEntry.entity.id === balance.selectedEntity?.id ? -1 : 1;

          let dataEntry = entityEntry.data.find(
            (d) => d.currency === balance.currency,
          );

          if (!dataEntry) {
            dataEntry = {
              currency: balance.currency,
              balance: 0,
            };
            entityEntry.data.push(dataEntry);
          }

          dataEntry.balance += balance.balance * balanceMultiplier;
          entityEntry.data[0]!.balance += unifyAmount(
            balance.currency,
            balance.balance * balanceMultiplier,
          );

          return acc;
        },
        [] as z.infer<typeof transformedBalancesSchema>[],
      );
  }

  const { mutateAsync: getUrlAsync, isLoading: isUrlLoading } =
    api.files.detailedBalancesFile.useMutation({
      onSuccess(newOperation) {
        const link = document.createElement("a");
        link.href = newOperation.downloadUrl;
        link.download = newOperation.filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      onError(err) {
        toast.error("Error al generar el archivo", {
          description: err.message,
        });
      },
    });

  const {
    results: searchedBalances,
    searchValue,
    setSearchValue,
  } = useSearch<(typeof detailedBalances)[0]>({
    dataSet: detailedBalances,
    keys: ["entity.name"],
    scoreThreshold: 0.55,
  });

  const {
    data: accountsLists,
    refetch: refetchAccountsLists,
    isLoading: isAccountsListsLoading,
  } = api.userPreferences.getPreference.useQuery(
    { userId: user!.id, preferenceKey: "accountsLists" },
    { enabled: !!user },
  );

  const { mutateAsync: addPreference } =
    api.userPreferences.addPreference.useMutation();

  const addIdToAccountList = (id: number) => {
    let title = "";
    if (accountListToAdd.indexOf(id) !== -1) {
      setAccountListToAdd(accountListToAdd.filter((n) => n !== id));
      title = `La entidad ${detailedBalances.find((b) => b.entity.id === id)
        ?.entity.name} fue removida de la lista`;
    } else {
      setAccountListToAdd([...accountListToAdd, id]);
      title = `La entidad ${detailedBalances.find((b) => b.entity.id === id)
        ?.entity.name} fue añadida a la lista`;
    }

    toast.info(title);
  };

  const addList = async (id?: number) => {
    if (user && accountsLists) {
      if (id) {
        await addPreference({
          userId: user.id,
          preference: {
            key: "accountsLists",
            value: accountsLists.map((obj) => {
              if (obj.id === id) {
                return {
                  ...obj,
                  idList: accountListToAdd,
                };
              } else {
                return { ...obj };
              }
            }),
          },
        });
        setIsEditListSelection(undefined);
      } else {
        const newList = {
          id: accountsLists.length + 1,
          idList: accountListToAdd,
          isDefault: true,
        };
        const undefaultedList = accountsLists?.map((list) => ({
          ...list,
          isDefault: false,
        }));
        await addPreference({
          userId: user.id,
          preference: {
            key: "accountsLists",
            value: accountsLists ? [...undefaultedList, newList] : [newList],
          },
        });
        setIsListSelection(false);
      }

      setAccountListToAdd([]);

      setDetailedBalancesPage(1);

      await refetchAccountsLists();
    }
  };

  const defaultList = accountsLists?.find((list) => list.isDefault);

  const filteredBalances = searchedBalances
    .sort((a, b) => {
      if (defaultList) {
        const aIndex = defaultList.idList.indexOf(a.entity.id);
        const bIndex = defaultList.idList.indexOf(b.entity.id);
        // Check if both objects have valid indices in the orderList
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        // If only a has a valid index, place it before b
        if (aIndex !== -1) {
          return -1;
        }

        // If only b has a valid index, place it before a
        if (bIndex !== -1) {
          return 1;
        }

        // If neither has a valid index, maintain the current order
        return 0;
      } else {
        return 0;
      }
    })
    .filter((item) => {
      if (defaultList && onlyListEntities) {
        return defaultList.idList.includes(item.entity.id);
      } else {
        return true;
      }
    });

  const {
    selectedCurrency,
    setSelectedCurrency,
    setDestinationEntityId,
    destinationEntityId,
    isInverted,
    setMovementsTablePage,
  } = useCuentasStore();

  const userCanUnify =
    user?.permissions?.some(
      (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_VISUALIZE",
    ) ?? false;

  const tableCurrencies = userCanUnify
    ? [...currenciesOrder, "unified"]
    : currenciesOrder;

  const columnAmount = (tableCurrencies.length + 1) * 2 + 1;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-row items-end justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tighter">Cuentas</h1>
          <div className="flex flex-row flex-wrap gap-4">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar"
              className="w-32"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex flex-row space-x-1">
                  <Icons.currentAccount className="h-4 w-4 text-black dark:text-white" />
                  {accountsLists &&
                    (accountsLists.find((list) => list.isDefault) ? (
                      <p>
                        Lista {accountsLists.find((list) => list.isDefault)?.id}
                      </p>
                    ) : (
                      <p>Listas</p>
                    ))}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80">
                <DropdownMenuLabel className="text-xl">
                  Listas
                </DropdownMenuLabel>
                {!isAccountsListsLoading ? (
                  <DropdownMenuGroup>
                    {accountsLists &&
                      accountsLists.map((list, index) => (
                        <DropdownMenuItem
                          key={index}
                          className="flex flex-row gap-x-2 focus:bg-transparent"
                          onSelect={(e: Event) => e.preventDefault()}
                        >
                          {isEditListSelection !== list.id ? (
                            <span
                              className={cn(
                                "rounded-full p-2",
                                list.isDefault
                                  ? "bg-green"
                                  : "bg-muted-foreground",
                              )}
                            ></span>
                          ) : (
                            <Icons.loadingCircle className="h-4 w-4 animate-spin text-black dark:text-white" />
                          )}
                          <div className="flex flex-col space-y-1">
                            <p className="font-semibold">Lista {list.id}</p>
                            <p className="text-sm">
                              {list.idList.slice(0, 3).flatMap((id, index) => {
                                const name = entities.find((e) => e.id === id)
                                  ?.name;
                                if (index + 1 === list.idList.length) {
                                  return name;
                                } else {
                                  return name + ", ";
                                }
                              })}
                            </p>
                          </div>
                          {isEditListSelection !== list.id ? (
                            <div className="flex flex-row gap-x-2">
                              {list.isDefault ? (
                                <div className="flex flex-row gap-x-2">
                                  <Button
                                    tooltip="Editar lista"
                                    className="flex flex-row space-x-1"
                                    variant="outline"
                                    disabled={
                                      isListSelection ||
                                      (!!isEditListSelection &&
                                        isEditListSelection !== list.id)
                                    }
                                    onClick={() => {
                                      toast.info(
                                        "Clickeá los circulos amarillos para añadir y un número para eliminar una entidad de la lista",
                                      );
                                      setIsEditListSelection(list.id);
                                      setAccountListToAdd(list.idList);
                                    }}
                                  >
                                    <Icons.editing className="h-4 w-4 text-yellow" />
                                  </Button>
                                  <Button
                                    tooltip="Desactivar lista"
                                    className="flex flex-row space-x-1"
                                    variant="outline"
                                    disabled={
                                      isListSelection ||
                                      (!!isEditListSelection &&
                                        isEditListSelection !== list.id)
                                    }
                                    onClick={async () => {
                                      if (user) {
                                        await addPreference({
                                          userId: user.id,
                                          preference: {
                                            key: "accountsLists",
                                            value: accountsLists.map((obj) => {
                                              if (obj.id === list.id) {
                                                return {
                                                  ...obj,
                                                  isDefault: false,
                                                };
                                              } else {
                                                return { ...obj };
                                              }
                                            }),
                                          },
                                        });
                                        await refetchAccountsLists();
                                      }
                                    }}
                                  >
                                    <Icons.documentMinus className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  tooltip="Activar lista"
                                  className="flex flex-row space-x-1"
                                  variant="outline"
                                  disabled={
                                    isListSelection ||
                                    (!!isEditListSelection &&
                                      isEditListSelection !== list.id)
                                  }
                                  onClick={async () => {
                                    if (user) {
                                      await addPreference({
                                        userId: user.id,
                                        preference: {
                                          key: "accountsLists",
                                          value: accountsLists.map((obj) => {
                                            if (obj.id === list.id) {
                                              return {
                                                ...obj,
                                                isDefault: true,
                                              };
                                            } else {
                                              return {
                                                ...obj,
                                                isDefault: false,
                                              };
                                            }
                                          }),
                                        },
                                      });
                                      await refetchAccountsLists();
                                    }
                                  }}
                                >
                                  <Icons.documentPlus className="h-4 w-4 text-green" />
                                </Button>
                              )}
                              <Button
                                tooltip="Eliminar lista"
                                className="flex flex-row space-x-1"
                                variant="outline"
                                disabled={
                                  isListSelection ||
                                  (!!isEditListSelection &&
                                    isEditListSelection !== list.id)
                                }
                                onClick={async () => {
                                  if (user) {
                                    await addPreference({
                                      userId: user.id,
                                      preference: {
                                        key: "accountsLists",
                                        value: accountsLists.filter(
                                          (obj) => obj.id !== list.id,
                                        ),
                                      },
                                    });
                                    await refetchAccountsLists();
                                  }
                                }}
                              >
                                <Icons.cross className="h-4 w-4 text-red" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-row gap-x-2">
                              <Button
                                tooltip="Cancelar edición"
                                className="flex flex-row gap-x-2"
                                variant="outline"
                                onClick={() =>
                                  setIsEditListSelection(undefined)
                                }
                              >
                                <Icons.cross className="h-4 w-4 text-black dark:text-white" />
                              </Button>
                              <Button
                                tooltip="Confirmar edición"
                                variant="outline"
                                onClick={() => addList(list.id)}
                              >
                                <Icons.check className="h-4 w-4 text-black dark:text-white" />
                              </Button>
                            </div>
                          )}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                ) : (
                  <Icons.loadingCircle className="-ml-1 mr-3 h-5 w-5 animate-spin text-black dark:text-white" />
                )}
                {!isListSelection ? (
                  <DropdownMenuItem
                    disabled={!!isEditListSelection}
                    onClick={() => {
                      setIsListSelection(true);
                      toast.info(
                        "Clickeá los circulos amarillos para seleccionar una entidad",
                      );
                    }}
                  >
                    <Icons.plus className="h-5 w-5 text-black dark:text-white" />
                    <p>Añadir lista</p>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Icons.loadingCircle className="-ml-1 mr-3 h-5 w-5 animate-spin text-black dark:text-white" />
                      <p className="animate-pulse">Seleccionando</p>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => addList()}>
                          <Icons.check className="mr-1 h-4 w-4 text-black dark:text-white" />
                          <span>Confirmar selección</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAccountListToAdd([]);
                            setIsListSelection(false);
                          }}
                        >
                          <Icons.cross className="mr-1 h-4 w-4 text-black dark:text-white" />
                          <span>Cancelar selección</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {defaultList && (
              <div className="flex flex-col items-center justify-start gap-y-2">
                <Label>Solo lista</Label>
                <Switch
                  checked={onlyListEntities}
                  onCheckedChange={setOnlyListEntities}
                />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {!isUrlLoading ? (
                  <Button variant="outline" tooltip="Descargar">
                    <Icons.download className="h-5" />
                  </Button>
                ) : (
                  <p>Cargando...</p>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Extensión</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      const promise = getUrlAsync({
                        entityId: selectedEntity?.id,
                        entityTag: selectedTag,
                        detailedBalances: filteredBalances,
                        fileType: "pdf",
                      });

                      toast.promise(promise, {
                        loading: "Generando archivo...",
                        success(data) {
                          return `Archivo generado: ${data.filename}`;
                        },
                        error() {
                          return `Error al generar el archivo`;
                        },
                      });
                    }}
                  >
                    <Icons.pdf className="h-4" />
                    <span>PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const promise = getUrlAsync({
                        entityId: selectedEntity?.id,
                        entityTag: selectedTag,
                        detailedBalances: filteredBalances,
                        fileType: "csv",
                      });

                      toast.promise(promise, {
                        loading: "Generando archivo...",
                        success(data) {
                          return `Archivo generado: ${data.filename}`;
                        },
                      });
                    }}
                  >
                    <Icons.excel className="h-4" />
                    <span>Excel</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CustomPagination
          page={detailedBalancesPage}
          pageSize={pageSize}
          itemName="entidades"
          totalCount={filteredBalances.length}
          changePageState={setDetailedBalancesPage}
        />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div
          style={{
            borderColor: uiColor,
            gridTemplateColumns: `repeat(${columnAmount}, minmax(0, 1fr))`,
          }}
          className="grid justify-items-center rounded-xl border-2 p-2"
        >
          <p className="col-span-1"></p>
          <p className="col-span-2">Entidad</p>
          {tableCurrencies.map((currency) => (
            <p key={currency} className="col-span-2">
              {currency === "unified" ? "Unificado" : currency.toUpperCase()}
            </p>
          ))}
        </div>
        {filteredBalances
          .slice(
            pageSize * (detailedBalancesPage - 1),
            pageSize * detailedBalancesPage,
          )
          .map((item, index) => (
            <div
              key={item.entity.id}
              style={{
                backgroundColor: uiColor
                  ? index % 2 === 0
                    ? lightenColor(uiColor, isDark ? 60 : 20)
                    : lightenColor(uiColor, isDark ? 40 : 10)
                  : undefined,
                gridTemplateColumns: `repeat(${columnAmount}, minmax(0, 1fr))`,
              }}
              className="grid justify-items-center rounded-xl p-3 text-lg font-semibold"
            >
              {isListSelection || isEditListSelection ? (
                <Button
                  variant="outline"
                  className="col-span-1 border-transparent bg-transparent p-2 transition-all hover:bg-transparent"
                  onClick={() => addIdToAccountList(item.entity.id)}
                >
                  {accountListToAdd.indexOf(item.entity.id) === -1 ? (
                    <span className="animate-pulse rounded-full bg-yellow p-3"></span>
                  ) : (
                    <p className="animate-pulse text-3xl font-semibold text-yellow">
                      {accountListToAdd.indexOf(item.entity.id) + 1}
                    </p>
                  )}
                </Button>
              ) : accountsLists ? (
                accountsLists.find((list) => list.isDefault) ? (
                  accountsLists
                    .find((list) => list.isDefault)!
                    .idList.indexOf(item.entity.id) !== -1 ? (
                    <p className="text-3xl font-semibold text-yellow">
                      {accountsLists
                        .find((list) => list.isDefault)!
                        .idList.indexOf(item.entity.id) + 1}
                    </p>
                  ) : (
                    <p></p>
                  )
                ) : (
                  <p></p>
                )
              ) : (
                <p></p>
              )}
              <Button
                onClick={() => {
                  if (
                    destinationEntityId === item.entity.id &&
                    !selectedCurrency
                  ) {
                    setDestinationEntityId(undefined);
                    setMovementsTablePage(1);
                  } else {
                    setSelectedCurrency(undefined);
                    setDestinationEntityId(item.entity.id);
                    setMovementsTablePage(1);
                  }
                }}
                className={cn(
                  "col-span-2 border-transparent",
                  item.entity.name.length < 12
                    ? "text-xl"
                    : item.entity.name.length < 22
                    ? "text-lg"
                    : item.entity.name.length < 28
                    ? "text-md"
                    : "text-sm",
                )}
                variant="outline"
              >
                <p>{item.entity.name}</p>
              </Button>
              {tableCurrencies.map((currency) => {
                const matchingBalance = item.data.find(
                  (balance) => balance.currency === currency,
                );

                return matchingBalance ? (
                  currency === "unified" ? (
                    <Tooltip key={currency}>
                      <TooltipTrigger className="col-span-2">
                        <Button
                          key={currency}
                          className="border-transparent text-xl"
                          variant="outline"
                        >
                          {!isFetching ? (
                            <p
                              className={cn(
                                matchingBalance.balance !== 0
                                  ? !isInverted
                                    ? matchingBalance.balance > 0
                                      ? "text-green"
                                      : "text-red"
                                    : -matchingBalance.balance > 0
                                    ? "text-green"
                                    : "text-red"
                                  : undefined,
                              )}
                            >
                              {numberFormatter(
                                !isInverted
                                  ? matchingBalance.balance
                                  : -matchingBalance.balance,
                              )}
                            </p>
                          ) : (
                            <p>Cargando...</p>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="flex flex-col gap-x-4">
                        {latestExchangeRates.map((r) => (
                          <p key={r.currency}>
                            {r.currency.toUpperCase()} -{" "}
                            {numberFormatter(r.rate)}
                            {r.currency === "usdt" ? " %" : " $"} -{" "}
                            {moment(r.date).format("DD-MM-YYYY")}
                          </p>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      onClick={() => {
                        if (
                          selectedCurrency !== currency ||
                          destinationEntityId !== item.entity.id
                        ) {
                          setSelectedCurrency(currency);
                          setDestinationEntityId(item.entity.id);
                          setMovementsTablePage(1);
                        } else {
                          setSelectedCurrency(undefined);
                          setDestinationEntityId(undefined);
                          setMovementsTablePage(1);
                        }
                      }}
                      key={currency}
                      className="col-span-2 border-transparent text-xl"
                      variant="outline"
                    >
                      {!isFetching ? (
                        <p
                          className={cn(
                            matchingBalance.balance !== 0
                              ? !isInverted
                                ? matchingBalance.balance > 0
                                  ? "text-green"
                                  : "text-red"
                                : -matchingBalance.balance > 0
                                ? "text-green"
                                : "text-red"
                              : undefined,
                          )}
                        >
                          {numberFormatter(
                            !isInverted
                              ? matchingBalance.balance
                              : -matchingBalance.balance,
                          )}
                        </p>
                      ) : (
                        <p>Cargando...</p>
                      )}
                    </Button>
                  )
                ) : (
                  <p className="col-span-2" key={currency}></p>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
};
export default DetailedBalances;
