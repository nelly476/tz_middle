import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../user/users.service';
import {ApiOperation, ApiProperty, ApiResponse, ApiTags} from "@nestjs/swagger";

class RegisterDto {
    @ApiProperty({ example: 'ivan', description: 'Имя пользователя' })
    username: string;

    @ApiProperty({ example: 'strongPassword123', description: 'Пароль' })
    password: string;
}

class LoginDto {
    @ApiProperty({ example: 'ivan', description: 'Имя пользователя' })
    username: string;

    @ApiProperty({ example: 'strongPassword123', description: 'Пароль' })
    password: string;
}
@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService, private usersService: UsersService) {}

    @Post('register')
    @ApiOperation({ summary: 'Регистрация пользователя' })
    @ApiResponse({ status: 201, description: 'Пользователь успешно зарегистрирован' })
    @ApiResponse({ status: 401, description: 'Имя пользователя уже занято' })
    async register(@Body() dto: RegisterDto) {
        const existing = await this.usersService.findByUsername(dto.username);
        if (existing) {
            throw new UnauthorizedException('Username already exists');
        }
        const user = await this.usersService.createUser(dto.username, dto.password);
        return { id: user.id, username: user.username };
    }

    @Post('login')
    @ApiOperation({ summary: 'Авторизация пользователя' })
    @ApiResponse({ status: 200, description: 'Токен авторизации' })
    @ApiResponse({ status: 401, description: 'Неверные учетные данные' })
    async login(@Body() dto: LoginDto) {
        const user = await this.authService.validateUser(dto.username, dto.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user);
    }
}
