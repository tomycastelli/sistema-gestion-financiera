"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import LoadingAnimation from "./LoadingAnimation";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Icons } from "./ui/Icons";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";

interface Notification {
  id: string;
  timestamp: number;
  userIds: string[];
  message: string;
  link?: string;
  viewedAt?: number | null;
}

interface NotificationsPopoverProps {}

const NotificationRow = ({
  index,
  style,
  notifications,
  onNotificationClick,
}: RowComponentProps<{
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
}>) => {
  const notification = notifications[index];

  if (!notification) return null;

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60),
      );
      return `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  return (
    <div
      style={style}
      className={cn(
        "flex cursor-pointer items-start gap-3 border-b border-border/50 p-3 transition-colors hover:bg-accent/50",
      )}
      onClick={() => onNotificationClick(notification)}
    >
      <div
        className={cn(
          "mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary",
          notification.viewedAt && "bg-gray-600",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatTimestamp(notification.timestamp)}
        </p>
      </div>
    </div>
  );
};

export default function NotificationsPopover({}: NotificationsPopoverProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Get notifications when popover opens
  const {
    data: notifications,
    refetch: refetchNotifications,
    isLoading: isLoadingNotifications,
  } = api.notifications.getNotifications.useQuery(undefined, {
    enabled: isOpen, // Only fetch when manually triggered
    refetchInterval: 60_000,
  });

  // Get unread count
  const { data: unreadCount, refetch: refetchUnreadCount } =
    api.notifications.getUnreadCount.useQuery(undefined, {
      refetchInterval: 60_000,
      initialData: 0,
    });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      router.push(notification.link);
    }
    setIsOpen(false);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // When popover is closed, refetch notifications and reset unread count
      void refetchNotifications();
      void refetchUnreadCount();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Icons.notification className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Notificationes</h3>
        </div>
        <ScrollArea className="h-96">
          {isLoadingNotifications ? (
            <LoadingAnimation text="Cargando notificaciones" />
          ) : notifications && notifications.length > 0 ? (
            <List
              rowComponent={NotificationRow}
              rowCount={notifications.length}
              rowHeight={65}
              rowProps={{
                notifications,
                onNotificationClick: handleNotificationClick,
              }}
            />
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Icons.notification className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
