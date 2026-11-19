import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing.length > 0) {
      const current = existing[0];
      const isMgmtPortal = uid === 'gvcc-management-portal';
      const updated = await db
        .update(users)
        .set({
          email: email || current.email,
          fullName: fullName && current.fullName === 'GVCC Staff' ? fullName : current.fullName,
          role: isMgmtPortal ? 'super_admin' : current.role,
          accountStatus: isMgmtPortal ? 'active' : current.accountStatus,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    const totalUsers = await db.select({ value: count() }).from(users);
    const isFirstUser = Number(totalUsers[0]?.value ?? 0) === 0;
    const isPrimaryOwner =
      email.toLowerCase() === 'kingboysammy5@gmail.com' || uid === 'gvcc-management-portal';
    const initialRole = isFirstUser || isPrimaryOwner ? 'super_admin' : 'member';

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0] || 'GVCC User',
        role: initialRole,
        permissions: [],
        accountStatus: 'active',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getAllStaffUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database error in getAllStaffUsers:', error);
    throw new Error('Failed to load staff users.', { cause: error });
  }
}
