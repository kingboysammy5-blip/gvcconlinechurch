import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDatabaseConfigured } from './src/db/index.ts';
import { GVCC_DEFAULT_BOOTSTRAP } from './src/data/gvccDefaultBootstrap.ts';
import { getGeminiClient } from './src/lib/gemini.ts';
import {
  auditLogs,
  churchAssets,
  churchSettings,
  contactMessages,
  devotionals,
  dutyRosters,
  eventRegistrations,
  events,
  fellowshipJoinRequests,
  fellowships,
  givingRecords,
  homepageSlides,
  leaders,
  mediaAssets,
  members,
  ministries,
  newsPosts,
  prayerFollowups,
  prayerRequests,
  prayerSupports,
  sermons,
  testimonies,
  users,
  visitors,
} from './src/db/schema.ts';
import {
  getAdminOverviewStats,
  getPublicBootstrapData,
  getPublicPrayerBoard,
  getPublishedDevotionals,
  getPublishedTestimonies,
  logAudit,
} from './src/db/queries.ts';
import { ensureSeeded, generateReferenceNumber } from './src/db/seed.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  AuthRequest,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission,
  issuePortalToken,
  requireAuth,
  requirePermission,
  requireStaff,
  verifyManagementPasscode,
} from './src/middleware/auth.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));
app.use('/images', express.static(path.resolve(process.cwd(), 'public/images')));

// ---------------------------------------------------------------------------
// PUBLIC ROUTES (No login required)
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, databaseConfigured: isDatabaseConfigured() });
});

app.get('/api/public/bootstrap', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json(GVCC_DEFAULT_BOOTSTRAP);
  }
  try {
    const data = await getPublicBootstrapData();
    res.json(data);
  } catch (error: any) {
    console.error('Database bootstrap failed, serving verified baseline:', error);
    res.json(GVCC_DEFAULT_BOOTSTRAP);
  }
});

const prayerSchema = z.object({
  requesterName: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  category: z.string().min(2).max(80),
  requestContent: z.string().min(5, 'Please share your prayer request.').max(4000),
  privacyLevel: z.enum(['confidential', 'prayer_team', 'public_board', 'public_testimony']).default('confidential'),
  followupRequested: z.boolean().default(false),
  consent: z.literal(true, { message: 'Consent is required to submit a prayer request.' }),
});

app.get('/api/public/devotionals', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json(GVCC_DEFAULT_BOOTSTRAP.devotionals);
  }
  try {
    await ensureSeeded();
    const items = await getPublishedDevotionals();
    res.json(items);
  } catch (error: any) {
    console.error('Public devotionals fetch failed:', error);
    res.status(500).json({ error: 'Unable to load daily devotionals right now.' });
  }
});

const publicTestimonySchema = z.object({
  authorName: z.string().min(2, 'Please provide your name (you may still choose to display anonymously).').max(120),
  displayAnonymous: z.boolean().default(false),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  fellowshipGroup: z.string().max(120).optional().nullable(),
  category: z.string().min(2).max(80).default('Faith & Salvation'),
  title: z.string().min(4, 'Please enter a brief headline for your testimony.').max(160),
  story: z.string().min(20, 'Please share your faith story (at least 20 characters).').max(6000),
  scriptureReference: z.string().max(120).optional().nullable(),
  consent: z.literal(true, { message: 'Please confirm permission to submit your testimony for review.' }),
});

app.get('/api/public/testimonies', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json(GVCC_DEFAULT_BOOTSTRAP.testimonies);
  }
  try {
    await ensureSeeded();
    const items = await getPublishedTestimonies();
    res.json(items);
  } catch (error: any) {
    console.error('Public testimonies fetch failed:', error);
    res.status(500).json({ error: 'Unable to load approved testimonies right now.' });
  }
});

app.post('/api/public/testimonies', async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = publicTestimonySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid testimony submission' });
    }
    const total = await db.select({ value: count() }).from(testimonies);
    const ref = await generateReferenceNumber('TST', Number(total[0]?.value ?? 0));
    const d = parsed.data;
    const [created] = await db
      .insert(testimonies)
      .values({
        referenceNumber: ref,
        authorName: d.authorName.trim(),
        displayAnonymous: Boolean(d.displayAnonymous),
        phone: d.phone?.trim() || null,
        email: d.email?.trim() || null,
        fellowshipGroup: d.fellowshipGroup?.trim() || null,
        category: d.category.trim(),
        title: d.title.trim(),
        story: d.story.trim(),
        scriptureReference: d.scriptureReference?.trim() || null,
        moderationStatus: 'Pending Review',
        consent: true,
      })
      .returning({
        id: testimonies.id,
        referenceNumber: testimonies.referenceNumber,
        moderationStatus: testimonies.moderationStatus,
      });

    res.status(201).json({
      id: created.id,
      referenceNumber: created.referenceNumber,
      moderationStatus: created.moderationStatus,
      message:
        'Thank you for sharing what God has done! Your testimony has been received and sent to GVCC leadership for moderation review before public publishing.',
    });
  } catch (error: any) {
    console.error('Testimony submission failed:', error);
    res.status(500).json({ error: 'Unable to submit testimony right now.' });
  }
});

app.post('/api/public/testimonies/:id/amen', async (req, res) => {
  try {
    await ensureSeeded();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid testimony ID.' });
    }
    const existing = await db
      .select({ id: testimonies.id, moderationStatus: testimonies.moderationStatus })
      .from(testimonies)
      .where(eq(testimonies.id, id));
    if (!existing.length) {
      return res.status(404).json({ error: 'Testimony not found.' });
    }
    if (existing[0].moderationStatus !== 'Approved') {
      return res.status(403).json({ error: 'Only approved testimonies can receive public Amen reactions.' });
    }
    const [updated] = await db
      .update(testimonies)
      .set({
        amenCount: sql`${testimonies.amenCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(testimonies.id, id))
      .returning({ id: testimonies.id, amenCount: testimonies.amenCount });

    res.json({ id: updated.id, amenCount: updated.amenCount });
  } catch (error: any) {
    console.error('Testimony amen update failed:', error);
    res.status(500).json({ error: 'Unable to record Amen response.' });
  }
});

app.get('/api/public/prayers', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json(GVCC_DEFAULT_BOOTSTRAP.publicPrayers);
  }
  try {
    await ensureSeeded();
    const board = await getPublicPrayerBoard();
    res.json(board);
  } catch (error: any) {
    console.error('Public prayer board fetch failed:', error);
    res.status(500).json({ error: 'Unable to load the public prayer board right now.' });
  }
});

app.post('/api/public/prayers', async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = prayerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid prayer request' });
    }
    const total = await db.select({ value: count() }).from(prayerRequests);
    const ref = await generateReferenceNumber('PRY', Number(total[0]?.value ?? 0));
    const [created] = await db
      .insert(prayerRequests)
      .values({
        referenceNumber: ref,
        requesterName: parsed.data.requesterName?.trim() || 'Anonymous',
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        category: parsed.data.category,
        requestContent: parsed.data.requestContent.trim(),
        privacyLevel: parsed.data.privacyLevel,
        followupRequested: parsed.data.followupRequested,
        consent: parsed.data.consent,
        status: 'New',
      })
      .returning({
        id: prayerRequests.id,
        referenceNumber: prayerRequests.referenceNumber,
        privacyLevel: prayerRequests.privacyLevel,
        status: prayerRequests.status,
      });

    const isPublic =
      created.privacyLevel === 'public_board' || created.privacyLevel === 'public_testimony';

    res.status(201).json({
      id: created.id,
      referenceNumber: created.referenceNumber,
      isPublic,
      message: isPublic
        ? 'Your prayer request has been posted to the GVCC Prayer Board so the church family can pray with you.'
        : 'Your prayer request has been received confidentially.',
    });
  } catch (error: any) {
    console.error('Prayer submission failed:', error);
    res.status(500).json({ error: 'Unable to submit prayer request right now.' });
  }
});

const praySupportSchema = z.object({
  supporterName: z.string().max(80).optional().nullable(),
  encouragementNote: z.string().max(400).optional().nullable(),
});

app.post('/api/public/prayers/:id/pray', async (req, res) => {
  try {
    await ensureSeeded();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid prayer request ID.' });
    }
    const parsed = praySupportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid prayer support payload.' });
    }

    const existing = await db
      .select({
        id: prayerRequests.id,
        privacyLevel: prayerRequests.privacyLevel,
        status: prayerRequests.status,
      })
      .from(prayerRequests)
      .where(eq(prayerRequests.id, id));

    if (!existing.length) {
      return res.status(404).json({ error: 'Prayer request not found.' });
    }
    const target = existing[0];
    if (
      (target.privacyLevel !== 'public_board' && target.privacyLevel !== 'public_testimony') ||
      target.status === 'Closed' ||
      target.status === 'Archived'
    ) {
      return res.status(403).json({ error: 'This prayer request is private or no longer active on the public board.' });
    }

    const supporterName = parsed.data.supporterName?.trim() || 'GVCC Member';
    const encouragementNote = parsed.data.encouragementNote?.trim() || null;

    const [updated] = await db
      .update(prayerRequests)
      .set({
        prayerCount: sql`${prayerRequests.prayerCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(prayerRequests.id, id))
      .returning({
        id: prayerRequests.id,
        prayerCount: prayerRequests.prayerCount,
      });

    const [support] = await db
      .insert(prayerSupports)
      .values({
        prayerRequestId: id,
        supporterName,
        encouragementNote,
      })
      .returning();

    res.status(201).json({
      id: updated.id,
      prayerCount: updated.prayerCount,
      support,
    });
  } catch (error: any) {
    console.error('Prayer support failed:', error);
    res.status(500).json({ error: 'Unable to record your prayer right now.' });
  }
});

const memberRegSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(140),
  phone: z.string().min(6, 'Valid phone number is required').max(40),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  location: z.string().max(140).optional().nullable(),
  dateOfBirth: z.string().max(30).optional().nullable(),
  gender: z.string().max(30).optional().nullable(),
  membershipType: z.string().default('New member'),
  fellowshipId: z.number().int().positive().optional().nullable(),
  ministryId: z.number().int().positive().optional().nullable(),
  preferredContactMethod: z.string().max(40).default('Phone'),
  testimony: z.string().max(2000).optional().nullable(),
  consent: z.literal(true, { message: 'Privacy consent is required.' }),
});

