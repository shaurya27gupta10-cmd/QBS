import React, { useState } from 'react';
import { X, Mail, Copy, Check, Info } from 'lucide-react';
import { copyTextToClipboard } from '../lib/clipboard';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const email = 'buildswithshaurya@gmail.com';

  if (!isOpen) return null;

  const handleCopyEmail = async () => {
    const res = await copyTextToClipboard(email);
    if (res.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Fallback
      const input = document.createElement('input');
      input.value = email;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
    >
      <style>{`
        /* Real dynamic audio wave oscillation */
        .about-wave-bar {
          transform-box: fill-box;
          transform-origin: center;
          animation: soundWavePulse 1.1s ease-in-out infinite alternate;
        }

        .awb-1 { animation-duration: 0.65s; animation-delay: 0.05s; }
        .awb-2 { animation-duration: 0.95s; animation-delay: 0.20s; }
        .awb-3 { animation-duration: 0.75s; animation-delay: 0.12s; }
        .awb-4 { animation-duration: 1.10s; animation-delay: 0.30s; }
        .awb-5 { animation-duration: 0.85s; animation-delay: 0.15s; }
        .awb-6 { animation-duration: 1.05s; animation-delay: 0.25s; }
        .awb-7 { animation-duration: 0.70s; animation-delay: 0.08s; }
        .awb-8 { animation-duration: 0.90s; animation-delay: 0.18s; }

        @keyframes soundWavePulse {
          0% {
            transform: scaleY(0.2);
            opacity: 0.7;
          }
          50% {
            transform: scaleY(1.08);
            opacity: 1;
          }
          100% {
            transform: scaleY(0.35);
            opacity: 0.85;
          }
        }

        @keyframes lockAuraPulse {
          0%, 100% {
            filter: drop-shadow(0 0 4px rgba(0, 210, 255, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(0, 210, 255, 0.95));
          }
        }

        .about-lock-glow {
          animation: lockAuraPulse 2s ease-in-out infinite;
        }

        .about-float-anim {
          animation: gentleAboutFloat 3.5s ease-in-out infinite;
        }

        @keyframes gentleAboutFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>

      <div
        className="relative w-full max-w-[420px] bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close About"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Side-by-Side Brand Header (Logo on left, Title on right) */}
        <div className="flex items-center justify-center gap-3.5 mb-5 mt-1">
          {/* Animated Logo Box */}
          <div className="about-float-anim w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 500 500"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full block"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="aboutHeadbandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#021b44" />
                  <stop offset="35%" stopColor="#0066ff" />
                  <stop offset="50%" stopColor="#00d2ff" />
                  <stop offset="65%" stopColor="#0066ff" />
                  <stop offset="100%" stopColor="#021b44" />
                </linearGradient>

                <linearGradient id="aboutEarCupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0077ff" />
                  <stop offset="40%" stopColor="#0044cc" />
                  <stop offset="70%" stopColor="#051c42" />
                  <stop offset="100%" stopColor="#000e24" />
                </linearGradient>

                <linearGradient id="aboutShieldLeftFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#082b60" />
                  <stop offset="100%" stopColor="#021430" />
                </linearGradient>

                <linearGradient id="aboutShieldRightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#031a3d" />
                  <stop offset="100%" stopColor="#010a1a" />
                </linearGradient>

                <linearGradient id="aboutShieldEdgeGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00f2fe" />
                  <stop offset="50%" stopColor="#0080ff" />
                  <stop offset="100%" stopColor="#002d75" />
                </linearGradient>

                <linearGradient id="aboutWaveBarsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38ef7d" />
                  <stop offset="40%" stopColor="#00f2fe" />
                  <stop offset="100%" stopColor="#0077ff" />
                </linearGradient>

                <filter id="aboutCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Headphones Arc */}
              <g id="about-headband">
                <path
                  d="M 115 240 A 135 135 0 0 1 385 240"
                  fill="none"
                  stroke="#041a3a"
                  strokeWidth="32"
                  strokeLinecap="round"
                />
                <path
                  d="M 125 236 A 125 125 0 0 1 375 236"
                  fill="none"
                  stroke="url(#aboutHeadbandGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  filter="url(#aboutCyanGlow)"
                />
              </g>

              {/* Ear Cups */}
              <g id="about-earcups">
                <rect x="92" y="205" width="20" height="65" rx="8" fill="#041a3a" stroke="#00d2ff" strokeWidth="2" />
                <ellipse cx="96" cy="242" rx="26" ry="60" fill="url(#aboutEarCupGrad)" stroke="#00d2ff" strokeWidth="3" />
                <path d="M 106 205 A 22 55 0 0 1 106 280" fill="none" stroke="#00e5ff" strokeWidth="5" strokeLinecap="round" filter="url(#aboutCyanGlow)" />

                <rect x="388" y="205" width="20" height="65" rx="8" fill="#041a3a" stroke="#00d2ff" strokeWidth="2" />
                <ellipse cx="404" cy="242" rx="26" ry="60" fill="url(#aboutEarCupGrad)" stroke="#00d2ff" strokeWidth="3" />
                <path d="M 394 205 A 22 55 0 0 0 394 280" fill="none" stroke="#00e5ff" strokeWidth="5" strokeLinecap="round" filter="url(#aboutCyanGlow)" />
              </g>

              {/* Shield */}
              <g id="about-shield">
                <polygon points="250,90 130,152 130,295 250,370" fill="url(#aboutShieldLeftFacet)" />
                <polygon points="250,90 370,152 370,295 250,370" fill="url(#aboutShieldRightFacet)" />
                <polygon
                  points="250,88 372,151 372,296 250,372 128,296 128,151"
                  fill="none"
                  stroke="url(#aboutShieldEdgeGlow)"
                  strokeWidth="10"
                  strokeLinejoin="round"
                />
                <polygon
                  points="250,114 350,165 350,282 250,346 150,282 150,165"
                  fill="none"
                  stroke="#00d2ff"
                  strokeWidth="2.5"
                  opacity="0.65"
                  strokeDasharray="8 6"
                />
              </g>

              {/* Audio Wave Bars with Dynamic Oscillations */}
              <g id="about-soundWaves" fill="url(#aboutWaveBarsGrad)" filter="url(#aboutCyanGlow)">
                <rect className="about-wave-bar awb-1" x="162" y="200" width="10" height="55" rx="5" />
                <rect className="about-wave-bar awb-2" x="182" y="170" width="10" height="115" rx="5" />
                <rect className="about-wave-bar awb-3" x="202" y="150" width="10" height="155" rx="5" />
                <rect className="about-wave-bar awb-4" x="222" y="180" width="10" height="95" rx="5" />
                <rect className="about-wave-bar awb-5" x="268" y="180" width="10" height="95" rx="5" />
                <rect className="about-wave-bar awb-6" x="288" y="150" width="10" height="155" rx="5" />
                <rect className="about-wave-bar awb-7" x="308" y="170" width="10" height="115" rx="5" />
                <rect className="about-wave-bar awb-8" x="328" y="200" width="10" height="55" rx="5" />
              </g>

              {/* Security Lock with Pulsing Glow */}
              <g id="about-lock" className="about-lock-glow">
                <path
                  d="M 226 215 V 180 A 24 24 0 0 1 274 180 V 215"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
                <rect x="214" y="210" width="72" height="66" rx="14" fill="#ffffff" />
                <circle cx="250" cy="235" r="6.5" fill="#041a3a" />
                <polygon points="246,235 254,235 257,258 243,258" fill="#041a3a" />
              </g>
            </svg>
          </div>

          {/* Brand Titles */}
          <div className="flex flex-col text-left">
            <h2
              id="about-title"
              className="text-[28px] font-black tracking-[2px] text-[#030d22] leading-none uppercase mb-1"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              QBS
            </h2>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[2.2px] text-[#0070f3] uppercase">
              <span>SECURE</span>
              <span className="w-1 h-1 rounded-full bg-[#00d2ff]" />
              <span>SOUND</span>
            </div>
          </div>
        </div>

        {/* Info Card Container */}
        <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/80 shadow-xs text-left">
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-1">
              Owner
            </div>
            <div className="text-[17px] font-bold text-slate-900 tracking-wide">
              buildswithshaurya
            </div>
          </div>

          <div className="h-px bg-slate-200 my-4 w-full" />

          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-2">
              Contact
            </div>
            <div className="flex flex-col min-[360px]:flex-row items-stretch min-[360px]:items-center gap-2">
              {/* Direct Mail Link */}
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center justify-center gap-2 bg-[#090d16] hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors flex-1 overflow-hidden text-ellipsis whitespace-nowrap shadow-xs"
                title="Send email"
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{email}</span>
              </a>

              {/* Quick Copy Button */}
              <button
                type="button"
                onClick={handleCopyEmail}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex-shrink-0 ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Copy email address"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-[11px] text-slate-400 mt-5 text-center tracking-wide">
          &copy; QBS Secure Sound &bull; All rights reserved
        </p>
      </div>
    </div>
  );
};
