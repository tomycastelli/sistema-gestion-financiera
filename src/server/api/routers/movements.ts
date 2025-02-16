import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  not,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import moment from "moment";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import {
  currentAccountsProcedure,
  getAllEntities,
  getAllPermissions,
  getAllTags,
} from "~/lib/trpcFunctions";
import { currenciesOrder, dateFormatting } from "~/lib/variables";
import {
  balances,
  cashBalances,
  entities,
  links,
  movements,
  operations,
  transactions,
} from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
  publicLoggedProcedure,
  publicProcedure,
} from "../trpc";

export const getCurrentAccountsInput = z.object({
  linkId: z.number().int().optional().nullable(),
  linkToken: z.string().optional().nullable(),
  sharedEntityId: z.number().optional().nullish(),
  pageSize: z.number().int(),
  pageNumber: z.number().int(),
  entityId: z.number().int().optional().nullish(), // Change from array to single number
  entityTag: z.string().optional().nullish(),
  originEntityId: z.number().int().optional().nullish(),
  toEntityId: z.number().int().optional().nullish(),
  currency: z.string().optional().nullish(),
  account: z.boolean().optional(),
  fromDate: z.date().optional().nullish(),
  toDate: z.date().optional().nullish(),
  dayInPast: z.string().optional(),
  groupInTag: z.boolean().default(true),
  dateOrdering: z.enum(["asc", "desc"]).default("desc"),
  ignoreSameTag: z.boolean().default(false),
});

