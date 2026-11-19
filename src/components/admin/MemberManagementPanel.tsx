import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  HeartHandshake,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MINISTRY_INVOLVEMENT_OPTIONS } from '../public/JoinChurchForm';
import { Fellowship, MemberRecord } from '../../types/church';
import { ImportMembersUtility } from './ImportMembersUtility';

export const MEMBERSHIP_STATUS_OPTIONS = [
  'New Member',
  'Active Member',
  'Pending Follow-up',
  'Transferred',
  'Inactive',
] as const;

export const MEMBERSHIP_CATEGORIES = [
  'New member',
  'Transferring member',
  'Returning member',
  'Visitor',
  'Existing member',
] as const;

export function getAgeCategory(dob: string | null | undefined): string {
  if (!dob) return 'Unspecified';
  const year = Number(dob.slice(0, 4));
  const nowYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1900 || year > nowYear) return 'Unspecified';
  const age = nowYear - year;
  if (age < 13) return 'Children (<13)';
  if (age <= 17) return 'Teens (13-17)';
  if (age <= 30) return 'Youth (18-30)';
  if (age <= 45) return 'Young Adults (31-45)';
  if (age <= 60) return 'Adults (46-60)';
  return 'Seniors (60+)';
}

export function normalizeDisplayStatus(status: string): string {
  const lower = (status || '').toLowerCase();
  if (lower.includes('active')) return 'Active Member';
  if (lower.includes('transfer')) return 'Transferred';
  if (lower.includes('inactive') || lower.includes('archiv')) return 'Inactive';
  if (lower.includes('pending') || lower.includes('follow') || lower.includes('contact') || lower.includes('orientation')) {
    return 'Pending Follow-up';
  }
  return 'New Member';
}

