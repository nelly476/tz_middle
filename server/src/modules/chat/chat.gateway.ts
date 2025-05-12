import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../user/users.service';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

interface ChatMessage {
    text: string;
    to: string | null;
    room?: string;
}

interface ConnectedUser {
    socketId: string;
    userId: string;
    username: string;
    lastMessageTimestamp: number;
    currentRoom: string;
    typing: boolean;
}

interface Message {
    from: string;
    to: string | null;
    text: string;
    timestamp: number;
    room?: string;
    delivered?: boolean;
    fromUsername: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization'],
        credentials: true,
    },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private logger = new Logger(ChatGateway.name);

    private users: Map<string, ConnectedUser> = new Map();
    private messageHistory: Map<string, Message[]> = new Map(); // Key: room name
    private privateMessages: Map<string, Message[]> = new Map(); // Key: `${userId1}-${userId2}`
    private readonly PAGE_SIZE = 50;
    private readonly MESSAGE_RATE_LIMIT = 10;
    private readonly RATE_LIMIT_WINDOW_MS = 1000;
    private readonly TYPING_STATUS_DELAY = 2000;

    constructor(
      private readonly usersService: UsersService,
      private readonly jwtService: JwtService,
    ) {}

    async handleConnection(client: Socket) {
        try {
            const token = this.getTokenFromSocket(client);
            const { user, currentRoom } = await this.authenticateUser(token, client);

            this.setupUser(client, user, currentRoom);
            this.sendInitialData(client, user, currentRoom);

            this.logger.log(`User connected: ${user.username} (${user.id}) to room ${currentRoom}`);
            this.broadcastUserList(currentRoom);

        } catch (err) {
            this.handleConnectionError(client, err);
        }
    }

    handleDisconnect(client: Socket) {
        const user = this.users.get(client.id);
        if (user) {
            this.logger.log(`User disconnected: ${user.username} (${user.userId})`);
            this.users.delete(client.id);
            this.broadcastUserList(user.currentRoom);
            this.clearTypingStatus(user);
        }
    }

    @SubscribeMessage('message')
    async handleMessage(@MessageBody() data: ChatMessage, @ConnectedSocket() client: Socket) {
        const user = this.users.get(client.id);
        if (!user) return this.sendError(client, 'Unauthorized');

        if (!this.checkRateLimit(user)) return this.sendError(client, 'Rate limit exceeded');
        if (!this.validateMessage(data)) return this.sendError(client, 'Invalid message');

        const message = this.createMessage(user, data);
        await this.handleMessageDelivery(message, client);
    }

    @SubscribeMessage('typing')
    handleTyping(@MessageBody() data: { isTyping: boolean }, @ConnectedSocket() client: Socket) {
        const user = this.users.get(client.id);
        if (!user) return;

        user.typing = data.isTyping;
        this.server.to(user.currentRoom).emit('typing', {
            userId: user.userId,
            username: user.username,
            isTyping: data.isTyping
        });

        if (data.isTyping) {
            setTimeout(() => {
                if (user.typing) {
                    user.typing = false;
                    this.server.to(user.currentRoom).emit('typing', {
                        userId: user.userId,
                        username: user.username,
                        isTyping: false
                    });
                }
            }, this.TYPING_STATUS_DELAY);
        }
    }

    @SubscribeMessage('join_room')
    handleJoinRoom(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
        const user = this.users.get(client.id);
        if (!user) return;

        client.leave(user.currentRoom);
        user.currentRoom = data.room;
        client.join(data.room);

        this.sendRoomHistory(client, data.room);
        this.broadcastUserList(data.room);
    }

    private getTokenFromSocket(client: Socket): string {
        const authHeader = client.handshake.headers['authorization'];
        return authHeader?.startsWith('Bearer ')
          ? authHeader.split(' ')[1]
          : client.handshake.auth.token;
    }

    private async authenticateUser(token: string, client: Socket) {
        const payload = this.jwtService.verify(token, { secret: 'SECRET' });
        const user = await this.usersService.findById(payload.sub);
        if (!user) throw new Error('User not found');

        return {
            user,
            currentRoom: client.handshake.query.room?.toString() || 'general'
        };
    }

    private setupUser(client: Socket, user: any, currentRoom: string) {
        this.users.set(client.id, {
            socketId: client.id,
            userId: user.id,
            username: user.username,
            lastMessageTimestamp: 0,
            currentRoom,
            typing: false
        });
        client.join(currentRoom);
    }

    private sendInitialData(client: Socket, user: any, currentRoom: string) {

        this.sendRoomHistory(client, currentRoom);

        const undelivered = [...this.privateMessages.values()]
          .flat()
          .filter(m => m.to === user.id && !m.delivered);

        undelivered.forEach(msg => {
            msg.delivered = true;
            client.emit('private_message', msg);
        });
    }

    private sendRoomHistory(client: Socket, room: string) {
        const messages = this.messageHistory.get(room)?.slice(-this.PAGE_SIZE) || [];
        client.emit('message_history', messages);
    }

    private createMessage(user: ConnectedUser, data: ChatMessage): Message {
        return {
            from: user.userId,
            to: data.to,
            text: data.text.trim(),
            timestamp: Date.now(),
            room: data.room || user.currentRoom,
            delivered: false,
            fromUsername: user.username,
        };
    }

    private async handleMessageDelivery(message: Message, client: Socket) {
        if (message.to) {
            this.handlePrivateMessage(message, client);
        } else {
            this.handleRoomMessage(message);
        }
    }

    private handlePrivateMessage(message: Message, client: Socket) {
        const [user1, user2] = [message.from, message.to].sort();
        const key = `${user1}-${user2}`;

        if (!this.privateMessages.has(key)) {
            this.privateMessages.set(key, []);
        }
        this.privateMessages.get(key)?.push(message);

        const recipient = [...this.users.values()].find(u => u.userId === message.to);
        if (recipient) {
            message.delivered = true;
            this.server.to(recipient.socketId).emit('private_message', message);
        }

        client.emit('private_message', message);
    }

    private handleRoomMessage(message: Message) {
        const room = message.room || 'general';

        let roomMessages = this.messageHistory.get(room) || [];

        roomMessages.push(message);

        this.messageHistory.set(room, roomMessages);

        if (roomMessages.length > 1000) {
            roomMessages.shift();
        }

        this.server.to(room).emit('room_message', message);
    }

    private validateMessage(data: ChatMessage): boolean {
        return typeof data.text === 'string' &&
          data.text.trim().length > 0 &&
          data.text.length <= 2000;
    }

    private checkRateLimit(user: ConnectedUser): boolean {
        const now = Date.now();
        const timeWindow = now - this.RATE_LIMIT_WINDOW_MS;
        return (now - user.lastMessageTimestamp) > (this.RATE_LIMIT_WINDOW_MS / this.MESSAGE_RATE_LIMIT);
    }

    private broadcastUserList(room: string) {
        const users = [...this.users.values()]
          .filter(u => u.currentRoom === room)
          .map(u => ({
              userId: u.userId,
              username: u.username,
              typing: u.typing
          }));

        this.server.to(room).emit('user_list', users);
    }

    private clearTypingStatus(user: ConnectedUser) {
        if (user.typing) {
            this.server.to(user.currentRoom).emit('typing', {
                userId: user.userId,
                username: user.username,
                isTyping: false
            });
        }
    }

    private sendError(client: Socket, message: string) {
        client.emit('error', { message, timestamp: Date.now() });
    }

    private handleConnectionError(client: Socket, error: Error) {
        this.logger.error('Connection error:', error);
        client.emit('auth_error', error.message);
        client.disconnect();
    }
}