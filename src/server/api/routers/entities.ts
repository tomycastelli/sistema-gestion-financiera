import { TRPCError } from "@trpc/server";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import { PermissionsNames } from "~/lib/permissionsTypes";
import {
  deletePattern,
  getAllEntities,
  getAllPermissions,
  getAllTags,
  logIO,
} from "~/lib/trpcFunctions";

import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { entities, transactions } from "~/server/db/schema";

export const entitiesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const entities = await getAllEntities(ctx.redis, ctx.db);

    return entities;
  }),

  getFiltered: protectedProcedure
    .input(z.object({ permissionName: z.enum(PermissionsNames) }))
    .query(async ({ ctx, input }) => {
      const redisKey =
        "entities" + "|" + ctx.user.id + "|" + input.permissionName;
      const cachedFilteredString = await ctx.redis.get(redisKey);

      if (cachedFilteredString) {
        const parsedFilteredEntities: typeof entities =
          JSON.parse(cachedFilteredString);

        return parsedFilteredEntities;
      }

      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.user,
        ctx.db,
      );
      const tags = await getAllTags(ctx.redis, ctx.db);
      const entities = await getAllEntities(ctx.redis, ctx.db);

      const filteredEntities = entities.filter((entity) => {
        if (
          userPermissions?.find(
            (p) => p.name === "ADMIN" || p.name === input.permissionName,
          )
        ) {
          return true;
        } else if (
          userPermissions?.find(
            (p) =>
              p.name === `${input.permissionName}_SOME` &&
              (p.entitiesIds?.includes(entity.id) ||
                getAllChildrenTags(p.entitiesTags, tags).includes(
                  entity.tag.name,
                )),
          )
        ) {
          return true;
        } else if (entity.name === ctx.user.name) {
          return true;
        }
      });

      await ctx.redis.set(
        redisKey,
        JSON.stringify(filteredEntities),
        "EX",
        3600,
      );

      return filteredEntities;
    }),

  addOne: protectedLoggedProcedure
    .input(
      z
        .object({
          name: z.string(),
          tag: z.string(),
          sucursalOrigen: z.number().int().optional(),
          operadorAsociado: z.number().int().optional(),
        })
        .refine(
          (data) => {
            if (data.tag === "Clientes") {
              return data.sucursalOrigen && data.operadorAsociado;
            }
            return true;
          },
          {
            message:
              "El cliente debe tener una sucursal de origen y un operador asociado.",
          },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.user,
        ctx.db,
      );
      const tags = await getAllTags(ctx.redis, ctx.db);
      const hasPermissions = userPermissions?.map(
        (p) =>
          p.name === "ADMIN" ||
          p.name === "ENTITIES_MANAGE" ||
          (p.name === "ENTITIES_MANAGE_SOME" &&
            getAllChildrenTags(p.entitiesTags, tags).includes(input.tag)),
      );

      if (!hasPermissions) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "El usuario no tiene los permisos suficientes.",
        });
      }

      const [response] = await ctx.db
        .insert(entities)
        .values({
          name: input.name,
          tagName: input.tag,
          sucursalOrigen: input.sucursalOrigen,
          operadorAsociado: input.operadorAsociado,
        })
        .returning();

      if (!response) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The entity couldn't be added",
        });
      }

      await logIO(ctx.dynamodb, ctx.user.id, "Añadir entidad", input, response);

      await deletePattern(ctx.redis, "entities*");

      return response;
    }),
  deleteOne: protectedLoggedProcedure
    .input(z.object({ entityId: z.number().int(), tag: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.user,
        ctx.db,
      );
      const tags = await getAllTags(ctx.redis, ctx.db);
      const hasPermissions = userPermissions?.map(
        (p) =>
          p.name === "ADMIN" ||
          p.name === "ENTITIES_MANAGE" ||
          (p.name === "ENTITIES_MANAGE_SOME" &&
            (getAllChildrenTags(p.entitiesTags, tags).includes(input.tag) ||
              p.entitiesIds?.includes(input.entityId))),
      );

      if (!hasPermissions) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "El usuario no tiene los permisos suficientes.",
        });
      }

      const [transactionId] = await ctx.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          or(
            eq(transactions.fromEntityId, input.entityId),
            eq(transactions.toEntityId, input.entityId),
          ),
        )
        .limit(1);

      if (!transactionId) {
        const [response] = await ctx.db
          .delete(entities)
          .where(eq(entities.id, input.entityId))
          .returning();

        if (!response) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Entity ID was not found",
          });
        }

        await logIO(
          ctx.dynamodb,
          ctx.user.id,
          "Eliminar entidad",
          input,
          response,
        );

        await deletePattern(ctx.redis, "entities*");

        return response;
      } else {
        throw new TRPCError({
          message: `La entidad tiene aunque sea una transacción (ID: ${transactionId.id}) relacionada`,
          code: "CONFLICT",
        });
      }
    }),
  updateOne: protectedLoggedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string(),
        tagName: z.string(),
        sucursalOrigen: z.number().int().optional(),
        operadorAsociado: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.user,
        ctx.db,
      );
      const tags = await getAllTags(ctx.redis, ctx.db);
      const hasPermissions = userPermissions?.map(
        (p) =>
          p.name === "ADMIN" ||
          p.name === "ENTITIES_MANAGE" ||
          (p.name === "ENTITIES_MANAGE_SOME" &&
            (getAllChildrenTags(p.entitiesTags, tags).includes(
              input.tagName ?? "",
            ) ||
              p.entitiesIds?.includes(input.id))),
      );

      if (!hasPermissions) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "El usuario no tiene los permisos suficientes.",
        });
      }

      const [response] = await ctx.db
        .update(entities)
        .set({
          name: input.name,
          sucursalOrigen: input.sucursalOrigen,
          operadorAsociado: input.operadorAsociado,
        })
        .where(eq(entities.id, input.id))
        .returning();

      if (!response) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entity ID was not found",
        });
      }
      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Actualizar entidad",
        input,
        response,
      );

      await deletePattern(ctx.redis, "entities*");

      return response;
    }),
});
