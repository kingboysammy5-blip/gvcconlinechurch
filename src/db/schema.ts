import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Authenticated Platform Users (Staff, Pastors, Fellowship Leaders, Admins)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default('GVCC Staff'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('member'), // super_admin, church_admin, pastor, fellowship_leader, media_admin, prayer_team, member
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  assignedFellowshipId: integer('assigned_fellowship_id'),
  accountStatus: text('account_status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Fellowships
export const fellowships = pgTable('fellowships', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  leaderName: text('leader_name'),
  leaderId: integer('leader_id'),
  contactPhone: text('contact_phone'),
  meetingDay: text('meeting_day'),
  meetingTime: text('meeting_time'),
  meetingLocation: text('meeting_location'),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('proposed'), // active, proposed, inactive
  isVerified: boolean('is_verified').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Ministries
export const ministries = pgTable('ministries', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  leaderName: text('leader_name'),
  leaderId: integer('leader_id'),
  contactPhone: text('contact_phone'),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('proposed'),
  isVerified: boolean('is_verified').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Church Leadership Profiles
export const leaders = pgTable('leaders', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  officialTitle: text('official_title').notNull(),
  ministryPosition: text('ministry_position').notNull(),
  biography: text('biography').notNull(),
  areasOfMinistry: text('areas_of_ministry'),
  email: text('email'),
  phone: text('phone'),
  photoUrl: text('photo_url'),
  displayOrder: integer('display_order').notNull().default(0),
  isVerified: boolean('is_verified').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Church Members
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  memberNumber: text('member_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  location: text('location'),
  dateOfBirth: text('date_of_birth'),
  gender: text('gender'),
  registrationDate: text('registration_date').notNull(),
  membershipType: text('membership_type').notNull().default('New member'),
  membershipStatus: text('membership_status').notNull().default('New registration'),
  fellowshipId: integer('fellowship_id').references(() => fellowships.id, { onDelete: 'set null' }),
  ministryId: integer('ministry_id').references(() => ministries.id, { onDelete: 'set null' }),
  preferredContactMethod: text('preferred_contact_method').default('Phone'),
  testimony: text('testimony'),
  notes: text('notes'),
  assignedLeaderId: integer('assigned_leader_id').references(() => users.id, { onDelete: 'set null' }),
  consent: boolean('consent').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Visitors
export const visitors = pgTable('visitors', {
  id: serial('id').primaryKey(),
  visitorNumber: text('visitor_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  residence: text('residence'),
  firstTimeVisitor: boolean('first_time_visitor').notNull().default(true),
  preferredVisitDate: text('preferred_visit_date'),
  accompanyingCount: integer('accompanying_count').notNull().default(0),
  visitSource: text('visit_source'),
  assistanceRequest: text('assistance_request'),
  followupStatus: text('followup_status').notNull().default('New'),
  assignedStaffId: integer('assigned_staff_id').references(() => users.id, { onDelete: 'set null' }),
  lastContactedAt: timestamp('last_contacted_at'),
  notes: text('notes'),
  consent: boolean('consent').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Fellowship Join Requests
export const fellowshipJoinRequests = pgTable('fellowship_join_requests', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(),
  fellowshipId: integer('fellowship_id')
    .references(() => fellowships.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  memberOrVisitor: text('member_or_visitor').notNull().default('Visitor'),
  preferredCommunication: text('preferred_communication').default('Phone'),
  availability: text('availability'),
  prayerRequest: text('prayer_request'),
  consent: boolean('consent').notNull().default(true),
  followupStatus: text('followup_status').notNull().default('New'),
  assignedLeaderId: integer('assigned_leader_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Prayer Requests (Confidential)
export const prayerRequests = pgTable('prayer_requests', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(),
  requesterName: text('requester_name'),
  phone: text('phone'),
  email: text('email'),
  category: text('category').notNull(),
  requestContent: text('request_content').notNull(),
  privacyLevel: text('privacy_level').notNull().default('confidential'), // confidential, prayer_team, public_board, public_testimony
  prayerCount: integer('prayer_count').notNull().default(0),
  followupRequested: boolean('followup_requested').notNull().default(false),
  consent: boolean('consent').notNull().default(true),
  status: text('status').notNull().default('New'),
  assignedUserId: integer('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Prayer Follow-up History
export const prayerFollowups = pgTable('prayer_followups', {
  id: serial('id').primaryKey(),
  prayerRequestId: integer('prayer_request_id')
    .references(() => prayerRequests.id, { onDelete: 'cascade' })
    .notNull(),
  staffUserId: integer('staff_user_id').references(() => users.id, { onDelete: 'set null' }),
  staffName: text('staff_name').notNull(),
  followupDate: timestamp('followup_date').defaultNow().notNull(),
  followupMethod: text('followup_method').notNull().default('Prayer'),
  notes: text('notes').notNull(),
  nextAction: text('next_action'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9b. Public Prayer Board Encouragements / "I'm Praying" Records
export const prayerSupports = pgTable('prayer_supports', {
  id: serial('id').primaryKey(),
  prayerRequestId: integer('prayer_request_id')
    .references(() => prayerRequests.id, { onDelete: 'cascade' })
    .notNull(),
  supporterName: text('supporter_name').notNull().default('GVCC Member'),
  encouragementNote: text('encouragement_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Events
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  eventCategory: text('event_category').notNull(),
  startDatetime: text('start_datetime').notNull(),
  endDatetime: text('end_datetime'),
  location: text('location').notNull(),
  posterUrl: text('poster_url'),
  registrationOpen: boolean('registration_open').notNull().default(true),
  registrationDeadline: text('registration_deadline'),
  capacity: integer('capacity'),
  contactPerson: text('contact_person'),
  status: text('status').notNull().default('Upcoming'), // Draft, Upcoming, Registration open, Registration closed, Ongoing, Completed, Cancelled
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Event Registrations
export const eventRegistrations = pgTable('event_registrations', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  guestsCount: integer('guests_count').notNull().default(1),
  attendanceStatus: text('attendance_status').notNull().default('Registered'),
  registrationDate: timestamp('registration_date').defaultNow().notNull(),
});

// 12. News & Updates
export const newsPosts = pgTable('news_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  featuredImage: text('featured_image'),
  category: text('category').notNull().default('Church Announcement'),
  authorName: text('author_name').notNull().default('GVCC Communications'),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('Published'), // Draft, Scheduled, Published, Archived
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 13. Sermons & Media
export const sermons = pgTable('sermons', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  speaker: text('speaker').notNull(),
  scriptureReference: text('scripture_reference'),
  description: text('description').notNull(),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  thumbnailUrl: text('thumbnail_url'),
  sermonDate: text('sermon_date').notNull(),
  duration: text('duration'),
  category: text('category').notNull().default('Sunday messages'),
  featured: boolean('featured').notNull().default(false),
  status: text('status').notNull().default('Published'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Media Assets & Gallery
export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  storagePath: text('storage_path').notNull(),
  mediaType: text('media_type').notNull().default('image'),
  caption: text('caption'),
  altText: text('alt_text'),
  category: text('category').notNull().default('Church services'),
  featured: boolean('featured').notNull().default(false),
  hidden: boolean('hidden').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// 15. Homepage Slideshow
export const homepageSlides = pgTable('homepage_slides', {
  id: serial('id').primaryKey(),
  imageUrl: text('image_url').notNull(),
  eyebrow: text('eyebrow').notNull(),
  heading: text('heading').notNull(),
  subtitle: text('subtitle').notNull(),
  scriptureReference: text('scripture_reference'),
  buttonLabel: text('button_label').notNull().default('Plan Your Visit'),
  buttonUrl: text('button_url').notNull().default('#connect'),
  objectPosition: text('object_position').notNull().default('50% 25%'),
  displayOrder: integer('display_order').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(7),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Church Settings (key/value JSON store for identity, announcement bar, mission/vision/values, footer)
export const churchSettings = pgTable('church_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: jsonb('setting_value').$type<Record<string, unknown>>().notNull(),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 17. Contact Messages
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('New'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Daily Devotionals (Posted by Church Leaders)
export const devotionals = pgTable('devotionals', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  scriptureReference: text('scripture_reference').notNull(),
  scriptureText: text('scripture_text'),
  message: text('message').notNull(),
  prayerFocus: text('prayer_focus'),
  authorName: text('author_name').notNull(),
  authorTitle: text('author_title'),
  devotionalDate: text('devotional_date').notNull(),
  featured: boolean('featured').notNull().default(false),
  status: text('status').notNull().default('Published'), // Published, Draft, Archived
  authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Tithes, Offerings & Stewardship Notifications (Confidential to Admin/Leadership)
export const givingRecords = pgTable('giving_records', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(),
  giverName: text('giver_name').notNull().default('Anonymous'),
  phone: text('phone'),
  email: text('email'),
  givingCategory: text('giving_category').notNull(), // Tithe, Offering, Thanksgiving, Building & Development, Missions & Welfare
  givingMethod: text('giving_method').notNull(), // M-Pesa, Bank Transfer, In-Person, Pledge
  amountKes: integer('amount_kes'),
  transactionReference: text('transaction_reference'),
  notes: text('notes'),
  status: text('status').notNull().default('Pending Verification'), // Pending Verification, Verified, Pledge Recorded, Acknowledged
  consent: boolean('consent').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 21. Church Duty Rosters (Services, Ministries, Protocol, Media, Worship, Ushering)
export const dutyRosters = pgTable('duty_rosters', {
  id: serial('id').primaryKey(),
  rosterNumber: text('roster_number').notNull().unique(),
  serviceDate: text('service_date').notNull(),
  serviceTitle: text('service_title').notNull(),
  department: text('department').notNull(),
  assignedMember: text('assigned_member').notNull(),
  contactPhone: text('contact_phone'),
  shiftTime: text('shift_time'),
  status: text('status').notNull().default('Scheduled'), // Scheduled, Confirmed, Completed, Substituted, Cancelled
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 22. Church Assets & Property Inventory
export const churchAssets = pgTable('church_assets', {
  id: serial('id').primaryKey(),
  assetTag: text('asset_tag').notNull().unique(),
  assetName: text('asset_name').notNull(),
  category: text('category').notNull(),
  quantity: integer('quantity').notNull().default(1),
  serialNumber: text('serial_number'),
  acquisitionDate: text('acquisition_date'),
  estimatedValueKes: integer('estimated_value_kes'),
  location: text('location').notNull().default('GVCC Sanctuary, Ogembo'),
  custodianName: text('custodian_name'),
  condition: text('condition').notNull().default('Good'), // Excellent, Good, Fair, Needs Repair, Decommissioned
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 23. Moderated Faith Stories & Testimonies
export const testimonies = pgTable('testimonies', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(),
  authorName: text('author_name').notNull(),
  displayAnonymous: boolean('display_anonymous').notNull().default(false),
  phone: text('phone'),
  email: text('email'),
  fellowshipGroup: text('fellowship_group'),
  category: text('category').notNull().default('Faith & Salvation'),
  title: text('title').notNull(),
  story: text('story').notNull(),
  scriptureReference: text('scripture_reference'),
  amenCount: integer('amen_count').notNull().default(0),
  featured: boolean('featured').notNull().default(false),
  moderationStatus: text('moderation_status').notNull().default('Pending Review'), // Pending Review, Approved, Rejected, Archived
  moderationNotes: text('moderation_notes'),
  moderatedBy: integer('moderated_by').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: timestamp('moderated_at'),
  consent: boolean('consent').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const membersRelations = relations(members, ({ one }) => ({
  fellowship: one(fellowships, {
    fields: [members.fellowshipId],
    references: [fellowships.id],
  }),
  ministry: one(ministries, {
    fields: [members.ministryId],
    references: [ministries.id],
  }),
}));

export const prayerRequestsRelations = relations(prayerRequests, ({ many }) => ({
  followups: many(prayerFollowups),
  supports: many(prayerSupports),
}));

export const prayerFollowupsRelations = relations(prayerFollowups, ({ one }) => ({
  prayerRequest: one(prayerRequests, {
    fields: [prayerFollowups.prayerRequestId],
    references: [prayerRequests.id],
  }),
}));

export const prayerSupportsRelations = relations(prayerSupports, ({ one }) => ({
  prayerRequest: one(prayerRequests, {
    fields: [prayerSupports.prayerRequestId],
    references: [prayerRequests.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
}));
