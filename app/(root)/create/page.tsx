"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { User } from "@/types";
import { createJob, getUserDetails } from "@/server";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const formSchema = z.object({
  title: z.string().min(5, {
    message: "Title must be at least 5 characters.",
  }),
  description: z.string().min(20, {
    message: "Description must be at least 20 characters.",
  }),
  budget: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Budget must be a positive number.",
  }),
  deadline: z.date({
    required_error: "A deadline is required.",
  }),
  skills: z.array(z.string()).min(1, {
    message: "At least one skill is required.",
  }),
});

const availableSkills = [
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

export default function PostJobPage() {
  const router = useRouter();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const { user } = useUser();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      budget: "",
      skills: [],
    },
  });
  const { toast } = useToast();
  const { data, isLoading } = useQuery<User[]>({
    queryKey: ["user"],
    queryFn: async () => {
      const result = await getUserDetails(
        user?.emailAddresses[0].emailAddress as string
      );
      return result as User[];
    },
    enabled: !!user?.emailAddresses[0].emailAddress,
  });
  const isClient = data?.[0]?.role === "client";
  useEffect(() => {
    if (!isLoading && data && !isClient) {
      toast({
        title: "Clients only",
        description: "Switch your role to Client on Profile to post jobs.",
        variant: "destructive",
      });
      router.replace("/jobs");
    }
  }, [data, isClient, isLoading, router, toast]);
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!isClient) {
        throw new Error("Only clients can post jobs");
      }
      const result = await createJob(
        values.title,
        values.description,
        Number(values.budget),
        values.deadline,
        data?.[0].user_id as number,
        values.skills as string[]
      );
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Job posted successfully",
        description: "Your job has been posted successfully",
      });
      router.push("/jobs");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred while posting your job",
        variant: "destructive",
      });
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation.mutate(values);
  }

  const handleSkillSelect = (skill: string) => {
    const next = selectedSkills.includes(skill)
      ? selectedSkills.filter((s) => s !== skill)
      : [...selectedSkills, skill];
    setSelectedSkills(next);
    form.setValue("skills", next, { shouldValidate: true });
  };
  if (isLoading || !isClient) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="section-y page-container">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Post a job</CardTitle>
          <CardDescription>
            Add a clear title, budget, deadline, and required skills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Full Stack Developer for web app"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Scope, requirements, and deliverables"
                        className="min-h-[120px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Deadline</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal sm:w-[240px]",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skills"
                render={() => (
                  <FormItem>
                    <FormLabel>Required Skills</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {availableSkills.map((skill) => (
                          <Badge
                            key={skill}
                            variant={
                              selectedSkills.includes(skill)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() => handleSkillSelect(skill)}
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Posting..." : "Post job"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
