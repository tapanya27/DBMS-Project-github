"use client";
import { useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bid, Job, User } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptBid,
  createBid,
  deleteBid,
  getJobById,
  getJobs,
  getUserDetails,
  rejectBid,
  updateBidAmount,
} from "@/server";
import { Edit, Loader2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
const PageJob = () => {
  const { user } = useUser();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const result = await getJobs();
      return result as Job[];
    },
  });
  const { data: userDetails, isLoading: isLoadingUserDetails } = useQuery<
    User[]
  >({
    queryKey: ["userDetails"],
    queryFn: async () => {
      const result = await getUserDetails(
        user?.emailAddresses[0].emailAddress!
      );
      return result as User[];
    },
    enabled: !!user?.emailAddresses[0].emailAddress,
  });
  const jobId = parseInt(id as string);
  const job = data?.find((j) => j.job_id === jobId);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [editingBidId, setEditingBidId] = useState<number | null>(null);
  const [editBidAmount, setEditBidAmount] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const [deletingBidId, setDeletingBidId] = useState<number | null>(null);
  const { data: bids, isLoading: isLoadingBids } = useQuery<Bid[]>({
    queryKey: ["bids", jobId],
    queryFn: async () => {
      const result = await getJobById(jobId);
      return result as Bid[];
    },
    enabled: !!job,
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await createBid(
        job?.job_id!,
        userDetails?.[0].user_id!,
        Number(bidAmount)
      );
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bid submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: `Failed to submit bid`,
        variant: "destructive",
      });
    },
  });
  const delMutation = useMutation({
    mutationFn: async (bidId: number) => {
      const result = await deleteBid(bidId);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bid deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      setDeletingBidId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: `Failed to delete bid`,
        variant: "destructive",
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (data: { bidId: number; amount: number }) => {
      const result = await updateBidAmount(data.bidId, data.amount);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bid updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      router.refresh();
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: `Failed to update bid`,
        variant: "destructive",
      });
    },
  });
  const handleEditBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBidId) {
      updateMutation.mutate({
        bidId: editingBidId,
        amount: Number(editBidAmount),
      });
      setEditingBidId(null);
    }
  };

  const confirmDeleteBid = async () => {
    if (deletingBidId) {
      delMutation.mutate(deletingBidId);
      console.log(`Deleting bid ${deletingBidId}`);
      setDeletingBidId(null);
      router.refresh();
    }
  };
  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
    setIsBidModalOpen(false);
    router.refresh();
  };
  const isJobOwner =
    Number(userDetails?.[0]?.user_id) === Number(job?.client_id);
  const acceptMutation = useMutation({
    mutationFn: async (bidId: number) =>
      acceptBid(bidId, userDetails?.[0]?.user_id as number),
    onSuccess: () => {
      toast({
        title: "Bid accepted",
        description: "This job is now in progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["postedJobs"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept bid",
        variant: "destructive",
      });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: async (bidId: number) =>
      rejectBid(bidId, userDetails?.[0]?.user_id as number),
    onSuccess: () => {
      toast({
        title: "Bid rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject bid",
        variant: "destructive",
      });
    },
  });
  const handleApplyClick = () => {
    if (!userDetails?.[0]) {
      toast({
        title: "Finish your profile",
        description: "Choose client or freelancer on your profile before applying.",
      });
      router.push("/profile");
      return;
    }
    if (userDetails[0].role === "client") {
      setIsAlertOpen(true);
    } else {
      setIsBidModalOpen(true);
    }
  };
  if (isLoading || isLoadingUserDetails) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="section-y page-container">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl break-words-safe sm:text-3xl">
                {job?.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Posted by {job?.client_name}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground break-words-safe">
                {job?.description}
              </p>
              <div>
                <h3 className="mb-2 text-sm font-medium">Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(job?.skills_required ?? []).filter(Boolean).map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <p className="font-medium">Budget · {job?.budget}</p>
                <p className="text-muted-foreground">
                  Due{" "}
                  {job?.deadline
                    ? new Date(job.deadline).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              {isJobOwner ? (
                <Button className="w-full" onClick={handleApplyClick} disabled>
                  You can&apos;t apply to your own job
                </Button>
              ) : job?.status === "in progress" ? (
                <Button className="w-full" disabled>
                  Job already in progress
                </Button>
              ) : job?.status === "completed" ? (
                <Button className="w-full" disabled>
                  Job completed
                </Button>
              ) : (
                <Button className="w-full" onClick={handleApplyClick}>
                  Apply for this job
                </Button>
              )}
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {isJobOwner ? "Bids" : "Your bid"}
              </CardTitle>
              {!isJobOwner ? (
                <p className="text-sm text-muted-foreground">
                  Bid status for this job is only visible to the company that
                  posted it.
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              {isLoadingBids ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isJobOwner && bids && bids.length > 0 ? (
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
                    {bids?.map((bid) => (
                      <TableRow key={bid.bid_id}>
                        <TableCell>{bid.freelancer_name}</TableCell>
                        <TableCell>{bid.bid_amount}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(bid.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              bid.status === "accepted" ? "outline" : "default"
                            }
                          >
                            {bid.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                          {isJobOwner && bid.status === "pending" && (
                            <>
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
                            </>
                          )}
                          {bid.freelancer_name === userDetails?.[0]?.name &&
                            bid.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingBidId(bid.bid_id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingBidId(bid.bid_id);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : !isJobOwner && bids && bids.length > 0 ? (
                <div className="space-y-2 rounded-lg border p-4 text-sm">
                  <p>
                    <span className="font-medium">Amount · </span>
                    {bids[0].bid_amount}
                  </p>
                  <p className="text-muted-foreground">
                    Submitted · {formatDateTime(bids[0].created_at)}
                  </p>
                  <p>
                    <span className="font-medium">Status · </span>
                    {bids[0].status}
                  </p>
                  {bids[0].status === "pending" ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingBidId(bids[0].bid_id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Withdraw
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingBidId(bids[0].bid_id)}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Edit amount
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : isJobOwner ? (
                <p className="text-center text-sm text-muted-foreground">
                  No bids yet.
                </p>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  You have not placed a bid on this job yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Action Not Allowed</AlertDialogTitle>
              <AlertDialogDescription>
                Applying to jobs is not available for clients. Only freelancers
                can apply for jobs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setIsAlertOpen(false)}>
                Okay
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isBidModalOpen} onOpenChange={setIsBidModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Your Bid</DialogTitle>
              <DialogDescription>
                Please enter your bid amount for this job. Only numbers are
                allowed.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleBidSubmit}>
              <div className="space-y-2 py-4">
                <Label htmlFor="bid-amount">Bid amount ($)</Label>
                <Input
                  id="bid-amount"
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter your bid amount"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full sm:w-auto">
                  Submit bid
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      <AlertDialog
        open={deletingBidId !== null}
        onOpenChange={() => setDeletingBidId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this bid?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              bid from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBid}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={editingBidId !== null}
        onOpenChange={() => setEditingBidId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Your Bid</DialogTitle>
            <DialogDescription>
              Update your bid amount for this job.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditBidSubmit}>
            <div className="space-y-2 py-4">
              <Label htmlFor="edit-bid-amount">New bid amount ($)</Label>
              <Input
                id="edit-bid-amount"
                type="number"
                value={editBidAmount}
                onChange={(e) => setEditBidAmount(e.target.value)}
                placeholder="Enter new bid amount"
                min="1"
                step="1"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">
                Update bid
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PageJob;