app.post('/api/public/members', async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = memberRegSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid member registration' });
    }
    const total = await db.select({ value: count() }).from(members);
    const year = new Date().getFullYear();
    const seq = String(Number(total[0]?.value ?? 0) + 1).padStart(4, '0');
    const memberNumber = `GVCC-${year}-${seq}`;

    const [created] = await db
      .insert(members)
      .values({
        memberNumber,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        location: parsed.data.location || null,
        dateOfBirth: parsed.data.dateOfBirth || null,
        gender: parsed.data.gender || null,
        registrationDate: new Date().toISOString().slice(0, 10),
        membershipType: parsed.data.membershipType,
        membershipStatus: 'New registration',
        fellowshipId: parsed.data.fellowshipId ?? null,
        ministryId: parsed.data.ministryId ?? null,
        preferredContactMethod: parsed.data.preferredContactMethod,
        testimony: parsed.data.testimony || null,
        consent: parsed.data.consent,
      })
      .returning({
        id: members.id,
        memberNumber: members.memberNumber,
      });

    res.status(201).json({
      memberNumber: created.memberNumber,
      message: 'Member registration received. Welcome to the GVCC family.',
    });
  } catch (error: any) {
    console.error('Member registration failed:', error);
    res.status(500).json({ error: 'Unable to complete member registration.' });
  }
});

const visitorRegSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(140),
  phone: z.string().min(6, 'Phone number is required').max(40),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  residence: z.string().max(140).optional().nullable(),
  firstTimeVisitor: z.boolean().default(true),
  preferredVisitDate: z.string().max(40).optional().nullable(),
  accompanyingCount: z.number().int().min(0).max(50).default(0),
  visitSource: z.string().max(120).optional().nullable(),
  assistanceRequest: z.string().max(1000).optional().nullable(),
  consent: z.literal(true, { message: 'Consent is required to submit.' }),
});

app.post('/api/public/visitors', async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = visitorRegSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid visitor submission' });
    }
    const total = await db.select({ value: count() }).from(visitors);
    const visitorNumber = await generateReferenceNumber('VIS', Number(total[0]?.value ?? 0));

    const [created] = await db
      .insert(visitors)
      .values({
        visitorNumber,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        residence: parsed.data.residence || null,
        firstTimeVisitor: parsed.data.firstTimeVisitor,
        preferredVisitDate: parsed.data.preferredVisitDate || null,
        accompanyingCount: parsed.data.accompanyingCount,
        visitSource: parsed.data.visitSource || null,
        assistanceRequest: parsed.data.assistanceRequest || null,
        followupStatus: 'New',
        consent: parsed.data.consent,
      })
      .returning({ visitorNumber: visitors.visitorNumber });

    res.status(201).json({
      referenceNumber: created.visitorNumber,
      message: 'Thank you for planning your visit to GVCC Ogembo.',
    });
  } catch (error: any) {
    console.error('Visitor registration failed:', error);
    res.status(500).json({ error: 'Unable to submit visitor registration.' });
  }
});

const fellowshipJoinSchema = z.object({
  fellowshipId: z.number().int().positive(),
  fullName: z.string().min(2).max(140),
  phone: z.string().min(6).max(40),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  memberOrVisitor: z.enum(['Church member', 'Visitor']).default('Visitor'),
  preferredCommunication: z.string().max(40).default('Phone'),
  availability: z.string().max(120).optional().nullable(),
  prayerRequest: z.string().max(1000).optional().nullable(),
  consent: z.literal(true),
});

app.post('/api/public/fellowships/join', async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = fellowshipJoinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid fellowship registration' });
    }
    const total = await db.select({ value: count() }).from(fellowshipJoinRequests);
    const referenceNumber = await generateReferenceNumber('FEL', Number(total[0]?.value ?? 0));

    const [created] = await db
      .insert(fellowshipJoinRequests)
      .values({
        referenceNumber,
        fellowshipId: parsed.data.fellowshipId,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        memberOrVisitor: parsed.data.memberOrVisitor,
        preferredCommunication: parsed.data.preferredCommunication,
        availability: parsed.data.availability || null,
        prayerRequest: parsed.data.prayerRequest || null,
        consent: parsed.data.consent,
        followupStatus: 'New',
      })
      .returning({ referenceNumber: fellowshipJoinRequests.referenceNumber });

    res.status(201).json({
      referenceNumber: created.referenceNumber,
      message: 'Your fellowship interest has been recorded.',
    });
  } catch (error: any) {
    console.error('Fellowship join failed:', error);
    res.status(500).json({ error: 'Unable to submit fellowship request.' });
  }
});

const eventRegSchema = z.object({
  fullName: z.string().min(2).max(140),
  phone: z.string().min(6).max(40),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  guestsCount: z.number().int().min(1).max(20).default(1),
});

app.post('/api/public/events/:id/register', async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const parsed = eventRegSchema.safeParse(req.body);
    if (!parsed.success || Number.isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event registration details' });
    }
    const eventRows = await db.select().from(events).where(eq(events.id, eventId));
    if (!eventRows.length || !eventRows[0].registrationOpen) {
      return res.status(400).json({ error: 'Registration is closed or event not found' });
    }
    if (eventRows[0].capacity) {
      const regCount = await db
        .select({ value: count() })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, eventId));
      if (Number(regCount[0]?.value ?? 0) >= eventRows[0].capacity) {
        return res.status(400).json({ error: 'This event has reached full capacity.' });
      }
    }
    await db.insert(eventRegistrations).values({
      eventId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      guestsCount: parsed.data.guestsCount,
      attendanceStatus: 'Registered',
    });
    res.status(201).json({ message: 'You are registered for this church event.' });
  } catch (error: any) {
    console.error('Event registration failed:', error);
    res.status(500).json({ error: 'Unable to complete event registration.' });
  }
});

const contactSchema = z.object({
  fullName: z.string().min(2).max(140),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  subject: z.string().min(2).max(160),
  message: z.string().min(5).max(3000),
});

