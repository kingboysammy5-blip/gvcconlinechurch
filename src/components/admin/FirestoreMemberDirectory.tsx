import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  CHURCH_MEMBER_STATUSES,
  CHURCH_MEMBER_TYPES,
  createFirestoreDirectoryMember,
  deleteFirestoreDirectoryMember,
  FirestoreDirectoryMember,
  subscribeFirestoreMembers,
  syncRecordsToFirestoreMembersCollection,
  updateFirestoreDirectoryMember,
} from '../../lib/firestoreStore';
import { Fellowship, MemberRecord } from '../../types/church';

interface FirestoreMemberDirectoryProps {
  fellowships: Fellowship[];
  sqlMembers: MemberRecord[];
  canCreateMembers: boolean;
  canEditMembers: boolean;
  canDeleteMembers: boolean;
  onNotify: (msg: string) => void;
}

function parseFirestoreErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      if (
        parsed.error.toLowerCase().includes('permission') ||
        parsed.error.toLowerCase().includes('insufficient')
      ) {
        return 'Firestore permission denied. Please sign in with the authorized GVCC admin Google account.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  return raw || 'Firestore operation failed.';
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  'Active member': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'New registration': 'bg-blue-50 text-blue-800 border-blue-200',
  'Pending verification': 'bg-amber-50 text-amber-800 border-amber-200',
  Contacted: 'bg-sky-50 text-sky-800 border-sky-200',
  Orientation: 'bg-purple-50 text-purple-800 border-purple-200',
  Inactive: 'bg-stone-100 text-stone-700 border-stone-300',
  Transferred: 'bg-slate-100 text-slate-700 border-slate-300',
  Archived: 'bg-red-50 text-red-700 border-red-200',
};

