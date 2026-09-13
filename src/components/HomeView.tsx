import { MessageSquare, Camera, FolderLock, Radio, ArrowRight, Sparkles, ShieldCheck, Cpu, KeyRound } from 'lucide-react';
import { ActiveTab } from '../types';

interface HomeViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export function HomeView({ setActiveTab }: HomeViewProps) {
  return (
    <div className="py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto px-4 sm:px-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Client-Side Cryptographic Sound Generator</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight">
          Secure Messages &amp; Files
        </h1>
        <p className="mt-2 text-lg sm:text-xl font-medium text-blue-600">
          Your Message. Your File. Your Password. Your Sound.
        </p>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Encrypt messages, photos, videos, audio and files with a password and transform the encrypted data into a QBS Secure Sound.
        </p>

        {/* Primary CTA Buttons + Add Shortcut */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            id="home-encode-btn"
            onClick={() => setActiveTab('encode')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-sm hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 min-h-[48px]"
          >
            <FolderLock className="w-5 h-5" />
            <span>Encode Message or File</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </button>

          <button
            id="home-decode-btn"
            onClick={() => setActiveTab('decode')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-base shadow-sm hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 min-h-[48px]"
          >
            <KeyRound className="w-5 h-5 text-blue-600" />
            <span>Decode Sound</span>
          </button>
        </div>

        {/* Local Security Badge */}
        <div className="mt-6 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 bg-slate-100/80 px-3.5 py-1.5 rounded-full border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Your file is encrypted locally before it is converted into QBS Secure Sound.</span>
        </div>
      </div>

      {/* 4 Feature Cards */}
      <div className="mt-14 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: 💬 Secure Messages */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Secure Messages</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Encrypt private text messages with password-derived AES-256-GCM authentication.
            </p>
          </div>

          {/* Card 2: 📷 Secure Photos & Videos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Secure Photos & Videos</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Protect personal media files (JPG, PNG, MP4, WEBM) locally in your browser.
            </p>
          </div>

          {/* Card 3: 📁 Secure Files */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <FolderLock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Secure Files</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Encrypt documents (PDF, DOCX, CSV) and binary files with complete data integrity.
            </p>
          </div>

          {/* Card 4: 🎵 Unique Secure Sound */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Unique Secure Sound</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Carry encrypted data inside a custom digital audio waveform with FSK tones.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Summary Banner */}
      <div className="mt-12 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-slate-900 text-sm">How Audio Transmission Works</span>
            </div>
            <p className="text-sm text-slate-600 max-w-xl">
              QBS converts binary encrypted ciphertext into a structured audio track with preamble sync tones and digital frequency symbols. You can send the generated WAV sound via any messaging app or email.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('how-it-works')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-4 focus:outline-none"
          >
            <span>Read full specification</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
