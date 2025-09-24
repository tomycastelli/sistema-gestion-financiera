import { z } from "zod";
import { notificationService } from "~/lib/notifications";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const notificationsRouter = createTRPCRouter({
  getNotifications: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    return await notificationService.getNotifications(userId);
  }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    return await notificationService.getUnreadCount(userId);
  }),

  markAsViewed: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      await notificationService.markAsViewed(input.notificationId, userId);
      return { success: true };
    }),

  deleteNotification: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ input }) => {
      await notificationService.deleteNotification(input.notificationId);
      return { success: true };
    }),

  addNotification: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        link: z.string().optional(),
        userIds: z.array(z.string()),
        expiryDays: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const notificationId = await notificationService.addNotification(input);
      return { notificationId };
    }),
});
