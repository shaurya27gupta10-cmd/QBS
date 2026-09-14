import React, { useState } from 'react';
import { Smartphone, Check, Sparkles } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { IOSInstallGuideModal } from './IOSInstallGuideModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'hero' | 'compact' | 'menuItem';
  onClicked?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'hero',
  onClicked,
}) => {
  const { isInstallable, isIOS, isInIframe, install, openInBrowser } = usePWAInstall();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleAction = async () => {
    if (onClicked) onClicked();

    // 1. If on iOS (iPhone / iPad), Apple WebKit blocks programmatic install prompts.
    // Always show the dedicated iOS Safari Home Screen guide.
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    // 2. If native Chromium / Android install prompt is ready, trigger it directly
    if (isInstallable) {
      try {
        const success = await install();
        if (success) {
          setToastMessage('App shortcut home screen par add ho gaya!');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3500);
          return;
        }
      } catch (err) {
        console.warn('Install error:', err);
      }
    }

    // 3. If running inside preview iframe (aistudio.google.com),
    // browsers block native beforeinstallprompt inside sandboxed iframes.
    // Open directly in standard browser window so Chrome triggers prompt immediately!
    if (isInIframe) {
      setToastMessage('Opening in browser to add shortcut...');
      setShowToast(true);
      setTimeout(() => {
        openInBrowser();
        setShowToast(false);
      }, 300);
      return;
    }

    // 4. If in normal browser but beforeinstallprompt already resolved or pending
    setToastMessage('Menu (⋮) > "Add to Home screen" / "Install app"');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // Header compact button style
  if (variant === 'header') {
    return (
      <>
        <button
          id="pwa-header-install-btn"
          type="button"
          onClick={handleAction}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors shadow-2xs cursor-pointer ${className}`}
          title="Add QBS Secure Sound to your Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-600" />
          <span>Add Shortcut / Install</span>
        </button>

        {showToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <IOSInstallGuideModal
          isOpen={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          isInIframe={isInIframe}
          onOpenInSafari={openInBrowser}
        />
      </>
    );
  }

  // Exact Match to 2nd Image (Dark Navy Button inside Menu or Hero)
  return (
    <>
      <button
        id="pwa-add-shortcut-btn"
        type="button"
        onClick={handleAction}
        className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl bg-[#0c1833] hover:bg-[#15274d] active:scale-[0.98] text-white font-semibold text-sm shadow-md transition-all cursor-pointer ${className}`}
      >
        <Smartphone className="w-4 h-4 text-blue-400" />
        <span>Add Shortcut / Install</span>
      </button>

      {/* Subtle Toast notification (Never blocks screen, vanishes in seconds) */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Interactive Step-by-Step iOS Install Guide Modal */}
      <IOSInstallGuideModal
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
        isInIframe={isInIframe}
        onOpenInSafari={openInBrowser}
      />
    </>
  );
};

export default PWAInstallButton;
