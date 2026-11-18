import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  churchSettings,
  fellowships,
  homepageSlides,
  leaders,
  mediaAssets,
  ministries,
} from './schema.ts';

const PHOTO_CATEGORIES: Array<{ start: number; end: number; category: string; caption: string }> = [
  { start: 0, end: 1, category: 'Church services', caption: 'Church leadership welcoming the congregation at GVCC Ogembo' },
  { start: 2, end: 5, category: 'Congregation', caption: 'Worship service and congregational gathering at GVCC Ogembo' },
  { start: 6, end: 9, category: 'Fellowship', caption: 'Warm fellowship and joyful praise among members' },
  { start: 10, end: 15, category: 'Church services', caption: 'Ministry of the Word and prayer at GVCC sanctuary' },
  { start: 16, end: 19, category: 'Church activities', caption: 'Youth presentation and special ministry during service' },
  { start: 20, end: 21, category: 'Worship', caption: 'Choir leading worship and praise' },
  { start: 22, end: 25, category: 'Preaching', caption: 'Bishop Joseph Ondari Gichana preaching the Word of God' },
  { start: 26, end: 35, category: 'Worship', caption: 'Choir and fellowship ministry during Sunday celebration' },
  { start: 36, end: 41, category: 'Preaching', caption: 'Bishop Joseph Ondari Gichana ministering and praying with believers' },
  { start: 42, end: 43, category: 'Fellowship', caption: 'Church members and leaders in fellowship' },
  { start: 44, end: 60, category: 'Preaching', caption: 'Bishop Joseph Ondari Gichana delivering the sermon from the pulpit' },
  { start: 61, end: 64, category: 'Congregation', caption: 'Believers gathered in prayer and listening to the Word' },
  { start: 65, end: 66, category: 'Preaching', caption: 'Closing prayer and benediction by Bishop Joseph Ondari Gichana' },
];

