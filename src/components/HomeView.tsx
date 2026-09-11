import { ShieldCheck, Lock, KeyRound, Radio, ArrowRight, Sparkles, CheckCircle2, Cpu } from 'lucide-react';
import { ActiveTab } from '../types';

interface HomeViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export function HomeView({ setActiveTab }: HomeViewProps) {
  return (
    <div className="py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto px-4 sm:px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Client-Side Cryptographic Sound Generator</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight">
          Your Message. Your Password. <br className="hidden sm:inline" />
          <span className="text-blue-600">Your Sound.</span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Encrypt a private message and transform it into a unique secure sound that only the correct password can unlock.
        </p>

        {/* Primary CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            id="home-encode-btn"
            onClick={() => setActiveTab('encode')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-sm hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 min-h-[48px]"
          >
            <Lock className="w-5 h-5" />
            <span>Encode Message</span>
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
          <span>Encryption and decryption happen locally in your browser.</span>
        </div>
      </div>

      {/* Three Feature Cards */}
      <div className="mt-14 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: AES-GCM */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">AES-GCM Encryption</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Strong authenticated encryption protects your message using AES-256-GCM and PBKDF2 key derivation.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500 font-medium">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-bit symmetric keys</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>100,000 PBKDF2 iterations</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Random 16-byte salt & 12-byte IV</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Sound Encoding */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Sound Encoding</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Encrypted data is transformed into a unique digital sound using Continuous Phase Frequency Shift Keying (CPFSK).
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500 font-medium">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Discrete digital audio symbols</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Standard lossless WAV container</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Audible telemetry pulse carrier</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Password Protected */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Password Protected</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Only the correct password can decrypt the message. Without the exact password, the data is mathematically unreadable.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500 font-medium">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Password never stored or transmitted</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Built-in CRC32 integrity check</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero server telemetry or logs</span>
              </li>
            </ul>
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
