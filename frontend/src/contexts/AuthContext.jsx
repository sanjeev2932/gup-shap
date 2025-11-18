// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useEffect, useState } from "react";
import server from "../environment";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  const login = async (username, password) => {
    try {
      const res = await fetch(`${server}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const j = await res.json();
      if (res.ok && j.token) {
        setToken(j.token);
        setUser({ username });
        localStorage.setItem("user", JSON.stringify({ username }));
        return { ok: true };
      } else return { ok: false, message: j.message || "Login failed" };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  };

  const register = async (name, username, password) => {
    try {
      const res = await fetch(`${server}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password })
      });
      const j = await res.json();
      if (res.ok) return { ok: true };
      return { ok: false, message: j.message || "Register failed" };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  };

  const addToUserHistory = async (meetingCode) => {
    if (!token) return;
    try {
      await fetch(`${server}/api/history/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ meeting_code: meetingCode })
      });
    } catch (e) { /* ignore */ }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, addToUserHistory }}>
      {children}
    </AuthContext.Provider>
  );
}