app.post('/api/public/contact', async (req, res) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contact message' });
    }
    const total = await db.select({ value: count() }).from(contactMessages);
    const referenceNumber = await generateReferenceNumber('MSG', Number(total[0]?.value ?? 0));
    await db.insert(contactMessages).values({
      referenceNumber,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: 'New',
    });
    res.status(201).json({ referenceNumber, message: 'Message received by the GVCC church office.' });
  } catch (error: any) {
    console.error('Contact message failed:', error);
    res.status(500).json({ error: 'Unable to send message.' });
  }
});

const givingSchema = z.object({
  giverName: z.string().max(140).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  givingCategory: z.string().min(2).max(80),
  givingMethod: z.string().min(2).max(60),
  amountKes: z.number().int().positive().max(100000000).optional().nullable(),
  transactionReference: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  consent: z.literal(true, { message: 'Consent is required to submit a giving record.' }),
});

app.post('/api/public/giving', async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = givingSchema.safeParse({
      ...req.body,
      amountKes:
        req.body?.amountKes === '' || req.body?.amountKes === null || req.body?.amountKes === undefined
          ? null
          : Number(req.body.amountKes),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid giving details' });
    }
    const d = parsed.data;
    const total = await db.select({ value: count() }).from(givingRecords);
    const referenceNumber = await generateReferenceNumber('GIV', Number(total[0]?.value ?? 0));
    const initialStatus = d.givingMethod === 'Pledge' ? 'Pledge Recorded' : 'Pending Verification';

    const [created] = await db
      .insert(givingRecords)
      .values({
        referenceNumber,
        giverName: d.giverName?.trim() || 'Anonymous',
        phone: d.phone?.trim() || null,
        email: d.email?.trim() || null,
        givingCategory: d.givingCategory,
        givingMethod: d.givingMethod,
        amountKes: d.amountKes ?? null,
        transactionReference: d.transactionReference?.trim() || null,
        notes: d.notes?.trim() || null,
        status: initialStatus,
        consent: d.consent,
      })
      .returning({
        referenceNumber: givingRecords.referenceNumber,
        status: givingRecords.status,
      });

    res.status(201).json({
      referenceNumber: created.referenceNumber,
      status: created.status,
      message: 'Your tithe / offering record has been received securely by the GVCC church office.',
    });
  } catch (error: any) {
    console.error('Giving record submission failed:', error);
    res.status(500).json({ error: 'Unable to submit giving notification right now.' });
  }
});

// ---------------------------------------------------------------------------
// GOOGLE SEARCH GROUNDING ENDPOINT (gemini-4-hydrogen, Server-Side)
// ---------------------------------------------------------------------------
const searchAnswerSchema = z.object({
  query: z.string().min(2, 'Please enter a question or topic to research.').max(500),
  focusArea: z.enum(['scripture', 'ogembo', 'general']).optional().default('scripture'),
});

app.post('/api/ai/search-answer', async (req, res) => {
  try {
    const parsed = searchAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid search query.' });
    }

    const ai = getGeminiClient();
    const focusPrompt =
      parsed.data.focusArea === 'ogembo'
        ? 'Focus on factual community, civic, geographic, and Christian fellowship context relevant to Ogembo, Kisii County, Kenya when applicable.'
        : parsed.data.focusArea === 'general'
          ? 'Provide an accurate, well-structured, up-to-date answer grounded in web search.'
          : 'Provide a balanced, biblically faithful, historically accurate explanation suitable for church Bible study and ministry preparation at Gracious Voice Celebration Centre.';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: parsed.data.query.trim(),
      config: {
        systemInstruction: `You are a factual research assistant for Gracious Voice Celebration Centre (GVCC) in Ogembo, Kenya. ${focusPrompt} Keep explanations clear, concise, and verifiable.`,
        tools: [{ googleSearch: {} }],
      },
    });

    const answer = (response.text || '').trim();
    if (!answer) {
      return res.status(502).json({ error: 'The search-grounded model returned an empty response.' });
    }

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seenUrls = new Set<string>();
    const sources: Array<{ title: string; uri: string }> = [];

    for (const chunk of rawChunks) {
      const uri = chunk?.web?.uri;
      if (uri && !seenUrls.has(uri)) {
        seenUrls.add(uri);
        sources.push({
          title: (chunk?.web?.title || uri).slice(0, 200),
          uri: uri.slice(0, 500),
        });
      }
      if (sources.length >= 10) break;
    }

    res.json({ answer, sources });
  } catch (error: any) {
    console.error('Search-grounded query failed:', error);
    let message = error?.message || 'Unable to complete grounded web search right now.';
    try {
      const parsedErr = JSON.parse(message);
      if (parsedErr?.error?.message) {
        message = parsedErr.error.message;
      }
    } catch {
      // plain string error message
    }
    res.status(error?.status && Number.isInteger(error.status) ? error.status : 500).json({
      error: message,
    });
  }
});

// ---------------------------------------------------------------------------
// AUTH & ADMIN ROUTES (Firebase Auth + Server-Side RBAC)
// ---------------------------------------------------------------------------