interface MemberManagementPanelProps {
  membersList: MemberRecord[];
  fellowships: Fellowship[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
  onOpenFirestoreDirectory: () => void;
}

export const MemberManagementPanel: React.FC<MemberManagementPanelProps> = ({
  membersList,
  fellowships,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  authFetch,
  onRefresh,
  onNotify,
  onOpenFirestoreDirectory,
}) => {
  // Search & Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [ageFilter, setAgeFilter] = useState('All');
  const [ministryFilter, setMinistryFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [fellowshipFilter, setFellowshipFilter] = useState('All');

  // Panels & Bulk Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('Active Member');
  const [showImportUtility, setShowImportUtility] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBackupPanel, setShowBackupPanel] = useState(false);

  // Backup & Recovery
  const [restoreMode, setRestoreMode] = useState<'skip' | 'overwrite'>('skip');
  const [restoring, setRestoring] = useState(false);

  // Quick Add Member
  const [newMember, setNewMember] = useState({
    fullName: '',
    gender: 'Male',
    dateOfBirth: '',
    maritalStatus: 'Single',
    phone: '',
    whatsappNumber: '',
    email: '',
    location: '',
    county: 'Kisii',
    membershipType: 'New member',
    membershipStatus: 'Active Member',
    fellowshipId: '',
    preferredService: 'First service',
    discipleshipStatus: 'Not started',
    isBaptised: false,
    baptismDate: '',
    interestedMinistries: [] as string[],
    notes: '',
  });

  // Member Profile / Edit / Follow-up Modal
  const [activeMember, setActiveMember] = useState<MemberRecord | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'edit' | 'followups'>('profile');
  const [editDraft, setEditDraft] = useState<Partial<MemberRecord>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [followupDraft, setFollowupDraft] = useState({
    followupMethod: 'Phone Call',
    notes: '',
    nextAction: '',
    nextStatus: '',
  });
  const [savingFollowup, setSavingFollowup] = useState(false);

  const openMemberModal = (member: MemberRecord, initialTab: 'profile' | 'edit' | 'followups' = 'profile') => {
    setActiveMember(member);
    setModalTab(initialTab);
    setEditDraft({
      ...member,
      interestedMinistries: Array.isArray(member.interestedMinistries) ? member.interestedMinistries : [],
    });
    setFollowupDraft({
      followupMethod: 'Phone Call',
      notes: '',
      nextAction: '',
      nextStatus: '',
    });
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return membersList.filter((m) => {
      const matchesSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.whatsappNumber || '').toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q);
      const normStatus = normalizeDisplayStatus(m.membershipStatus);
      const matchesStatus =
        statusFilter === 'All' || m.membershipStatus === statusFilter || normStatus === statusFilter;
      const matchesGender = genderFilter === 'All' || (m.gender || 'Unspecified') === genderFilter;
      const matchesAge = ageFilter === 'All' || getAgeCategory(m.dateOfBirth) === ageFilter;
      const matchesMinistry =
        ministryFilter === 'All' ||
        (Array.isArray(m.interestedMinistries) && m.interestedMinistries.includes(ministryFilter));
      const matchesCategory = categoryFilter === 'All' || m.membershipType === categoryFilter;
      const matchesFellowship =
        fellowshipFilter === 'All' ||
        String(m.fellowshipId || '') === fellowshipFilter ||
        (m.preferredFellowship || '') === fellowshipFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesGender &&
        matchesAge &&
        matchesMinistry &&
        matchesCategory &&
        matchesFellowship
      );
    });
  }, [
    membersList,
    search,
    statusFilter,
    genderFilter,
    ageFilter,
    ministryFilter,
    categoryFilter,
    fellowshipFilter,
  ]);

  const counts = useMemo(() => {
    const map = { total: membersList.length, new: 0, active: 0, followup: 0, transferred: 0 };
    for (const m of membersList) {
      const s = normalizeDisplayStatus(m.membershipStatus);
      if (s === 'Active Member') map.active += 1;
      else if (s === 'Pending Follow-up') map.followup += 1;
      else if (s === 'Transferred') map.transferred += 1;
      else if (s === 'New Member') map.new += 1;
    }
    return map;
  }, [membersList]);

  const handleDownloadExport = async (endpoint: 'members' | 'members-excel', filename: string) => {
    const res = await authFetch(`/api/admin/export/${endpoint}`);
    if (!res.ok) return onNotify('Export permission denied.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Downloaded ${filename}`);
  };

  const handleDownloadBackup = async () => {
    const res = await authFetch('/api/admin/members/backup');
    if (!res.ok) return onNotify('Failed to generate backup.');
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gvcc-members-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Backup saved (${json.totalMembers} member records).`);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const membersArray = Array.isArray(parsed) ? parsed : parsed.members;
      if (!Array.isArray(membersArray)) {
        throw new Error('Invalid backup JSON structure.');
      }
      const res = await authFetch('/api/admin/members/restore', {
        method: 'POST',
        body: JSON.stringify({ members: membersArray, mode: restoreMode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Restore failed.');
      onNotify(`Backup restored: ${json.inserted} added, ${json.updated} updated, ${json.skipped} skipped.`);
      onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Could not restore backup file.');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedFellowship = fellowships.find((f) => String(f.id) === newMember.fellowshipId);
    const res = await authFetch('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify({
        ...newMember,
        fellowshipId: newMember.fellowshipId ? Number(newMember.fellowshipId) : null,
        preferredFellowship: matchedFellowship?.name || null,
      }),
    });
    if (res.ok) {
      setNewMember({
        fullName: '',
        gender: 'Male',
        dateOfBirth: '',
        maritalStatus: 'Single',
        phone: '',
        whatsappNumber: '',
        email: '',
        location: '',
        county: 'Kisii',
        membershipType: 'New member',
        membershipStatus: 'Active Member',
        fellowshipId: '',
        preferredService: 'First service',
        discipleshipStatus: 'Not started',
        isBaptised: false,
        baptismDate: '',
        interestedMinistries: [],
        notes: '',
      });
      setShowCreateForm(false);
      onNotify('Member registered in church directory.');
      onRefresh();
    } else {
      const err = await res.json().catch(() => ({}));
      onNotify(err.error || 'Could not save member.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    setSavingEdit(true);
    try {
      const matchedFellowship = fellowships.find((f) => f.id === Number(editDraft.fellowshipId));
      const res = await authFetch(`/api/admin/members/${activeMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editDraft,
          fellowshipId: editDraft.fellowshipId ? Number(editDraft.fellowshipId) : null,
          preferredFellowship: matchedFellowship?.name || editDraft.preferredFellowship || null,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Update failed');
      setActiveMember({ ...updated, followups: activeMember.followups || [] });
      setModalTab('profile');
      onNotify('Member profile updated.');
      onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to update member.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleLogFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    setSavingFollowup(true);
    try {
      const res = await authFetch(`/api/admin/members/${activeMember.id}/followups`, {
        method: 'POST',
        body: JSON.stringify(followupDraft),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || 'Failed to log follow-up');
      setActiveMember((prev) =>
        prev
          ? {
              ...prev,
              membershipStatus: followupDraft.nextStatus || prev.membershipStatus,
              followups: [created, ...(prev.followups || [])],
            }
          : null
      );
      setFollowupDraft({ followupMethod: 'Phone Call', notes: '', nextAction: '', nextStatus: '' });
      onNotify('Pastoral follow-up recorded.');
      onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to log follow-up.');
    } finally {
      setSavingFollowup(false);
    }
  };

  const handlePrintElement = () => {
    document.body.classList.add('gvcc-printing-modal');
    const cleanup = () => {
      document.body.classList.remove('gvcc-printing-modal');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Church Membership Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, filter, update pastoral care, track baptism &amp; discipleship progress, export to Excel/CSV, and back up records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {showCreateForm ? 'Close Add Form' : 'Add Member'}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFirestoreDirectory}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-[#9A6B2F]" />
            Firestore Directory
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowImportUtility((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {showImportUtility ? 'Hide CSV Import' : 'Import CSV'}
            </button>
          )}
          {canExport && (
            <>
              <button
                type="button"
                onClick={() => handleDownloadExport('members-excel', 'gvcc-members-register.xls')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => handleDownloadExport('members', 'gvcc-members.csv')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Report
              </button>
              <button
                type="button"
                onClick={() => setShowBackupPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#9A6B2F]" />
                Backup &amp; Recovery
              </button>
            </>
          )}
        </div>
      </div>

      {/* Backup & Recovery Drawer */}
      {showBackupPanel && canExport && (
        <div className="bg-white border border-slate-300 p-5 space-y-4 no-print">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Membership Data Backup &amp; Recovery</h2>
              <p className="text-xs text-slate-500">
                Download an encrypted-ready JSON snapshot of all members and follow-up logs, or restore from a previous backup.
              </p>
            </div>
            <button type="button" onClick={() => setShowBackupPanel(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 space-y-2.5">
              <p className="text-xs font-semibold text-slate-900">1. Download Full Database Snapshot</p>
              <p className="text-[11px] text-slate-600">
                Exports all {membersList.length} membership profiles and pastoral follow-up notes into a JSON archive file.
              </p>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Backup (.json)
              </button>
            </div>

            {canCreate && (
              <div className="bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-900">2. Restore From Backup File</p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <select
                    value={restoreMode}
                    onChange={(e) => setRestoreMode(e.target.value as 'skip' | 'overwrite')}
                    className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                  >
                    <option value="skip">Skip existing Member IDs (Safe merge)</option>
                    <option value="overwrite">Overwrite matching Member IDs</option>
                  </select>
                  <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{restoring ? 'Restoring...' : 'Upload & Restore JSON'}</span>
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={restoring}
                      onChange={handleRestoreFile}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Utility */}
      {canCreate && showImportUtility && (
        <div className="no-print">
          <ImportMembersUtility
            fellowships={fellowships}
            canCreateMembers={canCreate}
            authFetch={authFetch}
            onSqlSynced={onRefresh}
            onNotify={onNotify}
            onClose={() => setShowImportUtility(false)}
          />
        </div>
      )}

      {/* 5 Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Members</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A] mt-1">{counts.total}</p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">New Members</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#9A6B2F] mt-1">{counts.new}</p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Active Members</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1">{counts.active}</p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Pending Follow-up</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-amber-700 mt-1">{counts.followup}</p>
        </div>
        <div className="bg-white border border-slate-200 p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Transferred</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-700 mt-1">{counts.transferred}</p>
        </div>
      </div>

      {/* Admin Add Member Form */}
      {canCreate && showCreateForm && (
        <form onSubmit={handleCreateMember} className="bg-white border border-slate-200 p-5 space-y-4 no-print">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-sm font-semibold text-slate-900">Register New Church Member (Admin Entry)</h2>
            <button type="button" onClick={() => setShowCreateForm(false)} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              required
              placeholder="Full Name *"
              value={newMember.fullName}
              onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
            />
            <input
              required
              placeholder="Phone Number *"
              value={newMember.phone}
              onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs font-mono"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <select
              value={newMember.gender}
              onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input
              type="date"
              title="Date of Birth"
              value={newMember.dateOfBirth}
              onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <input
              placeholder="Estate / Location"
              value={newMember.location}
              onChange={(e) => setNewMember({ ...newMember, location: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <select
              value={newMember.fellowshipId}
              onChange={(e) => setNewMember({ ...newMember, fellowshipId: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs bg-white"
            >
              <option value="">Fellowship (optional)</option>
              {fellowships.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <select
              value={newMember.membershipStatus}
              onChange={(e) => setNewMember({ ...newMember, membershipStatus: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs bg-white"
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <input
              placeholder="Pastoral notes..."
              value={newMember.notes}
              onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
              className="flex-1 min-w-[240px] px-3 py-2 border border-slate-300 text-xs"
            />
            <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
              Save Member Record
            </button>
          </div>
        </form>
      )}

      {/* Search, Multi-Filter & Table */}
      <div className="bg-white border border-slate-200 p-4 space-y-4">
        <div className="space-y-3 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              placeholder="Search by full name, phone number, or Member ID (GVCC-...)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-slate-300 text-xs w-full sm:w-80"
            />
            <span className="text-xs font-mono text-slate-500">
              Showing {filteredMembers.length} of {membersList.length} records
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
            >
              <option value="All">Status: All</option>
              {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
            >
              <option value="All">Gender: All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unspecified">Unspecified</option>
            </select>

            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
            >
              <option value="All">Age Group: All</option>
              {[
                'Children (<13)',
                'Teens (13-17)',
                'Youth (18-30)',
                'Young Adults (31-45)',
                'Adults (46-60)',
                'Seniors (60+)',
                'Unspecified',
              ].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              value={ministryFilter}
              onChange={(e) => setMinistryFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
            >
              <option value="All">Ministry: All</option>
              {MINISTRY_INVOLVEMENT_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
            >
              <option value="All">Category: All</option>
              {MEMBERSHIP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={fellowshipFilter}
              onChange={(e) => setFellowshipFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
            >
              <option value="All">Fellowship: All</option>
              {fellowships.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </div>

          {selectedIds.length > 0 && canEdit && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-700">{selectedIds.length} selected:</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 text-xs bg-white"
              >
                {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const res = await authFetch('/api/admin/members/bulk-status', {
                    method: 'POST',
                    body: JSON.stringify({ ids: selectedIds, membershipStatus: bulkStatus }),
                  });
                  if (res.ok) {
                    setSelectedIds([]);
                    onNotify('Bulk status updated.');
                    onRefresh();
                  }
                }}
                className="px-3 py-1.5 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
              >
                Apply Bulk Status
              </button>
            </div>
          )}
        </div>

        {/* Printable Report Header */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
          <h2 className="font-serif text-xl font-bold text-slate-900">
            Gracious Voice Celebration Centre — Official Membership Register Report
          </h2>
          <p className="text-xs text-slate-600">
            Generated {new Date().toLocaleDateString()} · Records shown: {filteredMembers.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500 bg-slate-50">
              <tr>
                <th className="py-2.5 px-2 no-print">
                  <input
                    type="checkbox"
                    checked={filteredMembers.length > 0 && selectedIds.length === filteredMembers.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? filteredMembers.map((m) => m.id) : [])
                    }
                  />
                </th>
                <th className="py-2.5 px-2">Member ID</th>
                <th className="py-2.5 px-2">Member &amp; Contact</th>
                <th className="py-2.5 px-2">Demographics &amp; Location</th>
                <th className="py-2.5 px-2">Fellowship &amp; Ministries</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No membership records match your current search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const fellowshipName =
                    fellowships.find((f) => f.id === m.fellowshipId)?.name || m.preferredFellowship;
                  const ageCat = getAgeCategory(m.dateOfBirth);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-2 no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(m.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                            )
                          }
                        />
                      </td>
                      <td className="py-2.5 px-2 font-mono tabular-nums font-medium text-[#0F172A]">
                        {m.memberNumber}
                        <span className="block text-[10px] text-slate-400">
                          {m.joinDate || m.registrationDate}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5">
                          {m.photoUrl ? (
                            <img
                              src={m.photoUrl}
                              alt={m.fullName}
                              className="w-8 h-8 object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-600 shrink-0">
                              {m.fullName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() => openMemberModal(m, 'profile')}
                              className="font-semibold text-slate-900 hover:text-[#9A6B2F] text-left cursor-pointer"
                            >
                              {m.fullName}
                            </button>
                            <span className="block font-mono text-[11px] text-slate-500">
                              {m.phone}
                              {m.email ? ` · ${m.email}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">
                        <span className="block">
                          {m.gender || '—'} · {ageCat}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {[m.location, m.county].filter(Boolean).join(', ') || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="block text-[#9A6B2F] font-medium">
                          {fellowshipName || 'Unassigned'}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                          {(m.interestedMinistries || []).join(', ') || m.membershipType}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          disabled={!canEdit}
                          value={MEMBERSHIP_STATUS_OPTIONS.includes(m.membershipStatus as any) ? m.membershipStatus : normalizeDisplayStatus(m.membershipStatus)}
                          onChange={async (e) => {
                            await authFetch(`/api/admin/members/${m.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ membershipStatus: e.target.value }),
                            });
                            onNotify('Membership status updated.');
                            onRefresh();
                          }}
                          className="px-2 py-1 border border-slate-200 bg-white text-xs"
                        >
                          {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap no-print">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openMemberModal(m, 'profile')}
                            title="View Full Profile"
                            className="p-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openMemberModal(m, 'edit')}
                                title="Edit Member"
                                className="p-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openMemberModal(m, 'followups')}
                                title="Pastoral Follow-ups"
                                className="p-1.5 border border-slate-200 text-[#9A6B2F] hover:bg-[#FBF9F5] cursor-pointer"
                              >
                                <HeartHandshake className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={async () => {
                                await authFetch(`/api/admin/members/${m.id}`, { method: 'DELETE' });
                                onNotify('Member record deleted.');
                                onRefresh();
                              }}
                              title="Delete Member"
                              className="p-1.5 border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MEMBER PROFILE / EDIT / PASTORAL FOLLOW-UP MODAL */}
      {activeMember && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between gap-4 border-b-2 border-[#B4823E] no-print">
              <div>
                <p className="font-mono text-xs text-[#E2C28B]">{activeMember.memberNumber}</p>
                <h3 className="font-serif text-xl font-medium">{activeMember.fullName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintElement}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Profile
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMember(null)}
                  className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Sub-navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 no-print">
              {[
                ['profile', 'Complete Profile'],
                ...(canEdit ? [['edit', 'Edit Information & Ministries']] : []),
                ...(canEdit ? [['followups', `Pastoral Follow-ups (${activeMember.followups?.length || 0})`]] : []),
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModalTab(key as any)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    modalTab === key
                      ? 'border-[#B4823E] text-[#0F172A] bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab 1: Complete Member Profile (Printable) */}
            {modalTab === 'profile' && (
              <div className="p-6 space-y-6 gvcc-printable-area text-xs">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-4">
                    {activeMember.photoUrl ? (
                      <img
                        src={activeMember.photoUrl}
                        alt={activeMember.fullName}
                        className="w-16 h-16 object-cover border border-slate-300"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-[#0F172A] text-[#E2C28B] flex items-center justify-center font-serif text-xl">
                        {activeMember.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#9A6B2F] font-semibold">
                        GVCC Official Member Dossier
                      </p>
                      <h4 className="font-serif text-xl font-semibold text-[#0F172A]">{activeMember.fullName}</h4>
                      <p className="font-mono text-slate-600">
                        {activeMember.memberNumber} · Joined {activeMember.joinDate || activeMember.registrationDate}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-[#FBF9F5] border border-[#B4823E] text-[#0F172A] font-semibold">
                      {activeMember.membershipStatus}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">{activeMember.membershipType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2 border border-slate-200 p-4">
                    <p className="font-semibold text-[#0F172A] uppercase tracking-wider text-[11px]">
                      A. Personal Information
                    </p>
                    <p><span className="text-slate-500">Gender:</span> {activeMember.gender || '—'}</p>
                    <p><span className="text-slate-500">Date of Birth:</span> {activeMember.dateOfBirth || '—'} ({getAgeCategory(activeMember.dateOfBirth)})</p>
                    <p><span className="text-slate-500">Marital Status:</span> {activeMember.maritalStatus || '—'}</p>
                    <p><span className="text-slate-500">Nationality:</span> {activeMember.nationality || '—'}</p>
                  </div>

                  <div className="space-y-2 border border-slate-200 p-4">
                    <p className="font-semibold text-[#0F172A] uppercase tracking-wider text-[11px]">
                      B. Contact &amp; Emergency
                    </p>
                    <p><span className="text-slate-500">Phone:</span> <span className="font-mono">{activeMember.phone}</span></p>
                    <p><span className="text-slate-500">WhatsApp:</span> <span className="font-mono">{activeMember.whatsappNumber || activeMember.phone}</span></p>
                    <p><span className="text-slate-500">Email:</span> {activeMember.email || '—'}</p>
                    <p><span className="text-slate-500">Address:</span> {[activeMember.residentialAddress, activeMember.location, activeMember.county].filter(Boolean).join(', ') || '—'}</p>
                    <p><span className="text-slate-500">Emergency:</span> {activeMember.emergencyContactName || '—'} ({activeMember.emergencyContactPhone || '—'})</p>
                  </div>

                  <div className="space-y-2 border border-slate-200 p-4">
                    <p className="font-semibold text-[#0F172A] uppercase tracking-wider text-[11px]">
                      C. Spiritual &amp; Baptism Progress
                    </p>
                    <p><span className="text-slate-500">Accepted Christ:</span> {activeMember.acceptedChrist === true ? 'Yes' : activeMember.acceptedChrist === false ? 'No' : '—'}</p>
                    <p><span className="text-slate-500">Water Baptised:</span> {activeMember.isBaptised === true ? `Yes (${activeMember.baptismDate || 'Date not set'})` : activeMember.isBaptised === false ? 'No' : '—'}</p>
                    <p><span className="text-slate-500">Discipleship Class:</span> {activeMember.discipleshipStatus || 'Not started'}</p>
                    <p><span className="text-slate-500">Previous Church:</span> {activeMember.previousChurch || '—'}</p>
                  </div>

                  <div className="space-y-2 border border-slate-200 p-4">
                    <p className="font-semibold text-[#0F172A] uppercase tracking-wider text-[11px]">
                      D &amp; E. Fellowship &amp; Ministries
                    </p>
                    <p><span className="text-slate-500">Fellowship Group:</span> {fellowships.find((f) => f.id === activeMember.fellowshipId)?.name || activeMember.preferredFellowship || 'Unassigned'}</p>
                    <p><span className="text-slate-500">Preferred Service:</span> {activeMember.preferredService || 'First service'}</p>
                    <p><span className="text-slate-500">Assigned Pastor:</span> {activeMember.assignedPastor || 'Church Office'}</p>
                    <p><span className="text-slate-500">Ministries:</span> {(activeMember.interestedMinistries || []).join(', ') || 'Not yet decided'}</p>
                  </div>
                </div>

                {(activeMember.testimony || activeMember.notes) && (
                  <div className="border border-slate-200 p-4 space-y-1.5 bg-slate-50">
                    {activeMember.testimony && (
                      <p><strong>Testimony:</strong> {activeMember.testimony}</p>
                    )}
                    {activeMember.notes && (
                      <p><strong>Pastoral Notes:</strong> {activeMember.notes}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Full Edit Mode */}
            {modalTab === 'edit' && canEdit && (
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      required
                      value={editDraft.fullName || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={editDraft.gender || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, gender: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 bg-white"
                    >
                      <option value="">Unspecified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editDraft.dateOfBirth || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      required
                      value={editDraft.phone || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">WhatsApp</label>
                    <input
                      value={editDraft.whatsappNumber || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, whatsappNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editDraft.email || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Estate / Location</label>
                    <input
                      value={editDraft.location || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">County</label>
                    <input
                      value={editDraft.county || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, county: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Membership Status</label>
                    <select
                      value={editDraft.membershipStatus || 'New Member'}
                      onChange={(e) => setEditDraft({ ...editDraft, membershipStatus: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 bg-white font-semibold"
                    >
                      {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Fellowship</label>
                    <select
                      value={editDraft.fellowshipId ? String(editDraft.fellowshipId) : ''}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          fellowshipId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 bg-white"
                    >
                      <option value="">Unassigned</option>
                      {fellowships.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Preferred Service</label>
                    <select
                      value={editDraft.preferredService || 'First service'}
                      onChange={(e) => setEditDraft({ ...editDraft, preferredService: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 bg-white"
                    >
                      <option value="First service">First service</option>
                      <option value="Second service">Second service</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Pastor / Leader</label>
                    <input
                      value={editDraft.assignedPastor || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, assignedPastor: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Discipleship Progress</label>
                    <select
                      value={editDraft.discipleshipStatus || 'Not started'}
                      onChange={(e) => setEditDraft({ ...editDraft, discipleshipStatus: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 bg-white"
                    >
                      <option value="Not started">Not started</option>
                      <option value="In progress">In progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Water Baptism</label>
                    <select
                      value={editDraft.isBaptised === true ? 'Yes' : editDraft.isBaptised === false ? 'No' : ''}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          isBaptised: e.target.value === 'Yes' ? true : e.target.value === 'No' ? false : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 bg-white"
                    >
                      <option value="">Unspecified</option>
                      <option value="Yes">Baptised in Water</option>
                      <option value="No">Not Yet Baptised</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Baptism Date</label>
                    <input
                      type="date"
                      value={editDraft.baptismDate || ''}
                      onChange={(e) => setEditDraft({ ...editDraft, baptismDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Assigned &amp; Interested Ministries
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MINISTRY_INVOLVEMENT_OPTIONS.map((min) => {
                      const list = editDraft.interestedMinistries || [];
                      const checked = list.includes(min);
                      return (
                        <label key={min} className="flex items-center gap-2 border border-slate-200 px-2.5 py-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setEditDraft({
                                ...editDraft,
                                interestedMinistries: checked
                                  ? list.filter((x) => x !== min)
                                  : [...list, min],
                              })
                            }
                            className="accent-[#0F172A]"
                          />
                          <span>{min}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pastoral Notes</label>
                  <textarea
                    rows={2}
                    value={editDraft.notes || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setModalTab('profile')}
                    className="px-4 py-2 border border-slate-300 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] text-white font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 3: Pastoral Follow-ups Log */}
            {modalTab === 'followups' && canEdit && (
              <div className="p-6 space-y-5 text-xs">
                <form onSubmit={handleLogFollowup} className="bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <p className="font-semibold text-slate-900">Record New Pastoral Follow-up</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Follow-up Method</label>
                      <select
                        value={followupDraft.followupMethod}
                        onChange={(e) => setFollowupDraft({ ...followupDraft, followupMethod: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 bg-white"
                      >
                        <option>Phone Call</option>
                        <option>WhatsApp Message</option>
                        <option>Home Visit</option>
                        <option>Sanctuary Welcome</option>
                        <option>Discipleship Session</option>
                        <option>Prayer &amp; Counseling</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Update Member Status (optional)</label>
                      <select
                        value={followupDraft.nextStatus}
                        onChange={(e) => setFollowupDraft({ ...followupDraft, nextStatus: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 bg-white"
                      >
                        <option value="">Keep current ({activeMember.membershipStatus})</option>
                        {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Follow-up Notes *</label>
                    <textarea
                      required
                      rows={2}
                      value={followupDraft.notes}
                      onChange={(e) => setFollowupDraft({ ...followupDraft, notes: e.target.value })}
                      placeholder="Summary of call, visit, prayer need, or integration progress..."
                      className="w-full px-3 py-2 border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <input
                      value={followupDraft.nextAction}
                      onChange={(e) => setFollowupDraft({ ...followupDraft, nextAction: e.target.value })}
                      placeholder="Next recommended action (optional)"
                      className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={savingFollowup}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B4823E] text-white font-semibold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {savingFollowup ? 'Recording...' : 'Save Follow-up'}
                    </button>
                  </div>
                </form>

                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-900">Pastoral Follow-up Timeline</p>
                  {!activeMember.followups || activeMember.followups.length === 0 ? (
                    <p className="text-slate-500 py-4 text-center border border-dashed border-slate-200">
                      No pastoral follow-ups recorded for this member yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200">
                      {activeMember.followups.map((f) => (
                        <div key={f.id} className="p-3.5 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#0F172A]">
                              {f.followupMethod} · <span className="text-[#9A6B2F]">{f.staffName}</span>
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {new Date(f.followupDate).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-700">{f.notes}</p>
                          {f.nextAction && (
                            <p className="text-[11px] text-slate-500">
                              <strong>Next Action:</strong> {f.nextAction}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
