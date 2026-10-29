"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
} from "@/components/page-shell";
import { getJobs } from "@/server";
import { Job } from "@/types";

const skillOptions = [
  "React",
  "Node.js",
  "MongoDB",
  "Python",
  "Java",
  "JavaScript",
  "Machine Learning",
  "SQL",
  "Figma",
  "Adobe XD",
  "Sketch",
  "Web Scraping",
  "Data Analysis",
  "Mobile Development",
  "React Native",
  "Backend Development",
];

export default function JobPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => (await getJobs()) as Job[],
  });

  const filteredJobs = useMemo(() => {
    return (data ?? []).filter((job) => {
      if (job.status !== "open") return false;
      const matchesSearch = job.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesSkills =
        selectedSkills.length === 0 ||
        selectedSkills.some((skill) =>
          (job.skills_required ?? []).includes(skill as never)
        );
      return matchesSearch && matchesSkills;
    });
  }, [data, searchTerm, selectedSkills]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Find jobs"
        description="Browse open listings and filter by skill."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? "Hide filters" : "Filters"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside
          className={`${
            filtersOpen ? "block" : "hidden"
          } rounded-xl border bg-card p-4 lg:block`}
        >
          <div className="space-y-4 lg:sticky lg:top-24">
            <div>
              <label className="mb-2 block text-sm font-medium">Search</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Skills</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {skillOptions.map((skill) => (
                  <label key={skill} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedSkills.includes(skill)}
                      onCheckedChange={(checked) => {
                        setSelectedSkills(
                          checked
                            ? [...selectedSkills, skill]
                            : selectedSkills.filter((s) => s !== skill)
                        );
                      }}
                    />
                    <span>{skill}</span>
                  </label>
                ))}
              </div>
            </div>
            {selectedSkills.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setSelectedSkills([])}
              >
                Clear skills
              </Button>
            ) : null}
          </div>
        </aside>

        <main>
          {filteredJobs.length === 0 ? (
            <EmptyState
              title="No jobs found"
              description="Try a different search or clear skill filters."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredJobs.map((job) => (
                <Link key={job.job_id} href={`/jobs/${job.job_id}`} className="block">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="line-clamp-2 text-lg break-words-safe">
                          {job.title}
                        </CardTitle>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.client_name}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="line-clamp-3 text-sm text-muted-foreground break-words-safe">
                        {job.description}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="font-medium">Budget · {job.budget}</span>
                        <span className="text-muted-foreground">
                          Due{" "}
                          {job.deadline
                            ? new Date(job.deadline).toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-1.5">
                      {(job.skills_required ?? [])
                        .filter(Boolean)
                        .slice(0, 5)
                        .map((skill, index) => (
                          <Badge key={`${skill}-${index}`} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </PageShell>
  );
}
