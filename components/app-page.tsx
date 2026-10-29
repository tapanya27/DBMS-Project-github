"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { User } from "@clerk/nextjs/server";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageShell } from "@/components/page-shell";
import { getJobs } from "@/server";
import { Job } from "@/types";

export default function AppPage({ user }: { user: User }) {
  const { data, isLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => (await getJobs()) as Job[],
  });

  const jobs = (data ?? []).filter((job) => job.status === "open").slice(0, 6);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <section className="border-b bg-muted/40">
        <PageShell className="py-14 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-sm font-medium text-primary">Contractix</p>
            <h1 className="text-3xl font-semibold sm:text-4xl lg:text-5xl">
              Hire freelancers or find contract work
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Post jobs, place bids, track progress, and leave feedback in one
              place.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/jobs">Browse jobs</Link>
              </Button>
              {user ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/userjobs">Go to dashboard</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="lg">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
        </PageShell>
      </section>

      <PageShell>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Open jobs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent listings available for bids
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs">View all</Link>
          </Button>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title="No open jobs yet"
            description="Check back soon or post a job if you are a client."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.job_id} className="flex flex-col transition-shadow hover:shadow-md">
                <CardHeader className="space-y-2">
                  <CardTitle className="line-clamp-2 text-lg break-words-safe">
                    {job.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {job.client_name}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground break-words-safe">
                    {job.description}
                  </p>
                  <p className="text-sm font-medium">Budget · {job.budget}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(job.skills_required ?? [])
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((skill, index) => (
                        <Badge key={`${skill}-${index}`} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/jobs/${job.job_id}`}>View job</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </PageShell>

      <footer className="mt-auto border-t">
        <PageShell className="py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Contractix
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href="/about" className="text-muted-foreground hover:text-foreground">
                About
              </Link>
              <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                Contact
              </Link>
              <Link href="/jobs" className="text-muted-foreground hover:text-foreground">
                Jobs
              </Link>
            </div>
          </div>
        </PageShell>
      </footer>
    </div>
  );
}
