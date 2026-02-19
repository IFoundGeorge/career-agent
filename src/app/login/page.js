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

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  function handleSubmit(e) {
    e.preventDefault();
    login({ email, password });
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e6efff] via-white to-[#fff4ea] px-6">
      
      {/* MAIN CARD */}
      <div className="w-full max-w-6xl bg-white rounded-[32px] shadow-[0_40px_80px_-20px_rgba(0,73,175,0.25)] overflow-hidden flex">
        
        {/* LEFT SIDE */}
        <div className="flex-1 p-14">

          {/* HEADER */}
          <header className="flex items-center justify-between mb-16">
            <h2 className="text-2xl font-bold text-[#0049AF] tracking-tight">
             Aretex 
            </h2>

            <nav className="flex items-center gap-8 text-sm font-medium">
              <Link href="/" className="text-gray-500 hover:text-[#0049AF] transition">
                HOME
              </Link>
              <Link href="/about" className="text-gray-500 hover:text-[#0049AF] transition">
                ABOUT US
              </Link>
              <Link href="/contact" className="text-gray-500 hover:text-[#0049AF] transition">
                CONTACT
              </Link>
              <Link href="/login" className="text-[#0049AF] border-b-2 border-[#0049AF] pb-1">
                LOG IN
              </Link>
            </nav>
          </header>

          {/* TITLE */}
          <h1 className="text-4xl font-bold text-[#0049AF] mb-10 tracking-tight">
            Log in
          </h1>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-6 max-w-md">

            {/* EMAIL */}
            <input
              type="email"
              required
              placeholder="Username or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-5 rounded-full bg-gray-100 focus:bg-white border border-transparent focus:border-[#0049AF] focus:ring-4 focus:ring-[#0049AF]/20 outline-none transition-all"
            />

            {/* PASSWORD */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-5 pr-12 rounded-full bg-gray-100 focus:bg-white border border-transparent focus:border-[#0049AF] focus:ring-4 focus:ring-[#0049AF]/20 outline-none transition-all"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0049AF] transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* REMEMBER + FORGOT */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  className="accent-[#0049AF] w-4 h-4 rounded"
                />
                Remember me
              </label>

              <Link
                href="/forgot-password"
                className="text-gray-400 hover:text-[#F29035] transition"
              >
                Forgot Password?
              </Link>
            </div>

            {/* LOGIN BUTTON (Orange CTA) */}
            <button
              type="submit"
              className="w-full h-12 rounded-full bg-gradient-to-r from-[#F29035] to-[#e67e22] text-white font-medium tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Log in
            </button>

          </form>
        </div>

        {/* RIGHT SIDE HERO PANEL WITH ANIMATIONS */}
        <div className="hidden md:flex flex-1 relative bg-gradient-to-br from-[#0049AF] to-[#002d6b] flex-col justify-center items-center text-white p-16 overflow-hidden">

          {/* Animated Glows */}
          <div className="absolute top-20 right-20 w-64 h-64 bg-[#F29035]/30 rounded-[60px] rotate-45 blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-white/10 rounded-[60px] rotate-12 blur-2xl animate-float" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent_60%)] animate-pulse-slow" />

          {/* Hero Content */}
          <h2 className="text-3xl font-bold mb-4 z-10 text-center animate-fade-in">
            Welcome Back!
          </h2>
          <p className="text-lg opacity-80 mb-8 text-center z-10 animate-fade-in delay-200">
          </p>

        </div>
      </div>

      {/* Custom Tailwind Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 1s ease forwards; }
        .animate-fade-in.delay-200 { animation-delay: 0.2s; }
      `}</style>
    </div>
  );
}
