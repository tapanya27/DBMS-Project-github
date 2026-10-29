"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
} from "@/server";
import { cn } from "@/lib/utils";

type NotificationRow = {
  notification_id: number;
  type: string;
  title: string;
  body: string;
  job_id: number | null;
  is_read: boolean;
  created_at: string | Date;
};

export default function NotificationsMenu({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => getUnreadNotificationCount(),
    enabled,
    refetchInterval: 10000,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await getNotifications()) as NotificationRow[],
    enabled,
  });

  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications-unread"] });
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const prevUnread = queryClient.getQueryData<number>([
        "notifications-unread",
      ]);
      const prevList = queryClient.getQueryData<NotificationRow[]>([
        "notifications",
      ]);
      queryClient.setQueryData(["notifications-unread"], 0);
      queryClient.setQueryData<NotificationRow[]>(["notifications"], (old) =>
        (old ?? []).map((item) => ({ ...item, is_read: true }))
      );
      return { prevUnread, prevList };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevUnread !== undefined) {
        queryClient.setQueryData(["notifications-unread"], ctx.prevUnread);
      }
      if (ctx?.prevList) {
        queryClient.setQueryData(["notifications"], ctx.prevList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  if (!enabled) return null;

  return (
    <HoverCard
      openDelay={100}
      onOpenChange={(open) => {
        if (open && unread > 0 && !markRead.isPending) {
          markRead.mutate();
        }
      }}
    >
      <HoverCardTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate()}
          >
            Mark as read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!notifications.length ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            notifications.slice(0, 12).map((item) => (
              <div
                key={item.notification_id}
                className={cn(
                  "border-b px-3 py-2 text-sm last:border-0",
                  !item.is_read && "bg-accent/40"
                )}
              >
                <div className="font-medium">{item.title}</div>
                <div className="text-muted-foreground">{item.body}</div>
                {item.job_id ? (
                  <Link
                    href={
                      item.type === "message"
                        ? `/messages?job=${item.job_id}`
                        : `/jobs/${item.job_id}`
                    }
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
