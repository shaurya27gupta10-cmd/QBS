import React from 'react';

interface QbsLogoProps {
  variant?: 'full' | 'icon' | 'shield' | 'horizontal';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  animateWaves?: boolean;
  useImage?: boolean;
}

export const QbsLogo: React.FC<QbsLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showText = true,
  animateWaves = true,
  useImage = false,
}) => {
  // Dimension mappings
  const sizeConfig = {
    sm: { height: 36, iconBox: 'w-9 h-9', textTitle: 'text-base', textSub: 'text-[9px]' },
    md: { height: 48, iconBox: 'w-12 h-12', textTitle: 'text-lg', textSub: 'text-[11px]' },
    lg: { height: 72, iconBox: 'w-20 h-20', textTitle: 'text-2xl', textSub: 'text-xs' },
    xl: { height: 120, iconBox: 'w-32 h-32', textTitle: 'text-3xl', textSub: 'text-sm' },
  }[size];

  // The Animated Emblem (Headphones + 3D Shield + Equalizer Soundwaves + Security Padlock)
  const renderEmblem = (includeHeadphones: boolean = true) => (
    <svg
      viewBox="0 0 500 500"
      className="w-full h-full drop-shadow-sm select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Shield Deep Navy 3D Facet Gradients */}
        <linearGradient id="shieldGradLeft" x1="140" y1="90" x2="250" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a2a66" />
          <stop offset="50%" stopColor="#081d45" />
          <stop offset="100%" stopColor="#040f24" />
        </linearGradient>
        <linearGradient id="shieldGradRight" x1="250" y1="90" x2="360" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0d3b8f" />
          <stop offset="50%" stopColor="#0a265c" />
          <stop offset="100%" stopColor="#061633" />
        </linearGradient>

        {/* Outer Cyan Neon Shield Rim */}
        <linearGradient id="shieldRim" x1="130" y1="80" x2="370" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00f2fe" />
          <stop offset="60%" stopColor="#0099ff" />
          <stop offset="100%" stopColor="#0055d4" />
        </linearGradient>

        {/* Headphones Navy Metallic Gradient */}
        <linearGradient id="headbandGrad" x1="70" y1="50" x2="430" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a2254" />
          <stop offset="35%" stopColor="#07183d" />
          <stop offset="70%" stopColor="#0f3480" />
          <stop offset="100%" stopColor="#081c46" />
        </linearGradient>

        {/* Headphone Earcup Pill Gradient */}
        <linearGradient id="earcupGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e378c" />
          <stop offset="50%" stopColor="#061b45" />
          <stop offset="100%" stopColor="#030e26" />
        </linearGradient>

        {/* Soundwaves Cyan-Emerald Gradient */}
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00f2fe" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Glow Filter */}
        <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#00e5ff" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* 1. HEADPHONES (If enabled) */}
      {includeHeadphones && (
        <g id="headphones-assembly">
          {/* Headband Arch */}
          <path
            d="M 108 260 C 108 140, 160 62, 250 62 C 340 62, 392 140, 392 260"
            fill="none"
            stroke="url(#headbandGrad)"
            strokeWidth="38"
            strokeLinecap="round"
          />
          {/* Headband inner cushion accent */}
          <path
            d="M 125 240 C 125 150, 170 82, 250 82 C 330 82, 375 150, 375 240"
            fill="none"
            stroke="#00c8ff"
            strokeWidth="3"
            strokeOpacity="0.75"
          />

          {/* Left Earcup Slider & Pivot */}
          <rect x="74" y="222" width="18" height="42" rx="6" fill="#0c2e73" />
          <rect x="79" y="227" width="8" height="32" rx="4" fill="#00d4ff" opacity="0.8" />

          {/* Left Earcup Pill */}
          <rect
            x="52"
            y="244"
            width="50"
            height="114"
            rx="25"
            fill="url(#earcupGrad)"
            stroke="#00b4d8"
            strokeWidth="4"
          />
          <rect x="66" y="260" width="22" height="82" rx="11" fill="#00e5ff" opacity="0.9" />

          {/* Right Earcup Slider & Pivot */}
          <rect x="408" y="222" width="18" height="42" rx="6" fill="#0c2e73" />
          <rect x="413" y="227" width="8" height="32" rx="4" fill="#00d4ff" opacity="0.8" />

          {/* Right Earcup Pill */}
          <rect
            x="398"
            y="244"
            width="50"
            height="114"
            rx="25"
            fill="url(#earcupGrad)"
            stroke="#00b4d8"
            strokeWidth="4"
          />
          <rect x="412" y="260" width="22" height="82" rx="11" fill="#00e5ff" opacity="0.9" />
        </g>
      )}

      {/* 2. 3D HEXAGONAL SHIELD */}
      <g id="shield-assembly">
        {/* Outer Shield Glow Rim */}
        <polygon
          points="250,96 364,152 364,302 250,388 136,302 136,152"
          fill="none"
          stroke="url(#shieldRim)"
          strokeWidth="11"
          strokeLinejoin="round"
          filter="url(#cyanGlow)"
        />

        {/* Left Shield Half (Darker Facet) */}
        <path
          d="M 250 102 L 142 156 L 142 298 L 250 380 Z"
          fill="url(#shieldGradLeft)"
        />

        {/* Right Shield Half (Lighter Facet) */}
        <path
          d="M 250 102 L 358 156 L 358 298 L 250 380 Z"
          fill="url(#shieldGradRight)"
        />

        {/* Center Vertical Split Crease */}
        <line x1="250" y1="102" x2="250" y2="380" stroke="#00e5ff" strokeWidth="2.5" opacity="0.75" />
      </g>

      {/* 3. AUDIO EQUALIZER SOUNDWAVES (Cyan-Emerald Bars with Real Up & Down Bounce) */}
      <g id="soundwaves" fill="url(#waveGrad)">
        {/* Left Side Audio Waveform Bars */}
        <rect
          x="160"
          y="228"
          width="7"
          height="42"
          rx="3.5"
          className={animateWaves ? 'wave-bar-1' : ''}
        />
        <rect
          x="174"
          y="208"
          width="7"
          height="82"
          rx="3.5"
          className={animateWaves ? 'wave-bar-3' : ''}
        />
        <rect
          x="188"
          y="192"
          width="7"
          height="114"
          rx="3.5"
          className={animateWaves ? 'wave-bar-4' : ''}
        />
        <rect
          x="202"
          y="214"
          width="7"
          height="70"
          rx="3.5"
          className={animateWaves ? 'wave-bar-2' : ''}
        />

        {/* Right Side Audio Waveform Bars */}
        <rect
          x="291"
          y="214"
          width="7"
          height="70"
          rx="3.5"
          className={animateWaves ? 'wave-bar-5' : ''}
        />
        <rect
          x="305"
          y="192"
          width="7"
          height="114"
          rx="3.5"
          className={animateWaves ? 'wave-bar-4' : ''}
        />
        <rect
          x="319"
          y="208"
          width="7"
          height="82"
          rx="3.5"
          className={animateWaves ? 'wave-bar-3' : ''}
        />
        <rect
          x="333"
          y="228"
          width="7"
          height="42"
          rx="3.5"
          className={animateWaves ? 'wave-bar-1' : ''}
        />
      </g>

      {/* 4. SECURITY PADLOCK (White Solid with Keyhole) */}
      <g id="security-padlock" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))">
        {/* Padlock Shackle */}
        <path
          d="M 226 218 V 194 C 226 179, 236 168, 250 168 C 264 168, 274 179, 274 194 V 218"
          fill="none"
          stroke="#ffffff"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Padlock Body */}
        <rect
          x="216"
          y="218"
          width="68"
          height="66"
          rx="12"
          fill="#ffffff"
        />

        {/* Padlock Keyhole (Navy Blue) */}
        <circle cx="250" cy="246" r="6" fill="#071b40" />
        <polygon points="247,247 253,247 255,266 245,266" fill="#071b40" />
      </g>
    </svg>
  );

  // Variant: Standalone Shield Emblem
  if (variant === 'shield') {
    return (
      <div className={`relative flex items-center justify-center ${sizeConfig.iconBox} ${className}`}>
        {renderEmblem(false)}
      </div>
    );
  }

  // Variant: Icon Emblem Only (With Headphones)
  if (variant === 'icon') {
    return (
      <div className={`relative flex items-center justify-center ${sizeConfig.iconBox} ${className}`}>
        {useImage ? (
          <img
            src="/qbs-logo.png"
            alt="QBS Secure Sound Icon"
            className="w-full h-full object-contain select-none"
          />
        ) : (
          renderEmblem(true)
        )}
      </div>
    );
  }

  // Variant: Full Vertical Brand Display (Hero Section)
  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center justify-center select-none text-center ${className}`}>
        {/* Emblem or Authentic Logo Image */}
        <div className="relative flex items-center justify-center">
          {useImage ? (
            <div className="relative">
              <img
                src="/qbs-logo.png"
                alt="QBS Secure Sound"
                className="w-36 h-36 sm:w-44 sm:h-44 object-contain select-none filter drop-shadow-md"
              />
              {/* Overlay animated sound wave pulses over the image */}
              {animateWaves && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-1 h-12 px-2">
                    <div className="w-1 bg-cyan-400/90 rounded-full wave-bar-1 h-5" />
                    <div className="w-1 bg-cyan-400/90 rounded-full wave-bar-3 h-8" />
                    <div className="w-1 bg-cyan-400/90 rounded-full wave-bar-2 h-6" />
                    <div className="w-1 bg-cyan-400/90 rounded-full wave-bar-4 h-9" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-28 h-28 sm:w-36 sm:h-36">
              {renderEmblem(true)}
            </div>
          )}
        </div>

        {/* Bold Stylized Typography */}
        {showText && !useImage && (
          <div className="mt-3 flex flex-col items-center">
            <div className="flex items-center tracking-tight font-black font-sans leading-none text-[#07193b]">
              <span className="relative text-3xl sm:text-4xl font-extrabold tracking-tighter">
                <span className="text-[#07193b]">Q</span>
                <span className="absolute -bottom-0.5 right-0.5 w-2 h-3.5 bg-gradient-to-tr from-[#00f2fe] to-[#0099ff] transform rotate-45 rounded-xs" />
              </span>
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tighter ml-1">
                BS
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-bold tracking-widest text-xs sm:text-sm text-[#07193b] uppercase">
              <span>SECURE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
              <span className="text-[#0099ff]">SOUND</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default Variant: Horizontal Brand (Header & Mobile Navigation)
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Crisp Icon with Dancing Soundwaves */}
      <div className={`${sizeConfig.iconBox} flex-shrink-0 relative`}>
        {renderEmblem(true)}
      </div>

      {showText && (
        <div className="flex flex-col text-left justify-center min-w-0">
          {/* Main Brand Line (Single Line, High-Impact) */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`font-black tracking-tight text-slate-900 ${sizeConfig.textTitle} flex items-center`}>
              <span className="relative text-[#07193b]">
                Q
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-gradient-to-tr from-[#00d4ff] to-[#0088ff] rounded-xs" />
              </span>
              <span className="ml-0.5 text-[#07193b]">BS</span>
              <span className="ml-1.5 font-bold text-slate-800">Secure Sound</span>
            </span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              v1.0
            </span>
          </div>

          {/* Subtitle - HIDDEN on small mobile to keep top bar 100% clean and uncluttered */}
          <div className="hidden sm:flex items-center gap-1 font-bold tracking-wider text-slate-500 uppercase text-[10px]">
            <span className="text-slate-600">Secure</span>
            <span className="w-1 h-1 rounded-full bg-[#00b4d8]" />
            <span className="text-blue-600">Sound</span>
            <span className="mx-1 text-slate-300 font-normal">|</span>
            <span className="text-slate-400 font-medium normal-case tracking-normal">Encrypted Audio Carrier</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default QbsLogo;
