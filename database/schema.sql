-- Gracious Voice Celebration Centre (GVCC) PostgreSQL Database Schema
-- Compatible with Vercel Postgres, Neon, Supabase, Railway, and Cloud SQL PostgreSQL.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'GVCC Staff',
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_fellowship_id INTEGER,
  account_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fellowships (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  leader_name TEXT,
  leader_id INTEGER,
  contact_phone TEXT,
  meeting_day TEXT,
  meeting_time TEXT,
  meeting_location TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ministries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  leader_name TEXT,
  leader_id INTEGER,
  contact_phone TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaders (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  official_title TEXT NOT NULL,
  ministry_position TEXT NOT NULL,
  biography TEXT NOT NULL,
  areas_of_ministry TEXT,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  member_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  location TEXT,
  date_of_birth TEXT,
  gender TEXT,
  registration_date TEXT NOT NULL,
  membership_type TEXT NOT NULL DEFAULT 'New member',
  membership_status TEXT NOT NULL DEFAULT 'New registration',
  fellowship_id INTEGER REFERENCES fellowships(id) ON DELETE SET NULL,
  ministry_id INTEGER REFERENCES ministries(id) ON DELETE SET NULL,
  preferred_contact_method TEXT DEFAULT 'Phone',
  testimony TEXT,
  notes TEXT,
  assigned_leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  visitor_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  residence TEXT,
  first_time_visitor BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_visit_date TEXT,
  accompanying_count INTEGER NOT NULL DEFAULT 0,
  visit_source TEXT,
  assistance_request TEXT,
  followup_status TEXT NOT NULL DEFAULT 'New',
  assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_contacted_at TIMESTAMP,
  notes TEXT,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fellowship_join_requests (
  id SERIAL PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  fellowship_id INTEGER NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  member_or_visitor TEXT NOT NULL DEFAULT 'Visitor',
  preferred_communication TEXT DEFAULT 'Phone',
  availability TEXT,
  prayer_request TEXT,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  followup_status TEXT NOT NULL DEFAULT 'New',
  assigned_leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prayer_requests (
  id SERIAL PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  requester_name TEXT,
  phone TEXT,
  email TEXT,
  category TEXT NOT NULL,
  request_content TEXT NOT NULL,
  privacy_level TEXT NOT NULL DEFAULT 'confidential',
  prayer_count INTEGER NOT NULL DEFAULT 0,
  followup_requested BOOLEAN NOT NULL DEFAULT FALSE,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'New',
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prayer_followups (
  id SERIAL PRIMARY KEY,
  prayer_request_id INTEGER NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  staff_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  followup_date TIMESTAMP NOT NULL DEFAULT NOW(),
  followup_method TEXT NOT NULL DEFAULT 'Prayer',
  notes TEXT NOT NULL,
  next_action TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prayer_supports (
  id SERIAL PRIMARY KEY,
  prayer_request_id INTEGER NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  supporter_name TEXT NOT NULL DEFAULT 'GVCC Member',
  encouragement_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  event_category TEXT NOT NULL,
  start_datetime TEXT NOT NULL,
  end_datetime TEXT,
  location TEXT NOT NULL,
  poster_url TEXT,
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  registration_deadline TEXT,
  capacity INTEGER,
  contact_person TEXT,
  status TEXT NOT NULL DEFAULT 'Upcoming',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  guests_count INTEGER NOT NULL DEFAULT 1,
  attendance_status TEXT NOT NULL DEFAULT 'Registered',
  registration_date TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  featured_image TEXT,
  category TEXT NOT NULL DEFAULT 'Church Announcement',
  author_name TEXT NOT NULL DEFAULT 'GVCC Communications',
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Published',
  published_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sermons (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  speaker TEXT NOT NULL,
  scripture_reference TEXT,
  description TEXT NOT NULL,
  video_url TEXT,
  audio_url TEXT,
  thumbnail_url TEXT,
  sermon_date TEXT NOT NULL,
  duration TEXT,
  category TEXT NOT NULL DEFAULT 'Sunday messages',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Published',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  alt_text TEXT,
  category TEXT NOT NULL DEFAULT 'Church services',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homepage_slides (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  eyebrow TEXT NOT NULL,
  heading TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  scripture_reference TEXT,
  button_label TEXT NOT NULL DEFAULT 'Plan Your Visit',
  button_url TEXT NOT NULL DEFAULT '#connect',
  object_position TEXT NOT NULL DEFAULT '50% 25%',
  display_order INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 7,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS church_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_uid TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devotionals (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  scripture_reference TEXT NOT NULL,
  scripture_text TEXT,
  message TEXT NOT NULL,
  prayer_focus TEXT,
  author_name TEXT NOT NULL,
  author_title TEXT,
  devotional_date TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Published',
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS giving_records (
  id SERIAL PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  giver_name TEXT NOT NULL DEFAULT 'Anonymous',
  phone TEXT,
  email TEXT,
  giving_category TEXT NOT NULL,
  giving_method TEXT NOT NULL,
  amount_kes INTEGER,
  transaction_reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending Verification',
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duty_rosters (
  id SERIAL PRIMARY KEY,
  roster_number TEXT NOT NULL UNIQUE,
  service_date TEXT NOT NULL,
  service_title TEXT NOT NULL,
  department TEXT NOT NULL,
  assigned_member TEXT NOT NULL,
  contact_phone TEXT,
  shift_time TEXT,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS church_assets (
  id SERIAL PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_number TEXT,
  acquisition_date TEXT,
  estimated_value_kes INTEGER,
  location TEXT NOT NULL DEFAULT 'GVCC Sanctuary, Ogembo',
  custodian_name TEXT,
  condition TEXT NOT NULL DEFAULT 'Good',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS testimonies (
  id SERIAL PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  author_name TEXT NOT NULL,
  display_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  phone TEXT,
  email TEXT,
  fellowship_group TEXT,
  category TEXT NOT NULL DEFAULT 'Faith & Salvation',
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  scripture_reference TEXT,
  amen_count INTEGER NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status TEXT NOT NULL DEFAULT 'Pending Review',
  moderation_notes TEXT,
  moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMP,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Helpful Indexes for Public & Admin Queries
CREATE INDEX IF NOT EXISTS idx_prayer_requests_public ON prayer_requests (privacy_level, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonies_status ON testimonies (moderation_status, featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devotionals_published ON devotionals (status, devotional_date DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_visible ON media_assets (hidden, display_order ASC);
