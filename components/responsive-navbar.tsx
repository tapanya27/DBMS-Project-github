"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { User } from "@clerk/nextjs/server";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import NotificationsMenu from "@/components/notifications-menu";
import { getUserDetails } from "@/server";
import type { User as DbUser } from "@/types";
import { cn } from "@/lib/utils";

export default function ResponsiveNavbar({ user }: { user: User }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  useEffect(() => setIsMenuOpen(false), [pathname]);

  const { data: profile } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const result = await getUserDetails(
        user?.emailAddresses[0].emailAddress as string
      );
      return result as DbUser[];
    },
    enabled: !!user?.emailAddresses?.[0]?.emailAddress,
  });

  const isClient = profile?.[0]?.role === "client";
  const links = [
    { href: "/jobs", label: "Find Jobs" },
    ...(isClient ? [{ href: "/create", label: "Post Job" }] : []),
    { href: "/userjobs", label: "Dashboard" },
    ...(isClient ? [{ href: "/inprogress", label: "In Progress" }] : []),
    { href: "/messages", label: "Messages" },
    { href: "/reports", label: "Reports" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="page-container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          Contractix
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <NotificationsMenu enabled={!!profile?.[0]} />
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => router.push("/profile")}
              >
                Profile
              </Button>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : null}

          {mounted ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t lg:hidden">
          <nav className="page-container flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm",
                  pathname === link.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <Link
                href="/profile"
                className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Profile
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
