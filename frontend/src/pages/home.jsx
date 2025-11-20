import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  useEffect(() => {
    // UI mode
    document.body.classList.remove("dark-meeting");
    document.body.classList.add("light-mode");
  }, []);

  // -------------------------
  // JOIN WITH CODE
  // -------------------------
  const handleJoin = () => {
    if (!meetingCode.trim()) {
      alert("Please enter a meeting code.");
      return;
    }
    navigate(`/room/${meetingCode.trim()}`);
  };

  // -------------------------
  // CREATE NEW MEETING
  // -------------------------
  const createNew = () => {
    const rnd = Math.random().toString(36).slice(2, 9);
    navigate(`/room/${rnd}`);
  };

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 flex justify-between items-center border-b">
        <div className="font-semibold text-lg">Gup-Shap</div>

        <div className="flex items-center gap-4">
          <button
            className="text-gray-700"
            onClick={() => navigate("/history")}
          >
            History
          </button>

          <button
            className="btn"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/auth");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="container mx-auto px-8 py-24">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold mb-3">
              Providing Quality Video Calls
            </h2>
            <p className="text-gray-600 mb-6">
              Enter a meeting code or create a new one to start a call.
            </p>

            <div className="flex gap-3">
              <input
                className="input-default"
                placeholder="Meeting Code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
              />

              <button className="btn" onClick={handleJoin}>
                Join
              </button>

              <button
                className="px-3 py-2 rounded-md border border-gray-200"
                onClick={createNew}
              >
                New
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <img src="/mobile.png" className="w-64" alt="mobile preview" />
          </div>
        </div>
      </main>
    </div>
  );
}
