import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Pill from '../components/Pill';
import SegmentedControl from '../components/SegmentedControl';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/I18nContext';
import { useNotificationsFeed } from '../lib/notificationCenter';
import api from '../lib/api';
import { colors, fonts } from '../lib/theme';

type AccessRole = 'warden' | 'manager';
type ManagementTab = 'members' | 'invite' | 'requests';
const getId = (value: any) => String(value?._id || value || '');

const PropertyMultiSelect = ({ items, selected, onToggle }: { items: any[]; selected: string[]; onToggle: (id: string) => void }) => (
  <View style={styles.chipWrap}>
    {items.map((item) => {
      const active = selected.includes(item._id);
      return (
        <Pressable key={item._id} onPress={() => onToggle(item._id)} style={[styles.choiceChip, active && styles.choiceChipActive]}>
          <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{item.name}</Text>
        </Pressable>
      );
    })}
  </View>
);

const ProfileScreen = ({ navigation }: any) => {
  const { t } = useI18n();
  const { me, portfolio, membership, properties, refresh } = usePortfolio();
  const { unreadCount: unreadNotifications } = useNotificationsFeed(properties, portfolio);
  const [tab, setTab] = useState<ManagementTab>('members');
  const [joinCode, setJoinCode] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [inviteRole, setInviteRole] = useState<AccessRole>('manager');
  const [invitePropertyIds, setInvitePropertyIds] = useState<string[]>([]);
  const [requestRoles, setRequestRoles] = useState<Record<string, AccessRole>>({});
  const [requestPropertyIds, setRequestPropertyIds] = useState<Record<string, string[]>>({});
  const [editingMember, setEditingMember] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [switching, setSwitching] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [portfolioNameInput, setPortfolioNameInput] = useState('');
  const [dueDates, setDueDates] = useState({ rentDueDay: '5', electricityDueDay: '5', maintenanceDueDay: '5', reminderLeadDays: '3' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [portfolioAction, setPortfolioAction] = useState<'join' | 'create'>('join');

  const canManage = membership?.role === 'owner' || membership?.role === 'warden';
  const isOwner = membership?.role === 'owner';
  const roleOptions = useMemo<AccessRole[]>(() => (membership?.role === 'owner' ? ['manager', 'warden'] : ['manager']), [membership?.role]);

  useEffect(() => {
    const loadPortfolios = async () => {
      try {
        const response = await api.get('/portfolio/list');
        setPortfolios(response.data?.portfolios || []);
      } catch {
        setPortfolios([]);
      }
    };
    void loadPortfolios();
  }, [portfolio?._id]);

  useEffect(() => {
    if (!portfolio) return;
    setPortfolioNameInput(portfolio.name || '');
    setDueDates({
      rentDueDay: String(portfolio.rentDueDay ?? 5),
      electricityDueDay: String(portfolio.electricityDueDay ?? 5),
      maintenanceDueDay: String(portfolio.maintenanceDueDay ?? 5),
      reminderLeadDays: String(portfolio.reminderLeadDays ?? 3)
    });
  }, [portfolio]);

  useEffect(() => {
    if (properties.length && invitePropertyIds.length === 0) {
      setInvitePropertyIds(properties.map((property) => property._id));
    }
  }, [invitePropertyIds.length, properties]);

  const resetFeedback = () => {
    setMessage('');
    setError('');
  };

  const searchUsers = async () => {
    if (!search.trim()) return;
    setLoading(true);
    resetFeedback();
    try {
      const queryKey = search.includes('@') ? 'email' : 'name';
      const response = await api.get(`/users?${queryKey}=${encodeURIComponent(search.trim())}`);
      const existingMemberIds = new Set((portfolio?.members || []).map((member: any) => getId(member.user)));
      setSearchResults((response.data || []).filter((user: any) => !existingMemberIds.has(getId(user))));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to search users.'));
    } finally {
      setLoading(false);
    }
  };

  const invite = async () => {
    if (!selectedUser?._id) {
      setError(t('Choose a user first.'));
      return;
    }
    setLoading(true);
    resetFeedback();
    try {
      await api.post('/portfolio/invite', { userId: selectedUser._id, role: inviteRole, propertyIds: invitePropertyIds });
      await refresh();
      setSelectedUser(null);
      setSearch('');
      setSearchResults([]);
      setInvitePropertyIds(properties.map((property) => property._id));
      setMessage(t('Member added.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to add member.'));
    } finally {
      setLoading(false);
    }
  };

  const requestJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    resetFeedback();
    try {
      await api.post('/portfolio/join-requests', { code: joinCode.trim() });
      setJoinCode('');
      setShowCreatePortfolio(false);
      setMessage(t('Join request sent.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to send join request.'));
    } finally {
      setLoading(false);
    }
  };

  const saveMember = async (memberId: string, payload: { role: AccessRole; propertyIds: string[] }) => {
    setLoading(true);
    resetFeedback();
    try {
      await api.patch(`/portfolio/members/${memberId}`, payload);
      await refresh();
      setEditingMember(null);
      setMessage(t('Member updated.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to update member.'));
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    setLoading(true);
    resetFeedback();
    try {
      await api.delete(`/portfolio/members/${memberId}`);
      await refresh();
      setMessage(t('Member removed.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to remove member.'));
    } finally {
      setLoading(false);
    }
  };

  const openEditProfile = () => {
    setProfileName(me?.fullName || '');
    setProfilePhone(me?.phone || '');
    setProfileEmail(me?.email || '');
    setProfileError('');
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      setProfileError(t('Full name is required.'));
      return;
    }
    if (!profileEmail.trim()) {
      setProfileError(t('Email is required.'));
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      await api.patch('/auth/me', {
        fullName: profileName.trim(),
        email: profileEmail.trim(),
        phone: profilePhone.trim()
      });
      await refresh();
      setEditingProfile(false);
    } catch (err: any) {
      setProfileError(err?.response?.data?.message || t('Unable to update profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const switchPortfolio = async (targetId: string) => {
    if (!targetId || targetId === getId(portfolio?._id)) return;
    const target = portfolios.find((entry) => getId(entry._id) === targetId);
    Alert.alert(
      `Switch to ${target?.name || 'this portfolio'}?`,
      'RentDesk will reload with data from this portfolio.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setSwitching(true);
            try {
              await api.post('/portfolio/switch', { portfolioId: targetId });
              await refresh();
            } catch (err: any) {
              setError(err?.response?.data?.message || t('Unable to switch portfolio right now.'));
            } finally {
              setSwitching(false);
            }
          }
        }
      ]
    );
  };

  const createPortfolio = async () => {
    if (!newPortfolioName.trim()) {
      setError(t('Portfolio name is required.'));
      return;
    }
    setCreatingPortfolio(true);
    resetFeedback();
    try {
      await api.post('/portfolio/create', { name: newPortfolioName.trim() });
      await refresh();
      setShowCreatePortfolio(false);
      setNewPortfolioName('');
      setMessage(t('Portfolio created.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to create portfolio.'));
    } finally {
      setCreatingPortfolio(false);
    }
  };

  const confirmDeletePortfolio = () => {
    Alert.alert(
      `Delete ${portfolio?.name || 'this portfolio'}?`,
      'This removes all properties, units, tenants, records, and payments inside this portfolio.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'This is permanent and cannot be undone. If you belong to other portfolios, RentDesk will switch to the next one.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Permanently',
                  style: 'destructive',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      await api.delete('/portfolio');
                      await refresh();
                      setMessage(t('Portfolio deleted.'));
                    } catch (err: any) {
                      setError(err?.response?.data?.message || t('Unable to delete portfolio.'));
                    } finally {
                      setLoading(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const saveDueDates = async () => {
    const trimmedName = portfolioNameInput.trim();
    if (!trimmedName) {
      setError(t('Portfolio name is required.'));
      return;
    }
    setSavingSettings(true);
    resetFeedback();
    try {
      await api.patch('/portfolio/settings', {
        name: trimmedName,
        rentDueDay: Number(dueDates.rentDueDay),
        electricityDueDay: Number(dueDates.electricityDueDay),
        maintenanceDueDay: Number(dueDates.maintenanceDueDay),
        reminderLeadDays: Number(dueDates.reminderLeadDays)
      });
      await refresh();
      setMessage(t('Portfolio settings updated.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to update portfolio settings.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const decideRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setLoading(true);
    resetFeedback();
    try {
      if (action === 'approve') {
        await api.post(`/portfolio/join-requests/${requestId}/approve`, {
          role: requestRoles[requestId] || roleOptions[0],
          propertyIds: requestPropertyIds[requestId] || []
        });
      } else {
        await api.post(`/portfolio/join-requests/${requestId}/reject`);
      }
      await refresh();
      setMessage(action === 'approve' ? t('Request approved.') : t('Request denied.'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to update request.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Profile" subtitle={portfolio?.name || t('Account')}>
      {(message || error) ? <Card style={error ? styles.errorCard : styles.successCard}><Text style={error ? styles.errorText : styles.successText}>{error || message}</Text></Card> : null}

      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigTitle}>{me?.fullName || 'RentDesk User'}</Text>
            <Text style={styles.meta}>{me?.email || '-'}</Text>
            {me?.phone ? <Text style={styles.meta}>{me.phone}</Text> : null}
            <Text style={styles.meta}>{portfolio?.name || t('No portfolio yet')}</Text>
          </View>
          <Pill label={membership?.role || me?.role || '-'} tone="success" />
        </View>
        <View style={styles.inlineActions}>
          <Button label={t('Edit Profile')} variant="secondary" small onPress={openEditProfile} />
          <Button
            label={t('Join or Create Portfolio')}
            variant="secondary"
            small
            onPress={() => {
              setNewPortfolioName('');
              setPortfolioAction('join');
              setShowCreatePortfolio(true);
            }}
          />
          {isOwner && portfolio ? <Button label={t('Delete Portfolio')} variant="danger" small onPress={confirmDeletePortfolio} /> : null}
        </View>
      </Card>

      {portfolios.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('Your Portfolios')}</Text>
          <View style={styles.chipWrap}>
            {portfolios.map((entry) => {
              const active = getId(entry._id) === getId(portfolio?._id);
              return (
                <Pressable
                  key={entry._id}
                  onPress={() => switchPortfolio(getId(entry._id))}
                  style={[styles.choiceChip, active && styles.choiceChipActive]}
                  disabled={switching}
                >
                  <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{entry.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>{t('Properties')}</Text>
        <View style={styles.chipWrap}>
          {properties.map((property) => (
            <View key={property._id} style={styles.choiceChip}>
              <Text style={styles.choiceChipText}>{property.name}</Text>
            </View>
          ))}
        </View>
      </Card>

      {isOwner && portfolio ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('Portfolio Settings')}</Text>
          <Text style={styles.fieldLabel}>{t('Portfolio Name')}</Text>
          <TextInput style={styles.input} value={portfolioNameInput} onChangeText={setPortfolioNameInput} />
          <Text style={styles.fieldLabel}>{t('Rent Due Day')}</Text>
          <TextInput style={styles.input} value={dueDates.rentDueDay} onChangeText={(value) => setDueDates((current) => ({ ...current, rentDueDay: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
          <Text style={styles.fieldLabel}>{t('Electricity Due Day')}</Text>
          <TextInput style={styles.input} value={dueDates.electricityDueDay} onChangeText={(value) => setDueDates((current) => ({ ...current, electricityDueDay: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
          <Text style={styles.fieldLabel}>{t('Maintenance Due Day')}</Text>
          <TextInput style={styles.input} value={dueDates.maintenanceDueDay} onChangeText={(value) => setDueDates((current) => ({ ...current, maintenanceDueDay: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
          <Text style={styles.fieldLabel}>{t('Reminder Lead (Days)')}</Text>
          <TextInput style={styles.input} value={dueDates.reminderLeadDays} onChangeText={(value) => setDueDates((current) => ({ ...current, reminderLeadDays: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
          <View style={styles.inlineActions}>
            <Button label="Save" onPress={saveDueDates} loading={savingSettings} />
          </View>
        </Card>
      ) : null}

      {!portfolio ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('Join Portfolio')}</Text>
          <TextInput style={styles.input} value={joinCode} onChangeText={(value) => setJoinCode(value.replace(/\D/g, '').slice(0, 7))} placeholder={t('7-digit code')} keyboardType="number-pad" />
          <Button label="Request Access" onPress={requestJoin} loading={loading} />
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <SegmentedControl
            options={[
              { label: 'Members', value: 'members' },
              { label: 'Invite', value: 'invite' },
              { label: `${t('Requests')}${portfolio?.joinRequests?.length ? ` (${portfolio.joinRequests.length})` : ''}`, value: 'requests' }
            ]}
            value={tab}
            onChange={(value) => setTab(value as ManagementTab)}
          />

          {tab === 'members' ? (
            <View style={styles.stack}>
              {(portfolio?.members || []).map((member: any) => (
                <Card key={member._id} style={styles.innerCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.value}>{member.user?.fullName || t('Member')}</Text>
                      <Text style={styles.meta}>{member.user?.email || '-'}</Text>
                    </View>
                    <Pill label={member.role} />
                  </View>
                  <View style={styles.inlineActions}>
                    {member.role !== 'owner' ? <Button label="Edit" variant="secondary" small onPress={() => setEditingMember(member)} /> : null}
                    {member.role !== 'owner' && (membership?.role === 'owner' || member.role === 'manager') ? (
                      <Button label="Remove" variant="danger" small onPress={() => removeMember(member._id)} />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          {tab === 'invite' ? (
            <View style={styles.stack}>
              <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder={t('Search by name or email')} />
              <Button label="Search" variant="secondary" onPress={searchUsers} loading={loading} />
              {searchResults.map((user) => (
                <Pressable key={user._id} onPress={() => setSelectedUser(user)}>
                  <Card style={[styles.innerCard, selectedUser?._id === user._id && styles.selectedCard]}>
                    <Text style={styles.value}>{user.fullName}</Text>
                    <Text style={styles.meta}>{user.email}</Text>
                  </Card>
                </Pressable>
              ))}
              <SegmentedControl options={roleOptions.map((option) => ({ label: option, value: option }))} value={inviteRole} onChange={(value) => setInviteRole(value as AccessRole)} />
              <PropertyMultiSelect items={properties} selected={invitePropertyIds} onToggle={(id) => setInvitePropertyIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])} />
              <Button label="Add Member" onPress={invite} loading={loading} />
            </View>
          ) : null}

          {tab === 'requests' ? (
            <View style={styles.stack}>
              {(portfolio?.joinRequests || []).length ? (
                portfolio.joinRequests.map((request: any) => (
                  <Card key={request._id} style={styles.innerCard}>
                    <Text style={styles.value}>{request.user?.fullName || t('Requests')}</Text>
                    <Text style={styles.meta}>{request.user?.email || '-'}</Text>
                    <SegmentedControl
                      options={roleOptions.map((option) => ({ label: option, value: option }))}
                      value={requestRoles[request._id] || roleOptions[0]}
                      onChange={(value) => setRequestRoles((current) => ({ ...current, [request._id]: value as AccessRole }))}
                    />
                    <PropertyMultiSelect
                      items={properties}
                      selected={requestPropertyIds[request._id] || []}
                      onToggle={(id) =>
                        setRequestPropertyIds((current) => {
                          const existing = current[request._id] || [];
                          return {
                            ...current,
                            [request._id]: existing.includes(id) ? existing.filter((entry) => entry !== id) : [...existing, id]
                          };
                        })
                      }
                    />
                    <View style={styles.inlineActions}>
                      <Button label="Approve" small onPress={() => decideRequest(request._id, 'approve')} />
                      <Button label="Deny" variant="danger" small onPress={() => decideRequest(request._id, 'reject')} />
                    </View>
                  </Card>
                ))
              ) : (
                <Text style={styles.meta}>{t('No pending requests.')}</Text>
              )}
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>{t('More')}</Text>
        <View style={styles.stack}>
          <Button label="Reports" variant="secondary" onPress={() => navigation.navigate('Reports')} />
          <Button label="Calendar" variant="secondary" onPress={() => navigation.navigate('Calendar')} />
          <Button
            label={unreadNotifications ? `Notifications (${unreadNotifications})` : 'Notifications'}
            variant="secondary"
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>
      </Card>

      <Modal visible={Boolean(editingMember)} transparent animationType="fade" onRequestClose={() => setEditingMember(null)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.sectionTitle}>{t('Edit Member')}</Text>
            <SegmentedControl
              options={(membership?.role === 'owner' ? ['manager', 'warden'] : ['manager']).map((option) => ({ label: option, value: option }))}
              value={(editingMember?.role as AccessRole) || 'manager'}
              onChange={(value) => setEditingMember((current: any) => ({ ...current, role: value }))}
            />
            <PropertyMultiSelect
              items={properties}
              selected={(editingMember?.propertyIds || []).map((entry: any) => getId(entry))}
              onToggle={(id) =>
                setEditingMember((current: any) => {
                  const existing = (current.propertyIds || []).map((entry: any) => getId(entry));
                  return {
                    ...current,
                    propertyIds: existing.includes(id) ? existing.filter((entry: string) => entry !== id) : [...existing, id]
                  };
                })
              }
            />
            <Button label="Save" onPress={() => saveMember(editingMember._id, { role: editingMember.role, propertyIds: editingMember.propertyIds })} loading={loading} />
            <Button label="Close" variant="secondary" onPress={() => setEditingMember(null)} />
          </Card>
        </View>
      </Modal>

      <Modal visible={editingProfile} transparent animationType="fade" onRequestClose={() => setEditingProfile(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.sectionTitle}>{t('Edit Profile')}</Text>
            <Text style={styles.fieldLabel}>{t('Full Name')}</Text>
            <TextInput style={styles.input} value={profileName} onChangeText={setProfileName} />
            <Text style={styles.fieldLabel}>{t('Email')}</Text>
            <TextInput style={styles.input} value={profileEmail} onChangeText={setProfileEmail} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.fieldLabel}>{t('Phone')}</Text>
            <TextInput style={styles.input} value={profilePhone} onChangeText={setProfilePhone} keyboardType="phone-pad" />
            {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
            <Button label="Save" onPress={saveProfile} loading={profileSaving} />
            <Button label="Cancel" variant="secondary" onPress={() => setEditingProfile(false)} />
          </Card>
        </View>
      </Modal>

      <Modal visible={showCreatePortfolio} transparent animationType="fade" onRequestClose={() => setShowCreatePortfolio(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{t('Join or Create Portfolio')}</Text>
              <Pressable onPress={() => setShowCreatePortfolio(false)}>
                <Text style={styles.link}>{t('Close')}</Text>
              </Pressable>
            </View>
            <SegmentedControl
              options={[
                { label: 'Join Existing', value: 'join' },
                { label: 'Create New', value: 'create' }
              ]}
              value={portfolioAction}
              onChange={(value) => setPortfolioAction(value as 'join' | 'create')}
            />
            {portfolioAction === 'join' ? (
              <>
                <TextInput style={styles.input} value={joinCode} onChangeText={(value) => setJoinCode(value.replace(/\D/g, '').slice(0, 7))} placeholder={t('7-digit code')} keyboardType="number-pad" />
                <Button label="Send Request" onPress={requestJoin} loading={loading} />
              </>
            ) : (
              <>
                <TextInput style={styles.input} value={newPortfolioName} onChangeText={setNewPortfolioName} placeholder={t('New portfolio name')} />
                <Button label="Create Portfolio" onPress={createPortfolio} loading={creatingPortfolio} />
              </>
            )}
          </Card>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  bigTitle: { fontFamily: fonts.headingSemi, fontSize: 24, color: colors.text },
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginBottom: 12 },
  value: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  fieldLabel: { fontFamily: fonts.bodyBold, color: colors.text, marginTop: 2 },
  link: { fontFamily: fonts.bodyBold, color: colors.accent },
  stack: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    backgroundColor: '#fff'
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  choiceChipActive: { backgroundColor: colors.accentSoft, borderColor: '#9ee9dc' },
  choiceChipText: { fontFamily: fonts.bodyBold, color: colors.text },
  choiceChipTextActive: { color: colors.accent },
  innerCard: { padding: 14 },
  selectedCard: { borderColor: '#9ee9dc' },
  inlineActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  successCard: { borderColor: '#bbf7d0', backgroundColor: '#ecfdf5' },
  errorCard: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  successText: { fontFamily: fonts.bodyBold, color: colors.success },
  errorText: { fontFamily: fonts.bodyBold, color: colors.danger },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'center', padding: 18 },
  modalCard: { gap: 12 }
});

export default ProfileScreen;

