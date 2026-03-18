"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type PolicyComponent = {
  componentKey: string;
  nodeType: string;
  label: string;
  category: "environment" | "zone" | "control" | "database" | "backend" | "frontend" | "integration";
  description: string;
  componentType: string;
  zone?: string;
  parentComponentKey?: string;
  isZone?: boolean;
  isUnique?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
};

type PolicyRule = {
  policyId: string;
  sourceComponentKey: string;
  targetComponentKey: string;
  action: "allow" | "deny";
  reason: string;
  enabled: boolean;
};

type PolicyPayload = {
  components: PolicyComponent[];
  rules: PolicyRule[];
};

const emptyComponent: PolicyComponent = {
  componentKey: "",
  nodeType: "",
  label: "",
  category: "integration",
  description: "",
  componentType: "",
  isZone: false,
  isUnique: false,
};

const emptyRule: PolicyRule = {
  policyId: "",
  sourceComponentKey: "",
  targetComponentKey: "",
  action: "allow",
  reason: "",
  enabled: true,
};

export default function WorkflowCanvasAdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [payload, setPayload] = useState<PolicyPayload>({ components: [], rules: [] });
  const [loading, setLoading] = useState(true);
  const [componentForm, setComponentForm] = useState<PolicyComponent>(emptyComponent);
  const [editingComponentKey, setEditingComponentKey] = useState<string | null>(null);
  const [componentEditForm, setComponentEditForm] = useState<PolicyComponent | null>(null);
  const [ruleForm, setRuleForm] = useState<PolicyRule>(emptyRule);

  useEffect(() => {
    if (status !== "loading" && !session?.user) {
      router.replace("/auth/signin");
    }

    if (status !== "loading" && session?.user && session.user.role !== "admin") {
      router.replace("/unauthorized");
    }
  }, [router, session, status]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "admin") {
      return;
    }

    const load = async () => {
      setLoading(true);
      const response = await fetch("/api/workflow-canvas/policies", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        toast.error("Failed to load workflow-canvas policies");
        setLoading(false);
        return;
      }

      const nextPayload = (await response.json()) as PolicyPayload;
      setPayload(nextPayload);
      setLoading(false);
    };

    void load();
  }, [session?.user?.role, status]);

  if (status === "loading" || !session?.user || session.user.role !== "admin") {
    return null;
  }

  const refresh = async () => {
    const response = await fetch("/api/workflow-canvas/policies", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      toast.error("Failed to refresh policy catalog");
      return;
    }

    const nextPayload = (await response.json()) as PolicyPayload;
    setPayload(nextPayload);
  };

  const createComponent = async () => {
    const response = await fetch("/api/workflow-canvas/policies/components", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        component_key: componentForm.componentKey,
        node_type: componentForm.nodeType,
        label: componentForm.label,
        category: componentForm.category,
        description: componentForm.description,
        zone: componentForm.zone || null,
        component_type: componentForm.componentType,
        parent_component_key: componentForm.parentComponentKey || null,
        is_zone: Boolean(componentForm.isZone),
        is_unique: Boolean(componentForm.isUnique),
        default_width: componentForm.defaultWidth ?? null,
        default_height: componentForm.defaultHeight ?? null,
        enabled: true,
      }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      toast.error(result.error ?? "Failed to create component");
      return;
    }

    toast.success("Component added");
    setComponentForm(emptyComponent);
    await refresh();
  };

  const createRule = async () => {
    const response = await fetch("/api/workflow-canvas/policies/rules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        policy_id: ruleForm.policyId,
        source_component_key: ruleForm.sourceComponentKey,
        target_component_key: ruleForm.targetComponentKey,
        action: ruleForm.action,
        reason: ruleForm.reason,
        enabled: ruleForm.enabled,
      }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      toast.error(result.error ?? "Failed to create rule");
      return;
    }

    toast.success("Rule added");
    setRuleForm(emptyRule);
    await refresh();
  };

  const startEditComponent = (component: PolicyComponent) => {
    setEditingComponentKey(component.componentKey);
    setComponentEditForm({ ...component });
  };

  const cancelEditComponent = () => {
    setEditingComponentKey(null);
    setComponentEditForm(null);
  };

  const saveComponentEdits = async () => {
    if (!componentEditForm || !editingComponentKey) {
      return;
    }

    const response = await fetch("/api/workflow-canvas/policies/components", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        component_key: editingComponentKey,
        node_type: componentEditForm.nodeType,
        label: componentEditForm.label,
        category: componentEditForm.category,
        description: componentEditForm.description,
        zone: componentEditForm.zone || null,
        component_type: componentEditForm.componentType,
        parent_component_key: componentEditForm.parentComponentKey || null,
        is_zone: Boolean(componentEditForm.isZone),
        is_unique: Boolean(componentEditForm.isUnique),
        default_width: componentEditForm.defaultWidth ?? null,
        default_height: componentEditForm.defaultHeight ?? null,
      }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      toast.error(result.error ?? "Failed to update component");
      return;
    }

    toast.success("Component updated");
    cancelEditComponent();
    await refresh();
  };

  const deleteComponent = async (componentKey: string) => {
    const ok = globalThis.confirm(
      `Delete component '${componentKey}'? This can impact active canvas rules.`
    );
    if (!ok) {
      return;
    }

    const response = await fetch(
      `/api/workflow-canvas/policies/components?componentKey=${encodeURIComponent(componentKey)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const result = (await response.json()) as { error?: string; details?: string };
      toast.error(result.error ?? result.details ?? "Failed to delete component");
      return;
    }

    toast.success("Component deleted");
    if (editingComponentKey === componentKey) {
      cancelEditComponent();
    }
    await refresh();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Workflow Canvas Schema Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage component schema and validation rule catalog used by the canvas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Add Component</h2>
          <div className="mt-3 grid gap-2">
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="component_key" value={componentForm.componentKey} onChange={(event) => setComponentForm((prev) => ({ ...prev, componentKey: event.target.value }))} />
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="node_type" value={componentForm.nodeType} onChange={(event) => setComponentForm((prev) => ({ ...prev, nodeType: event.target.value }))} />
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="label" value={componentForm.label} onChange={(event) => setComponentForm((prev) => ({ ...prev, label: event.target.value }))} />
            <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={componentForm.category} onChange={(event) => setComponentForm((prev) => ({ ...prev, category: event.target.value as PolicyComponent["category"] }))}>
              <option value="environment">environment</option>
              <option value="zone">zone</option>
              <option value="control">control</option>
              <option value="database">database</option>
              <option value="backend">backend</option>
              <option value="frontend">frontend</option>
              <option value="integration">integration</option>
            </select>
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="component_type (e.g. backend:dotnet)" value={componentForm.componentType} onChange={(event) => setComponentForm((prev) => ({ ...prev, componentType: event.target.value }))} />
            <textarea className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="description" value={componentForm.description} onChange={(event) => setComponentForm((prev) => ({ ...prev, description: event.target.value }))} />
            <button className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" onClick={() => void createComponent()} type="button">Create component</button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Add Validation Rule</h2>
          <div className="mt-3 grid gap-2">
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="policy_id" value={ruleForm.policyId} onChange={(event) => setRuleForm((prev) => ({ ...prev, policyId: event.target.value }))} />
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="source_component_key" value={ruleForm.sourceComponentKey} onChange={(event) => setRuleForm((prev) => ({ ...prev, sourceComponentKey: event.target.value }))} />
            <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="target_component_key" value={ruleForm.targetComponentKey} onChange={(event) => setRuleForm((prev) => ({ ...prev, targetComponentKey: event.target.value }))} />
            <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={ruleForm.action} onChange={(event) => setRuleForm((prev) => ({ ...prev, action: event.target.value as PolicyRule["action"] }))}>
              <option value="allow">allow</option>
              <option value="deny">deny</option>
            </select>
            <textarea className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="reason" value={ruleForm.reason} onChange={(event) => setRuleForm((prev) => ({ ...prev, reason: event.target.value }))} />
            <button className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" onClick={() => void createRule()} type="button">Create rule</button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Current Catalog</h2>
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading...</p> : null}

        {!loading ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Components ({payload.components.length})
              </h3>
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {payload.components.map((component) => (
                  <div className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs" key={component.componentKey}>
                    {editingComponentKey === component.componentKey && componentEditForm ? (
                      <div className="space-y-2 p-1">
                        <input
                          className="h-8 w-full rounded border border-input bg-background px-2"
                          onChange={(event) =>
                            setComponentEditForm((current) =>
                              current ? { ...current, label: event.target.value } : current
                            )
                          }
                          value={componentEditForm.label}
                        />
                        <input
                          className="h-8 w-full rounded border border-input bg-background px-2"
                          onChange={(event) =>
                            setComponentEditForm((current) =>
                              current ? { ...current, nodeType: event.target.value } : current
                            )
                          }
                          value={componentEditForm.nodeType}
                        />
                        <input
                          className="h-8 w-full rounded border border-input bg-background px-2"
                          onChange={(event) =>
                            setComponentEditForm((current) =>
                              current ? { ...current, componentType: event.target.value } : current
                            )
                          }
                          value={componentEditForm.componentType}
                        />
                        <textarea
                          className="min-h-16 w-full rounded border border-input bg-background px-2 py-1"
                          onChange={(event) =>
                            setComponentEditForm((current) =>
                              current ? { ...current, description: event.target.value } : current
                            )
                          }
                          value={componentEditForm.description}
                        />
                        <div className="flex gap-2">
                          <button
                            className="h-8 rounded bg-primary px-3 text-primary-foreground"
                            onClick={() => void saveComponentEdits()}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="h-8 rounded border border-input px-3"
                            onClick={cancelEditComponent}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-foreground">{component.label}</p>
                        <p className="text-muted-foreground">{component.componentKey} | {component.category} | {component.componentType}</p>
                        <div className="mt-1 flex gap-2">
                          <button
                            className="rounded border border-input px-2 py-0.5 text-[11px] hover:bg-accent"
                            onClick={() => startEditComponent(component)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="rounded border border-red-300 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
                            onClick={() => {
                              void deleteComponent(component.componentKey);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Rules ({payload.rules.length})
              </h3>
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {payload.rules.map((rule) => (
                  <div className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs" key={rule.policyId}>
                    <p className="font-semibold text-foreground">{rule.policyId} ({rule.action})</p>
                    <p className="text-muted-foreground">{rule.sourceComponentKey} &rarr; {rule.targetComponentKey}</p>
                    <p className="text-muted-foreground">{rule.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
