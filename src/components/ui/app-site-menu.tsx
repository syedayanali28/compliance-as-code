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
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["architect", "admin", "project_team"] },
  { href: "/reviews", label: "ARB Reviews", icon: ClipboardCheck, roles: ["arb_reviewer", "admin"] },
  { href: "/validations", label: "Validations", icon: FileCheck2, roles: ["arb_reviewer", "admin", "architect"] },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
];

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium transition duration-200",
    active
      ? "border-primary/40 bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  );

export type AppSiteMenuProps = {
  /** Classes for the menu toggle button (layout / position). */
  className?: string;
  /** z-index for overlay + drawer (floating uses ~252–253; toolbar should be ≥200). */
  zOverlay?: number;
};

/**
 * App-wide navigation: burger + slide-over. Use in the workflow top bar or as a floating control.
 */
export function AppSiteMenu({ className, zOverlay = 252 }: AppSiteMenuProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const userRole = session?.user?.role ?? "viewer";

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes(userRole) || userRole === "admin"
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    globalThis.document?.addEventListener("keydown", onKey);
    const prev = globalThis.document?.body.style.overflow;
    if (globalThis.document?.body) {
      globalThis.document.body.style.overflow = "hidden";
    }

    return () => {
      globalThis.document?.removeEventListener("keydown", onKey);
      if (globalThis.document?.body) {
        globalThis.document.body.style.overflow = prev ?? "";
      }
    };
  }, [menuOpen, closeMenu]);

  const zBack = zOverlay;
  const zPanel = zOverlay + 1;

  return (
    <>
      <button
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-label={menuOpen ? "Close app menu" : "Open app menu"}
        className={className}
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>

      {menuOpen ? (
        <>
          <button
            aria-label="Close menu"
            className="pointer-events-auto fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={closeMenu}
            style={{ zIndex: zBack }}
            type="button"
          />
          <aside
            aria-label="Site menu"
            aria-modal="true"
            className="pointer-events-auto fixed inset-y-0 right-0 flex w-[min(20rem,92vw)] flex-col border-l border-border bg-background shadow-2xl"
            role="dialog"
            style={{ zIndex: zPanel }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <Link
                className="flex items-center gap-2 font-semibold text-primary"
                href="/"
                onClick={closeMenu}
              >
                <Shield className="h-5 w-5 shrink-0" />
                <span className="text-xs tracking-[0.08em] uppercase">IDaC</span>
              </Link>
              <button
                aria-label="Close menu"
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={closeMenu}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              <Link
                className={linkClass(pathname.startsWith("/workflow-canvas"))}
                href="/workflow-canvas"
                onClick={closeMenu}
              >
                <Workflow className="h-4 w-4 shrink-0" />
                AI Canvas
              </Link>
              <Link
                className={linkClass(pathname.startsWith("/firewall-review"))}
                href="/firewall-review"
                onClick={closeMenu}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Firewall Review
              </Link>

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    className={linkClass(isActive)}
                    href={item.href}
                    key={item.href}
                    onClick={closeMenu}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}

              <a
                className={linkClass(false)}
                href="/api/templates/download"
                onClick={closeMenu}
              >
                <Download className="h-4 w-4 shrink-0" />
                Download template
              </a>
            </nav>

            <div className="border-t border-border p-3">
              {session?.user ? (
                <div className="space-y-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {session.user.name ?? session.user.email}
                    <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {userRole}
                    </span>
                  </p>
                  <button
                    className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      closeMenu();
                      void signOut();
                    }}
                    type="button"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  className="flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  href="/auth/signin"
                  onClick={closeMenu}
                >
                  Sign in
                </Link>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
