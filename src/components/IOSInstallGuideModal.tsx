import React from 'react';
import { X, Share, PlusSquare, ExternalLink, Compass, Smartphone, Check } from 'lucide-react';

interface IOSInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInIframe?: boolean;
  onOpenInSafari?: () => void;
}

export const IOSInstallGuideModal: React.FC<IOSInstallGuideModalProps> = ({
  isOpen,
  onClose,
  isInIframe = false,
  onOpenInSafari,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* App Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#090d16] p-1 shadow-md flex items-center justify-center flex-shrink-0 border border-slate-200">
            <img
              src="/icon-192.png"
              alt="QBS App Icon"
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                // Fallback if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h3 id="ios-install-title" className="text-base font-bold text-slate-900 leading-tight">
              iPhone / iPad Par Install Karein
            </h3>
            <p className="text-xs text-blue-600 font-medium">
              Safari Home Screen Shortcut
            </p>
          </div>
        </div>

        {/* If inside iframe (AI Studio preview) prompt to open in Safari first */}
        {isInIframe && (
          <div className="mb-4 p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-2.5">
              <Compass className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <p className="font-semibold mb-1">Step 0: Safari Me Kholein</p>
                <p className="text-blue-700 text-[11px] leading-relaxed">
                  Apple iOS sandboxed preview se direct install block karta hai. Pehle isse Safari browser me open karein:
                </p>
              </div>
            </div>
            {onOpenInSafari && (
              <button
                type="button"
                onClick={onOpenInSafari}
                className="mt-2.5 w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Safari Browser</span>
              </button>
            )}
          </div>
        )}

        {/* Step-by-Step iOS Guide */}
        <div className="space-y-3 my-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              1
            </div>
            <div className="text-xs text-slate-700 flex-1">
              <p className="font-semibold text-slate-900 flex items-center gap-1.5 mb-0.5">
                <span>Safari toolbar me</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-blue-600 font-bold text-[11px]">
                  <Share className="w-3 h-3" /> Share
                </span>
                <span>par tap karein</span>
              </p>
              <p className="text-slate-500 text-[11px]">
                (iPhone me screen ke niche, iPad me screen ke upar hota hai)
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              2
            </div>
            <div className="text-xs text-slate-700 flex-1">
              <p className="font-semibold text-slate-900 flex items-center gap-1.5 mb-0.5">
                <span>Niche scroll karke</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 font-bold text-[11px]">
                  <PlusSquare className="w-3 h-3 text-emerald-600" /> Add to Home Screen
                </span>
              </p>
              <p className="text-slate-500 text-[11px]">
                (या "होम स्क्रीन पर जोड़ें" विकल्प चुने)
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              3
            </div>
            <div className="text-xs text-slate-700 flex-1">
              <p className="font-semibold text-slate-900 flex items-center gap-1 mb-0.5">
                <span>Top-right corner me</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold text-[11px]">
                  Add
                </span>
                <span>par tap karein</span>
              </p>
              <p className="text-slate-500 text-[11px]">
                Ab QBS Secure Sound aapke iPhone par app ki tarah save ho jayega!
              </p>
            </div>
          </div>
        </div>

        {/* Footer info note & Done button */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Standalone PWA Mode</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            Samajh Gaya (Done)
          </button>
        </div>
      </div>
    </div>
  );
};