export const FirestoreMemberDirectory: React.FC<FirestoreMemberDirectoryProps> = ({
  fellowships,
  sqlMembers,
  canCreateMembers,
  canEditMembers,
  canDeleteMembers,
  onNotify,
}) => {
  const { firebaseUser, signInWithGoogle, signOut } = useAuth();

  const [members, setMembers] = useState<FirestoreDirectoryMember[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState<boolean>(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [fellowshipFilter, setFellowshipFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Create Form states
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [savingNew, setSavingNew] = useState<boolean>(false);
  const [syncingSql, setSyncingSql] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    fullName: '',
    phone: '',
    email: '',
    location: '',
    fellowshipGroup: '',
    membershipType: 'Existing member',
    membershipStatus: 'Active member',
    registrationDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const isVerifiedAdmin = Boolean(firebaseUser && firebaseUser.emailVerified);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setMembers([]);
      setErrorMsg(null);
      setLoadingDocs(false);
      return;
    }

    setLoadingDocs(true);
    setErrorMsg(null);
    const unsubscribe = subscribeFirestoreMembers(
      firebaseUser,
      (items) => {
        setMembers(items);
        setLoadingDocs(false);
        setErrorMsg(null);
      },
      (err) => {
        setLoadingDocs(false);
        setErrorMsg(parseFirestoreErrorMessage(err));
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const fellowshipOptions = useMemo(() => {
    const names = new Set<string>();
    fellowships.forEach((f) => {
      if (f.name?.trim()) names.add(f.name.trim());
    });
    members.forEach((m) => {
      if (m.fellowshipGroup?.trim()) names.add(m.fellowshipGroup.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [fellowships, members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q) ||
        m.fellowshipGroup.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'All' || m.membershipStatus === statusFilter;

      const matchesFellowship =
        fellowshipFilter === 'All' ||
        (fellowshipFilter === '__unassigned__'
          ? !m.fellowshipGroup.trim()
          : m.fellowshipGroup.trim().toLowerCase() === fellowshipFilter.toLowerCase());

      const matchesType = typeFilter === 'All' || m.membershipType === typeFilter;

      return matchesSearch && matchesStatus && matchesFellowship && matchesType;
    });
  }, [members, searchQuery, statusFilter, fellowshipFilter, typeFilter]);

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (statusFilter !== 'All' ? 1 : 0) +
    (fellowshipFilter !== 'All' ? 1 : 0) +
    (typeFilter !== 'All' ? 1 : 0);

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrorMsg(parseFirestoreErrorMessage(err));
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingNew(true);
    setErrorMsg(null);
    try {
      const created = await createFirestoreDirectoryMember(firebaseUser, draft);
      setDraft({
        fullName: '',
        phone: '',
        email: '',
        location: '',
        fellowshipGroup: '',
        membershipType: 'Existing member',
        membershipStatus: 'Active member',
        registrationDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setShowAddForm(false);
      onNotify(`Added ${created.memberNumber} to Firestore 'members' collection.`);
    } catch (err) {
      setErrorMsg(parseFirestoreErrorMessage(err));
    } finally {
      setSavingNew(false);
    }
  };

  const handleStatusChange = async (member: FirestoreDirectoryMember, nextStatus: string) => {
    if (!firebaseUser) return;
    setErrorMsg(null);
    try {
      await updateFirestoreDirectoryMember(firebaseUser, member.id, {
        membershipStatus: nextStatus,
      });
      onNotify(`Updated ${member.fullName} status to ${nextStatus}.`);
    } catch (err) {
      setErrorMsg(parseFirestoreErrorMessage(err));
    }
  };

  const handleFellowshipChange = async (member: FirestoreDirectoryMember, nextGroup: string) => {
    if (!firebaseUser) return;
    setErrorMsg(null);
    try {
      await updateFirestoreDirectoryMember(firebaseUser, member.id, {
        fellowshipGroup: nextGroup,
      });
      onNotify(
        nextGroup
          ? `Assigned ${member.fullName} to ${nextGroup}.`
          : `Cleared fellowship assignment for ${member.fullName}.`
      );
    } catch (err) {
      setErrorMsg(parseFirestoreErrorMessage(err));
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!firebaseUser) return;
    setErrorMsg(null);
    try {
      await deleteFirestoreDirectoryMember(firebaseUser, memberId);
      setConfirmDeleteId(null);
      onNotify("Member removed from Firestore 'members' collection.");
    } catch (err) {
      setErrorMsg(parseFirestoreErrorMessage(err));
    }
  };

  const handleSyncFromSql = async () => {
    if (!firebaseUser || !sqlMembers.length) return;
    setSyncingSql(true);
    setErrorMsg(null);
    try {
      const existingNumbers = new Set(members.map((m) => m.memberNumber.toUpperCase()));
      const existingPhones = new Set(members.map((m) => m.phone.trim()));
      const toSync = sqlMembers
        .filter(
          (m) =>
            !existingNumbers.has((m.memberNumber || '').toUpperCase()) &&
            !existingPhones.has((m.phone || '').trim())
        )
        .map((m) => ({
          memberNumber: m.memberNumber,
          fullName: m.fullName,
          phone: m.phone,
          email: m.email || '',
          location: m.location || '',
          fellowshipGroup: fellowships.find((f) => f.id === m.fellowshipId)?.name || '',
          membershipType: m.membershipType,
          membershipStatus: m.membershipStatus,
          registrationDate: m.registrationDate,
          notes: m.notes || '',
        }));

      if (!toSync.length) {
        onNotify("All SQL church members are already present in Firestore 'members'.");
        return;
      }
      const count = await syncRecordsToFirestoreMembersCollection(firebaseUser, toSync);
      onNotify(`Synced ${count} member(s) into Firestore 'members' collection.`);
    } catch (err) {
      setErrorMsg(parseFirestoreErrorMessage(err));
    } finally {
      setSyncingSql(false);
    }
  };

  const handleExportFilteredCsv = () => {
    const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = [
      'Member ID',
      'Full Name',
      'Phone',
      'Email',
      'Location',
      'Fellowship Group',
      'Membership Type',
      'Membership Status',
      'Registration Date',
      'Notes',
    ].join(',');

    const lines = filteredMembers.map((m) =>
      [
        escapeCell(m.memberNumber),
        escapeCell(m.fullName),
        escapeCell(m.phone),
        escapeCell(m.email),
        escapeCell(m.location),
        escapeCell(m.fellowshipGroup),
        escapeCell(m.membershipType),
        escapeCell(m.membershipStatus),
        escapeCell(m.registrationDate),
        escapeCell(m.notes),
      ].join(',')
    );

    const blob = new Blob([[header, ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gvcc-firestore-members.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A6B2F] font-semibold">
            Cloud Firestore Directory
          </p>
          <h1 className="text-xl font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
            <Database className="w-5 h-5 text-[#9A6B2F]" />
            Firestore Member Directory (<code className="font-mono text-base">members</code>)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time searchable congregation directory backed by the Cloud Firestore{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5">members</code> collection with status and fellowship group filters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isVerifiedAdmin && canCreateMembers && sqlMembers.length > 0 && (
            <button
              type="button"
              disabled={syncingSql}
              onClick={handleSyncFromSql}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingSql ? 'animate-spin' : ''}`} />
              {syncingSql ? 'Syncing SQL Members...' : 'Sync from SQL Directory'}
            </button>
          )}
          {isVerifiedAdmin && canCreateMembers && (
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold cursor-pointer"
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddForm ? 'Close Form' : 'Add Member to Firestore'}
            </button>
          )}
          {isVerifiedAdmin && filteredMembers.length > 0 && (
            <button
              type="button"
              onClick={handleExportFilteredCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Filtered CSV
            </button>
          )}
        </div>
      </div>

      {/* Firebase Admin Auth Banner */}
      <div
        className={`p-3.5 border flex flex-wrap items-center justify-between gap-3 ${
          isVerifiedAdmin
            ? 'bg-emerald-50/60 border-emerald-200'
            : 'bg-amber-50 border-amber-300'
        }`}
      >
        <div className="flex items-center gap-2.5 text-xs">
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${
              isVerifiedAdmin ? 'text-emerald-700' : 'text-amber-700'
            }`}
          />
          {isVerifiedAdmin ? (
            <span className="text-slate-800">
              Live Firestore listener active as{' '}
              <strong className="font-mono">{firebaseUser?.email}</strong>
            </span>
          ) : (
            <span className="text-amber-900">
              Sign in with your verified Google Admin account to read and filter the Cloud Firestore{' '}
              <code className="font-mono">members</code> collection.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isVerifiedAdmin ? (
            <button
              type="button"
              disabled={connectingGoogle}
              onClick={handleConnectGoogle}
              className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
            >
              {connectingGoogle ? 'Connecting...' : 'Connect Google Admin Account'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signOut()}
              className="px-2.5 py-1 border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Switch Google Account
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Firestore Members</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
            {members.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Active Members</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1">
            {members.filter((m) => m.membershipStatus === 'Active member').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Matching Results</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#9A6B2F] mt-1">
            {filteredMembers.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Fellowship Groups</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
            {fellowshipOptions.length}
          </p>
        </div>
      </div>

      {/* Add Member to Firestore 'members' Form */}
      {isVerifiedAdmin && showAddForm && canCreateMembers && (
        <form onSubmit={handleCreateMember} className="bg-white border border-slate-300 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Add Member to Firestore <code className="font-mono text-xs">members</code> Collection
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              required
              placeholder="Full Name *"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
            />
            <input
              required
              placeholder="Phone Number *"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <input
              type="email"
              placeholder="Email Address (optional)"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              placeholder="Residence / Area"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <select
              value={draft.fellowshipGroup}
              onChange={(e) => setDraft({ ...draft, fellowshipGroup: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              <option value="">Select Fellowship Group (optional)</option>
              {fellowshipOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={draft.membershipType}
              onChange={(e) => setDraft({ ...draft, membershipType: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              {CHURCH_MEMBER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={draft.membershipStatus}
              onChange={(e) => setDraft({ ...draft, membershipStatus: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              {CHURCH_MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={draft.registrationDate}
              onChange={(e) => setDraft({ ...draft, registrationDate: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <input
              placeholder="Pastoral notes (optional)"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 text-xs"
            />
            <button
              type="submit"
              disabled={savingNew}
              className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
            >
              {savingNew ? 'Saving...' : 'Save to Firestore'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                aria-label="Search Firestore members"
                placeholder="Search name, ID, phone, email, or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
            </div>

            <select
              aria-label="Filter by membership status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 text-xs bg-white"
            >
              <option value="All">All Membership Statuses</option>
              {CHURCH_MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by fellowship group"
              value={fellowshipFilter}
              onChange={(e) => setFellowshipFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 text-xs bg-white"
            >
              <option value="All">All Fellowship Groups</option>
              <option value="__unassigned__">Unassigned / No Fellowship</option>
              {fellowshipOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by membership type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 text-xs bg-white"
            >
              <option value="All">All Member Types</option>
              {CHURCH_MEMBER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setFellowshipFilter('All');
                setTypeFilter('All');
              }}
              className="px-3 py-1.5 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Member ID</th>
                <th className="py-2 pr-3">Member &amp; Contact</th>
                <th className="py-2 pr-3">Location &amp; Fellowship Group</th>
                <th className="py-2 pr-3">Type / Joined</th>
                <th className="py-2 pr-3">Membership Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!isVerifiedAdmin ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Connect your verified Google Admin account above to fetch records from Firestore{' '}
                    <code className="font-mono">members</code>.
                  </td>
                </tr>
              ) : loadingDocs ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading records from Firestore <code className="font-mono">members</code>...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                      <Users className="w-4 h-4" />
                      <span>
                        {members.length === 0
                          ? "No documents found in the Firestore 'members' collection yet."
                          : 'No members match your current search or filter selection.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-700">
                      {m.memberNumber}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-slate-900 block">{m.fullName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {m.phone}
                        {m.email ? ` · ${m.email}` : ''}
                      </span>
                      {m.notes && (
                        <span className="block text-[11px] text-slate-400 mt-0.5">{m.notes}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="block text-slate-700">{m.location || '—'}</span>
                      {canEditMembers ? (
                        <select
                          aria-label={`Fellowship group for ${m.fullName}`}
                          value={m.fellowshipGroup}
                          onChange={(e) => handleFellowshipChange(m, e.target.value)}
                          className="mt-1 px-2 py-0.5 border border-slate-200 bg-white text-[11px] text-[#9A6B2F] max-w-[200px]"
                        >
                          <option value="">Unassigned</option>
                          {fellowshipOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-[#9A6B2F]">
                          {m.fellowshipGroup || 'Unassigned'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      <span className="block">{m.membershipType}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {m.registrationDate}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {canEditMembers ? (
                        <select
                          aria-label={`Membership status for ${m.fullName}`}
                          value={m.membershipStatus}
                          onChange={(e) => handleStatusChange(m, e.target.value)}
                          className={`px-2 py-1 border text-xs font-medium ${
                            STATUS_BADGE_STYLES[m.membershipStatus] ||
                            'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          {CHURCH_MEMBER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 border text-[11px] font-medium ${
                            STATUS_BADGE_STYLES[m.membershipStatus] ||
                            'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {m.membershipStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {canDeleteMembers &&
                        (confirmDeleteId === m.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id)}
                              className="px-2 py-1 bg-red-600 text-white text-[11px] font-medium cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 border border-slate-300 text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(m.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-700 hover:bg-red-50 text-xs cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
