// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect } from "react";
import axios from "axios";
import server from "../environment"; // normalized base, e.g. https://gup-shapbackend.onrender.com

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (e) {
      return null;
    }
  });

  // server => "https://host" ; we want "https://host/api/v1"
  const API = `${server}/api/v1`;

  // persist token
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // LOGIN
  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API}/users/login`, { username, password });
      if (res?.data?.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        return { ok: true };
      }
      return { ok: false, message: res?.data?.message || "Login failed" };
    } catch (err) {
      return {
        ok: false,
        message:
          err?.response?.data?.message || err.message || "Network error",
      };
    }
  };

  // REGISTER
  const register = async (name, username, password) => {
    try {
      const res = await axios.post(`${API}/users/register`, {
        name,
        username,
        password,
      });
      if (res?.data?.success) return { ok: true };
      return {
        ok: false,
        message: res?.data?.message || "Registration failed",
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err?.response?.data?.message || err.message || "Network error",
      };
    }
  };

  // ADD TO USER HISTORY
  // extra optional info can be passed in meta:
  // { hostName, participants, startedAt, endedAt, durationSeconds }
  const addToUserHistory = async (roomId, meta = {}) => {
    if (!token) return { ok: false, message: "Not authenticated" };
    try {
      await axios.post(
        `${API}/history/add`,
        { roomId, ...meta },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { ok: true };
    } catch (err) {
      console.log("History Add Error:", err?.response || err);
      return {
        ok: false,
        message:
          err?.response?.data?.message || err.message || "Failed",
      };
    }
  };

  // GET USER HISTORY
  const getUserHistory = async () => {
    if (!token) return [];
    try {
      const res = await axios.get(`${API}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res?.data?.history || [];
    } catch (err) {
      console.log("History Fetch Error:", err?.response || err);
      return [];
    }
  };

  // DELETE ONE HISTORY ITEM
  const deleteHistoryItem = async (id) => {
    if (!token) return { ok: false, message: "Not authenticated" };
    try {
      await axios.delete(`${API}/history/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err?.response?.data?.message || err.message || "Failed",
      };
    }
  };

  // BULK DELETE HISTORY
  const bulkDeleteHistory = async (ids) => {
    if (!token) return { ok: false, message: "Not authenticated" };
    try {
      await axios.post(
        `${API}/history/bulk-delete`,
        { ids },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err?.response?.data?.message || err.message || "Failed",
      };
    }
  };

  // LOGOUT
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        addToUserHistory,
        getUserHistory,
        deleteHistoryItem,
        bulkDeleteHistory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
