import React, { useState } from 'react';
import { Mail, Github, Linkedin, Heart } from 'lucide-react';
import { LegalModal } from './LegalModal';

export const Footer: React.FC = () => {
  const [legal, setLegal] = useState<{ open: boolean, type: 'terms' | 'privacy' }>({
    open: false,
    type: 'terms'
  });

  const openLegal = (type: 'terms' | 'privacy') => setLegal({ open: true, type });

  return (
    <footer className="relative bg-slate-900 border-t border-white/[0.08] py-8 mt-auto overflow-hidden">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-20 bg-[#FFC000]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center flex 
 justify-center w-full">
          <p className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">
            <span className="text-[#FFC000]">✦</span> Built by BITSian. Built for BITSians.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Mission - Compact */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo192.png" alt="OpenNotes" className="h-6 w-6 rounded-md" />
              <span className="font-black text-lg tracking-tight text-white">
                Open<span className="text-[#FFC000]">Notes</span>.in
              </span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <p className="hidden sm:block text-[11px] font-medium text-slate-500 uppercase tracking-widest">
              Peer-to-Peer Marketplace
            </p>
          </div>

          {/* Socials - Minimal */}
          <div className="flex items-center gap-4">
            <a href="https://github.com/the-sarvesh" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
              <Github className="h-4 w-4" />
            </a>
            <a href="https://www.linkedin.com/in/the-sarvesh" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="mailto:sarvesh.03.ai@gmail.com" className="text-slate-500 hover:text-[#FFC000] transition-colors">
              <Mail className="h-4 w-4" />
            </a>
          </div>

          {/* Legal & Support */}
          <div className="flex items-center gap-6 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <button onClick={() => openLegal('terms')} className="hover:text-white transition-colors">Terms</button>
            <button onClick={() => openLegal('privacy')} className="hover:text-white transition-colors">Privacy</button>
            <a href="mailto:sarvesh.03.ai@gmail.com?subject=Support Request - OpenNotes" className="hover:text-[#FFC000] transition-colors">Support</a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1.5 font-bold uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} OpenNotes.in • Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by Sarvesh
          </p>
        </div>
      </div>

      <LegalModal
        isOpen={legal.open}
        onClose={() => setLegal({ ...legal, open: false })}
        type={legal.type}
      />
    </footer>
  );
};