import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    // Seed default super admin if no users exist
    const count = await this.usersRepo.count();
    if (count === 0) {
      console.log('🌱 Seeding initial super admin...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      const superAdmin = this.usersRepo.create({
        email: 'admin@admin.com',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
      });
      await this.usersRepo.save(superAdmin);
      console.log('✅ Super admin created: admin@admin.com / admin123');
    }
  }

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

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }
}
