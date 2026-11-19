-- Gracious Voice Celebration Centre (GVCC) Idempotent Seed Data
-- Run after database/schema.sql on Vercel Postgres, Neon, Supabase, Railway, or Cloud SQL.

INSERT INTO church_settings (setting_key, setting_value)
VALUES (
  'identity',
  '{
    "churchName": "Gracious Voice Celebration Centre",
    "shortName": "GVCC",
    "location": "Ogembo, Kenya",
    "leadPastor": "Bishop Joseph Ondari Gichana",
    "phone": "0727 543 663",
    "whatsappNumber": "254727543663",
    "email": "",
    "welcomeHeading": "Welcome to Gracious Voice Celebration Centre",
    "welcomeBody": "We welcome you to Gracious Voice Celebration Centre in Ogembo — a community gathered in faith and united by the desire to seek God, grow spiritually, worship together, and share the hope of Christ.",
    "missionStatement": "Official GVCC mission statement awaiting confirmation from church leadership in the Admin Settings panel.",
    "visionStatement": "Official GVCC vision statement awaiting confirmation from church leadership in the Admin Settings panel.",
    "missionVerified": false,
    "serviceScheduleNotice": "Official weekly worship service times are being confirmed by church leadership. Please call 0727 543 663 or visit us in Ogembo for this week’s schedule.",
    "serviceScheduleVerified": false,
    "serviceTimes": [],
    "coreValues": [],
    "footerTagline": "A place of faith, hope, worship and fellowship in Ogembo, Kenya.",
    "announcementBar": {
      "enabled": true,
      "text": "WELCOME TO GRACIOUS VOICE CELEBRATION CENTRE, OGEMBO — A PLACE OF FAITH, HOPE & TRANSFORMATION.",
      "linkLabel": "Plan Your Visit",
      "linkUrl": "#connect",
      "bgColor": "#1C1917"
    },
    "mapNotice": "Centered on Ogembo, Kisii County, Kenya. Exact street coordinates awaiting church confirmation.",
    "guidingScriptureReference": "2 Timothy 4:2–5",
    "guidingScriptureText": "Preach the word; be prepared in season and out of season; correct, rebuke and encourage—with great patience and careful instruction. For the time will come when people will not put up with sound doctrine. Instead, to suit their own desires, they will gather around them a great number of teachers to say what their itching ears want to hear. They will turn their ears away from the truth and turn aside to myths. But you, keep your head in all situations, endure hardship, do the work of an evangelist, discharge all the duties of your ministry.",
    "givingConfig": {
      "givingVerified": false,
      "stewardshipScriptureRef": "2 Corinthians 9:7",
      "stewardshipScriptureText": "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.",
      "givingNotice": "Official M-Pesa Paybill, Till, and Bank Account details are verified and published exclusively by church leadership. Please confirm directly with the church office on 0727 543 663 before sending electronic contributions.",
      "mpesaPaybill": "",
      "mpesaAccountFormat": "GVCC Tithe / Offering",
      "mpesaTill": "",
      "bankName": "",
      "bankAccountName": "Gracious Voice Celebration Centre",
      "bankAccountNumber": "",
      "bankBranch": "Ogembo",
      "inPersonInstructions": "Tithes and offerings may also be presented in person during sanctuary services at Gracious Voice Celebration Centre, Ogembo."
    },
    "tvLiveConfig": {
      "isLive": false,
      "channelName": "GVCC TV LIVE",
      "streamTitle": "Sunday Celebration & Word Service — GVCC Ogembo",
      "streamSpeaker": "Bishop Joseph Ondari Gichana",
      "streamUrl": "",
      "scheduleNote": "Live sanctuary broadcasts stream on GVCC TV LIVE when activated by the Church Media team in Website Settings.",
      "description": "Watch live services, worship gatherings, and special broadcasts from Gracious Voice Celebration Centre in Ogembo through the official Church Media Portal."
    }
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO leaders (
  full_name, official_title, ministry_position, biography, areas_of_ministry,
  phone, photo_url, display_order, is_verified, active
)
SELECT
  'Bishop Joseph Ondari Gichana',
  'Bishop',
  'Senior Church Leader, GVCC Ogembo',
  'Bishop Joseph Ondari Gichana leads Gracious Voice Celebration Centre (GVCC) in Ogembo, shepherding the congregation in the Word, prayer, and Christian fellowship.',
  'Preaching, Pastoral Oversight, Prayer & Discipleship',
  '0727 543 663',
  '/images/church/photo_22.jpg',
  1,
  TRUE,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM leaders);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM homepage_slides) THEN
    INSERT INTO homepage_slides (
      image_url, eyebrow, heading, subtitle, scripture_reference,
      button_label, button_url, object_position, display_order, duration_seconds, active
    ) VALUES
      ('/images/church/photo_00.jpg', 'Gracious Voice Celebration Centre · Ogembo', 'A Place Where Faith Comes Alive', 'Discover hope, experience God’s presence, and grow in faith with a community committed to the Word.', 'Psalm 122:1', 'Plan Your Visit', '#connect', '50% 22%', 1, 7, TRUE),
      ('/images/church/photo_22.jpg', 'Rooted in the Word', 'Come Into His Presence', 'A moment of worship. A heart surrendered. A life transformed through the teaching of Christ.', 'Psalm 95:1-2', 'Request Prayer', '#prayer', '50% 20%', 2, 7, TRUE),
      ('/images/church/photo_03.jpg', 'Community & Belonging', 'You Belong Here', 'Grow together, pray together, and walk together in Christian love at GVCC Ogembo.', 'Hebrews 10:24-25', 'Explore Fellowships', '#fellowships', '50% 30%', 3, 7, TRUE),
      ('/images/church/photo_27.jpg', 'Worship & Praise', 'Voices Lifted in Worship', 'Hearts united in praise and thanksgiving across generations within the GVCC family.', 'Psalm 100:4', 'View Church Gallery', '#gallery', '50% 28%', 4, 7, TRUE),
      ('/images/church/photo_36.jpg', 'Pastoral Care & Prayer', 'There Is Hope for Every Season', 'No matter where life takes you, there is grace, prayer support, and a place to begin again.', 'Romans 15:13', 'Submit Prayer Request', '#prayer', '50% 20%', 5, 7, TRUE),
      ('/images/church/photo_16.jpg', 'Welcome Home', 'Experience the Love of God', 'We warmly invite you and your family to connect with Bishop Joseph Ondari Gichana and the GVCC family.', 'John 13:34-35', 'Connect With Us', '#connect', '50% 25%', 6, 7, TRUE);
  END IF;
