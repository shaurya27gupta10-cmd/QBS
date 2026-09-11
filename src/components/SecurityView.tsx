import { ShieldCheck, Lock, AlertTriangle, Key, Cpu, FileCheck, CheckCircle2 } from 'lucide-react';

export function SecurityView() {
  return (
    <div className="py-6 sm:py-10 max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Transparent Cryptographic Architecture</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Security & Cryptography
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          Built strictly on open, industry-standard cryptographic algorithms provided by the W3C Web Crypto API.
        </p>
      </div>

      {/* Honest Language Notice */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <span>Honest Security Commitment</span>
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          We do not claim &ldquo;100% unhackable&rdquo; or use deceptive marketing buzzwords. Cryptography is an exact mathematical science. Security in QBS Secure Sound rests entirely on standard symmetric ciphers and key derivation functions with sufficient entropy:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-bold text-slate-900 block">Strong Passwords Matter</span>
            <span className="text-slate-600 block">
              Because PBKDF2 derives the key from your password, a short or common password is vulnerable to dictionary attacks. Use long, unique passphrases.
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-bold text-slate-900 block">No Password Recovery</span>
            <span className="text-slate-600 block">
              If you lose the password used during encoding, your message is mathematically unrecoverable. There is no backdoor, master key, or recovery service.
            </span>
          </div>
        </div>
      </div>

      {/* Technical Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AES-GCM */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">AES-256-GCM Authenticated Encryption</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Galois/Counter Mode (GCM) combines the AES symmetric block cipher with a polynomial authentication tag (GMAC). It provides both confidentiality and tamper detection.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>256-bit symmetric encryption keys</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>128-bit authentication tag guarantees message integrity</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Cryptographically random 12-byte initialization vector (IV) per encryption</span>
            </li>
          </ul>
        </div>

        {/* PBKDF2 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">PBKDF2 Key Derivation</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Passwords cannot be directly used as AES keys. PBKDF2 (Password-Based Key Derivation Function 2) strengthens passphrases against brute-force searches.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>100,000 iterations using HMAC-SHA-256</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Random 16-byte cryptographic salt prevents rainbow table lookups</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Salt & IV are stored publicly in the container (they are non-secret)</span>
            </li>
          </ul>
        </div>

        {/* Browser Native */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Zero Server Transmission</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            All encryption, audio synthesis, file generation, demodulation, and decryption run locally inside your browser via the hardware-accelerated Web Crypto API.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>No telemetry, tracking, or network requests</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Plaintext and password never touch localStorage or cookies</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Runs completely offline if disconnected from internet</span>
            </li>
          </ul>
        </div>

        {/* Binary Container */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Payload Container Specification</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            The serialized byte format is strictly defined to prevent truncation and ensure backward compatibility:
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800 space-y-1 overflow-x-auto">
            <div>[00..03] Magic Header: 0x51 0x42 0x53 0x31 (&quot;QBS1&quot;)</div>
            <div>[04] Version: 0x01</div>
            <div>[05] Algorithm ID: 0x01 (AES-256-GCM / PBKDF2)</div>
            <div>[06..21] Salt: 16 bytes (Cryptographically random)</div>
            <div>[22..33] IV / Nonce: 12 bytes (Cryptographically random)</div>
            <div>[34..37] Ciphertext Length (Uint32 Big-Endian)</div>
            <div>[38..N] Ciphertext + 16-byte GCM Auth Tag</div>
            <div>[N+1..N+4] CRC32 Checksum (Uint32 Big-Endian)</div>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-amber-900 space-y-1">
          <span className="font-bold block">Important Security Rules to Remember</span>
          <p>
            Do not share the password alongside the audio file in the same channel (e.g. sending both in the same chat message defeats encryption). Use an out-of-band channel (e.g. in-person, phone call, or a separate encrypted channel) to share the password.
          </p>
        </div>
      </div>
    </div>
  );
}
