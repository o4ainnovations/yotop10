'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';
import { formatDate } from '@/lib/dates';

interface PresetDef {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface ModEntry {
  _id: string;
  username: string;
  role: string;
  permissions: string[];
  permissions_version: number;
  is_active: boolean;
  created_at: string;
}

interface ModListResponse {
  mods: ModEntry[];
}

interface PresetsResponse {
  presets: PresetDef[];
}

interface PermissionCatalogResponse {
  permissions: string[];
}

function roleBadgeClasses(role: string): string {
  if (role === 'super_admin') {
    return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
  }
  return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
}

function roleLabel(role: string): string {
  if (role === 'super_admin') return 'Super Admin';
  return 'Mod';
}

export default function AdminModsPage() {
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMod, setEditMod] = useState<ModEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [resetPasswordMod, setResetPasswordMod] = useState<ModEntry | null>(null);

  const fetchMods = useCallback(async () => {
    try {
      const data = await apiFetch<ModListResponse>('/admin/mods');
      setMods(data.mods || []);
    } catch {
      toast.error('Failed to load moderators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  const handleToggleActive = async (mod: ModEntry) => {
    try {
      await apiFetch(`/admin/mods/${mod._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !mod.is_active }),
      });
      toast.success(mod.is_active ? 'Moderator disabled' : 'Moderator enabled');
      fetchMods();
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/admin/mods/${id}`, { method: 'DELETE' });
      toast.success('Moderator removed');
      setShowDeleteConfirm(null);
      fetchMods();
    } catch {
      toast.error('Failed to remove moderator');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white text-lg font-bold">
          Moderators ({mods.length})
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-1.5 cursor-pointer rounded-lg text-white text-xs font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all flex items-center gap-1.5 min-h-9"
        >
          <Icon name="Plus" size={13} />
          Create Moderator
        </button>
      </div>

      {mods.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-12 text-center">
          <Icon name="Shield" size={36} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-white/50 text-sm">
            No moderators yet. Create one to delegate admin tasks.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: card stack */}
          <div className="block lg:hidden space-y-2">
            {mods.map((mod) => (
              <div
                key={mod._id}
                className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">
                    {mod.username}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold uppercase tracking-wide ${roleBadgeClasses(mod.role)}`}
                  >
                    {roleLabel(mod.role)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-3xs text-white/40 flex-wrap">
                  <span>
                    <span className="text-white/60">
                      {mod.permissions?.length || 0}
                    </span>{' '}
                    permissions
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 ${mod.is_active ? 'text-green-400' : 'text-zinc-500'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block ${mod.is_active ? 'bg-green-400' : 'bg-zinc-500'}`}
                    />
                    {mod.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-2xs text-white/30">
                  Created {formatDate(mod.created_at)}
                </div>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <button
                    onClick={() => setEditMod(mod)}
                    className="px-2.5 py-1 rounded-md text-3xs text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer min-h-8"
                  >
                    <Icon name="Pencil" size={11} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(mod)}
                    className={`px-2.5 py-1 rounded-md text-3xs flex items-center gap-1 cursor-pointer min-h-8 transition-colors ${
                      mod.is_active
                        ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20'
                        : 'text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20'
                    }`}
                  >
                    <Icon
                      name={mod.is_active ? 'Ban' : 'Check'}
                      size={11}
                    />
                    {mod.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => setResetPasswordMod(mod)}
                    className="px-2.5 py-1 rounded-md text-3xs text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer min-h-8"
                  >
                    <Icon name="Key" size={11} />
                    Reset
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(mod._id)}
                    className="px-2.5 py-1 rounded-md text-3xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1 cursor-pointer min-h-8"
                  >
                    <Icon name="Trash2" size={11} />
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/40 text-3xs font-semibold uppercase tracking-wider">
                  <th className="pb-2.5 pr-3 font-medium">Username</th>
                  <th className="pb-2.5 pr-3 font-medium">Role</th>
                  <th className="pb-2.5 pr-3 font-medium">Permissions</th>
                  <th className="pb-2.5 pr-3 font-medium">Status</th>
                  <th className="pb-2.5 pr-3 font-medium">Created</th>
                  <th className="pb-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mods.map((mod) => (
                  <tr
                    key={mod._id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 pr-3 text-white font-medium">
                      {mod.username}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold uppercase tracking-wide ${roleBadgeClasses(mod.role)}`}
                      >
                        {roleLabel(mod.role)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-white/60 tabular-nums">
                      {mod.permissions?.length || 0}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-3xs ${mod.is_active ? 'text-green-400' : 'text-zinc-500'}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full inline-block ${mod.is_active ? 'bg-green-400' : 'bg-zinc-500'}`}
                        />
                        {mod.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-white/40 text-xs">
                      {formatDate(mod.created_at)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditMod(mod)}
                          className="px-2.5 py-1 rounded-md text-2xs text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer min-h-8"
                        >
                          <Icon name="Pencil" size={11} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(mod)}
                          className={`px-2.5 py-1 rounded-md text-2xs flex items-center gap-1 cursor-pointer min-h-8 transition-colors ${
                            mod.is_active
                              ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20'
                              : 'text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20'
                          }`}
                        >
                          <Icon
                            name={mod.is_active ? 'Ban' : 'Check'}
                            size={11}
                          />
                          {mod.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => setResetPasswordMod(mod)}
                          className="px-2.5 py-1 rounded-md text-2xs text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer min-h-8"
                        >
                          <Icon name="Key" size={11} />
                          Reset
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(mod._id)}
                          className="px-2.5 py-1 rounded-md text-2xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1 cursor-pointer min-h-8"
                        >
                          <Icon name="Trash2" size={11} />
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create Mod Modal */}
      {showCreateModal && (
        <CreateModModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchMods();
          }}
        />
      )}

      {/* Edit Mod Modal */}
      {editMod && (
        <EditModModal
          mod={editMod}
          onClose={() => setEditMod(null)}
          onUpdated={() => {
            setEditMod(null);
            fetchMods();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordMod && (
        <ResetPasswordModal
          mod={resetPasswordMod}
          onClose={() => setResetPasswordMod(null)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-zinc-900 border border-white/10 w-full h-full sm:h-auto sm:max-w-sm sm:rounded-xl p-5 space-y-4 flex flex-col justify-center sm:block">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                <Icon name="TriangleAlert" size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  Remove Moderator
                </p>
                <p className="text-white/50 text-xs mt-1">
                  This action cannot be undone. The moderator will lose all access.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer min-h-11"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer min-h-11"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Permission Catalog ───────── */

const PERMISSION_CATALOG = [
  'dashboard:read', 'statistics:read',
  'posts:read', 'posts:approve', 'posts:edit', 'posts:delete', 'posts:manage',
  'comments:read', 'comments:moderate', 'comments:penalty', 'comments:delete',
  'users:read', 'users:restrict', 'users:trust',
  'categories:read', 'categories:edit', 'categories:bulk',
  'hof:read', 'hof:manage',
  'alerts:read', 'alerts:manage',
  'audit:read', 'audit:export',
  'search:read', 'search:manage',
  'notifications:read', 'notifications:send',
  'config:read', 'config:write',
  'mods:manage',
] as const;

function permissionLabel(perm: string): string {
  const parts = perm.split(':');
  const category = parts[0] || '';
  const action = parts[1] || '';
  const catLabel =
    category === 'hof' ? 'Hall of Fame' : category.charAt(0).toUpperCase() + category.slice(1);
  return `${catLabel} — ${action}`;
}

function categoryLabel(perm: string): string {
  const category = perm.split(':')[0] || '';
  if (category === 'hof') return 'Hall of Fame';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/* ───────── CreateModModal ───────── */

function CreateModModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [presets, setPresets] = useState<PresetDef[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    Promise.all([
      apiFetch<PresetsResponse>('/admin/mods/presets'),
      apiFetch<PermissionCatalogResponse>('/admin/mods/permissions'),
    ]).then(([presetData, permData]) => {
      setPresets(presetData.presets || []);
      setPermissionCatalog(permData.permissions || PERMISSION_CATALOG as unknown as string[]);
    }).catch(() => {
      setPresets([]);
      setPermissionCatalog([...PERMISSION_CATALOG]);
    });
  }, []);

  const catalogToUse = permissionCatalog.length > 0 ? permissionCatalog : [...PERMISSION_CATALOG] as unknown as string[];

  const handlePresetChange = (name: string) => {
    setSelectedPreset(name);
    if (name) {
      const preset = presets.find((p) => p.name === name);
      if (preset) setSelectedPerms([...preset.permissions]);
    }
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const groupedPerms = catalogToUse.reduce<Record<string, string[]>>(
    (acc, perm) => {
      const cat = categoryLabel(perm);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    },
    {},
  );

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (selectedPerms.length === 0) {
      setError('At least one permission must be selected');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/admin/mods', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          permissions: selectedPerms,
          preset_name: selectedPreset || undefined,
        }),
      });
      toast.success('Moderator created');
      onCreated();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Failed to create moderator';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 transition-colors min-h-9';

  return (
    <ModalShell onClose={onClose} title="Create Moderator">
      {error && (
        <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-white/60 text-3xs font-semibold mb-1">
            Username
          </label>
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="new_mod"
          />
        </div>
        <div>
          <label className="block text-white/60 text-3xs font-semibold mb-1">
            Password
          </label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />
        </div>
      </div>

      <div>
        <label className="block text-white/60 text-3xs font-semibold mb-1.5">
          Preset
        </label>
        <select
          className={inputClass}
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          <option value="" className="bg-zinc-900">Custom permissions</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name} className="bg-zinc-900">
              {p.name} ({p.permissions.length} perms)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-white/60 text-3xs font-semibold mb-1.5">
          Permissions ({selectedPerms.length} selected)
        </label>
        <div className="border border-white/10 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
          {Object.entries(groupedPerms).map(([cat, perms]) => (
            <div key={cat} className="px-3 py-1.5">
              <div className="text-2xs text-white/40 uppercase tracking-wider mb-1">
                {cat}
              </div>
              <div className="flex flex-wrap gap-1">
                {perms.map((perm) => {
                  const isSelected = selectedPerms.includes(perm);
                  return (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => togglePerm(perm)}
                      className={`px-1.5 py-0.5 rounded text-2xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {permissionLabel(perm)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer min-h-11"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3.5 py-1.5 rounded-lg text-xs text-white font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all cursor-pointer disabled:opacity-50 min-h-11"
        >
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────── EditModModal ───────── */

function EditModModal({
  mod,
  onClose,
  onUpdated,
}: {
  mod: ModEntry;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [selectedPerms, setSelectedPerms] = useState<string[]>([...mod.permissions]);
  const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    apiFetch<PermissionCatalogResponse>('/admin/mods/permissions')
      .then((permData) => {
        setPermissionCatalog(permData.permissions || PERMISSION_CATALOG as unknown as string[]);
      })
      .catch(() => {
        setPermissionCatalog([...PERMISSION_CATALOG]);
      });
  }, []);

  const catalogToUse = permissionCatalog.length > 0 ? permissionCatalog : ([...PERMISSION_CATALOG] as unknown as string[]);

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const groupedPerms = catalogToUse.reduce<Record<string, string[]>>(
    (acc, perm) => {
      const cat = categoryLabel(perm);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    },
    {},
  );

  const handleSubmit = async () => {
    if (selectedPerms.length === 0) {
      setError('At least one permission must be selected');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/admin/mods/${mod._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: selectedPerms }),
      });
      toast.success('Moderator updated');
      onUpdated();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Failed to update moderator';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Edit Moderator — ${mod.username}`}>
      {error && (
        <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-white/60 text-3xs font-semibold mb-1.5">
          Permissions ({selectedPerms.length} selected)
        </label>
        <div className="border border-white/10 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
          {Object.entries(groupedPerms).map(([cat, perms]) => (
            <div key={cat} className="px-3 py-1.5">
              <div className="text-2xs text-white/40 uppercase tracking-wider mb-1">
                {cat}
              </div>
              <div className="flex flex-wrap gap-1">
                {perms.map((perm) => {
                  const isSelected = selectedPerms.includes(perm);
                  return (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => togglePerm(perm)}
                      className={`px-1.5 py-0.5 rounded text-2xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {permissionLabel(perm)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer min-h-11"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3.5 py-1.5 rounded-lg text-xs text-white font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all cursor-pointer disabled:opacity-50 min-h-11"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────── ResetPasswordModal ───────── */

function ResetPasswordModal({
  mod,
  onClose,
}: {
  mod: ModEntry;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const inputClass =
    'w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 transition-colors min-h-9';

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/admin/mods/${mod._id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      toast.success('Password reset successfully');
      onClose();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Failed to reset password';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Reset Password — ${mod.username}`}>
      {error && (
        <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-white/60 text-3xs font-semibold mb-1">
          New Password
        </label>
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer min-h-11"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3.5 py-1.5 rounded-lg text-xs text-white font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all cursor-pointer disabled:opacity-50 min-h-11"
        >
          {submitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────── ModalShell ───────── */

function ModalShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:pt-[10vh] p-0 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-white/10 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3 sm:max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
