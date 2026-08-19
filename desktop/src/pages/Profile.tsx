import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { cachedGet, invalidateAll, invalidateByTag } from '../lib/queryCache';
import { useI18n } from '../lib/i18n';
import Badge, { type BadgeTone } from '../components/Badge';
import { CloseIcon } from '../components/icons';
import { toast } from '../lib/toast';

const getId = (value: any) => String(value?._id || value || '');
type AccessRole = 'warden' | 'manager';
const memberRoleTone = (role: string): BadgeTone => {
  if (role === 'owner') return 'accent';
  if (role === 'warden') return 'info';
  if (role === 'manager') return 'warning';
  return 'neutral';
};
type ManagementTab = 'members' | 'invite' | 'requests';
type PortfolioActionTab = 'switch' | 'join' | 'create';

const roleLabel = (role?: string) => {
  if (!role) return '-';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const PropertySelector = ({
  properties,
  selected,
  disabled,
  onToggle
}: {
  properties: any[];
  selected: string[];
  disabled?: boolean;
  onToggle: (propertyId: string) => void;
}) => (
  <div className={`grid gap-2 sm:grid-cols-2 ${disabled ? 'opacity-60' : ''}`}>
    {properties.map((property) => {
      const active = selected.includes(property._id);
      return (
        <button
          key={property._id}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(property._id)}
          className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
            active
              ? 'border-[var(--accent)] bg-[var(--surface-1)] shadow-sm'
              : 'border-black/10 bg-white hover:bg-[var(--surface-1)]'
          }`}
        >
          <div className="font-medium">{property.name}</div>
          <div className="text-xs text-[var(--muted)]">
            {property.city}, {property.state}
          </div>
        </button>
      );
    })}
  </div>
);

const MemberEditorModal = ({
  open,
  member,
  properties,
  roleOptions,
  onClose,
  onSave
}: {
  open: boolean;
  member: any;
  properties: any[];
  roleOptions: AccessRole[];
  onClose: () => void;
  onSave: (payload: { role: AccessRole; propertyIds: string[] }) => Promise<void>;
}) => {
  const [role, setRole] = useState<AccessRole>('manager');
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    setRole((member.role as AccessRole) || 'manager');
    setPropertyIds((member.propertyIds || []).map((propertyId: any) => getId(propertyId)));
  }, [member]);

  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-black/5 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Edit Access</div>
            <div className="mt-2 text-2xl font-semibold">{member.user?.fullName || 'Member'}</div>
            <div className="text-sm text-[var(--muted)]">{member.user?.email || '-'}</div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <label className="text-xs text-[var(--muted)]">Role</label>
            <select
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as AccessRole)}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">Assigned Properties</label>
            <div className="mt-2">
              <PropertySelector
                properties={properties}
                selected={propertyIds}
                onToggle={(propertyId) =>
                  setPropertyIds((current) =>
                    current.includes(propertyId)
                      ? current.filter((entry) => entry !== propertyId)
                      : [...current, propertyId]
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ role, propertyIds });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const { t } = useI18n();
  const [me, setMe] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [portfolioAction, setPortfolioAction] = useState<PortfolioActionTab>('switch');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [dueDates, setDueDates] = useState({
    rentDueDay: '5',
    electricityDueDay: '10',
    maintenanceDueDay: '7',
    reminderLeadDays: '1'
  });
  const [joinCode, setJoinCode] = useState('');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState<any>(null);
  const [inviteRole, setInviteRole] = useState<AccessRole>('manager');
  const [invitePropertyIds, setInvitePropertyIds] = useState<string[]>([]);
  const [requestRoles, setRequestRoles] = useState<Record<string, AccessRole>>({});
  const [requestPropertyIds, setRequestPropertyIds] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<ManagementTab>('members');
  const [editingMember, setEditingMember] = useState<any>(null);
  const [confirmDeletePortfolio, setConfirmDeletePortfolio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const canManageMembers = membership?.role === 'owner' || membership?.role === 'warden';
  const canAssignWarden = membership?.role === 'owner';
  const availableRoleOptions = useMemo<AccessRole[]>(
    () => (canAssignWarden ? ['manager', 'warden'] : ['manager']),
    [canAssignWarden]
  );

  useEffect(() => {
    if (!availableRoleOptions.includes(inviteRole)) {
      setInviteRole(availableRoleOptions[0] || 'manager');
    }
  }, [availableRoleOptions, inviteRole]);

  const applyPortfolioSwitch = (portfolioId: string) => {
    appStorage.setItem('rentdesk_active_portfolio_id', portfolioId);
    window.location.replace('/profile');
  };

  const loadProfile = async (options?: { force?: boolean }) => {
    if (options?.force) invalidateByTag('portfolio');
    setLoading(true);
    try {
      const [meData, portfolioData, portfolioListData] = await Promise.all([
        cachedGet('/auth/me'),
        cachedGet('/portfolio'),
        cachedGet('/portfolio/list')
      ]);
      const nextPortfolio = portfolioData?.portfolio || null;
      const nextProperties = portfolioData?.properties || [];
      const nextMembership = portfolioData?.membership || null;
      const nextPortfolios = portfolioListData?.portfolios || [];
      const nextActivePortfolioId = String(portfolioListData?.activePortfolioId || nextPortfolio?._id || '');
      const nextRoleOptions: AccessRole[] = nextMembership?.role === 'owner' ? ['manager', 'warden'] : ['manager'];

      setMe(meData?.user || null);
      setPortfolio(nextPortfolio);
      setMembership(nextMembership);
      setProperties(nextProperties);
      setPortfolios(nextPortfolios);
      setSelectedPortfolioId(nextActivePortfolioId);
      setInvitePropertyIds(nextProperties.map((property: any) => property._id));
      setInviteRole(nextRoleOptions[0] || 'manager');
      setNewPortfolioName(
        nextPortfolio?.name || `${String(meData?.user?.fullName || 'My').split(' ')[0] || 'My'} Portfolio`
      );
      setDueDates({
        rentDueDay: String(nextPortfolio?.rentDueDay ?? 5),
        electricityDueDay: String(nextPortfolio?.electricityDueDay ?? 10),
        maintenanceDueDay: String(nextPortfolio?.maintenanceDueDay ?? 7),
        reminderLeadDays: String(nextPortfolio?.reminderLeadDays ?? 1)
      });
      if (nextActivePortfolioId) {
        appStorage.setItem('rentdesk_active_portfolio_id', nextActivePortfolioId);
      }

      const nextRoles: Record<string, AccessRole> = {};
      const nextSelections: Record<string, string[]> = {};
      (nextPortfolio?.joinRequests || []).forEach((request: any) => {
        nextRoles[request._id] = nextRoleOptions[0] || 'manager';
        nextSelections[request._id] = nextProperties.map((property: any) => property._id);
      });
      setRequestRoles(nextRoles);
      setRequestPropertyIds(nextSelections);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to load profile right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  useEffect(() => {
    if (!canManageMembers || inviteQuery.trim().length < 2) {
      setInviteResults([]);
      setSearchingUsers(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const queryKey = inviteQuery.includes('@') ? 'email' : 'name';
        const response = await api.get(`/users?${queryKey}=${encodeURIComponent(inviteQuery.trim())}`);
        const existingMemberIds = new Set((portfolio?.members || []).map((member: any) => getId(member.user)));
        setInviteResults((response.data || []).filter((user: any) => !existingMemberIds.has(getId(user))));
      } catch {
        setInviteResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [inviteQuery, canManageMembers, portfolio]);

  const propertyNameMap = useMemo(() => new Map(properties.map((property) => [property._id, property.name])), [properties]);
  const assignedProperties = useMemo(() => {
    const allowed = new Set((membership?.propertyIds || []).map((entry: any) => getId(entry)));
    return membership?.role === 'owner' ? properties : properties.filter((property) => allowed.has(property._id));
  }, [membership, properties]);

  const canEditMember = (member: any) => {
    if (!canManageMembers) return false;
    if (getId(member.user) === getId(me?._id) && member.role === 'owner') return false;
    if (member.role === 'owner') return false;
    if (membership?.role === 'warden') return member.role === 'manager';
    return true;
  };

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error(t('Enter the 7-digit portfolio code first.'));
      return;
    }

    setSaving(true);
    try {
      await api.post('/portfolio/join-requests', { code: joinCode.trim() });
      setJoinCode('');
      toast.success(t('Join request sent.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to send join request right now.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/portfolio/create', { name: newPortfolioName.trim() });
      const nextPortfolioId = getId(response.data?.portfolio?._id);
      if (nextPortfolioId) {
        applyPortfolioSwitch(nextPortfolioId);
        return;
      }
      setSaving(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to create portfolio right now.'));
      setSaving(false);
    }
  };

  const handleSwitchPortfolio = async () => {
    if (!selectedPortfolioId || selectedPortfolioId === getId(portfolio?._id)) return;
    setSaving(true);
    try {
      const response = await api.post('/portfolio/switch', { portfolioId: selectedPortfolioId });
      const nextPortfolioId = getId(response.data?.activePortfolioId || selectedPortfolioId);
      if (nextPortfolioId) {
        applyPortfolioSwitch(nextPortfolioId);
        return;
      }
      setSaving(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Unable to switch portfolio right now.');
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInviteUser?._id) {
      toast.error(t('Choose a registered user first.'));
      return;
    }

    setSaving(true);
    try {
      await api.post('/portfolio/invite', {
        userId: selectedInviteUser._id,
        role: inviteRole,
        propertyIds: invitePropertyIds
      });
      await loadProfile({ force: true });
      setInviteQuery('');
      setSelectedInviteUser(null);
      setInviteResults([]);
      toast.success(t('Member added.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to add member.'));
    } finally {
      setSaving(false);
    }
  };

  const handleJoinDecision = async (requestId: string, action: 'approve' | 'reject') => {
    setSaving(true);
    try {
      if (action === 'approve') {
        await api.post(`/portfolio/join-requests/${requestId}/approve`, {
          role: requestRoles[requestId] || availableRoleOptions[0] || 'manager',
          propertyIds: requestPropertyIds[requestId] || []
        });
      } else {
        await api.post(`/portfolio/join-requests/${requestId}/reject`);
      }
      await loadProfile({ force: true });
      toast.success(action === 'approve' ? t('Request approved.') : t('Request denied.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to update request right now.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDueDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/portfolio/settings', {
        rentDueDay: Number(dueDates.rentDueDay),
        electricityDueDay: Number(dueDates.electricityDueDay),
        maintenanceDueDay: Number(dueDates.maintenanceDueDay),
        reminderLeadDays: Number(dueDates.reminderLeadDays)
      });
      await loadProfile({ force: true });
      toast.success(t('Due dates updated.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to update due dates.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setSaving(true);
    try {
      await api.delete(`/portfolio/members/${memberId}`);
      await loadProfile({ force: true });
      toast.success(t('Member removed.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to remove member.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMember = async (memberId: string, payload: { role: AccessRole; propertyIds: string[] }) => {
    try {
      await api.patch(`/portfolio/members/${memberId}`, payload);
      await loadProfile({ force: true });
      toast.success(t('Member updated.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to update member.'));
      throw err;
    }
  };

  const handleCopyCode = async () => {
    if (!portfolio?.joinCode) return;
    try {
      await navigator.clipboard.writeText(portfolio.joinCode);
      toast.success(t('Portfolio code copied.'));
    } catch {
      toast.error(t('Unable to copy the portfolio code right now.'));
    }
  };

  const handleDeletePortfolio = async () => {
    if (membership?.role !== 'owner' || !portfolio?._id) return;

    setSaving(true);
    try {
      const response = await api.delete('/portfolio');
      const nextActivePortfolioId = getId(response.data?.activePortfolioId);
      if (nextActivePortfolioId) {
        appStorage.setItem('rentdesk_active_portfolio_id', nextActivePortfolioId);
      } else {
        appStorage.removeItem('rentdesk_active_portfolio_id');
      }
      invalidateAll();
      window.location.replace('/profile');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to delete this portfolio.'));
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">{t('Loading profile...')}</div>;
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Profile</div>
              <div className="mt-2 text-3xl font-semibold">{me?.fullName || 'RentDesk User'}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{me?.email || '-'}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-wide text-emerald-700">Current Role</div>
              <div className="mt-1 text-xl font-semibold capitalize text-emerald-950">
                {membership?.role || me?.role || '-'}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_180px_140px]">
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Portfolio</label>
              <select
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
              >
                {portfolios.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Properties</div>
              <div className="mt-2 text-2xl font-semibold">{assignedProperties.length}</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary self-end !py-3"
              disabled={saving || !selectedPortfolioId || selectedPortfolioId === getId(portfolio?._id)}
              onClick={() => void handleSwitchPortfolio()}
            >
              Switch
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            {portfolios.map((entry) => (
              <span
                key={entry._id}
                className={`rounded-full border px-3 py-1 ${
                  getId(entry._id) === getId(portfolio?._id)
                    ? 'border-[var(--accent)] bg-[var(--surface-1)] text-[var(--accent)]'
                    : 'border-black/10 bg-white'
                }`}
              >
                {entry.name}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2 rounded-2xl bg-[var(--surface-1)] p-1">
            {([
              { key: 'switch', label: 'Current Code' },
              { key: 'join', label: 'Join Another' },
              { key: 'create', label: 'Create New' }
            ] as Array<{ key: PortfolioActionTab; label: string }>).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  portfolioAction === tab.key ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
                }`}
                onClick={() => {
                  setPortfolioAction(tab.key);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {portfolioAction === 'switch' ? (
            <div className="mt-5 space-y-4">
              {canManageMembers && portfolio?.joinCode ? (
                <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Active Portfolio Code</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="font-semibold tracking-[0.22em]">{portfolio.joinCode}</div>
                    <button
                      type="button"
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs hover:bg-black/5"
                      onClick={handleCopyCode}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--muted)]">
                Use the selector on the left to move between joined portfolios.
              </div>
            </div>
          ) : null}

          {portfolioAction === 'join' ? (
            <form onSubmit={handleJoinRequest} className="mt-5 space-y-4">
              <input
                className="w-full rounded-2xl border border-black/10 px-4 py-3 text-center text-sm tracking-[0.32em]"
                placeholder="1234567"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 7))}
              />
              <button
                type="submit"
                className="btn btn-primary w-full !py-3"
                disabled={saving}
              >
                {saving ? 'Sending...' : 'Send Request'}
              </button>
            </form>
          ) : null}

          {portfolioAction === 'create' ? (
            <form onSubmit={handleCreatePortfolio} className="mt-5 space-y-4">
              <input
                className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm"
                placeholder="New portfolio name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary w-full !py-3"
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Portfolio'}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {membership?.role === 'owner' ? (
        <form onSubmit={handleSaveDueDates} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Due Dates</div>
              <div className="mt-2 text-2xl font-semibold">Set payment deadlines</div>
            </div>
            <button
              type="submit"
              className="btn btn-primary !py-2.5"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              { key: 'rentDueDay', label: 'Rent Due Day' },
              { key: 'electricityDueDay', label: 'Electricity Due Day' },
              { key: 'maintenanceDueDay', label: 'Maintenance Due Day' },
              { key: 'reminderLeadDays', label: 'Reminder Start Before (Days)' }
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs text-[var(--muted)]">{field.label}</span>
                <input
                  type="number"
                  min={field.key === 'reminderLeadDays' ? 0 : 1}
                  max={field.key === 'reminderLeadDays' ? 7 : 28}
                  value={dueDates[field.key as keyof typeof dueDates]}
                  onChange={(e) =>
                    setDueDates((current) => ({
                      ...current,
                      [field.key]: e.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm"
                />
              </label>
            ))}
          </div>
        </form>
      ) : null}

      {membership?.role === 'owner' ? (
        <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-red-500">Portfolio</div>
              <div className="mt-2 text-2xl font-semibold">Delete current portfolio</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                This removes all properties, units, tenants, records, and payments inside this portfolio.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger !py-2.5"
              disabled={saving}
              onClick={() => setConfirmDeletePortfolio((current) => !current)}
            >
              Delete Portfolio
            </button>
          </div>

          {confirmDeletePortfolio ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-medium text-red-800">Delete {portfolio?.name || 'this portfolio'}?</div>
              <div className="mt-1 text-sm text-red-700">
                This cannot be undone. If you belong to other portfolios, RentDesk will switch to the next one.
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn btn-danger-solid"
                  disabled={saving}
                  onClick={() => void handleDeletePortfolio()}
                >
                  {saving ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={saving}
                  onClick={() => setConfirmDeletePortfolio(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Assigned Properties</div>
          <div className="mt-2 text-2xl font-semibold">{portfolio?.name || 'Current Portfolio'}</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assignedProperties.length ? (
            assignedProperties.map((property) => (
              <div key={property._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
                <div className="font-medium">{property.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {property.city}, {property.state}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 bg-[var(--surface-1)] px-4 py-6 text-sm text-[var(--muted)]">
              No properties assigned in this portfolio.
            </div>
          )}
        </div>
      </div>

      {portfolio && canManageMembers ? (
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Portfolio Access</div>
              <div className="mt-2 text-2xl font-semibold">Manage members</div>
            </div>
            <div className="flex flex-wrap gap-2 rounded-2xl bg-[var(--surface-1)] p-1">
              {([
                { key: 'members', label: 'Members' },
                { key: 'invite', label: 'Invite' },
                { key: 'requests', label: `Requests${portfolio.joinRequests?.length ? ` (${portfolio.joinRequests.length})` : ''}` }
              ] as Array<{ key: ManagementTab; label: string }>).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    activeTab === tab.key ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'members' ? (
            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {(portfolio.members || []).map((member: any) => (
                <div key={member._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{member.user?.fullName || 'Member'}</div>
                      <div className="truncate text-sm text-[var(--muted)]">{member.user?.email || '-'}</div>
                    </div>
                    <Badge tone={memberRoleTone(member.role)} className="capitalize">
                      {member.role}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(member.propertyIds || []).map((propertyId: any) => (
                      <span
                        key={getId(propertyId)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[var(--muted)]"
                      >
                        {propertyNameMap.get(getId(propertyId)) || 'Property'}
                      </span>
                    ))}
                  </div>

                  {canEditMember(member) ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-warning"
                        onClick={() => setEditingMember(member)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => void handleRemoveMember(member._id)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'invite' ? (
            <form onSubmit={handleInvite} className="mt-5 grid gap-4 xl:grid-cols-[1fr_240px]">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Search registered user</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm"
                    value={inviteQuery}
                    onChange={(e) => {
                      setInviteQuery(e.target.value);
                      setSelectedInviteUser(null);
                    }}
                    placeholder="Name or email"
                  />
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {searchingUsers ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-[var(--surface-1)] px-3 py-3 text-sm text-[var(--muted)]">
                        Searching...
                      </div>
                    ) : inviteResults.length ? (
                      inviteResults.map((user) => (
                        <button
                          key={user._id}
                          type="button"
                          onClick={() => {
                            setSelectedInviteUser(user);
                            setInviteQuery(`${user.fullName} - ${user.email}`);
                            setInviteResults([]);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm ${
                            getId(selectedInviteUser) === getId(user)
                              ? 'border-[var(--accent)] bg-[var(--surface-1)]'
                              : 'border-black/10 bg-white hover:bg-[var(--surface-1)]'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{user.fullName}</div>
                            <div className="text-xs text-[var(--muted)]">{user.email}</div>
                          </div>
                          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{user.role}</div>
                        </button>
                      ))
                    ) : inviteQuery.trim().length >= 2 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-[var(--surface-1)] px-3 py-3 text-sm text-[var(--muted)]">
                        No match found.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted)]">Assigned properties</label>
                  <div className="mt-2">
                    <PropertySelector
                      properties={properties}
                      selected={invitePropertyIds}
                      onToggle={(propertyId) =>
                        setInvitePropertyIds((current) =>
                          current.includes(propertyId)
                            ? current.filter((entry) => entry !== propertyId)
                            : [...current, propertyId]
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] p-4">
                <label className="text-xs text-[var(--muted)]">Role</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AccessRole)}
                >
                  {availableRoleOptions.map((option) => (
                    <option key={option} value={option}>
                      {roleLabel(option)}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="btn btn-primary w-full !py-2.5 mt-4"
                  disabled={saving || !selectedInviteUser}
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          ) : null}

          {activeTab === 'requests' ? (
            <div className="mt-5 space-y-3">
              {(portfolio.joinRequests || []).length ? (
                portfolio.joinRequests.map((request: any) => {
                  const selectedRole = requestRoles[request._id] || availableRoleOptions[0] || 'manager';
                  const selectedProperties = requestPropertyIds[request._id] || [];

                  return (
                    <div key={request._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{request.user?.fullName || 'Registered user'}</div>
                          <div className="text-sm text-[var(--muted)]">{request.user?.email || '-'}</div>
                        </div>
                        <select
                          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                          value={selectedRole}
                          onChange={(e) =>
                            setRequestRoles((current) => ({
                              ...current,
                              [request._id]: e.target.value as AccessRole
                            }))
                          }
                        >
                          {availableRoleOptions.map((option) => (
                            <option key={option} value={option}>
                              {roleLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-4">
                        <PropertySelector
                          properties={properties}
                          selected={selectedProperties}
                          onToggle={(propertyId) =>
                            setRequestPropertyIds((current) => {
                              const existing = current[request._id] || [];
                              return {
                                ...current,
                                [request._id]: existing.includes(propertyId)
                                  ? existing.filter((entry) => entry !== propertyId)
                                  : [...existing, propertyId]
                              };
                            })
                          }
                        />
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => void handleJoinDecision(request._id, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => void handleJoinDecision(request._id, 'reject')}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 bg-[var(--surface-1)] px-4 py-6 text-sm text-[var(--muted)]">
                  No pending requests.
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <MemberEditorModal
        open={Boolean(editingMember)}
        member={editingMember}
        properties={properties}
        roleOptions={membership?.role === 'owner' ? ['manager', 'warden'] : ['manager']}
        onClose={() => setEditingMember(null)}
        onSave={(payload) => handleUpdateMember(editingMember._id, payload)}
      />
    </div>
  );
};

export default Profile;
