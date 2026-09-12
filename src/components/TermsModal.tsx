import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  KeyRound, 
  Check, 
  X, 
  ShieldAlert, 
  Scale, 
  Cpu
} from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  isMandatory?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onClose?: () => void;
}

export const TERMS_STORAGE_KEY = 'qbs_terms_accepted_v1';
export const TERMS_ACCEPTED_DATE_KEY = 'qbs_terms_accepted_date';

export function TermsModal({
  isOpen,
  isMandatory = false,
  onAccept,
  onDecline,
  onClose,
}: TermsModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [isDeclinedView, setIsDeclinedView] = useState(false);
  const [acceptedDate, setAcceptedDate] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(TERMS_STORAGE_KEY);
      const dateStored = localStorage.getItem(TERMS_ACCEPTED_DATE_KEY);
      if (stored === 'true') {
        setAgreed(true);
        setAcceptedDate(dateStored || 'Previously Accepted');
      } else {
        setAgreed(false);
        setAcceptedDate(null);
      }
      setIsDeclinedView(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!agreed) return;
    const now = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    localStorage.setItem(TERMS_STORAGE_KEY, 'true');
    localStorage.setItem(TERMS_ACCEPTED_DATE_KEY, now);
    onAccept();
  };

  const handleDecline = () => {
    setIsDeclinedView(true);
    onDecline();
  };

  const handleResetConsent = () => {
    localStorage.removeItem(TERMS_STORAGE_KEY);
    localStorage.removeItem(TERMS_ACCEPTED_DATE_KEY);
    setAgreed(false);
    setAcceptedDate(null);
    setIsDeclinedView(false);
  };

  return (
    <div
      id="terms-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      onClick={() => {
        if (!isMandatory && onClose) {
          onClose();
        }
      }}
    >
      <div
        id="terms-modal-card"
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {isDeclinedView ? (
          /* Declined View State */
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Terms of Use Required
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Because <strong>QBS Secure Sound</strong> performs client-side cryptographic steganography and zero-knowledge encryption, you must acknowledge user responsibility, zero password recovery, and local processing before accessing the application.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-1.5 max-w-md mx-auto">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Why is this required?</span>
              </div>
              <p>
                We do not collect accounts, telemetry, or store encryption passwords. Since data cannot be retrieved without your passphrase, explicit user consent is mandatory for security and legal compliance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeclinedView(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs"
              >
                Review &amp; Accept Terms
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = 'https://google.com';
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                Exit Website
              </button>
            </div>
          </div>
        ) : (
          /* Normal Terms & Privacy Content */
          <>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="terms-modal-title" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Security, Privacy &amp; Terms of Use
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mandatory client-side security protocol &amp; cryptographic agreement
                  </p>
                </div>
              </div>

              {!isMandatory && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Scrollable Terms Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed max-h-[50vh] sm:max-h-[55vh] border-b border-slate-100">
              {acceptedDate && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Consent active on this browser (Accepted: {acceptedDate})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetConsent}
                    className="text-emerald-900 underline hover:no-underline text-[11px] font-medium"
                  >
                    Reset Consent
                  </button>
                </div>
              )}

              {/* Notice Banner */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                <Cpu className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-950">100% Client-Side In-Browser Execution</span>
                  <p className="mt-0.5 text-blue-800/90 text-[11px] leading-normal">
                    This tool runs entirely within your device&apos;s sandbox via Web Crypto API and Web Audio API. No servers, backend databases, or external AI APIs exist.
                  </p>
                </div>
              </div>

              {/* Term 1: Zero-Data Storage */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>1. Zero-Data Storage &amp; Privacy Guarantee</span>
                </div>
                <p className="text-slate-600 text-xs sm:text-[13px] leading-relaxed">
                  All encryption, decryption, sound wave generation (FSK audio synthesis), and QR rendering happen <strong>100% locally in your web browser memory</strong>. We do <strong>NOT</strong> collect, store, log, inspect, or transmit any user files, text messages, passwords, or cryptographic keys to any server. Your unencrypted data never touches the wire.
                </p>
              </div>

              {/* Term 2: User Responsibility */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Scale className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>2. User Responsibility &amp; Lawful Usage</span>
                </div>
                <p className="text-slate-600 text-xs sm:text-[13px] leading-relaxed">
                  You are solely and strictly responsible for all data, files, and messages you encode or decode using this utility. You agree to use this software in full compliance with applicable local, national, and international laws. <strong>Illegal data smuggling, copyright violations, malware propagation, harassment, or malicious dissemination are strictly prohibited.</strong>
                </p>
              </div>

              {/* Term 3: No Password Recovery */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>3. Zero-Knowledge: No Password Recovery</span>
                </div>
                <p className="text-amber-900 text-xs sm:text-[13px] leading-relaxed">
                  Security is enforced with military-grade PBKDF2 (100,000 rounds of SHA-256) and AES-256-GCM. Because there is no central database or administrative recovery key, <strong>lost or forgotten passwords will result in permanent, irreversible data loss</strong>. The creators cannot decrypt or recover your files under any circumstances.
                </p>
              </div>

              {/* Term 4: Disclaimer & No Liability */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <AlertTriangle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <span>4. Disclaimer &amp; Limitation of Liability</span>
                </div>
                <p className="text-slate-600 text-xs sm:text-[13px] leading-relaxed">
                  This application is provided on an <strong>&ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis</strong>, without warranties of any kind, either express or implied, including fitness for a particular purpose or error-free acoustic transmission. In no event shall the authors, maintainers, or host providers be liable for any direct, indirect, incidental, or consequential damages resulting from data loss, corrupted audio, or unauthorized third-party access.
                </p>
              </div>
            </div>

            {/* Modal Footer / Action Controls */}
            <div className="p-5 sm:p-6 bg-slate-50/50 space-y-4">
              {/* Checkbox Agreement */}
              <label
                htmlFor="terms-agree-checkbox"
                className="flex items-start gap-3 cursor-pointer select-none group"
              >
                <div className="relative flex items-center pt-0.5">
                  <input
                    id="terms-agree-checkbox"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <div className="text-xs sm:text-sm text-slate-800 group-hover:text-slate-900">
                  <span className="font-semibold">
                    I have read and agree to the Security Terms &amp; Privacy Policy.
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    I understand that all encryption is 100% local, no passwords can be recovered, and I am solely responsible for lawful use.
                  </p>
                </div>
              </label>

              {/* Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-1">
                {isMandatory ? (
                  <button
                    type="button"
                    onClick={handleDecline}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors text-center"
                  >
                    Decline &amp; Exit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors text-center"
                  >
                    Close
                  </button>
                )}

                <button
                  type="button"
                  id="accept-terms-btn"
                  disabled={!agreed}
                  onClick={handleAccept}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
                    agreed
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-md active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Accept &amp; Continue</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
