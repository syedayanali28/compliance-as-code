"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Download,
  Sparkles,
  Workflow,
  FolderKanban,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui/shared";

const FEATURE_CHIPS = ["Webflow", "HTML", "Icons", "Easings", "Policy Review"];

const ACTION_ITEMS = [
  {
    href: "/workflow-canvas",
    label: "AI Canvas",
    icon: Workflow,
    roles: ["architect", "project_team", "admin"],
  },
  {
    href: "/firewall-review",
    label: "Firewall Review",
    icon: ShieldCheck,
    roles: ["arb_reviewer", "architect", "admin", "project_team"],
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["architect", "project_team", "admin"],
  },
  {
    href: "/reviews",
    label: "ARB Reviews",
    icon: ClipboardCheck,
    roles: ["arb_reviewer", "admin"],
  },
  {
    href: "/validations",
    label: "Validations",
    icon: FileCheck2,
    roles: ["arb_reviewer", "architect", "admin"],
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const visibleActions = ACTION_ITEMS.filter(
    (item) => userRole === "admin" || (userRole ? item.roles.includes(userRole) : false)
  );

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#141419] px-4 py-6 md:px-6 md:py-10">
      {/* ambient background lines */}
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08),transparent_50%),repeating-linear-gradient(90deg,transparent,transparent_64px,rgba(255,255,255,0.04)_65px,transparent_66px)]" />

      <div className="relative mx-auto flex max-w-6xl flex-col">
        <Card className="overflow-hidden rounded-[26px] border border-black/10 bg-[#f2f2f3] shadow-[0_22px_70px_rgba(0,0,0,0.38)]">
          <CardContent className="relative px-5 pb-24 pt-8 md:px-12 md:pb-28 md:pt-10">
            <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-black/5 md:block" />

            <section className="mx-auto max-w-4xl text-center">
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-4 py-1.5 text-xs font-medium tracking-wide text-black/70">
                <Sparkles className="h-3.5 w-3.5" />
                COMPLIANCE TOOLKIT
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-black sm:text-5xl md:text-7xl">
                Design Confidence <span className="text-[#4f46e5]">*</span> Built to Scale
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-6 text-black/70 md:text-lg md:leading-8">
                Platform for architecture design, ARB reviews, and firewall validation,
                connected in one clean workflow.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {FEATURE_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border border-black/10 bg-white/70 px-2.5 py-1 text-xs font-medium text-black/60"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href="/api/templates/download">
                  <Button className="rounded-full bg-[#17171b] px-5 text-white hover:bg-[#222229]" size="lg">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </a>
                {!session?.user && (
                  <Link href="/auth/signin">
                    <Button className="rounded-full border-black/20 bg-transparent px-5 text-black hover:bg-black/5" size="lg" variant="outline">
                      Sign in
                    </Button>
                  </Link>
                )}
              </div>
            </section>

            <section className="absolute bottom-4 left-1/2 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 md:bottom-6 md:w-[calc(100%-3rem)]">
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-black/10 bg-[#202025]/95 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur">
                {visibleActions.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      className="rounded-xl border border-white/15 bg-[#2a2a31] px-4 text-xs text-white hover:bg-[#33333b]"
                      size="sm"
                      variant="outline"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
                <a href="/api/templates/download">
                  <Button className="rounded-xl bg-[#d8f26f] px-4 text-xs font-semibold text-[#101013] hover:bg-[#c9e55d]" size="sm">
                    Visit Toolkit
                  </Button>
                </a>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
