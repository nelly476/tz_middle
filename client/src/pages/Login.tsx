import { useState } from 'react';
import { login } from '../api/auth';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

const handleLogin = async () => {
  const res = await login({ username, password });
  sessionStorage.setItem('access_token', res.data.access_token);
  sessionStorage.setItem('refresh_token', res.data.refresh_token);
  sessionStorage.setItem('username', username);
  navigate('/chat');
};

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} autoComplete="on">
      <h1>Login</h1>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        name="username"
        autoComplete="username"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
        name="password"
        autoComplete="current-password"
      />
      <button type="submit">Login</button>
      <p>Нет аккаунта? <a href="/register">Зарегистрироваться</a></p>
    </form>
  );
}
