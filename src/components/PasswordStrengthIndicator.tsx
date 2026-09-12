import { useState } from 'react';
import { Shield, Sparkles, Copy, Check, Info } from 'lucide-react';
import { evaluatePassword, generateStrongPassphrase } from '../lib/passwordStrength';

interface PasswordStrengthIndicatorProps {
  password: string;
  onSelectPassphrase?: (passphrase: string) => void;
}

export function PasswordStrengthIndicator({
  password,
  onSelectPassphrase,
}: PasswordStrengthIndicatorProps) {
  const [copied, setCopied] = useState(false);
  const analysis = evaluatePassword(password);

  const handleGenerate = () => {
    const generated = generateStrongPassphrase();
    onSelectPassphrase?.(generated);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!password && !onSelectPassphrase) return null;

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
      {/* Strength Bar and Label */}
      {password && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold text-slate-700">Password Strength:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  analysis.score >= 3
                    ? 'bg-emerald-100 text-emerald-800'
                    : analysis.score === 2
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {analysis.label} (~{analysis.entropyBits} bits)
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="text-slate-500 hover:text-slate-700 text-[11px] flex items-center gap-1"
              title="Copy password"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* 4-Segment Progress Bar */}
          <div className="grid grid-cols-4 gap-1.5 h-1.5">
            {[0, 1, 2, 3].map((step) => (
              <div
                key={step}
                className={`rounded-full transition-all duration-300 ${
                  analysis.score > step
                    ? analysis.score >= 3
                      ? 'bg-emerald-500'
                      : analysis.score === 2
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Feedback & Crack Time */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span>{analysis.feedback[0]}</span>
            </div>
            <span className="text-slate-400">
              Offline crack estimate: <strong className="text-slate-600 font-medium">{analysis.offlineCrackTimeEstimate}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Suggested Strong Passphrase Generator */}
      {onSelectPassphrase && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">
            Recommend: 4-word diceware passphrase
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Generate Passphrase</span>
          </button>
        </div>
      )}
    </div>
  );
}
