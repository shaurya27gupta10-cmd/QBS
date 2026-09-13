import React, { useState } from 'react';
import { Download, Smartphone, Monitor, X, Sparkles, Check, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'hero' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installedNotice, setInstalledNotice] = useState(false);

  // If already running in standalone PWA mode
  if (isInstalled && !installedNotice) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstalledNotice(true);
        setTimeout(() => setInstalledNotice(false), 4000);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const buttonStyle =
    variant === 'header'
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors shadow-2xs'
      : variant === 'hero'
      ? 'inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all'
      : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100';

  return (
    <>
      <button
        id="pwa-add-shortcut-btn"
        type="button"
        onClick={handleAction}
        className={`${buttonStyle} ${className}`}
        title="Add QBS Secure Sound to your Home Screen or Desktop as a fast shortcut"
      >
        <Smartphone className="w-3.5 h-3.5 text-blue-600 sm:inline" />
        <span>Add Shortcut / Install</span>
      </button>

      {/* Instructional Guide Modal when browser direct prompt requires user action */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Add Shortcut / Install App
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    QBS Secure Sound Offline App
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              {isIOS ? (
                // iOS Safari Steps
                <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
                    <li>
                      Safari browser ke bottom toolbar mein <strong>Share</strong> button (
                      <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />) par tap karein.
                    </li>
                    <li>
                      Menu ko scroll karein aur <strong>Add to Home Screen</strong> (
                      <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />) select karein.
                    </li>
                    <li>Top-right mein <strong>Add</strong> par click karein.</li>
                  </ol>
                </div>
              ) : (
                // Android & Chrome/Edge Desktop Steps
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Android (Chrome / Edge):</span>
                    </div>
                    <p className="text-slate-700">
                      Top-right mein <strong>3 dots (⋮)</strong> menu tap karein aur <strong>&quot;Add to Home screen&quot;</strong> ya <strong>&quot;Install app&quot;</strong> select karein.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Monitor className="w-4 h-4 text-blue-600" />
                      <span>Desktop / Laptop (Chrome / Edge / Brave):</span>
                    </div>
                    <p className="text-slate-700">
                      Browser ke URL address bar ke right side mein bane <strong>Install Icon (⊕)</strong> par click karein, ya browser menu se <strong>&quot;Install QBS Secure Sound&quot;</strong> karein.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-emerald-800 text-[11px] font-medium">
                <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Shortcut banne ke baad app offline bhi smoothly chalegi!</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
              >
                Theek Hai / Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
