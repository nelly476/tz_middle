import { useState } from 'react';
import { register, login } from '../api/auth';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      await register({ username, password });
      const res = await login({ username, password });
      sessionStorage.setItem('access_token', res.data.access_token);
      sessionStorage.setItem('refresh_token', res.data.refresh_token);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('user_id', res.data.userId);
      navigate('/chat');
    } catch (err) {
      alert('Ошибка регистрации. Попробуйте другое имя пользователя.');
      console.log(err)
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} autoComplete="on">
      <h1>Register</h1>
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
        autoComplete="new-password"
      />
      <button type="submit">Register</button>
      <p>Уже есть аккаунт? <a href="/login">Войти</a></p>
      <br />
    </form>
  );
}