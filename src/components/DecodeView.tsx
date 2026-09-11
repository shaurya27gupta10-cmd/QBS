import { useState, useRef, useEffect, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { 
  KeyRound, Upload, FileAudio, Play, Pause, Copy, 
  Download, Trash2, AlertCircle, CheckCircle2, Eye, EyeOff, 
  Sparkles, Check, ArrowRight, ShieldAlert 
} from 'lucide-react';
import { extractPayloadFromWav } from '../lib/audioCodec';
import { decryptPayload, base64ToBytes } from '../lib/crypto';
import { AudioVisualizer } from './AudioVisualizer';

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
  
  // Password & Decryption State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Audio Playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // If initial file is provided via "Test Decode" from EncodeView
  useEffect(() => {
    if (initialFile) {
      setFileBlob(initialFile.blob);
      setFileName(initialFile.filename);
      setFileSize(initialFile.blob.size);
      const url = URL.createObjectURL(initialFile.blob);
      setAudioUrl(url);
      setDecryptedMessage(null);
      setError(null);
    }
  }, [initialFile]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleFileProcess = useCallback((file: File | Blob, name: string) => {
    setError(null);
    setDecryptedMessage(null);

    // Basic format check
    if (name && !name.toLowerCase().endsWith('.wav') && file.type && !file.type.includes('audio') && !file.type.includes('wav')) {
      setError('This audio format is not supported. Please use a QBS WAV file.');
      return;
    }

    if (file instanceof File) {
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
  }, [audioUrl]);

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
        setLoadingStep('Analyzing secure sound...');
        await new Promise((r) => setTimeout(r, 180));

        const arrayBuffer = await fileBlob!.arrayBuffer();

        // Step 2: Demodulate / Recover encrypted payload
        setLoadingStep('Recovering encrypted payload...');
        await new Promise((r) => setTimeout(r, 180));

        payload = extractPayloadFromWav(arrayBuffer);
      } else {
        setLoadingStep('Parsing encrypted QR payload...');
        await new Promise((r) => setTimeout(r, 150));

        const cleanStr = qrText.trim().replace(/^QBS1:/i, '');
        try {
          payload = base64ToBytes(cleanStr);
        } catch {
          throw new Error('This does not appear to be a valid QBS Secure Sound payload.');
        }
      }

      // Step 3: Decrypt using Web Crypto PBKDF2 + AES-GCM
      setLoadingStep('Decrypting message...');
      await new Promise((r) => setTimeout(r, 220));

      const plaintext = await decryptPayload(payload, password);

      setDecryptedMessage(plaintext);
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

  // Clear message and state
  const handleClear = () => {
    setDecryptedMessage(null);
    setPassword('');
    setError(null);
  };

  return (
    <div className="py-6 sm:py-10 max-w-3xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Demodulator & Decryptor</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Decode Secure Sound
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-600">
          Recover your encrypted message using the QBS sound and password.
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
              Paste Encrypted QR Code Payload (QBS1:...)
            </label>
            <textarea
              id="decode-qr-input"
              rows={4}
              value={qrText}
              onChange={(e) => setQrText(e.target.value)}
              placeholder="Paste the scanned QR code string (e.g. QBS1:UUIu...)"
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
                    {(fileSize / 1024).toFixed(1)} KB &bull; Audio WAV Container
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
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Decryption Failed</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {isLoading && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3 animate-pulse">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div className="text-sm font-semibold">
              {loadingStep || 'Processing audio stream...'}
            </div>
          </div>
        )}

        {/* Action Button */}
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
                <KeyRound className="w-5 h-5" />
                <span>Decode Message</span>
              </>
            )}
          </button>
        </div>

        {/* Decrypted Message Success Display */}
        {decryptedMessage !== null && (
          <div className="pt-6 border-t border-slate-200 space-y-4 animate-fade-in">
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

            <p className="text-xs text-slate-500 pt-1">
              Never store the decrypted message permanently unless you explicitly choose to download or copy it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
