import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  not,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import moment from "moment";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import {
  getAllEntities,
  getAllPermissions,
  getAllTags,
} from "~/lib/trpcFunctions";
import { dateFormatting } from "~/lib/variables";
import {
  balances,
  entities,
  links,
  movements,
  operations,
  transactions,
  transactionsMetadata,
} from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const movementsRouter = createTRPCRouter({
  getCurrentAccounts: publicProcedure
    .input(
      z.object({
        linkId: z.number().int().optional().nullable(),
        linkToken: z.string().optional().nullable(),
        sharedEntityId: z.number().optional().nullish(),
        pageSize: z.number().int(),
        pageNumber: z.number().int(),
        entityId: z.number().int().optional().nullish(), // Change from array to single number
        entityTag: z.string().optional().nullish(),
        toEntityId: z.number().int().optional().nullish(),
        currency: z.string().optional().nullish(),
        account: z.boolean().optional(),
        fromDate: z.date().optional().nullish(),
        toDate: z.date().optional().nullish(),
        dayInPast: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let isRequestValid = false;

      if (ctx.user !== undefined) {
        isRequestValid = true;
      } else if (input.linkId && input.linkToken && input.sharedEntityId) {
        const [link] = await ctx.db
          .select()
          .from(links)
          .where(
            and(
              eq(links.id, input.linkId),
              eq(links.sharedEntityId, input.sharedEntityId),
              eq(links.password, input.linkToken),
              gte(links.expiration, new Date()),
            ),
          );

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

      const tags = await getAllTags(ctx.redis, ctx.db);
      const tagAndChildren = input.entityTag
        ? Array.from(getAllChildrenTags(input.entityTag, tags))
        : ["a"];

      // Hay que hacer join con transactions para que funcionen estas conditions
      const transactionsConditions = and(
        or(
          input.entityId
            ? and(
              input.currency
                ? eq(transactions.currency, input.currency)
                : undefined,
              or(
                and(
                  eq(transactions.fromEntityId, input.entityId),
                  input.toEntityId
                    ? eq(transactions.toEntityId, input.toEntityId)
                    : not(eq(transactions.toEntityId, input.entityId)),
                ),
                and(
                  eq(transactions.toEntityId, input.entityId),
                  input.toEntityId
                    ? eq(transactions.fromEntityId, input.toEntityId)
                    : not(eq(transactions.fromEntityId, input.entityId)),
                ),
              ),
            )
            : undefined,
          input.entityTag
            ? and(
              input.currency
                ? eq(transactions.currency, input.currency)
                : undefined,
            )
            : undefined,
        ),
        input.dayInPast
          ? lte(
            operations.date,
            moment(input.dayInPast, dateFormatting.day)
              .set({
                hour: 23,
                minute: 59,
                second: 59,
                millisecond: 999,
              })
              .toDate(),
          )
          : undefined,
        input.fromDate && input.toDate
          ?
          and(
            gte(
              operations.date,
              moment(input.fromDate)
                .set({
                  hour: 0,
                  minute: 0,
                  second: 0,
                  millisecond: 0,
                })
                .toDate(),
            ),
            lte(
              operations.date,
              moment(input.toDate)
                .set({
                  hour: 23,
                  minute: 59,
                  second: 59,
                  millisecond: 999,
                })
                .toDate(),
            ),
          )
          : undefined,
        input.fromDate && !input.toDate
          ?
          and(
            gte(
              operations.date,
              moment(input.fromDate)
                .set({
                  hour: 0,
                  minute: 0,
                  second: 0,
                  millisecond: 0,
                })
                .toDate(),
            ),
            lte(
              operations.date,
              moment(input.fromDate)
                .set({
                  hour: 0,
                  minute: 0,
                  second: 0,
                  millisecond: 0,
                })
                .add(1, "day")
                .toDate(),
            ),
          )
          : undefined,
      );

      // Hay que hacer join con tags en fromEntity y toEntity para que funcionen estas where conditions
      const fromEntityObject = alias(entities, "fromEntityObject");
      const toEntityObject = alias(entities, "toEntityObject");

      const entitiesConditions = or(
        and(
          inArray(fromEntityObject.tagName, tagAndChildren),
          input.toEntityId
            ? eq(toEntityObject.id, input.toEntityId)
            : not(inArray(toEntityObject.tagName, tagAndChildren)),
        ),
        and(
          input.toEntityId
            ? eq(fromEntityObject.id, input.toEntityId)
            : not(inArray(fromEntityObject.tagName, tagAndChildren)),
          inArray(toEntityObject.tagName, tagAndChildren),
        ),
      );

      const movementsConditions = and(
        typeof input.account === "boolean"
          ? eq(movements.account, input.account)
          : undefined,
      );

      const response = await ctx.db.transaction(async (transaction) => {
        const movementsIdsQuery = transaction
          .select({ id: movements.id })
          .from(movements)
          .leftJoin(transactions, eq(movements.transactionId, transactions.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .leftJoin(
            fromEntityObject,
            eq(fromEntityObject.id, transactions.fromEntityId),
          )
          .leftJoin(
            toEntityObject,
            eq(toEntityObject.id, transactions.toEntityId),
          )
          .where(
            and(
              movementsConditions,
              input.entityTag ? entitiesConditions : undefined,
              transactionsConditions,
            ),
          ).prepare("movements_ids_query");

        const movementsIds = await movementsIdsQuery.execute()

        const ids =
          movementsIds.length > 0 ? movementsIds.map((obj) => obj.id) : [0];

        const fromEntity = alias(entities, "fromEntity")
        const toEntity = alias(entities, "toEntity")

        const movementsQuery = transaction.select().from(movements)
          .leftJoin(transactions, eq(movements.transactionId, transactions.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .leftJoin(transactionsMetadata, eq(transactions.id, transactionsMetadata.transactionId))
          .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
          .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
          .where(inArray(movements.id, ids))
          .orderBy(desc(operations.date), desc(movements.id))
          .offset(sql.placeholder("queryOffset"))
          .limit(sql.placeholder("queryLimit")).prepare("movements_query")

        const movementsData = await movementsQuery.execute({
          queryOffset: (input.pageNumber - 1) * input.pageSize,
          queryLimit: input.pageSize
        })

        const nestedData = movementsData.map(obj =>
          ({ ...obj.Movements, transaction: { ...obj.Transactions!, transactionMetadata: obj.TransactionsMetadata!, operation: obj.Operations!, fromEntity: obj.fromEntity!, toEntity: obj.toEntity! } }))

        return { movementsQuery: nestedData, totalRows: movementsIds.length };
      });

      return {
        movements: response.movementsQuery,
        totalRows: response.totalRows,
      };
    }),

  getBalancesByEntities: publicProcedure
    .input(
      z.object({
        entityId: z.number().int().optional().nullable(),
        entityTag: z.string().optional().nullable(),
        linkId: z.number().optional().nullable(),
        linkToken: z.string().optional().nullable(),
        account: z.boolean().optional().nullable(),
        dayInPast: z.string().optional(),
      }).superRefine((obj, ctx) => {
        if (!obj.entityId && !obj.entityTag) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Es necesario una entidad o un tag",
          })
        }
      }),
    )
    .query(async ({ ctx, input }) => {
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

        if (
          userPermissions?.find(
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
          )
        ) {
          isRequestValid = true;
        } else if (input.entityId === ctx.user.entityId) {
          isRequestValid = true
        }
      } else if (input.linkId && input.linkToken && input.entityId) {
        const link = await ctx.db.query.links.findFirst({
          where: and(
            eq(links.id, input.linkId),
            eq(links.sharedEntityId, input.entityId),
            eq(links.password, input.linkToken),
            gte(links.expiration, new Date()),
          ),
        });

        if (link) {
          isRequestValid = true;
        }
      }

      if (!isRequestValid) {
        if (ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "El usuario no tiene los permisos suficientes para ver esta cuenta",
          });
        } else {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "El usuario no está registrado o el link no es válido",
          });
        }
      }

      const selectedEntityObject = alias(entities, "selectedEntity");
      const otherEntityObject = alias(entities, "otherEntity");

      if (input.entityTag) {
        const allTags = await getAllTags(ctx.redis, ctx.db);
        const allChildrenTags = Array.from(getAllChildrenTags(input.entityTag, allTags))

        const balancesDat = await ctx.db
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
              typeof input.account === "boolean"
                ? eq(balances.account, input.account)
                : undefined,
              input.dayInPast
                ? lte(
                  balances.date,
                  moment(input.dayInPast, dateFormatting.day).startOf("day").toDate(),
                )
                : undefined,
            ),
          )
          .orderBy(
            balances.selectedEntityId,
            balances.otherEntityId,
            balances.account,
            balances.currency,
            desc(balances.date),
          );

        const balancesTransformed = balancesDat.map((b) => ({
          ...b.Balances,
          selectedEntity: b.selectedEntity!,
          otherEntity: b.otherEntity!,
        }));

        return balancesTransformed;
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
              or(
                eq(selectedEntityObject.id, input.entityId ?? 0),
                eq(otherEntityObject.id, input.entityId ?? 0),
              ),
              typeof input.account === "boolean"
                ? eq(balances.account, input.account)
                : undefined,
              input.dayInPast
                ? lte(
                  balances.date,
                  moment(input.dayInPast, dateFormatting.day).toDate(),
                )
                : undefined,
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

        return balancesTransformed;
      }
    }),
  getBalancesByEntitiesForCard: publicProcedure
    .input(
      z.object({
        entityId: z.number().int().optional().nullable(),
        entityTag: z.string().optional().nullable(),
        linkId: z.number().optional().nullable(),
        linkToken: z.string().optional().nullable(),
        dayInPast: z.string().optional(),
      }).superRefine((obj, ctx) => {
        if (!obj.entityId && !obj.entityTag) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Es necesario una entidad o un tag",
          })
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
        const allChildrenTags = Array.from(getAllChildrenTags(input.entityTag, allTags));

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
                : undefined,
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
              or(
                eq(selectedEntityObject.id, input.entityId ?? 0),
                eq(otherEntityObject.id, input.entityId ?? 0),
              ),
              input.dayInPast
                ? lte(
                  balances.date,
                  moment(input.dayInPast, dateFormatting.day).toDate(),
                )
                : undefined,
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
          .where(eq(operations.id, input.operationId)).orderBy(desc(movements.id));

        const mvsIds = movementsIds.length > 0 ? movementsIds.map(mv => mv.id) : [0]

        return await transaction.query.movements.findMany({
          where: inArray(
            movements.id,
            mvsIds,
          ),
          with: {
            transaction: {
              with: {
                fromEntity: true,
                toEntity: true,
              },
            },
          },
          orderBy: desc(movements.id)
        });
      });

      return response;
    }),
});
