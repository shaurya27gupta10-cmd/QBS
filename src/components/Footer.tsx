import { Shield, Lock, KeyRound, Radio, HelpCircle } from 'lucide-react';
import { ActiveTab } from '../types';
import { QbsLogo } from './QbsLogo';

interface FooterProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenTerms?: () => void;
}

export function Footer({ setActiveTab, onOpenTerms }: FooterProps) {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand Info */}
          <div className="text-center md:text-left space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <QbsLogo variant="shield" size="sm" />
              <span className="font-bold text-slate-900 text-sm tracking-tight">QBS Secure Sound</span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-slate-500 font-medium">v1.0.0</span>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              &ldquo;Your Message. Your File. Your Password. Your Sound.&rdquo; Fully client-side cryptographic sound synthesis.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600">
            <button
              onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-blue-600 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => { setActiveTab('encode'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-blue-600 transition-colors"
            >
              Encode
            </button>
            <button
              onClick={() => { setActiveTab('decode'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-blue-600 transition-colors"
            >
              Decode
            </button>
            <button
              onClick={() => { setActiveTab('how-it-works'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-blue-600 transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => { setActiveTab('security'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-blue-600 transition-colors"
            >
              Security
            </button>
            {onOpenTerms && (
              <button
                onClick={onOpenTerms}
                className="text-slate-600 hover:text-blue-600 font-semibold transition-colors flex items-center gap-1"
                title="View Security, Privacy & Terms of Use"
              >
                <span>Terms &amp; Privacy</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Client-side authenticated encryption via Web Crypto API &bull; Audio synthesis via Web Audio API.</span>
            {onOpenTerms && (
              <button
                onClick={onOpenTerms}
                className="text-blue-600 hover:underline font-medium"
              >
                Terms &amp; Privacy Policy
              </button>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-[11px] font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero Data Storage &bull; In-Browser Only</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
