"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, PageShell } from "@/components/page-shell";
import { getJobMessages, getMessageThreads, sendJobMessage } from "@/server";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/datetime";

type Thread = {
  job_id: number;
  title: string;
  status: string;
  company_name: string;
  freelancer_name: string;
  other_party_name: string;
  other_party_id: number;
  my_role: "client" | "freelancer";
};

type ChatMessage = {
  message_id: number;
  body: string;
  sender_name: string;
  created_at: string | Date;
  mine: boolean;
};

function MessagesPage() {
  const searchParams = useSearchParams();
  const initialJob = Number(searchParams.get("job") || 0) || null;
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJob);
  const [draft, setDraft] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ["message-threads"],
    queryFn: async () => (await getMessageThreads()) as Thread[],
  });

  const isFreelancer = threads?.some((t) => t.my_role === "freelancer") ?? false;

  useEffect(() => {
    if (!selectedJobId && threads?.[0]?.job_id) {
      setSelectedJobId(Number(threads[0].job_id));
    }
  }, [selectedJobId, threads]);

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["job-messages", selectedJobId],
    queryFn: async () =>
      (await getJobMessages(selectedJobId as number)) as ChatMessage[],
    enabled: !!selectedJobId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId) throw new Error("Select a company conversation");
      return sendJobMessage(selectedJobId, draft);
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({
        queryKey: ["job-messages", selectedJobId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const active = useMemo(
    () =>
      threads?.find(
        (thread) => Number(thread.job_id) === Number(selectedJobId)
      ),
    [threads, selectedJobId]
  );

  if (threadsLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Messages"
        description={
          isFreelancer
            ? "Choose a company to chat with. Messages go only to that company’s portal for the selected job."
            : "Chat with freelancers on jobs after a bid is accepted."
        }
      />

      {!threads?.length ? (
        <EmptyState
          title="No conversations yet"
          description="Accept a bid or wait for acceptance to start messaging."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">
                {isFreelancer ? "Companies" : "Conversations"}
              </CardTitle>
              {isFreelancer ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Select which company to message
                  </p>
                  <Select
                    value={selectedJobId ? String(selectedJobId) : undefined}
                    onValueChange={(value) => setSelectedJobId(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose company" />
                    </SelectTrigger>
                    <SelectContent>
                      {threads.map((thread) => (
                        <SelectItem
                          key={thread.job_id}
                          value={String(thread.job_id)}
                        >
                          {thread.company_name} — {thread.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.job_id}
                  type="button"
                  onClick={() => setSelectedJobId(Number(thread.job_id))}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    Number(selectedJobId) === Number(thread.job_id)
                      ? "border-primary bg-accent"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="font-medium break-words-safe">
                    {isFreelancer ? thread.company_name : thread.other_party_name}
                  </div>
                  <div className="text-muted-foreground break-words-safe">
                    {thread.title}
                  </div>
                  {isFreelancer ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Only this company receives your messages
                    </div>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="flex min-h-[28rem] flex-col">
            <CardHeader>
              <CardTitle className="text-base break-words-safe">
                {active
                  ? isFreelancer
                    ? active.company_name
                    : active.title
                  : "Select a conversation"}
              </CardTitle>
              <CardDescription>
                {active
                  ? isFreelancer
                    ? `Job: ${active.title} · Messages deliver only to ${active.company_name}`
                    : `With ${active.other_party_name}`
                  : isFreelancer
                    ? "Choose a company first"
                    : "Choose a job on the left"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-3">
                {messagesLoading && selectedJobId ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                {!messagesLoading && selectedJobId && !messages?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No messages yet.
                  </p>
                ) : null}
                {messages?.map((message) => (
                  <div
                    key={message.message_id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm break-words-safe",
                      message.mine
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs opacity-80">
                      <span>{message.sender_name}</span>
                      <span>{formatDateTime(message.created_at)}</span>
                    </div>
                    <div>{message.body}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    selectedJobId
                      ? isFreelancer
                        ? `Message ${active?.company_name ?? "company"}…`
                        : "Write a message..."
                      : "Select a company first"
                  }
                  disabled={!selectedJobId || sendMutation.isPending}
                  className="min-h-[88px]"
                />
                <Button
                  type="button"
                  className="sm:self-end"
                  disabled={
                    !selectedJobId || !draft.trim() || sendMutation.isPending
                  }
                  onClick={() => sendMutation.mutate()}
                >
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}

export default function MessagesPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MessagesPage />
    </Suspense>
  );
}
