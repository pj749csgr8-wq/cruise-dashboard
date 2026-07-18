"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp() {
    setIsLoading(true);
    setMessage("");

    if (!email || !password) {
      setMessage("Enter an email address and password.");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMessage(
      "Account created. Check your email if confirmation is required."
    );
    setIsLoading(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[url('/cruise-background.jpg')] bg-cover bg-center px-6 py-12 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-10">
          <header className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">
              Allen at Sea
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              Cruise Companion
            </h1>

            <p className="mt-3 text-slate-600">
              Sign in to manage your cruises, excursions, packages,
              receipts and travel documents.
            </p>
          </header>

          <form
            onSubmit={handleLogin}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {message && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Please wait..." : "Sign in"}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleSignUp}
              className="w-full rounded-xl border border-blue-700 bg-white px-5 py-3 font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create account
            </button>
          </form>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-xl">
            <div className="relative aspect-video w-full">
              <iframe
                src="https://www.youtube.com/embed/s3wNuru4U0I?autoplay=1&mute=1&playsinline=1&rel=0"
                title="Allen at Sea video"
                className="absolute inset-0 h-full w-full"
                frameBorder="0"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Your cruise information is private and connected to your
            individual account.
          </p>
        </section>
      </div>
    </main>
  );
}