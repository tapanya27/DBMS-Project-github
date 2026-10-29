"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import React from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { User, UserWithSkills } from "@/types";
import { createUser, getUserDetails, getUserWithSkills } from "@/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserDetails } from "@/server";
import { useToast } from "@/hooks/use-toast";

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
export default function ProfilePage() {
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserWithSkills>();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupRole, setSetupRole] = useState("");
  const [setupSkills, setSetupSkills] = useState<string[]>([]);
  const { user } = useUser();
  const { data, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const result = await getUserDetails(
        user?.emailAddresses[0].emailAddress as string
      );
      return result as User[];
    },
    enabled: !!user?.emailAddresses[0].emailAddress,
  });
  const { data: userdata, isLoading: userdataLoading } = useQuery({
    queryKey: ["userdata"],
    queryFn: async () => {
      const result = await getUserWithSkills(data?.[0]?.user_id as number);
      const res = result as UserWithSkills[];
      const profile = res[0]
        ? {
            ...res[0],
            skills: (Array.isArray(res[0].skills) ? res[0].skills : []).filter(
              (skill): skill is string => typeof skill === "string" && skill.length > 0
            ),
          }
        : undefined;
      setUserData(profile);
      return profile;
    },
    enabled: !!data?.[0]?.user_id,
  });
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: async (values: {
      userId: number;
      name: string;
      skills: string[];
      role: string;
    }) => updateUserDetails(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userdata"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast({
        title: "Profile updated successfully",
        variant: "default",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update profile",
        variant: "destructive",
      });
      console.error("Error updating profile:", error);
    },
  });
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData((prev) => (prev ? { ...prev, [name]: value } : undefined));
  };

  const handleAddSkill = () => {
    if (!selectedSkill || !userData) return;
    const currentSkills = Array.isArray(userData.skills) ? userData.skills : [];
    if (!currentSkills.includes(selectedSkill)) {
      setUserData({
        ...userData,
        skills: [...currentSkills, selectedSkill],
      });
      setSelectedSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (userData) {
      const currentSkills = Array.isArray(userData.skills) ? userData.skills : [];
      setUserData({
        ...userData,
        skills: currentSkills.filter((skill) => skill !== skillToRemove),
      });
    }
  };
  const normalizeName = (value: string) => {
    const cleaned = (value ?? "").trim().replace(/\s+/g, " ");
    const parts = cleaned.split(" ").filter(Boolean);
    // Undo accidental "Name Name" duplication from older create flow
    if (
      parts.length === 2 &&
      parts[0].toLowerCase() === parts[1].toLowerCase()
    ) {
      return parts[0];
    }
    return cleaned;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userData) {
      updateUserMutation.mutate({
        userId: userData.user_id,
        name: normalizeName(userData.name),
        skills: userData.skills,
        role: userData.role,
      });
    }
  };
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const fullName = setupName.trim().replace(/\s+/g, " ");
      const email = user?.emailAddresses[0].emailAddress;
      if (!email || !fullName || !setupRole) {
        throw new Error("Name, role, and email are required");
      }
      return createUser(fullName, "", email, setupSkills, setupRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["userdata"] });
      toast({ title: "Profile created" });
    },
    onError: () => {
      toast({
        title: "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  if (isLoading || (data?.[0] && userdataLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.[0]) {
    return (
      <div className="section-y page-container">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Choose your role</CardTitle>
            <CardDescription>
              Pick client or freelancer to finish setup. This is stored in the
              app database, not in Clerk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-name">Name</Label>
              <Input
                id="setup-name"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>I am a</Label>
              <Select value={setupRole} onValueChange={setSetupRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client — post jobs</SelectItem>
                  <SelectItem value="freelancer">
                    Freelancer — apply to jobs
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {setupSkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-sm">
                    {skill}
                    <button
                      type="button"
                      onClick={() =>
                        setSetupSkills(setupSkills.filter((s) => s !== skill))
                      }
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSkills.map((skill) => (
                      <SelectItem key={skill} value={skill}>
                        {skill}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedSkill && !setupSkills.includes(selectedSkill)) {
                      setSetupSkills([...setupSkills, selectedSkill]);
                      setSelectedSkill("");
                    }
                  }}
                >
                  Add Skill
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => createProfileMutation.mutate()}
              disabled={
                createProfileMutation.isPending ||
                !setupName.trim() ||
                !setupRole
              }
            >
              Save profile
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  return (
    <div className="section-y page-container">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your name, role, and skills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={userData?.name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                {isEditing ? (
                  <Select
                    value={userData?.role}
                    onValueChange={(role) =>
                      setUserData((prev) => (prev ? { ...prev, role } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client — post jobs</SelectItem>
                      <SelectItem value="freelancer">
                        Freelancer — apply to jobs
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={
                      userData?.role === "freelancer" ? "Freelancer" : "Client"
                    }
                    disabled
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills">Skills</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(Array.isArray(userData?.skills) ? userData.skills : []).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-sm">
                      {skill}
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Select
                      value={selectedSkill}
                      onValueChange={setSelectedSkill}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSkills.map((skill) => (
                          <SelectItem key={skill} value={skill}>
                            {skill}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddSkill}>
                      Add Skill
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-row">
          {isEditing ? (
            <div className="flex gap-6 justify-between">
              <Button type="button" onClick={handleSubmit}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