function getPhotoMeta(index: number) {
  const match = PHOTO_CATEGORIES.find((c) => index >= c.start && index <= c.end);
  return (
    match || {
      category: 'Church services',
      caption: `GVCC Ogembo church moment #${index + 1}`,
    }
  );
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

async function runSeed(): Promise<void> {
  // 1. Seed Church Settings (Verified Identity + Editable Site Config)
  const settingsCount = await db.select({ value: count() }).from(churchSettings);
  if (Number(settingsCount[0]?.value ?? 0) === 0) {
    await db.insert(churchSettings).values([
      {
        settingKey: 'identity',
        settingValue: {
          churchName: 'Gracious Voice Celebration Centre',
          shortName: 'GVCC',
          location: 'Ogembo, Kenya',
          leadPastor: 'Bishop Joseph Ondari Gichana',
          phone: '0727 543 663',
          whatsappNumber: '254727543663',
          email: '',
          welcomeHeading: 'Welcome to Gracious Voice Celebration Centre',
          welcomeBody:
            'We welcome you to Gracious Voice Celebration Centre in Ogembo — a community gathered in faith and united by the desire to seek God, grow spiritually, worship together, and share the hope of Christ.',
          missionStatement:
            'Official GVCC mission statement awaiting confirmation from church leadership in the Admin Settings panel.',
          visionStatement:
            'Official GVCC vision statement awaiting confirmation from church leadership in the Admin Settings panel.',
          missionVerified: false,
          serviceScheduleNotice:
            'Official weekly worship service times are being confirmed by church leadership. Please call 0727 543 663 or visit us in Ogembo for this week’s schedule.',
          serviceScheduleVerified: false,
          serviceTimes: [],
          coreValues: [],
          footerTagline: 'A place of faith, hope, worship and fellowship in Ogembo, Kenya.',
          announcementBar: {
            enabled: true,
            text: 'WELCOME TO GRACIOUS VOICE CELEBRATION CENTRE, OGEMBO — A PLACE OF FAITH, HOPE & TRANSFORMATION.',
            linkLabel: 'Plan Your Visit',
            linkUrl: '#connect',
            bgColor: '#1C1917',
          },
          mapNotice:
            'Centered on Ogembo, Kisii County, Kenya. Exact street coordinates awaiting church confirmation.',
          guidingScriptureReference: '2 Timothy 4:2–5',
          guidingScriptureText:
            'Preach the word; be prepared in season and out of season; correct, rebuke and encourage—with great patience and careful instruction. For the time will come when people will not put up with sound doctrine. Instead, to suit their own desires, they will gather around them a great number of teachers to say what their itching ears want to hear. They will turn their ears away from the truth and turn aside to myths. But you, keep your head in all situations, endure hardship, do the work of an evangelist, discharge all the duties of your ministry.',
          givingConfig: {
            givingVerified: false,
            stewardshipScriptureRef: '2 Corinthians 9:7',
            stewardshipScriptureText:
              'Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.',
            givingNotice:
              'Official M-Pesa Paybill, Till, and Bank Account details are verified and published exclusively by church leadership. Please confirm directly with the church office on 0727 543 663 before sending electronic contributions.',
            mpesaPaybill: '',
            mpesaAccountFormat: 'GVCC Tithe / Offering',
            mpesaTill: '',
            bankName: '',
            bankAccountName: 'Gracious Voice Celebration Centre',
            bankAccountNumber: '',
            bankBranch: 'Ogembo',
            inPersonInstructions:
              'Tithes and offerings may also be presented in person during sanctuary services at Gracious Voice Celebration Centre, Ogembo.',
          },
          tvLiveConfig: {
            isLive: false,
            channelName: 'GVCC TV LIVE',
            streamTitle: 'Sunday Celebration & Word Service — GVCC Ogembo',
            streamSpeaker: 'Bishop Joseph Ondari Gichana',
            streamUrl: '',
            scheduleNote:
              'Live sanctuary broadcasts stream on GVCC TV LIVE when activated by the Church Media team in Website Settings.',
            description:
              'Watch live services, worship gatherings, and special broadcasts from Gracious Voice Celebration Centre in Ogembo through the official Church Media Portal.',
          },
        },
      },
    ]).onConflictDoNothing();
  }

  // 2. Seed Verified Leadership (Only Bishop Joseph Ondari Gichana from CHURCH.pdf)
  const leaderCount = await db.select({ value: count() }).from(leaders);
  if (Number(leaderCount[0]?.value ?? 0) === 0) {
    await db.insert(leaders).values([
      {
        fullName: 'Bishop Joseph Ondari Gichana',
        officialTitle: 'Bishop',
        ministryPosition: 'Senior Church Leader, GVCC Ogembo',
        biography:
          'Bishop Joseph Ondari Gichana leads Gracious Voice Celebration Centre (GVCC) in Ogembo, shepherding the congregation in the Word, prayer, and Christian fellowship.',
        areasOfMinistry: 'Preaching, Pastoral Oversight, Prayer & Discipleship',
        phone: '0727 543 663',
        photoUrl: '/images/church/photo_22.jpg',
        displayOrder: 1,
        isVerified: true,
        active: true,
      },
    ]);
  }

  // 3. Seed 67 Real Extracted Church Photographs from CHURCH.pdf
  const mediaCount = await db.select({ value: count() }).from(mediaAssets);
  if (Number(mediaCount[0]?.value ?? 0) === 0) {
    const featuredIndices = new Set([0, 2, 11, 16, 20, 22, 24, 27, 36, 44, 52, 62]);
    const assetsToInsert = Array.from({ length: 67 }, (_, i) => {
      const padded = String(i).padStart(2, '0');
      const meta = getPhotoMeta(i);
      return {
        filename: `photo_${padded}.jpg`,
        storagePath: `/images/church/photo_${padded}.jpg`,
        mediaType: 'image',
        caption: meta.caption,
        altText: `${meta.caption} — Gracious Voice Celebration Centre Ogembo`,
        category: meta.category,
        featured: featuredIndices.has(i),
        hidden: false,
        displayOrder: i + 1,
      };
    });
    await db.insert(mediaAssets).values(assetsToInsert);
  }

  // 4. Seed 6 Reflective Slideshow Items (editable in Admin Slideshow Manager)
  const slideCount = await db.select({ value: count() }).from(homepageSlides);
  if (Number(slideCount[0]?.value ?? 0) === 0) {
    await db.insert(homepageSlides).values([
      {
        imageUrl: '/images/church/photo_00.jpg',
        eyebrow: 'Gracious Voice Celebration Centre · Ogembo',
        heading: 'A Place Where Faith Comes Alive',
        subtitle:
          'Discover hope, experience God’s presence, and grow in faith with a community committed to the Word.',
        scriptureReference: 'Psalm 122:1',
        buttonLabel: 'Plan Your Visit',
        buttonUrl: '#connect',
        objectPosition: '50% 22%',
        displayOrder: 1,
        durationSeconds: 7,
        active: true,
      },
      {
        imageUrl: '/images/church/photo_22.jpg',
        eyebrow: 'Rooted in the Word',
        heading: 'Come Into His Presence',
        subtitle:
          'A moment of worship. A heart surrendered. A life transformed through the teaching of Christ.',
        scriptureReference: 'Psalm 95:1-2',
        buttonLabel: 'Request Prayer',
        buttonUrl: '#prayer',
        objectPosition: '50% 20%',
        displayOrder: 2,
        durationSeconds: 7,
        active: true,
      },
      {
        imageUrl: '/images/church/photo_03.jpg',
        eyebrow: 'Community & Belonging',
        heading: 'You Belong Here',
        subtitle:
          'Grow together, pray together, and walk together in Christian love at GVCC Ogembo.',
        scriptureReference: 'Hebrews 10:24-25',
        buttonLabel: 'Explore Fellowships',
        buttonUrl: '#fellowships',
        objectPosition: '50% 30%',
        displayOrder: 3,
        durationSeconds: 7,
        active: true,
      },
      {
        imageUrl: '/images/church/photo_27.jpg',
        eyebrow: 'Worship & Praise',
        heading: 'Voices Lifted in Worship',
        subtitle:
          'Hearts united in praise and thanksgiving across generations within the GVCC family.',
        scriptureReference: 'Psalm 100:4',
        buttonLabel: 'View Church Gallery',
        buttonUrl: '#gallery',
        objectPosition: '50% 28%',
        displayOrder: 4,
        durationSeconds: 7,
        active: true,
      },
      {
        imageUrl: '/images/church/photo_36.jpg',
        eyebrow: 'Pastoral Care & Prayer',
        heading: 'There Is Hope for Every Season',
        subtitle:
          'No matter where life takes you, there is grace, prayer support, and a place to begin again.',
        scriptureReference: 'Romans 15:13',
        buttonLabel: 'Submit Prayer Request',
        buttonUrl: '#prayer',
        objectPosition: '50% 20%',
        displayOrder: 5,
        durationSeconds: 7,
        active: true,
      },
      {
        imageUrl: '/images/church/photo_16.jpg',
        eyebrow: 'Welcome Home',
        heading: 'Experience the Love of God',
        subtitle:
          'We warmly invite you and your family to connect with Bishop Joseph Ondari Gichana and the GVCC family.',
        scriptureReference: 'John 13:34-35',
        buttonLabel: 'Connect With Us',
        buttonUrl: '#connect',
        objectPosition: '50% 25%',
        displayOrder: 6,
        durationSeconds: 7,
        active: true,
      },
    ]);
  }

  // 5. Seed Proposed Fellowship Categories (explicitly flagged isVerified: false until confirmed by Admin)
  const fellowshipCount = await db.select({ value: count() }).from(fellowships);
  if (Number(fellowshipCount[0]?.value ?? 0) === 0) {
    await db.insert(fellowships).values([
      {
        name: "Women's Fellowship",
        slug: 'womens-fellowship',
        description: 'Prayer, mutual encouragement, discipleship, and growing together as women of faith.',
        imageUrl: '/images/church/photo_27.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 1,
      },
      {
        name: 'Youth Fellowship',
        slug: 'youth-fellowship',
        description: 'Building faith, godly friendships, purpose, and spiritual leadership among young people.',
        imageUrl: '/images/church/photo_16.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 2,
      },
      {
        name: "Men's Fellowship",
        slug: 'mens-fellowship',
        description: 'Brotherhood, spiritual accountability, and serving families and the church community.',
        imageUrl: '/images/church/photo_42.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 3,
      },
      {
        name: 'Prayer Fellowship',
        slug: 'prayer-fellowship',
        description: 'Gathering together in intercession, spiritual support, and prayer for the church and community.',
        imageUrl: '/images/church/photo_62.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 4,
      },
    ]).onConflictDoNothing();
  }

  // 6. Seed Proposed Ministry Categories (explicitly flagged isVerified: false until confirmed by Admin)
  const ministryCount = await db.select({ value: count() }).from(ministries);
  if (Number(ministryCount[0]?.value ?? 0) === 0) {
    await db.insert(ministries).values([
      {
        name: 'Worship & Choir Ministry',
        slug: 'worship-and-choir',
        description: 'Leading the congregation in heartfelt worship and praise during church gatherings.',
        imageUrl: '/images/church/photo_20.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 1,
      },
      {
        name: 'Pastoral & Prayer Ministry',
        slug: 'pastoral-and-prayer',
        description: 'Standing with believers through intercession, visitation, and spiritual care.',
        imageUrl: '/images/church/photo_36.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 2,
      },
      {
        name: 'Word & Teaching Ministry',
        slug: 'word-and-teaching',
        description: 'Sound biblical teaching and discipleship rooted in Scripture.',
        imageUrl: '/images/church/photo_24.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 3,
      },
      {
        name: 'Hospitality & Community Care',
        slug: 'hospitality-and-care',
        description: 'Welcoming visitors and fostering warm fellowship across the congregation.',
        imageUrl: '/images/church/photo_06.jpg',
        status: 'proposed',
        isVerified: false,
        displayOrder: 4,
      },
    ]).onConflictDoNothing();
  }
}

export async function generateReferenceNumber(prefix: string, tableCount: number): Promise<string> {
  const year = new Date().getFullYear();
  const seq = String(tableCount + 1).padStart(4, '0');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${year}-${seq}-${suffix}`;
}

export async function getChurchSetting(key: string) {
  const rows = await db.select().from(churchSettings).where(eq(churchSettings.settingKey, key));
  return rows[0]?.settingValue ?? null;
}
