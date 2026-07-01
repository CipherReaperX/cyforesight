import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, desc } from 'drizzle-orm';
import db from '../config/database';
import { users, refreshTokens } from '../models/schema';
import logger from '../config/logger';

export class AuthService {
  async login(username: string, password: string, ipAddress: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) throw new Error('Invalid credentials');
    if (!user.isActive) throw new Error('Account is disabled');
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date())
      throw new Error('Account is locked. Try again later');

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
      await db.update(users)
        .set({
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: newFailedAttempts >= 5
            ? new Date(Date.now() + 30 * 60 * 1000)
            : user.lockedUntil,
        })
        .where(eq(users.id, user.id));
      throw new Error('Invalid credentials');
    }

    await db.update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      })
      .where(eq(users.id, user.id));

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    const jwtExpiry = (process.env.JWT_EXPIRY as jwt.SignOptions['expiresIn']) || '24h';
    const refreshExpiry = (process.env.REFRESH_TOKEN_EXPIRY as jwt.SignOptions['expiresIn']) || '7d';

    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    const token = jwt.sign(payload, secret, { expiresIn: jwtExpiry });
    const refreshToken = jwt.sign({ userId: user.id }, secret, { expiresIn: refreshExpiry });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    logger.info(`User logged in: ${username} from ${ipAddress}`);

    return {
      token,
      refreshToken,
      expiresIn: 86400,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordHash: false },
    });

    if (!user) throw new Error('User not found');
    return user;
  }

  async listUsers() {
    return db.query.users.findMany({
      columns: { passwordHash: false },
      orderBy: [desc(users.createdAt)],
    });
  }

  async createUser(input: {
    username: string;
    email: string;
    password: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  }) {
    const existing = await db.query.users.findFirst({ where: eq(users.username, input.username) });
    if (existing) throw new Error('Username already exists');

    const emailExists = await db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (emailExists) throw new Error('Email already exists');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const [user] = await db.insert(users).values({
      username: input.username,
      email: input.email,
      passwordHash,
      role: (input.role || 'analyst') as any,
      firstName: input.firstName,
      lastName: input.lastName,
    }).returning({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

    logger.info(`User created: ${input.username}`);
    return user;
  }

  async updateUser(targetUserId: string, updates: { role?: string; isActive?: boolean }) {
    const set: Record<string, any> = { updatedAt: new Date() };
    if (updates.role !== undefined) set.role = updates.role;
    if (updates.isActive !== undefined) set.isActive = updates.isActive;

    const [user] = await db.update(users)
      .set(set)
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      });

    if (!user) throw new Error('User not found');
    return user;
  }

  async deleteUser(targetUserId: string) {
    const existing = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!existing) throw new Error('User not found');
    await db.delete(users).where(eq(users.id, targetUserId));
    logger.info(`User deleted: ${existing.username}`);
  }

  async resetPassword(targetUserId: string, newPassword: string) {
    const existing = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!existing) throw new Error('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(users)
      .set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));
    logger.info(`Password reset by admin for user: ${existing.username}`);
  }

  async getLoginAudit() {
    const rows = await db.query.users.findMany({
      columns: {
        id: true,
        username: true,
        email: true,
        role: true,
        lastLogin: true,
        isActive: true,
        failedLoginAttempts: true,
      },
      orderBy: [desc(users.lastLogin)],
      limit: 20,
    });
    return rows;
  }

  async refreshAccessToken(rawRefreshToken: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    let decoded: any;
    try {
      decoded = jwt.verify(rawRefreshToken, secret) as any;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    // Refresh tokens only carry userId (not username) – reject access tokens used here
    if (!decoded.userId || decoded.username) throw new Error('Invalid token type');

    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.userId) });
    if (!user || !user.isActive) throw new Error('User not found or disabled');

    const jwtExpiry = (process.env.JWT_EXPIRY as jwt.SignOptions['expiresIn']) || '7d';
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email, role: user.role, permissions: user.permissions },
      secret,
      { expiresIn: jwtExpiry }
    );

    return { token, user: { id: user.id, username: user.username, email: user.email, role: user.role } };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new Error('User not found');

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) throw new Error('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));

    logger.info(`Password changed for user: ${user.username}`);
  }
}

export default new AuthService();
