import React, { useState, useEffect } from 'react';

interface AppOpeningEffectProps {
  onComplete?: () => void;
  durationMs?: number;
}

export const AppOpeningEffect: React.FC<AppOpeningEffectProps> = ({
  onComplete,
  durationMs = 2000,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fade out slightly before completion
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(800, durationMs - 500));

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
    }, 250);
  };

  if (!isVisible) return null;

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-white via-slate-50 to-blue-50/50 text-slate-900 select-none cursor-pointer transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="App Loading Animation"
      role="dialog"
    >
      {/* Background Animated Sound Wave Ripples (Light Theme) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-72 h-72 rounded-full border border-blue-200/60 animate-ripple" />
        <div
          className="w-96 h-96 rounded-full border border-cyan-200/50 animate-ripple"
          style={{ animationDelay: '0.6s' }}
        />
        <div
          className="w-[30rem] h-[30rem] rounded-full border border-blue-100/40 animate-ripple"
          style={{ animationDelay: '1.2s' }}
        />
        <div className="absolute w-72 h-72 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center px-4 max-w-sm text-center">
        {/* Animated Sound Logo Container */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 mb-5 flex items-center justify-center">
          {/* Authentic Logo Image */}
          <img
            src="/qbs-logo.png"
            alt="QBS Secure Sound"
            className="w-full h-full object-contain filter drop-shadow-[0_12px_28px_rgba(0,120,255,0.18)]"
          />

          {/* Dynamic Sound Wave Layer (Bouncing UP and DOWN over shield) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Center Sound Wave Bars Dancing */}
            <div className="flex items-center gap-1 sm:gap-1.5 h-16 sm:h-20 px-2">
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-1" style={{ height: '36px' }} />
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-2" style={{ height: '52px' }} />
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-3" style={{ height: '28px' }} />
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-4" style={{ height: '64px' }} />
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-5" style={{ height: '42px' }} />
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-2" style={{ height: '56px' }} />
              <div className="w-1 sm:w-1.5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full wave-bar-4" style={{ height: '32px' }} />
            </div>
          </div>
        </div>

        {/* Brand Name Typography (Light Mode: Crisp Dark Navy & Vivid Blue) */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center justify-center">
          <span className="text-[#07193b]">QBS</span>
          <span className="text-blue-600 ml-2">SECURE</span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 mx-2 animate-pulse" />
          <span className="text-sky-500">SOUND</span>
        </h1>

        {/* Dynamic Sound Wave Spectrum Visualizer Bar (Light Mode) */}
        <div className="flex items-center justify-center gap-1.5 my-3.5 h-6 bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-mono font-semibold text-slate-500 mr-1.5 tracking-wider">LIVE FREQ</span>
          <span className="w-1 bg-blue-600 rounded-full wave-bar-1 h-3" />
          <span className="w-1 bg-cyan-500 rounded-full wave-bar-2 h-5" />
          <span className="w-1 bg-blue-500 rounded-full wave-bar-3 h-2" />
          <span className="w-1 bg-cyan-500 rounded-full wave-bar-4 h-6" />
          <span className="w-1 bg-blue-600 rounded-full wave-bar-5 h-4" />
          <span className="w-1 bg-cyan-500 rounded-full wave-bar-2 h-6" />
          <span className="w-1 bg-blue-500 rounded-full wave-bar-1 h-3" />
          <span className="w-1 bg-cyan-500 rounded-full wave-bar-4 h-5" />
          <span className="text-[11px] font-mono font-semibold text-slate-500 ml-1.5 tracking-wider">FSK 1200/2200</span>
        </div>

        {/* Tagline */}
        <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-xs mt-1">
          Your Message. Your File. Your Password. Your Sound.
        </p>

        {/* Tap to enter notice */}
        <span className="mt-5 text-[11px] text-slate-400 tracking-wider uppercase font-medium">
          Tap anywhere to continue
        </span>
      </div>
    </div>
  );
};

export default AppOpeningEffect;
