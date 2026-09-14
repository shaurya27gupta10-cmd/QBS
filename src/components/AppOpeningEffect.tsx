import React, { useState, useEffect } from 'react';

interface AppOpeningEffectProps {
  onComplete?: () => void;
  durationMs?: number;
}

export const AppOpeningEffect: React.FC<AppOpeningEffectProps> = ({
  onComplete,
  durationMs = 2200,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fade out slightly before completion
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(800, durationMs - 450));

    const endTimer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [durationMs, onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 200);
  };

  if (!isVisible) return null;

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white select-none cursor-pointer overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="QBS Secure Sound Opening"
      role="dialog"
    >
      <style>{`
        .qbs-opening-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          animation: logoIntroEntry 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          font-family: 'Orbitron', sans-serif;
        }

        @keyframes logoIntroEntry {
          0% {
            opacity: 0;
            transform: scale(0.75) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0px);
          }
        }

        .sonic-circle {
          position: absolute;
          top: 47%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          pointer-events: none;
          border: 2px solid rgba(0, 210, 255, 0.6);
          animation: rippleExpand 3s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
        }

        .sonic-circle:nth-child(1) {
          width: 120px;
          height: 120px;
          animation-delay: 0.1s;
        }

        .sonic-circle:nth-child(2) {
          width: 180px;
          height: 180px;
          animation-delay: 0.8s;
          border-color: rgba(0, 102, 255, 0.35);
        }

        .sonic-circle:nth-child(3) {
          width: 240px;
          height: 240px;
          animation-delay: 1.6s;
          border-color: rgba(0, 210, 255, 0.2);
        }

        @keyframes rippleExpand {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.85;
          }
          60% {
            opacity: 0.3;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.4);
            opacity: 0;
          }
        }

        .wave-bar {
          transform-box: fill-box;
          transform-origin: center;
          animation: soundWavePulse 1.1s ease-in-out infinite alternate;
        }

        .wb-1 { animation-duration: 0.65s; animation-delay: 0.05s; }
        .wb-2 { animation-duration: 0.95s; animation-delay: 0.20s; }
        .wb-3 { animation-duration: 0.75s; animation-delay: 0.12s; }
        .wb-4 { animation-duration: 1.10s; animation-delay: 0.30s; }
        .wb-5 { animation-duration: 0.85s; animation-delay: 0.15s; }
        .wb-6 { animation-duration: 1.05s; animation-delay: 0.25s; }
        .wb-7 { animation-duration: 0.70s; animation-delay: 0.08s; }
        .wb-8 { animation-duration: 0.90s; animation-delay: 0.18s; }

        @keyframes soundWavePulse {
          0% {
            transform: scaleY(0.18);
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
            filter: drop-shadow(0 0 6px rgba(0, 210, 255, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(0, 210, 255, 0.95));
          }
        }

        .lock-glow {
          animation: lockAuraPulse 2s ease-in-out infinite;
        }

        .float-anim {
          animation: gentleFloat 4s ease-in-out infinite;
        }

        @keyframes gentleFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>

      <div className="qbs-opening-container">
        {/* Sound Waves propagating outward from the lock in water/pond ripple style */}
        <div className="sonic-circle" />
        <div className="sonic-circle" />
        <div className="sonic-circle" />

        {/* MAIN LOGO (100% BG REMOVED - PURE VECTOR SVG - PERFECTLY CENTERED) */}
        <div
          className="float-anim"
          style={{
            width: 'min(360px, 80vw)',
            height: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 500 500"
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Headband Vibrant Blue Gradient */}
              <linearGradient id="headbandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#021b44" />
                <stop offset="35%" stopColor="#0066ff" />
                <stop offset="50%" stopColor="#00d2ff" />
                <stop offset="65%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#021b44" />
              </linearGradient>

              {/* Ear Cups Gradient */}
              <linearGradient id="earCupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0077ff" />
                <stop offset="40%" stopColor="#0044cc" />
                <stop offset="70%" stopColor="#051c42" />
                <stop offset="100%" stopColor="#000e24" />
              </linearGradient>

              {/* Shield Faceted Gradient (Dark Royal Blue) */}
              <linearGradient id="shieldLeftFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#082b60" />
                <stop offset="100%" stopColor="#021430" />
              </linearGradient>

              <linearGradient id="shieldRightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#031a3d" />
                <stop offset="100%" stopColor="#010a1a" />
              </linearGradient>

              {/* Shield Neon Border Gradient */}
              <linearGradient id="shieldEdgeGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="50%" stopColor="#0080ff" />
                <stop offset="100%" stopColor="#002d75" />
              </linearGradient>

              {/* Sound Wave Glowing Gradient (Cyan to Aqua Mint) */}
              <linearGradient id="waveBarsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38ef7d" />
                <stop offset="40%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#0077ff" />
              </linearGradient>

              {/* Glow Filter for Sound Waves and Cyber Bevel */}
              <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* HEADPHONES ARCH */}
            <g id="headband">
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
                stroke="url(#headbandGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                filter="url(#cyanGlow)"
              />
            </g>

            {/* LEFT EAR CUP */}
            <g id="earcupLeft">
              <rect
                x="92"
                y="205"
                width="20"
                height="65"
                rx="8"
                fill="#041a3a"
                stroke="#00d2ff"
                strokeWidth="2"
              />
              <ellipse
                cx="96"
                cy="242"
                rx="26"
                ry="60"
                fill="url(#earCupGrad)"
                stroke="#00d2ff"
                strokeWidth="3.5"
              />
              <path
                d="M 106 205 A 22 55 0 0 1 106 280"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#cyanGlow)"
              />
            </g>

            {/* RIGHT EAR CUP */}
            <g id="earcupRight">
              <rect
                x="388"
                y="205"
                width="20"
                height="65"
                rx="8"
                fill="#041a3a"
                stroke="#00d2ff"
                strokeWidth="2"
              />
              <ellipse
                cx="404"
                cy="242"
                rx="26"
                ry="60"
                fill="url(#earCupGrad)"
                stroke="#00d2ff"
                strokeWidth="3.5"
              />
              <path
                d="M 394 205 A 22 55 0 0 0 394 280"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#cyanGlow)"
              />
            </g>

            <g id="shield">
              {/* Left Facet */}
              <polygon points="250,90 130,152 130,295 250,370" fill="url(#shieldLeftFacet)" />
              {/* Right Facet */}
              <polygon points="250,90 370,152 370,295 250,370" fill="url(#shieldRightFacet)" />

              {/* Outer Neon Border Contour */}
              <polygon
                points="250,88 372,151 372,296 250,372 128,296 128,151"
                fill="none"
                stroke="url(#shieldEdgeGlow)"
                strokeWidth="10"
                strokeLinejoin="round"
              />

              {/* Subtle Inner Cyan Accent Lines */}
              <polygon
                points="250,114 350,165 350,282 250,346 150,282 150,165"
                fill="none"
                stroke="#00d2ff"
                strokeWidth="2.5"
                opacity="0.65"
                strokeDasharray="8 6"
              />
            </g>

            <g id="soundWaveBars" fill="url(#waveBarsGrad)" filter="url(#cyanGlow)">
              {/* LEFT 4 WAVE BARS */}
              <rect className="wave-bar wb-1" x="162" y="200" width="10" height="55" rx="5" />
              <rect className="wave-bar wb-2" x="182" y="170" width="10" height="115" rx="5" />
              <rect className="wave-bar wb-3" x="202" y="150" width="10" height="155" rx="5" />
              <rect className="wave-bar wb-4" x="222" y="180" width="10" height="95" rx="5" />

              {/* RIGHT 4 WAVE BARS */}
              <rect className="wave-bar wb-5" x="268" y="180" width="10" height="95" rx="5" />
              <rect className="wave-bar wb-6" x="288" y="150" width="10" height="155" rx="5" />
              <rect className="wave-bar wb-7" x="308" y="170" width="10" height="115" rx="5" />
              <rect className="wave-bar wb-8" x="328" y="200" width="10" height="55" rx="5" />
            </g>

            <g id="securityLock" className="lock-glow">
              {/* Shackle Loop */}
              <path
                d="M 226 215 V 180 A 24 24 0 0 1 274 180 V 215"
                fill="none"
                stroke="#ffffff"
                strokeWidth="13"
                strokeLinecap="round"
              />
              {/* Solid White Padlock Body */}
              <rect x="214" y="210" width="72" height="66" rx="14" fill="#ffffff" />
              {/* Dark Navy Cutout Keyhole */}
              <circle cx="250" cy="235" r="6.5" fill="#041a3a" />
              <polygon points="246,235 254,235 257,258 243,258" fill="#041a3a" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default AppOpeningEffect;
