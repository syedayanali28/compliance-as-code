"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FolderKanban,
  Upload,
  ClipboardCheck,
  FileCheck2,
  Download,
  ArrowRight,
  Shield,
  GitBranch,
  Network,
  Workflow,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from "@/components/ui/shared";

const WORKFLOW_STEPS = [
  {
    number: "1",
    title: "Download Template",
    description: "Get the standardized IdaC Excel template with pre-defined columns for system connections",
    icon: Download,
    color: "text-blue-600 bg-blue-100",
  },
  {
    number: "2",
    title: "Fill & Upload",
    description: "Document all system connections including zones, ports, protocols, and data classifications",
    icon: Upload,
    color: "text-violet-600 bg-violet-100",
  },
  {
    number: "3",
    title: "Design-as-Code",
    description: "Your design is converted to YAML, committed to GitLab, and system diagrams are auto-generated",
    icon: GitBranch,
    color: "text-emerald-600 bg-emerald-100",
  },
  {
    number: "4",
    title: "ARB Review",
    description: "Architecture Review Board reviews each connection with row-level approve/reject feedback",
    icon: ClipboardCheck,
    color: "text-amber-600 bg-amber-100",
  },
  {
    number: "5",
    title: "Validation Engine",
    description: "Firewall requests are automatically validated against the approved design and security policies",
    icon: FileCheck2,
    color: "text-red-600 bg-red-100",
  },
];

const ZONE_INFO = [
  {
    name: "Internet",
    description: "External-facing services and public endpoints",
    color: "zone-internet",
    border: "border-red-300",
  },
  {
    name: "DMZ",
    description: "Proxy servers, load balancers, WAFs, and API gateways",
    color: "zone-dmz",
    border: "border-yellow-400",
  },
  {
    name: "Intranet (OA)",
    description: "VMs, Kubernetes clusters, databases, and private cloud",
    color: "zone-intranet",
    border: "border-green-300",
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-10">
      {/* Hero */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Shield className="h-4 w-4" />
          Infrastructure-Design-as-Code
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Compliance Platform
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Standardize system designs, automate architecture reviews, and validate
          firewall requests against approved designs and security policies.
        </p>
        <div className="flex items-center justify-center gap-3">
          {(userRole === "architect" || userRole === "project_team" || userRole === "admin") && (
            <Link href="/workflow">
              <Button variant="outline" size="lg">
                <Workflow className="h-4 w-4" />
                Workflow Manager
              </Button>
            </Link>
          )}
          <a href="/api/templates/download">
            <Button size="lg">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </a>
          {(userRole === "architect" || userRole === "admin") && (
            <Link href="/projects">
              <Button variant="outline" size="lg">
                <FolderKanban className="h-4 w-4" />
                My Projects
              </Button>
            </Link>
          )}
          {!session?.user && (
            <Link href="/auth/signin">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Workflow */}
      <section className="space-y-6">
        <h2 className="text-center">How It Works</h2>
        <div className="grid gap-4 md:grid-cols-5">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.number} className="relative">
              <Card className="h-full">
                <CardContent className="pt-6 text-center space-y-3">
                  <div className={`inline-flex items-center justify-center rounded-full p-3 ${step.color}`}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Step {step.number}
                    </p>
                    <h4 className="font-semibold text-sm">{step.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 z-10 -translate-y-1/2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Network Zones */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2>Network Zone Architecture</h2>
          <p className="text-muted-foreground">
            Three security zones with proxy-mediated cross-zone communication
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {ZONE_INFO.map((zone) => (
            <Card key={zone.name} className={`${zone.border} border-2`}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{zone.name}</CardTitle>
                </div>
                <CardDescription>{zone.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`rounded-md ${zone.color} p-3`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Security Zone</span>
                    <Badge variant="outline">{zone.name}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="zone-internet rounded px-2 py-0.5 text-xs font-medium">Internet</span>
          <ArrowRight className="h-3 w-3" />
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">Proxy</span>
          <ArrowRight className="h-3 w-3" />
          <span className="zone-dmz rounded px-2 py-0.5 text-xs font-medium">DMZ</span>
          <ArrowRight className="h-3 w-3" />
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">Proxy</span>
          <ArrowRight className="h-3 w-3" />
          <span className="zone-intranet rounded px-2 py-0.5 text-xs font-medium">Intranet</span>
        </div>
      </section>

      {/* Quick actions based on role */}
      {session?.user && (
        <section className="space-y-4">
          <h2>Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(userRole === "architect" || userRole === "admin") && (
              <>
                <Link href="/projects" className="block">
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FolderKanban className="h-4 w-4" />
                        View Projects
                      </CardTitle>
                      <CardDescription>
                        Manage projects and view design submissions
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
                <Link href="/projects?action=new" className="block">
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Upload className="h-4 w-4" />
                        New Submission
                      </CardTitle>
                      <CardDescription>
                        Upload a completed IdaC template for review
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </>
            )}
            {(userRole === "arb_reviewer" || userRole === "admin") && (
              <>
                <Link href="/reviews" className="block">
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ClipboardCheck className="h-4 w-4" />
                        Pending Reviews
                      </CardTitle>
                      <CardDescription>
                        Review design submissions with row-level feedback
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
                <Link href="/validations" className="block">
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileCheck2 className="h-4 w-4" />
                        Validation Results
                      </CardTitle>
                      <CardDescription>
                        View firewall validation reports and policy checks
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
