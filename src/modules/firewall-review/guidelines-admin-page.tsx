'use client';

import { useState, useEffect } from 'react';
import type { Guideline } from '@/modules/firewall-review/lib/supabase/types';

export default function GuidelinesAdminPage() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<Guideline | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch guidelines
  const fetchGuidelines = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/firewall-review/guidelines?${params}`);
      if (!res.ok) throw new Error('Failed to fetch guidelines');
      
      const data = await res.json();
      setGuidelines(data.guidelines || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidelines();
  }, [categoryFilter, searchTerm]);

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(guidelines.map(g => g.category)))];

  // Handle create/update
  const handleSave = async (formData: Partial<Guideline>) => {
    try {
      setSaving(true);
      const method = editingGuideline ? 'PUT' : 'POST';
      const body = editingGuideline 
        ? { id: editingGuideline.id, ...formData }
        : formData;

      const res = await fetch('/api/firewall-review/guidelines/manage', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || 'Failed to save guideline');
      }

      await fetchGuidelines();
      setShowModal(false);
      setEditingGuideline(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this guideline?')) return;

    try {
      const res = await fetch(`/api/firewall-review/guidelines/manage?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete guideline');
      
      await fetchGuidelines();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (guideline: Guideline) => {
    try {
      const res = await fetch('/api/firewall-review/guidelines/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guideline.id,
          enabled: !guideline.enabled,
        }),
      });

      if (!res.ok) throw new Error('Failed to update guideline');
      
      await fetchGuidelines();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Guidelines Management
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Manage security guidelines and rules for firewall reviews
              </p>
            </div>
            <button
              onClick={() => {
                setEditingGuideline(null);
                setShowModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Guideline
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <input
              type="text"
              placeholder="Search guidelines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Guidelines List */}
        {!loading && guidelines.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-zinc-200 dark:text-zinc-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400">No guidelines found</p>
          </div>
        )}

        {!loading && guidelines.length > 0 && (
          <div className="space-y-4">
            {guidelines.map((guideline) => (
              <GuidelineCard
                key={guideline.id}
                guideline={guideline}
                onEdit={() => {
                  setEditingGuideline(guideline);
                  setShowModal(true);
                }}
                onDelete={() => handleDelete(guideline.id)}
                onToggleEnabled={() => handleToggleEnabled(guideline)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <GuidelineModal
          guideline={editingGuideline}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingGuideline(null);
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

// Guideline Card Component
function GuidelineCard({ 
  guideline, 
  onEdit, 
  onDelete, 
  onToggleEnabled 
}: { 
  guideline: Guideline; 
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}) {
  const severityColors = {
    HIGH: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    MEDIUM: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    LOW: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  };

  return (
    <div className={`p-5 rounded-xl border ${guideline.enabled ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900' : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
              {guideline.caution_id}
            </span>
            <span className={`text-xs px-2 py-1 rounded-lg font-medium ${severityColors[guideline.severity]}`}>
              {guideline.severity}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {guideline.category}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {guideline.title}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            {guideline.description}
          </p>
          {guideline.context && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500 italic mb-2">
              Context: {guideline.context}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Version {guideline.version}</span>
            <span>??/span>
            <span>Updated {new Date(guideline.updated_at).toLocaleDateString()}</span>
            {guideline.updated_by && (
              <>
                <span>??/span>
                <span>by {guideline.updated_by}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleEnabled}
            className={`p-2 rounded-lg transition-colors ${guideline.enabled ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
            title={guideline.enabled ? 'Disable' : 'Enable'}
          >
            <svg className={`w-5 h-5 ${guideline.enabled ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={guideline.enabled ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Examples Section */}
      {(guideline.example_compliant || guideline.example_violation) && (
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="grid md:grid-cols-2 gap-4">
            {guideline.example_compliant && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                <h4 className="text-xs font-semibold text-green-800 dark:text-green-400 mb-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Compliant Example
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300">{guideline.example_compliant}</p>
              </div>
            )}
            {guideline.example_violation && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                <h4 className="text-xs font-semibold text-red-800 dark:text-red-400 mb-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Violation Example
                </h4>
                <p className="text-xs text-red-700 dark:text-red-300">{guideline.example_violation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Component (continued in next file due to length)
function GuidelineModal({
  guideline,
  onSave,
  onClose,
  saving
}: {
  guideline: Guideline | null;
  onSave: (data: Partial<Guideline>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<Guideline>>(
    guideline || {
      caution_id: '',
      title: '',
      description: '',
      category: '',
      severity: 'MEDIUM',
      required_action: 'REQUEST_INFO',
      context: '',
      example_compliant: '',
      example_violation: '',
      check_logic: '',
      enabled: true,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {guideline ? 'Edit Guideline' : 'Add New Guideline'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Caution ID *
              </label>
              <input
                type="text"
                required
                value={formData.caution_id}
                onChange={(e) => setFormData({ ...formData, caution_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="C-XXX-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category *
              </label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Network Security"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Severity *
              </label>
              <select
                required
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Required Action *
              </label>
              <select
                required
                value={formData.required_action}
                onChange={(e) => setFormData({ ...formData, required_action: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="REJECT">REJECT</option>
                <option value="REQUEST_INFO">REQUEST_INFO</option>
                <option value="ALLOW_WITH_CONTROLS">ALLOW_WITH_CONTROLS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Context
            </label>
            <textarea
              rows={2}
              value={formData.context || ''}
              onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional context or background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Compliant Example
            </label>
            <textarea
              rows={2}
              value={formData.example_compliant || ''}
              onChange={(e) => setFormData({ ...formData, example_compliant: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Example of following this guideline"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Violation Example
            </label>
            <textarea
              rows={2}
              value={formData.example_violation || ''}
              onChange={(e) => setFormData({ ...formData, example_violation: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Example of violating this guideline"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Check Logic (optional)
            </label>
            <textarea
              rows={3}
              value={formData.check_logic || ''}
              onChange={(e) => setFormData({ ...formData, check_logic: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Pseudocode or logic description"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            <label htmlFor="enabled" className="text-sm text-zinc-700 dark:text-zinc-300">
              Enabled
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : guideline ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

