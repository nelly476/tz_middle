import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const isAuthenticated = !!sessionStorage.getItem('access_token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/chat"
          element={
            isAuthenticated ? <Chat /> : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}