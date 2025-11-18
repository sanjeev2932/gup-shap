import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // landing uses light mode
    document.body.classList.remove("dark-meeting");
    document.body.classList.add("light-mode");
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b">
        <div className="text-xl font-semibold">Gup-Shap</div>
        <nav className="space-x-6 text-sm">
          <button
            onClick={() => navigate("/auth")}
            className="text-gray-700 hover:text-gray-900"
          >
            Register / Login
          </button>
        </nav>
      </header>

      <main className="flex-1 container mx-auto px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl font-extrabold mb-4">
              <span className="text-orange-500">Connect</span> with your loved Ones
            </h1>
            <p className="text-gray-700 mb-6">
              Cover the distance with Gup-Shap — fast, lightweight video calls.
            </p>
            <div className="flex gap-4">
              <Link to="/auth" className="btn">Get Started</Link>
              <button
                onClick={() => navigate("/home")}
                className="px-4 py-2 rounded-md border border-gray-200"
              >
                Join existing
              </button>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <img alt="mobile preview" src="/mobile.png" className="w-80 hidden md:block" />
          </div>
        </div>
      </main>
    </div>
  );
}
