import { useEffect, useState, useRef } from 'react';
import socket from '../socket/socket';
import { useNavigate } from 'react-router-dom';

interface Message {
  from: string;
  text: string;
  room?: string;
  to?: string;
  fromUsername?: string;
  timestamp: number;
}

interface User {
  userId: string;
  username: string;
  typing: boolean;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const lastSentTimestamp = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    socket.connect();

    socket.on('room_message', (msg: Message) => {
      if (msg.timestamp !== lastSentTimestamp.current) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on('private_message', (msg: Message) => {
      if (msg.timestamp !== lastSentTimestamp.current) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on('message_history', (history: Message[]) => {
      setMessages(history);
    });

    socket.on('user_list', (list: User[]) => {
      setUsers(list);
    });

    socket.on('auth_error', async (err) => {
      if (err === 'jwt expired') {
        const refreshToken = localStorage.getItem('refresh_token');
        const res = await fetch('http://localhost:3000/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        const data = await res.json();

        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
          socket.io.opts.extraHeaders = {
            Authorization: `Bearer ${data.access_token}`
          };
          socket.disconnect();
          socket.connect();
        } else {
          localStorage.clear();
          navigate('/register');
        }
      }
    });

    socket.emit('join_room', { room: 'general' });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  const sendMessage = () => {
    if (text.trim()) {
      const timestamp = Date.now();
      lastSentTimestamp.current = timestamp;
      socket.emit('message', {
        text,
        to: selectedUserId || null,
        room: selectedUserId ? undefined : 'general',
        timestamp,
      });
      setText('');
    }
  };

  const getSenderName = (fromId: string) => {
    const user = users.find((u) => u.userId === fromId);
    return fromId === localStorage.getItem('user_id')
      ? 'Вы'
      : user?.username || `Пользователь ${fromId}`;
  };

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: '200px', borderRight: '1px solid gray', padding: '10px' }}>
        <h3>Онлайн</h3>
        <ul>
          {users.map((u) => {
            const isSelf = u.userId === localStorage.getItem('user_id');
            return (
              <li
                key={u.userId}
                style={{
                  cursor: 'pointer',
                  fontWeight: selectedUserId === u.userId ? 'bold' : 'normal'
                }}
                onClick={() => setSelectedUserId(u.userId)}
              >
                {isSelf ? 'Вы' : u.username} {u.typing && '✍️'}
              </li>
            );
          })}
          <li
            style={{
              cursor: 'pointer',
              fontWeight: selectedUserId === null ? 'bold' : 'normal'
            }}
            onClick={() => setSelectedUserId(null)}
          >
            🌍 Общий чат
          </li>
        </ul>
      </div>
      <div style={{ flex: 1, padding: '10px' }}>
        <h1>{selectedUserId ? 'Приватный чат' : 'Общий чат'}</h1>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
        >
          Выйти
        </button>
        <div
          style={{
            height: '400px',
            overflowY: 'auto',
            border: '1px solid #ccc',
            marginBottom: '10px',
            padding: '10px'
          }}
        >
          {messages.map((msg, i) => (
            <div key={`message-${msg.timestamp}-${i}`}>
              <strong>{getSenderName(msg.from)}</strong>: {msg.text}
            </div>
          ))}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}