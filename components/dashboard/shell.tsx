"use client";

import Navbar from "./navbar";

export default function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100">
      <Navbar />

      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="space-y-6">
          <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-2 text-slate-500">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}