import React, { createContext, useState, useEffect } from 'react';
import api, { setToken } from './api/api';

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=> {
    const token = localStorage.getItem('zaad_token');
    if (!token) { setLoading(false); return; }
    // fetch /auth/me
    api.get('/auth/me').then(res => {
      setUser(res.data.user);
    }).catch(err => {
      console.warn('auth me failed', err);
      setToken(null);
      setUser(null);
    }).finally(()=> setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const token = res.data.token;
    setToken(token);
    const user = res.data.user;
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    const token = res.data.token;
    setToken(token);
    const user = res.data.user;
    setUser(user);
    return user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, register }}>{children}</AuthContext.Provider>
}
