'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';
import { UserRow } from '@/components/admin/UserRow';
import { EditTrustModal } from '@/components/admin/EditTrustModal';
import { OverrideRateModal } from '@/components/admin/OverrideRateModal';
import { RestrictUserModal } from '@/components/admin/RestrictUserModal';
import { GlobalConfigModal } from '@/components/admin/GlobalConfigModal';
import type { UserSummary, UserListResponse, SystemConfig, ConfigImpact } from '@/lib/api/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [trustFilter, setTrustFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [sortDir, setSortDir] = useState('desc');
  const [searchVal, setSearchVal] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});

  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [modal, setModal] = useState<'trust' | 'rate' | 'restrict' | 'config' | null>(null);

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const fetchUsers = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: '20', sort, sort_dir: sortDir, stats: 'true' };
      if (debouncedSearch) params.q = debouncedSearch;
      if (trustFilter) params.trust_tier = trustFilter;
      if (statusFilter) params.status = statusFilter;
      const qs = new URLSearchParams(params).toString();
      const data = await apiFetch<UserListResponse>(`/admin/users?${qs}`);
      setUsers(data.users);
      setPagination(data.pagination);
      setStats(data.stats || {});
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, trustFilter, statusFilter, sort, sortDir]);

  useEffect(() => { fetchUsers(page); }, [page, fetchUsers]);

  useEffect(() => {
    apiFetch<SystemConfig>('/admin/config').then(setConfig).catch(() => {});
  }, []);

  const handleAction = (user: UserSummary, action: 'trust' | 'rate' | 'restrict') => {
    setSelectedUser(user);
    setModal(action);
  };

  const handleSaveTrust = async (userId: string, data: { score: number; lock: boolean; reason: string }) => {
    try {
      await apiFetch(`/admin/users/${userId}/trust`, {
        method: 'PATCH',
        body: JSON.stringify({ trust_score: data.score, lock_trust: data.lock, reason: data.reason }),
      });
      toast.success('Trust score updated');
      fetchUsers(page);
    } catch {
      toast.error('Failed to update trust score');
    }
  };

  const handleSaveRate = async (userId: string, data: { posts_per_hour: number | null; comments_per_hour: number | null }) => {
    try {
      await apiFetch(`/admin/users/${userId}/rate-limits`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      toast.success('Rate limits updated');
      fetchUsers(page);
    } catch {
      toast.error('Failed to update rate limits');
    }
  };

  const handleSaveRestrict = async (userId: string, data: { restrict: boolean; until: string | null }) => {
    try {
      await apiFetch(`/admin/users/${userId}/restrict`, {
        method: 'PATCH',
        body: JSON.stringify({ restrict: data.restrict, restrict_until: data.until }),
      });
      toast.success('User restriction updated');
      fetchUsers(page);
    } catch {
      toast.error('Failed to update restriction');
    }
  };

  const handleSaveConfig = async (cfg: SystemConfig) => {
    try {
      await apiFetch('/admin/config', { method: 'PUT', body: JSON.stringify(cfg) });
      setConfig(cfg);
      toast.success('Config saved');
    } catch {
      toast.error('Failed to save config');
    }
  };

  const handlePreviewImpact = async (cfg: SystemConfig): Promise<ConfigImpact | null> => {
    try {
      const result = await apiFetch<ConfigImpact>('/admin/config/impact', { method: 'POST', body: JSON.stringify(cfg) });
      return result;
    } catch {
      toast.error('Failed to preview impact');
      return null;
    }
  };

  const filterSelectClass = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none min-h-[36px]';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white text-lg font-bold">Users ({pagination.total})</h2>
        <button
          onClick={() => setModal('config')}
          className="px-3 py-1.5 cursor-pointer bg-white/5 border border-white/10 rounded-lg text-white text-xs hover:bg-white/10 transition-colors flex items-center gap-1.5"
        >
          <Icon name="Settings" size={13} />
          Global Config
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(stats).filter(([k]) => k !== 'total').map(([k, v]) => (
          <div
            key={k}
            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white/60"
          >
            <strong className="text-white">{k.replace(/_/g, ' ')}</strong>: {v}
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search users..."
          value={searchVal}
          onChange={e => handleSearchChange(e.target.value)}
          className={`${filterSelectClass} w-[180px]`}
        />

        <select
          value={trustFilter}
          onChange={e => { setTrustFilter(e.target.value); setPage(1); }}
          className={filterSelectClass}
        >
          <option value="" className="bg-zinc-900">All Trust</option>
          <option value="troll" className="bg-zinc-900">Troll</option>
          <option value="neutral" className="bg-zinc-900">Neutral</option>
          <option value="scholar" className="bg-zinc-900">Scholar</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className={filterSelectClass}
        >
          <option value="" className="bg-zinc-900">All Status</option>
          <option value="active" className="bg-zinc-900">Active</option>
          <option value="restricted" className="bg-zinc-900">Restricted</option>
        </select>

        <select
          value={sort}
          onChange={e => { setSort(e.target.value); setPage(1); }}
          className={filterSelectClass}
        >
          <option value="newest" className="bg-zinc-900">Newest</option>
          <option value="oldest" className="bg-zinc-900">Oldest</option>
          <option value="highest_trust" className="bg-zinc-900">Highest Trust</option>
          <option value="lowest_trust" className="bg-zinc-900">Lowest Trust</option>
          <option value="most_posts" className="bg-zinc-900">Most Posts</option>
        </select>

        <button
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className={filterSelectClass}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          <Icon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={13} />
        </button>
      </div>

      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-white/40">No users found.</p>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden flex flex-col gap-2">
            {users.map(u => (
              <UserRow
                key={u._id}
                user={u}
                isMobile
                onAction={handleAction}
                onClickRow={() => { /* future: user detail */ }}
              />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-white/10 text-left text-white/40">
                  <th className="p-1.5">User</th>
                  <th className="p-1.5">Trust</th>
                  <th className="p-1.5">Activity</th>
                  <th className="p-1.5">Rate/h</th>
                  <th className="p-1.5 text-center">Status</th>
                  <th className="p-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow
                    key={u._id}
                    user={u}
                    onAction={handleAction}
                    onClickRow={() => { /* future: user detail */ }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex gap-2 items-center">
        <button
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
          className={`px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm min-h-[36px] ${page <= 1 ? 'opacity-40 cursor-not-allowed bg-white/5' : 'cursor-pointer bg-white/5 hover:bg-white/10'}`}
        >
          Prev
        </button>
        <span className="text-white/60 text-[13px]">Page {page} of {pagination.totalPages}</span>
        <button
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(p => p + 1)}
          className={`px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm min-h-[36px] ${page >= pagination.totalPages ? 'opacity-40 cursor-not-allowed bg-white/5' : 'cursor-pointer bg-white/5 hover:bg-white/10'}`}
        >
          Next
        </button>
      </div>

      {modal === 'trust' && selectedUser && (
        <EditTrustModal
          user={selectedUser}
          onClose={() => { setModal(null); setSelectedUser(null); }}
          onSave={handleSaveTrust}
        />
      )}

      {modal === 'rate' && selectedUser && (
        <OverrideRateModal
          user={selectedUser}
          onClose={() => { setModal(null); setSelectedUser(null); }}
          onSave={handleSaveRate}
        />
      )}

      {modal === 'restrict' && selectedUser && (
        <RestrictUserModal
          user={selectedUser}
          onClose={() => { setModal(null); setSelectedUser(null); }}
          onSave={handleSaveRestrict}
        />
      )}

      {modal === 'config' && (
        <GlobalConfigModal
          config={config}
          onClose={() => setModal(null)}
          onSave={handleSaveConfig}
          onPreviewImpact={handlePreviewImpact}
        />
      )}
    </div>
  );
}