export const movementsRouter = createTRPCRouter({
  getCurrentAccounts: publicLoggedProcedure
    .input(getCurrentAccountsInput)
    .query(async ({ ctx, input }) => {
      const response = await currentAccountsProcedure(input, ctx);
      return {
        movements: response.movementsQuery,
        totalRows: response.totalRows,
      };
    }),

  getBalancesByEntities: publicProcedure
    .input(
      z
        .object({
          entityId: z.number().int().optional().nullable(),
          entityTag: z.string().optional().nullable(),
          linkId: z.number().optional().nullable(),
          linkToken: z.string().optional().nullable(),
          account: z.boolean().optional().nullable(),
          dayInPast: z.string().optional(),
        })
        .superRefine((obj, ctx) => {
          if (!obj.entityId && !obj.entityTag) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Es necesario una entidad o un tag",
            });
          }
        }),
    )
    .query(async ({ ctx, input }) => {
      // Validate request
      let isRequestValid = false;
      if (ctx.user) {
        const userPermissions = await getAllPermissions(
          ctx.redis,
          ctx.user,
          ctx.db,
        );
        const tags = await getAllTags(ctx.redis, ctx.db);
        const entities = await getAllEntities(ctx.redis, ctx.db);
        const entityTag = entities.find((e) => e.id === input.entityId)?.tag
          .name;

        isRequestValid =
          userPermissions?.some(
            (p) =>
              p.name === "ADMIN" ||
              p.name === "ACCOUNTS_VISUALIZE" ||
              (p.name === "ACCOUNTS_VISUALIZE_SOME" &&
                (input.entityId
                  ? p.entitiesIds?.includes(input.entityId) ||
                    (entityTag &&
                      getAllChildrenTags(p.entitiesTags, tags).includes(
                        entityTag,
                      ))
                  : input.entityTag
                  ? getAllChildrenTags(p.entitiesTags, tags).includes(
                      input.entityTag,
                    )
                  : false)),
          ) || input.entityId === ctx.user.entityId;
      } else if (input.linkId && input.linkToken && input.entityId) {
        const link = await ctx.db.query.links.findFirst({
          where: and(
            eq(links.id, input.linkId),
            eq(links.sharedEntityId, input.entityId),
            eq(links.password, input.linkToken),
            gte(links.expiration, new Date()),
          ),
        });
        isRequestValid = !!link;
      }

      if (!isRequestValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ctx.user
            ? "El usuario no tiene los permisos suficientes para ver esta cuenta"
            : "El usuario no está registrado o el link no es válido",
        });
      }

      const selectedEntityObject = alias(entities, "selectedEntity");
      const otherEntityObject = alias(entities, "otherEntity");

      // Common query conditions
      const dateCondition = input.dayInPast
        ? lte(
            balances.date,
            moment(input.dayInPast, dateFormatting.day).startOf("day").toDate(),
          )
        : lte(balances.date, new Date());

      const accountCondition =
        typeof input.account === "boolean"
          ? eq(balances.account, input.account)
          : undefined;

      const entityCondition = input.entityTag
        ? or(
            eq(selectedEntityObject.tagName, input.entityTag),
            eq(otherEntityObject.tagName, input.entityTag),
          )
        : or(
            eq(selectedEntityObject.id, input.entityId ?? 0),
            eq(otherEntityObject.id, input.entityId ?? 0),
          );

      const balancesQuery = ctx.db
        .selectDistinctOn([
          balances.selectedEntityId,
          balances.otherEntityId,
          balances.account,
          balances.currency,
        ])
        .from(balances)
        .leftJoin(
          selectedEntityObject,
          eq(selectedEntityObject.id, balances.selectedEntityId),
        )
        .leftJoin(
          otherEntityObject,
          eq(otherEntityObject.id, balances.otherEntityId),
        )
        .where(
          and(
            isNull(balances.tagName),
            entityCondition,
            accountCondition,
            dateCondition,
          ),
        )
        .orderBy(
          balances.selectedEntityId,
          balances.otherEntityId,
          balances.account,
          balances.currency,
          desc(balances.date),
        )
        .prepare("balancesQuery");

      const balancesData = await balancesQuery.execute();

      return balancesData.map((b) => ({
        ...b.Balances,
        selectedEntity: b.selectedEntity!,
        otherEntity: b.otherEntity!,
      }));
    }),
  getBalancesByEntitiesForCard: publicProcedure
    .input(
      z
        .object({
          entityId: z.number().int().optional().nullable(),
          entityTag: z.string().optional().nullable(),
          linkId: z.number().optional().nullable(),
          linkToken: z.string().optional().nullable(),
          dayInPast: z.string().optional(),
        })
        .superRefine((obj, ctx) => {
          if (!obj.entityId && !obj.entityTag) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Es necesario una entidad o un tag",
            });
          }
        }),
    )
    .query(async ({ ctx, input }) => {
      let isRequestValid = false;

      if (ctx.user !== undefined) {
        isRequestValid = true;
      } else if (input.linkId && input.linkToken && input.entityId) {
        const [link] = await ctx.db
          .select()
          .from(links)
          .where(
            and(
              eq(links.id, input.linkId),
              eq(links.sharedEntityId, input.entityId),
              eq(links.password, input.linkToken),
              gte(links.expiration, new Date()),
            ),
          )
          .limit(1);

        if (link) {
          isRequestValid = true;
        }
      }

      if (!isRequestValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "El usuario no está registrado o el link no es válido",
        });
      }

      const TotalBalanceSchema = z.object({
        currency: z.string(),
        balances: z.array(
          z.object({
            account: z.boolean(),
            amount: z.number(),
          }),
        ),
      });

      const selectedEntityObject = alias(entities, "selectedEntity");
      const otherEntityObject = alias(entities, "otherEntity");

      if (input.entityTag) {
        const allTags = await getAllTags(ctx.redis, ctx.db);
        const allChildrenTags = Array.from(
          getAllChildrenTags(input.entityTag, allTags),
        );

        const balancesData = await ctx.db
          .selectDistinctOn([
            balances.selectedEntityId,
            balances.otherEntityId,
            balances.account,
            balances.currency,
          ])
          .from(balances)
          .leftJoin(
            selectedEntityObject,
            eq(selectedEntityObject.id, balances.selectedEntityId),
          )
          .leftJoin(
            otherEntityObject,
            eq(otherEntityObject.id, balances.otherEntityId),
          )
          .where(
            and(
              isNull(balances.tagName),
              or(
                and(
                  inArray(selectedEntityObject.tagName, allChildrenTags),
                  not(inArray(otherEntityObject.tagName, allChildrenTags)),
                ),
                and(
                  not(inArray(selectedEntityObject.tagName, allChildrenTags)),
                  inArray(otherEntityObject.tagName, allChildrenTags),
                ),
              ),
              input.dayInPast
                ? lte(
                    balances.date,
                    moment(input.dayInPast, dateFormatting.day).toDate(),
                  )
                : lte(balances.date, new Date()),
            ),
          )
          .orderBy(
            balances.selectedEntityId,
            balances.otherEntityId,
            balances.account,
            balances.currency,
            desc(balances.date),
          );

        const balancesTransformed = balancesData.map((b) => ({
          ...b.Balances,
          selectedEntity: b.selectedEntity!,
          otherEntity: b.otherEntity!,
        }));

        const totalBalances: z.infer<typeof TotalBalanceSchema>[] =
          balancesTransformed.reduce(
            (acc, balance) => {
              const isEntityTagSelected = allChildrenTags.includes(
                balance.selectedEntity.tagName,
              );

              // Find the corresponding total balance entry
              const existingEntry = acc.find(
                (entry) => entry.currency === balance.currency,
              );

              // Calculate the beforeAmount based on the specified duration
              // If the entry exists, update the amount and beforeAmount based on the conditions
              if (existingEntry) {
                // Find the balance entry within the existing total balance entry
                const existingBalance = existingEntry.balances.find(
                  (b) => b.account === balance.account,
                );

                if (existingBalance) {
                  // Update the existing balance entry
                  existingBalance.amount += isEntityTagSelected
                    ? balance.balance
                    : -balance.balance;
                } else {
                  // Add a new balance entry to the existing total balance entry
                  existingEntry.balances.push({
                    account: balance.account,
                    amount: isEntityTagSelected
                      ? balance.balance
                      : -balance.balance,
                  });
                }
              } else {
                // If the entry doesn't exist, create a new entry with a new balance entry
                acc.push({
                  currency: balance.currency,
                  balances: [
                    {
                      account: balance.account,
                      amount: isEntityTagSelected
                        ? balance.balance
                        : -balance.balance,
                    },
                  ],
                });
              }

              return acc;
            },
            [] as z.infer<typeof TotalBalanceSchema>[],
          );

        return totalBalances;
      } else {
        const balancesData = await ctx.db
          .selectDistinctOn([
            balances.selectedEntityId,
            balances.otherEntityId,
            balances.account,
            balances.currency,
          ])
          .from(balances)
          .leftJoin(
            selectedEntityObject,
            eq(selectedEntityObject.id, balances.selectedEntityId),
          )
          .leftJoin(
            otherEntityObject,
            eq(otherEntityObject.id, balances.otherEntityId),
          )
          .where(
            and(
              isNull(balances.tagName),
              or(
                eq(selectedEntityObject.id, input.entityId ?? 0),
                eq(otherEntityObject.id, input.entityId ?? 0),
              ),
              input.dayInPast
                ? lte(
                    balances.date,
                    moment(input.dayInPast, dateFormatting.day).toDate(),
                  )
                : lte(balances.date, new Date()),
            ),
          )
          .orderBy(
            balances.selectedEntityId,
            balances.otherEntityId,
            balances.account,
            balances.currency,
            desc(balances.date),
          );

        const balancesTransformed = balancesData.map((b) => ({
          ...b.Balances,
          selectedEntity: b.selectedEntity!,
          otherEntity: b.otherEntity!,
        }));

        const totalBalances: z.infer<typeof TotalBalanceSchema>[] =
          balancesTransformed.reduce(
            (acc, balance) => {
              const isEntityIdSelected =
                input.entityId === balance.selectedEntityId;

              // Find the corresponding total balance entry
              const existingEntry = acc.find(
                (entry) => entry.currency === balance.currency,
              );

              // If the entry exists, update the amount and beforeAmount based on the conditions
              if (existingEntry) {
                // Find the balance entry within the existing total balance entry
                const existingBalance = existingEntry.balances.find(
                  (b) => b.account === balance.account,
                );

                if (existingBalance) {
                  // Update the existing balance entry
                  existingBalance.amount += isEntityIdSelected
                    ? balance.balance
                    : -balance.balance;
                } else {
                  // Add a new balance entry to the existing total balance entry
                  existingEntry.balances.push({
                    account: balance.account,
                    amount: isEntityIdSelected
                      ? balance.balance
                      : -balance.balance,
                  });
                }
              } else {
                // If the entry doesn't exist, create a new entry with a new balance entry
                acc.push({
                  currency: balance.currency,
                  balances: [
                    {
                      account: balance.account,
                      amount: isEntityIdSelected
                        ? balance.balance
                        : -balance.balance,
                    },
                  ],
                });
              }

              return acc;
            },
            [] as z.infer<typeof TotalBalanceSchema>[],
          );

        return totalBalances;
      }
    }),
  getMovementsByOpId: protectedProcedure
    .input(z.object({ operationId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(async (transaction) => {
        const movementsIds = await transaction
          .select({ id: movements.id })
          .from(movements)
          .leftJoin(transactions, eq(movements.transactionId, transactions.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .where(
            and(
              eq(operations.id, input.operationId),
              isNull(movements.entitiesMovementId),
            ),
          )
          .orderBy(desc(movements.id));

        const mvsIds =
          movementsIds.length > 0 ? movementsIds.map((mv) => mv.id) : [0];

        return await transaction.query.movements.findMany({
          where: inArray(movements.id, mvsIds),
          with: {
            transaction: {
              with: {
                fromEntity: true,
                toEntity: true,
              },
            },
          },
          orderBy: desc(movements.id),
        });
      });

      return response;
    }),
  balanceChart: protectedProcedure
    .input(
      z.object({
        entityId: z.number().int().optional().nullish(),
        tagName: z.string().optional().nullish(),
        daysBackAmount: z.number().default(30),
        dayInPast: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const fromDateMoment = input.dayInPast
        ? moment(input.dayInPast)
        : moment();
      const fromDate = fromDateMoment
        .startOf("day")
        .subtract(input.daysBackAmount, "days")
        .toDate();
      // Caja
      const balancesData = await ctx.db
        .select()
        .from(cashBalances)
        .where(
          and(
            input.entityId
              ? eq(cashBalances.entityId, input.entityId)
              : undefined,
            input.tagName ? eq(cashBalances.tagName, input.tagName) : undefined,
            gte(cashBalances.date, fromDate),
            input.dayInPast
              ? lte(cashBalances.date, input.dayInPast)
              : lte(cashBalances.date, new Date()),
          ),
        );

      const totalBalances: {
        id: number;
        date: Date;
        balance: number;
        currency: string;
        entityId: number | null;
        tagName: string | null;
      }[] = [];

      // Now I will check if there is a value in the fromDate for each currency.
      // Otherwise set the value to the first date immediately before
      for (const currency of currenciesOrder) {
        const currencyBalances = balancesData.filter(
          (b) => b.currency === currency,
        );

        if (
          !currencyBalances.find(
            (b) =>
              b.currency === currency &&
              b.date.getTime() === fromDate.getTime(),
          )
        ) {
          const [lastAvailableBalance] = await ctx.db
            .select()
            .from(cashBalances)
            .where(
              and(
                input.entityId
                  ? eq(cashBalances.entityId, input.entityId)
                  : undefined,
                input.tagName
                  ? eq(cashBalances.tagName, input.tagName)
                  : undefined,
                eq(cashBalances.currency, currency),
                lt(cashBalances.date, fromDate),
              ),
            )
            .orderBy(desc(cashBalances.date))
            .limit(1);

          // I push this balance in the first position of the array
          currencyBalances.unshift({
            balance: lastAvailableBalance?.balance ?? 0,
            currency,
            date: fromDate,
            entityId: input.entityId ?? null,
            tagName: input.tagName ?? null,
            id: 0,
          });
        }

        if (currencyBalances.length === input.daysBackAmount) {
          totalBalances.push(...currencyBalances);
          continue;
        }

        let dateCursor = fromDate.getTime() + 86400000;
        while (dateCursor < moment().startOf("day").toDate().getTime()) {
          const cursorBalance = currencyBalances.find(
            (b) => b.date.getTime() === dateCursor,
          );
          if (!cursorBalance) {
            const newBalance = {
              id: 0,
              currency,
              date: new Date(dateCursor),
              entityId: input.entityId ?? null,
              tagName: input.tagName ?? null,
              balance: currencyBalances.find(
                (b) => b.date.getTime() === dateCursor - 86400000,
              )!.balance,
            };

            currencyBalances.push(newBalance);
          }

          dateCursor += 86400000;
        }

        totalBalances.push(...currencyBalances);
      }

      totalBalances.sort((a, b) => a.date.getTime() - b.date.getTime());

      const groupedBalances = totalBalances.reduce(
        (acc, item) => {
          const currencyBalances = acc.find(
            (a) => a.currency === item.currency,
          );

          const mappedItem = {
            id: item.id,
            balance: item.balance,
            date: item.date,
            entityId: item.entityId,
            tagName: item.tagName,
          };

          if (currencyBalances) {
            currencyBalances.balances.push(mappedItem);
          } else {
            acc.push({
              currency: item.currency,
              balances: [mappedItem],
            });
          }

          return acc;
        },
        [] as {
          currency: string;
          balances: {
            id: number;
            date: Date;
            balance: number;
            entityId: number | null;
            tagName: string | null;
          }[];
        }[],
      );

      return groupedBalances;
    }),
});
