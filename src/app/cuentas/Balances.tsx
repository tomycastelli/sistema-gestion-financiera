"use client";

import Lottie from "lottie-react";
import moment from "moment";
import { type Session } from "next-auth";
import Link from "next/link";
import { useState, type FC } from "react";
import { z } from "zod";
import useSearch from "~/hooks/useSearch";
import { capitalizeFirstLetter, getAllChildrenTags } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder, dateFormatting } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import CustomPagination from "../components/CustomPagination";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import { toast } from "../components/ui/use-toast";

interface BalancesProps {
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
  linkId: number | null;
  linkToken: string | null;
  selectedEntityId: number | null;
  selectedTag: string | null;
  tags: RouterOutputs["tags"]["getAll"];
  session: Session | null;
  entities: RouterOutputs["entities"]["getAll"];
}

const Balances: FC<BalancesProps> = ({
  initialBalances,
  accountType,
  linkId,
  linkToken,
  selectedEntityId,
  selectedTag,
  tags,
  session,
  entities,
}) => {
  const [detailedBalancesPage, setDetailedBalancesPage] = useState<number>(1);
  const pageSize = 8;

  const allChildrenTags = getAllChildrenTags(selectedTag, tags);

  const [accountListToAdd, setAccountListToAdd] = useState<number[]>([]);
  const [isListSelection, setIsListSelection] = useState<boolean>(false);

  const {
    selectedCurrency,
    setSelectedCurrency,
    setDestinationEntityId,
    destinationEntityId,
    isInverted,
    timeMachineDate,
  } = useCuentasStore();

  const {
    data: balances,
    isLoading: isBalanceLoading,
    isFetching,
  } = api.movements.getBalancesByEntities.useQuery(
    {
      entityId: selectedEntityId,
      entityTag: selectedTag,
      account: accountType,
      linkId: linkId,
      linkToken: linkToken,
      dayInPast: moment(timeMachineDate).format(dateFormatting.day),
    },
    { initialData: initialBalances, refetchOnWindowFocus: false },
  );

  const transformedBalancesSchema = z.object({
    entity: z.object({
      id: z.number().int(),
      name: z.string(),
      tagName: z.string(),
    }),
    data: z.array(z.object({ currency: z.string(), balance: z.number() })),
  });

  const transformedBalances: z.infer<typeof transformedBalancesSchema>[] =
    balances!.reduce(
      (acc, balance) => {
        if (selectedEntityId) {
          let entityEntry = acc.find(
            (entry) =>
              entry.entity.id ===
              (balance.selectedEntityId === selectedEntityId
                ? balance.selectedEntityId
                : balance.otherEntityId),
          );

          if (!entityEntry) {
            entityEntry = {
              entity:
                selectedEntityId === balance.selectedEntityId
                  ? balance.selectedEntity
                  : balance.otherEntity,
              data: [],
            };
            acc.push(entityEntry);
          }

          const balanceMultiplier =
            entityEntry.entity.id === balance.selectedEntityId ? 1 : -1;

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
        } else if (selectedTag) {
          const myPOVEntity = allChildrenTags.includes(
            balance.selectedEntity.tagName,
          )
            ? balance.selectedEntity
            : balance.otherEntity;
          let entityEntry = acc.find(
            (entry) => entry.entity.id === myPOVEntity.id,
          );

          if (!entityEntry) {
            entityEntry = {
              entity: myPOVEntity,
              data: [],
            };
            acc.push(entityEntry);
          }

          const balanceMultiplier =
            entityEntry.entity.id === balance.selectedEntityId ? 1 : -1;

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
        }

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );

  const currencyOrder = ["usd", "ars", "usdt", "eur", "brl"];

  let detailedBalances: z.infer<typeof transformedBalancesSchema>[] = [];

  if (selectedEntityId) {
    detailedBalances = balances!.reduce(
      (acc, balance) => {
        let entityEntry = acc.find(
          (entry) =>
            entry.entity.id ===
            (balance.selectedEntityId === selectedEntityId
              ? balance.otherEntity.id
              : balance.selectedEntity.id),
        );

        if (!entityEntry) {
          entityEntry = {
            entity:
              balance.selectedEntityId === selectedEntityId
                ? balance.otherEntity
                : balance.selectedEntity,
            data: [],
          };
          acc.push(entityEntry);
        }

        const balanceMultiplier =
          entityEntry.entity.id === balance.selectedEntityId ? -1 : 1;

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

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );
  } else if (selectedTag) {
    detailedBalances = balances!.reduce(
      (acc, balance) => {
        const myPOVEntity = allChildrenTags.includes(
          balance.selectedEntity.tagName,
        )
          ? balance.otherEntity
          : balance.selectedEntity;
        let entityEntry = acc.find(
          (entry) => entry.entity.id === myPOVEntity.id,
        );

        if (!entityEntry) {
          entityEntry = {
            entity: myPOVEntity,
            data: [],
          };
          acc.push(entityEntry);
        }

        const balanceMultiplier =
          entityEntry.entity.id === balance.selectedEntityId ? -1 : 1;

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

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );
  }

  const { mutateAsync: getUrlAsync, isLoading: isUrlLoading } =
    api.files.detailedBalancesFile.useMutation({
      onSuccess(newOperation) {
        if (newOperation) {
          toast({
            title: "Archivo generado exitosamente",
            description: newOperation.filename,
            variant: "success",
          });
          const link = document.createElement("a");
          link.href = newOperation.downloadUrl;
          link.download = newOperation.filename;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      },
      onError(error) {
        toast({
          title: error.data ? error.data.code : "",
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const {
    results: filteredBalances,
    searchValue,
    setSearchValue,
  } = useSearch<(typeof detailedBalances)[0]>({
    dataSet: detailedBalances,
    keys: ["entity.name"],
  });

  const {
    data: accountsLists,
    refetch: refetchAccountsLists,
    isLoading: isAccountsListsLoading,
  } = api.userPreferences.getPreference.useQuery(
    { userId: session!.user.id, preferenceKey: "accountsLists" },
    { enabled: !!session },
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
    toast({
      title,
      variant: "success",
    });
  };

  const addList = async () => {
    if (session) {
      const newList = {
        id: accountsLists ? accountsLists.length + 1 : 1,
        idList: accountListToAdd,
        isDefault: true,
      };
      const undefaultedList = accountsLists?.map((list) => ({
        ...list,
        isDefault: false,
      }));
      await addPreference({
        userId: session.user.id,
        preference: {
          key: "accountsLists",
          value: accountsLists ? [...undefaultedList!, newList] : [newList],
        },
      });

      setIsListSelection(false);

      setAccountListToAdd([]);

      setDetailedBalancesPage(1);

      await refetchAccountsLists();
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
      <div className="grid-cols grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isBalanceLoading ? (
          transformedBalances
            .sort((a, b) => a.entity.name.localeCompare(b.entity.name))
            .map((item) => (
              <Card
                key={item.entity.id}
                className="min-w-[300px] transition-all hover:scale-105 hover:shadow-md hover:shadow-primary"
              >
                <Link
                  prefetch={false}
                  href={{
                    pathname: "/cuentas",
                    query: {
                      cuenta: "cuenta_corriente",
                      entidad: item.entity.id,
                    },
                  }}
                >
                  <CardHeader>
                    <CardTitle>{item.entity.name}</CardTitle>
                    <CardDescription>
                      {capitalizeFirstLetter(item.entity.tagName)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col space-y-2">
                      {item.data
                        .sort(
                          (a, b) =>
                            currenciesOrder.indexOf(a.currency) -
                            currenciesOrder.indexOf(b.currency),
                        )
                        .map((balances) => (
                          <div
                            key={balances.currency}
                            className="grid grid-cols-3"
                          >
                            <p className="col-span-1">
                              {balances.currency.toUpperCase()}
                            </p>
                            {!isFetching ? (
                              <p className="col-span-2 text-xl font-bold">
                                ${" "}
                                {new Intl.NumberFormat("es-AR").format(
                                  !isInverted
                                    ? balances.balance
                                    : -balances.balance,
                                )}
                              </p>
                            ) : (
                              <p>Cargando...</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))
        ) : (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        )}
      </div>
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
                <DropdownMenuLabel>Listas</DropdownMenuLabel>
                {!isAccountsListsLoading ? (
                  <DropdownMenuGroup>
                    {accountsLists &&
                      accountsLists.map((list, index) => (
                        <DropdownMenuItem
                          key={index}
                          className="flex flex-row space-x-2"
                        >
                          <span
                            className={cn(
                              "rounded-full p-2",
                              list.isDefault
                                ? "bg-green"
                                : "bg-muted-foreground",
                            )}
                          ></span>
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
                          {!list.isDefault && (
                            <Button
                              className="flex flex-row space-x-1"
                              variant="outline"
                              onClick={async () => {
                                if (session) {
                                  await addPreference({
                                    userId: session.user.id,
                                    preference: {
                                      key: "accountsLists",
                                      value: accountsLists.map((obj) => {
                                        if (obj.id === list.id) {
                                          return { ...obj, isDefault: true };
                                        } else {
                                          return { ...obj, isDefault: false };
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
                          {list.isDefault && (
                            <Button
                              className="flex flex-row space-x-1"
                              variant="outline"
                              onClick={async () => {
                                if (session) {
                                  await addPreference({
                                    userId: session.user.id,
                                    preference: {
                                      key: "accountsLists",
                                      value: accountsLists.map((obj) => {
                                        if (obj.id === list.id) {
                                          return { ...obj, isDefault: false };
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
                          )}
                          <Button
                            className="flex flex-row space-x-1"
                            variant="outline"
                            onClick={async () => {
                              if (session) {
                                await addPreference({
                                  userId: session.user.id,
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
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                ) : (
                  <Icons.loadingCircle className="-ml-1 mr-3 h-5 w-5 animate-spin text-black dark:text-white" />
                )}
                {!isListSelection ? (
                  <DropdownMenuItem onClick={() => setIsListSelection(true)}>
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
                          onClick={() => setIsListSelection(false)}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {!isUrlLoading ? (
                  <Button variant="outline">Generar</Button>
                ) : (
                  <p>Cargando...</p>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Extensión</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={async () => {
                      await getUrlAsync({
                        entityId: selectedEntityId,
                        entityTag: selectedTag,
                        detailedBalances: detailedBalances,
                        fileType: "pdf",
                      });
                    }}
                  >
                    <Icons.pdf className="h-4" />
                    <span>PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await getUrlAsync({
                        entityId: selectedEntityId,
                        entityTag: selectedTag,
                        detailedBalances: detailedBalances,
                        fileType: "csv",
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
        <div className="grid grid-cols-13 justify-items-center rounded-xl border border-muted-foreground p-2">
          <p className="col-span-1"></p>
          <p className="col-span-2">Entidad</p>
          {currencyOrder.map((currency) => (
            <p key={currency} className="col-span-2">
              {currency.toUpperCase()}
            </p>
          ))}
        </div>
        {!isBalanceLoading ? (
          filteredBalances
            .sort((a, b) => {
              const defaultList = accountsLists?.find((list) => list.isDefault);
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
            .slice(
              pageSize * (detailedBalancesPage - 1),
              pageSize * detailedBalancesPage,
            )
            .map((item, index) => (
              <div
                key={item.entity.id}
                className={cn(
                  "grid grid-cols-13 justify-items-center rounded-xl p-3 text-lg font-semibold",
                  index % 2 === 0 ? "bg-muted" : "bg-muted-foreground",
                )}
              >
                {isListSelection ? (
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
                <div
                  onClick={() => {
                    setSelectedCurrency(undefined);
                    setDestinationEntityId(item.entity.id);
                  }}
                  className={cn(
                    "col-span-2 flex items-center justify-center rounded-full p-2 transition-all hover:scale-105 hover:cursor-default hover:bg-primary hover:text-white hover:shadow-md",
                    !selectedCurrency &&
                      destinationEntityId === item.entity.id &&
                      "bg-primary text-white shadow-md",
                  )}
                >
                  <p>{item.entity.name}</p>
                </div>
                {currencyOrder.map((currency) => {
                  const matchingBalance = item.data.find(
                    (balance) => balance.currency === currency,
                  );

                  return matchingBalance ? (
                    !isFetching ? (
                      <div
                        onClick={() => {
                          if (
                            selectedCurrency !== currency ||
                            destinationEntityId !== item.entity.id
                          ) {
                            setSelectedCurrency(currency);
                            setDestinationEntityId(item.entity.id);
                          } else {
                            setSelectedCurrency(undefined);
                            setDestinationEntityId(undefined);
                          }
                        }}
                        key={currency}
                        className={cn(
                          "col-span-2 flex items-center justify-center rounded-full p-2 transition-all hover:scale-105 hover:cursor-default hover:bg-primary hover:text-white hover:shadow-md",
                          selectedCurrency === currency &&
                            destinationEntityId === item.entity.id &&
                            "bg-primary text-white shadow-md",
                        )}
                      >
                        <p>
                          {new Intl.NumberFormat("es-AR").format(
                            !isInverted
                              ? matchingBalance.balance
                              : -matchingBalance.balance,
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="col-span-2">Cargando...</p>
                    )
                  ) : (
                    <p className="col-span-2"></p>
                  );
                })}
              </div>
            ))
        ) : (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        )}
      </div>
    </div>
  );
};

export default Balances;