END $$;

INSERT INTO fellowships (name, slug, description, image_url, status, is_verified, display_order)
VALUES
  ('Women''s Fellowship', 'womens-fellowship', 'Prayer, mutual encouragement, discipleship, and growing together as women of faith.', '/images/church/photo_27.jpg', 'proposed', FALSE, 1),
  ('Youth Fellowship', 'youth-fellowship', 'Building faith, godly friendships, purpose, and spiritual leadership among young people.', '/images/church/photo_16.jpg', 'proposed', FALSE, 2),
  ('Men''s Fellowship', 'mens-fellowship', 'Brotherhood, spiritual accountability, and serving families and the church community.', '/images/church/photo_42.jpg', 'proposed', FALSE, 3),
  ('Prayer Fellowship', 'prayer-fellowship', 'Gathering together in intercession, spiritual support, and prayer for the church and community.', '/images/church/photo_62.jpg', 'proposed', FALSE, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ministries (name, slug, description, image_url, status, is_verified, display_order)
VALUES
  ('Worship & Choir Ministry', 'worship-and-choir', 'Leading the congregation in heartfelt worship and praise during church gatherings.', '/images/church/photo_20.jpg', 'proposed', FALSE, 1),
  ('Pastoral & Prayer Ministry', 'pastoral-and-prayer', 'Standing with believers through intercession, visitation, and spiritual care.', '/images/church/photo_36.jpg', 'proposed', FALSE, 2),
  ('Word & Teaching Ministry', 'word-and-teaching', 'Sound biblical teaching and discipleship rooted in Scripture.', '/images/church/photo_24.jpg', 'proposed', FALSE, 3),
  ('Hospitality & Community Care', 'hospitality-and-care', 'Welcoming visitors and fostering warm fellowship across the congregation.', '/images/church/photo_06.jpg', 'proposed', FALSE, 4)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  idx INTEGER;
  padded TEXT;
  cat TEXT;
  cap TEXT;
  is_feat BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM media_assets) THEN
    FOR idx IN 0..66 LOOP
      padded := LPAD(idx::TEXT, 2, '0');
      IF idx BETWEEN 0 AND 1 THEN
        cat := 'Church services';
        cap := 'Church leadership welcoming the congregation at GVCC Ogembo';
      ELSIF idx BETWEEN 2 AND 5 THEN
        cat := 'Congregation';
        cap := 'Worship service and congregational gathering at GVCC Ogembo';
      ELSIF idx BETWEEN 6 AND 9 THEN
        cat := 'Fellowship';
        cap := 'Warm fellowship and joyful praise among members';
      ELSIF idx BETWEEN 10 AND 15 THEN
        cat := 'Church services';
        cap := 'Ministry of the Word and prayer at GVCC sanctuary';
      ELSIF idx BETWEEN 16 AND 19 THEN
        cat := 'Church activities';
        cap := 'Youth presentation and special ministry during service';
      ELSIF idx BETWEEN 20 AND 21 THEN
        cat := 'Worship';
        cap := 'Choir leading worship and praise';
      ELSIF idx BETWEEN 22 AND 25 THEN
        cat := 'Preaching';
        cap := 'Bishop Joseph Ondari Gichana preaching the Word of God';
      ELSIF idx BETWEEN 26 AND 35 THEN
        cat := 'Worship';
        cap := 'Choir and fellowship ministry during Sunday celebration';
      ELSIF idx BETWEEN 36 AND 41 THEN
        cat := 'Preaching';
        cap := 'Bishop Joseph Ondari Gichana ministering and praying with believers';
      ELSIF idx BETWEEN 42 AND 43 THEN
        cat := 'Fellowship';
        cap := 'Church members and leaders in fellowship';
      ELSIF idx BETWEEN 44 AND 60 THEN
        cat := 'Preaching';
        cap := 'Bishop Joseph Ondari Gichana delivering the sermon from the pulpit';
      ELSIF idx BETWEEN 61 AND 64 THEN
        cat := 'Congregation';
        cap := 'Believers gathered in prayer and listening to the Word';
      ELSE
        cat := 'Preaching';
        cap := 'Closing prayer and benediction by Bishop Joseph Ondari Gichana';
      END IF;

      is_feat := idx IN (0, 2, 11, 16, 20, 22, 24, 27, 36, 44, 52, 62);

      INSERT INTO media_assets (
        filename, storage_path, media_type, caption, alt_text,
        category, featured, hidden, display_order
      ) VALUES (
        'photo_' || padded || '.jpg',
        '/images/church/photo_' || padded || '.jpg',
        'image',
        cap,
        cap || ' — Gracious Voice Celebration Centre Ogembo',
        cat,
        is_feat,
        FALSE,
        idx + 1
      );
    END LOOP;
  END IF;
END $$;
