import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

const PORTAL_TOKEN_PREFIX = 'gvcc-portal-v1.';

function getPortalSecret(): string {
  return process.env.ADMIN_TOKEN_SECRET || process.env.SQL_PASSWORD || 'gvcc-ogembo-management-secret';
}

export function verifyManagementPasscode(passcode: string): boolean {
  const expected = process.env.ADMIN_PORTAL_PASSCODE || '1234';
  const a = Buffer.from(String(passcode ?? ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issuePortalToken(uid: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getPortalSecret()).update(payload).digest('base64url');
  return `${PORTAL_TOKEN_PREFIX}${payload}.${sig}`;
}

export function verifyPortalToken(token: string): { uid: string; email: string } | null {
  if (!token.startsWith(PORTAL_TOKEN_PREFIX)) return null;
  const rest = token.slice(PORTAL_TOKEN_PREFIX.length);
  const parts = rest.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getPortalSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.uid || !decoded.email || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return { uid: String(decoded.uid), email: String(decoded.email) };
  } catch {
    return null;
  }
}

export interface AppUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  assignedFellowshipId: number | null;
  accountStatus: string;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  appUser?: AppUser;
}

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'members.view', 'members.create', 'members.edit', 'members.archive',
    'visitors.view', 'visitors.followup',
    'prayer.view', 'prayer.assign', 'prayer.update',
    'testimonies.moderate',
    'events.create', 'events.publish',
    'news.create', 'news.publish', 'devotionals.manage',
    'giving.view', 'giving.manage',
    'rosters.view', 'rosters.manage',
    'assets.view', 'assets.manage',
    'gallery.upload', 'gallery.delete',
    'fellowships.manage', 'ministries.manage', 'leadership.manage',
    'sermons.manage', 'slideshow.manage', 'settings.manage',
    'admins.manage', 'reports.export', 'audit.view',
  ],
  church_admin: [
    'members.view', 'members.create', 'members.edit', 'members.archive',
    'visitors.view', 'visitors.followup',
    'testimonies.moderate',
    'events.create', 'events.publish',
    'news.create', 'news.publish', 'devotionals.manage',
    'giving.view', 'giving.manage',
    'rosters.view', 'rosters.manage',
    'assets.view', 'assets.manage',
    'gallery.upload', 'fellowships.manage', 'ministries.manage',
    'leadership.manage', 'reports.export',
  ],
  pastor: [
    'members.view', 'visitors.view', 'visitors.followup',
    'prayer.view', 'prayer.assign', 'prayer.update',
    'testimonies.moderate',
    'news.create', 'news.publish', 'devotionals.manage',
    'giving.view', 'rosters.view', 'rosters.manage',
    'assets.view', 'sermons.manage', 'reports.export',
  ],
  fellowship_leader: [
    'fellowships.manage', 'members.view', 'devotionals.manage', 'rosters.view',
  ],
  media_admin: [
    'gallery.upload', 'gallery.delete', 'sermons.manage',
    'slideshow.manage', 'news.create', 'news.publish', 'devotionals.manage',
    'testimonies.moderate',
  ],
  prayer_team: [
    'prayer.view', 'prayer.update', 'testimonies.moderate',
  ],
  member: [],
};

export function hasPermission(user: AppUser | undefined, perm: string): boolean {
  if (!user || user.accountStatus !== 'active') return false;
  if (user.role === 'super_admin') return true;
  const rolePerms = ROLE_DEFAULT_PERMISSIONS[user.role] || [];
  return rolePerms.includes(perm) || (user.permissions || []).includes(perm);
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Check signed management passcode session token
  if (token.startsWith(PORTAL_TOKEN_PREFIX)) {
    const portalClaim = verifyPortalToken(token);
    if (!portalClaim) {
      return res.status(401).json({ error: 'Unauthorized: Management session expired or invalid' });
    }
    try {
      const appUser = await getOrCreateUser(portalClaim.uid, portalClaim.email, 'GVCC Management');
      req.appUser = {
        id: appUser.id,
        uid: appUser.uid,
        email: appUser.email,
        fullName: appUser.fullName,
        role: appUser.role,
        permissions: appUser.permissions || [],
        assignedFellowshipId: appUser.assignedFellowshipId ?? null,
        accountStatus: appUser.accountStatus,
      };
      return next();
    } catch (error) {
      console.error('Error syncing management portal user:', error);
      return res.status(500).json({ error: 'Failed to load management profile' });
    }
  }

  // 2. Otherwise verify Firebase ID token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = decodedToken.email || '';
    const name = (decodedToken.name as string | undefined) || email.split('@')[0] || 'GVCC User';
    const appUser = await getOrCreateUser(decodedToken.uid, email, name);
    req.appUser = {
      id: appUser.id,
      uid: appUser.uid,
      email: appUser.email,
      fullName: appUser.fullName,
      role: appUser.role,
      permissions: appUser.permissions || [],
      assignedFellowshipId: appUser.assignedFellowshipId ?? null,
      accountStatus: appUser.accountStatus,
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireStaff = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.appUser || req.appUser.role === 'member' || req.appUser.accountStatus !== 'active') {
    return res.status(403).json({ error: 'Forbidden: Staff or Administrator privileges required' });
  }
  next();
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!hasPermission(req.appUser, permission)) {
      return res.status(403).json({ error: `Forbidden: Missing required permission (${permission})` });
    }
    next();
  };
};
