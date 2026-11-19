export interface AnnouncementBarConfig {
  enabled: boolean;
  text: string;
  linkLabel?: string;
  linkUrl?: string;
  bgColor?: string;
}

export interface ServiceTimeItem {
  day: string;
  time: string;
  title: string;
}

export interface CoreValueItem {
  title: string;
  description: string;
}

export interface GivingConfig {
  givingVerified: boolean;
  stewardshipScriptureRef?: string;
  stewardshipScriptureText?: string;
  givingNotice?: string;
  mpesaPaybill?: string;
  mpesaAccountFormat?: string;
  mpesaTill?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  inPersonInstructions?: string;
}

export interface TvLiveConfig {
  isLive: boolean;
  channelName: string;
  streamTitle: string;
  streamSpeaker?: string;
  streamUrl?: string;
  scheduleNote?: string;
  description?: string;
}

export interface ChurchSettings {
  churchName: string;
  shortName: string;
  location: string;
  leadPastor: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  welcomeHeading: string;
  welcomeBody: string;
  missionStatement: string;
  visionStatement: string;
  missionVerified: boolean;
  serviceScheduleNotice: string;
  serviceScheduleVerified: boolean;
  serviceTimes: ServiceTimeItem[];
  coreValues: CoreValueItem[];
  footerTagline: string;
  announcementBar: AnnouncementBarConfig;
  mapNotice: string;
  guidingScriptureReference?: string;
  guidingScriptureText?: string;
  givingConfig?: GivingConfig;
  tvLiveConfig?: TvLiveConfig;
}

export interface HomepageSlide {
  id: number;
  imageUrl: string;
  eyebrow: string;
  heading: string;
  subtitle: string;
  scriptureReference: string | null;
  buttonLabel: string;
  buttonUrl: string;
  objectPosition: string;
  displayOrder: number;
  durationSeconds: number;
  active: boolean;
}

export interface Leader {
  id: number;
  fullName: string;
  officialTitle: string;
  ministryPosition: string;
  biography: string;
  areasOfMinistry: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  displayOrder: number;
  isVerified: boolean;
  active: boolean;
}

export interface Fellowship {
  id: number;
  name: string;
  slug: string;
  description: string;
  leaderName: string | null;
  contactPhone: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  imageUrl: string | null;
  status: string;
  isVerified: boolean;
  displayOrder: number;
}

export interface Ministry {
  id: number;
  name: string;
  slug: string;
  description: string;
  leaderName: string | null;
  contactPhone: string | null;
  imageUrl: string | null;
  status: string;
  isVerified: boolean;
  displayOrder: number;
}

export interface EventItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  eventCategory: string;
  startDatetime: string;
  endDatetime: string | null;
  location: string;
  posterUrl: string | null;
  registrationOpen: boolean;
  registrationDeadline: string | null;
  capacity: number | null;
  contactPerson: string | null;
  status: string;
  registrations?: Array<{
    id: number;
    fullName: string;
    phone: string;
    email: string | null;
    guestsCount: number;
    attendanceStatus: string;
    registrationDate: string;
  }>;
}

export interface NewsPost {
  id: number;
  title: string;
  slug: string;
  summary: string;
  body: string;
  featuredImage: string | null;
  category: string;
  authorName: string;
  status: string;
  publishedAt: string;
}

export interface Sermon {
  id: number;
  title: string;
  speaker: string;
  scriptureReference: string | null;
  description: string;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  sermonDate: string;
  duration: string | null;
  category: string;
  featured: boolean;
  status: string;
}

export interface MediaAsset {
  id: number;
  filename: string;
  storagePath: string;
  mediaType: string;
  caption: string | null;
  altText: string | null;
  category: string;
  featured: boolean;
  hidden: boolean;
  displayOrder: number;
}

export interface MemberFollowupRecord {
  id: number;
  memberId: number;
  staffName: string;
  followupDate: string;
  followupMethod: string;
  notes: string;
  nextAction: string | null;
}

