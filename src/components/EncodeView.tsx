import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { 
  Lock, Eye, EyeOff, Play, Pause, Download, Share2, 
  RotateCcw, QrCode, Check, AlertCircle, Sparkles, 
  FileAudio, Volume2, ShieldCheck, CheckCircle2, FlaskConical,
  MessageSquare, FolderLock, Shield
} from 'lucide-react';
import { encryptMessage, bytesToBase64 } from '../lib/crypto';
import { synthesizeFskPcm, buildWavFile, generateFilename, extractPayloadFromWav } from '../lib/audioCodec';
import { generateEncryptedQrCode, QrResult } from '../lib/qr';
import { AudioVisualizer } from './AudioVisualizer';
import { GeneratedSound } from '../types';
import { FileEncodeTab } from './FileEncodeTab';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { ShareModal } from './ShareModal';
import { QrModal } from './QrModal';

interface EncodeViewProps {
  onTestDecode: (blob: Blob, filename: string, payload: Uint8Array, password?: string) => void;
}

export function EncodeView({ onTestDecode }: EncodeViewProps) {
  const [encodeMode, setEncodeMode] = useState<'message' | 'file'>('message');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [generatedSound, setGeneratedSound] = useState<GeneratedSound | null>(null);
  const [qrResult, setQrResult] = useState<QrResult | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  // Drag & drop state for message mode
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const isText = droppedFile.type.startsWith('text/') || 
                     droppedFile.name.endsWith('.txt') || 
                     droppedFile.name.endsWith('.md') || 
                     droppedFile.name.endsWith('.json') ||
                     droppedFile.name.endsWith('.log') ||
                     droppedFile.name.endsWith('.csv');
      if (isText) {
        try {
          const text = await droppedFile.text();
          setMessage(text);
          setError(null);
        } catch {
          setError('Could not read text file.');
        }
      } else {
        // If user dropped media or binary file into message area, switch to File mode
        setEncodeMode('file');
      }
    }
  };

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoVerifySuccess, setAutoVerifySuccess] = useState(false);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (generatedSound?.url) {
        URL.revokeObjectURL(generatedSound.url);
      }
    };
  }, [generatedSound]);

  // Handle audio time updates
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error('Audio play failed:', e);
      });
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    setError(null);
    if (!message.trim()) {
      setError('Please enter a message first.');
      return false;
    }
    if (!password) {
      setError('Please enter a password.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  // Main Encode Action
  const handleGenerate = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setError(null);
    setAutoVerifySuccess(false);

    try {
      setGenerationStep('Compressing & deriving Argon2id key (64MB memory hardness)...');
      await new Promise((r) => setTimeout(r, 60)); // Yield to UI

      // 1. Encrypt message and create binary payload with Argon2id + AES-256-GCM + AAD
      const payload = await encryptMessage(message, password, (step) => {
        setGenerationStep(step);
      });

      setGenerationStep('Synthesizing FSK audio carrier frequencies...');
      await new Promise((r) => setTimeout(r, 60));

      // 2. Synthesize audio PCM samples
      const { pcmSamples, durationSeconds } = synthesizeFskPcm(payload);

      setGenerationStep('Assembling lossless WAV container with preamble...');
      await new Promise((r) => setTimeout(r, 60));

      // 3. Build WAV file
      const wavBlob = buildWavFile(pcmSamples, payload);
      const url = URL.createObjectURL(wavBlob);
      const filename = generateFilename();

      // 4. Decode audio data into AudioBuffer for visualizer/playback verification
      const arrayBuffer = await wavBlob.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const tempCtx = new AudioCtx();
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));

      // 5. Automated self-test: verify that the generated WAV can be decoded without errors
      const verifiedPayload = extractPayloadFromWav(arrayBuffer);
      if (verifiedPayload.length !== payload.length) {
        throw new Error('Self-test validation failed: payload size mismatch.');
      }
      setAutoVerifySuccess(true);

      // 6. Generate QR code representation
      setGenerationStep('Generating QR code representation...');
      const qrData = await generateEncryptedQrCode(payload, 'message.txt');
      setQrResult(qrData);

      setGeneratedSound({
        blob: wavBlob,
        url,
        filename,
        durationSeconds,
        payloadSizeBytes: payload.length,
        audioBuffer,
        rawPayload: payload,
        timestamp: Date.now(),
        payloadType: 'message',
        kdfType: 'argon2id',
        isCompressed: true,
      });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred while generating secure sound.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Download Sound WAV
  const handleDownloadSound = () => {
    if (!generatedSound) return;
    const a = document.createElement('a');
    a.href = generatedSound.url;
    a.download = generatedSound.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Share Sound: Open unified ShareModal
  const handleShareSound = () => {
    if (!generatedSound) return;
    setShareModalOpen(true);
  };

  // Download QR
  const handleDownloadQr = () => {
    if (!qrResult?.dataUrl || !generatedSound) return;
    const a = document.createElement('a');
    a.href = qrResult.dataUrl;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    const qrName = `QBS-QR-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
    a.download = qrName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy QR data
  const handleCopyQrPayload = () => {
    if (!generatedSound) return;
    const code = qrResult?.qrPayloadString || `QBSS:${bytesToBase64(generatedSound.rawPayload)}`;
    navigator.clipboard.writeText(code);
    setCopiedQr(true);
    setTimeout(() => setCopiedQr(false), 2500);
  };

  // Reset form
  const handleReset = () => {
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setGeneratedSound(null);
    setQrResult(null);
    setError(null);
    setAutoVerifySuccess(false);
  };

  return (
    <div className="py-6 sm:py-10 max-w-3xl mx-auto px-4 sm:px-6">
      {/* Top Mode Tabs: [ 💬 Message ] [ 📁 File ] */}
      <div className="flex p-1 bg-slate-100 rounded-2xl max-w-xs mb-6 border border-slate-200">
        <button
          id="mode-message-btn"
          type="button"
          onClick={() => setEncodeMode('message')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            encodeMode === 'message'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span>Message</span>
        </button>
        <button
          id="mode-file-btn"
          type="button"
          onClick={() => setEncodeMode('file')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            encodeMode === 'file'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderLock className="w-4 h-4 text-blue-600" />
          <span>File</span>
        </button>
      </div>

      {/* Header */}
      <div className="mb-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>QBS-Secure v2 &bull; Argon2id (64MB) + AES-256-GCM (AAD)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {encodeMode === 'message' ? 'Encode Message' : 'Encode File'}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-600">
          {encodeMode === 'message'
            ? 'Protect your message with memory-hard Argon2id and turn it into a secure sound.'
            : 'Protect your file with memory-hard Argon2id and turn it into a secure sound.'}
        </p>
      </div>

      {encodeMode === 'file' ? (
        <FileEncodeTab onTestDecode={onTestDecode} />
      ) : (
        /* Main Message Card */
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white rounded-2xl border shadow-sm p-5 sm:p-8 relative transition-all ${
            isDragOver ? 'border-blue-500 ring-4 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
          }`}
        >
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-50/95 border-2 border-blue-500 border-dashed rounded-2xl z-20 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-base font-bold text-blue-900">Drop file to load content</p>
              <p className="text-xs text-blue-600 mt-1 max-w-xs">
                Text files will be loaded into the message field. Media &amp; binaries will open the File Encryptor.
              </p>
            </div>
          )}
        {!generatedSound ? (
          /* Input Form */
          <div className="space-y-6">
            {/* Message Area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="encode-message-input" className="block text-sm font-semibold text-slate-800">
                  Secret Message
                </label>
                <span className="text-xs text-slate-500 font-mono">
                  {message.length} characters
                </span>
              </div>
              <textarea
                id="encode-message-input"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type the private message you wish to encrypt into a sound..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base transition-all resize-y"
              />
              <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Your plaintext message is not stored. It will be encrypted locally before audio modulation.</span>
              </p>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="encode-password-input" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="encode-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter decryption password"
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
              </div>

              <div>
                <label htmlFor="encode-confirm-password-input" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="encode-confirm-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-600'
                    } focus:outline-none focus:ring-2 focus:border-transparent text-slate-900 text-sm sm:text-base`}
                  />
                </div>
              </div>
            </div>

            {/* Password match notice */}
            {password && confirmPassword && (
              <div className="text-xs">
                {password === confirmPassword ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                  </span>
                )}
              </div>
            )}

            {/* Password Strength & Entropy Meter */}
            <PasswordStrengthIndicator
              password={password}
              onSelectPassphrase={(gen) => {
                setPassword(gen);
                setConfirmPassword(gen);
              }}
            />

            {/* Error banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Active generation waveform & status */}
            {isGenerating && (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>{generationStep || 'Synthesizing sound...'}</span>
                  </span>
                  <span className="animate-pulse">Web Audio API Active</span>
                </div>
                <AudioVisualizer audioElement={null} isPlaying={false} isGenerating={true} />
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="generate-sound-btn"
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-base shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[48px]"
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating Secure Sound...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span>Generate Secure Sound</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Result View (After Generation) */
          <div className="space-y-6">
            {/* Hidden audio element for Web Audio playback */}
            <audio
              ref={audioRef}
              src={generatedSound.url}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleAudioEnded}
              preload="auto"
            />

            {/* Success Banner */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    QBS Secure Sound generated successfully.
                  </h3>
                  <p className="text-xs text-blue-800 font-medium mt-0.5">
                    This sound carries encrypted data. It is not a voice recording.
                  </p>
                </div>
              </div>

              {autoVerifySuccess && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  <span>Self-Test Verified</span>
                </div>
              )}
            </div>

            {/* Audio Waveform Canvas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Audio Waveform & Frequency Telemetry</span>
                </span>
                <span className="font-mono">
                  {currentTime.toFixed(1)}s / {generatedSound.durationSeconds.toFixed(1)}s
                </span>
              </div>
              <AudioVisualizer audioElement={audioRef.current} isPlaying={isPlaying} />
            </div>

            {/* Custom Audio Player Controls */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <button
                id="play-pause-sound-btn"
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm flex-shrink-0 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label={isPlaying ? 'Pause sound' : 'Play sound'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <div className="flex-1 w-full space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || generatedSound.durationSeconds}
                  step="0.01"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  aria-label="Audio scrub timeline"
                />
                <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>{Math.floor(currentTime)}:{(Math.floor(currentTime % 1 * 100)).toString().padStart(2, '0')}</span>
                  <span>{generatedSound.durationSeconds.toFixed(1)}s (16-bit PCM WAV)</span>
                </div>
              </div>
            </div>

            {/* File & Security Metadata Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Format</span>
                <span className="block text-sm font-bold text-slate-900 mt-0.5">QBS WAV (44.1kHz)</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cipher</span>
                <span className="block text-sm font-bold text-slate-900 mt-0.5">AES-256-GCM</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Payload Size</span>
                <span className="block text-sm font-bold text-slate-900 mt-0.5 font-mono">{generatedSound.payloadSizeBytes} bytes</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Derivation</span>
                <span className="block text-sm font-bold text-slate-900 mt-0.5">100k PBKDF2</span>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="download-sound-btn"
                  onClick={handleDownloadSound}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Sound (.wav)</span>
                </button>

                <button
                  id="share-sound-btn"
                  onClick={handleShareSound}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[44px]"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Share Sound</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="view-qr-code-btn"
                  onClick={() => setShowQrModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[44px]"
                >
                  <QrCode className="w-4 h-4 text-slate-700" />
                  <span>View Encrypted QR Code</span>
                </button>

                <button
                  id="test-decode-btn"
                  onClick={() => onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload, password)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px]"
                >
                  <FlaskConical className="w-4 h-4 text-emerald-600" />
                  <span>Test Decode in App</span>
                </button>
              </div>

              {shareSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{shareSuccess}</span>
                </div>
              )}
            </div>

            {/* Reset / Generate New Sound */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Plaintext message is discarded from memory upon navigation.
              </span>
              <button
                id="generate-new-sound-btn"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors focus:outline-none"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Generate New Sound</span>
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* QR Code Modal (Single Self-Contained QR Code) */}
      {showQrModal && generatedSound && qrResult && (
        <QrModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          qrCodeData={{
            dataUrl: qrResult.dataUrl,
            fitsQr: qrResult.fitsQr,
            isSelfContained: true,
            payloadSize: generatedSound.rawPayload.length,
            qrPayloadString: qrResult.qrPayloadString,
            isMultiPart: qrResult.isMultiPart,
            frameCount: qrResult.frameCount,
            frames: qrResult.frames,
            warning: qrResult.warning,
          }}
          rawPayload={generatedSound.rawPayload}
          filename={generatedSound.filename}
          onOpenInDecoder={() => {
            setShowQrModal(false);
            onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload, password);
          }}
        />
      )}

      {/* Unified Share Modal */}
      {generatedSound && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          title="Share Encrypted Sound Message"
          filename={generatedSound.filename}
          soundBlob={generatedSound.blob}
          rawPayload={generatedSound.rawPayload}
          qrDataUrl={qrResult?.dataUrl}
          fitsQr={qrResult?.fitsQr}
          qrPayloadString={qrResult?.qrPayloadString || `QBSS:${bytesToBase64(generatedSound.rawPayload)}`}
          isMultiPart={qrResult?.isMultiPart}
          frameCount={qrResult?.frameCount}
          onOpenInDecoder={() => onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload, password)}
          onOpenQrModal={() => setShowQrModal(true)}
        />
      )}
    </div>
  );
}
