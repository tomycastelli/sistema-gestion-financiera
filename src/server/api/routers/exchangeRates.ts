import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { toUTCMidnight } from "~/lib/functions";
import { exchangeRates } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  publicProcedure,
} from "../trpc";

export const exchangeRatesRouter = createTRPCRouter({
  getDateExchangeRates: publicProcedure
    .input(
      z.object({
        date: z.date().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.date) {
        return [];
      }
      const utcDate = toUTCMidnight(input.date);

      const exchangeRatesData = await ctx.db
        .select()
        .from(exchangeRates)
        .where(eq(exchangeRates.date, utcDate));

      return exchangeRatesData;
    }),
  getAllExchangeRates: publicProcedure
    .input(
      z.object({
        page: z.number().int(),
        currency: z.string().nullish(),
        fromDate: z.date().nullish(),
        toDate: z.date().nullish(),
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

      const utcFromDate = input.fromDate
        ? toUTCMidnight(input.fromDate)
        : undefined;
      const utcToDate = input.toDate ? toUTCMidnight(input.toDate) : undefined;

      const exchangeRatesData = await ctx.db
        .select()
        .from(exchangeRates)
        .where(
          and(
            input.currency
              ? eq(exchangeRates.currency, input.currency)
              : undefined,
            utcFromDate ? gte(exchangeRates.date, utcFromDate) : undefined,
            utcToDate ? lte(exchangeRates.date, utcToDate) : undefined,
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
            (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_EDIT",
          ) ?? false
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User is not authorized to upload exchange rates",
        });
      }

      const utcInput = input.map((item) => ({
        ...item,
        date: toUTCMidnight(item.date),
      }));

      await ctx.db
        .insert(exchangeRates)
        .values(utcInput)
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
            (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_EDIT",
          ) ?? false
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User is not authorized to upload exchange rates",
        });
      }

      const utcDate = toUTCMidnight(input.date);

      await ctx.db
        .update(exchangeRates)
        .set({ rate: input.rate })
        .where(
          and(
            eq(exchangeRates.currency, input.currency),
            eq(exchangeRates.date, utcDate),
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
      const utcDate = toUTCMidnight(input.date);

      await ctx.db
        .delete(exchangeRates)
        .where(
          and(
            eq(exchangeRates.currency, input.currency),
            eq(exchangeRates.date, utcDate),
          ),
        );
    }),
});
