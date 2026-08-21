import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { cachedGet, invalidateAll, invalidateByTag } from '../lib/queryCache';
import { useI18n } from '../lib/i18n';
import Badge, { type BadgeTone } from '../components/Badge';
import { CloseIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/icons';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';
import FieldError from '../components/FieldError';
import { SettingsSection } from '../components/SettingsRow';
import { isBlank, isValidEmail, isValidPhone, requiredMsg, type FieldErrors } from '../lib/validation';

const getId = (value: any) => String(value?._id || value || '');
type AccessRole = 'warden' | 'manager';
const memberRoleTone = (role: string): BadgeTone => {
  if (role === 'owner') return 'accent';
  if (role === 'warden') return 'info';
  if (role === 'manager') return 'warning';
  return 'neutral';
};
type ManagementTab = 'members' | 'invite' | 'requests';
type PortfolioActionTab = 'join' | 'create';

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
  const [portfolioAction, setPortfolioAction] = useState<PortfolioActionTab>('join');
  const [showPortfolioActionModal, setShowPortfolioActionModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [dueDates, setDueDates] = useState({
    rentDueDay: '5',
    electricityDueDay: '10',
    maintenanceDueDay: '7',
    reminderLeadDays: '1'
  });
  const [portfolioNameInput, setPortfolioNameInput] = useState('');
  const [portfolioNameError, setPortfolioNameError] = useState<string | undefined>();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | undefined>();
  const [newPortfolioNameError, setNewPortfolioNameError] = useState<string | undefined>();
  const [inviteErrors, setInviteErrors] = useState<FieldErrors>({});
  const [dueDatesErrors, setDueDatesErrors] = useState<FieldErrors>({});
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [editEmailInput, setEditEmailInput] = useState('');
  const [editPhoneInput, setEditPhoneInput] = useState('');
  const [editProfileErrors, setEditProfileErrors] = useState<FieldErrors>({});

  const initials = useMemo(() => {
    const name = me?.fullName as string | undefined;
    if (!name) return 'RD';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [me]);

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
      setPortfolioNameInput(nextPortfolio?.name || '');
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
      setJoinCodeError(t('Enter the 7-digit portfolio code first.'));
      return;
    }
    setJoinCodeError(undefined);

    setSaving(true);
    try {
      await api.post('/portfolio/join-requests', { code: joinCode.trim() });
      setJoinCode('');
      setShowPortfolioActionModal(false);
      toast.success(t('Join request sent.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to send join request right now.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlank(newPortfolioName)) {
      setNewPortfolioNameError(requiredMsg('Portfolio name'));
      return;
    }
    setNewPortfolioNameError(undefined);
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

  const handleSwitchPortfolio = async (targetId?: string) => {
    const nextId = targetId || selectedPortfolioId;
    if (!nextId || nextId === getId(portfolio?._id)) return;
    setSaving(true);
    try {
      const response = await api.post('/portfolio/switch', { portfolioId: nextId });
      const nextPortfolioId = getId(response.data?.activePortfolioId || nextId);
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

  const handlePortfolioSelectChange = async (nextId: string) => {
    if (!nextId || nextId === getId(portfolio?._id)) return;
    const target = portfolios.find((entry) => getId(entry._id) === nextId);
    const ok = await confirmDialog({
      title: `Switch to ${target?.name || 'this portfolio'}?`,
      description: 'RentDesk will reload with data from this portfolio.',
      confirmLabel: 'Switch'
    });
    if (!ok) return;
    setSelectedPortfolioId(nextId);
    await handleSwitchPortfolio(nextId);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInviteUser?._id) {
      setInviteErrors({ inviteQuery: t('Choose a registered user first.') });
      return;
    }
    setInviteErrors({});

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
    const next: FieldErrors = {};
    (['rentDueDay', 'electricityDueDay', 'maintenanceDueDay'] as const).forEach((key) => {
      const value = Number(dueDates[key]);
      if (!Number.isInteger(value) || value < 1 || value > 28) next[key] = 'Must be between 1 and 28';
    });
    const leadDays = Number(dueDates.reminderLeadDays);
    if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 7) next.reminderLeadDays = 'Must be between 0 and 7';
    setDueDatesErrors(next);
    const trimmedName = portfolioNameInput.trim();
    const nameError = trimmedName ? undefined : 'Portfolio name is required';
    setPortfolioNameError(nameError);
    if (Object.values(next).some(Boolean) || nameError) return;
    setSaving(true);
    try {
      await api.patch('/portfolio/settings', {
        name: trimmedName,
        rentDueDay: Number(dueDates.rentDueDay),
        electricityDueDay: Number(dueDates.electricityDueDay),
        maintenanceDueDay: Number(dueDates.maintenanceDueDay),
        reminderLeadDays: Number(dueDates.reminderLeadDays)
      });
      await loadProfile({ force: true });
      toast.success(t('Portfolio settings updated.'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to update portfolio settings.'));
    } finally {
      setSaving(false);
    }
  };

  const openEditProfileModal = () => {
    setEditNameInput(me?.fullName || '');
    setEditEmailInput(me?.email || '');
    setEditPhoneInput(me?.phone || '');
    setEditProfileErrors({});
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editNameInput.trim();
    const trimmedEmail = editEmailInput.trim();
    const nextErrors: FieldErrors = {};
    if (isBlank(trimmedName)) nextErrors.fullName = requiredMsg('Full name');
    if (isBlank(trimmedEmail)) nextErrors.email = requiredMsg('Email');
    else if (!isValidEmail(trimmedEmail)) nextErrors.email = 'Enter a valid email address';
    if (editPhoneInput.trim() && !isValidPhone(editPhoneInput.trim())) nextErrors.phone = 'Enter a valid phone number';
    if (Object.keys(nextErrors).length) {
      setEditProfileErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      const response = await api.patch('/auth/me', {
        fullName: trimmedName,
        email: trimmedEmail,
        phone: editPhoneInput.trim()
      });
      setMe(response.data?.user || null);
      invalidateByTag('portfolio');
      setShowEditProfileModal(false);
      toast.success(t('Profile updated.'));
    } catch (err: any) {
      const message = err?.response?.data?.message || t('Unable to update profile.');
      const fields: string[] = err?.response?.data?.details?.fields || [];
      if (fields.includes('email')) setEditProfileErrors({ email: message });
      else toast.error(message);
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

  const confirmDeletePortfolioFlow = async () => {
    const first = await confirmDialog({
      title: `Delete ${portfolio?.name || 'this portfolio'}?`,
      description: 'This removes all properties, units, tenants, records, and payments inside this portfolio.',
      confirmLabel: 'Continue',
      danger: true
    });
    if (!first) return;

    const second = await confirmDialog({
      title: 'Are you absolutely sure?',
      description: 'This is permanent and cannot be undone. If you belong to other portfolios, RentDesk will switch to the next one.',
      confirmLabel: 'Delete Permanently',
      danger: true
    });
    if (!second) return;

    await handleDeletePortfolio();
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">{t('Loading profile...')}</div>;
  }

  return (
    <div className="max-w-5xl space-y-4 pb-6">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-lg font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xl font-semibold">{me?.fullName || 'RentDesk User'}</span>
            <Badge tone="accent" className="capitalize">
              {membership?.role || me?.role || '-'}
            </Badge>
            <button
              type="button"
              onClick={openEditProfileModal}
              title="Edit profile"
              aria-label="Edit profile"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text)]"
            >
              <PencilIcon width={14} height={14} />
            </button>
            {canManageMembers && portfolio?.joinCode && (
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy join code"
                className="rounded-full border border-black/10 bg-[var(--surface-1)] px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >
                {portfolio.joinCode}
              </button>
            )}
          </div>
          <div className="truncate text-sm text-[var(--muted)]">{me?.email || '-'}</div>
        </div>
        {portfolios.length > 0 && (
          <select
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={selectedPortfolioId}
            disabled={saving}
            onChange={(e) => void handlePortfolioSelectChange(e.target.value)}
          >
            {portfolios.map((entry) => (
              <option key={entry._id} value={entry._id}>
                {entry.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="icon-btn shrink-0"
          onClick={() => {
            setPortfolioAction('join');
            setShowPortfolioActionModal(true);
          }}
          title="Join or create a portfolio"
          aria-label="Join or create a portfolio"
        >
          <PlusIcon width={17} height={17} />
        </button>
        {membership?.role === 'owner' && (
          <button
            type="button"
            className="icon-btn shrink-0 border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700 disabled:opacity-60"
            disabled={saving}
            onClick={() => void confirmDeletePortfolioFlow()}
            title="Delete Portfolio"
            aria-label="Delete Portfolio"
          >
            <TrashIcon width={17} height={17} />
          </button>
        )}
      </div>

      {showEditProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-black/5 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="text-xl font-semibold">Edit Profile</div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditProfileModal(false)}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} noValidate className="mt-4 space-y-3">
              <div className="relative">
                <label className="text-xs text-[var(--muted)]">Full Name</label>
                <input
                  className={`mt-1.5 w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm ${editProfileErrors.fullName ? 'input-error' : ''}`}
                  value={editNameInput}
                  onChange={(e) => {
                    setEditNameInput(e.target.value);
                    setEditProfileErrors({});
                  }}
                  placeholder="Your full name"
                />
                <FieldError message={editProfileErrors.fullName} />
              </div>
              <div className="relative">
                <label className="text-xs text-[var(--muted)]">Email</label>
                <input
                  type="email"
                  className={`mt-1.5 w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm ${editProfileErrors.email ? 'input-error' : ''}`}
                  value={editEmailInput}
                  onChange={(e) => {
                    setEditEmailInput(e.target.value);
                    setEditProfileErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="you@example.com"
                />
                <FieldError message={editProfileErrors.email} />
              </div>
              <div className="relative">
                <label className="text-xs text-[var(--muted)]">Phone</label>
                <input
                  className={`mt-1.5 w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm ${editProfileErrors.phone ? 'input-error' : ''}`}
                  value={editPhoneInput}
                  onChange={(e) => {
                    setEditPhoneInput(e.target.value);
                    setEditProfileErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder="Phone number"
                />
                <FieldError message={editProfileErrors.phone} />
              </div>
              <button type="submit" className="btn btn-primary w-full !py-3" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showPortfolioActionModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-black/5 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="text-xl font-semibold">Join or Create Portfolio</div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPortfolioActionModal(false)}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-1 rounded-xl bg-[var(--surface-1)] p-1">
              {([
                { key: 'join', label: 'Join Existing' },
                { key: 'create', label: 'Create New' }
              ] as Array<{ key: PortfolioActionTab; label: string }>).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition ${
                    portfolioAction === tab.key ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
                  }`}
                  onClick={() => setPortfolioAction(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {portfolioAction === 'join' ? (
              <form onSubmit={handleJoinRequest} noValidate className="mt-4 space-y-3">
                <div className="relative">
                  <input
                    className={`w-full rounded-xl border border-black/10 px-4 py-2.5 text-center text-sm tracking-[0.32em] ${joinCodeError ? 'input-error' : ''}`}
                    placeholder="1234567"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 7));
                      setJoinCodeError(undefined);
                    }}
                  />
                  <FieldError message={joinCodeError} />
                </div>
                <button type="submit" className="btn btn-primary w-full !py-3" disabled={saving}>
                  {saving ? 'Sending...' : 'Send Request'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreatePortfolio} noValidate className="mt-4 space-y-3">
                <div className="relative">
                  <input
                    className={`w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm ${newPortfolioNameError ? 'input-error' : ''}`}
                    placeholder="New portfolio name"
                    value={newPortfolioName}
                    onChange={(e) => {
                      setNewPortfolioName(e.target.value);
                      setNewPortfolioNameError(undefined);
                    }}
                  />
                  <FieldError message={newPortfolioNameError} />
                </div>
                <button type="submit" className="btn btn-primary w-full !py-3" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Portfolio'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {membership?.role === 'owner' && (
        <form onSubmit={handleSaveDueDates} noValidate>
          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Portfolio Settings</div>
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-5">
              <label className="relative block">
                <span className="text-[11px] text-[var(--muted)]">Portfolio Name</span>
                <input
                  type="text"
                  value={portfolioNameInput}
                  onChange={(e) => {
                    setPortfolioNameInput(e.target.value);
                    if (portfolioNameError) setPortfolioNameError(undefined);
                  }}
                  placeholder="e.g. Chandan Thakur Portfolio"
                  className={`mt-1.5 w-full rounded-xl border border-black/10 px-3 py-2 text-sm ${portfolioNameError ? 'input-error' : ''}`}
                />
                <FieldError message={portfolioNameError} />
              </label>
              {[
                { key: 'rentDueDay', label: 'Rent Due Day' },
                { key: 'electricityDueDay', label: 'Electricity Due Day' },
                { key: 'maintenanceDueDay', label: 'Maintenance Due Day' },
                { key: 'reminderLeadDays', label: 'Reminder Lead (Days)' }
              ].map((field) => (
                <label key={field.key} className="relative block">
                  <span className="text-[11px] text-[var(--muted)]">{field.label}</span>
                  <input
                    type="number"
                    min={field.key === 'reminderLeadDays' ? 0 : 1}
                    max={field.key === 'reminderLeadDays' ? 7 : 28}
                    value={dueDates[field.key as keyof typeof dueDates]}
                    onChange={(e) => {
                      setDueDates((current) => ({
                        ...current,
                        [field.key]: e.target.value
                      }));
                      setDueDatesErrors((prev) => (prev[field.key] ? { ...prev, [field.key]: undefined } : prev));
                    }}
                    className={`mt-1.5 w-full rounded-xl border border-black/10 px-3 py-2 text-sm ${dueDatesErrors[field.key] ? 'input-error' : ''}`}
                  />
                  <FieldError message={dueDatesErrors[field.key]} />
                </label>
              ))}
            </div>
          </div>
        </form>
      )}

      <SettingsSection>
        <div className="px-5 py-4">
          <label className="text-xs text-[var(--muted)]">Assigned Properties</label>
          <div className="mt-2">
            {assignedProperties.length ? (
              <div className="flex flex-wrap gap-2">
                {assignedProperties.map((property) => (
                  <span
                    key={property._id}
                    className="rounded-full border border-black/10 bg-[var(--surface-1)] px-3 py-1.5 text-sm"
                  >
                    <span className="font-medium">{property.name}</span>
                    <span className="text-[var(--muted)]">
                      {' '}
                      · {property.city}, {property.state}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--muted)]">No properties assigned in this portfolio.</div>
            )}
          </div>
        </div>
      </SettingsSection>

      {portfolio && canManageMembers ? (
        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Manage Members</div>
            <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-1)] p-1">
              {([
                { key: 'members', label: 'Members' },
                { key: 'invite', label: 'Invite' },
                { key: 'requests', label: `Requests${portfolio.joinRequests?.length ? ` (${portfolio.joinRequests.length})` : ''}` }
              ] as Array<{ key: ManagementTab; label: string }>).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    activeTab === tab.key ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            {activeTab === 'members' ? (
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {(portfolio.members || []).map((member: any) => (
                  <div key={member._id} className="rounded-lg border border-black/5 bg-[var(--surface-1)] px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-[13px] font-medium">{member.user?.fullName || 'Member'}</span>
                      <Badge tone={memberRoleTone(member.role)} className="shrink-0 !px-1.5 !py-0.5 !text-[10px] capitalize">
                        {member.role}
                      </Badge>
                    </div>
                    <div className="truncate text-[11px] text-[var(--muted)]">{member.user?.email || '-'}</div>

                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {(member.propertyIds || []).map((propertyId: any) => (
                        <span
                          key={getId(propertyId)}
                          className="rounded-full border border-black/10 bg-white px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
                        >
                          {propertyNameMap.get(getId(propertyId)) || 'Property'}
                        </span>
                      ))}
                      {canEditMember(member) ? (
                        <span className="ml-auto flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-[#bc5a08] hover:bg-amber-50"
                            onClick={() => setEditingMember(member)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50"
                            onClick={() => void handleRemoveMember(member._id)}
                          >
                            Remove
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'invite' ? (
              <form onSubmit={handleInvite} noValidate className="grid gap-4 xl:grid-cols-[1fr_240px]">
                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Search registered user</label>
                    <input
                      className={`mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm ${inviteErrors.inviteQuery ? 'input-error' : ''}`}
                      value={inviteQuery}
                      onChange={(e) => {
                        setInviteQuery(e.target.value);
                        setSelectedInviteUser(null);
                        setInviteErrors({});
                      }}
                      placeholder="Name or email"
                    />
                    <FieldError message={inviteErrors.inviteQuery} />
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
              <div className="space-y-3">
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
