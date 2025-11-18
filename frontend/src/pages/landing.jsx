import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const router = useNavigate();
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center font-bold text-black">GS</div>
          <h2 className="text-xl font-semibold">Gup-Shap</h2>
        </div>

        <div className="flex items-center gap-4">
          <p className="cursor-pointer" onClick={() => router("/auth")}>Register / Login</p>
          <Link to="/auth" className="px-4 py-2 rounded-md btn-glow">Get Started</Link>
        </div>
      </nav>

      <main className="flex-1 container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <section>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
            Connect with your loved ones — <span className="text-brand.neon">fast</span>, <span className="text-brand.purple">secure</span>, and <span className="text-brand.accent">simple</span>.
          </h1>
          <p className="mt-4 text-slate-300 max-w-xl">Gup-Shap is a lightweight video conferencing app built for fast, low-latency calls. No installs, just open the link and join.</p>

          <div className="mt-6 flex gap-3">
            <Link to="/auth" className="px-4 py-2 rounded-md bg-white/5 border border-white/6">Login</Link>
            <button onClick={() => router("/aljk23")} className="px-5 py-2 rounded-md btn-glow">Join as Guest</button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="card p-4">
              <h4 className="font-bold">Low Latency</h4>
              <p className="text-xs text-slate-300">Optimized WebRTC connections.</p>
            </div>
            <div className="card p-4">
              <h4 className="font-bold">Secure</h4>
              <p className="text-xs text-slate-300">End-to-end style secure channels.</p>
            </div>
            <div className="card p-4">
              <h4 className="font-bold">No Install</h4>
              <p className="text-xs text-slate-300">Works in browser on desktop & mobile.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <img src="/mobile.png" alt="mobile preview" className="max-w-sm drop-shadow-xl" />
        </section>
      </main>

      <footer className="py-6 text-center text-slate-400">© {new Date().getFullYear()} Gup-Shap — Built for college projects</footer>
    </div>
  );
}
