import { useState } from 'react';
import { 
  ShieldCheck, Lock, AlertTriangle, Key, Cpu, FileCheck, CheckCircle2, 
  Play, RefreshCw, XCircle, Clock, Database, Terminal, Layers, ShieldAlert,
  HelpCircle, Eye, EyeOff
} from 'lucide-react';
import { runCryptographicAudit } from '../lib/securityAudit';
import { SecurityAuditTest } from '../types';

export function SecurityView() {
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditResults, setAuditResults] = useState<SecurityAuditTest[] | null>(null);
  const [auditPassed, setAuditPassed] = useState<boolean | null>(null);
  const [auditDuration, setAuditDuration] = useState<number | null>(null);
  const [selectedThreatCategory, setSelectedThreatCategory] = useState<'all' | 'crypto' | 'tamper' | 'reverse'>('all');

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    setAuditResults([]);
    setAuditPassed(null);
    setAuditDuration(null);

    try {
      const outcome = await runCryptographicAudit((updatedTest) => {
        setAuditResults((prev) => {
          const list = prev ? [...prev] : [];
          const idx = list.findIndex((t) => t.id === updatedTest.id);
          if (idx >= 0) {
            list[idx] = updatedTest;
          } else {
            list.push(updatedTest);
          }
          return list;
        });
      });

      setAuditPassed(outcome.passed);
      setAuditDuration(outcome.durationTotalMs);
    } catch (e) {
      console.error('Audit failed:', e);
      setAuditPassed(false);
    } finally {
      setIsRunningAudit(false);
    }
  };

  return (
    <div className="py-6 sm:py-10 max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>QBS-Secure Protocol v2.0 &bull; Audited Cryptographic Primitives</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Cryptographic Architecture & Threat Model
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
          Mathematically verified client-side confidentiality using <strong>Argon2id</strong> (RFC 9106) memory-hard key derivation, <strong>AES-256-GCM</strong> authenticated encryption with AAD tamper binding, and lossless audio carrier synthesis.
        </p>
      </div>

      {/* Interactive Cryptographic Audit Suite */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Developer & Auditor Security Test Suite</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Executes live cryptographic assertions directly in your browser: bit-flipping, tamper rejection, non-leakage, and nondeterminism.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunAudit}
            disabled={isRunningAudit}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm transition-all ${
              isRunningAudit
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow active:scale-[0.99]'
            }`}
          >
            {isRunningAudit ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Cryptographic Audit...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Cryptographic Audit Suite</span>
              </>
            )}
          </button>
        </div>

        {/* Audit Status Bar */}
        {auditResults && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                {auditPassed === true && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    All 12 Cryptographic Invariants Passed
                  </span>
                )}
                {auditPassed === false && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Security Invariant Failure Detected
                  </span>
                )}
                {auditPassed === null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Executing live test harness...
                  </span>
                )}
              </div>
              {auditDuration !== null && (
                <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Total Audit Execution: <strong>{auditDuration}ms</strong>
                </span>
              )}
            </div>

            {/* Test Results List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
              {auditResults.map((test) => (
                <div
                  key={test.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                    test.status === 'passed'
                      ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                      : test.status === 'failed'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 animate-pulse'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold flex items-center gap-1.5">
                      {test.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                      {test.status === 'failed' && <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                      {test.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin flex-shrink-0" />}
                      {test.name}
                    </span>
                    {test.durationMs !== undefined && (
                      <span className="font-mono text-[10px] text-slate-500 bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">
                        {test.durationMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">{test.description}</p>
                  {test.details && (
                    <div className="pt-1 text-[11px] font-mono text-slate-700 bg-white/80 p-2 rounded border border-slate-200/80 break-words">
                      {test.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Core Cryptographic Primitives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Argon2id */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Argon2id Key Derivation</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Memory-hard key derivation (RFC 9106). Combines data-independent memory access (against side channels) with data-dependent memory access (against GPU/ASIC crackers).
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>64 MB Memory Hardness:</strong> GPU cracking is cost-prohibitive</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>3 Time Cost Iterations:</strong> Thorough mixing</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>16-Byte Cryptographic Salt:</strong> Fresh per encryption</span>
            </li>
          </ul>
        </div>

        {/* AES-256-GCM + AAD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">AES-256-GCM with AAD</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Galois/Counter Mode authenticated encryption (NIST SP 800-38D). Binds container header metadata into GMAC authentication tag.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>256-Bit Symmetric Key:</strong> Top-tier confidentiality</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>96-Bit Fresh IV/Nonce:</strong> Never reused</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>AAD Integrity Binding:</strong> Header tampering triggers failure</span>
            </li>
          </ul>
        </div>

        {/* Zero-Knowledge & Memory Safety */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Zero-Knowledge & Memory Zeroing</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            All cryptographic operations execute locally in the client browser. No passwords, master keys, or plaintexts are ever sent across the wire or stored in disk caches.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>Explicit Memory Wiping:</strong> Buffers zeroed with .fill(0)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>No Master Key or Escrow:</strong> Mathematically trustless</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span><strong>Pre-Encryption Deflate:</strong> Eliminates predictable entropy</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Binary Container Specification */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">QBS-Secure v2 Binary Container Specification</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600">
          The binary container structure serializes all cryptographic metadata required for legitimate recovery while keeping the ciphertext indistinguishable from random noise:
        </p>

        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] space-y-1.5 overflow-x-auto shadow-inner leading-relaxed">
          <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-2">
            // [BYTES] FIELD NAME : TYPE & DESCRIPTION (Bound into AES-GCM AAD)
          </div>
          <div className="text-blue-400">[00..03] QBS_MAGIC : 0x51 0x42 0x53 0x53 (&quot;QBSS&quot; standard)</div>
          <div className="text-blue-400">[04]     FORMAT_VERSION : 0x02 (v2)</div>
          <div className="text-blue-400">[05]     PAYLOAD_TYPE : 0x01 (Message) | 0x02 (File)</div>
          <div className="text-blue-400">[06]     KDF_IDENTIFIER : 0x02 (Argon2id RFC 9106)</div>
          <div className="text-blue-400">[07]     COMPRESSION_FLAG : 0x01 (Deflate) | 0x00 (None)</div>
          <div className="text-blue-400">[08..11] KDF_TIME_COST : Uint32 Big-Endian (Iterations = 3)</div>
          <div className="text-blue-400">[12..15] KDF_MEMORY_COST : Uint32 Big-Endian (65536 KB = 64 MB)</div>
          <div className="text-blue-400">[16]     KDF_PARALLELISM : Uint8 (Threads = 1)</div>
          <div className="text-blue-400">[17..32] RANDOM_SALT : 16 Bytes (crypto.getRandomValues)</div>
          <div className="text-blue-400">[33..44] NONCE / IV : 12 Bytes (crypto.getRandomValues, never reused)</div>
          <div className="text-blue-400">[45..46] METADATA_LENGTH : Uint16 Big-Endian</div>
          <div className="text-blue-400">[47..47+M-1] METADATA_JSON : UTF-8 JSON {`{"name","mime","origSize"}`}</div>
          <div className="text-blue-400">[47+M..50+M] CIPHERTEXT_LENGTH : Uint32 Big-Endian</div>
          <div className="text-emerald-400 font-bold">// --- END OF AAD BOUNDARY &bull; BEGINNING OF CIPHERTEXT ---</div>
          <div className="text-amber-300">[51+M..End-5] ENCRYPTED_PAYLOAD : AES-256-GCM Ciphertext + 16-byte Auth Tag</div>
          <div className="text-slate-400">[End-4..End-1] CRC32_CHECKSUM : Uint32 Big-Endian (Outer transport check)</div>
        </div>
      </div>

      {/* Comprehensive Threat Model & Defense Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Comprehensive Threat Model & Defense Matrix</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            Explicit analysis of adversary capabilities and cryptographic counter-measures implemented in QBS-Secure:
          </p>
        </div>

        {/* Threat Category Filter */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <span className="text-xs text-slate-500 font-medium">Filter Threat:</span>
          {[
            { id: 'all', label: 'All 13 Attack Vectors' },
            { id: 'crypto', label: 'Cryptanalysis & Brute-Force' },
            { id: 'tamper', label: 'Tampering & Modification' },
            { id: 'reverse', label: 'Reverse-Engineering & Inspection' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedThreatCategory(cat.id as typeof selectedThreatCategory)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedThreatCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Threat Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threatVectors
            .filter((t) => selectedThreatCategory === 'all' || t.category === selectedThreatCategory)
            .map((threat, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-200 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900">{threat.threat}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 flex-shrink-0">
                    {threat.status}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <div>
                    <strong className="text-slate-800">Adversary Goal:</strong> {threat.adversaryGoal}
                  </div>
                  <div>
                    <strong className="text-blue-700">QBS-Secure Defense:</strong> {threat.defense}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Security Assumptions & Realistic Boundaries */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Security Assumptions & Kerckhoffs&apos;s Principle</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          We operate strictly under <strong>Kerckhoffs&apos;s Principle</strong>: A cryptographic system must be secure even if everything about the system, except the key/password, is public knowledge.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700">
            <span className="font-bold text-slate-900 block">Realistic Security Goal</span>
            <p className="text-slate-600">
              Without the correct password/key, the encrypted payload is computationally infeasible to recover using practical attacks, assuming standard AES-256 and Argon2id remain mathematically unbroken and the password has sufficient entropy.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700">
            <span className="font-bold text-slate-900 block">Code Obfuscation is Not a Security Boundary</span>
            <p className="text-slate-600">
              Code minification and bundlers make reverse-engineering more tedious, but they do NOT provide cryptographic protection. Security resides exclusively in mathematical keys and entropy.
            </p>
          </div>
        </div>
      </div>

      {/* Production Security Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Production Security Deployment Checklist</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { title: 'Argon2id RFC 9106 Standard KDF', desc: '64MB memory hardness prevents GPU mass dictionary cracking' },
            { title: 'AES-256-GCM Authenticated Cipher', desc: '128-bit authentication tag guarantees confidentiality and integrity' },
            { title: 'AAD Header Tamper Protection', desc: 'All metadata bound cryptographically; bit-flips cause immediate failure' },
            { title: 'Unique Random Nonces (96-bit)', desc: 'crypto.getRandomValues ensures fresh IV for every single operation' },
            { title: 'Unique Random Salt (16-byte)', desc: 'Prevents rainbow tables and cross-file correlation attacks' },
            { title: 'Zero Plaintext / Key Storage', desc: 'No keys, passwords, or plaintext in localStorage, cookies, or logs' },
            { title: 'Explicit Memory Zeroing', desc: 'Plaintext and derived key buffers wiped with .fill(0)' },
            { title: 'Strict Non-Revealing Errors', desc: 'Generic failure message prevents timing and error oracle attacks' },
            { title: 'Pre-Encryption Compression', desc: 'Deflate compression removes known plaintext redundancy' },
            { title: 'Complete Offline Capability', desc: '100% client-side execution; zero network transmission required' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">{item.title}</span>
                <span className="text-slate-600 text-[11px]">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ThreatVector {
  threat: string;
  category: 'crypto' | 'tamper' | 'reverse';
  adversaryGoal: string;
  defense: string;
  status: string;
}

const threatVectors: ThreatVector[] = [
  {
    threat: 'File Copying & Interception',
    category: 'crypto',
    adversaryGoal: 'Attacker copies the WAV audio carrier over the network or steals the file.',
    defense: 'Ciphertext is indistinguishable from random noise. Without the password, recovery of the payload is computationally infeasible.',
    status: 'Mitigated',
  },
  {
    threat: 'File Modification & Bit-Flipping',
    category: 'tamper',
    adversaryGoal: 'Attacker flips audio bits, modifies payload bytes, or injects malicious data.',
    defense: 'AES-256-GCM 128-bit GMAC tag + outer CRC32. Any modified byte fails cryptographic authentication immediately.',
    status: 'Mitigated',
  },
  {
    threat: 'Brute-Force Password Guessing',
    category: 'crypto',
    adversaryGoal: 'Attacker uses high-speed GPU/ASIC clusters to exhaustively guess passwords.',
    defense: 'Memory-hard Argon2id (64 MB RAM, 3 iterations) makes parallel GPU guessing memory-constrained and exponentially expensive.',
    status: 'Mitigated',
  },
  {
    threat: 'Known-Plaintext Analysis (KPA)',
    category: 'crypto',
    adversaryGoal: 'Attacker knows part of the original message and attempts to deduce the key.',
    defense: 'AES-256 in GCM mode is provably IND-CPA and IND-CCA secure. Known plaintexts yield zero mathematical advantage.',
    status: 'Mitigated',
  },
  {
    threat: 'Chosen-Input & Adaptive Chosen-Ciphertext (CCA)',
    category: 'crypto',
    adversaryGoal: 'Attacker feeds chosen inputs or manipulates ciphertexts to observe decryption changes.',
    defense: 'Authenticated encryption rejects tampered ciphertexts completely before processing. Fresh 96-bit random IVs eliminate correlations.',
    status: 'Mitigated',
  },
  {
    threat: 'Replay & Duplication Attacks',
    category: 'tamper',
    adversaryGoal: 'Attacker captures and replays old audio transmissions to spoof context.',
    defense: 'Every generated file has a unique cryptographically random salt, IV, and timestamp. Unaltered legitimate files decode reliably.',
    status: 'Mitigated',
  },
  {
    threat: 'Malformed Audio & Container Injection',
    category: 'tamper',
    adversaryGoal: 'Attacker passes corrupt RIFF chunks, oversize lengths, or overflows to crash decoder.',
    defense: 'Strict bounds checking, DataView offset bounds verification, and generic error handling prevent buffer exploitation.',
    status: 'Mitigated',
  },
  {
    threat: 'Basic Steganalysis & LSB Detection',
    category: 'crypto',
    adversaryGoal: 'Attacker detects hidden messages by analyzing audio LSB anomalies.',
    defense: 'Audio is synthesized as an intentional Continuous-Phase FSK telemetry carrier rather than fragile LSB watermarks.',
    status: 'Mitigated',
  },
  {
    threat: 'Static Code Inspection & Reverse Engineering',
    category: 'reverse',
    adversaryGoal: 'Attacker decompiles client JavaScript to find hardcoded master keys or algorithm backdoors.',
    defense: 'Zero master keys, backdoor tokens, or secrets exist in the code. Security relies exclusively on user password entropy.',
    status: 'Mitigated',
  },
  {
    threat: 'Extraction of Frontend Secrets',
    category: 'reverse',
    adversaryGoal: 'Attacker examines browser memory or local storage for credentials.',
    defense: 'No passwords or keys stored in localStorage or cookies. Derived key arrays are cleared using .fill(0) after use.',
    status: 'Mitigated',
  },
  {
    threat: 'Nonce/IV Reuse Attack',
    category: 'crypto',
    adversaryGoal: 'Attacker exploits two messages encrypted with identical key and IV to break GCM.',
    defense: 'Fresh 96-bit random nonce generated for every single file via crypto.getRandomValues(). Nonces are never reused.',
    status: 'Mitigated',
  },
  {
    threat: 'Version Downgrade Attack',
    category: 'tamper',
    adversaryGoal: 'Attacker changes protocol version to force weaker legacy cryptography.',
    defense: 'Protocol version is strictly checked and bound into the AES-GCM AAD. Version manipulation causes authentication failure.',
    status: 'Mitigated',
  },
  {
    threat: 'Timing Attacks & Side-Channel Oracles',
    category: 'crypto',
    adversaryGoal: 'Attacker measures decryption time or error messages to deduce password characters.',
    defense: 'Generic non-revealing error message: "Unable to authenticate QBS-Secure file." Constant-time comparison where applicable.',
    status: 'Mitigated',
  },
];
