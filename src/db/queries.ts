import { asc, count, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
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
  memberFollowups,
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
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import { and, inArray, notInArray } from 'drizzle-orm';

export async function getPublicPrayerBoard() {
  try {
    const rows = await db
      .select({
        id: prayerRequests.id,
        referenceNumber: prayerRequests.referenceNumber,
        requesterName: prayerRequests.requesterName,
        category: prayerRequests.category,
        requestContent: prayerRequests.requestContent,
        privacyLevel: prayerRequests.privacyLevel,
        prayerCount: prayerRequests.prayerCount,
        status: prayerRequests.status,
        createdAt: prayerRequests.createdAt,
      })
      .from(prayerRequests)
      .where(
        and(
          inArray(prayerRequests.privacyLevel, ['public_board', 'public_testimony']),
          notInArray(prayerRequests.status, ['Closed', 'Archived'])
        )
      )
      .orderBy(desc(prayerRequests.createdAt))
      .limit(50);

    const ids = rows.map((r) => r.id);
    const supportsRows =
      ids.length > 0
        ? await db
            .select()
            .from(prayerSupports)
            .where(inArray(prayerSupports.prayerRequestId, ids))
            .orderBy(desc(prayerSupports.createdAt))
        : [];

    return rows.map((r) => ({
      ...r,
      requesterName: r.requesterName || 'Anonymous',
      supports: supportsRows.filter((s) => s.prayerRequestId === r.id).slice(0, 5),
    }));
  } catch (error) {
    console.error('Database query failed in getPublicPrayerBoard:', error);
    throw new Error('Failed to load public prayer board.', { cause: error });
  }
}

export async function getPublishedDevotionals() {
  try {
    return await db
      .select({
        id: devotionals.id,
        title: devotionals.title,
        scriptureReference: devotionals.scriptureReference,
        scriptureText: devotionals.scriptureText,
        message: devotionals.message,
        prayerFocus: devotionals.prayerFocus,
        authorName: devotionals.authorName,
        authorTitle: devotionals.authorTitle,
        devotionalDate: devotionals.devotionalDate,
        featured: devotionals.featured,
        status: devotionals.status,
        createdAt: devotionals.createdAt,
      })
      .from(devotionals)
      .where(eq(devotionals.status, 'Published'))
      .orderBy(desc(devotionals.featured), desc(devotionals.devotionalDate), desc(devotionals.createdAt))
      .limit(20);
  } catch (error) {
    console.error('Database query failed in getPublishedDevotionals:', error);
    throw new Error('Failed to load daily devotionals.', { cause: error });
  }
}

export async function getPublishedTestimonies() {
  try {
    const rows = await db
      .select({
        id: testimonies.id,
        referenceNumber: testimonies.referenceNumber,
        authorName: testimonies.authorName,
        displayAnonymous: testimonies.displayAnonymous,
        fellowshipGroup: testimonies.fellowshipGroup,
        category: testimonies.category,
        title: testimonies.title,
        story: testimonies.story,
        scriptureReference: testimonies.scriptureReference,
        amenCount: testimonies.amenCount,
        featured: testimonies.featured,
        createdAt: testimonies.createdAt,
      })
      .from(testimonies)
      .where(eq(testimonies.moderationStatus, 'Approved'))
      .orderBy(desc(testimonies.featured), desc(testimonies.createdAt))
      .limit(100);

    return rows.map((row) => ({
      ...row,
      authorName: row.displayAnonymous ? 'Anonymous Believer' : row.authorName,
    }));
  } catch (error) {
    console.error('Database query failed in getPublishedTestimonies:', error);
    throw new Error('Failed to load testimonies.', { cause: error });
  }
}

export async function getPublicBootstrapData() {
  try {
    await ensureSeeded();
    const [
      settingsRows,
      slidesRows,
      leadersRows,
      fellowshipsRows,
      ministriesRows,
      eventsRows,
      newsRows,
      sermonsRows,
      galleryRows,
      publicPrayersRows,
      devotionalsRows,
      testimoniesRows,
    ] = await Promise.all([
      db.select().from(churchSettings).where(eq(churchSettings.settingKey, 'identity')),
      db.select().from(homepageSlides).where(eq(homepageSlides.active, true)).orderBy(asc(homepageSlides.displayOrder)),
      db.select().from(leaders).where(eq(leaders.active, true)).orderBy(asc(leaders.displayOrder)),
      db.select().from(fellowships).orderBy(asc(fellowships.displayOrder)),
      db.select().from(ministries).orderBy(asc(ministries.displayOrder)),
      db.select().from(events).orderBy(asc(events.startDatetime)),
      db.select().from(newsPosts).where(eq(newsPosts.status, 'Published')).orderBy(desc(newsPosts.publishedAt)),
      db.select().from(sermons).where(eq(sermons.status, 'Published')).orderBy(desc(sermons.sermonDate)),
      db.select().from(mediaAssets).where(eq(mediaAssets.hidden, false)).orderBy(asc(mediaAssets.displayOrder)),
      getPublicPrayerBoard(),
      getPublishedDevotionals(),
      getPublishedTestimonies(),
    ]);

    return {
      settings: settingsRows[0]?.settingValue ?? null,
      slides: slidesRows,
      leaders: leadersRows,
      fellowships: fellowshipsRows,
      ministries: ministriesRows,
      events: eventsRows.filter((e) => e.status !== 'Draft' && e.status !== 'Cancelled'),
      news: newsRows,
      sermons: sermonsRows,
      gallery: galleryRows,
      publicPrayers: publicPrayersRows,
      devotionals: devotionalsRows,
      testimonies: testimoniesRows,
    };
  } catch (error) {
    console.error('Database query failed in getPublicBootstrapData:', error);
    throw new Error('Failed to load church platform data.', { cause: error });
  }
}

export async function getAdminOverviewStats() {
  try {
    const [
      memberTotal,
      visitorTotal,
      pendingPrayerTotal,
      upcomingEventTotal,
      fellowshipReqTotal,
      newsTotal,
      sermonTotal,
      mediaTotal,
      rosterTotal,
      assetTotal,
      givingTotal,
      devotionalTotal,
      pendingTestimonyTotal,
      recentMembers,
      recentVisitors,
      recentPrayersMeta,
      recentLogs,
    ] = await Promise.all([
      db.select({ value: count() }).from(members),
      db.select({ value: count() }).from(visitors),
      db.select({ value: count() }).from(prayerRequests),
      db.select({ value: count() }).from(events),
      db.select({ value: count() }).from(fellowshipJoinRequests),
      db.select({ value: count() }).from(newsPosts),
      db.select({ value: count() }).from(sermons),
      db.select({ value: count() }).from(mediaAssets),
      db.select({ value: count() }).from(dutyRosters),
      db.select({ value: count() }).from(churchAssets),
      db.select({ value: count() }).from(givingRecords),
      db.select({ value: count() }).from(devotionals),
      db.select({ value: count() }).from(testimonies).where(eq(testimonies.moderationStatus, 'Pending Review')),
      db.select().from(members).orderBy(desc(members.createdAt)).limit(6),
      db.select().from(visitors).orderBy(desc(visitors.createdAt)).limit(5),
      db
        .select({
          id: prayerRequests.id,
          referenceNumber: prayerRequests.referenceNumber,
          category: prayerRequests.category,
          status: prayerRequests.status,
          privacyLevel: prayerRequests.privacyLevel,
          createdAt: prayerRequests.createdAt,
        })
        .from(prayerRequests)
        .orderBy(desc(prayerRequests.createdAt))
        .limit(5),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8),
    ]);

    const allMembersRows = await db
      .select({
        id: members.id,
        gender: members.gender,
        dateOfBirth: members.dateOfBirth,
        membershipType: members.membershipType,
        membershipStatus: members.membershipStatus,
        interestedMinistries: members.interestedMinistries,
        registrationDate: members.registrationDate,
        joinDate: members.joinDate,
        createdAt: members.createdAt,
      })
      .from(members);

    const statusNorm = (s: string) => {
      const lower = (s || '').toLowerCase();
      if (lower.includes('active')) return 'Active Member';
      if (lower.includes('transfer')) return 'Transferred';
      if (lower.includes('inactive') || lower.includes('archiv')) return 'Inactive';
      if (lower.includes('pending') || lower.includes('follow') || lower.includes('contact') || lower.includes('orientation')) {
        return 'Pending Follow-up';
      }
      return 'New Member';
    };

    const statusCounts: Record<string, number> = {
      'New Member': 0,
      'Active Member': 0,
      'Pending Follow-up': 0,
      Transferred: 0,
      Inactive: 0,
    };
    const genderCounts: Record<string, number> = { Male: 0, Female: 0, Unspecified: 0 };
    const ageCategoryCounts: Record<string, number> = {
      'Children (<13)': 0,
      'Teens (13-17)': 0,
      'Youth (18-30)': 0,
      'Young Adults (31-45)': 0,
      'Adults (46-60)': 0,
      'Seniors (60+)': 0,
      Unspecified: 0,
    };
    const ministryCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const monthlyGrowthMap: Record<string, number> = {};

    const nowYear = new Date().getFullYear();

    for (const m of allMembersRows) {
      const st = statusNorm(m.membershipStatus);
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const g = (m.gender || '').trim();
      if (g === 'Male' || g === 'Female') genderCounts[g] += 1;
      else genderCounts.Unspecified += 1;

      if (m.dateOfBirth) {
        const dobYear = Number(m.dateOfBirth.slice(0, 4));
        const age = Number.isFinite(dobYear) && dobYear > 1900 && dobYear <= nowYear ? nowYear - dobYear : -1;
        if (age < 0) ageCategoryCounts.Unspecified += 1;
        else if (age < 13) ageCategoryCounts['Children (<13)'] += 1;
        else if (age <= 17) ageCategoryCounts['Teens (13-17)'] += 1;
        else if (age <= 30) ageCategoryCounts['Youth (18-30)'] += 1;
        else if (age <= 45) ageCategoryCounts['Young Adults (31-45)'] += 1;
        else if (age <= 60) ageCategoryCounts['Adults (46-60)'] += 1;
        else ageCategoryCounts['Seniors (60+)'] += 1;
      } else {
        ageCategoryCounts.Unspecified += 1;
      }

      const mType = (m.membershipType || 'New member').trim();
      categoryCounts[mType] = (categoryCounts[mType] || 0) + 1;

      const mins = Array.isArray(m.interestedMinistries) ? m.interestedMinistries : [];
      for (const minName of mins) {
        if (minName) ministryCounts[minName] = (ministryCounts[minName] || 0) + 1;
      }

      const dt = (m.joinDate || m.registrationDate || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(dt)) {
        monthlyGrowthMap[dt] = (monthlyGrowthMap[dt] || 0) + 1;
      }
    }

    const monthlyGrowth = Object.entries(monthlyGrowthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, countVal]) => ({ month, count: countVal }));

    return {
      counts: {
        members: Number(memberTotal[0]?.value ?? 0),
        visitors: Number(visitorTotal[0]?.value ?? 0),
        prayers: Number(pendingPrayerTotal[0]?.value ?? 0),
        events: Number(upcomingEventTotal[0]?.value ?? 0),
        fellowshipRequests: Number(fellowshipReqTotal[0]?.value ?? 0),
        news: Number(newsTotal[0]?.value ?? 0),
        sermons: Number(sermonTotal[0]?.value ?? 0),
        media: Number(mediaTotal[0]?.value ?? 0),
        rosters: Number(rosterTotal[0]?.value ?? 0),
        assets: Number(assetTotal[0]?.value ?? 0),
        giving: Number(givingTotal[0]?.value ?? 0),
        devotionals: Number(devotionalTotal[0]?.value ?? 0),
        pendingTestimonies: Number(pendingTestimonyTotal[0]?.value ?? 0),
      },
      membershipAnalytics: {
        total: allMembersRows.length,
        statusCounts,
        genderCounts,
        ageCategoryCounts,
        ministryCounts,
        categoryCounts,
        monthlyGrowth,
      },
      recentMembers,
      recentVisitors,
      recentPrayersMeta,
      recentLogs,
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverviewStats:', error);
    throw new Error('Failed to load dashboard overview.', { cause: error });
  }
}

export async function logAudit(
  actorUid: string,
  actorEmail: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: string
) {
  try {
    await db.insert(auditLogs).values({
      actorUid,
      actorEmail,
      action,
      targetType,
      targetId: targetId ?? null,
      details: details ?? null,
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

export {
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
  memberFollowups,
  members,
  ministries,
  newsPosts,
  prayerFollowups,
  prayerRequests,
  sermons,
  testimonies,
  users,
  visitors,
};
