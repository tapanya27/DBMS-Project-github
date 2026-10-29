"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  acceptBid,
  getAllFeedback,
  getAppliedJobs,
  getUserDetails,
  getUserPostedJobs,
  rejectBid,
} from "@/server";
import { Loader2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Bid, Feedback, JobBids, User, userBids } from "@/types";
import { toast } from "@/hooks/use-toast";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
} from "@/components/page-shell";
import { formatDateTime } from "@/lib/datetime";

export default function UserJobsPage() {
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const { user } = useUser();

  const handleViewJob = (job: any) => {
    setSelectedJob(job);
    setIsViewModalOpen(true);
  };
  const { data: userDetails, isLoading: userDetailsLoading } = useQuery<User[]>(
    {
      queryKey: ["user"],
      queryFn: async () => {
        const result = await getUserDetails(
          user?.emailAddresses[0].emailAddress as string
        );
        return result as User[];
      },
      enabled: !!user?.emailAddresses[0].emailAddress,
    }
  );
  const rejectMutation = useMutation({
    mutationFn: async (bidId: number) => {
      const result = await rejectBid(bidId, userDetails?.[0]?.user_id as number);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bid rejected successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject bid",
        variant: "destructive",
      });
    },
  });
  const acceptMutation = useMutation({
    mutationFn: async (bidId: number) => {
      const result = await acceptBid(bidId, userDetails?.[0]?.user_id as number);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bid accepted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept bid",
        variant: "destructive",
      });
    },
  });
  const { data: postedJobs, isLoading: isPostedJobsLoading } = useQuery({
    queryKey: ["postedJobs"],
    queryFn: async () => {
      const result = await getUserPostedJobs(
        userDetails?.[0].user_id as number
      );
      return result as JobBids[];
    },
    enabled: !!userDetails?.[0]?.user_id,
  });
  const handleManageJob = (job: any) => {
    setSelectedJob(job);
    setIsManageModalOpen(true);
  };
  const { data: feedback } = useQuery({
    queryKey: ["feedback"],
    queryFn: async () => {
      const result = await getAllFeedback();
      return result as Feedback[];
    },
    enabled: !!userDetails?.[0]?.user_id,
  });
  const feedbackFor = (jobId: number) =>
    feedback?.find(
      (item) =>
        Number(item.job_id) === Number(jobId) &&
        Number(item.to_user_id) === Number(userDetails?.[0]?.user_id)
    );
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const result = await getAppliedJobs(userDetails?.[0].user_id as number);
      return result as userBids[];
    },
    enabled: !!userDetails?.[0]?.user_id,
  });
  const [activeTab, setActiveTab] = useState(
    userDetails?.[0]?.role === "freelancer" ? "applied" : "posted"
  );
  useEffect(() => {
    if (userDetails?.[0]?.role) {
      setActiveTab(userDetails[0].role === "freelancer" ? "applied" : "posted");
    }
  }, [userDetails]);
  const role = userDetails?.[0]?.role;
  const isFreelancer = role === "freelancer";

  if (userDetailsLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description={
          isFreelancer
            ? "Track applications, bid status, and client feedback."
            : "Manage posted jobs and review bids."
        }
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList
              className={`grid w-full ${
                isFreelancer ? "grid-cols-2" : "grid-cols-1 max-w-xs"
              }`}
            >
              {isFreelancer && (
                <TabsTrigger value="applied">Applied</TabsTrigger>
              )}
              <TabsTrigger value="posted">
                {isFreelancer ? "Posted" : "My jobs"}
              </TabsTrigger>
            </TabsList>
            {isFreelancer && (
              <TabsContent value="applied" className="mt-6">
                {isLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : data && data.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.map((job: userBids) => (
                      <Card key={job.job_id}>
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-lg break-words-safe">
                              {job.title}
                            </CardTitle>
                            <StatusBadge status={job.bid_status || "pending"} />
                          </div>
                          <CardDescription>
                            Feedback:{" "}
                            {feedbackFor(job.job_id)
                              ? `${feedbackFor(job.job_id)?.rating} / 5`
                              : "None yet"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          <p>Budget · {job.budget}</p>
                          <p className="text-muted-foreground">
                            Due{" "}
                            {job.deadline
                              ? new Date(job.deadline).toLocaleDateString()
                              : "—"}
                          </p>
                        </CardContent>
                        <CardFooter>
                          <Button
                            variant="outline"
                            onClick={() => handleViewJob(job)}
                          >
                            Details
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No applications yet"
                    description="Browse open jobs and place a bid to get started."
                  />
                )}
              </TabsContent>
            )}
            <TabsContent value="posted" className="mt-6">
              {isPostedJobsLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : postedJobs && postedJobs.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {postedJobs.map((job) => (
                    <Card key={job.job_id}>
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-lg break-words-safe">
                            {job.title}
                          </CardTitle>
                          <StatusBadge status={job.job_status} />
                        </div>
                        <CardDescription>
                          {(job.bids ?? []).filter(Boolean).length} bid
                          {(job.bids ?? []).filter(Boolean).length === 1
                            ? ""
                            : "s"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p>Budget · {job.budget}</p>
                        {(() => {
                          const accepted = (job.bids ?? []).find(
                            (bid: Bid) => bid?.status === "accepted"
                          );
                          return accepted ? (
                            <p className="font-medium">
                              Accepted bid · {accepted.bid_amount}
                            </p>
                          ) : null;
                        })()}
                        <p className="text-muted-foreground">
                          Due{" "}
                          {job.deadline
                            ? new Date(job.deadline).toLocaleDateString()
                            : "—"}
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="outline"
                          onClick={() => handleManageJob(job)}
                        >
                          Manage bids
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No posted jobs"
                  description={
                    isFreelancer
                      ? "Switch to a client role to post jobs."
                      : "Post a job to start receiving bids."
                  }
                />
              )}
            </TabsContent>
          </Tabs>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words-safe">
              {selectedJob?.title}
            </DialogTitle>
            <DialogDescription>Application details</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3 text-sm">
            <p className="break-words-safe text-muted-foreground">
              {selectedJob?.description}
            </p>
            <p>Budget · {selectedJob?.budget}</p>
            <p className="text-muted-foreground">
              Due{" "}
              {selectedJob?.deadline
                ? new Date(selectedJob.deadline).toLocaleDateString()
                : "—"}
            </p>
            <p>
              Bid status ·{" "}
              {selectedJob?.bid_status ? selectedJob.bid_status : "Pending"}
            </p>
            <p>Your bid · {selectedJob?.bid_amount}</p>
            <p>
              Client feedback ·{" "}
              {selectedJob
                ? feedbackFor(selectedJob.job_id)
                  ? `${feedbackFor(selectedJob.job_id)?.rating} / 5`
                  : "None yet"
                : "None yet"}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Job Modal */}
      <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
            <DialogDescription>Review and act on bids</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-1 text-sm">
            <p className="break-words-safe text-muted-foreground">
              {selectedJob?.description}
            </p>
            <p>Budget · {selectedJob?.budget}</p>
            <p className="text-muted-foreground">
              Due{" "}
              {selectedJob?.deadline
                ? new Date(selectedJob.deadline).toLocaleDateString()
                : "—"}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bidder</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedJob?.bids?.map((bid: Bid) => (
                  <TableRow key={bid.bid_id}>
                    <TableCell className="break-words-safe">
                      {bid?.freelancer_name}
                    </TableCell>
                    <TableCell>{bid?.bid_amount}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(bid?.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={bid?.status || "pending"} />
                    </TableCell>
                    <TableCell>
                      {bid?.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acceptMutation.mutate(bid.bid_id)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rejectMutation.mutate(bid.bid_id)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
