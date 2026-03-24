-- =====================================================================
-- Migration 010: Cleanup Obsolete Components
-- =====================================================================
-- This migration removes obsolete components from the old hierarchy
-- that should not exist after migration 009
-- =====================================================================

-- Remove obsolete validation rules referencing old components
DELETE FROM public.workflow_canvas_validation_rules
WHERE source_component_key IN (
  'zone-internal-network',
  'zone-aws-private-cloud',
  'proxy-public-facing',
  'proxy-internal-facing',
  'zone-environment'
)
OR target_component_key IN (
  'zone-internal-network',
  'zone-aws-private-cloud',
  'proxy-public-facing',
  'proxy-internal-facing',
  'zone-environment'
);

-- Fix parent references before deleting
UPDATE public.workflow_canvas_components
SET parent_component_key = NULL
WHERE parent_component_key IN (
  'zone-internal-network',
  'zone-aws-private-cloud',
  'zone-environment'
);

-- Delete obsolete components
DELETE FROM public.workflow_canvas_components
WHERE component_key IN (
  'zone-internal-network',
  'zone-aws-private-cloud',
  'proxy-public-facing',
  'proxy-internal-facing',
  'zone-environment'
);

-- Verify: List remaining components by category
-- SELECT category, COUNT(*) as count, array_agg(component_key ORDER BY component_key) as keys
-- FROM public.workflow_canvas_components
-- WHERE enabled = true
-- GROUP BY category
-- ORDER BY category;
