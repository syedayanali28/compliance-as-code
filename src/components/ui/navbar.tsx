"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Shield,
  FolderKanban,
  ClipboardCheck,
  FileCheck2,
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
    <header className="sticky top-3 z-50 px-3 md:px-4">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 rounded-2xl border border-white/45 bg-white/45 px-4 shadow-[0_12px_35px_rgba(15,23,42,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/32">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.03]">
          <Shield className="h-5 w-5" />
          <span className="hidden sm:inline tracking-[0.12em] uppercase">IDaC</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/workflow-canvas"
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:scale-[1.03]",
              pathname.startsWith("/workflow-canvas")
                ? "border-primary/40 bg-primary/20 text-primary"
                : "text-muted-foreground hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
            )}
          >
            <Workflow className="h-4 w-4" />
            AI Canvas
          </Link>
          <Link
            href="/firewall-review"
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:scale-[1.03]",
              pathname.startsWith("/firewall-review")
                ? "border-primary/40 bg-primary/20 text-primary"
                : "text-muted-foreground hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
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
                  "flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:scale-[1.03]",
                  isActive
                    ? "border-primary/40 bg-primary/20 text-primary"
                    : "text-muted-foreground hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
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
            className="flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition duration-200 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
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
                className="flex items-center gap-1 rounded-xl border border-transparent px-2.5 py-1.5 text-sm text-muted-foreground transition duration-200 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition duration-200 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-primary/90"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="rounded-xl border border-transparent p-1.5 text-muted-foreground transition hover:border-white/60 hover:bg-white/65 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/45 bg-white/45 p-2 shadow-[0_12px_35px_rgba(15,23,42,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/32 md:hidden">
          <nav className="flex flex-col gap-1.5">
            <Link
              href="/workflow-canvas"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition duration-200",
                pathname.startsWith("/workflow-canvas")
                  ? "border-primary/40 bg-primary/20 text-primary"
                  : "text-muted-foreground hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
              )}
            >
              <Workflow className="h-4 w-4" />
              AI Canvas
            </Link>
            <Link
              href="/firewall-review"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition duration-200",
                pathname.startsWith("/firewall-review")
                  ? "border-primary/40 bg-primary/20 text-primary"
                  : "text-muted-foreground hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
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
                    "flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition duration-200",
                    isActive
                      ? "border-primary/40 bg-primary/20 text-primary"
                      : "text-muted-foreground hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <a
              href="/api/templates/download"
              className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition duration-200 hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
            >
              <Download className="h-4 w-4" />
              Download Template
            </a>
            {session?.user && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition duration-200 hover:border-white/60 hover:bg-white/65 hover:text-slate-900"
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
