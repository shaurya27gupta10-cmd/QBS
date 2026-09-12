/**
 * QBS-Secure Password Strength & Entropy Analyzer
 * 
 * SECURITY RATIONALE:
 * In a zero-knowledge, password-authenticated system without escrow or master keys,
 * the password is the primary root of trust. Memory-hard Argon2id dramatically increases
 * offline guessing costs, but adequate password entropy remains essential.
 */

export interface PasswordAnalysis {
  score: number; // 0 to 4
  entropyBits: number;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Military-Grade';
  color: string;
  feedback: string[];
  offlineCrackTimeEstimate: string;
}

export function evaluatePassword(password: string): PasswordAnalysis {
  if (!password) {
    return {
      score: 0,
      entropyBits: 0,
      label: 'Very Weak',
      color: 'bg-slate-200 text-slate-600',
      feedback: ['Enter a password to protect your data'],
      offlineCrackTimeEstimate: 'Instantaneous',
    };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

  // Shannon entropy estimation: length * log2(poolSize)
  const entropyBits = poolSize > 0 ? Math.round(password.length * Math.log2(poolSize)) : 0;

  const feedback: string[] = [];
  if (password.length < 10) {
    feedback.push('Use at least 10-14 characters or 4 random passphrase words');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add symbols or special characters');
  }

  // Common dictionary or repetitive patterns penalty
  const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'welcome', 'letmein'];
  const hasCommon = commonPatterns.some((p) => password.toLowerCase().includes(p));
  if (hasCommon) {
    feedback.push('Contains common predictable patterns');
  }

  let score = 0;
  let label: PasswordAnalysis['label'] = 'Very Weak';
  let color = 'bg-rose-500 text-white';
  let crackTime = 'A few seconds';

  if (entropyBits >= 85 && password.length >= 14 && !hasCommon) {
    score = 4;
    label = 'Military-Grade';
    color = 'bg-emerald-600 text-white';
    crackTime = 'Thousands of years with high-end GPU clusters (Argon2id 64MB)';
  } else if (entropyBits >= 65 && password.length >= 11 && !hasCommon) {
    score = 3;
    label = 'Strong';
    color = 'bg-blue-600 text-white';
    crackTime = 'Decades of continuous Argon2id hashing';
  } else if (entropyBits >= 45 && password.length >= 8) {
    score = 2;
    label = 'Fair';
    color = 'bg-amber-500 text-white';
    crackTime = 'Months to years depending on attacker resources';
  } else if (entropyBits >= 28) {
    score = 1;
    label = 'Weak';
    color = 'bg-orange-500 text-white';
    crackTime = 'Hours to days';
  } else {
    score = 0;
    label = 'Very Weak';
    color = 'bg-rose-500 text-white';
    crackTime = 'Seconds to minutes';
  }

  return {
    score,
    entropyBits,
    label,
    color,
    feedback: feedback.length > 0 ? feedback : ['Optimal passphrase strength for Argon2id key derivation'],
    offlineCrackTimeEstimate: crackTime,
  };
}

/**
 * Generates a cryptographically secure random passphrase (diceware style)
 */
export function generateStrongPassphrase(): string {
  const words = [
    'orbital', 'shield', 'cipher', 'quantum', 'beacon', 'vector', 'matrix', 'crystal',
    'echo', 'falcon', 'granite', 'horizon', 'island', 'jupiter', 'kinetic', 'lunar',
    'monarch', 'nebula', 'obsidian', 'pulsar', 'radiant', 'sapphire', 'titan', 'uranium',
    'vortex', 'whisper', 'zenith', 'aurora', 'blaze', 'cascade', 'delta', 'ember',
    'glacier', 'haven', 'infinity', 'javelin', 'kestrel', 'legacy', 'mystic', 'nexus'
  ];

  const randomValues = new Uint32Array(4);
  crypto.getRandomValues(randomValues);

  const selectedWords = Array.from(randomValues).map((val) => words[val % words.length]);
  // Append a 2-digit number and a symbol
  const symbol = '!#$*&'[randomValues[0] % 5];
  const num = (randomValues[1] % 90 + 10).toString();

  return `${selectedWords.join('-')}-${num}${symbol}`;
}
