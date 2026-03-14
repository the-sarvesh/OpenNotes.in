import React from 'react';
import { Mail, Github, Linkedin, Heart } from 'lucide-react';

export const Footer: React.FC = () => (
  <footer className="relative bg-slate-900 border-t border-white/[0.08] pt-16 pb-12 mt-auto overflow-hidden">
    {/* Subtle bottom glow */}
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-32 bg-[#FFC000]/10 rounded-full blur-3xl pointer-events-none" />
    {/* Top glow line matching navbar */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FFC000]/20 to-transparent pointer-events-none" />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        {/* Brand & Mission */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <img src="/logo192.png" alt="OpenNotes" className="h-8 w-8 rounded-lg shadow-lg shadow-[#FFC000]/10" />
            <span className="font-black text-xl tracking-tight text-white">
              Open<span className="text-[#FFC000]">Notes</span>.in
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
            A peer-to-peer marketplace for open book exam materials. Created to help students study smarter, together.
          </p>
        </div>

        {/* About the Developer */}
        <div className="space-y-4">
          <h4 className="text-white font-black text-sm uppercase tracking-widest">About Me</h4>
          <p className="text-sm text-slate-400 leading-relaxed">
            Hi! I'm <span className="text-white font-bold">Sarvesh</span>. I built this platform to make study resource exchange seamless and accessible for everyone in our community.
          </p>
        </div>

        {/* Contact & Social */}
        <div className="space-y-4">
          <h4 className="text-white font-black text-sm uppercase tracking-widest">Connect</h4>
          <div className="flex flex-col gap-3">
            <a href="mailto:sarvesh.03.ai@gmail.com" className="flex items-center gap-2 text-sm text-slate-400 hover:text-[#FFC000] transition-colors group">
              <div className="p-2 bg-white/5 rounded-lg group-hover:bg-[#FFC000]/10 transition-colors">
                <Mail className="h-4 w-4" />
              </div>
              sarvesh.03.ai@gmail.com
            </a>
            <div className="flex items-center gap-3 pt-2">
              <a href="https://github.com/the-sarvesh" target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <Github className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/in/the-sarvesh" target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          © {new Date().getFullYear()} OpenNotes.in. Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by Sarvesh.
        </p>
        <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="mailto:sarvesh.03.ai@gmail.com" className="hover:text-[#FFC000] transition-colors">Contact Support</a>
        </div>
      </div>
    </div>
  </footer>
);