import { Module } from '@nestjs/common';
import { ChatModule } from './modules/chat/chat.module';
import {TypeOrmModule, TypeOrmModuleOptions} from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from '@nestjs/config';
import {AuthController} from "./modules/auth/auth.controller";
import {AuthModule} from "./modules/auth/auth.module";
import {UsersModule} from "./modules/user/users.module";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        entities: ['./dist/db/entities/*.{ts,js}'],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
      ChatModule,
      AuthModule,
      UsersModule
  ],
  controllers: [AuthController],
})
export class AppModule {}