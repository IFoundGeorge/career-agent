"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // user effect intentionally left blank – we no longer redirect automatically
  // when a user is already authenticated. Navigation to the dashboard is disabled.
  useEffect(() => {
    // no-op
  }, [user, router]);

  function handleSubmit(e) {
    e.preventDefault();
    login({ email, password });
    // intentionally not navigating to the dashboard after login
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0049AF] via-[#003d95] to-[#002d6b] relative overflow-hidden px-6 py-8">

      {/* Animated decorative shapes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#F29035]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#F29035]/5 rounded-full blur-2xl" />

      {/* login card */}
      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl p-10 rounded-2xl shadow-2xl border border-white/20">
        
        {/* Logo/Header area */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#F29035] rounded-xl mb-4 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V5a3 3 0 00-6 0v3c0 1.657 1.343 3 3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11h14v10H5z" /></svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">HR Portal</h1>
          <p className="text-white/70 text-sm">Welcome back! Please log in to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div className="relative group">
            <label htmlFor="email" className="block text-white/80 text-sm font-medium mb-2">Email Address</label>
            <span className="absolute left-4 top-[calc(50%+0.5rem)] -translate-y-1/2 text-white/60 group-focus-within:text-[#F29035] transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <input
              id="email"
              type="email"
              required
              autoFocus
              placeholder="your.email@company.com"
              aria-label="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/10 border-2 border-white/30 placeholder-white/40 text-white transition-all focus:outline-none focus:border-[#F29035] focus:bg-white/15 focus:shadow-lg focus:shadow-[#F29035]/20 hover:border-white/50"
            />
          </div>

          {/* Password Input */}
          <div className="relative group">
            <label htmlFor="password" className="block text-white/80 text-sm font-medium mb-2">Password</label>
            <span className="absolute left-4 top-[calc(50%+0.5rem)] -translate-y-1/2 text-white/60 group-focus-within:text-[#F29035] transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V5a3 3 0 00-6 0v3c0 1.657 1.343 3 3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11h14v10H5z" /></svg>
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Enter your password"
              aria-label="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 pl-12 pr-12 rounded-xl bg-white/10 border-2 border-white/30 placeholder-white/40 text-white transition-all focus:outline-none focus:border-[#F29035] focus:bg-white/15 focus:shadow-lg focus:shadow-[#F29035]/20 hover:border-white/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-[calc(50%+0.5rem)] -translate-y-1/2 text-white/60 hover:text-white transition"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#F29035] to-[#e67e22] text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-[#F29035]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 mt-6 tracking-wide"
          >
            Sign In
          </button>
        </form>

        {/* Forgot Password Link */}
        <Link
          href="/forgot-password"
          className="block mt-6 text-center text-white/70 text-sm hover:text-[#F29035] transition font-medium"
        >
          Forgot your password?
        </Link>
      </div>

      {/* Custom Tailwind Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.9; }
        }

        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
