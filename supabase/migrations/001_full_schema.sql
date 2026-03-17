-- ============================================================
-- Compliance-as-Code Platform: Full Schema
-- ============================================================

-- Extension for UUID generation (usually pre-installed in Supabase)
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ── Helper: auto-update updated_at ──
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid not null default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  gitlab_repo_path text,
  jira_project_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_pkey primary key (id),
  constraint projects_code_key unique (code)
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at_column();

-- ============================================================
-- DESIGN SUBMISSIONS
-- ============================================================
create table public.design_submissions (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version int not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','under_review','changes_requested','approved','superseded')),
  submitted_by text not null,
  submitted_at timestamptz,
  excel_file_url text,
  idac_yaml text,
  gitlab_commit_sha text,
  mermaid_diagram text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_submissions_pkey primary key (id),
  constraint design_submissions_project_version_key unique (project_id, version)
);

create trigger design_submissions_updated_at
  before update on public.design_submissions
  for each row execute function update_updated_at_column();

create index idx_design_submissions_project on public.design_submissions(project_id);
create index idx_design_submissions_status on public.design_submissions(status);

-- ============================================================
-- DESIGN ROWS (individual connections in a submission)
-- ============================================================
create table public.design_rows (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null references public.design_submissions(id) on delete cascade,
  row_number int not null,
  source_component text not null,
  source_technology text,
  source_zone text not null check (source_zone in ('Internet','DMZ','Intranet')),
  source_ip_subnet text,
  dest_component text not null,
  dest_technology text,
  dest_zone text not null check (dest_zone in ('Internet','DMZ','Intranet')),
  dest_ip_subnet text,
  direction text not null check (direction in ('Inbound','Outbound','Bidirectional')),
  protocol text not null check (protocol in ('TCP','UDP','ICMP','Any')),
  ports text not null,
  action text not null default 'Allow' check (action in ('Allow','Deny')),
  is_common_service boolean not null default false,
  justification text,
  environment text check (environment is null or environment in ('DEV','UAT','PROD')),
  application_id text,
  data_classification text check (
    data_classification is null or
    data_classification in ('Public','Internal','Confidential','Restricted')
  ),
  encryption_required boolean,
  nat_translation text,
  gateway text,
  notes text,
  created_at timestamptz not null default now(),
  constraint design_rows_pkey primary key (id)
);

create index idx_design_rows_submission on public.design_rows(submission_id);
create index idx_design_rows_zones on public.design_rows(source_zone, dest_zone);

-- ============================================================
-- ARB REVIEWS
-- ============================================================
create table public.arb_reviews (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null references public.design_submissions(id) on delete cascade,
  reviewer_id text not null,
  reviewer_team text check (
    reviewer_team is null or reviewer_team in ('ITS','ITIS','PSM','BSA')
  ),
  status text not null default 'pending'
    check (status in ('pending','in_progress','approved','changes_requested')),
  overall_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint arb_reviews_pkey primary key (id)
);

create index idx_arb_reviews_submission on public.arb_reviews(submission_id);
create index idx_arb_reviews_reviewer on public.arb_reviews(reviewer_id);

-- ============================================================
-- ARB ROW FEEDBACK
-- ============================================================
create table public.arb_row_feedback (
  id uuid not null default gen_random_uuid(),
  review_id uuid not null references public.arb_reviews(id) on delete cascade,
  design_row_id uuid not null references public.design_rows(id) on delete cascade,
  status text not null check (status in ('approved','flagged','rejected')),
  comment text not null,
  created_at timestamptz not null default now(),
  constraint arb_row_feedback_pkey primary key (id)
);

create index idx_arb_row_feedback_review on public.arb_row_feedback(review_id);
create index idx_arb_row_feedback_row on public.arb_row_feedback(design_row_id);

-- ============================================================
-- FIREWALL VALIDATIONS (engine runs)
-- ============================================================
create table public.firewall_validations (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  jira_ticket_key text not null,
  design_submission_id uuid references public.design_submissions(id),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  report_url text,
  total_rules int not null default 0,
  approved_count int not null default 0,
  rejected_count int not null default 0,
  clarification_count int not null default 0,
  triggered_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint firewall_validations_pkey primary key (id)
);

create index idx_fw_validations_project on public.firewall_validations(project_id);
create index idx_fw_validations_ticket on public.firewall_validations(jira_ticket_key);

-- ============================================================
-- VALIDATION RESULTS (per firewall rule verdict)
-- ============================================================
create table public.validation_results (
  id uuid not null default gen_random_uuid(),
  validation_id uuid not null references public.firewall_validations(id) on delete cascade,
  fw_rule_ref text not null,
  verdict text not null check (verdict in ('approved','rejected','clarification_needed')),
  confidence float not null default 0.0
    check (confidence >= 0.0 and confidence <= 1.0),
  matched_design_row_id uuid references public.design_rows(id),
  policy_violations text[] not null default '{}',
  reason text not null,
  created_at timestamptz not null default now(),
  constraint validation_results_pkey primary key (id)
);

create index idx_validation_results_validation on public.validation_results(validation_id);

-- ============================================================
-- COMMON SERVICES
-- ============================================================
create table public.common_services (
  id uuid not null default gen_random_uuid(),
  name text not null,
  protocol text not null check (protocol in ('TCP','UDP','ICMP','Any')),
  port text not null,
  source_zone text check (source_zone is null or source_zone in ('Internet','DMZ','Intranet')),
  dest_zone text check (dest_zone is null or dest_zone in ('Internet','DMZ','Intranet')),
  description text,
  provided_by text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint common_services_pkey primary key (id)
);

-- ============================================================
-- GUIDELINES (knowledge base - matches user-provided schema)
-- ============================================================
create table if not exists public.guidelines (
  id uuid not null default gen_random_uuid(),
  caution_id text not null,
  title text not null,
  description text not null,
  category text not null,
  severity text not null,
  required_action text not null,
  context text null,
  example_compliant text null,
  example_violation text null,
  check_logic text null,
  enabled boolean null default true,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  created_by text null,
  updated_by text null,
  version integer null default 1,
  embedding vector(1536) null,
  constraint guidelines_pkey primary key (id),
  constraint guidelines_caution_id_key unique (caution_id),
  constraint guidelines_required_action_check check (
    required_action = any (array['REJECT','REQUEST_INFO','ALLOW_WITH_CONTROLS'])
  ),
  constraint guidelines_severity_check check (
    severity = any (array['HIGH','MEDIUM','LOW'])
  )
);

create index if not exists idx_guidelines_caution_id on public.guidelines(caution_id);
create index if not exists idx_guidelines_category on public.guidelines(category);
create index if not exists idx_guidelines_severity on public.guidelines(severity);
create index if not exists idx_guidelines_enabled on public.guidelines(enabled);
create index if not exists idx_guidelines_embedding on public.guidelines
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger update_guidelines_updated_at
  before update on public.guidelines
  for each row execute function update_updated_at_column();

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table public.audit_log (
  id uuid not null default gen_random_uuid(),
  user_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_pkey primary key (id)
);

create index idx_audit_log_user on public.audit_log(user_id);
create index idx_audit_log_action on public.audit_log(action);
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_log_created on public.audit_log(created_at);
