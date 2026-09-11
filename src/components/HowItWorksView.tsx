import { Type, Lock, Radio, KeyRound, ArrowRight, ShieldCheck, Waves, Info } from 'lucide-react';
import { ActiveTab } from '../types';

interface HowItWorksViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export function HowItWorksView({ setActiveTab }: HowItWorksViewProps) {
  const steps = [
    {
      step: '01',
      title: 'Select Message or File',
      subtitle: 'Compose text or choose media/document',
      description: 'You select a text message, photo (JPG, PNG, WEBP), video (MP4), audio (MP3, WAV), document (PDF, TXT, DOCX), or binary file locally in the browser. Plaintext data is never transmitted to any external server.',
      icon: <Type className="w-6 h-6 text-blue-600" />,
      detail: 'Runs client-side in-memory with safe browser Blob isolation.',
    },
    {
      step: '02',
      title: 'Encrypt with Password',
      subtitle: 'PBKDF2 key derivation & AES-256-GCM',
      description: 'The Web Crypto API generates a cryptographically secure 16-byte random salt and 12-byte random IV. PBKDF2 runs 100,000 iterations of SHA-256 to derive a 256-bit key to encrypt the payload.',
      icon: <Lock className="w-6 h-6 text-blue-600" />,
      detail: 'Includes file metadata, 128-bit authentication tag, and CRC32 checksum.',
    },
    {
      step: '03',
      title: 'Convert Encrypted Data into Sound',
      subtitle: 'Continuous Phase Frequency Shift Keying (CPFSK)',
      description: 'The encrypted binary payload is mapped to discrete acoustic frequencies: 2400 Hz synchronization pilot, 1200 Hz for binary 0, and 2000 Hz for binary 1, with smooth cosine envelope transitions.',
      icon: <Radio className="w-6 h-6 text-blue-600" />,
      detail: 'Encapsulated into a standard 44.1 kHz 16-bit PCM WAV audio file.',
    },
    {
      step: '04',
      title: 'Receiver Decodes Sound + Password',
      subtitle: 'Payload extraction & cryptographic decryption',
      description: 'The recipient uploads the WAV file and enters the matching password. The decoder recovers the exact ciphertext, verifies CRC32 integrity, and executes authenticated AES-GCM decryption.',
      icon: <KeyRound className="w-6 h-6 text-blue-600" />,
      detail: 'Wrong passwords fail with zero partial plaintext leakage.',
    },
  ];

  return (
    <div className="py-6 sm:py-10 max-w-4xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
          <Info className="w-3.5 h-3.5" />
          <span>Protocol Architecture</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          How QBS Secure Sound Works
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          A 4-step pipeline bridging browser-native cryptography and digital audio modulation.
        </p>
      </div>

      {/* Security Highlight Box */}
      <div className="mb-10 bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 flex items-start gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
          <Waves className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            Encrypted Data Carrier, Not Voice Recording
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            The generated audio file does not contain spoken language or readable text converted to speech. It is a synthesized digital audio modem carrier holding mathematically encrypted binary ciphertext. Listening to it reveals only deliberate digital telemetry tones.
          </p>
        </div>
      </div>

      {/* 4-Step Diagram */}
      <div className="space-y-6">
        {steps.map((item, index) => (
          <div
            key={item.step}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      Step {item.step}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.subtitle}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{item.detail}</span>
                  </div>
                </div>
              </div>
            </div>

            {index < steps.length - 1 && (
              <div className="hidden sm:flex justify-center -mb-9 mt-3 relative z-10">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-200">
                  &darr;
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Audio Modulation Table */}
      <div className="mt-10 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          Acoustic Frequency Modulation Table (FSK)
        </h3>
        <p className="text-xs sm:text-sm text-slate-600">
          The audio codec uses distinct acoustic bands optimized for browser Web Audio playback and lossless WAV reproduction:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pilot / Preamble</span>
            <span className="text-lg font-bold text-blue-600 font-mono block mt-1">2,400 Hz</span>
            <span className="text-xs text-slate-500 mt-1 block">Synchronizes receiver & detector</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Binary '0' (Space)</span>
            <span className="text-lg font-bold text-slate-800 font-mono block mt-1">1,200 Hz</span>
            <span className="text-xs text-slate-500 mt-1 block">Bell 202 space standard</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Binary '1' (Mark)</span>
            <span className="text-lg font-bold text-slate-800 font-mono block mt-1">2,000 Hz</span>
            <span className="text-xs text-slate-500 mt-1 block">High carrier mark symbol</span>
          </div>
        </div>
      </div>

      {/* CTA Bottom Banner */}
      <div className="mt-10 text-center">
        <button
          onClick={() => setActiveTab('encode')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span>Try Encoding a Message or File</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
