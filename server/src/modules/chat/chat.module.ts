import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from '../user/users.module';
import {AuthModule} from "../auth/auth.module";

@Module({
    imports: [UsersModule, AuthModule],
    providers: [ChatGateway],
})
export class ChatModule {}
