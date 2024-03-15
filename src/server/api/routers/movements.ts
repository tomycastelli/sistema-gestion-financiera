import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import moment from "moment";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import {
  getAllEntities,
  getAllPermissions,
  getAllTags,
} from "~/lib/trpcFunctions";
import { dateFormatting } from "~/lib/variables";
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
      const whereConditions = [];

      let isRequestValid = false;

      if (ctx.user !== undefined) {
        isRequestValid = true;
      } else if (input.linkId && input.linkToken && input.sharedEntityId) {
        const link = await ctx.db.links.findUnique({
          where: {
            id: input.linkId,
            sharedEntityId: input.sharedEntityId,
            password: input.linkToken,
            expiration: {
              gte: new Date(),
            },
          },
        });

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

      if (input.entityId) {
        whereConditions.push({
          transaction: {
            currency: input.currency ? input.currency : {},
            OR: [
              {
                fromEntityId: input.entityId,
                toEntityId: input.toEntityId
                  ? input.toEntityId
                  : {
                      not: input.entityId,
                    },
              },
              {
                fromEntityId: input.toEntityId
                  ? input.toEntityId
                  : {
                      not: input.entityId,
                    },
                toEntityId: input.entityId,
              },
            ],
          },
        });
      } else if (input.entityTag) {
        const tags = await getAllTags(ctx.redis, ctx.db);
        const tagAndChildren = getAllChildrenTags(input.entityTag, tags);

        whereConditions.push({
          transaction: {
            currency: input.currency ? input.currency : {},
            OR: [
              {
                AND: [
                  { fromEntity: { tagName: { in: tagAndChildren } } },
                  {
                    toEntity: input.toEntityId
                      ? { id: input.toEntityId }
                      : { tagName: { notIn: tagAndChildren } },
                  },
                ],
              },
              {
                AND: [
                  {
                    fromEntity: input.toEntityId
                      ? { id: input.toEntityId }
                      : { tagName: { notIn: tagAndChildren } },
                  },
                  { toEntity: { tagName: { in: tagAndChildren } } },
                ],
              },
            ],
          },
        });
      }

      if (input.account !== null) {
        whereConditions.push({ account: input.account });
      }

      if (input.dayInPast) {
        whereConditions.push({
          OR: [
            {
              transaction: {
                date: {
                  lte: moment(input.dayInPast, dateFormatting.day)
                    .set({
                      hour: 23,
                      minute: 59,
                      second: 59,
                      millisecond: 999,
                    })
                    .toDate(),
                },
              },
            },
            {
              AND: [
                { transaction: { date: null } },
                {
                  transaction: {
                    operation: {
                      date: {
                        lte: moment(input.dayInPast, dateFormatting.day)
                          .set({
                            hour: 23,
                            minute: 59,
                            second: 59,
                            millisecond: 999,
                          })
                          .toDate(),
                      },
                    },
                  },
                },
              ],
            },
          ],
        });
      }
      if (input.fromDate && input.toDate) {
        whereConditions.push({
          OR: [
            {
              transaction: {
                date: {
                  gte: moment(input.fromDate)
                    .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                    .toDate(),
                  lte: moment(input.toDate)
                    .set({
                      hour: 23,
                      minute: 59,
                      second: 59,
                      millisecond: 999,
                    })
                    .toDate(),
                },
              },
            },
            {
              AND: [
                { transaction: { date: null } },
                {
                  transaction: {
                    operation: {
                      date: {
                        gte: moment(input.fromDate)
                          .set({
                            hour: 0,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                          })
                          .toDate(),
                        lte: moment(input.toDate)
                          .set({
                            hour: 23,
                            minute: 59,
                            second: 59,
                            millisecond: 999,
                          })
                          .toDate(),
                      },
                    },
                  },
                },
              ],
            },
          ],
        });
      } else if (input.fromDate && !input.toDate) {
        whereConditions.push({
          OR: [
            {
              transaction: {
                date: {
                  gte: moment(input.fromDate)
                    .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                    .toDate(),
                  lte: moment(input.fromDate)
                    .set({
                      hour: 0,
                      minute: 0,
                      second: 0,
                      millisecond: 0,
                    })
                    .add(1, "day")
                    .toDate(),
                },
              },
            },
            {
              AND: [
                { transaction: { date: null } },
                {
                  transaction: {
                    operation: {
                      date: {
                        gte: moment(input.fromDate)
                          .set({
                            hour: 0,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                          })
                          .toDate(),
                        lte: moment(input.fromDate)
                          .set({
                            hour: 0,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                          })
                          .add(1, "day")
                          .toDate(),
                      },
                    },
                  },
                },
              ],
            },
          ],
        });
      }

      const totalRows = await ctx.db.movements.count({
        where: {
          AND: whereConditions,
        },
      });

      const movements = await ctx.db.movements.findMany({
        where: {
          AND: whereConditions,
        },
        include: {
          transaction: {
            include: {
              operation: {
                select: {
                  id: true,
                  observations: true,
                  date: true,
                },
              },
              transactionMetadata: true,
              fromEntity: true,
              toEntity: true,
            },
          },
        },
        orderBy: [
          { transaction: { date: "desc" } },
          { transaction: { operation: { date: "desc" } } },
          { id: "desc" },
        ],
        take: input.pageSize,
        skip: (input.pageNumber - 1) * input.pageSize,
      });

      return { movements: movements, totalRows: totalRows };
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
      }),
    )
    .query(async ({ ctx, input }) => {
      let isRequestValid = false;

      if (ctx.user !== undefined) {
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
        }
      } else if (input.linkId && input.linkToken && input.entityId) {
        const link = await ctx.db.links.findUnique({
          where: {
            id: input.linkId,
            sharedEntityId: input.entityId,
            password: input.linkToken,
            expiration: {
              gte: new Date(),
            },
          },
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

      if (input.entityTag) {
        const allTags = await getAllTags(ctx.redis, ctx.db);
        const allChildrenTags = getAllChildrenTags(input.entityTag, allTags);

        const balances = await ctx.db.balances.findMany({
          where: {
            AND: [
              {
                OR: [
                  {
                    selectedEntity: { tagName: { in: allChildrenTags } },
                    otherEntity: { tagName: { notIn: allChildrenTags } },
                  },
                  {
                    selectedEntity: { tagName: { notIn: allChildrenTags } },
                    otherEntity: { tagName: { in: allChildrenTags } },
                  },
                ],
              },
              typeof input.account === "boolean"
                ? { account: input.account }
                : {},
              input.dayInPast
                ? {
                    date: {
                      lte: moment(input.dayInPast, dateFormatting.day).toDate(),
                    },
                  }
                : {},
            ],
          },
          orderBy: {
            date: "desc",
          },
          distinct: [
            "selectedEntityId",
            "otherEntityId",
            "account",
            "currency",
          ],
          include: {
            selectedEntity: true,
            otherEntity: true,
          },
        });
        return balances;
      } else if (input.entityId) {
        const balances = await ctx.db.balances.findMany({
          where: {
            AND: [
              {
                OR: [
                  { selectedEntityId: input.entityId },
                  { otherEntityId: input.entityId },
                ],
              },
              typeof input.account === "boolean"
                ? { account: input.account }
                : {},
              input.dayInPast
                ? {
                    date: {
                      lte: moment(input.dayInPast, dateFormatting.day).toDate(),
                    },
                  }
                : {},
            ],
          },
          orderBy: {
            date: "desc",
          },
          distinct: [
            "selectedEntityId",
            "otherEntityId",
            "account",
            "currency",
          ],
          include: {
            selectedEntity: true,
            otherEntity: true,
          },
        });
        return balances;
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
      }),
    )
    .query(async ({ ctx, input }) => {
      let isRequestValid = false;

      if (ctx.user !== undefined) {
        isRequestValid = true;
      } else if (input.linkId && input.linkToken && input.entityId) {
        const link = await ctx.db.links.findUnique({
          where: {
            id: input.linkId,
            sharedEntityId: input.entityId,
            password: input.linkToken,
            expiration: {
              gte: new Date(),
            },
          },
        });

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

      if (input.entityTag) {
        const allTags = await getAllTags(ctx.redis, ctx.db);
        const allChildrenTags = getAllChildrenTags(input.entityTag, allTags);

        const balances = await ctx.db.balances.findMany({
          where: {
            AND: [
              {
                OR: [
                  {
                    selectedEntity: { tagName: { in: allChildrenTags } },
                    otherEntity: { tagName: { notIn: allChildrenTags } },
                  },
                  {
                    selectedEntity: { tagName: { notIn: allChildrenTags } },
                    otherEntity: { tagName: { in: allChildrenTags } },
                  },
                ],
              },
              input.dayInPast
                ? {
                    date: {
                      lte: moment(input.dayInPast, dateFormatting.day).toDate(),
                    },
                  }
                : {},
            ],
          },
          orderBy: {
            date: "desc",
          },
          distinct: [
            "selectedEntityId",
            "otherEntityId",
            "account",
            "currency",
          ],
          include: {
            selectedEntity: true,
            otherEntity: true,
          },
        });

        const totalBalances: z.infer<typeof TotalBalanceSchema>[] =
          balances.reduce(
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
      } else if (input.entityId) {
        const balances = await ctx.db.balances.findMany({
          where: {
            AND: [
              {
                OR: [
                  { selectedEntityId: input.entityId },
                  { otherEntityId: input.entityId },
                ],
              },
              input.dayInPast
                ? {
                    date: {
                      lte: moment(input.dayInPast, dateFormatting.day).toDate(),
                    },
                  }
                : {},
            ],
          },
          orderBy: {
            date: "desc",
          },
          distinct: [
            "selectedEntityId",
            "otherEntityId",
            "account",
            "currency",
          ],
          include: {
            selectedEntity: true,
            otherEntity: true,
          },
        });

        const totalBalances: z.infer<typeof TotalBalanceSchema>[] =
          balances.reduce(
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

  getBalancesHistory: protectedProcedure
    .input(
      z.object({
        entityId: z.number().int().optional().nullish(),
        entityTag: z.string().optional().nullable(),
        timeRange: z.enum(["day", "week", "month", "year"]),
        currency: z.string().nullish(),
        dayInPast: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.currency) {
        return undefined;
      }
      const balancesSchema = z.object({
        account: z.boolean(),
        currency: z.string(),
        datestring: z.string(),
        balance: z.number(),
      });

      const transformedBalancesSchema = z.object({
        datestring: z.string(),
        cash: z.number(),
        current_account: z.number(),
      });

      if (input.entityId) {
        const balances: z.infer<typeof balancesSchema>[] = await ctx.db
          .$queryRaw`
            SELECT 
            account,
            currency,
            TO_CHAR(DATE_TRUNC(${input.timeRange}, date), ${
              dateFormatting[input.timeRange]
            }) AS datestring,
            SUM(CASE WHEN "selectedEntityId" = ${
              input.entityId
            } THEN balance ELSE -balance END) balance
            FROM "Balances"
            WHERE
            ("selectedEntityId" = ${input.entityId} OR "otherEntityId" = ${
              input.entityId
            })
            AND "currency" = ${input.currency}
            ${
              input.dayInPast
                ? Prisma.sql`AND date::date <= TO_DATE(${input.dayInPast}, 'DD-MM-YYYY')`
                : Prisma.sql``
            }
            GROUP BY 
            account,
            currency,
            datestring;
          `;

        const transformedBalances: z.infer<typeof transformedBalancesSchema>[] =
          balances.reduce(
            (acc, entry) => {
              const existingEntry = acc.find(
                (groupedEntry) => groupedEntry.datestring === entry.datestring,
              );

              if (existingEntry) {
                if (entry.account) {
                  existingEntry.cash = entry.balance;
                } else {
                  existingEntry.current_account = entry.balance;
                }
              } else {
                acc.push({
                  datestring: entry.datestring,
                  cash: entry.account ? entry.balance : 0,
                  current_account: entry.account ? 0 : entry.balance,
                });
              }

              return acc;
            },
            [] as z.infer<typeof transformedBalancesSchema>[],
          );

        return transformedBalances;
      } else if (input.entityTag) {
        const allTags = await getAllTags(ctx.redis, ctx.db);
        const allChildrenTags = getAllChildrenTags(input.entityTag, allTags);

        const balances: z.infer<typeof balancesSchema>[] = await ctx.db
          .$queryRaw`
        SELECT 
          account,
          currency,
          TO_CHAR(DATE_TRUNC(${Prisma.raw(
            `'${input.timeRange}'`,
          )}, date), ${Prisma.raw(
            `'${dateFormatting[input.timeRange]}'`,
          )}) AS datestring,
          SUM(CASE WHEN e."tagName" IN (${Prisma.join(
            allChildrenTags,
            ",",
          )}) THEN balance ELSE -balance END) balance
        FROM "Balances" b
        JOIN "Entities" e ON b."selectedEntityId" = e."id"
        JOIN "Entities" e2 ON b."otherEntityId" = e2."id"
        WHERE
          (
            (e."tagName" IN (${Prisma.join(
              allChildrenTags,
              ",",
            )}) AND e2."tagName" NOT IN (${Prisma.join(allChildrenTags, ",")}))
            OR
            (e2."tagName" IN (${Prisma.join(
              allChildrenTags,
              ",",
            )}) AND e."tagName" NOT IN (${Prisma.join(allChildrenTags, ",")}))
          )
          AND b."currency" = ${Prisma.raw(`'${input.currency}'`)}
          ${
            input.dayInPast
              ? Prisma.sql`AND date::date <= TO_DATE(${input.dayInPast}, 'DD-MM-YYYY')`
              : Prisma.sql``
          }
        GROUP BY 
          account,
          currency,
          datestring;
      `;

        const transformedBalances: z.infer<typeof transformedBalancesSchema>[] =
          balances.reduce(
            (acc, entry) => {
              const existingEntry = acc.find(
                (groupedEntry) => groupedEntry.datestring === entry.datestring,
              );

              if (existingEntry) {
                if (entry.account) {
                  existingEntry.cash = entry.balance;
                } else {
                  existingEntry.current_account = entry.balance;
                }
              } else {
                acc.push({
                  datestring: entry.datestring,
                  cash: entry.account ? entry.balance : 0,
                  current_account: entry.account ? 0 : entry.balance,
                });
              }

              return acc;
            },
            [] as z.infer<typeof transformedBalancesSchema>[],
          );

        return transformedBalances;
      }
    }),
  getMovementsByCurrency: protectedProcedure
    .input(
      z.object({
        currency: z.string().nullish(),
        entityId: z.number().int().optional(),
        entityTag: z.string().optional(),
        limit: z.number().int(),
        dayInPast: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = [];

      if (!input.currency) {
        return [];
      }

      if (input.entityId !== undefined) {
        whereConditions.push({
          transaction: {
            currency: input.currency,
            OR: [
              {
                fromEntityId: input.entityId,
                toEntityId: {
                  not: input.entityId,
                },
              },
              {
                fromEntityId: {
                  not: input.entityId,
                },
                toEntityId: input.entityId,
              },
            ],
          },
        });
      } else if (input.entityTag) {
        const tags = await getAllTags(ctx.redis, ctx.db);
        const tagAndChildren = getAllChildrenTags(input.entityTag, tags);

        whereConditions.push({
          transaction: {
            currency: input.currency,
            OR: [
              {
                AND: [
                  { fromEntity: { tagName: { in: tagAndChildren } } },
                  { toEntity: { tagName: { notIn: tagAndChildren } } },
                ],
              },
              {
                AND: [
                  { fromEntity: { tagName: { notIn: tagAndChildren } } },
                  { toEntity: { tagName: { in: tagAndChildren } } },
                ],
              },
            ],
          },
        });
      }

      if (input.dayInPast) {
        whereConditions.push({
          OR: [
            {
              transaction: {
                date: {
                  lte: moment(input.dayInPast, dateFormatting.day)
                    .set({
                      hour: 23,
                      minute: 59,
                      second: 59,
                      millisecond: 999,
                    })
                    .toDate(),
                },
              },
            },
            {
              AND: [
                { transaction: { date: null } },
                {
                  transaction: {
                    operation: {
                      date: {
                        lte: moment(input.dayInPast, dateFormatting.day)
                          .set({
                            hour: 23,
                            minute: 59,
                            second: 59,
                            millisecond: 999,
                          })
                          .toDate(),
                      },
                    },
                  },
                },
              ],
            },
          ],
        });
      }

      const movements = await ctx.db.movements.findMany({
        where: {
          AND: whereConditions,
        },
        include: {
          transaction: {
            include: {
              transactionMetadata: true,
              operation: {
                select: {
                  id: true,
                  observations: true,
                  date: true,
                },
              },
              fromEntity: true,
              toEntity: true,
            },
          },
        },
        orderBy: {
          id: "desc",
        },
        take: input.limit,
      });

      return movements;
    }),
  getMovementsByOpId: protectedProcedure
    .input(z.object({ operationId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const movements = await ctx.db.movements.findMany({
        where: {
          transaction: {
            operation: {
              id: input.operationId,
            },
          },
        },
        include: {
          transaction: {
            include: {
              fromEntity: true,
              toEntity: true,
            },
          },
        },
      });

      return movements;
    }),
});
