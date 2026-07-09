import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { EmailService } from '../email/email.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Arbitrary fixed key for a Postgres advisory lock — only ever contended
// during the brief window before the platform has its first user.
const BOOTSTRAP_ADVISORY_LOCK_KEY = 918273645;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto, role: UserRole = UserRole.ADMIN) {
    // Check if user already exists
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      email: dto.email,
      passwordHash,
      role,
    });
    await this.usersRepo.save(user);

    return { message: 'User created successfully', id: user.id };
  }

  /**
   * Public self-serve signup. The very first account ever created becomes
   * SUPER_ADMIN (bootstrap); every account after that is a regular ADMIN with
   * its own isolated set of bots (BotService already scopes everything by
   * userId). Logs the new user in immediately, same shape as login().
   */
  async registerSelfServe(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Only the empty-table "who becomes SUPER_ADMIN" moment needs
    // serializing — skip the advisory lock entirely once the platform
    // already has its first user, so ordinary signups pay no extra cost.
    if ((await this.usersRepo.count()) === 0) {
      const user = await this.usersRepo.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_ADVISORY_LOCK_KEY]);
        const stillFirst = (await manager.count(User)) === 0;
        return manager.save(
          manager.create(User, {
            email: dto.email,
            passwordHash,
            role: stillFirst ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
          }),
        );
      });
      return this.signIn(user);
    }

    const user = this.usersRepo.create({ email: dto.email, passwordHash, role: UserRole.ADMIN });
    await this.usersRepo.save(user);
    return this.signIn(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signIn(user);
  }

  private signIn(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  /**
   * Always resolves the same way regardless of whether the email exists, to
   * avoid leaking which emails are registered.
   */
  async forgotPassword(email: string, frontendUrl: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');

    user.resetPasswordTokenHash = this.hashResetToken(token);
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.usersRepo.save(user);

    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetLink);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashResetToken(token);

    // An explicit `select` still returns select:false columns — filtering by
    // one via plain `where` works the same as any other column too, so this
    // no longer needs a QueryBuilder.
    const user = await this.usersRepo.findOne({
      where: { resetPasswordTokenHash: tokenHash },
      select: ['id', 'email', 'passwordHash', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'],
    });

    if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await this.usersRepo.save(user);
  }

  /** SHA-256 of a reset token — a fast, deterministic hash is fine here since the token itself is already high-entropy (crypto.randomBytes), unlike a user-chosen password. */
  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }
}
