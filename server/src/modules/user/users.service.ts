import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../db/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
    constructor(@InjectRepository(User) private repo: Repository<User>) {}

    async createUser(username: string, password: string): Promise<User> {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = this.repo.create({ username, passwordHash });
        return this.repo.save(user);
    }

    async findByUsername(username: string): Promise<User | null> {
        return this.repo.findOne({ where: { username } });
    }

    async validateUser(username: string, password: string): Promise<User | null> {
        const user = await this.findByUsername(username);
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        return valid ? user : null;
    }

    async findById(id: string): Promise<User | null> {
        return this.repo.findOne({ where: { id } });
    }
}
