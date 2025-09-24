import { v7 as uuidv7 } from "uuid";
import { redis } from "~/server/redis";

export interface Notification {
  id: string;
  timestamp: number;
  userIds: string[];
  message: string;
  link?: string;
  viewedAt?: number | null;
}

export interface NotificationData {
  message: string;
  link?: string;
  userIds: string[];
  expiryDays?: number; // Default 30 days
}

export class NotificationService {
  private readonly NOTIFICATION_PREFIX = "notification:";
  private readonly USER_NOTIFICATIONS_PREFIX = "user_notifications:";
  private readonly DEFAULT_EXPIRY_DAYS = 7;

  /**
   * Add a new notification for multiple users
   * Uses Redis Sorted Sets for efficient storage and retrieval
   */
  async addNotification(data: NotificationData): Promise<string> {
    const notificationId = this.generateNotificationId();
    const timestamp = Date.now();
    const expiryDays = data.expiryDays ?? this.DEFAULT_EXPIRY_DAYS;
    const expirySeconds = expiryDays * 24 * 60 * 60; // Convert days to seconds

    const notification: Notification = {
      id: notificationId,
      timestamp,
      userIds: data.userIds,
      message: data.message,
      link: data.link,
      viewedAt: null,
    };

    // Store the notification data as a hash
    const notificationKey = `${this.NOTIFICATION_PREFIX}${notificationId}`;
    await redis.hset(notificationKey, {
      id: notification.id,
      timestamp: notification.timestamp.toString(),
      userIds: JSON.stringify(notification.userIds),
      message: notification.message,
      link: notification.link ?? "",
      viewedAt: "",
    });

    // Set expiry for the notification data
    await redis.expire(notificationKey, expirySeconds);

    // Add notification to each user's sorted set (using timestamp as score for sorting)
    const pipeline = redis.pipeline();

    for (const userId of data.userIds) {
      const userNotificationsKey = `${this.USER_NOTIFICATIONS_PREFIX}${userId}`;
      pipeline.zadd(userNotificationsKey, timestamp, notificationId);
      pipeline.expire(userNotificationsKey, expirySeconds);
    }

    await pipeline.exec();

    return notificationId;
  }

  /**
   * Get all notifications for a user, sorted by timestamp descending
   * Automatically marks notifications as viewed after retrieval
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    const userNotificationsKey = `${this.USER_NOTIFICATIONS_PREFIX}${userId}`;

    // Get notification IDs sorted by timestamp (descending)
    const notificationIds = await redis.zrevrange(userNotificationsKey, 0, -1);

    if (notificationIds.length === 0) {
      return [];
    }

    // Fetch notification data for all IDs
    const pipeline = redis.pipeline();
    for (const notificationId of notificationIds) {
      pipeline.hgetall(`${this.NOTIFICATION_PREFIX}${notificationId}`);
    }

    const results = await pipeline.exec();
    const notifications: Notification[] = [];
    const now = Date.now();

    // Process results and mark as viewed
    const markAsViewedPipeline = redis.pipeline();

    for (let i = 0; i < notificationIds.length; i++) {
      const notificationData = results?.[i]?.[1] as Record<
        string,
        string
      > | null;

      if (notificationData && Object.keys(notificationData).length > 0) {
        const notification: Notification = {
          id: notificationData.id!,
          timestamp: parseInt(notificationData.timestamp!),
          userIds: JSON.parse(notificationData.userIds!),
          message: notificationData.message!,
          link: notificationData.link || undefined,
          viewedAt: notificationData.viewedAt
            ? parseInt(notificationData.viewedAt)
            : null,
        };

        // Mark as viewed if not already viewed
        if (!notification.viewedAt) {
          notification.viewedAt = now;
          const notificationKey = `${this.NOTIFICATION_PREFIX}${notification.id}`;
          markAsViewedPipeline.hset(
            notificationKey,
            "viewedAt",
            now.toString(),
          );
        }

        notifications.push(notification);
      } else {
        // Clean up orphaned notification IDs from user's set
        markAsViewedPipeline.zrem(userNotificationsKey, notificationIds[i]!);
      }
    }

    // Execute the mark as viewed operations
    if (markAsViewedPipeline.length > 0) {
      await markAsViewedPipeline.exec();
    }

    return notifications;
  }

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const userNotificationsKey = `${this.USER_NOTIFICATIONS_PREFIX}${userId}`;
    const notificationIds = await redis.zrevrange(userNotificationsKey, 0, -1);

    if (notificationIds.length === 0) {
      return 0;
    }

    let unreadCount = 0;
    const pipeline = redis.pipeline();

    for (const notificationId of notificationIds) {
      pipeline.hget(`${this.NOTIFICATION_PREFIX}${notificationId}`, "viewedAt");
    }

    const results = await pipeline.exec();

    for (const result of results || []) {
      const viewedAt = result?.[1] as string | null;
      if (!viewedAt || viewedAt === "") {
        unreadCount++;
      }
    }

    return unreadCount;
  }

  /**
   * Mark a specific notification as viewed
   */
  async markAsViewed(notificationId: string, _userId: string): Promise<void> {
    const notificationKey = `${this.NOTIFICATION_PREFIX}${notificationId}`;
    const now = Date.now();

    await redis.hset(notificationKey, "viewedAt", now.toString());
  }

  /**
   * Delete a notification (removes from all users)
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const notificationKey = `${this.NOTIFICATION_PREFIX}${notificationId}`;

    // Get the notification data to find all users
    const notificationData = await redis.hgetall(notificationKey);

    if (Object.keys(notificationData).length > 0) {
      const userIds = JSON.parse(notificationData.userIds!);

      // Remove from each user's notification set
      const pipeline = redis.pipeline();
      for (const userId of userIds) {
        const userNotificationsKey = `${this.USER_NOTIFICATIONS_PREFIX}${userId}`;
        pipeline.zrem(userNotificationsKey, notificationId);
      }

      // Delete the notification data
      pipeline.del(notificationKey);

      await pipeline.exec();
    }
  }

  /**
   * Clean up expired notifications (can be called periodically)
   */
  async cleanupExpiredNotifications(): Promise<void> {
    // Redis TTL handles automatic cleanup, but this method can be used
    // for additional cleanup if needed
    const pattern = `${this.NOTIFICATION_PREFIX}*`;
    const keys = await redis.keys(pattern);

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // Key exists but has no expiry, set default expiry
        await redis.expire(key, this.DEFAULT_EXPIRY_DAYS * 24 * 60 * 60);
      }
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
    const notificationKey = `${this.NOTIFICATION_PREFIX}${notificationId}`;
    const notificationData = await redis.hgetall(notificationKey);

    if (Object.keys(notificationData).length === 0) {
      return null;
    }

    return {
      id: notificationData.id!,
      timestamp: parseInt(notificationData.timestamp!),
      userIds: JSON.parse(notificationData.userIds!),
      message: notificationData.message!,
      link: notificationData.link || undefined,
      viewedAt: notificationData.viewedAt
        ? parseInt(notificationData.viewedAt)
        : null,
    };
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();
