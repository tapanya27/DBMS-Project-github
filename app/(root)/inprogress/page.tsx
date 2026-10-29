"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, Loader2, Star } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Feedback, JobBids, User } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeJob,
  getAllFeedback,
  getUserDetails,
  getUserPostedJobs,
  giveFeedback,
} from "@/server";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";

export default function InProgressPage() {
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { toast } = useToast();
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
  const completeMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const result = await completeJob(jobId, userDetails?.[0]?.user_id as number);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postedJobs"] });
      toast({
        title: "Success",
        description: "Job marked as completed successfully",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: `Failed to mark job as completed`,
        variant: "destructive",
      });
    },
  });
  const { data: feedback, isLoading: isFeedbackLoading } = useQuery({
    queryKey: ["feedback"],
    queryFn: async () => {
      const result = await getAllFeedback();
      return result as Feedback[];
    },
  });
  const feedbackMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const result = await giveFeedback(
        jobId,
        userDetails?.[0].user_id as number,
        selectedJob.bids.filter((bid: any) => bid.status === "accepted")[0]
          .freelancer_id as number,
        rating
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["postedJobs"] });
      toast({
        title: "Success",
        description: "Feedback submitted successfully",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: `Failed to submit feedback`,
        variant: "destructive",
      });
    },
  });
  const handleOpenCompleteDialog = (job: any) => {
    setSelectedJob(job);
    setIsCompleteModalOpen(true);
  };

  const handleOpenFeedback = (job: any) => {
    setSelectedJob(job);
    setIsFeedbackModalOpen(true);
  };

  const activeJobs =
    postedJobs?.filter(
      (job) =>
        job.job_status === "in progress" || job.job_status === "completed"
    ) ?? [];

  if (userDetailsLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="section-y page-container">
      <div className="mb-8 space-y-2 sm:mb-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">In progress</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Complete work, message freelancers, and leave feedback.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeJobs.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
            <p className="font-medium">No active jobs</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Accept a bid to move a job here.
            </p>
          </div>
        ) : null}
        {activeJobs.map((job) => (
          <Card key={job.job_id} className="flex flex-col">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg break-words-safe">
                {job.title}
              </CardTitle>
              <CardDescription>
                {
                  job?.bids?.filter(
                    (bid: any) => bid.status === "accepted"
                  )[0]?.freelancer_name
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 text-sm">
              <p>
                Due{" "}
                {job.deadline
                  ? new Date(job.deadline).toLocaleDateString()
                  : "—"}
              </p>
              <p>Budget · {job.budget}</p>
              <p className="font-medium">
                Accepted bid ·{" "}
                {
                  job?.bids?.filter(
                    (bid: any) => bid.status === "accepted"
                  )[0]?.bid_amount ?? "—"
                }
              </p>
              <p className="text-muted-foreground">
                Bid placed{" "}
                {formatDateTime(
                  job?.bids?.find((bid: any) => bid.status === "accepted")
                    ?.created_at
                )}
              </p>
              <p className="line-clamp-3 text-muted-foreground break-words-safe">
                {job.description}
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              {job.job_status === "in progress" ? (
                <Button
                  variant="outline"
                  onClick={() => handleOpenCompleteDialog(job)}
                >
                  Complete
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Completed
                </div>
              )}
              <Button
                variant="secondary"
                onClick={() => router.push(`/messages?job=${job.job_id}`)}
              >
                Message
              </Button>
              {feedback?.filter((item) => item.job_id === job.job_id)
                .length === 0 ? (
                <Button onClick={() => handleOpenFeedback(job)}>
                  Feedback
                </Button>
              ) : (
                <span className="self-center text-sm text-muted-foreground">
                  Feedback sent
                </span>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
      <Dialog open={isCompleteModalOpen} onOpenChange={setIsCompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
            <DialogDescription>
              Are you satisfied with the project "{selectedJob?.title}" by{" "}
              {
                selectedJob?.bids.filter(
                  (bid: any) => bid.status === "accepted"
                )[0].freelancer_name
              }
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCompleteModalOpen(false)}
            >
              No, Keep in Progress
            </Button>
            <Button
              type="button"
              onClick={() => {
                completeMutation.mutate(selectedJob.job_id);
                setIsCompleteModalOpen(false);
                router.refresh();
              }}
            >
              Yes, Mark as Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <Dialog open={isFeedbackModalOpen} onOpenChange={setIsFeedbackModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Feedback</DialogTitle>
            <DialogDescription>
              Rate your experience and provide feedback for{" "}
              {
                selectedJob?.bids.filter(
                  (bid: any) => bid.status === "accepted"
                )[0].freelancer_name
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-8 h-8 cursor-pointer ${
                    star <= rating
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-gray-300"
                  }`}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                feedbackMutation.mutate(selectedJob.job_id);
                setIsFeedbackModalOpen(false);
                router.refresh();
              }}
              disabled={rating === 0}
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
