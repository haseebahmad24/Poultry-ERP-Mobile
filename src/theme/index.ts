export const Colors = {
  // Semantic keys preserved for backwards-compatibility — all resolve to monochrome
  primary: '#0a0a0a',
  primaryLight: '#525252',
  primaryDark: '#000000',
  primaryBg: '#f5f5f5',

  success: '#0a0a0a',
  successBg: '#f5f5f5',
  danger: '#0a0a0a',
  dangerBg: '#f5f5f5',
  warning: '#0a0a0a',
  warningBg: '#f5f5f5',
  orange: '#0a0a0a',
  orangeBg: '#f5f5f5',

  text: '#0a0a0a',
  textSecondary: '#525252',
  textMuted: '#a3a3a3',

  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  background: '#fafafa',
  surface: '#ffffff',
  surfaceHover: '#f9fafb',

  // Voucher type chips — all monochrome; outline style expected when screens are polished
  voucherJV:  { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherGRN: { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherDN:  { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherPAY: { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherREC: { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherINV: { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherSO:  { bg: '#f3f4f6', fg: '#0a0a0a' },
  voucherPO:  { bg: '#f3f4f6', fg: '#0a0a0a' },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
};

export const Typography = {
  h1: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  h4: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.text },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, color: Colors.textSecondary },
  label: { fontSize: 11, fontWeight: '500' as const, color: Colors.textMuted, letterSpacing: 0.6 },
  number: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  numberSmall: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
};
