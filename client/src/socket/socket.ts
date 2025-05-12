import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  autoConnect: false,
  extraHeaders: {
    Authorization: `Bearer ${sessionStorage.getItem('access_token')}`
  },
});

export default socket;
