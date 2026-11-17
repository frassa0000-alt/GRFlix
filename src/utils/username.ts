export interface UsernameValidationResult {
  valid: boolean;
  sanitized: string;
  errorAr?: string;
  errorEn?: string;
}

// Hidden rare & reserved username tokens (never surfaced in UI text)
const RESERVED_RARE_USERNAMES = new Set([
  'cib',
  'fip',
  'vpn',
  'vip',
  'ceo',
  'cfo',
  'cto',
  'dev',
  'mod',
  'pro',
  'max',
  'top',
  'one',
  'api',
  'dns',
  'ssl',
  'ssh',
  'ftp',
  'www',
  'http',
  'https',
  'fbi',
  'cia',
  'nsa',
  'atm',
  'btc',
  'eth',
  'usd',
  'eur',
  'egp',
  'xrp',
  'root',
  'test',
  'null',
  'none',
  'admin',
  'admins',
  'administrator',
  'owner',
  'staff',
  'moderator',
  'support',
  'system',
  'official',
  'security',
  'help',
  'guest',
  'golden',
  'flix',
  'goldenflix',
  'cinema',
  'king',
  'boss',
  'master',
]);

export function validateUsername(rawInput: string): UsernameValidationResult {
  const value = rawInput.trim();

  if (!value) {
    return {
      valid: false,
      sanitized: '',
      errorAr: 'يرجى إدخال اسم المستخدم.',
      errorEn: 'Please enter a username.',
    };
  }

  // Only English letters, digits, and optional underscore (no spaces, Arabic, or symbols)
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    return {
      valid: false,
      sanitized: value,
      errorAr: 'يجب كتابة اسم المستخدم بحروف إنجليزية وأرقام فقط بدون مسافات أو عربي.',
      errorEn: 'Username must contain only English letters, numbers, and underscores (no spaces).',
    };
  }

  // Hidden check for rare/reserved usernames (e.g., VIP, CIB, FIP, VPN, etc.)
  const lower = value.toLowerCase();
  const lettersOnly = lower.replace(/[^a-z]/g, '');
  const alphaSegments = lower.split(/[^a-z]+/).filter(Boolean);

  if (
    RESERVED_RARE_USERNAMES.has(lower) ||
    (lettersOnly.length > 0 && RESERVED_RARE_USERNAMES.has(lettersOnly)) ||
    alphaSegments.some((seg) => RESERVED_RARE_USERNAMES.has(seg))
  ) {
    return {
      valid: false,
      sanitized: value,
      errorAr: 'اسم المستخدم هذا محجوز أو نادر ولا يمكن استخدامه، اختر اسماً آخر.',
      errorEn: 'This username is reserved or unavailable. Please choose another one.',
    };
  }

  if (value.length < 4) {
    return {
      valid: false,
      sanitized: value,
      errorAr: 'يجب أن يتكون اسم المستخدم من 4 أحرف وأرقام على الأقل.',
      errorEn: 'Username must be at least 4 characters long.',
    };
  }

  if (value.length > 24) {
    return {
      valid: false,
      sanitized: value,
      errorAr: 'يجب ألا يتجاوز اسم المستخدم 24 خانة.',
      errorEn: 'Username cannot exceed 24 characters.',
    };
  }

  const hasEnglishLetter = /[A-Za-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);

  if (!hasEnglishLetter || !hasDigit) {
    return {
      valid: false,
      sanitized: value,
      errorAr: 'يجب أن يحتوي اسم المستخدم على حروف إنجليزية وأرقام معاً.',
      errorEn: 'Username must include both English letters and numbers.',
    };
  }

  return {
    valid: true,
    sanitized: value,
  };
}
