"use client";

import { useEffect, useState, Suspense } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  FolderKanban,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Spinner,
  EmptyState,
} from "@/components/ui/shared";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";

interface Project {
  id: string;
  name: string;
  project_code: string;
  description: string | null;
  environment: string;
  created_at: string;
}

function ProjectsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(
    searchParams.get("action") === "new"
  );

  const userRole = session?.user?.role;
  const canCreate = userRole === "architect" || userRole === "admin";

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects(q?: string) {
    setLoading(true);
    const url = q ? `/api/projects?q=${encodeURIComponent(q)}` : "/api/projects";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects);
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchProjects(search);
  }

  function handleProjectCreated() {
    setShowCreate(false);
    fetchProjects();
  }

  const StatusBadge = ({ env }: { env: string }) => {
    const variant =
      env === "production"
        ? "destructive"
        : env === "staging"
          ? "warning"
          : "secondary";
    return <Badge variant={variant}>{env}</Badge>;
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-4 py-8 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", duration: 0.15, bounce: 0.1 }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1>Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage infrastructure design projects
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Projects table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={
            canCreate
              ? "Create your first project to get started"
              : "No projects are available"
          }
          action={
            canCreate ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${project.project_code}`}
                      className="font-mono text-sm font-medium text-primary hover:underline"
                    >
                      {project.project_code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge env={project.environment} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(project.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${project.project_code}`}>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </motion.div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Spinner /></div>}>
      <ProjectsContent />
    </Suspense>
  );
}
