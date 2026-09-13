import React, { useState } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  QrCode,
  FileAudio,
  FileArchive,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { bytesToBase64, inspectPayloadInfo } from '../lib/crypto';
import { copyTextToClipboard } from '../lib/clipboard';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  soundBlob?: Blob;
  rawPayload: Uint8Array;
  qrDataUrl?: string | null;
  fitsQr?: boolean;
  qrPayloadString?: string;
  isMultiPart?: boolean;
  frameCount?: number;
  onOpenInDecoder?: () => void;
  onOpenQrModal?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  filename,
  soundBlob,
  rawPayload,
  qrDataUrl,
  fitsQr,
  qrPayloadString,
  isMultiPart = false,
  frameCount = 1,
  onOpenInDecoder,
  onOpenQrModal,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const [showCodePreview, setShowCodePreview] = useState(false);

  if (!isOpen) return null;

  let isFile = false;
  try {
    const info = inspectPayloadInfo(rawPayload);
    isFile = info.type === 'file';
  } catch {
    isFile = filename.includes('.') && !filename.endsWith('.wav');
  }

  const defaultPrefix = isFile ? 'QBSF:' : 'QBSS:';
  const payloadString = qrPayloadString || `${defaultPrefix}${bytesToBase64(rawPayload)}`;

  const handleCopyText = async (text: string, type: string) => {
    const res = await copyTextToClipboard(text);
    if (res.success) {
      setCopiedType(type);
      setShareStatus('Copied encrypted code to clipboard! You can paste it directly into Decoder.');
      setTimeout(() => {
        setCopiedType(null);
        setShareStatus(null);
      }, 3500);
    } else {
      setShowCodePreview(true);
      setShareStatus('Clipboard access blocked by browser. You can select and copy from the code box below.');
      setTimeout(() => setShareStatus(null), 5000);
    }
  };

  // Share QR Code Image via Web Share API
  const handleShareQrImage = async () => {
    setShareError(null);
    if (!qrDataUrl) return;

    try {
      // Convert data URL to Blob
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const qrFile = new File([blob], `QBS-Encrypted-QR.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [qrFile] })) {
        await navigator.share({
          title: 'QBS Encrypted QR Code',
          text: `Encrypted QR payload for "${filename}". Decrypt using QBS Secure Sound with shared password.`,
          files: [qrFile],
        });
        setShareStatus('QR Code shared successfully!');
        setTimeout(() => setShareStatus(null), 3000);
      } else if (navigator.share) {
        await navigator.share({
          title: 'QBS Encrypted QR Code',
          text: `Encrypted QR payload string:\n${payloadString}`,
        });
        setShareStatus('Payload shared successfully!');
        setTimeout(() => setShareStatus(null), 3000);
      } else {
        // Fallback: download image and copy text
        handleDownloadQrImage();
        handleCopyText(payloadString, 'qr-text');
        setShareStatus('Image saved & text copied (Web Share not supported in this browser).');
        setTimeout(() => setShareStatus(null), 4000);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        // Fallback
        handleDownloadQrImage();
        setShareStatus('QR image downloaded to device.');
        setTimeout(() => setShareStatus(null), 3000);
      }
    }
  };

  // Share Audio File via Web Share API
  const handleShareSound = async () => {
    setShareError(null);
    if (!soundBlob) return;

    try {
      const soundFile = new File([soundBlob], filename, { type: 'audio/wav' });

      if (navigator.canShare && navigator.canShare({ files: [soundFile] })) {
        await navigator.share({
          title: 'QBS Secure Sound',
          text: `Encrypted sound file (${filename}). Play or decode with QBS Secure Sound.`,
          files: [soundFile],
        });
        setShareStatus('Sound file shared successfully!');
        setTimeout(() => setShareStatus(null), 3000);
      } else if (navigator.share) {
        await navigator.share({
          title: 'QBS Secure Sound',
          text: `Encrypted sound file created with QBS Secure Sound.`,
        });
        setShareStatus('Sound link shared.');
        setTimeout(() => setShareStatus(null), 3000);
      } else {
        handleDownloadSound();
        setShareStatus('Audio file downloaded (Web Share not supported).');
        setTimeout(() => setShareStatus(null), 4000);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        handleDownloadSound();
        setShareStatus('Sound file downloaded to device.');
        setTimeout(() => setShareStatus(null), 3000);
      }
    }
  };

  // Download QR Code image
  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QBS-Encrypted-QR-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download Sound WAV
  const handleDownloadSound = () => {
    if (!soundBlob) return;
    const url = URL.createObjectURL(soundBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Portable .qbs Container File
  const handleDownloadContainer = () => {
    const blob = new Blob([rawPayload], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}.qbs`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShareStatus('Downloaded encrypted container (.qbs)');
    setTimeout(() => setShareStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Share Encrypted Data
              </h3>
              <p className="text-[11px] text-slate-500">
                Zero-knowledge transmission &bull; No password included
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {shareStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{shareStatus}</span>
          </div>
        )}

        {shareError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{shareError}</span>
          </div>
        )}

        {/* Option 1: QR Code Sharing */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Encrypted QR Code</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {isMultiPart ? `${frameCount} Sequenced Parts` : 'Optical Carrier'}
            </span>
          </div>

          {qrDataUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs flex-shrink-0">
                  <img src={qrDataUrl} alt="QR Code" className="w-16 h-16 object-contain" />
                </div>
                <div className="text-[11px] text-slate-600 leading-relaxed space-y-0.5">
                  <p className="font-semibold text-slate-800">
                    Self-Contained Encrypted QR Code
                  </p>
                  <p className="text-slate-500">
                    Scan directly with any camera or the built-in decoder.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {onOpenQrModal ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenQrModal();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View Full QR Code</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleShareQrImage}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share QR Image</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadQrImage}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save .PNG</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-100 rounded-xl text-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQrModal?.();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <QrCode className="w-4 h-4" />
                <span>Generate and View QR Code</span>
              </button>
            </div>
          )}
        </div>

        {/* Option 2: Acoustic Sound Carrier (.wav) */}
        {soundBlob && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">QBS Secure Sound (.wav)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {formatBytes(soundBlob.size)}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Full acoustic carrier encoding. Send over messaging apps, radio, or play through speaker.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShareSound}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Sound</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSound}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .WAV</span>
              </button>
            </div>
          </div>
        )}

        {/* Option 3: Text Code / Portable File */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Encrypted Payload String</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {formatBytes(rawPayload.length)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCopyText(payloadString, 'code')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              {copiedType === 'code' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadContainer}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save .QBS File</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowCodePreview(!showCodePreview)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              {showCodePreview ? 'Hide Raw Code' : 'View / Select Raw Code'}
            </button>
            {onOpenInDecoder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInDecoder();
                }}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold hover:underline"
              >
                Test in Decoder &rarr;
              </button>
            )}
          </div>

          {showCodePreview && (
            <div className="space-y-1.5 pt-1 animate-fade-in">
              <textarea
                readOnly
                rows={3}
                value={payloadString}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full p-2 text-[10px] font-mono bg-white border border-slate-300 rounded-lg text-slate-800 select-all focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-500">
                Click inside box to select all text, then copy manually (Ctrl+C / tap-and-hold).
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
          {onOpenInDecoder && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInDecoder();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test in Decoder</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
