"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Settings,
  Shield,
  BookOpen,
  Activity,
  Users,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Textarea,
  Select,
  Spinner,
  EmptyState,
} from "@/components/ui/shared";

interface Guideline {
  id: string;
  caution_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  source: string;
  is_active: boolean;
}

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

type AdminTab = "guidelines" | "audit" | "system";

export default function AdminPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<AdminTab>("guidelines");

  if (session?.user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="You need admin privileges to access this page"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div>
        <h1 className="flex items-center gap-2">
          <Settings className="h-7 w-7" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage guidelines, view audit logs, and configure the platform
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "guidelines" as const, label: "Guidelines", icon: BookOpen },
          { key: "audit" as const, label: "Audit Log", icon: Activity },
          { key: "system" as const, label: "System", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "guidelines" && <GuidelinesTab />}
      {activeTab === "audit" && <AuditLogTab />}
      {activeTab === "system" && <SystemTab />}
    </div>
  );
}

/* ─────────── Guidelines Tab ─────────── */

function GuidelinesTab() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Guideline>>({});

  useEffect(() => {
    fetchGuidelines();
  }, []);

  async function fetchGuidelines() {
    setLoading(true);
    const res = await fetch("/api/admin/guidelines");
    if (res.ok) {
      const data = await res.json();
      setGuidelines(data.guidelines ?? []);
    }
    setLoading(false);
  }

  function startEdit(g: Guideline) {
    setEditing(g.id);
    setEditForm(g);
  }

  function cancelEdit() {
    setEditing(null);
    setEditForm({});
  }

  async function saveEdit() {
    if (!editing) return;

    const res = await fetch(`/api/admin/guidelines/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (res.ok) {
      setEditing(null);
      fetchGuidelines();
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/guidelines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    fetchGuidelines();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Security Guidelines</CardTitle>
            <CardDescription>
              {guidelines.length} guidelines loaded. These are used by the policy
              checker.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caution ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guidelines.map((g) => (
                <TableRow key={g.id}>
                  {editing === g.id ? (
                    <>
                      <TableCell>
                        <Input
                          className="text-xs h-7 w-24"
                          value={editForm.caution_id ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, caution_id: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="text-xs h-7"
                          value={editForm.title ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, title: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          className="text-xs h-7"
                          value={editForm.category ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, category: e.target.value })
                          }
                        >
                          <option value="inbound">Inbound</option>
                          <option value="outbound">Outbound</option>
                          <option value="security">Security</option>
                          <option value="zone">Zone</option>
                          <option value="workflow">Workflow</option>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          className="text-xs h-7"
                          value={editForm.severity ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, severity: e.target.value })
                          }
                        >
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={editForm.is_active ? "success" : "secondary"}>
                          {editForm.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={saveEdit}>
                            <Save className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-mono text-xs font-medium">
                        {g.caution_id}
                      </TableCell>
                      <TableCell className="text-xs">{g.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {g.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            g.severity === "critical"
                              ? "destructive"
                              : g.severity === "high"
                                ? "warning"
                                : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {g.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActive(g.id, g.is_active)}
                          className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                            g.is_active ? "bg-green-500" : "bg-muted"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded-full bg-white transition-transform ${
                              g.is_active ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(g)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────── Audit Log Tab ─────────── */

function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/audit");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardDescription>Last 100 audit log entries</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Audit entries will appear here as actions are taken"
          />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.entity_type}
                      {entry.entity_id && (
                        <span className="text-muted-foreground ml-1">
                          ({entry.entity_id.slice(0, 8)}…)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {entry.user_id?.slice(0, 8) ?? "system"}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs">
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">
                          Show
                        </summary>
                        <pre className="mt-1 text-[10px] bg-muted p-1 rounded overflow-auto max-h-24">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────── System Tab ─────────── */

function SystemTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <ConfigRow
              label="Supabase"
              status={!!process.env.NEXT_PUBLIC_SUPABASE_URL}
            />
            <ConfigRow
              label="GitLab"
              status={!!process.env.GITLAB_URL}
            />
            <ConfigRow
              label="JIRA"
              status={!!process.env.JIRA_BASE_URL}
            />
            <ConfigRow
              label="LDAP"
              status={!!process.env.LDAP_URL}
            />
            <ConfigRow
              label="LLM (MaaS)"
              status={!!process.env.MAAS_API_KEY}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Platform Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-mono">1.0.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Environment</dt>
              <dd className="font-mono">{process.env.NODE_ENV}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Framework</dt>
              <dd className="font-mono">Next.js 15</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({
  label,
  status,
}: {
  label: string;
  status: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={status ? "success" : "secondary"}>
        {status ? "Configured" : "Not Set"}
      </Badge>
    </div>
  );
}
