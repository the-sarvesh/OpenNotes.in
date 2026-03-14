import React from 'react';

export const Footer: React.FC = () => (
  <footer className="relative bg-slate-900 border-t border-white/[0.08] py-10 mt-auto overflow-hidden">
    {/* Subtle bottom glow */}
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-32 bg-[#FFC000]/10 rounded-full blur-3xl pointer-events-none" />
    {/* Top glow line matching navbar */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FFC000]/20 to-transparent pointer-events-none" />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo192.png" alt="OpenNotes" className="h-7 w-7 rounded-lg shadow-lg shadow-[#FFC000]/10" />
          <span className="font-black text-base tracking-tight text-white">
            Open<span className="text-[#FFC000]">Notes</span>.in
          </span>
        </div>

        {/* Tagline */}
        <p className="text-xs text-slate-500 text-center">
          A peer-to-peer marketplace for open book exam materials.
        </p>

        {/* Links */}
        <div className="flex items-center gap-5 text-xs font-medium text-slate-500">
          <a href="#" className="hover:text-[#FFC000] transition-colors">Terms</a>
          <a href="#" className="hover:text-[#FFC000] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#FFC000] transition-colors">Contact</a>
        </div>
      </div>
    </div>
  </footer>
);