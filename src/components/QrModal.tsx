import { useState } from 'react';
import {
  X,
  QrCode,
  Download,
  Copy,
  Check,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import type { QrCodeData } from '../types';
import { bytesToBase64 } from '../lib/crypto';
import { copyTextToClipboard } from '../lib/clipboard';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeData: QrCodeData | null;
  rawPayload: Uint8Array;
  filename?: string;
  onOpenInDecoder?: () => void;
}

export function QrModal({
  isOpen,
  onClose,
  qrCodeData,
  rawPayload,
  filename = 'file',
  onOpenInDecoder,
}: QrModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen || !qrCodeData) return null;

  const qrPayloadString = qrCodeData.qrPayloadString || '';
  const opticalCode = qrCodeData.frames[0]?.payloadString || qrPayloadString;
  const isFile = qrPayloadString.startsWith('QBSF:') || opticalCode.startsWith('QBSF:');

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Full standalone Base64 string
  const fullBase64Code =
    qrPayloadString ||
    (isFile ? `QBSF:${bytesToBase64(rawPayload)}` : `QBSS:${bytesToBase64(rawPayload)}`);

  // Primary Copy: Copies the exact decodable QR code text (opticalCode, which is reference or base64)
  const handleCopyCode = async () => {
    const codeToCopy = opticalCode || fullBase64Code;
    const res = await copyTextToClipboard(codeToCopy);
    if (res.success) {
      setCopiedCode(true);
      setStatusMessage(
        isFile
          ? 'Copied QBSF encrypted code to clipboard! You can paste it directly into the Decoder.'
          : 'Copied QBS encrypted code to clipboard! You can paste it directly into the Decoder.'
      );
    } else {
      setStatusMessage('Clipboard access restricted. Please use the "Test in Decoder" button below.');
    }
    setTimeout(() => {
      setCopiedCode(false);
      setStatusMessage(null);
    }, 4000);
  };

  // Download single QR PNG
  const handleDownloadQrPng = () => {
    if (!qrCodeData.dataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeData.dataUrl;
    const base = filename.replace(/\.[^/.]+$/, '');
    a.download = `QBS-QR-${base}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage('QR code PNG downloaded successfully!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                <span>Encrypted QR Code</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {isFile ? 'QBSF' : 'QBSS'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Single self-contained optical carrier
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

        {/* Status Toast */}
        {statusMessage && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* QR Code Canvas Card */}
        <div className="text-center space-y-3">
          <div className="relative p-3.5 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
            {qrCodeData.dataUrl ? (
              <img
                src={qrCodeData.dataUrl}
                alt="Encrypted QBS QR Code"
                className="w-60 h-60 sm:w-68 sm:h-68 mx-auto object-contain rounded-lg shadow-xs"
              />
            ) : (
              <div className="w-60 h-60 flex items-center justify-center bg-slate-100 rounded-lg">
                <QrCode className="w-16 h-16 text-slate-400 animate-pulse" />
              </div>
            )}
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Scan with any camera or the Decode tab</span>
            </div>
          </div>

          {/* Payload Size & Safety Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Payload Format:</span>
              <span className="font-mono font-bold text-blue-700">
                {isFile ? 'QBSF (File Payload)' : 'QBSS (Sound/Message Payload)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Ciphertext Size:</span>
              <span className="font-bold text-slate-900">{formatBytes(rawPayload.length)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Security:</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AES-256-GCM + Argon2id
              </span>
            </div>
          </div>

          {/* Action Buttons Grid: Download QR (.PNG) and Copy Code */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Download QR PNG */}
            <button
              type="button"
              onClick={handleDownloadQrPng}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download QR (.PNG)</span>
            </button>

            {/* Copy Encrypted String */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors border border-slate-300"
              title="Copies the exact code that decodes instantly"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied {isFile ? 'QBSF' : 'QBS'}!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy {isFile ? 'QBSF' : 'QBS'} Code</span>
                </>
              )}
            </button>
          </div>

          {/* Test in Decoder Option */}
          {onOpenInDecoder && (
            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInDecoder();
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                <span>Test in Decoder</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
