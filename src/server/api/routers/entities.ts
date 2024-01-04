import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import { PermissionsNames } from "~/lib/permissionsTypes";
import {
  getAllEntities,
  getAllPermissions,
  getAllTags,
} from "~/lib/trpcFunctions";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const entitiesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const entities = await getAllEntities(ctx.redis, ctx.db);

    return entities;
  }),

  getFiltered: protectedProcedure
    .input(z.object({ permissionName: z.enum(PermissionsNames) }))
    .query(async ({ ctx, input }) => {
      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        { userId: undefined },
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
        } else if (entity.name === ctx.session.user.name) {
          return true;
        }
      });

      return filteredEntities;
    }),

  addOne: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        tag: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const insertResponse = await ctx.db.entities.create({
        data: {
          name: input.name,
          tagName: input.tag,
        },
      });

      if (input.tag === "Usuario" && input.userId) {
        await ctx.db.user.update({
          where: {
            id: input.userId,
          },
          data: {
            entityId: insertResponse.id,
          },
        });
      }

      const newLog = new ctx.logs({
        name: "addOneEntity",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: insertResponse,
      });

      await newLog.save();

      await ctx.redis.del("cached_entities");
      return { message: "Entity added to database", data: insertResponse };
    }),
  deleteOne: protectedProcedure
    .input(z.object({ entityId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transactions.findFirst({
        where: {
          OR: [
            { fromEntityId: input.entityId },
            { toEntityId: input.entityId },
          ],
        },
      });

      if (!transaction) {
        const deleteResponse = await ctx.db.entities.delete({
          where: {
            id: input.entityId,
          },
        });

        await ctx.redis.del("cached_entities");

        const newLog = new ctx.logs({
          name: "deleteOneEntity",
          timestamp: new Date(),
          createdBy: ctx.session.user.id,
          input: input,
          output: deleteResponse,
        });

        await newLog.save();

        return deleteResponse;
      } else {
        throw new TRPCError({
          message: `La entidad tiene aunque sea una transacción (${transaction.id}) relacionada`,
          code: "CONFLICT",
        });
      }
    }),
  updateOne: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string(),
        tag: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updatedEntity = await ctx.db.entities.update({
        where: {
          id: input.id,
        },
        data: {
          name: input.name,
          tagName: input.tag,
        },
      });

      await ctx.redis.del("cached_entities");

      const newLog = new ctx.logs({
        name: "updateOneEntity",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: updatedEntity,
      });

      await newLog.save();

      return updatedEntity;
    }),
});
