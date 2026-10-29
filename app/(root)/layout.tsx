"use client";
import ResponsiveNavbar from "@/components/responsive-navbar";
import { useUser } from "@clerk/nextjs";
import { User } from "@clerk/nextjs/server";
const RootLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <ResponsiveNavbar user={user as unknown as User} />
      <main className="w-full flex-1">{children}</main>
    </div>
  );
};

export default RootLayout;