// Confidential Management Passcode Unlock (Required for Administration Portal)
app.post('/api/admin/passcode-login', async (req, res) => {
  try {
    await ensureSeeded();
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (!verifyManagementPasscode(password)) {
      return res.status(401).json({ error: 'Incorrect management password. Access denied.' });
    }
    const appUser = await getOrCreateUser(
      'gvcc-management-portal',
      'management@gvcc.ogembo',
      'GVCC Management'
    );
    const effectivePermissions =
      appUser.role === 'super_admin'
        ? ROLE_DEFAULT_PERMISSIONS.super_admin
        : Array.from(new Set([...(ROLE_DEFAULT_PERMISSIONS[appUser.role] || []), ...(appUser.permissions || [])]));
    const token = issuePortalToken(appUser.uid, appUser.email);
    await logAudit(
      appUser.uid,
      appUser.email,
      'admin.passcode_login',
      'admin_portal',
      'management',
      'Management portal unlocked'
    );
    res.json({
      token,
      user: {
        ...appUser,
        effectivePermissions,
      },
    });
  } catch (error: any) {
    console.error('Management passcode login failed:', error);
    res.status(500).json({ error: 'Unable to verify management credentials right now.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  const user = req.appUser!;
  const effectivePermissions =
    user.role === 'super_admin'
      ? ROLE_DEFAULT_PERMISSIONS.super_admin
      : Array.from(new Set([...(ROLE_DEFAULT_PERMISSIONS[user.role] || []), ...(user.permissions || [])]));
  res.json({
    user: {
      ...user,
      effectivePermissions,
    },
  });
});

app.get('/api/admin/overview', requireAuth, requireStaff, async (_req: AuthRequest, res) => {
  try {
    const overview = await getAdminOverviewStats();
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load admin overview' });
  }
});

// Upload image asset to local /public/images/uploads safely (avoids large blobs in Postgres)
app.post('/api/admin/upload', requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    if (!hasPermission(req.appUser, 'gallery.upload') && !hasPermission(req.appUser, 'news.create') && !hasPermission(req.appUser, 'events.create')) {
      return res.status(403).json({ error: 'Forbidden: Missing media upload permission' });
    }
    const { filename, dataUrl } = req.body as { filename?: string; dataUrl?: string };
    if (!filename || !dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid image file is required' });
    }
    const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!matches) {
      return res.status(400).json({ error: 'Supported formats: PNG, JPG, WEBP' });
    }
    const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
    const buffer = Buffer.from(matches[2], 'base64');
    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}.${ext}`;
    const uploadsDir = path.resolve(process.cwd(), 'public/images/uploads');

    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
      return res.status(201).json({ url: `/images/uploads/${safeName}`, filename: safeName });
    } catch (fsError: any) {
      const isReadOnly =
        fsError?.code === 'EROFS' || fsError?.code === 'EACCES' || fsError?.code === 'EPERM';
      if (isReadOnly && buffer.length <= 1_500_000) {
        return res.status(201).json({ url: dataUrl, filename: safeName, storedInline: true });
      }
      if (isReadOnly) {
        return res.status(413).json({
          error: 'Serverless hosting uses a read-only filesystem. Please keep uploaded images under 1.5 MB or use a hosted image URL.',
        });
      }
      throw fsError;
    }
  } catch (error: any) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Failed to save uploaded image' });
  }
});

// Members CRUD
app.get('/api/admin/members', requireAuth, requireStaff, requirePermission('members.view'), async (req: AuthRequest, res) => {
  try {
    let rows = await db.select().from(members).orderBy(desc(members.createdAt));
    if (req.appUser?.role === 'fellowship_leader' && req.appUser.assignedFellowshipId) {
      rows = rows.filter((m) => m.fellowshipId === req.appUser!.assignedFellowshipId);
    }
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load members' });
  }
});

app.post('/api/admin/members', requireAuth, requireStaff, requirePermission('members.create'), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const total = await db.select({ value: count() }).from(members);
    const year = new Date().getFullYear();
    const seq = String(Number(total[0]?.value ?? 0) + 1).padStart(4, '0');
    const memberNumber = `GVCC-${year}-${seq}`;

    const [created] = await db
      .insert(members)
      .values({
        memberNumber,
        fullName: body.fullName,
        phone: body.phone,
        email: body.email || null,
        location: body.location || null,
        registrationDate: body.registrationDate || new Date().toISOString().slice(0, 10),
        membershipType: body.membershipType || 'Existing member',
        membershipStatus: body.membershipStatus || 'Active member',
        fellowshipId: body.fellowshipId ? Number(body.fellowshipId) : null,
        ministryId: body.ministryId ? Number(body.ministryId) : null,
        notes: body.notes || null,
        consent: true,
      })
      .returning();

    await logAudit(req.appUser!.uid, req.appUser!.email, 'member.create', 'members', String(created.id), created.memberNumber);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create member' });
  }
});

app.patch('/api/admin/members/:id', requireAuth, requireStaff, requirePermission('members.edit'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db
      .update(members)
      .set({
        fullName: body.fullName,
        phone: body.phone,
        email: body.email ?? null,
        location: body.location ?? null,
        membershipStatus: body.membershipStatus,
        fellowshipId: body.fellowshipId ? Number(body.fellowshipId) : null,
        ministryId: body.ministryId ? Number(body.ministryId) : null,
        notes: body.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'member.update', 'members', String(id), body.membershipStatus);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.post('/api/admin/members/bulk-status', requireAuth, requireStaff, requirePermission('members.edit'), async (req: AuthRequest, res) => {
  try {
    const { ids, membershipStatus } = req.body as { ids: number[]; membershipStatus: string };
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No members selected' });
    await db.update(members).set({ membershipStatus, updatedAt: new Date() }).where(inArray(members.id, ids));
    await logAudit(req.appUser!.uid, req.appUser!.email, 'member.bulk_status', 'members', ids.join(','), membershipStatus);
    res.json({ updated: ids.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Visitors & Manual Conversion
app.get('/api/admin/visitors', requireAuth, requireStaff, requirePermission('visitors.view'), async (_req, res) => {
  try {
    const rows = await db.select().from(visitors).orderBy(desc(visitors.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to load visitors' });
  }
});

app.patch('/api/admin/visitors/:id', requireAuth, requireStaff, requirePermission('visitors.followup'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { followupStatus, notes, assignedStaffId } = req.body;
    const [updated] = await db
      .update(visitors)
      .set({
        followupStatus,
        notes,
        assignedStaffId: assignedStaffId ? Number(assignedStaffId) : null,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(visitors.id, id))
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'visitor.followup', 'visitors', String(id), followupStatus);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update visitor' });
  }
});

app.post('/api/admin/visitors/:id/convert', requireAuth, requireStaff, requirePermission('members.create'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vRows = await db.select().from(visitors).where(eq(visitors.id, id));
    if (!vRows.length) return res.status(404).json({ error: 'Visitor not found' });
    const v = vRows[0];

    const total = await db.select({ value: count() }).from(members);
    const year = new Date().getFullYear();
    const seq = String(Number(total[0]?.value ?? 0) + 1).padStart(4, '0');
    const memberNumber = `GVCC-${year}-${seq}`;

    const [createdMember] = await db
      .insert(members)
      .values({
        memberNumber,
        fullName: v.fullName,
        phone: v.phone,
        email: v.email,
        location: v.residence,
        registrationDate: new Date().toISOString().slice(0, 10),
        membershipType: 'New member',
        membershipStatus: 'New registration',
        notes: `Converted from visitor ${v.visitorNumber}`,
        consent: v.consent,
      })
      .returning();

    await db.update(visitors).set({ followupStatus: 'Joined', updatedAt: new Date() }).where(eq(visitors.id, id));
    await logAudit(req.appUser!.uid, req.appUser!.email, 'visitor.convert_to_member', 'visitors', String(id), memberNumber);
    res.status(201).json(createdMember);
  } catch {
    res.status(500).json({ error: 'Failed to convert visitor to member' });
  }
});

// Prayer Requests (Confidential + RBAC Scoped)
app.get('/api/admin/prayers', requireAuth, requireStaff, requirePermission('prayer.view'), async (req: AuthRequest, res) => {
  try {
    let rows = await db.select().from(prayerRequests).orderBy(desc(prayerRequests.createdAt));
    if (req.appUser?.role === 'prayer_team') {
      rows = rows.filter(
        (p) => p.assignedUserId === req.appUser!.id || p.privacyLevel !== 'confidential'
      );
    }
    const followups = await db.select().from(prayerFollowups).orderBy(desc(prayerFollowups.createdAt));
    const result = rows.map((r) => ({
      ...r,
      followups: followups.filter((f) => f.prayerRequestId === r.id),
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to load prayer requests' });
  }
});

app.patch('/api/admin/prayers/:id', requireAuth, requireStaff, requirePermission('prayer.update'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, assignedUserId, privacyLevel } = req.body;
    if (assignedUserId !== undefined && !hasPermission(req.appUser, 'prayer.assign')) {
      return res.status(403).json({ error: 'Forbidden: Missing prayer.assign permission' });
    }
    const allowedPrivacy = ['confidential', 'prayer_team', 'public_board', 'public_testimony'];
    const validPrivacy =
      typeof privacyLevel === 'string' && allowedPrivacy.includes(privacyLevel) ? privacyLevel : undefined;

    const [updated] = await db
      .update(prayerRequests)
      .set({
        status: status || undefined,
        privacyLevel: validPrivacy,
        assignedUserId: assignedUserId !== undefined ? (assignedUserId ? Number(assignedUserId) : null) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(prayerRequests.id, id))
      .returning();
    await logAudit(
      req.appUser!.uid,
      req.appUser!.email,
      'prayer.update',
      'prayer_requests',
      String(id),
      [status, validPrivacy].filter(Boolean).join(' · ')
    );
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update prayer request' });
  }
});

app.post('/api/admin/prayers/:id/followups', requireAuth, requireStaff, requirePermission('prayer.update'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { followupMethod, notes, nextAction } = req.body;
    const [created] = await db
      .insert(prayerFollowups)
      .values({
        prayerRequestId: id,
        staffUserId: req.appUser!.id,
        staffName: req.appUser!.fullName,
        followupMethod: followupMethod || 'Prayer',
        notes,
        nextAction: nextAction || null,
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'prayer.followup', 'prayer_requests', String(id), followupMethod);
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to add prayer follow-up' });
  }
});

// Fellowships & Fellowship Requests
app.get('/api/admin/fellowships', requireAuth, requireStaff, async (_req, res) => {
  try {
    const [fRows, reqRows] = await Promise.all([
      db.select().from(fellowships).orderBy(asc(fellowships.displayOrder)),
      db.select().from(fellowshipJoinRequests).orderBy(desc(fellowshipJoinRequests.createdAt)),
    ]);
    res.json({ fellowships: fRows, requests: reqRows });
  } catch {
    res.status(500).json({ error: 'Failed to load fellowships' });
  }
});

app.post('/api/admin/fellowships', requireAuth, requireStaff, requirePermission('fellowships.manage'), async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    const slug = (b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [created] = await db
      .insert(fellowships)
      .values({
        name: b.name,
        slug,
        description: b.description,
        leaderName: b.leaderName || null,
        contactPhone: b.contactPhone || null,
        meetingDay: b.meetingDay || null,
        meetingTime: b.meetingTime || null,
        meetingLocation: b.meetingLocation || null,
        imageUrl: b.imageUrl || '/images/church/photo_06.jpg',
        status: b.status || 'active',
        isVerified: Boolean(b.isVerified),
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'fellowship.create', 'fellowships', String(created.id), created.name);
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create fellowship' });
  }
});

app.patch('/api/admin/fellowships/:id', requireAuth, requireStaff, requirePermission('fellowships.manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(fellowships)
      .set({
        name: b.name,
        description: b.description,
        leaderName: b.leaderName ?? null,
        contactPhone: b.contactPhone ?? null,
        meetingDay: b.meetingDay ?? null,
        meetingTime: b.meetingTime ?? null,
        meetingLocation: b.meetingLocation ?? null,
        imageUrl: b.imageUrl ?? null,
        status: b.status,
        isVerified: Boolean(b.isVerified),
      })
      .where(eq(fellowships.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update fellowship' });
  }
});

app.patch('/api/admin/fellowship-requests/:id', requireAuth, requireStaff, requirePermission('fellowships.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { followupStatus, notes } = req.body;
    const [updated] = await db
      .update(fellowshipJoinRequests)
      .set({ followupStatus, notes, updatedAt: new Date() })
      .where(eq(fellowshipJoinRequests.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update fellowship request' });
  }
});

// Ministries
app.get('/api/admin/ministries', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(ministries).orderBy(asc(ministries.displayOrder));
  res.json(rows);
});

app.post('/api/admin/ministries', requireAuth, requireStaff, requirePermission('ministries.manage'), async (req, res) => {
  try {
    const b = req.body;
    const slug = (b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [created] = await db
      .insert(ministries)
      .values({
        name: b.name,
        slug,
        description: b.description,
        leaderName: b.leaderName || null,
        contactPhone: b.contactPhone || null,
        imageUrl: b.imageUrl || '/images/church/photo_20.jpg',
        status: b.status || 'active',
        isVerified: Boolean(b.isVerified),
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create ministry' });
  }
});

app.patch('/api/admin/ministries/:id', requireAuth, requireStaff, requirePermission('ministries.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(ministries)
      .set({
        name: b.name,
        description: b.description,
        leaderName: b.leaderName ?? null,
        contactPhone: b.contactPhone ?? null,
        status: b.status,
        isVerified: Boolean(b.isVerified),
      })
      .where(eq(ministries.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update ministry' });
  }
});

// Leadership
app.get('/api/admin/leaders', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(leaders).orderBy(asc(leaders.displayOrder));
  res.json(rows);
});

app.post('/api/admin/leaders', requireAuth, requireStaff, requirePermission('leadership.manage'), async (req, res) => {
  try {
    const b = req.body;
    const [created] = await db
      .insert(leaders)
      .values({
        fullName: b.fullName,
        officialTitle: b.officialTitle,
        ministryPosition: b.ministryPosition,
        biography: b.biography,
        areasOfMinistry: b.areasOfMinistry || null,
        email: b.email || null,
        phone: b.phone || null,
        photoUrl: b.photoUrl || '/images/church/photo_22.jpg',
        displayOrder: Number(b.displayOrder || 10),
        isVerified: Boolean(b.isVerified),
        active: b.active !== false,
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to add leader' });
  }
});

app.patch('/api/admin/leaders/:id', requireAuth, requireStaff, requirePermission('leadership.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(leaders)
      .set({
        fullName: b.fullName,
        officialTitle: b.officialTitle,
        ministryPosition: b.ministryPosition,
        biography: b.biography,
        areasOfMinistry: b.areasOfMinistry ?? null,
        email: b.email ?? null,
        phone: b.phone ?? null,
        photoUrl: b.photoUrl ?? null,
        displayOrder: Number(b.displayOrder ?? 0),
        isVerified: Boolean(b.isVerified),
        active: Boolean(b.active),
      })
      .where(eq(leaders.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update leader' });
  }
});

// Events
app.get('/api/admin/events', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(events).orderBy(asc(events.startDatetime));
  const regs = await db.select().from(eventRegistrations);
  res.json(
    rows.map((e) => ({
      ...e,
      registrations: regs.filter((r) => r.eventId === e.id),
    }))
  );
});

app.post('/api/admin/events', requireAuth, requireStaff, requirePermission('events.create'), async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    const slug = `${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${Date.now().toString(36)}`;
    const [created] = await db
      .insert(events)
      .values({
        title: b.title,
        slug,
        description: b.description,
        eventCategory: b.eventCategory || 'Church services',
        startDatetime: b.startDatetime,
        endDatetime: b.endDatetime || null,
        location: b.location || 'GVCC Sanctuary, Ogembo',
        posterUrl: b.posterUrl || '/images/church/photo_03.jpg',
        registrationOpen: Boolean(b.registrationOpen),
        capacity: b.capacity ? Number(b.capacity) : null,
        contactPerson: b.contactPerson || '0727 543 663',
        status: b.status || 'Upcoming',
        createdBy: req.appUser!.id,
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'event.create', 'events', String(created.id), created.title);
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.patch('/api/admin/events/:id', requireAuth, requireStaff, requirePermission('events.publish'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(events)
      .set({
        title: b.title,
        description: b.description,
        eventCategory: b.eventCategory,
        startDatetime: b.startDatetime,
        endDatetime: b.endDatetime ?? null,
        location: b.location,
        posterUrl: b.posterUrl ?? null,
        registrationOpen: Boolean(b.registrationOpen),
        capacity: b.capacity ? Number(b.capacity) : null,
        status: b.status,
      })
      .where(eq(events.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/admin/events/:id', requireAuth, requireStaff, requirePermission('events.publish'), async (req, res) => {
  await db.delete(events).where(eq(events.id, Number(req.params.id)));
  res.json({ ok: true });
});

// News & Updates
app.get('/api/admin/news', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(newsPosts).orderBy(desc(newsPosts.createdAt));
  res.json(rows);
});

app.post('/api/admin/news', requireAuth, requireStaff, requirePermission('news.create'), async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    const slug = `${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${Date.now().toString(36)}`;
    const [created] = await db
      .insert(newsPosts)
      .values({
        title: b.title,
        slug,
        summary: b.summary,
        body: b.body,
        featuredImage: b.featuredImage || '/images/church/photo_08.jpg',
        category: b.category || 'Church Announcement',
        authorName: b.authorName || req.appUser!.fullName,
        authorId: req.appUser!.id,
        status: b.status || 'Published',
        publishedAt: new Date(),
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'news.create', 'news_posts', String(created.id), created.title);
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create news update' });
  }
});

app.patch('/api/admin/news/:id', requireAuth, requireStaff, requirePermission('news.publish'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(newsPosts)
      .set({
        title: b.title,
        summary: b.summary,
        body: b.body,
        featuredImage: b.featuredImage ?? null,
        category: b.category,
        status: b.status,
        updatedAt: new Date(),
      })
      .where(eq(newsPosts.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update news post' });
  }
});

app.delete('/api/admin/news/:id', requireAuth, requireStaff, requirePermission('news.publish'), async (req, res) => {
  await db.delete(newsPosts).where(eq(newsPosts.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Daily Devotionals (Church Leaders)
const devotionalSchema = z.object({
  title: z.string().min(2, 'Title is required').max(160),
  scriptureReference: z.string().min(2, 'Scripture reference is required').max(120),
  scriptureText: z.string().max(1500).optional().nullable(),
  message: z.string().min(5, 'Encouraging message is required').max(4000),
  prayerFocus: z.string().max(1000).optional().nullable(),
  authorName: z.string().min(2).max(120).optional().nullable(),
  authorTitle: z.string().max(120).optional().nullable(),
  devotionalDate: z.string().max(30).optional().nullable(),
  featured: z.boolean().default(false),
  status: z.enum(['Published', 'Draft', 'Archived']).default('Published'),
});

app.get('/api/admin/devotionals', requireAuth, requireStaff, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(devotionals)
      .orderBy(desc(devotionals.devotionalDate), desc(devotionals.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to load devotionals' });
  }
});

app.post('/api/admin/devotionals', requireAuth, requireStaff, requirePermission('devotionals.manage'), async (req: AuthRequest, res) => {
  try {
    const parsed = devotionalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid devotional input' });
    }
    const d = parsed.data;
    const [created] = await db
      .insert(devotionals)
      .values({
        title: d.title.trim(),
        scriptureReference: d.scriptureReference.trim(),
        scriptureText: d.scriptureText?.trim() || null,
        message: d.message.trim(),
        prayerFocus: d.prayerFocus?.trim() || null,
        authorName: d.authorName?.trim() || req.appUser!.fullName || 'GVCC Leadership',
        authorTitle: d.authorTitle?.trim() || 'Church Leader',
        devotionalDate: d.devotionalDate?.trim() || new Date().toISOString().slice(0, 10),
        featured: Boolean(d.featured),
        status: d.status,
        authorUserId: req.appUser!.id,
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'devotional.create', 'devotionals', String(created.id), created.title);
    res.status(201).json(created);
  } catch (error) {
    console.error('Create devotional failed:', error);
    res.status(500).json({ error: 'Failed to publish daily devotional' });
  }
});

app.patch('/api/admin/devotionals/:id', requireAuth, requireStaff, requirePermission('devotionals.manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const [updated] = await db
      .update(devotionals)
      .set({
        title: b.title !== undefined ? String(b.title).trim() : undefined,
        scriptureReference: b.scriptureReference !== undefined ? String(b.scriptureReference).trim() : undefined,
        scriptureText: b.scriptureText !== undefined ? (b.scriptureText ? String(b.scriptureText).trim() : null) : undefined,
        message: b.message !== undefined ? String(b.message).trim() : undefined,
        prayerFocus: b.prayerFocus !== undefined ? (b.prayerFocus ? String(b.prayerFocus).trim() : null) : undefined,
        authorName: b.authorName !== undefined ? String(b.authorName).trim() : undefined,
        authorTitle: b.authorTitle !== undefined ? (b.authorTitle ? String(b.authorTitle).trim() : null) : undefined,
        devotionalDate: b.devotionalDate !== undefined ? String(b.devotionalDate).trim() : undefined,
        featured: b.featured !== undefined ? Boolean(b.featured) : undefined,
        status: b.status !== undefined ? String(b.status) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(devotionals.id, id))
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'devotional.update', 'devotionals', String(id), updated?.status || '');
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update devotional' });
  }
});

app.delete('/api/admin/devotionals/:id', requireAuth, requireStaff, requirePermission('devotionals.manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(devotionals).where(eq(devotionals.id, id));
  await logAudit(req.appUser!.uid, req.appUser!.email, 'devotional.delete', 'devotionals', String(id));
  res.json({ ok: true });
});

// Sermons
app.get('/api/admin/sermons', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(sermons).orderBy(desc(sermons.sermonDate));
  res.json(rows);
});

app.post('/api/admin/sermons', requireAuth, requireStaff, requirePermission('sermons.manage'), async (req, res) => {
  try {
    const b = req.body;
    const [created] = await db
      .insert(sermons)
      .values({
        title: b.title,
        speaker: b.speaker || 'Bishop Joseph Ondari Gichana',
        scriptureReference: b.scriptureReference || null,
        description: b.description,
        videoUrl: b.videoUrl || null,
        audioUrl: b.audioUrl || null,
        thumbnailUrl: b.thumbnailUrl || '/images/church/photo_22.jpg',
        sermonDate: b.sermonDate || new Date().toISOString().slice(0, 10),
        duration: b.duration || null,
        category: b.category || 'Sunday messages',
        featured: Boolean(b.featured),
        status: b.status || 'Published',
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create sermon' });
  }
});

app.delete('/api/admin/sermons/:id', requireAuth, requireStaff, requirePermission('sermons.manage'), async (req, res) => {
  await db.delete(sermons).where(eq(sermons.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Media & Gallery
app.get('/api/admin/media', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(mediaAssets).orderBy(asc(mediaAssets.displayOrder));
  res.json(rows);
});

app.post('/api/admin/media', requireAuth, requireStaff, requirePermission('gallery.upload'), async (req, res) => {
  try {
    const b = req.body;
    const total = await db.select({ value: count() }).from(mediaAssets);
    const [created] = await db
      .insert(mediaAssets)
      .values({
        filename: b.filename || 'uploaded-photo.jpg',
        storagePath: b.storagePath,
        mediaType: 'image',
        caption: b.caption || '',
        altText: b.altText || b.caption || 'GVCC Church Photo',
        category: b.category || 'Church services',
        featured: Boolean(b.featured),
        hidden: false,
        displayOrder: Number(total[0]?.value ?? 0) + 1,
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to add media asset' });
  }
});

app.patch('/api/admin/media/:id', requireAuth, requireStaff, requirePermission('gallery.upload'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(mediaAssets)
      .set({
        caption: b.caption,
        category: b.category,
        featured: Boolean(b.featured),
        hidden: Boolean(b.hidden),
        displayOrder: Number(b.displayOrder ?? 0),
      })
      .where(eq(mediaAssets.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update media item' });
  }
});

app.delete('/api/admin/media/:id', requireAuth, requireStaff, requirePermission('gallery.delete'), async (req, res) => {
  await db.delete(mediaAssets).where(eq(mediaAssets.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Homepage Slideshow Manager
app.get('/api/admin/slides', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(homepageSlides).orderBy(asc(homepageSlides.displayOrder));
  res.json(rows);
});

app.post('/api/admin/slides', requireAuth, requireStaff, requirePermission('slideshow.manage'), async (req, res) => {
  try {
    const b = req.body;
    const [created] = await db
      .insert(homepageSlides)
      .values({
        imageUrl: b.imageUrl,
        eyebrow: b.eyebrow,
        heading: b.heading,
        subtitle: b.subtitle,
        scriptureReference: b.scriptureReference || null,
        buttonLabel: b.buttonLabel || 'Plan Your Visit',
        buttonUrl: b.buttonUrl || '#connect',
        objectPosition: b.objectPosition || '50% 25%',
        displayOrder: Number(b.displayOrder ?? 10),
        durationSeconds: Number(b.durationSeconds ?? 7),
        active: b.active !== false,
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create slide' });
  }
});

app.patch('/api/admin/slides/:id', requireAuth, requireStaff, requirePermission('slideshow.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const [updated] = await db
      .update(homepageSlides)
      .set({
        imageUrl: b.imageUrl,
        eyebrow: b.eyebrow,
        heading: b.heading,
        subtitle: b.subtitle,
        scriptureReference: b.scriptureReference ?? null,
        buttonLabel: b.buttonLabel,
        buttonUrl: b.buttonUrl,
        objectPosition: b.objectPosition,
        displayOrder: Number(b.displayOrder ?? 1),
        durationSeconds: Number(b.durationSeconds ?? 7),
        active: Boolean(b.active),
      })
      .where(eq(homepageSlides.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update slide' });
  }
});

app.delete('/api/admin/slides/:id', requireAuth, requireStaff, requirePermission('slideshow.manage'), async (req, res) => {
  await db.delete(homepageSlides).where(eq(homepageSlides.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Contact Messages
app.get('/api/admin/messages', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  res.json(rows);
});

app.patch('/api/admin/messages/:id', requireAuth, requireStaff, async (req, res) => {
  const [updated] = await db
    .update(contactMessages)
    .set({ status: req.body.status })
    .where(eq(contactMessages.id, Number(req.params.id)))
    .returning();
  res.json(updated);
});

// Website Settings
app.get('/api/admin/settings', requireAuth, requireStaff, async (_req, res) => {
  const rows = await db.select().from(churchSettings).where(eq(churchSettings.settingKey, 'identity'));
  res.json(rows[0]?.settingValue ?? {});
});

app.put('/api/admin/settings', requireAuth, requireStaff, requirePermission('settings.manage'), async (req: AuthRequest, res) => {
  try {
    const [updated] = await db
      .insert(churchSettings)
      .values({
        settingKey: 'identity',
        settingValue: req.body,
        updatedBy: req.appUser!.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: churchSettings.settingKey,
        set: {
          settingValue: req.body,
          updatedBy: req.appUser!.id,
          updatedAt: new Date(),
        },
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'settings.update', 'church_settings', 'identity');
    res.json(updated.settingValue);
  } catch {
    res.status(500).json({ error: 'Failed to save website settings' });
  }
});

// Admin Users & Permissions (RBAC Management)
app.get('/api/admin/users', requireAuth, requireStaff, requirePermission('admins.manage'), async (_req, res) => {
  const rows = await db.select().from(users).orderBy(asc(users.id));
  res.json(rows);
});

app.patch('/api/admin/users/:id', requireAuth, requireStaff, requirePermission('admins.manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { role, permissions, accountStatus, assignedFellowshipId } = req.body;
    const [updated] = await db
      .update(users)
      .set({
        role,
        permissions: Array.isArray(permissions) ? permissions : [],
        accountStatus: accountStatus || 'active',
        assignedFellowshipId: assignedFellowshipId ? Number(assignedFellowshipId) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'admin.user_role_update', 'users', String(id), role);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update admin user permissions' });
  }
});

// Tithes & Offerings Records (Confidential Admin Management)
app.get('/api/admin/giving', requireAuth, requireStaff, requirePermission('giving.view'), async (_req, res) => {
  try {
    const rows = await db.select().from(givingRecords).orderBy(desc(givingRecords.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to load giving records' });
  }
});

app.patch('/api/admin/giving/:id', requireAuth, requireStaff, requirePermission('giving.manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const [updated] = await db
      .update(givingRecords)
      .set({ status, updatedAt: new Date() })
      .where(eq(givingRecords.id, id))
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'giving.update', 'giving_records', String(id), status);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update giving record' });
  }
});

// Duty Rosters (Services, Ushering, Worship, Media, Protocol)
const rosterSchema = z.object({
  serviceDate: z.string().min(4, 'Service date is required').max(40),
  serviceTitle: z.string().min(2, 'Service title is required').max(160),
  department: z.string().min(2, 'Department is required').max(120),
  assignedMember: z.string().min(2, 'Assigned member name is required').max(140),
  contactPhone: z.string().max(40).optional().nullable(),
  shiftTime: z.string().max(80).optional().nullable(),
  status: z.enum(['Scheduled', 'Confirmed', 'Completed', 'Substituted', 'Cancelled']).default('Scheduled'),
  notes: z.string().max(1000).optional().nullable(),
});

app.get('/api/admin/rosters', requireAuth, requireStaff, requirePermission('rosters.view'), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(dutyRosters)
      .orderBy(desc(dutyRosters.serviceDate), desc(dutyRosters.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to load duty rosters' });
  }
});

app.post('/api/admin/rosters', requireAuth, requireStaff, requirePermission('rosters.manage'), async (req: AuthRequest, res) => {
  try {
    const parsed = rosterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid duty roster entry' });
    }
    const d = parsed.data;
    const total = await db.select({ value: count() }).from(dutyRosters);
    const rosterNumber = await generateReferenceNumber('RST', Number(total[0]?.value ?? 0));
    const [created] = await db
      .insert(dutyRosters)
      .values({
        rosterNumber,
        serviceDate: d.serviceDate.trim(),
        serviceTitle: d.serviceTitle.trim(),
        department: d.department.trim(),
        assignedMember: d.assignedMember.trim(),
        contactPhone: d.contactPhone?.trim() || null,
        shiftTime: d.shiftTime?.trim() || null,
        status: d.status,
        notes: d.notes?.trim() || null,
      })
      .returning();
    await logAudit(
      req.appUser!.uid,
      req.appUser!.email,
      'roster.create',
      'duty_rosters',
      String(created.id),
      `${created.rosterNumber} · ${created.department} · ${created.assignedMember}`
    );
    res.status(201).json(created);
  } catch (error) {
    console.error('Create roster failed:', error);
    res.status(500).json({ error: 'Failed to create duty roster entry' });
  }
});

app.patch('/api/admin/rosters/:id', requireAuth, requireStaff, requirePermission('rosters.manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid roster ID' });
    }
    const b = req.body || {};
    const [updated] = await db
      .update(dutyRosters)
      .set({
        serviceDate: b.serviceDate !== undefined ? String(b.serviceDate).trim() : undefined,
        serviceTitle: b.serviceTitle !== undefined ? String(b.serviceTitle).trim() : undefined,
        department: b.department !== undefined ? String(b.department).trim() : undefined,
        assignedMember: b.assignedMember !== undefined ? String(b.assignedMember).trim() : undefined,
        contactPhone: b.contactPhone !== undefined ? (b.contactPhone ? String(b.contactPhone).trim() : null) : undefined,
        shiftTime: b.shiftTime !== undefined ? (b.shiftTime ? String(b.shiftTime).trim() : null) : undefined,
        status: b.status !== undefined ? String(b.status) : undefined,
        notes: b.notes !== undefined ? (b.notes ? String(b.notes).trim() : null) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(dutyRosters.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Duty roster entry not found' });
    }
    await logAudit(req.appUser!.uid, req.appUser!.email, 'roster.update', 'duty_rosters', String(id), updated.status);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update duty roster' });
  }
});

app.delete('/api/admin/rosters/:id', requireAuth, requireStaff, requirePermission('rosters.manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(dutyRosters).where(eq(dutyRosters.id, id));
  await logAudit(req.appUser!.uid, req.appUser!.email, 'roster.delete', 'duty_rosters', String(id));
  res.json({ ok: true });
});

// Church Assets & Property Inventory
const assetSchema = z.object({
  assetName: z.string().min(2, 'Asset name is required').max(160),
  category: z.string().min(2, 'Asset category is required').max(120),
  quantity: z.number().int().min(1).max(100000).default(1),
  serialNumber: z.string().max(120).optional().nullable(),
  acquisitionDate: z.string().max(40).optional().nullable(),
  estimatedValueKes: z.number().int().min(0).max(2000000000).optional().nullable(),
  location: z.string().max(160).default('GVCC Sanctuary, Ogembo'),
  custodianName: z.string().max(140).optional().nullable(),
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Needs Repair', 'Decommissioned']).default('Good'),
  notes: z.string().max(1000).optional().nullable(),
});

app.get('/api/admin/assets', requireAuth, requireStaff, requirePermission('assets.view'), async (_req, res) => {
  try {
    const rows = await db.select().from(churchAssets).orderBy(desc(churchAssets.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to load church assets' });
  }
});

app.post('/api/admin/assets', requireAuth, requireStaff, requirePermission('assets.manage'), async (req: AuthRequest, res) => {
  try {
    const parsed = assetSchema.safeParse({
      ...req.body,
      quantity: req.body?.quantity !== undefined && req.body?.quantity !== '' ? Number(req.body.quantity) : 1,
      estimatedValueKes:
        req.body?.estimatedValueKes === '' || req.body?.estimatedValueKes === null || req.body?.estimatedValueKes === undefined
          ? null
          : Number(req.body.estimatedValueKes),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid asset details' });
    }
    const d = parsed.data;
    const total = await db.select({ value: count() }).from(churchAssets);
    const assetTag = await generateReferenceNumber('AST', Number(total[0]?.value ?? 0));
    const [created] = await db
      .insert(churchAssets)
      .values({
        assetTag,
        assetName: d.assetName.trim(),
        category: d.category.trim(),
        quantity: d.quantity,
        serialNumber: d.serialNumber?.trim() || null,
        acquisitionDate: d.acquisitionDate?.trim() || null,
        estimatedValueKes: d.estimatedValueKes ?? null,
        location: d.location?.trim() || 'GVCC Sanctuary, Ogembo',
        custodianName: d.custodianName?.trim() || null,
        condition: d.condition,
        notes: d.notes?.trim() || null,
      })
      .returning();
    await logAudit(
      req.appUser!.uid,
      req.appUser!.email,
      'asset.create',
      'church_assets',
      String(created.id),
      `${created.assetTag} · ${created.assetName}`
    );
    res.status(201).json(created);
  } catch (error) {
    console.error('Create asset failed:', error);
    res.status(500).json({ error: 'Failed to register church asset' });
  }
});

app.patch('/api/admin/assets/:id', requireAuth, requireStaff, requirePermission('assets.manage'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    const b = req.body || {};
    const [updated] = await db
      .update(churchAssets)
      .set({
        assetName: b.assetName !== undefined ? String(b.assetName).trim() : undefined,
        category: b.category !== undefined ? String(b.category).trim() : undefined,
        quantity: b.quantity !== undefined ? Math.max(1, Number(b.quantity) || 1) : undefined,
        serialNumber: b.serialNumber !== undefined ? (b.serialNumber ? String(b.serialNumber).trim() : null) : undefined,
        acquisitionDate: b.acquisitionDate !== undefined ? (b.acquisitionDate ? String(b.acquisitionDate).trim() : null) : undefined,
        estimatedValueKes:
          b.estimatedValueKes !== undefined
            ? b.estimatedValueKes === '' || b.estimatedValueKes === null
              ? null
              : Number(b.estimatedValueKes)
            : undefined,
        location: b.location !== undefined ? String(b.location).trim() : undefined,
        custodianName: b.custodianName !== undefined ? (b.custodianName ? String(b.custodianName).trim() : null) : undefined,
        condition: b.condition !== undefined ? String(b.condition) : undefined,
        notes: b.notes !== undefined ? (b.notes ? String(b.notes).trim() : null) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(churchAssets.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    await logAudit(req.appUser!.uid, req.appUser!.email, 'asset.update', 'church_assets', String(id), updated.condition);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update church asset' });
  }
});

app.delete('/api/admin/assets/:id', requireAuth, requireStaff, requirePermission('assets.manage'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(churchAssets).where(eq(churchAssets.id, id));
  await logAudit(req.appUser!.uid, req.appUser!.email, 'asset.delete', 'church_assets', String(id));
  res.json({ ok: true });
});

// Moderated Testimonies Administration
app.get('/api/admin/testimonies', requireAuth, requireStaff, requirePermission('testimonies.moderate'), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(testimonies)
      .orderBy(desc(testimonies.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to load testimonies moderation queue' });
  }
});

app.post('/api/admin/testimonies', requireAuth, requireStaff, requirePermission('testimonies.moderate'), async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.story) {
      return res.status(400).json({ error: 'Title and testimony story are required' });
    }
    const total = await db.select({ value: count() }).from(testimonies);
    const ref = await generateReferenceNumber('TST', Number(total[0]?.value ?? 0));
    const status = ['Pending Review', 'Approved', 'Rejected', 'Archived'].includes(b.moderationStatus)
      ? b.moderationStatus
      : 'Approved';
    const [created] = await db
      .insert(testimonies)
      .values({
        referenceNumber: ref,
        authorName: String(b.authorName || 'GVCC Member').trim(),
        displayAnonymous: Boolean(b.displayAnonymous),
        phone: b.phone ? String(b.phone).trim() : null,
        email: b.email ? String(b.email).trim() : null,
        fellowshipGroup: b.fellowshipGroup ? String(b.fellowshipGroup).trim() : null,
        category: String(b.category || 'Faith & Salvation').trim(),
        title: String(b.title).trim(),
        story: String(b.story).trim(),
        scriptureReference: b.scriptureReference ? String(b.scriptureReference).trim() : null,
        featured: Boolean(b.featured),
        moderationStatus: status,
        moderationNotes: b.moderationNotes ? String(b.moderationNotes).trim() : null,
        moderatedBy: req.appUser!.id,
        moderatedAt: new Date(),
        consent: true,
      })
      .returning();
    await logAudit(req.appUser!.uid, req.appUser!.email, 'testimony.create', 'testimonies', String(created.id), status);
    res.status(201).json(created);
  } catch (error) {
    console.error('Admin testimony create failed:', error);
    res.status(500).json({ error: 'Failed to save testimony' });
  }
});

app.patch('/api/admin/testimonies/:id', requireAuth, requireStaff, requirePermission('testimonies.moderate'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const nextStatus =
      b.moderationStatus !== undefined &&
      ['Pending Review', 'Approved', 'Rejected', 'Archived'].includes(b.moderationStatus)
        ? b.moderationStatus
        : undefined;

    const [updated] = await db
      .update(testimonies)
      .set({
        authorName: b.authorName !== undefined ? String(b.authorName).trim() : undefined,
        displayAnonymous: b.displayAnonymous !== undefined ? Boolean(b.displayAnonymous) : undefined,
        fellowshipGroup:
          b.fellowshipGroup !== undefined ? (b.fellowshipGroup ? String(b.fellowshipGroup).trim() : null) : undefined,
        category: b.category !== undefined ? String(b.category).trim() : undefined,
        title: b.title !== undefined ? String(b.title).trim() : undefined,
        story: b.story !== undefined ? String(b.story).trim() : undefined,
        scriptureReference:
          b.scriptureReference !== undefined
            ? b.scriptureReference
              ? String(b.scriptureReference).trim()
              : null
            : undefined,
        featured: b.featured !== undefined ? Boolean(b.featured) : undefined,
        moderationStatus: nextStatus,
        moderationNotes:
          b.moderationNotes !== undefined ? (b.moderationNotes ? String(b.moderationNotes).trim() : null) : undefined,
        moderatedBy: req.appUser!.id,
        moderatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(testimonies.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Testimony not found' });
    }
    await logAudit(
      req.appUser!.uid,
      req.appUser!.email,
      'testimony.moderate',
      'testimonies',
      String(id),
      updated.moderationStatus
    );
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to moderate testimony' });
  }
});

app.delete('/api/admin/testimonies/:id', requireAuth, requireStaff, requirePermission('testimonies.moderate'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(testimonies).where(eq(testimonies.id, id));
  await logAudit(req.appUser!.uid, req.appUser!.email, 'testimony.delete', 'testimonies', String(id));
  res.json({ ok: true });
});

// CSV Export
app.get('/api/admin/export/:type', requireAuth, requireStaff, requirePermission('reports.export'), async (req: AuthRequest, res) => {
  try {
    const type = req.params.type;
    let rows: Record<string, unknown>[] = [];
    if (type === 'members') {
      rows = await db.select().from(members).orderBy(desc(members.createdAt));
    } else if (type === 'visitors') {
      rows = await db.select().from(visitors).orderBy(desc(visitors.createdAt));
    } else if (type === 'fellowships') {
      rows = await db.select().from(fellowshipJoinRequests).orderBy(desc(fellowshipJoinRequests.createdAt));
    } else if (type === 'giving') {
      if (!hasPermission(req.appUser, 'giving.view')) {
        return res.status(403).json({ error: 'Forbidden: Missing giving.view permission' });
      }
      rows = await db.select().from(givingRecords).orderBy(desc(givingRecords.createdAt));
    } else if (type === 'rosters') {
      if (!hasPermission(req.appUser, 'rosters.view')) {
        return res.status(403).json({ error: 'Forbidden: Missing rosters.view permission' });
      }
      rows = await db.select().from(dutyRosters).orderBy(desc(dutyRosters.serviceDate), desc(dutyRosters.createdAt));
    } else if (type === 'assets') {
      if (!hasPermission(req.appUser, 'assets.view')) {
        return res.status(403).json({ error: 'Forbidden: Missing assets.view permission' });
      }
      rows = await db.select().from(churchAssets).orderBy(desc(churchAssets.createdAt));
    } else {
      return res.status(400).json({ error: 'Unsupported export type' });
    }
    if (!rows.length) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="gvcc-${type}.csv"`);
      return res.send('No records available\n');
    }
    const headers = Object.keys(rows[0]);
    const escapeCsv = (val: unknown) => {
      const s = val == null ? '' : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gvcc-${type}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ---------------------------------------------------------------------------
// VITE / STATIC SERVING
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GVCC Church Platform server listening on port ${PORT}`);
  });
}

const isServerlessRuntime = Boolean(
  process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
);

if (!isServerlessRuntime) {
  startServer();
}

export { app };
export default app;
