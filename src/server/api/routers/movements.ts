import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, lte, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import moment from "moment";
import { z } from "zod";
import { currentAccountsProcedure } from "~/lib/currentAccountsProcedure";
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
  entityId: z.number().int().optional().nullish(),
  entityTag: z.string().optional().nullish(),
  originEntityId: z.number().int().optional().nullish(),
  toEntityId: z.number().int().optional().nullish(),
  currency: z.string().optional().nullish(),
  account: z.boolean(),
  fromDate: z.date().optional().nullish(),
  toDate: z.date().optional().nullish(),
  dayInPast: z.string().optional(),
  groupInTag: z.boolean().default(true),
  dateOrdering: z.enum(["asc", "desc"]).default("desc"),
  ignoreSameTag: z.boolean().default(false),
  balanceType: z.enum(["1", "2", "3", "4"]),
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
          account: z.boolean(),
          dayInPast: z.string().optional(),
          balanceType: z.enum(["1", "2", "3", "4"]),
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

      const entA = alias(entities, "ent_a");
      const entB = alias(entities, "ent_b");

      // Common query conditions
      const dateCondition = lte(balances.date, sql.placeholder("dateLimit"));

      const balancesQuery = ctx.db
        .selectDistinctOn([
          balances.tag,
          balances.ent_a,
          balances.ent_b,
          balances.account,
          balances.currency,
        ])
        .from(balances)
        .leftJoin(entA, eq(balances.ent_a, entA.id))
        .leftJoin(entB, eq(balances.ent_b, entB.id))
        .where(
          and(
            eq(balances.account, sql.placeholder("account")),
            dateCondition,
            eq(balances.type, sql.placeholder("balanceType")),
            input.entityId
              ? and(
                  input.balanceType === "1"
                    ? or(
                        eq(balances.ent_a, sql.placeholder("entityId")),
                        eq(balances.ent_b, sql.placeholder("entityId")),
                      )
                    : input.balanceType === "2"
                    ? eq(balances.ent_a, sql.placeholder("entityId"))
                    : // No tiene sentido el 3 o 4
                      undefined,
                )
              : undefined,
            input.entityTag
              ? and(
                  input.balanceType === "1"
                    ? or(
                        eq(entA.tagName, sql.placeholder("entityTag")),
                        eq(entB.tagName, sql.placeholder("entityTag")),
                      )
                    : input.balanceType === "2"
                    ? eq(entA.tagName, sql.placeholder("entityTag"))
                    : ["3", "4"].includes(input.balanceType)
                    ? and(
                        eq(balances.tag, sql.placeholder("entityTag")),
                        // For balance type 3, ignore balances between tag and ent_a of same tag we are querying
                        input.balanceType === "3"
                          ? not(eq(entA.tagName, sql.placeholder("entityTag")))
                          : undefined,
                      )
                    : undefined,
                )
              : undefined,
          ),
        )
        .orderBy(
          balances.tag,
          balances.ent_a,
          balances.ent_b,
          balances.account,
          balances.currency,
          desc(balances.date),
        )
        .prepare("balancesQuery");

      const balancesData = await balancesQuery.execute({
        account: input.account,
        balanceType: input.balanceType,
        entityId: input.entityId ?? 0,
        entityTag: input.entityTag ?? "",
        dateLimit: input.dayInPast
          ? moment(input.dayInPast, dateFormatting.day)
              .startOf("day")
              .toISOString()
          : new Date().toISOString(),
      });

      const mappedBalances = balancesData.map((b) => ({
        ...b.balances,
        ent_a: b.ent_a ?? null,
        ent_b: b.ent_b ?? null,
      }));

      return mappedBalances;
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
          .where(and(eq(operations.id, input.operationId)))
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
});
