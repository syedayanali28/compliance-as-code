"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Shield,
  FolderKanban,
  ClipboardCheck,
  FileCheck2,
  Network,
  Settings,
  LogOut,
  Download,
  Workflow,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/workflow", label: "Workflow Manager", icon: Network, roles: ["architect", "project_team", "admin"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["architect", "admin", "project_team"] },
  { href: "/reviews", label: "ARB Reviews", icon: ClipboardCheck, roles: ["arb_reviewer", "admin"] },
  { href: "/validations", label: "Validations", icon: FileCheck2, roles: ["arb_reviewer", "admin", "architect"] },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = session?.user?.role ?? "viewer";

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes(userRole) || userRole === "admin"
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 glass-lite">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <Shield className="h-5 w-5" />
          <span className="hidden sm:inline tracking-[0.12em] uppercase">IDAC / SYSTEM</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/workflow-canvas"
            className={cn(
              "flex items-center gap-1.5 rounded-md border-r-2 border-transparent px-3 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith("/workflow-canvas")
                ? "border-r-primary bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Workflow className="h-4 w-4" />
            AI Canvas
          </Link>
          <Link
            href="/firewall-review"
            className={cn(
              "flex items-center gap-1.5 rounded-md border-r-2 border-transparent px-3 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith("/firewall-review")
                ? "border-r-primary bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Firewall Review
          </Link>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border-r-2 border-transparent px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-r-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Template download */}
          <a
            href="/api/templates/download"
            className="flex items-center gap-1.5 rounded-md border-r-2 border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            Template
          </a>
        </nav>

        {/* User menu */}
        <div className="hidden md:flex items-center gap-3">
          {session?.user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.name ?? session.user.email}
                <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {userRole}
                </span>
              </span>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-border/60 glass-lite md:hidden">
          <nav className="flex flex-col p-2">
            <Link
              href="/workflow-canvas"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md border-r-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/workflow-canvas")
                  ? "border-r-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Workflow className="h-4 w-4" />
              AI Canvas
            </Link>
            <Link
              href="/firewall-review"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md border-r-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/firewall-review")
                  ? "border-r-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Firewall Review
            </Link>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border-r-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-r-primary bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <a
              href="/api/templates/download"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Template
            </a>
            {session?.user && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
