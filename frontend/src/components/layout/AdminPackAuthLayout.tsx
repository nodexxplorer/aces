import React, { type ReactNode } from 'react';
import CookieConsent from '../feedback/CookieConsent';

interface AdminPackAuthLayoutProps {
  children: ReactNode;
  cardMaxWidth?: string;
}

export default function AdminPackAuthLayout({ children, cardMaxWidth = 'max-w-[460px]' }: AdminPackAuthLayoutProps) {
  return (
    <div className="dark relative min-h-screen w-full flex flex-col md:flex-row bg-[#070b13] text-slate-100 transition-colors duration-200 select-none">
      {/* ── Left Branding Panel ── */}
      <div className="relative w-full md:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-hidden border-b md:border-b-0 md:border-r border-[#172238] dark:border-[#172238]">
        {/* Subtle radial ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] rounded-full bg-[#1d68ec]/15 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[350px] h-[350px] rounded-full bg-[#0ea5e9]/10 blur-[100px] pointer-events-none" />

        {/* Top brand mark */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-[#1d68ec]/30 overflow-hidden">
            <img
              src="/Adminpack.png"
              alt="Admin Pack"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span className="font-bold tracking-wider text-xs uppercase text-slate-200">ADMIN PACK</span>
        </div>

        {/* Center hero */}
        <div className="relative z-10 my-auto py-12 flex flex-col items-start max-w-sm">
          <div className="relative mb-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#0e1628] border border-[#1f2d47] shadow-2xl flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#1d68ec]/20 to-transparent opacity-60" />
              <img
                src="/Adminpack.png"
                alt="Admin Pack"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(37,99,235,0.6)]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">ADMIN PACK</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The staff portal for lecturers, the HOD and the department office.
          </p>
        </div>

        {/* Bottom copyright */}
        <div className="relative z-10 pt-4 text-xs text-slate-500 font-medium">
          © 2026 Admin Pack · University of Uyo
        </div>
      </div>

      {/* ── Right Content / Form Panel ── */}
      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
        <div className={`w-full ${cardMaxWidth} my-auto`}>{children}</div>
      </div>

      <CookieConsent dark />
    </div>
  );
}