export interface MemberRecord {
  id: number;
  memberNumber: string;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  photoUrl: string | null;
  phone: string;
  whatsappNumber: string | null;
  email: string | null;
  residentialAddress: string | null;
  location: string | null;
  county: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  acceptedChrist: boolean | null;
  isBaptised: boolean | null;
  baptismDate: string | null;
  previousChurch: string | null;
  membershipType: string;
  joinDate: string | null;
  registrationDate: string;
  membershipStatus: string;
  interestedMinistries: string[];
  fellowshipId: number | null;
  preferredFellowship: string | null;
  preferredService: string | null;
  assignedPastor: string | null;
  discipleshipStatus: string | null;
  ministryId: number | null;
  preferredContactMethod: string | null;
  testimony: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
  followups?: MemberFollowupRecord[];
}

export interface VisitorRecord {
  id: number;
  visitorNumber: string;
  fullName: string;
  phone: string;
  email: string | null;
  residence: string | null;
  firstTimeVisitor: boolean;
  preferredVisitDate: string | null;
  accompanyingCount: number;
  visitSource: string | null;
  assistanceRequest: string | null;
  followupStatus: string;
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
}

export interface PrayerFollowup {
  id: number;
  prayerRequestId: number;
  staffName: string;
  followupDate: string;
  followupMethod: string;
  notes: string;
  nextAction: string | null;
}

export interface PrayerRecord {
  id: number;
  referenceNumber: string;
  requesterName: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  requestContent: string;
  privacyLevel: string;
  prayerCount: number;
  followupRequested: boolean;
  status: string;
  assignedUserId: number | null;
  createdAt: string;
  updatedAt: string;
  followups: PrayerFollowup[];
}

export interface PrayerSupportItem {
  id: number;
  supporterName: string;
  encouragementNote: string | null;
  createdAt: string;
}

export interface PublicPrayerItem {
  id: number;
  referenceNumber: string;
  requesterName: string;
  category: string;
  requestContent: string;
  privacyLevel: string;
  prayerCount: number;
  status: string;
  createdAt: string;
  supports: PrayerSupportItem[];
}

export interface DevotionalItem {
  id: number;
  title: string;
  scriptureReference: string;
  scriptureText: string | null;
  message: string;
  prayerFocus: string | null;
  authorName: string;
  authorTitle: string | null;
  devotionalDate: string;
  featured: boolean;
  status: string;
  createdAt: string;
}

export interface GivingRecord {
  id: number;
  referenceNumber: string;
  giverName: string;
  phone: string | null;
  email: string | null;
  givingCategory: string;
  givingMethod: string;
  amountKes: number | null;
  transactionReference: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface DutyRosterRecord {
  id: number;
  rosterNumber: string;
  serviceDate: string;
  serviceTitle: string;
  department: string;
  assignedMember: string;
  contactPhone: string | null;
  shiftTime: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface ChurchAssetRecord {
  id: number;
  assetTag: string;
  assetName: string;
  category: string;
  quantity: number;
  serialNumber: string | null;
  acquisitionDate: string | null;
  estimatedValueKes: number | null;
  location: string;
  custodianName: string | null;
  condition: string;
  notes: string | null;
  createdAt: string;
}

export interface PublicTestimonyItem {
  id: number;
  referenceNumber: string;
  authorName: string;
  displayAnonymous: boolean;
  fellowshipGroup: string | null;
  category: string;
  title: string;
  story: string;
  scriptureReference: string | null;
  amenCount: number;
  featured: boolean;
  createdAt: string;
}

export interface TestimonyRecord extends PublicTestimonyItem {
  phone: string | null;
  email: string | null;
  moderationStatus: string;
  moderationNotes: string | null;
  moderatedAt: string | null;
}

export interface PublicBootstrap {
  settings: ChurchSettings | null;
  slides: HomepageSlide[];
  leaders: Leader[];
  fellowships: Fellowship[];
  ministries: Ministry[];
  events: EventItem[];
  news: NewsPost[];
  sermons: Sermon[];
  gallery: MediaAsset[];
  publicPrayers: PublicPrayerItem[];
  devotionals: DevotionalItem[];
  testimonies: PublicTestimonyItem[];
}
