import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  HeartHandshake,
  Image as ImageIcon,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Package,
  Plus,
  Settings,
  Shield,
  Sliders,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AssetManagementPanel } from './AssetManagementPanel';
import { DocumentHubHelpPanel } from './DocumentHubHelpPanel';
import { FirestoreMemberDirectory } from './FirestoreMemberDirectory';
import { GoogleWorkspacePanel } from './GoogleWorkspacePanel';
import { ImportMembersUtility } from './ImportMembersUtility';
import {
  ChurchAssetRecord,
  ChurchSettings,
  DevotionalItem,
  DutyRosterRecord,
  EventItem,
  Fellowship,
  GivingRecord,
  HomepageSlide,
  Leader,
  MediaAsset,
  MemberRecord,
  Ministry,
  NewsPost,
  PrayerRecord,
  Sermon,
  TestimonyRecord,
  VisitorRecord,
} from '../../types/church';

type AdminTab =
  | 'dashboard'
  | 'members'
  | 'firestore-members'
  | 'rosters'
  | 'assets'
  | 'visitors'
  | 'prayers'
  | 'testimonies'
  | 'devotionals'
  | 'giving'
  | 'fellowships'
  | 'events'
  | 'news'
  | 'gallery'
  | 'slideshow'
  | 'sermons'
  | 'leadership'
  | 'messages'
  | 'users'
  | 'workspace'
  | 'docs-hub'
  | 'settings';

