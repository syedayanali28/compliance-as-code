"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Download,
  Activity,
  Sparkles,
  Workflow,
  FolderKanban,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui/shared";

const FEATURE_CHIPS = ["Webflow", "HTML", "Icons", "Easings", "Policy Review"];

const HUB_STATS = [
  { label: "Active Designs", value: "27", tone: "text-primary" },
  { label: "Pending Reviews", value: "8", tone: "text-[#ff8f66]" },
  { label: "Compliance Score", value: "93%", tone: "text-[#d9f99d]" },
];

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
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-6 md:px-6 md:py-10">
      {/* ambient background lines */}
      <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-20" />

      <div className="relative mx-auto flex max-w-6xl flex-col">
        <Card className="overflow-hidden rounded-[26px] border border-border/80 bg-card/95 shadow-[0_22px_70px_rgba(0,0,0,0.38)]">
          <CardContent className="relative px-5 pb-24 pt-8 md:px-12 md:pb-28 md:pt-10">
            <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border/60 md:block" />

            <section className="mx-auto max-w-4xl text-center">
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-medium tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                COMMAND HUB
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-7xl">
                IDAC / SYSTEM
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground md:text-lg md:leading-8">
                Platform for architecture design, ARB reviews, and firewall validation,
                connected in one clean workflow.
              </p>

              <div className="mx-auto mt-7 grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
                {HUB_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border bg-background/65 p-4 text-left glass-lite">
                    <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{stat.label}</p>
                    <p className={`mt-2 text-3xl font-semibold ${stat.tone}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {FEATURE_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href="/api/templates/download">
                  <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" size="lg">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </a>
                <Link href="/workflow-canvas">
                  <Button className="rounded-full border border-primary/60 bg-transparent px-5 text-primary hover:bg-primary/10" size="lg" variant="outline">
                    <Activity className="h-4 w-4" />
                    New Topology
                  </Button>
                </Link>
                {!session?.user && (
                  <Link href="/auth/signin">
                    <Button className="rounded-full border-border/70 bg-transparent px-5 text-foreground hover:bg-background/75" size="lg" variant="outline">
                      Sign in
                    </Button>
                  </Link>
                )}
              </div>
            </section>

            <section className="absolute bottom-4 left-1/2 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 md:bottom-6 md:w-[calc(100%-3rem)]">
              <div className="glass-lite flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border p-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                {visibleActions.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      className="rounded-xl border border-border bg-card px-4 text-xs text-foreground hover:bg-accent"
                      size="sm"
                      variant="outline"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
                <a href="/api/templates/download">
                  <Button className="rounded-xl bg-[#d9f99d] px-4 text-xs font-semibold text-[#101013] hover:bg-[#c9e58f]" size="sm">
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
