import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "~/server/db";
import { notifications, notificationUsers } from "~/server/db/schema";

export interface Notification {
  id: string;
  timestamp: Date;
  message: string;
  link?: string;
  viewedAt?: Date | null;
}

export interface NotificationData {
  message: string;
  link?: string;
  userIds: string[];
  expiryDays?: number; // Default 14 days
}

export class NotificationService {
  private readonly DEFAULT_EXPIRY_DAYS = 14;
  private readonly MAX_NOTIFICATIONS_PER_USER = 100;

  /**
   * Add a new notification for multiple users
   * Uses PostgreSQL for persistent storage
   */
  async addNotification(data: NotificationData): Promise<string> {
    const notificationId = this.generateNotificationId();
    const timestamp = new Date();
    const expiryDays = data.expiryDays ?? this.DEFAULT_EXPIRY_DAYS;

    // Insert the notification
    await db.insert(notifications).values({
      id: notificationId,
      message: data.message,
      link: data.link,
      createdAt: timestamp,
      expiryDays,
    });

    // Insert user associations
    if (data.userIds.length > 0) {
      await db.insert(notificationUsers).values(
        data.userIds.map((userId) => ({
          notificationId,
          userId,
        })),
      );
    }

    return notificationId;
  }

  /**
   * Get notifications for a user, sorted by creation time descending
   * Returns the latest 100 notifications and marks unread ones as viewed
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    // Get notifications for the user, ordered by creation time descending
    const userNotifications = await db
      .select({
        id: notifications.id,
        message: notifications.message,
        link: notifications.link,
        createdAt: notifications.createdAt,
        viewedAt: notifications.viewedAt,
        expiryDays: notifications.expiryDays,
      })
      .from(notifications)
      .innerJoin(
        notificationUsers,
        eq(notifications.id, notificationUsers.notificationId),
      )
      .where(
        and(
          eq(notificationUsers.userId, userId),
          // Only get notifications that haven't expired
          sql`${notifications.createdAt} > NOW() - (${notifications.expiryDays} || ' days')::INTERVAL`,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(this.MAX_NOTIFICATIONS_PER_USER);

    if (userNotifications.length === 0) {
      return [];
    }

    const notificationsToMarkAsViewed: string[] = [];
    const now = new Date();

    // Convert to Notification interface and mark unread notifications for viewing
    const result: Notification[] = userNotifications.map((n) => {
      const notification: Notification = {
        id: n.id,
        timestamp: n.createdAt,
        message: n.message,
        link: n.link || undefined,
        viewedAt: n.viewedAt ? n.viewedAt : null,
      };

      // Mark for viewing if not already viewed
      if (!notification.viewedAt) {
        notification.viewedAt = now;
        notificationsToMarkAsViewed.push(n.id);
      }

      return notification;
    });

    // Mark notifications as viewed in batch
    if (notificationsToMarkAsViewed.length > 0) {
      await db
        .update(notifications)
        .set({ viewedAt: now })
        .where(inArray(notifications.id, notificationsToMarkAsViewed));
    }

    return result;
  }

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .innerJoin(
        notificationUsers,
        eq(notifications.id, notificationUsers.notificationId),
      )
      .where(
        and(
          eq(notificationUsers.userId, userId),
          sql`${notifications.viewedAt} IS NULL`,
          // Only count notifications that haven't expired
          sql`${notifications.createdAt} > NOW() - (${notifications.expiryDays} || ' days')::INTERVAL`,
        ),
      );

    return result[0]?.count || 0;
  }

  /**
   * Mark a specific notification as viewed
   */
  async markAsViewed(notificationId: string, _userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ viewedAt: new Date() })
      .where(eq(notifications.id, notificationId));
  }

  /**
   * Delete a notification (removes from all users)
   */
  async deleteNotification(notificationId: string): Promise<void> {
    // Delete user associations first (due to foreign key constraints)
    await db
      .delete(notificationUsers)
      .where(eq(notificationUsers.notificationId, notificationId));

    // Delete the notification
    await db.delete(notifications).where(eq(notifications.id, notificationId));
  }

  /**
   * Clean up expired notifications (can be called periodically)
   */
  async cleanupExpiredNotifications(): Promise<void> {
    // Delete expired notifications and their user associations
    const expiredNotifications = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        sql`${notifications.createdAt} <= NOW() - (${notifications.expiryDays} || ' days')::INTERVAL`,
      );

    if (expiredNotifications.length > 0) {
      const expiredIds = expiredNotifications.map((n) => n.id);

      // Delete user associations first
      await db
        .delete(notificationUsers)
        .where(inArray(notificationUsers.notificationId, expiredIds));

      // Delete the notifications
      await db
        .delete(notifications)
        .where(inArray(notifications.id, expiredIds));
    }
  }

  /**
   * Generate a unique notification ID using UUID v7
   */
  private generateNotificationId(): string {
    return uuidv7();
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    notificationId: string,
  ): Promise<Notification | null> {
    const notificationData = await db
      .select({
        id: notifications.id,
        message: notifications.message,
        link: notifications.link,
        createdAt: notifications.createdAt,
        viewedAt: notifications.viewedAt,
      })
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (notificationData.length === 0) {
      return null;
    }

    const notification = notificationData[0]!;

    return {
      id: notification.id,
      timestamp: notification.createdAt,
      message: notification.message,
      link: notification.link || undefined,
      viewedAt: notification.viewedAt ? notification.viewedAt : null,
    };
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();
