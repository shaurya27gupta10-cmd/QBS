import { useState, useRef, useEffect, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { 
  KeyRound, Upload, FileAudio, Play, Pause, Copy, 
  Download, Trash2, AlertCircle, CheckCircle2, Eye, EyeOff, 
  Sparkles, Check, ArrowRight, ShieldAlert, FolderLock, 
  MessageSquare, Image, Video, Music, FileText, File as FileIcon, 
  Share2, RotateCcw, ShieldCheck, CheckCheck 
} from 'lucide-react';
import { extractPayloadFromWav } from '../lib/audioCodec';
import { decryptPayload, decryptFilePayload, base64ToBytes, inspectPayloadInfo, PayloadInfo } from '../lib/crypto';
import { AudioVisualizer } from './AudioVisualizer';
import { DecryptedFileResult } from '../types';

interface DecodeViewProps {
  initialFile?: {
    blob: Blob;
    filename: string;
    payload?: Uint8Array;
  } | null;
}

export function DecodeView({ initialFile }: DecodeViewProps) {
  const [sourceMode, setSourceMode] = useState<'audio' | 'qr'>('audio');
  const [qrText, setQrText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [extractedRawPayload, setExtractedRawPayload] = useState<Uint8Array | null>(null);

  // Automatic Type Detection State
  const [detectedInfo, setDetectedInfo] = useState<PayloadInfo | null>(null);

  // Password & Decryption State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Results
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null);
  const [decryptedFile, setDecryptedFile] = useState<DecryptedFileResult | null>(null);

  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Audio Playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (decryptedFile?.objectUrl) URL.revokeObjectURL(decryptedFile.objectUrl);
    };
  }, [audioUrl, decryptedFile]);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Inspect payload helper
  const analyzePayloadBytes = (payload: Uint8Array) => {
    try {
      const info = inspectPayloadInfo(payload);
      setDetectedInfo(info);
      setExtractedRawPayload(payload);
      return info;
    } catch (err) {
      setDetectedInfo(null);
      return null;
    }
  };

  const handleFileProcess = useCallback(async (file: File | Blob, name: string) => {
    setError(null);
    setDecryptedMessage(null);
    if (decryptedFile?.objectUrl) URL.revokeObjectURL(decryptedFile.objectUrl);
    setDecryptedFile(null);
    setDetectedInfo(null);
    setExtractedRawPayload(null);

    // Format check
    if (name && !name.toLowerCase().endsWith('.wav') && file.type && !file.type.includes('audio') && !file.type.includes('wav')) {
      setError('This audio format is not supported. Please use a QBS WAV file.');
      return;
    }

    if (typeof window !== 'undefined' && typeof window.File !== 'undefined' && file instanceof window.File) {
      setSelectedFile(file);
    }
    setFileBlob(file);
    setFileName(name);
    setFileSize(file.size);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Pre-parse the WAV container to detect payload type before password entry
    try {
      const buffer = await file.arrayBuffer();
      const payload = extractPayloadFromWav(buffer);
      analyzePayloadBytes(payload);
    } catch {
      // Ignore if user hasn't pressed decode yet; handleDecode will report full error
    }
  }, [audioUrl, decryptedFile]);

  // If initial file is provided via "Test Decode" from EncodeView
  useEffect(() => {
    if (initialFile) {
      handleFileProcess(initialFile.blob, initialFile.filename);
    }
  }, [initialFile, handleFileProcess]);

  // Handle QR text change and pre-detect
  const handleQrTextChange = (val: string) => {
    setQrText(val);
    setError(null);
    setDecryptedMessage(null);
    setDecryptedFile(null);
    const clean = val.trim().replace(/^QBS[1F]:/i, '');
    if (clean.length > 20) {
      try {
        const raw = base64ToBytes(clean);
        analyzePayloadBytes(raw);
      } catch {
        setDetectedInfo(null);
      }
    } else {
      setDetectedInfo(null);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileProcess(file, file.name);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileProcess(file, file.name);
    }
  };

  // Toggle Audio Playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error(err);
      });
    }
  };

  // Main Decode Pipeline
  const handleDecode = async () => {
    setError(null);
    setDecryptedMessage(null);
    if (decryptedFile?.objectUrl) URL.revokeObjectURL(decryptedFile.objectUrl);
    setDecryptedFile(null);

    if (sourceMode === 'audio' && !fileBlob) {
      setError('Please select or upload a QBS Secure Sound audio file first.');
      return;
    }

    if (sourceMode === 'qr' && !qrText.trim()) {
      setError('Please paste an encrypted QBS QR payload string first.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    setIsLoading(true);

    try {
      let payload: Uint8Array;

      if (sourceMode === 'audio') {
        // Step 1: Analyze audio
        setLoadingStep('Analyzing sound...');
        await new Promise((r) => setTimeout(r, 160));

        const arrayBuffer = await fileBlob!.arrayBuffer();

        // Step 2: Extract encrypted payload from RIFF WAV container
        setLoadingStep('Recovering encrypted payload...');
        await new Promise((r) => setTimeout(r, 160));

        payload = extractPayloadFromWav(arrayBuffer);
      } else {
        setLoadingStep('Parsing encrypted QR payload...');
        await new Promise((r) => setTimeout(r, 140));

        const cleanStr = qrText.trim().replace(/^QBS[1F]:/i, '');
        try {
          payload = base64ToBytes(cleanStr);
        } catch {
          throw new Error('This does not appear to be a valid QBS Secure Sound payload.');
        }
      }

      // Step 3: Inspect payload type
      const info = inspectPayloadInfo(payload);
      setDetectedInfo(info);

      // Step 4: Branch by type
      if (info.type === 'file') {
        setLoadingStep('Verifying integrity...');
        await new Promise((r) => setTimeout(r, 120));

        setLoadingStep('Decrypting file...');
        const fileResult = await decryptFilePayload(payload, password, (step) => {
          setLoadingStep(step);
        });

        setLoadingStep('Reconstructing original file...');
        await new Promise((r) => setTimeout(r, 120));

        setDecryptedFile(fileResult);
      } else {
        // Message mode
        setLoadingStep('Verifying integrity...');
        await new Promise((r) => setTimeout(r, 120));

        setLoadingStep('Decrypting message...');
        const plaintext = await decryptPayload(payload, password);
        setDecryptedMessage(plaintext);
      }
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to decrypt. Check the password or audio file.');
      }
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Copy decrypted message
  const handleCopyMessage = () => {
    if (!decryptedMessage) return;
    navigator.clipboard.writeText(decryptedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download decrypted message as .txt
  const handleDownloadText = () => {
    if (!decryptedMessage) return;
    const blob = new Blob([decryptedMessage], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QBS-Decrypted-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Decrypted File
  const handleDownloadFile = () => {
    if (!decryptedFile) return;
    const a = document.createElement('a');
    a.href = decryptedFile.objectUrl;
    a.download = decryptedFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Share Decrypted File
  const handleShareFile = async () => {
    if (!decryptedFile) return;
    try {
      const shareData = new File([decryptedFile.data], decryptedFile.filename, {
        type: decryptedFile.mimeType,
      });
      if (navigator.canShare && navigator.canShare({ files: [shareData] })) {
        await navigator.share({
          files: [shareData],
          title: decryptedFile.filename,
          text: `Decrypted file (${decryptedFile.filename})`,
        });
      } else {
        handleDownloadFile();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleDownloadFile();
      }
    }
  };

  // Clear state
  const handleClear = () => {
    if (decryptedFile?.objectUrl) URL.revokeObjectURL(decryptedFile.objectUrl);
    setDecryptedMessage(null);
    setDecryptedFile(null);
    setPassword('');
    setError(null);
  };

  const isFileType = detectedInfo?.type === 'file';

  return (
    <div className="py-6 sm:py-10 max-w-3xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Demodulator &amp; Decryptor</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Decode Secure Sound
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-600">
          Recover your encrypted message or file using the QBS sound and password.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8 space-y-6">
        {/* Source Mode Toggle Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl max-w-sm">
          <button
            type="button"
            onClick={() => setSourceMode('audio')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              sourceMode === 'audio'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sound File (.wav)
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('qr')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              sourceMode === 'qr'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            QR Payload Text
          </button>
        </div>

        {/* Upload Drop Zone (Audio Mode) */}
        {sourceMode === 'audio' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Upload QBS Sound (.wav)
            </label>
            <div
              id="audio-drop-zone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".wav,audio/wav,audio/x-wav"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium text-slate-800">
                  <span className="font-bold text-blue-600 hover:underline">Choose Audio File</span> or drop your QBS sound here
                </div>
                <p className="text-xs text-slate-500">
                  Supports official QBS WAV sound files generated by this application
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* QR Text Payload Mode */
          <div>
            <label htmlFor="decode-qr-input" className="block text-sm font-semibold text-slate-800 mb-2">
              Paste Encrypted QR Code Payload (QBS1:... or QBSF:...)
            </label>
            <textarea
              id="decode-qr-input"
              rows={4}
              value={qrText}
              onChange={(e) => handleQrTextChange(e.target.value)}
              placeholder="Paste the scanned QR code string (e.g. QBS1:UUIu... or QBSF:QUJTR...)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 font-mono text-xs sm:text-sm"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Paste the exact text string read from a QBS Encrypted QR code.
            </p>
          </div>
        )}

        {/* Selected File Details & Audio Preview */}
        {sourceMode === 'audio' && fileBlob && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {fileName || 'QBS-Secure-Sound.wav'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatBytes(fileSize)} &bull; Audio WAV Container
                  </div>
                </div>
              </div>

              {audioUrl && (
                <button
                  id="preview-audio-play-btn"
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white border border-slate-300 hover:border-slate-400 text-slate-700 flex items-center justify-center shadow-xs flex-shrink-0"
                  aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
              )}
            </div>

            {/* Audio Element & Waveform */}
            {audioUrl && (
              <>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
                />
                <AudioVisualizer audioElement={audioRef.current} isPlaying={isPlaying} />
              </>
            )}
          </div>
        )}

        {/* Automatic Payload Type Detection Badge */}
        {detectedInfo && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-xs sm:text-sm text-blue-900">
            {detectedInfo.type === 'file' ? (
              <FolderLock className="w-5 h-5 text-blue-600 flex-shrink-0" />
            ) : (
              <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
            )}
            <div className="truncate">
              {detectedInfo.type === 'file' ? (
                <span>
                  <strong className="font-semibold text-blue-950">QBS File detected:</strong>{' '}
                  {detectedInfo.filename || 'Encrypted File'} ({formatBytes(detectedInfo.originalSizeBytes || 0)})
                </span>
              ) : (
                <span>
                  <strong className="font-semibold text-blue-950">QBS Message detected</strong> (Encrypted text payload)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Password Input Section */}
        <div>
          <label htmlFor="decode-password-input" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Decryption Password
          </label>
          <div className="relative">
            <input
              id="decode-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDecode()}
              placeholder="Enter the password used to encrypt the sound"
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 text-sm sm:text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            The password is never stored or transmitted anywhere. Decryption runs exclusively in your browser.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Decryption Failed</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {isLoading && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div className="text-sm font-semibold">
              {loadingStep || 'Processing audio stream...'}
            </div>
          </div>
        )}

        {/* Action Button (Dynamic label: Decode Message or Decode File) */}
        <div>
          <button
            id="decode-message-btn"
            type="button"
            disabled={isLoading}
            onClick={handleDecode}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-base shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[48px]"
          >
            {isLoading ? (
              <span>Decrypting...</span>
            ) : (
              <>
                {isFileType ? <FolderLock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                <span>{isFileType ? 'Decode File' : 'Decode Message'}</span>
              </>
            )}
          </button>
        </div>

        {/* Decrypted Message Success Display */}
        {decryptedMessage !== null && (
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-base font-bold text-slate-900">
                  Message successfully decrypted.
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Authenticated AES-256
              </span>
            </div>

            {/* Plaintext Container */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 shadow-inner">
              <p className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap font-sans select-all break-words">
                {decryptedMessage}
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  id="copy-message-btn"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Message'}</span>
                </button>

                <button
                  id="download-text-btn"
                  onClick={handleDownloadText}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Text (.txt)</span>
                </button>
              </div>

              <button
                id="clear-message-btn"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Message</span>
              </button>
            </div>
          </div>
        )}

        {/* Decrypted File Success Display */}
        {decryptedFile !== null && (
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-base font-bold text-slate-900">
                  File successfully decrypted.
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Integrity Verified &bull; Exact Byte Match
              </span>
            </div>

            {/* File Info Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                  {decryptedFile.mimeType.startsWith('image/') ? (
                    <Image className="w-5 h-5" />
                  ) : decryptedFile.mimeType.startsWith('video/') ? (
                    <Video className="w-5 h-5" />
                  ) : decryptedFile.mimeType.startsWith('audio/') ? (
                    <Music className="w-5 h-5" />
                  ) : decryptedFile.mimeType.includes('pdf') || decryptedFile.mimeType.includes('document') ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <FileIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {decryptedFile.filename}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{formatBytes(decryptedFile.sizeBytes)}</span>
                    <span>&bull;</span>
                    <span className="truncate">{decryptedFile.mimeType}</span>
                  </div>
                </div>
              </div>

              {/* Type-Specific Preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 overflow-hidden">
                {decryptedFile.mimeType.startsWith('image/') ? (
                  <div className="flex justify-center max-h-72 overflow-hidden rounded-lg">
                    <img
                      src={decryptedFile.objectUrl}
                      alt={decryptedFile.filename}
                      className="max-h-72 object-contain rounded-lg shadow-2xs"
                    />
                  </div>
                ) : decryptedFile.mimeType.startsWith('video/') ? (
                  <video
                    src={decryptedFile.objectUrl}
                    controls
                    className="w-full max-h-72 rounded-lg bg-black"
                  />
                ) : decryptedFile.mimeType.startsWith('audio/') ? (
                  <audio
                    src={decryptedFile.objectUrl}
                    controls
                    className="w-full mt-1"
                  />
                ) : decryptedFile.mimeType.includes('pdf') ? (
                  <iframe
                    src={decryptedFile.objectUrl}
                    title={decryptedFile.filename}
                    className="w-full h-80 rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="flex items-center gap-3 py-3 px-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <FileIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 block">Binary / Document File</span>
                      <span>Decrypted file is ready for download.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* File Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  id="download-file-btn"
                  onClick={handleDownloadFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </button>

                <button
                  id="share-file-btn"
                  onClick={handleShareFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs sm:text-sm font-semibold shadow-xs transition-colors min-h-[40px]"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Share File</span>
                </button>
              </div>

              <button
                id="clear-file-btn"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Decode Another</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Statement */}
      <div className="mt-6 p-4 rounded-xl bg-slate-100/60 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>Decryption runs entirely client-side using Web Crypto API. Your decrypted files never leave your browser.</span>
      </div>
    </div>
  );
}