interface AdminDashboardProps {
  onBackToSite: () => void;
  onDataChanged: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToSite,
  onDataChanged,
}) => {
  const {
    staffProfile,
    portalUnlocked,
    loading,
    authError,
    unlockWithPasscode,
    lockPortal,
    signOut,
    authFetch,
    hasPerm,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Confidential Portal Lock Screen State
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Module Data States
  const [overview, setOverview] = useState<any>(null);
  const [membersList, setMembersList] = useState<MemberRecord[]>([]);
  const [rostersList, setRostersList] = useState<DutyRosterRecord[]>([]);
  const [assetsList, setAssetsList] = useState<ChurchAssetRecord[]>([]);
  const [visitorsList, setVisitorsList] = useState<VisitorRecord[]>([]);
  const [prayersList, setPrayersList] = useState<PrayerRecord[]>([]);
  const [fellowshipsData, setFellowshipsData] = useState<{ fellowships: Fellowship[]; requests: any[] }>({
    fellowships: [],
    requests: [],
  });
  const [ministriesList, setMinistriesList] = useState<Ministry[]>([]);
  const [leadersList, setLeadersList] = useState<Leader[]>([]);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [newsList, setNewsList] = useState<NewsPost[]>([]);
  const [devotionalsList, setDevotionalsList] = useState<DevotionalItem[]>([]);
  const [givingList, setGivingList] = useState<GivingRecord[]>([]);
  const [sermonsList, setSermonList] = useState<Sermon[]>([]);
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [slidesList, setSlidesList] = useState<HomepageSlide[]>([]);
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [settingsForm, setSettingsForm] = useState<ChurchSettings | null>(null);

  // Filters & Form States
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('All');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('Active member');
  const [showImportUtility, setShowImportUtility] = useState(true);

  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterDeptFilter, setRosterDeptFilter] = useState('All');
  const [newRoster, setNewRoster] = useState({
    serviceDate: new Date().toISOString().slice(0, 10),
    serviceTitle: 'Sunday Celebration Service',
    department: 'Ushering & Protocol',
    assignedMember: '',
    contactPhone: '',
    shiftTime: '8:30 AM – 12:30 PM',
    status: 'Scheduled',
    notes: '',
  });

  const [newMember, setNewMember] = useState({
    fullName: '',
    phone: '',
    email: '',
    location: '',
    membershipType: 'Existing member',
    membershipStatus: 'Active member',
    fellowshipId: '',
    notes: '',
  });

  const [newGiving, setNewGiving] = useState({
    giverName: '',
    phone: '',
    givingCategory: 'Tithe',
    givingMethod: 'M-Pesa',
    amountKes: '',
    transactionReference: '',
    status: 'Verified',
    notes: '',
  });

  const [selectedPrayer, setSelectedPrayer] = useState<PrayerRecord | null>(null);
  const [followupNote, setFollowupNote] = useState({ followupMethod: 'Prayer', notes: '', nextAction: '' });
  const [uploadPhotoCategory, setUploadPhotoCategory] = useState('Church services');
  const [testimoniesList, setTestimoniesList] = useState<TestimonyRecord[]>([]);
  const [testimonyFilter, setTestimonyFilter] = useState<string>('All');
  const [newTestimony, setNewTestimony] = useState({
    authorName: '',
    fellowshipGroup: '',
    category: 'Answered Prayer',
    title: '',
    scriptureReference: '',
    story: '',
    featured: false,
    moderationStatus: 'Approved' as 'Pending Review' | 'Approved',
  });

  const [newEvent, setNewEvent] = useState({
    title: '',
    eventCategory: 'Church services',
    startDatetime: '',
    location: 'GVCC Sanctuary, Ogembo',
    description: '',
    capacity: '',
    registrationOpen: true,
    status: 'Upcoming',
  });

  const [newNews, setNewNews] = useState({
    title: '',
    category: 'Church Announcement',
    summary: '',
    body: '',
    status: 'Published',
  });

  const [newDevotional, setNewDevotional] = useState({
    title: '',
    scriptureReference: '',
    scriptureText: '',
    message: '',
    prayerFocus: '',
    authorName: '',
    authorTitle: 'Church Leader',
    devotionalDate: new Date().toISOString().slice(0, 10),
    featured: true,
    status: 'Published' as 'Published' | 'Draft',
  });

  const [newSermon, setNewSermon] = useState({
    title: '',
    speaker: 'Bishop Joseph Ondari Gichana',
    scriptureReference: '',
    sermonDate: new Date().toISOString().slice(0, 10),
    category: 'Sunday messages',
    videoUrl: '',
    audioUrl: '',
    description: '',
  });

  const [newSlide, setNewSlide] = useState({
    imageUrl: '/images/church/photo_00.jpg',
    eyebrow: 'Gracious Voice Celebration Centre',
    heading: '',
    subtitle: '',
    scriptureReference: '',
    buttonLabel: 'Plan Your Visit',
    buttonUrl: '#connect',
    objectPosition: '50% 25%',
    durationSeconds: 7,
  });

  const [newLeader, setNewLeader] = useState({
    fullName: '',
    officialTitle: '',
    ministryPosition: '',
    biography: '',
    phone: '',
    photoUrl: '/images/church/photo_22.jpg',
    isVerified: false,
  });

  const notify = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  const loadTabData = useCallback(
    async (tab: AdminTab) => {
      if (!portalUnlocked || !staffProfile || staffProfile.role === 'member') return;
      setBusy(true);
      try {
        if (tab === 'dashboard') {
          const r = await authFetch('/api/admin/overview');
          if (r.ok) setOverview(await r.json());
        } else if ((tab === 'members' || tab === 'firestore-members') && hasPerm('members.view')) {
          const [mr, fr] = await Promise.all([
            authFetch('/api/admin/members'),
            authFetch('/api/admin/fellowships'),
          ]);
          if (mr.ok) setMembersList(await mr.json());
          if (fr.ok) setFellowshipsData(await fr.json());
        } else if (tab === 'rosters' && hasPerm('rosters.view')) {
          const r = await authFetch('/api/admin/rosters');
          if (r.ok) setRostersList(await r.json());
        } else if (tab === 'assets' && hasPerm('assets.view')) {
          const r = await authFetch('/api/admin/assets');
          if (r.ok) setAssetsList(await r.json());
        } else if (tab === 'visitors' && hasPerm('visitors.view')) {
          const r = await authFetch('/api/admin/visitors');
          if (r.ok) setVisitorsList(await r.json());
        } else if (tab === 'prayers' && hasPerm('prayer.view')) {
          const r = await authFetch('/api/admin/prayers');
          if (r.ok) setPrayersList(await r.json());
        } else if (tab === 'testimonies' && hasPerm('testimonies.moderate')) {
          const r = await authFetch('/api/admin/testimonies');
          if (r.ok) setTestimoniesList(await r.json());
        } else if (tab === 'fellowships') {
          const r = await authFetch('/api/admin/fellowships');
          if (r.ok) setFellowshipsData(await r.json());
        } else if (tab === 'events') {
          const r = await authFetch('/api/admin/events');
          if (r.ok) setEventsList(await r.json());
        } else if (tab === 'news') {
          const r = await authFetch('/api/admin/news');
          if (r.ok) setNewsList(await r.json());
        } else if (tab === 'devotionals') {
          const r = await authFetch('/api/admin/devotionals');
          if (r.ok) setDevotionalsList(await r.json());
        } else if (tab === 'giving' && hasPerm('giving.view')) {
          const r = await authFetch('/api/admin/giving');
          if (r.ok) setGivingList(await r.json());
        } else if (tab === 'gallery') {
          const r = await authFetch('/api/admin/media');
          if (r.ok) setMediaList(await r.json());
        } else if (tab === 'slideshow') {
          const [sr, mr] = await Promise.all([
            authFetch('/api/admin/slides'),
            authFetch('/api/admin/media'),
          ]);
          if (sr.ok) setSlidesList(await sr.json());
          if (mr.ok) setMediaList(await mr.json());
        } else if (tab === 'sermons') {
          const r = await authFetch('/api/admin/sermons');
          if (r.ok) setSermonList(await r.json());
        } else if (tab === 'leadership') {
          const [lr, mr] = await Promise.all([
            authFetch('/api/admin/leaders'),
            authFetch('/api/admin/ministries'),
          ]);
          if (lr.ok) setLeadersList(await lr.json());
          if (mr.ok) setMinistriesList(await mr.json());
        } else if (tab === 'messages') {
          const r = await authFetch('/api/admin/messages');
          if (r.ok) setMessagesList(await r.json());
        } else if (tab === 'users' && hasPerm('admins.manage')) {
          const [ur, fr] = await Promise.all([
            authFetch('/api/admin/users'),
            authFetch('/api/admin/fellowships'),
          ]);
          if (ur.ok) setStaffUsers(await ur.json());
          if (fr.ok) setFellowshipsData(await fr.json());
        } else if (tab === 'settings') {
          const r = await authFetch('/api/admin/settings');
          if (r.ok) setSettingsForm(await r.json());
        }
      } finally {
        setBusy(false);
      }
    },
    [authFetch, hasPerm, portalUnlocked, staffProfile]
  );

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // -------------------------------------------------------------------------
  // Auth Gate Screens (Strict Management Password Gate)
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">
        <p className="text-sm text-stone-300">Verifying GVCC management session...</p>
      </div>
    );
  }

  if (!portalUnlocked || !staffProfile) {
    const handleUnlockSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!passcodeInput.trim()) {
        setPasscodeError('Please enter the management password.');
        return;
      }
      setPasscodeError(null);
      setUnlocking(true);
      try {
        await unlockWithPasscode(passcodeInput);
        setPasscodeInput('');
      } catch (err: any) {
        setPasscodeError(err?.message || 'Incorrect management password. Access denied.');
      } finally {
        setUnlocking(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#141210] flex items-center justify-center p-6">
        <div className="bg-[#FBF9F5] border border-stone-300 max-w-md w-full p-8 space-y-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A6B2F] font-semibold">
                Gracious Voice Celebration Centre
              </p>
              <h1 className="font-serif text-3xl font-medium text-[#1C1917] mt-1.5">
                Administration Portal
              </h1>
            </div>
            <div className="w-10 h-10 bg-[#0F172A] text-[#E2C28B] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Restricted access for church leadership and management confidentiality. Enter the authorized management password to access member registries, duty rosters, church assets, financial records, and pastoral files.
          </p>

          {(passcodeError || authError) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">
              {passcodeError || authError}
            </div>
          )}

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label htmlFor="gvcc-mgmt-password" className="block text-xs font-semibold text-stone-700 mb-1.5">
                Management Password
              </label>
              <div className="relative">
                <input
                  id="gvcc-mgmt-password"
                  type={showPasscode ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  autoFocus
                  placeholder="Enter management password"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-stone-300 text-sm text-[#1C1917] focus:outline-none focus:border-[#0F172A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  aria-label={showPasscode ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800 p-1 cursor-pointer"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={unlocking}
              className="w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {unlocking ? 'Verifying Password...' : 'Unlock Administration Portal'}
            </button>
          </form>

          <button
            type="button"
            onClick={onBackToSite}
            className="w-full py-2 text-xs font-medium text-stone-600 hover:text-[#1C1917] cursor-pointer"
          >
            ← Return to Public Church Website
          </button>
        </div>
      </div>
    );
  }

  if (staffProfile.role === 'member') {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 max-w-md w-full p-8 space-y-5">
          <h1 className="font-serif text-2xl font-medium text-[#1C1917]">Staff Role Required</h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            You are signed in as <strong>{staffProfile.email}</strong>, which currently holds standard member status. Please contact the Super Administrator to be granted church staff or leadership permissions.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBackToSite}
              className="flex-1 py-2.5 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
            >
              Return to Website
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="px-4 py-2.5 border border-stone-300 text-xs font-medium cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------------------
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify(newMember),
    });
    if (res.ok) {
      setNewMember({
        fullName: '',
        phone: '',
        email: '',
        location: '',
        membershipType: 'Existing member',
        membershipStatus: 'Active member',
        fellowshipId: '',
        notes: '',
      });
      notify('Member registered in church directory.');
      loadTabData('members');
    } else {
      const err = await res.json().catch(() => ({}));
      notify(err.error || 'Could not save member.');
    }
  };

  const handleBulkMemberStatus = async () => {
    if (!selectedMemberIds.length) return;
    const res = await authFetch('/api/admin/members/bulk-status', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedMemberIds, membershipStatus: bulkStatus }),
    });
    if (res.ok) {
      setSelectedMemberIds([]);
      notify('Bulk member status updated.');
      loadTabData('members');
    }
  };

  const handleCsvExport = async (type: 'members' | 'visitors' | 'fellowships' | 'giving' | 'rosters' | 'assets') => {
    const res = await authFetch(`/api/admin/export/${type}`);
    if (!res.ok) return notify('Export permission denied.');
    const csv = await res.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gvcc-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const upRes = await authFetch('/api/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      if (!upRes.ok) return notify('Upload failed.');
      const { url, filename } = await upRes.json();
      await authFetch('/api/admin/media', {
        method: 'POST',
        body: JSON.stringify({
          filename,
          storagePath: url,
          caption: file.name.replace(/\.[^.]+$/, ''),
          category: uploadPhotoCategory || 'Church services',
        }),
      });
      notify('Photo uploaded to gallery.');
      loadTabData('gallery');
      onDataChanged();
    };
    reader.readAsDataURL(file);
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; show: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, show: true },
    { id: 'members', label: 'Memberships', icon: <Users className="w-4 h-4" />, show: hasPerm('members.view') },
    { id: 'firestore-members', label: 'Firestore Directory', icon: <Database className="w-4 h-4" />, show: hasPerm('members.view') },
    { id: 'rosters', label: 'Duty Rosters', icon: <ClipboardList className="w-4 h-4" />, show: hasPerm('rosters.view') },
    { id: 'assets', label: 'Asset Management', icon: <Package className="w-4 h-4" />, show: hasPerm('assets.view') },
    { id: 'visitors', label: 'Visitors', icon: <UserCheck className="w-4 h-4" />, show: hasPerm('visitors.view') },
    { id: 'prayers', label: 'Prayer Requests', icon: <HeartHandshake className="w-4 h-4" />, show: hasPerm('prayer.view') },
    { id: 'testimonies', label: 'Testimonies', icon: <MessageSquare className="w-4 h-4" />, show: hasPerm('testimonies.moderate') },
    { id: 'devotionals', label: 'Daily Devotionals', icon: <BookOpen className="w-4 h-4" />, show: hasPerm('devotionals.manage') },
    { id: 'giving', label: 'Tithes & Offerings', icon: <Landmark className="w-4 h-4" />, show: hasPerm('giving.view') },
    { id: 'fellowships', label: 'Fellowships', icon: <Users className="w-4 h-4" />, show: true },
    { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" />, show: true },
    { id: 'news', label: 'News & Updates', icon: <FileText className="w-4 h-4" />, show: true },
    { id: 'gallery', label: 'Gallery & Media', icon: <ImageIcon className="w-4 h-4" />, show: true },
    { id: 'slideshow', label: 'Slideshow Manager', icon: <Sliders className="w-4 h-4" />, show: hasPerm('slideshow.manage') },
    { id: 'sermons', label: 'Sermons & Media', icon: <Mic className="w-4 h-4" />, show: true },
    { id: 'leadership', label: 'Leadership & Ministries', icon: <Shield className="w-4 h-4" />, show: true },
    { id: 'messages', label: 'Contact Messages', icon: <MessageSquare className="w-4 h-4" />, show: true },
    { id: 'users', label: 'Admin Users & Roles', icon: <Shield className="w-4 h-4" />, show: hasPerm('admins.manage') },
    { id: 'workspace', label: 'Google Workspace', icon: <FolderOpen className="w-4 h-4" />, show: true },
    { id: 'docs-hub', label: 'Document Hub & Help', icon: <BookOpen className="w-4 h-4" />, show: true },
    { id: 'settings', label: 'Website Settings', icon: <Settings className="w-4 h-4" />, show: hasPerm('settings.manage') },
  ];

  const filteredMembers = membersList.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      m.memberNumber.toLowerCase().includes(q);
    const matchesStatus = memberStatusFilter === 'All' || m.membershipStatus === memberStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredRosters = rostersList.filter((r) => {
    const q = rosterSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.assignedMember.toLowerCase().includes(q) ||
      r.serviceTitle.toLowerCase().includes(q) ||
      r.rosterNumber.toLowerCase().includes(q);
    const matchesDept = rosterDeptFilter === 'All' || r.department === rosterDeptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0F172A] text-slate-200 flex flex-col border-r border-slate-800 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
          <div>
            <p className="font-serif text-lg font-semibold text-white">GVCC Admin</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">{staffProfile.role.replace('_', ' ')}</p>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-[#B4823E] text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-400 truncate">{staffProfile.email}</p>
          <button
            type="button"
            onClick={() => lockPortal()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E2C28B] bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Portal</span>
          </button>
          <button
            type="button"
            onClick={onBackToSite}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Church Site</span>
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 border border-slate-200"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500">
              GVCC Ogembo <span className="mx-1.5">/</span>
              <strong className="text-slate-900 capitalize">
                {activeTab === 'docs-hub'
                  ? 'Document Hub & Help'
                  : activeTab === 'firestore-members'
                  ? 'Firestore Member Directory'
                  : activeTab}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {bannerMsg && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1">
                {bannerMsg}
              </span>
            )}
            {busy && <span className="text-xs text-slate-400">Syncing...</span>}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* 1. DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Registered Members', overview.counts.members],
                  ['Duty Rosters', overview.counts.rosters ?? 0],
                  ['Church Assets', overview.counts.assets ?? 0],
                  ['Tithes & Offerings', overview.counts.giving ?? 0],
                  ['Prayer Requests', overview.counts.prayers],
                  ['Pending Testimonies', overview.counts.pendingTestimonies ?? 0],
                  ['Visitor Records', overview.counts.visitors],
                  ['Upcoming Events', overview.counts.events],
                  ['Daily Devotionals', overview.counts.devotionals ?? 0],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-white border border-slate-200 p-5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="font-mono tabular-nums text-3xl font-semibold text-slate-900 mt-2">{val}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="bg-white border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h2>
                <div className="flex flex-wrap gap-2">
                  {hasPerm('members.create') && (
                    <>
                      <button onClick={() => setActiveTab('members')} className="px-3.5 py-2 bg-[#0F172A] text-white text-xs font-medium cursor-pointer">
                        + Add Member
                      </button>
                      <button
                        onClick={() => {
                          setShowImportUtility(true);
                          setActiveTab('members');
                        }}
                        className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        Import Members (CSV)
                      </button>
                    </>
                  )}
                  {hasPerm('members.view') && (
                    <button
                      onClick={() => setActiveTab('firestore-members')}
                      className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      Firestore Member Directory
                    </button>
                  )}
                  {hasPerm('rosters.manage') && (
                    <button onClick={() => setActiveTab('rosters')} className="px-3.5 py-2 bg-[#B4823E] text-white text-xs font-medium cursor-pointer">
                      + Add Duty Roster
                    </button>
                  )}
                  {hasPerm('testimonies.moderate') && (
                    <button onClick={() => setActiveTab('testimonies')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                      Moderate Testimonies ({overview.counts.pendingTestimonies ?? 0})
                    </button>
                  )}
                  {hasPerm('assets.manage') && (
                    <button onClick={() => setActiveTab('assets')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                      Asset Management
                    </button>
                  )}
                  <button onClick={() => setActiveTab('news')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                    Publish Update
                  </button>
                  <button onClick={() => setActiveTab('events')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                    Create Event
                  </button>
                  <button onClick={() => setActiveTab('gallery')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                    Upload Photos
                  </button>
                  {hasPerm('prayer.view') && (
                    <button onClick={() => setActiveTab('prayers')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                      View Prayer Requests
                    </button>
                  )}
                  {hasPerm('devotionals.manage') && (
                    <button onClick={() => setActiveTab('devotionals')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                      + Post Daily Devotional
                    </button>
                  )}
                  <button onClick={() => setActiveTab('workspace')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                    Google Workspace
                  </button>
                  <button onClick={() => setActiveTab('docs-hub')} className="px-3.5 py-2 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer">
                    Document Hub &amp; Guide
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold mb-3">Recent Registrations</h3>
                  {overview.recentMembers.length === 0 ? (
                    <p className="text-xs text-slate-500">No members registered yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-xs">
                      {overview.recentMembers.map((m: MemberRecord) => (
                        <li key={m.id} className="py-2.5 flex justify-between">
                          <span><strong>{m.fullName}</strong> · {m.phone}</span>
                          <span className="font-mono text-slate-500">{m.memberNumber}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold mb-3">Recent Audit Log</h3>
                  {overview.recentLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">No administrative actions recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-xs">
                      {overview.recentLogs.map((l: any) => (
                        <li key={l.id} className="py-2 flex justify-between gap-4">
                          <span className="truncate"><strong>{l.action}</strong> · {l.actorEmail}</span>
                          <span className="font-mono text-slate-400 shrink-0">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold">Church Membership Directory</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Confidential register of GVCC members, fellowship assignments, contact details, and pastoral status.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('firestore-members')}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-[#9A6B2F]" />
                    Firestore Directory
                  </button>
                  {hasPerm('members.create') && (
                    <button
                      type="button"
                      onClick={() => setShowImportUtility((prev) => !prev)}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer border ${
                        showImportUtility
                          ? 'bg-[#B4823E] text-white border-[#B4823E]'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {showImportUtility ? 'Hide CSV Importer' : 'Import Members (CSV)'}
                    </button>
                  )}
                  {hasPerm('reports.export') && (
                    <button
                      type="button"
                      onClick={() => handleCsvExport('members')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Members CSV
                    </button>
                  )}
                </div>
              </div>

              {hasPerm('members.create') && showImportUtility && (
                <ImportMembersUtility
                  fellowships={fellowshipsData.fellowships}
                  canCreateMembers={hasPerm('members.create')}
                  authFetch={authFetch}
                  onSqlSynced={() => loadTabData('members')}
                  onNotify={notify}
                  onClose={() => setShowImportUtility(false)}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Total Registered Members</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
                    {membersList.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Active Members</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1">
                    {membersList.filter((m) => m.membershipStatus === 'Active member').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">New / Orientation</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-[#9A6B2F] mt-1">
                    {membersList.filter((m) =>
                      ['New registration', 'Pending verification', 'Contacted', 'Orientation'].includes(m.membershipStatus)
                    ).length}
                  </p>
                </div>
              </div>

              {hasPerm('members.create') && (
                <form onSubmit={handleCreateMember} className="bg-white border border-slate-200 p-5 space-y-3">
                  <h2 className="text-sm font-semibold">Capture Church Member Record</h2>
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
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      type="email"
                      placeholder="Email Address (optional)"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      placeholder="Residence / Area / Village"
                      value={newMember.location}
                      onChange={(e) => setNewMember({ ...newMember, location: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <select
                      value={newMember.fellowshipId}
                      onChange={(e) => setNewMember({ ...newMember, fellowshipId: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      <option value="">Select Fellowship (optional)</option>
                      {fellowshipsData.fellowships.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <select
                      value={newMember.membershipType}
                      onChange={(e) => setNewMember({ ...newMember, membershipType: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {['Existing member', 'New member', 'Youth', 'Visitor convert', 'Transfer'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      value={newMember.membershipStatus}
                      onChange={(e) => setNewMember({ ...newMember, membershipStatus: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {['Active member', 'New registration', 'Pending verification', 'Contacted', 'Orientation'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <input
                      placeholder="Pastoral or family notes (optional)"
                      value={newMember.notes}
                      onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
                      className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 text-xs"
                    />
                    <button type="submit" className="px-4 py-2 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer">
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Register Member
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <input
                      placeholder="Search name, phone, or GVCC ID..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="px-3 py-2 border border-slate-300 text-xs w-64"
                    />
                    <select
                      value={memberStatusFilter}
                      onChange={(e) => setMemberStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      <option value="All">All statuses</option>
                      {['New registration', 'Pending verification', 'Contacted', 'Orientation', 'Active member', 'Inactive', 'Transferred', 'Archived'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {selectedMemberIds.length > 0 && hasPerm('members.edit') && (
                    <div className="flex items-center gap-2">
                      <select
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus(e.target.value)}
                        className="px-2 py-1.5 border border-slate-300 text-xs"
                      >
                        {['Active member', 'Contacted', 'Orientation', 'Archived'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleBulkMemberStatus}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs cursor-pointer"
                      >
                        Apply to {selectedMemberIds.length} selected
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-2"><input type="checkbox" onChange={(e) => setSelectedMemberIds(e.target.checked ? filteredMembers.map((m) => m.id) : [])} /></th>
                        <th className="py-2">Member ID</th>
                        <th className="py-2">Name & Contact</th>
                        <th className="py-2">Location & Fellowship</th>
                        <th className="py-2">Type / Joined</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            No member records match your filter.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((m) => {
                          const fellowshipName = fellowshipsData.fellowships.find((f) => f.id === m.fellowshipId)?.name;
                          return (
                            <tr key={m.id} className="hover:bg-slate-50">
                              <td className="py-2.5 pr-2">
                                <input
                                  type="checkbox"
                                  checked={selectedMemberIds.includes(m.id)}
                                  onChange={(e) =>
                                    setSelectedMemberIds((prev) =>
                                      e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2.5 font-mono tabular-nums">{m.memberNumber}</td>
                              <td className="py-2.5">
                                <span className="font-medium block">{m.fullName}</span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {m.phone}{m.email ? ` · ${m.email}` : ''}
                                </span>
                                {m.notes && (
                                  <span className="block text-[11px] text-slate-400 mt-0.5">{m.notes}</span>
                                )}
                              </td>
                              <td className="py-2.5">
                                <span className="block">{m.location || '—'}</span>
                                {fellowshipName && (
                                  <span className="text-[11px] text-[#9A6B2F]">{fellowshipName}</span>
                                )}
                              </td>
                              <td className="py-2.5 text-slate-600">
                                <span className="block">{m.membershipType}</span>
                                <span className="font-mono text-[11px] text-slate-400">{m.registrationDate}</span>
                              </td>
                              <td className="py-2.5">
                                <select
                                  disabled={!hasPerm('members.edit')}
                                  value={m.membershipStatus}
                                  onChange={async (e) => {
                                    await authFetch(`/api/admin/members/${m.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ ...m, membershipStatus: e.target.value }),
                                    });
                                    notify('Member status updated.');
                                    loadTabData('members');
                                  }}
                                  className="px-2 py-1 border border-slate-200 bg-white text-xs"
                                >
                                  {['New registration', 'Pending verification', 'Contacted', 'Orientation', 'Active member', 'Inactive', 'Transferred', 'Archived'].map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 text-right">
                                {hasPerm('members.archive') && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await authFetch(`/api/admin/members/${m.id}`, { method: 'DELETE' });
                                      notify('Member record removed.');
                                      loadTabData('members');
                                    }}
                                    className="px-2.5 py-1 border border-red-200 text-red-700 text-xs cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2b. DUTY ROSTERS */}
          {activeTab === 'rosters' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold">Church Duty Rosters</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Capture and coordinate Sunday worship, ushering, protocol, media, preaching, and department duty assignments.
                  </p>
                </div>
                {hasPerm('reports.export') && (
                  <button
                    type="button"
                    onClick={() => handleCsvExport('rosters')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Rosters CSV
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Total Roster Duties</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
                    {rostersList.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Scheduled / Confirmed</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-[#9A6B2F] mt-1">
                    {rostersList.filter((r) => r.status === 'Scheduled' || r.status === 'Confirmed').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Completed Duties</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1">
                    {rostersList.filter((r) => r.status === 'Completed').length}
                  </p>
                </div>
              </div>

              {hasPerm('rosters.manage') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/rosters', {
                      method: 'POST',
                      body: JSON.stringify(newRoster),
                    });
                    if (res.ok) {
                      setNewRoster({
                        serviceDate: new Date().toISOString().slice(0, 10),
                        serviceTitle: 'Sunday Celebration Service',
                        department: 'Ushering & Protocol',
                        assignedMember: '',
                        contactPhone: '',
                        shiftTime: '8:30 AM – 12:30 PM',
                        status: 'Scheduled',
                        notes: '',
                      });
                      notify('Duty roster entry recorded.');
                      loadTabData('rosters');
                    } else {
                      const err = await res.json().catch(() => ({}));
                      notify(err.error || 'Could not save duty roster.');
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold">Add Duty Roster Assignment</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      required
                      type="date"
                      value={newRoster.serviceDate}
                      onChange={(e) => setNewRoster({ ...newRoster, serviceDate: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      required
                      placeholder="Service / Occasion *"
                      value={newRoster.serviceTitle}
                      onChange={(e) => setNewRoster({ ...newRoster, serviceTitle: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
                    />
                    <select
                      value={newRoster.department}
                      onChange={(e) => setNewRoster({ ...newRoster, department: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {[
                        'Ushering & Protocol',
                        'Praise & Worship',
                        'Media & Sound',
                        'Pastors & Preaching',
                        'Sunday School',
                        'Intercession & Prayer',
                        'Security & Parking',
                        'Sanctuary Care & Hospitality',
                      ].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      required
                      placeholder="Assigned Member / Leader *"
                      value={newRoster.assignedMember}
                      onChange={(e) => setNewRoster({ ...newRoster, assignedMember: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
                    />
                    <input
                      placeholder="Contact Phone"
                      value={newRoster.contactPhone}
                      onChange={(e) => setNewRoster({ ...newRoster, contactPhone: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      placeholder="Shift / Service Time"
                      value={newRoster.shiftTime}
                      onChange={(e) => setNewRoster({ ...newRoster, shiftTime: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                    <select
                      value={newRoster.status}
                      onChange={(e) => setNewRoster({ ...newRoster, status: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {['Scheduled', 'Confirmed', 'Completed'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Duty notes or instructions (optional)"
                      value={newRoster.notes}
                      onChange={(e) => setNewRoster({ ...newRoster, notes: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
                    />
                    <button type="submit" className="px-4 py-2 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer">
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Save Duty Assignment
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Search assigned person, service, or ref..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="px-3 py-2 border border-slate-300 text-xs w-64"
                  />
                  <select
                    value={rosterDeptFilter}
                    onChange={(e) => setRosterDeptFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 text-xs"
                  >
                    <option value="All">All Departments</option>
                    {[
                      'Ushering & Protocol',
                      'Praise & Worship',
                      'Media & Sound',
                      'Pastors & Preaching',
                      'Sunday School',
                      'Intercession & Prayer',
                      'Security & Parking',
                      'Sanctuary Care & Hospitality',
                    ].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2">Roster Ref</th>
                        <th className="py-2">Date</th>
                        <th className="py-2">Service</th>
                        <th className="py-2">Department</th>
                        <th className="py-2">Assigned Person</th>
                        <th className="py-2">Shift / Phone</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRosters.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-500">
                            No duty roster assignments found. Use the form above to schedule service duties.
                          </td>
                        </tr>
                      ) : (
                        filteredRosters.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 font-mono">{r.rosterNumber}</td>
                            <td className="py-2.5 font-mono tabular-nums">{r.serviceDate}</td>
                            <td className="py-2.5 font-medium">
                              <span className="block">{r.serviceTitle}</span>
                              {r.notes && <span className="block text-[11px] font-normal text-slate-500 mt-0.5">{r.notes}</span>}
                            </td>
                            <td className="py-2.5">{r.department}</td>
                            <td className="py-2.5 font-medium">{r.assignedMember}</td>
                            <td className="py-2.5 text-slate-500">
                              {[r.shiftTime, r.contactPhone].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td className="py-2.5">
                              <select
                                disabled={!hasPerm('rosters.manage')}
                                value={r.status}
                                onChange={async (e) => {
                                  await authFetch(`/api/admin/rosters/${r.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ status: e.target.value }),
                                  });
                                  notify('Roster status updated.');
                                  loadTabData('rosters');
                                }}
                                className="px-2 py-1 border border-slate-200 bg-white text-xs"
                              >
                                {['Scheduled', 'Confirmed', 'Completed', 'Substituted', 'Cancelled'].map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 text-right">
                              {hasPerm('rosters.manage') && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await authFetch(`/api/admin/rosters/${r.id}`, { method: 'DELETE' });
                                    notify('Roster assignment removed.');
                                    loadTabData('rosters');
                                  }}
                                  className="px-2.5 py-1 border border-red-200 text-red-700 text-xs cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2c. ASSET MANAGEMENT PANEL */}
          {activeTab === 'assets' && (
            <AssetManagementPanel
              assets={assetsList}
              canManage={hasPerm('assets.manage')}
              canExport={hasPerm('reports.export')}
              authFetch={authFetch}
              onRefresh={() => loadTabData('assets')}
              onExportCsv={() => handleCsvExport('assets')}
              onNotify={notify}
            />
          )}

          {/* 3. VISITORS */}
          {activeTab === 'visitors' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">Visitor Follow-Up</h1>
                {hasPerm('reports.export') && (
                  <button onClick={() => handleCsvExport('visitors')} className="px-4 py-2 bg-[#0F172A] text-white text-xs cursor-pointer">
                    Export Visitors CSV
                  </button>
                )}
              </div>
              <div className="bg-white border border-slate-200 overflow-x-auto p-4">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2">Ref</th>
                      <th className="py-2">Visitor Name</th>
                      <th className="py-2">Phone</th>
                      <th className="py-2">Visit Date</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visitorsList.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-500">No visitor submissions yet.</td></tr>
                    ) : (
                      visitorsList.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2.5 font-mono">{v.visitorNumber}</td>
                          <td className="py-2.5 font-medium">{v.fullName}</td>
                          <td className="py-2.5 font-mono">{v.phone}</td>
                          <td className="py-2.5">{v.preferredVisitDate || '—'}</td>
                          <td className="py-2.5">
                            <select
                              value={v.followupStatus}
                              onChange={async (e) => {
                                await authFetch(`/api/admin/visitors/${v.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ followupStatus: e.target.value, notes: v.notes }),
                                });
                                notify('Visitor follow-up updated.');
                                loadTabData('visitors');
                              }}
                              className="px-2 py-1 border border-slate-200 text-xs"
                            >
                              {['New', 'Awaiting contact', 'Contacted', 'Attended', 'Returned', 'Joined', 'Pending'].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 text-right">
                            {v.followupStatus !== 'Joined' && hasPerm('members.create') && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await authFetch(`/api/admin/visitors/${v.id}/convert`, { method: 'POST' });
                                  notify('Visitor converted to member.');
                                  loadTabData('visitors');
                                }}
                                className="px-3 py-1 bg-[#B4823E] text-white text-xs cursor-pointer"
                              >
                                Convert to Member
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. PRAYER REQUESTS (CONFIDENTIAL & PUBLIC BOARD) */}
          {activeTab === 'prayers' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-slate-200 p-4">
                <h1 className="text-lg font-semibold mb-4">Prayer Requests & Board Moderation</h1>
                <div className="divide-y divide-slate-100">
                  {prayersList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6">No prayer requests submitted yet.</p>
                  ) : (
                    prayersList.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPrayer(p)}
                        className={`w-full text-left py-3 px-2 hover:bg-slate-50 flex justify-between items-start gap-4 cursor-pointer ${
                          selectedPrayer?.id === p.id ? 'bg-slate-50' : ''
                        }`}
                      >
                        <div>
                          <p className="text-xs font-mono text-slate-500">
                            {p.referenceNumber} · {p.category} · {p.privacyLevel} · {p.prayerCount ?? 0} praying
                          </p>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">{p.requesterName || 'Anonymous'}</p>
                          <p className="text-xs text-slate-600 line-clamp-2 mt-1">{p.requestContent}</p>
                        </div>
                        <span className="text-xs font-semibold text-[#9A6B2F] shrink-0">{p.status}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 p-5">
                {selectedPrayer ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-mono text-slate-500">
                        {selectedPrayer.referenceNumber} · {selectedPrayer.prayerCount ?? 0} people praying
                      </p>
                      <h2 className="text-lg font-semibold mt-1">{selectedPrayer.requesterName || 'Anonymous'}</h2>
                      <p className="text-xs text-slate-500">
                        {selectedPrayer.phone || 'No phone'} · {selectedPrayer.email || 'No email'}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 text-sm leading-relaxed">
                      {selectedPrayer.requestContent}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Workflow Status</label>
                        <select
                          value={selectedPrayer.status}
                          onChange={async (e) => {
                            const nextStatus = e.target.value;
                            const res = await authFetch(`/api/admin/prayers/${selectedPrayer.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: nextStatus }),
                            });
                            if (res.ok) {
                              setSelectedPrayer({ ...selectedPrayer, status: nextStatus });
                              notify('Prayer status updated.');
                              loadTabData('prayers');
                              onDataChanged();
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 text-xs"
                        >
                          {['New', 'Received', 'Assigned', 'Praying', 'Follow-up needed', 'Answered', 'Closed', 'Archived'].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Board Visibility / Privacy</label>
                        <select
                          value={selectedPrayer.privacyLevel}
                          onChange={async (e) => {
                            const nextPrivacy = e.target.value;
                            const res = await authFetch(`/api/admin/prayers/${selectedPrayer.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ privacyLevel: nextPrivacy }),
                            });
                            if (res.ok) {
                              setSelectedPrayer({ ...selectedPrayer, privacyLevel: nextPrivacy });
                              notify('Prayer visibility updated.');
                              loadTabData('prayers');
                              onDataChanged();
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 text-xs"
                        >
                          <option value="confidential">Confidential (Private)</option>
                          <option value="prayer_team">Prayer team only</option>
                          <option value="public_board">Public Prayer Board</option>
                          <option value="public_testimony">Public testimony</option>
                        </select>
                      </div>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const res = await authFetch(`/api/admin/prayers/${selectedPrayer.id}/followups`, {
                          method: 'POST',
                          body: JSON.stringify(followupNote),
                        });
                        if (res.ok) {
                          setFollowupNote({ followupMethod: 'Prayer', notes: '', nextAction: '' });
                          notify('Follow-up recorded.');
                          loadTabData('prayers');
                        }
                      }}
                      className="space-y-2 border-t border-slate-200 pt-4"
                    >
                      <h3 className="text-xs font-semibold">Record Prayer Follow-Up</h3>
                      <textarea
                        required
                        rows={2}
                        placeholder="Pastoral prayer note..."
                        value={followupNote.notes}
                        onChange={(e) => setFollowupNote({ ...followupNote, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 text-xs"
                      />
                      <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs cursor-pointer">
                        Save Follow-Up
                      </button>
                    </form>

                    {selectedPrayer.followups?.length > 0 && (
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-600">History</h4>
                        {selectedPrayer.followups.map((f) => (
                          <div key={f.id} className="text-xs bg-slate-50 p-2 border border-slate-100">
                            <p className="font-medium">{f.staffName} · {new Date(f.followupDate).toLocaleDateString()}</p>
                            <p className="text-slate-600 mt-0.5">{f.notes}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Select a prayer request to inspect details and log follow-up.</p>
                )}
              </div>
            </div>
          )}

          {/* 4b. DAILY DEVOTIONALS */}
          {activeTab === 'devotionals' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Daily Devotionals & Encouraging Scriptures</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Post short encouraging messages and Scripture reflections for members to read on the GVCC landing page.
                </p>
              </div>

              {hasPerm('devotionals.manage') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/devotionals', {
                      method: 'POST',
                      body: JSON.stringify({
                        ...newDevotional,
                        authorName: newDevotional.authorName || staffProfile.fullName,
                      }),
                    });
                    if (res.ok) {
                      setNewDevotional({
                        title: '',
                        scriptureReference: '',
                        scriptureText: '',
                        message: '',
                        prayerFocus: '',
                        authorName: '',
                        authorTitle: 'Church Leader',
                        devotionalDate: new Date().toISOString().slice(0, 10),
                        featured: true,
                        status: 'Published',
                      });
                      notify('Daily devotional published.');
                      loadTabData('devotionals');
                      onDataChanged();
                    } else {
                      const err = await res.json().catch(() => ({}));
                      notify(err.error || 'Could not publish devotional.');
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold">Post New Daily Devotional</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      required
                      placeholder="Devotional Title *"
                      value={newDevotional.title}
                      onChange={(e) => setNewDevotional({ ...newDevotional, title: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      required
                      placeholder="Scripture Reference * (e.g. Psalm 23:1-3)"
                      value={newDevotional.scriptureReference}
                      onChange={(e) => setNewDevotional({ ...newDevotional, scriptureReference: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      required
                      type="date"
                      value={newDevotional.devotionalDate}
                      onChange={(e) => setNewDevotional({ ...newDevotional, devotionalDate: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      placeholder={`Author Name (defaults to ${staffProfile.fullName})`}
                      value={newDevotional.authorName}
                      onChange={(e) => setNewDevotional({ ...newDevotional, authorName: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      placeholder="Author Role / Title (e.g. Bishop, Pastor)"
                      value={newDevotional.authorTitle}
                      onChange={(e) => setNewDevotional({ ...newDevotional, authorTitle: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <select
                      value={newDevotional.status}
                      onChange={(e) => setNewDevotional({ ...newDevotional, status: e.target.value as 'Published' | 'Draft' })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      <option value="Published">Published (Visible on Landing Page)</option>
                      <option value="Draft">Draft (Hidden)</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Scripture verse quote (optional)"
                    value={newDevotional.scriptureText}
                    onChange={(e) => setNewDevotional({ ...newDevotional, scriptureText: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 text-xs"
                  />
                  <textarea
                    required
                    rows={3}
                    placeholder="Short encouraging reflection or message *"
                    value={newDevotional.message}
                    onChange={(e) => setNewDevotional({ ...newDevotional, message: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="Brief prayer focus (optional)"
                    value={newDevotional.prayerFocus}
                    onChange={(e) => setNewDevotional({ ...newDevotional, prayerFocus: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 text-xs"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={newDevotional.featured}
                        onChange={(e) => setNewDevotional({ ...newDevotional, featured: e.target.checked })}
                      />
                      <span>Feature prominently as today’s top devotional</span>
                    </label>
                    <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Post Devotional
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {devotionalsList.length === 0 ? (
                  <div className="bg-white border border-slate-200 p-6 text-xs text-slate-500">
                    No devotionals posted yet. Use the form above to publish today’s Scripture reflection.
                  </div>
                ) : (
                  devotionalsList.map((dev) => (
                    <div key={dev.id} className="bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-mono text-slate-500">
                          {dev.devotionalDate} · {dev.scriptureReference} · {dev.status}
                          {dev.featured ? ' · Featured' : ''}
                        </p>
                        <h3 className="font-semibold text-sm text-slate-900">{dev.title}</h3>
                        <p className="text-xs text-slate-600 line-clamp-2">{dev.message}</p>
                        <p className="text-[11px] text-slate-500">
                          By {dev.authorName}{dev.authorTitle ? ` (${dev.authorTitle})` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/devotionals/${dev.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ featured: !dev.featured }),
                            });
                            loadTabData('devotionals');
                            onDataChanged();
                          }}
                          className="px-3 py-1.5 border border-slate-300 text-xs cursor-pointer"
                        >
                          {dev.featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/devotionals/${dev.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: dev.status === 'Published' ? 'Draft' : 'Published' }),
                            });
                            loadTabData('devotionals');
                            onDataChanged();
                          }}
                          className="px-3 py-1.5 border border-slate-300 text-xs cursor-pointer"
                        >
                          {dev.status === 'Published' ? 'Set Draft' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/devotionals/${dev.id}`, { method: 'DELETE' });
                            loadTabData('devotionals');
                            onDataChanged();
                          }}
                          className="px-3 py-1.5 border border-red-200 text-red-700 text-xs cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4b-2. MODERATED TESTIMONIES QUEUE */}
          {activeTab === 'testimonies' && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h1 className="text-xl font-semibold">Moderated Testimonies &amp; Faith Stories</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Review member submissions carefully before approving them to appear on the public Testimonies page.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['All', 'Pending Review', 'Approved', 'Rejected', 'Archived'].map((status) => {
                    const count =
                      status === 'All'
                        ? testimoniesList.length
                        : testimoniesList.filter((t) => t.moderationStatus === status).length;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setTestimonyFilter(status)}
                        className={`px-3 py-1.5 font-medium cursor-pointer ${
                          testimonyFilter === status
                            ? 'bg-[#0F172A] text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {status} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff Direct Publish Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await authFetch('/api/admin/testimonies', {
                    method: 'POST',
                    body: JSON.stringify(newTestimony),
                  });
                  if (res.ok) {
                    setNewTestimony({
                      authorName: '',
                      fellowshipGroup: '',
                      category: 'Answered Prayer',
                      title: '',
                      scriptureReference: '',
                      story: '',
                      featured: false,
                      moderationStatus: 'Approved',
                    });
                    notify('Testimony saved.');
                    loadTabData('testimonies');
                    onDataChanged();
                  }
                }}
                className="bg-white border border-slate-200 p-5 space-y-3"
              >
                <h2 className="text-sm font-semibold">Publish Verified Testimony Directly</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    required
                    placeholder="Member Name *"
                    value={newTestimony.authorName}
                    onChange={(e) => setNewTestimony({ ...newTestimony, authorName: e.target.value })}
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <select
                    value={newTestimony.category}
                    onChange={(e) => setNewTestimony({ ...newTestimony, category: e.target.value })}
                    className="px-3 py-2 border border-slate-300 text-xs"
                  >
                    {[
                      'Answered Prayer',
                      'Healing & Restoration',
                      'Provision & Breakthrough',
                      'Family & Peace',
                      'Faith & Salvation',
                      'Deliverance & Guidance',
                      'Thanksgiving',
                    ].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Anchor Scripture (optional)"
                    value={newTestimony.scriptureReference}
                    onChange={(e) => setNewTestimony({ ...newTestimony, scriptureReference: e.target.value })}
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                </div>
                <input
                  required
                  placeholder="Testimony Headline *"
                  value={newTestimony.title}
                  onChange={(e) => setNewTestimony({ ...newTestimony, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Testimony story *"
                  value={newTestimony.story}
                  onChange={(e) => setNewTestimony({ ...newTestimony, story: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={newTestimony.featured}
                      onChange={(e) => setNewTestimony({ ...newTestimony, featured: e.target.checked })}
                    />
                    <span>Highlight as Featured Testimony</span>
                  </label>
                  <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                    <Plus className="w-3.5 h-3.5 inline mr-1" /> Save &amp; Publish Testimony
                  </button>
                </div>
              </form>

              {/* Moderation Queue List */}
              <div className="space-y-4">
                {testimoniesList
                  .filter((t) => testimonyFilter === 'All' || t.moderationStatus === testimonyFilter)
                  .map((item) => (
                    <div key={item.id} className="bg-white border border-slate-200 p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono text-slate-500">{item.referenceNumber}</span>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold ${
                                item.moderationStatus === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : item.moderationStatus === 'Pending Review'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {item.moderationStatus}
                            </span>
                            {item.featured && (
                              <span className="px-2 py-0.5 bg-[#1C1917] text-[#E2C28B] text-[11px] font-semibold">
                                Featured
                              </span>
                            )}
                            <span className="text-slate-500">· {item.category}</span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                          <p className="text-xs text-slate-600">
                            Author: <strong>{item.authorName}</strong>
                            {item.displayAnonymous ? ' (Requested Anonymous Display)' : ''}
                            {item.fellowshipGroup ? ` · ${item.fellowshipGroup}` : ''}
                            {item.phone ? ` · Phone: ${item.phone}` : ''}
                            {item.email ? ` · Email: ${item.email}` : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {item.moderationStatus !== 'Approved' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await authFetch(`/api/admin/testimonies/${item.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ moderationStatus: 'Approved' }),
                                });
                                notify('Testimony approved and published.');
                                loadTabData('testimonies');
                                onDataChanged();
                              }}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                            >
                              Approve &amp; Publish
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await authFetch(`/api/admin/testimonies/${item.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ featured: !item.featured }),
                              });
                              loadTabData('testimonies');
                              onDataChanged();
                            }}
                            className="px-3 py-1.5 border border-slate-300 text-xs cursor-pointer"
                          >
                            {item.featured ? 'Unfeature' : 'Feature'}
                          </button>
                          {item.moderationStatus === 'Approved' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await authFetch(`/api/admin/testimonies/${item.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ moderationStatus: 'Pending Review' }),
                                });
                                notify('Moved back to Pending Review.');
                                loadTabData('testimonies');
                                onDataChanged();
                              }}
                              className="px-3 py-1.5 border border-slate-300 text-xs cursor-pointer"
                            >
                              Unpublish
                            </button>
                          )}
                          {item.moderationStatus !== 'Rejected' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await authFetch(`/api/admin/testimonies/${item.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ moderationStatus: 'Rejected' }),
                                });
                                notify('Testimony marked Rejected.');
                                loadTabData('testimonies');
                                onDataChanged();
                              }}
                              className="px-3 py-1.5 border border-amber-300 text-amber-800 text-xs cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await authFetch(`/api/admin/testimonies/${item.id}`, { method: 'DELETE' });
                              loadTabData('testimonies');
                              onDataChanged();
                            }}
                            className="px-3 py-1.5 border border-red-200 text-red-700 text-xs cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 p-3.5 leading-relaxed whitespace-pre-line">
                        {item.story}
                      </p>
                      {item.scriptureReference && (
                        <p className="text-xs font-mono text-[#9A6B2F]">
                          Scripture Anchor: {item.scriptureReference}
                        </p>
                      )}
                    </div>
                  ))}
                {testimoniesList.filter(
                  (t) => testimonyFilter === 'All' || t.moderationStatus === testimonyFilter
                ).length === 0 && (
                  <div className="bg-white border border-slate-200 p-6 text-xs text-slate-500">
                    No testimonies in this moderation view.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4c. TITHES & OFFERINGS */}
          {activeTab === 'giving' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h1 className="text-xl font-semibold">Tithes, Offerings & Stewardship Records</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Confidential giving notifications and pledges submitted via the public Tithes & Offerings section. Configure verified Paybill/Bank channels in Website Settings.
                  </p>
                </div>
                {hasPerm('reports.export') && (
                  <button
                    type="button"
                    onClick={() => handleCsvExport('giving')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Giving CSV
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Total Stewardship Entries</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
                    {givingList.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Verified & Acknowledged (KES)</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1">
                    KES {givingList
                      .filter((g) => g.status === 'Verified' || g.status === 'Acknowledged')
                      .reduce((sum, g) => sum + (Number(g.amountKes) || 0), 0)
                      .toLocaleString()}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Pending / Pledged (KES)</p>
                  <p className="font-mono tabular-nums text-2xl font-semibold text-[#9A6B2F] mt-1">
                    KES {givingList
                      .filter((g) => g.status === 'Pending Verification' || g.status === 'Pledge Recorded')
                      .reduce((sum, g) => sum + (Number(g.amountKes) || 0), 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>

              {hasPerm('giving.manage') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/giving', {
                      method: 'POST',
                      body: JSON.stringify(newGiving),
                    });
                    if (res.ok) {
                      setNewGiving({
                        giverName: '',
                        phone: '',
                        givingCategory: 'Tithe',
                        givingMethod: 'M-Pesa',
                        amountKes: '',
                        transactionReference: '',
                        status: 'Verified',
                        notes: '',
                      });
                      notify('Stewardship record saved.');
                      loadTabData('giving');
                    } else {
                      const err = await res.json().catch(() => ({}));
                      notify(err.error || 'Could not save giving record.');
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold">Record Tithe, Offering or Pledge</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      placeholder="Giver Name (or Anonymous)"
                      value={newGiving.giverName}
                      onChange={(e) => setNewGiving({ ...newGiving, giverName: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      placeholder="Phone (optional)"
                      value={newGiving.phone}
                      onChange={(e) => setNewGiving({ ...newGiving, phone: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <select
                      value={newGiving.givingCategory}
                      onChange={(e) => setNewGiving({ ...newGiving, givingCategory: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {['Tithe', 'Offering', 'Thanksgiving', 'Building & Development', 'Missions & Welfare'].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={newGiving.givingMethod}
                      onChange={(e) => setNewGiving({ ...newGiving, givingMethod: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {['M-Pesa', 'In-Person', 'Bank Transfer', 'Pledge'].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="Amount (KES) *"
                      value={newGiving.amountKes}
                      onChange={(e) => setNewGiving({ ...newGiving, amountKes: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <input
                      placeholder="M-Pesa / Receipt / Bank Ref"
                      value={newGiving.transactionReference}
                      onChange={(e) => setNewGiving({ ...newGiving, transactionReference: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    />
                    <select
                      value={newGiving.status}
                      onChange={(e) => setNewGiving({ ...newGiving, status: e.target.value })}
                      className="px-3 py-2 border border-slate-300 text-xs"
                    >
                      {['Verified', 'Pending Verification', 'Pledge Recorded', 'Acknowledged'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer">
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Save Giving Record
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 overflow-x-auto p-4">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2">Ref</th>
                      <th className="py-2">Giver</th>
                      <th className="py-2">Category</th>
                      <th className="py-2">Method</th>
                      <th className="py-2">Amount (KES)</th>
                      <th className="py-2">Tx Reference</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {givingList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No giving notifications or pledges recorded yet.
                        </td>
                      </tr>
                    ) : (
                      givingList.map((g) => (
                        <tr key={g.id}>
                          <td className="py-2.5 font-mono">{g.referenceNumber}</td>
                          <td className="py-2.5">
                            <span className="font-medium block">{g.giverName}</span>
                            {g.phone && <span className="text-slate-500 font-mono">{g.phone}</span>}
                          </td>
                          <td className="py-2.5">{g.givingCategory}</td>
                          <td className="py-2.5">{g.givingMethod}</td>
                          <td className="py-2.5 font-mono tabular-nums">
                            {g.amountKes ? g.amountKes.toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 font-mono">{g.transactionReference || '—'}</td>
                          <td className="py-2.5">
                            <select
                              disabled={!hasPerm('giving.manage')}
                              value={g.status}
                              onChange={async (e) => {
                                await authFetch(`/api/admin/giving/${g.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: e.target.value }),
                                });
                                notify('Giving record status updated.');
                                loadTabData('giving');
                              }}
                              className="px-2 py-1 border border-slate-200 text-xs bg-white"
                            >
                              {['Pending Verification', 'Verified', 'Pledge Recorded', 'Acknowledged'].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. FELLOWSHIPS */}
          {activeTab === 'fellowships' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">Fellowships & Join Requests</h1>
                {hasPerm('reports.export') && (
                  <button onClick={() => handleCsvExport('fellowships')} className="px-4 py-2 bg-[#0F172A] text-white text-xs cursor-pointer">
                    Export Requests CSV
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fellowshipsData.fellowships.map((f) => (
                  <div key={f.id} className="bg-white border border-slate-200 p-4 space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="text-xs text-slate-500">{f.isVerified ? 'Confirmed' : 'Proposed Category'}</p>
                        <h3 className="font-semibold text-sm mt-0.5">{f.name}</h3>
                        <p className="text-xs text-slate-600 mt-1">{f.description}</p>
                      </div>
                      {hasPerm('fellowships.manage') && (
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/fellowships/${f.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ ...f, isVerified: !f.isVerified, status: !f.isVerified ? 'active' : 'proposed' }),
                            });
                            loadTabData('fellowships');
                            onDataChanged();
                          }}
                          className="px-3 py-1.5 border border-slate-300 text-xs shrink-0 cursor-pointer"
                        >
                          {f.isVerified ? 'Mark Proposed' : 'Confirm Fellowship'}
                        </button>
                      )}
                    </div>
                    {hasPerm('fellowships.manage') && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <input
                          placeholder="Meeting Day (e.g. Wednesday)"
                          defaultValue={f.meetingDay || ''}
                          onBlur={async (e) => {
                            if (e.target.value !== (f.meetingDay || '')) {
                              await authFetch(`/api/admin/fellowships/${f.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ ...f, meetingDay: e.target.value || null }),
                              });
                              notify('Fellowship meeting day saved.');
                              loadTabData('fellowships');
                              onDataChanged();
                            }
                          }}
                          className="px-2.5 py-1.5 border border-slate-200 text-xs"
                        />
                        <input
                          placeholder="Meeting Time (e.g. 5:00 PM)"
                          defaultValue={f.meetingTime || ''}
                          onBlur={async (e) => {
                            if (e.target.value !== (f.meetingTime || '')) {
                              await authFetch(`/api/admin/fellowships/${f.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ ...f, meetingTime: e.target.value || null }),
                              });
                              notify('Fellowship meeting time saved.');
                              loadTabData('fellowships');
                              onDataChanged();
                            }
                          }}
                          className="px-2.5 py-1.5 border border-slate-200 text-xs"
                        />
                        <input
                          placeholder="Location"
                          defaultValue={f.meetingLocation || ''}
                          onBlur={async (e) => {
                            if (e.target.value !== (f.meetingLocation || '')) {
                              await authFetch(`/api/admin/fellowships/${f.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ ...f, meetingLocation: e.target.value || null }),
                              });
                              notify('Fellowship location saved.');
                              loadTabData('fellowships');
                              onDataChanged();
                            }
                          }}
                          className="px-2.5 py-1.5 border border-slate-200 text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 p-4">
                <h2 className="text-sm font-semibold mb-3">Incoming Fellowship Join Submissions</h2>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2">Ref</th>
                      <th className="py-2">Name</th>
                      <th className="py-2">Phone</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fellowshipsData.requests.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-slate-500">No join requests yet.</td></tr>
                    ) : (
                      fellowshipsData.requests.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 font-mono">{r.referenceNumber}</td>
                          <td className="py-2 font-medium">{r.fullName}</td>
                          <td className="py-2 font-mono">{r.phone}</td>
                          <td className="py-2">{r.memberOrVisitor}</td>
                          <td className="py-2">
                            <select
                              value={r.followupStatus}
                              onChange={async (e) => {
                                await authFetch(`/api/admin/fellowship-requests/${r.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ followupStatus: e.target.value, notes: r.notes }),
                                });
                                loadTabData('fellowships');
                              }}
                              className="px-2 py-1 border border-slate-200 text-xs"
                            >
                              {['New', 'Contacted', 'Joined', 'Archived'].map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. EVENTS */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">Events Management</h1>
              {hasPerm('events.create') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/events', {
                      method: 'POST',
                      body: JSON.stringify(newEvent),
                    });
                    if (res.ok) {
                      setNewEvent({ title: '', eventCategory: 'Church services', startDatetime: '', location: 'GVCC Sanctuary, Ogembo', description: '', capacity: '', registrationOpen: true, status: 'Upcoming' });
                      notify('Event published.');
                      loadTabData('events');
                      onDataChanged();
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold">Create Event</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input required placeholder="Event Title *" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <select value={newEvent.eventCategory} onChange={(e) => setNewEvent({ ...newEvent, eventCategory: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs">
                      {['Church services', 'Fellowship meetings', 'Prayer nights', 'Youth & outreach', 'Conferences & revivals', 'Special programmes'].map((cat) => (
                        <option key={cat}>{cat}</option>
                      ))}
                    </select>
                    <input required type="datetime-local" value={newEvent.startDatetime} onChange={(e) => setNewEvent({ ...newEvent, startDatetime: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <input required placeholder="Location *" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                  </div>
                  <textarea required rows={2} placeholder="Event description *" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={newEvent.registrationOpen}
                        onChange={(e) => setNewEvent({ ...newEvent, registrationOpen: e.target.checked })}
                      />
                      <span>Allow public attendance registration</span>
                    </label>
                    <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Publish Event
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {eventsList.map((ev) => (
                  <div key={ev.id} className="bg-white border border-slate-200 p-4 flex justify-between items-center gap-4">
                    <div>
                      <p className="text-xs text-slate-500">{ev.eventCategory} · {ev.status} · {ev.registrations?.length || 0} registered</p>
                      <h3 className="font-semibold text-sm">{ev.title}</h3>
                      <p className="text-xs text-slate-600">{ev.startDatetime} · {ev.location}</p>
                    </div>
                    {hasPerm('events.publish') && (
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' });
                          loadTabData('events');
                          onDataChanged();
                        }}
                        className="px-3 py-1.5 border border-red-200 text-red-700 text-xs cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. NEWS & UPDATES */}
          {activeTab === 'news' && (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">News & Church Announcements</h1>
              {hasPerm('news.create') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/news', { method: 'POST', body: JSON.stringify(newNews) });
                    if (res.ok) {
                      setNewNews({ title: '', category: 'Church Announcement', summary: '', body: '', status: 'Published' });
                      notify('Update published.');
                      loadTabData('news');
                      onDataChanged();
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input required placeholder="Headline *" value={newNews.title} onChange={(e) => setNewNews({ ...newNews, title: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <select value={newNews.category} onChange={(e) => setNewNews({ ...newNews, category: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs">
                      {['Church Announcement', 'Weekly Message', 'Ministry News', 'Leadership Notice', 'Community Update'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <input required placeholder="Short summary *" value={newNews.summary} onChange={(e) => setNewNews({ ...newNews, summary: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                  <textarea required rows={3} placeholder="Full update content *" value={newNews.body} onChange={(e) => setNewNews({ ...newNews, body: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                  <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                    Publish Update
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {newsList.map((n) => (
                  <div key={n.id} className="bg-white border border-slate-200 p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500">{n.category} · {n.status}</p>
                      <h3 className="font-semibold text-sm">{n.title}</h3>
                    </div>
                    {hasPerm('news.publish') && (
                      <button
                        onClick={async () => {
                          await authFetch(`/api/admin/news/${n.id}`, { method: 'DELETE' });
                          loadTabData('news');
                          onDataChanged();
                        }}
                        className="px-3 py-1 border border-red-200 text-red-700 text-xs cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. GALLERY & MEDIA */}
          {activeTab === 'gallery' && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-xl font-semibold">Events &amp; Media Gallery Library ({mediaList.length} photos)</h1>
                {hasPerm('gallery.upload') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Upload category"
                      value={uploadPhotoCategory}
                      onChange={(e) => setUploadPhotoCategory(e.target.value)}
                      className="px-3 py-2 border border-slate-300 bg-white text-xs"
                    >
                      {['Church services', 'Baptisms', 'Worship', 'Preaching', 'Congregation', 'Fellowship', 'Church activities'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <label className="px-4 py-2 bg-[#0F172A] text-white text-xs font-medium cursor-pointer">
                      Upload New Photo
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {mediaList.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-200 overflow-hidden flex flex-col">
                    <img src={m.storagePath} alt={m.caption || m.filename} className="h-36 w-full object-cover object-top" />
                    <div className="p-3 space-y-2 text-xs flex-1 flex flex-col">
                      <select
                        value={m.category}
                        onChange={async (e) => {
                          await authFetch(`/api/admin/media/${m.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ...m, category: e.target.value }),
                          });
                          loadTabData('gallery');
                          onDataChanged();
                        }}
                        className="w-full px-2 py-1 border border-slate-200 text-xs"
                      >
                        {['Church services', 'Baptisms', 'Worship', 'Preaching', 'Congregation', 'Fellowship', 'Church activities'].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <div className="flex justify-between items-center pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/media/${m.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ ...m, hidden: !m.hidden }),
                            });
                            loadTabData('gallery');
                            onDataChanged();
                          }}
                          className="text-slate-600 underline cursor-pointer"
                        >
                          {m.hidden ? 'Show' : 'Hide'}
                        </button>
                        {hasPerm('gallery.delete') && (
                          <button
                            type="button"
                            onClick={async () => {
                              await authFetch(`/api/admin/media/${m.id}`, { method: 'DELETE' });
                              loadTabData('gallery');
                              onDataChanged();
                            }}
                            className="text-red-700 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. SLIDESHOW MANAGER */}
          {activeTab === 'slideshow' && (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">Homepage Reflective Slideshow Manager</h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await authFetch('/api/admin/slides', {
                    method: 'POST',
                    body: JSON.stringify(newSlide),
                  });
                  if (res.ok) {
                    setNewSlide({ ...newSlide, heading: '', subtitle: '', scriptureReference: '' });
                    notify('Slide added to homepage.');
                    loadTabData('slideshow');
                    onDataChanged();
                  }
                }}
                className="bg-white border border-slate-200 p-5 space-y-3"
              >
                <h2 className="text-sm font-semibold">Add Reflective Slide</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={newSlide.imageUrl}
                    onChange={(e) => setNewSlide({ ...newSlide, imageUrl: e.target.value })}
                    className="px-3 py-2 border border-slate-300 text-xs"
                  >
                    {mediaList.slice(0, 30).map((m) => (
                      <option key={m.id} value={m.storagePath}>{m.filename} — {m.category}</option>
                    ))}
                  </select>
                  <input required placeholder="Heading *" value={newSlide.heading} onChange={(e) => setNewSlide({ ...newSlide, heading: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                  <input placeholder="Scripture Ref (e.g. Psalm 23:1)" value={newSlide.scriptureReference} onChange={(e) => setNewSlide({ ...newSlide, scriptureReference: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                </div>
                <input required placeholder="Reflective subtitle *" value={newSlide.subtitle} onChange={(e) => setNewSlide({ ...newSlide, subtitle: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                  Add Slide
                </button>
              </form>

              <div className="space-y-3">
                {slidesList.map((s) => (
                  <div key={s.id} className="bg-white border border-slate-200 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img src={s.imageUrl} alt={s.heading} className="w-24 h-16 object-cover" />
                      <div>
                        <p className="text-xs text-slate-500">{s.eyebrow} · {s.active ? 'Active' : 'Paused'}</p>
                        <h3 className="font-semibold text-sm">{s.heading}</h3>
                        <p className="text-xs text-slate-600 line-clamp-1">{s.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await authFetch(`/api/admin/slides/${s.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ...s, active: !s.active }),
                          });
                          loadTabData('slideshow');
                          onDataChanged();
                        }}
                        className="px-3 py-1 border border-slate-300 text-xs cursor-pointer"
                      >
                        {s.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={async () => {
                          await authFetch(`/api/admin/slides/${s.id}`, { method: 'DELETE' });
                          loadTabData('slideshow');
                          onDataChanged();
                        }}
                        className="px-3 py-1 border border-red-200 text-red-700 text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. SERMONS */}
          {activeTab === 'sermons' && (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">Sermons & Spiritual Media</h1>
              {hasPerm('sermons.manage') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/sermons', { method: 'POST', body: JSON.stringify(newSermon) });
                    if (res.ok) {
                      setNewSermon({ title: '', speaker: 'Bishop Joseph Ondari Gichana', scriptureReference: '', sermonDate: new Date().toISOString().slice(0, 10), category: 'Sunday messages', videoUrl: '', audioUrl: '', description: '' });
                      notify('Sermon added.');
                      loadTabData('sermons');
                      onDataChanged();
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input required placeholder="Sermon Title *" value={newSermon.title} onChange={(e) => setNewSermon({ ...newSermon, title: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <input required placeholder="Speaker *" value={newSermon.speaker} onChange={(e) => setNewSermon({ ...newSermon, speaker: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <input placeholder="Scripture Reference" value={newSermon.scriptureReference} onChange={(e) => setNewSermon({ ...newSermon, scriptureReference: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input placeholder="YouTube / Video URL" value={newSermon.videoUrl} onChange={(e) => setNewSermon({ ...newSermon, videoUrl: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <input placeholder="Audio URL" value={newSermon.audioUrl} onChange={(e) => setNewSermon({ ...newSermon, audioUrl: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                  </div>
                  <textarea required rows={2} placeholder="Message summary *" value={newSermon.description} onChange={(e) => setNewSermon({ ...newSermon, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                  <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                    Publish Sermon
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {sermonsList.map((s) => (
                  <div key={s.id} className="bg-white border border-slate-200 p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500">{s.category} · {s.sermonDate} · {s.speaker}</p>
                      <h3 className="font-semibold text-sm">{s.title}</h3>
                    </div>
                    <button
                      onClick={async () => {
                        await authFetch(`/api/admin/sermons/${s.id}`, { method: 'DELETE' });
                        loadTabData('sermons');
                        onDataChanged();
                      }}
                      className="px-3 py-1 border border-red-200 text-red-700 text-xs cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 11. LEADERSHIP & MINISTRIES */}
          {activeTab === 'leadership' && (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">Leadership & Ministries</h1>
              {hasPerm('leadership.manage') && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await authFetch('/api/admin/leaders', { method: 'POST', body: JSON.stringify(newLeader) });
                    if (res.ok) {
                      setNewLeader({ fullName: '', officialTitle: '', ministryPosition: '', biography: '', phone: '', photoUrl: '/images/church/photo_22.jpg', isVerified: false });
                      notify('Leader added.');
                      loadTabData('leadership');
                      onDataChanged();
                    }
                  }}
                  className="bg-white border border-slate-200 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold">Add Leadership Profile</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input required placeholder="Full name *" value={newLeader.fullName} onChange={(e) => setNewLeader({ ...newLeader, fullName: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <input required placeholder="Official title *" value={newLeader.officialTitle} onChange={(e) => setNewLeader({ ...newLeader, officialTitle: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                    <input required placeholder="Ministry position *" value={newLeader.ministryPosition} onChange={(e) => setNewLeader({ ...newLeader, ministryPosition: e.target.value })} className="px-3 py-2 border border-slate-300 text-xs" />
                  </div>
                  <textarea required rows={2} placeholder="Biography *" value={newLeader.biography} onChange={(e) => setNewLeader({ ...newLeader, biography: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                  <button type="submit" className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                    Save Leader Profile
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leadersList.map((l) => (
                  <div key={l.id} className="bg-white border border-slate-200 p-4 flex justify-between items-start gap-4">
                    <div>
                      <p className="text-xs text-slate-500">{l.officialTitle} · {l.isVerified ? 'Verified' : 'Unverified'}</p>
                      <h3 className="font-semibold text-sm">{l.fullName}</h3>
                      <p className="text-xs text-slate-600">{l.ministryPosition}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-base font-semibold pt-4">Ministries</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ministriesList.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-200 p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500">{m.isVerified ? 'Verified' : 'Proposed'}</p>
                      <h3 className="font-semibold text-sm">{m.name}</h3>
                    </div>
                    {hasPerm('ministries.manage') && (
                      <button
                        onClick={async () => {
                          await authFetch(`/api/admin/ministries/${m.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ...m, isVerified: !m.isVerified, status: !m.isVerified ? 'active' : 'proposed' }),
                          });
                          loadTabData('leadership');
                          onDataChanged();
                        }}
                        className="px-3 py-1 border border-slate-300 text-xs cursor-pointer"
                      >
                        {m.isVerified ? 'Mark Proposed' : 'Confirm'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. CONTACT MESSAGES */}
          {activeTab === 'messages' && (
            <div className="bg-white border border-slate-200 p-5 space-y-4">
              <h1 className="text-lg font-semibold">Contact Messages</h1>
              {messagesList.length === 0 ? (
                <p className="text-xs text-slate-500">No contact messages received yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {messagesList.map((msg) => (
                    <div key={msg.id} className="py-3 flex justify-between items-start gap-4">
                      <div>
                        <p className="text-xs font-mono text-slate-500">{msg.referenceNumber} · {msg.fullName} ({msg.phone || msg.email || 'No contact'})</p>
                        <h3 className="text-sm font-semibold mt-0.5">{msg.subject}</h3>
                        <p className="text-xs text-slate-600 mt-1">{msg.message}</p>
                      </div>
                      <select
                        value={msg.status}
                        onChange={async (e) => {
                          await authFetch(`/api/admin/messages/${msg.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: e.target.value }),
                          });
                          loadTabData('messages');
                        }}
                        className="px-2 py-1 border border-slate-200 text-xs"
                      >
                        {['New', 'Reviewed', 'Replied', 'Closed'].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 13. ADMIN USERS & RBAC */}
          {activeTab === 'users' && (
            <div className="bg-white border border-slate-200 p-5 space-y-4">
              <h1 className="text-lg font-semibold">Staff Accounts & Role-Based Permissions (RBAC)</h1>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2">Email</th>
                      <th className="py-2">Name</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">Assigned Fellowship</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="py-2.5 font-mono">{u.email}</td>
                        <td className="py-2.5">{u.fullName}</td>
                        <td className="py-2.5">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              await authFetch(`/api/admin/users/${u.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ ...u, role: e.target.value }),
                              });
                              notify('Role updated.');
                              loadTabData('users');
                            }}
                            className="px-2 py-1 border border-slate-200 text-xs"
                          >
                            {['super_admin', 'church_admin', 'pastor', 'fellowship_leader', 'media_admin', 'prayer_team', 'member'].map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5">
                          <select
                            value={u.assignedFellowshipId || ''}
                            onChange={async (e) => {
                              await authFetch(`/api/admin/users/${u.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ ...u, assignedFellowshipId: e.target.value || null }),
                              });
                              loadTabData('users');
                            }}
                            className="px-2 py-1 border border-slate-200 text-xs"
                          >
                            <option value="">None</option>
                            {fellowshipsData.fellowships.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5">{u.accountStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 14. WEBSITE SETTINGS */}
          {activeTab === 'settings' && settingsForm && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await authFetch('/api/admin/settings', {
                  method: 'PUT',
                  body: JSON.stringify(settingsForm),
                });
                if (res.ok) {
                  notify('Website settings saved.');
                  onDataChanged();
                }
              }}
              className="bg-white border border-slate-200 p-6 space-y-5"
            >
              <h1 className="text-xl font-semibold">Website Settings & Church Identity</h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Church Name</label>
                  <input value={settingsForm.churchName} onChange={(e) => setSettingsForm({ ...settingsForm, churchName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Church Location</label>
                  <input value={settingsForm.location} onChange={(e) => setSettingsForm({ ...settingsForm, location: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Church Leader</label>
                  <input value={settingsForm.leadPastor} onChange={(e) => setSettingsForm({ ...settingsForm, leadPastor: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Office Phone</label>
                  <input value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold">Top Announcement Bar</h2>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={settingsForm.announcementBar?.enabled}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        announcementBar: { ...settingsForm.announcementBar, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Show announcement bar on public website</span>
                </label>
                <input
                  value={settingsForm.announcementBar?.text || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      announcementBar: { ...settingsForm.announcementBar, text: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold">Mission, Vision & Verification Status</h2>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={settingsForm.missionVerified}
                    onChange={(e) => setSettingsForm({ ...settingsForm, missionVerified: e.target.checked })}
                  />
                  <span>Mark Mission & Vision as Officially Verified</span>
                </label>
                <textarea rows={2} value={settingsForm.missionStatement} onChange={(e) => setSettingsForm({ ...settingsForm, missionStatement: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" placeholder="Mission statement" />
                <textarea rows={2} value={settingsForm.visionStatement} onChange={(e) => setSettingsForm({ ...settingsForm, visionStatement: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" placeholder="Vision statement" />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold">Guiding Scripture & Pastoral Charge</h2>
                <input
                  value={settingsForm.guidingScriptureReference || '2 Timothy 4:2–5'}
                  onChange={(e) => setSettingsForm({ ...settingsForm, guidingScriptureReference: e.target.value })}
                  placeholder="Scripture Reference (e.g. 2 Timothy 4:2–5)"
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
                <textarea
                  rows={3}
                  value={settingsForm.guidingScriptureText || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, guidingScriptureText: e.target.value })}
                  placeholder="Guiding Scripture passage displayed on the landing page"
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold">Official Tithes & Offerings Channels</h2>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.givingConfig?.givingVerified)}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), givingVerified: e.target.checked },
                      })
                    }
                  />
                  <span>Publish M-Pesa / Bank account details publicly (Mark Officially Verified)</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    placeholder="M-Pesa Paybill Number"
                    value={settingsForm.givingConfig?.mpesaPaybill || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), mpesaPaybill: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="M-Pesa Account Format (e.g. Tithe / Offering)"
                    value={settingsForm.givingConfig?.mpesaAccountFormat || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), mpesaAccountFormat: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="M-Pesa Buy Goods Till (optional)"
                    value={settingsForm.givingConfig?.mpesaTill || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), mpesaTill: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    placeholder="Bank Name"
                    value={settingsForm.givingConfig?.bankName || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), bankName: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="Bank Account Name"
                    value={settingsForm.givingConfig?.bankAccountName || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), bankAccountName: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="Bank Account Number"
                    value={settingsForm.givingConfig?.bankAccountNumber || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), bankAccountNumber: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="Security notice / giving instructions"
                  value={settingsForm.givingConfig?.givingNotice || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      givingConfig: { ...(settingsForm.givingConfig || { givingVerified: false }), givingNotice: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold">Weekly Service Times & Calendar Schedule</h2>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.serviceScheduleVerified)}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, serviceScheduleVerified: e.target.checked })
                    }
                  />
                  <span>Publish confirmed weekly service times on the public Church Events Calendar</span>
                </label>

                <div className="space-y-2">
                  {(settingsForm.serviceTimes || []).map((srv, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                      <select
                        value={srv.day}
                        onChange={(e) => {
                          const next = [...(settingsForm.serviceTimes || [])];
                          next[idx] = { ...srv, day: e.target.value };
                          setSettingsForm({ ...settingsForm, serviceTimes: next });
                        }}
                        className="px-3 py-2 border border-slate-300 text-xs"
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        placeholder="Time (e.g. 9:00 AM - 12:30 PM)"
                        value={srv.time}
                        onChange={(e) => {
                          const next = [...(settingsForm.serviceTimes || [])];
                          next[idx] = { ...srv, time: e.target.value };
                          setSettingsForm({ ...settingsForm, serviceTimes: next });
                        }}
                        className="px-3 py-2 border border-slate-300 text-xs"
                      />
                      <input
                        placeholder="Service Title (e.g. Sunday Celebration Service)"
                        value={srv.title}
                        onChange={(e) => {
                          const next = [...(settingsForm.serviceTimes || [])];
                          next[idx] = { ...srv, title: e.target.value };
                          setSettingsForm({ ...settingsForm, serviceTimes: next });
                        }}
                        className="px-3 py-2 border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (settingsForm.serviceTimes || []).filter((_, i) => i !== idx);
                          setSettingsForm({ ...settingsForm, serviceTimes: next });
                        }}
                        className="px-3 py-2 border border-red-200 text-red-700 text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm({
                        ...settingsForm,
                        serviceTimes: [
                          ...(settingsForm.serviceTimes || []),
                          { day: 'Sunday', time: '9:00 AM', title: '' },
                        ],
                      })
                    }
                    className="px-3 py-1.5 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    + Add Weekly Service Time
                  </button>
                </div>

                <textarea rows={2} value={settingsForm.serviceScheduleNotice} onChange={(e) => setSettingsForm({ ...settingsForm, serviceScheduleNotice: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" placeholder="Service schedule notice when awaiting confirmation" />
                <input value={settingsForm.footerTagline} onChange={(e) => setSettingsForm({ ...settingsForm, footerTagline: e.target.value })} className="w-full px-3 py-2 border border-slate-300 text-xs" placeholder="Footer tagline" />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold">GVCC TV LIVE &amp; CHURCH MEDIA Broadcast Portal</h2>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.tvLiveConfig?.isLive)}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        tvLiveConfig: {
                          channelName: settingsForm.tvLiveConfig?.channelName || 'GVCC TV LIVE',
                          streamTitle: settingsForm.tvLiveConfig?.streamTitle || 'Sunday Celebration & Word Service — GVCC Ogembo',
                          ...(settingsForm.tvLiveConfig || {}),
                          isLive: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>Mark GVCC TV LIVE Broadcast as Currently ON AIR</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    placeholder="Channel Name (e.g. GVCC TV LIVE)"
                    value={settingsForm.tvLiveConfig?.channelName || 'GVCC TV LIVE'}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        tvLiveConfig: {
                          isLive: Boolean(settingsForm.tvLiveConfig?.isLive),
                          streamTitle: settingsForm.tvLiveConfig?.streamTitle || '',
                          ...(settingsForm.tvLiveConfig || {}),
                          channelName: e.target.value,
                        },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="Live Service / Broadcast Title"
                    value={settingsForm.tvLiveConfig?.streamTitle || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        tvLiveConfig: {
                          isLive: Boolean(settingsForm.tvLiveConfig?.isLive),
                          channelName: settingsForm.tvLiveConfig?.channelName || 'GVCC TV LIVE',
                          ...(settingsForm.tvLiveConfig || {}),
                          streamTitle: e.target.value,
                        },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                  <input
                    placeholder="Speaker / Minister"
                    value={settingsForm.tvLiveConfig?.streamSpeaker || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        tvLiveConfig: {
                          isLive: Boolean(settingsForm.tvLiveConfig?.isLive),
                          channelName: settingsForm.tvLiveConfig?.channelName || 'GVCC TV LIVE',
                          streamTitle: settingsForm.tvLiveConfig?.streamTitle || '',
                          ...(settingsForm.tvLiveConfig || {}),
                          streamSpeaker: e.target.value,
                        },
                      })
                    }
                    className="px-3 py-2 border border-slate-300 text-xs"
                  />
                </div>
                <input
                  placeholder="Live Stream URL (YouTube Live, Vimeo, Facebook Video, or direct .mp4)"
                  value={settingsForm.tvLiveConfig?.streamUrl || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      tvLiveConfig: {
                        isLive: Boolean(settingsForm.tvLiveConfig?.isLive),
                        channelName: settingsForm.tvLiveConfig?.channelName || 'GVCC TV LIVE',
                        streamTitle: settingsForm.tvLiveConfig?.streamTitle || '',
                        ...(settingsForm.tvLiveConfig || {}),
                        streamUrl: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
                <textarea
                  rows={2}
                  placeholder="Standby message or weekly TV broadcast notice"
                  value={settingsForm.tvLiveConfig?.scheduleNote || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      tvLiveConfig: {
                        isLive: Boolean(settingsForm.tvLiveConfig?.isLive),
                        channelName: settingsForm.tvLiveConfig?.channelName || 'GVCC TV LIVE',
                        streamTitle: settingsForm.tvLiveConfig?.streamTitle || '',
                        ...(settingsForm.tvLiveConfig || {}),
                        scheduleNote: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 text-xs"
                />
              </div>

              <button type="submit" className="px-6 py-2.5 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer">
                Save Website Settings
              </button>
            </form>
          )}

          {/* GOOGLE WORKSPACE */}
          {activeTab === 'workspace' && <GoogleWorkspacePanel onNotify={notify} />}

          {/* FIRESTORE MEMBER DIRECTORY */}
          {activeTab === 'firestore-members' && hasPerm('members.view') && (
            <FirestoreMemberDirectory
              fellowships={fellowshipsData.fellowships}
              sqlMembers={membersList}
              canCreateMembers={hasPerm('members.create')}
              canEditMembers={hasPerm('members.edit')}
              canDeleteMembers={hasPerm('members.archive')}
              onNotify={notify}
            />
          )}

          {/* DOCUMENT HUB & HELP */}
          {activeTab === 'docs-hub' && (
            <DocumentHubHelpPanel
              onOpenWorkspaceTab={() => setActiveTab('workspace')}
              onOpenMembersTab={() => {
                setShowImportUtility(true);
                setActiveTab('members');
              }}
              onExportCsv={handleCsvExport}
              canExportReports={hasPerm('reports.export')}
              onNotify={notify}
            />
          )}
        </main>
      </div>
    </div>
  );
};
