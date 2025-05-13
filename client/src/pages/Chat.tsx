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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const lastSentTimestamp = useRef<number | null>(null);
  const navigate = useNavigate();
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const id = sessionStorage.getItem('user_id');
  const name = sessionStorage.getItem('username');

  if (!id || !name) {
    console.warn('Нет user_id или username в sessionStorage');
    navigate('/login'); // защита от доступа до входа
    return;
  }

  setCurrentUserId(id);
  setCurrentUsername(name);

  socket.connect();

  socket.emit('join_room', { room: 'general' });
    setCurrentUserId(id);
    setCurrentUsername(name);
    socket.connect();
     

    socket.on('room_message', (msg: Message) => {
      if (!msg.to && msg.timestamp !== lastSentTimestamp.current) {
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
        const refreshToken = sessionStorage.getItem('refresh_token');
        const res = await fetch('http://localhost:3000/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        const data = await res.json();

        if (data.access_token) {
          sessionStorage.setItem('access_token', data.access_token);
          socket.io.opts.extraHeaders = {
            Authorization: `Bearer ${data.access_token}`
          };
          socket.disconnect();
          socket.connect();
        } else {
          sessionStorage.clear();
          navigate('/register');
        }
      }
    });

    socket.emit('join_room', { room: 'general' });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

 const sendMessage = () => {
  if (text.trim() && currentUserId && currentUsername) {
    const timestamp = Date.now();
    lastSentTimestamp.current = timestamp;

    const message: Message = {
      from: currentUserId,
      fromUsername: currentUsername,
      text,
      to: selectedUserId || null,
      room: selectedUserId ? undefined : 'general',
      timestamp,
    };

    socket.emit('message', message);
    setText('');
  }
};


  const getSenderName = (fromId: string) => {
    const user = users.find((u) => u.userId === fromId);
    return user?.username || `Пользователь ${fromId}`;
  };

  const getRecipientName = () => {
    const user = users.find(u => u.userId === selectedUserId);
    return user ? user.username : 'неизвестно';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const onlineUsers = users.filter(u => u.userId !== currentUserId);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: '200px', background: '#f4f4f4', borderRight: '1px solid #ddd', padding: '10px' }}>
        <h3>Онлайн</h3>
        <div style={{ padding: '5px 0' }}>
          <div><strong>{currentUsername}</strong> (Вы)</div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {onlineUsers.map((u) => (
            <li key={u.userId}>{u.username}</li>
          ))}
        </ul>
        <button
          style={{ marginTop: '20px', padding: '8px 12px' }}
          onClick={() => {
            sessionStorage.clear();
            window.location.href = '/login';
          }}
        >
          Выйти
        </button>
      </div>
      <div style={{ width: '200px', background: '#f0f0f0', borderRight: '1px solid #ddd', padding: '10px' }}>
        <h3>Чаты</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li
            style={{ padding: '8px', background: selectedUserId === null ? '#ddd' : 'transparent', cursor: 'pointer' }}
            onClick={() => setSelectedUserId(null)}
          >
            Общий чат
          </li>
        </ul>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#fafafa' }}>
          <h2 style={{ margin: 0 }}>
            {selectedUserId ? `Приватный чат с ${getRecipientName()}` : 'Общий чат'}
          </h2>
        </div> */}
        <div
          ref={chatRef}
          style={{ flex: 1, overflowY: 'auto', padding: '10px', background: '#fff' }}
        >
          {messages
            .filter((msg) => {
              if (selectedUserId) {
                return (
                  (msg.to === selectedUserId && msg.from === currentUserId) ||
                  (msg.from === selectedUserId && msg.to === currentUserId)
                );
              } else {
                return !msg.to && msg.room === 'general';
              }
            })
            .map((msg, i) => (
              <div key={`msg-${msg.timestamp}-${i}`} style={{ marginBottom: '10px' }}>
                <strong>{getSenderName(msg.from)}:</strong> {msg.text}
                <span style={{ marginLeft: '10px', fontSize: '0.85em', color: '#888' }}>{formatTime(msg.timestamp)}</span>
              </div>
            ))}
        </div>
        <div style={{ display: 'flex', padding: '10px', borderTop: '1px solid #ccc' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Напишите сообщение..."
            style={{ flex: 1, padding: '10px', marginRight: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <button onClick={sendMessage} style={{ padding: '10px 20px' }}>Отправить</button>
        </div>
      </div>
    </div>
  );
}




