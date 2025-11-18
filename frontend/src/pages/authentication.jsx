import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/*
  Simple combined Sign In / Sign Up page.
  Uses fetch to /api/auth endpoints if you have them; if not it still shows UI.
  Replace fetch URLs if backend path differs.
*/

export default function Authentication() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin"); // signin or signup
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.body.classList.remove("dark-meeting");
    document.body.classList.add("light-mode");
  }, []);

  const trySignIn = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const t = await res.json().catch(()=>null);
        setMsg(t?.message || "Login failed");
        return;
      }
      const data = await res.json();
      localStorage.setItem("token", data.token || "");
      navigate("/home");
    } catch (e) {
      setMsg("Network error");
    }
  };

  const tryRegister = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      });
      if (!res.ok) {
        const t = await res.json().catch(()=>null);
        setMsg(t?.message || "Register failed");
        return;
      }
      setMsg("Registered. You can sign in now.");
      setMode("signin");
    } catch (e) {
      setMsg("Network error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 center-card rounded-xl bg-white shadow-lg">
        <div className="flex justify-center gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${mode === "signin" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() => setMode("signin")}
          >
            SIGN IN
          </button>
          <button
            className={`px-4 py-2 rounded ${mode === "signup" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() => setMode("signup")}
          >
            SIGN UP
          </button>
        </div>

        {msg && (
          <div className="mb-4 text-sm text-red-600">
            {msg}
          </div>
        )}

        <div className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm text-gray-700">Name *</label>
              <input className="input-default" value={name} onChange={e=>setName(e.target.value)} />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700">Username *</label>
            <input className="input-default" value={username} onChange={e=>setUsername(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Password *</label>
            <input type="password" className="input-default" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            {mode === "signin" ? (
              <button className="btn" onClick={trySignIn}>LOGIN</button>
            ) : (
              <button className="btn" onClick={tryRegister}>REGISTER</button>
            )}

            <div>
              <button className="text-sm text-gray-500" onClick={()=>navigate("/")}>Back</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
