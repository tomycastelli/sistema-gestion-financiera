import { z } from "zod";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  publicProcedure,
} from "../trpc";
import { TRPCError } from "@trpc/server";
import { exchangeRates } from "~/server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export const exchangeRatesRouter = createTRPCRouter({
  getDateExchangeRates: publicProcedure
    .input(
      z.object({
        date: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const exchangeRatesData = await ctx.db
        .select()
        .from(exchangeRates)
        .where(eq(exchangeRates.date, input.date));

      return exchangeRatesData;
    }),
  getAllExchangeRates: publicProcedure
    .input(
      z.object({
        page: z.number().int(),
        currency: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.page < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Page must be greater than 1 (was ${input.page})`,
        });
      }
      const pageSize = 30;

      const exchangeRatesData = await ctx.db
        .select()
        .from(exchangeRates)
        .where(
          and(
            input.currency
              ? eq(exchangeRates.currency, input.currency)
              : undefined,
          ),
        )
        .limit(pageSize)
        .offset((input.page - 1) * pageSize)
        .orderBy(desc(exchangeRates.date));

      return exchangeRatesData;
    }),

  getLatestExchangeRates: publicProcedure.query(async ({ ctx }) => {
    const rankedRates = ctx.db.$with("ranked_rates").as(
      ctx.db
        .select({
          currency: exchangeRates.currency,
          date: exchangeRates.date,
          rate: exchangeRates.rate,
          rn: sql`ROW_NUMBER() OVER (PARTITION BY ${exchangeRates.currency} ORDER BY ${exchangeRates.date} DESC)`.as(
            "rn",
          ),
        })
        .from(exchangeRates),
    );

    const latestRates = await ctx.db
      .with(rankedRates)
      .select({
        currency: rankedRates.currency,
        date: rankedRates.date,
        rate: rankedRates.rate,
      })
      .from(rankedRates)
      .where(sql`${rankedRates.rn} = 1`);

    return latestRates;
  }),
  addExchangeRates: protectedLoggedProcedure
    .input(
      z
        .object({
          currency: z.string(),
          date: z.date(),
          rate: z.number(),
        })
        .array(),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(
          ctx.user.permissions?.some(
            (p) => p.name === "ADMIN" || p.name === "EXCHANGERATES_CREATE",
          ) ?? false
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User is not authorized to upload exchange rates",
        });
      }

      await ctx.db
        .insert(exchangeRates)
        .values(input)
        .onConflictDoUpdate({
          target: [exchangeRates.currency, exchangeRates.date],
          set: { rate: sql.raw(`excluded.${exchangeRates.rate.name}`) },
        });
    }),
  editExchangeRate: protectedLoggedProcedure
    .input(
      z.object({
        currency: z.string(),
        date: z.date(),
        rate: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(
          ctx.user.permissions?.some(
            (p) => p.name === "ADMIN" || p.name === "EXCHANGERATES_CREATE",
          ) ?? false
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User is not authorized to upload exchange rates",
        });
      }

      await ctx.db
        .update(exchangeRates)
        .set({ rate: input.rate })
        .where(
          and(
            eq(exchangeRates.currency, input.currency),
            eq(exchangeRates.date, input.date),
          ),
        );
    }),
  deleteExchangeRate: protectedLoggedProcedure
    .input(
      z.object({
        currency: z.string(),
        date: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(exchangeRates)
        .where(
          and(
            eq(exchangeRates.currency, input.currency),
            eq(exchangeRates.date, input.date),
          ),
        );
    }),
});
