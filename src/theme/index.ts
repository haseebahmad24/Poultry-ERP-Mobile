export const Colors = {
  primary: '#1565c0',
  primaryLight: '#1976d2',
  primaryDark: '#0d47a1',
  primaryBg: '#e3f2fd',

  success: '#16a34a',
  successBg: '#e8f5e9',
  danger: '#c62828',
  dangerBg: '#fce4ec',
  warning: '#d97706',
  warningBg: '#fff3e0',
  orange: '#e65100',
  orangeBg: '#fff3e0',

  text: '#1a1a2e',
  textSecondary: '#546e7a',
  textMuted: '#90a4ae',

  border: '#e0e6ed',
  borderLight: '#f0f4f8',
  background: '#f5f7fa',
  surface: '#ffffff',
  surfaceHover: '#f8fafc',

  // Voucher type colors
  voucherJV: { bg: '#e8eaf6', fg: '#283593' },
  voucherGRN: { bg: '#e8f5e9', fg: '#2e7d32' },
  voucherDN: { bg: '#fff3e0', fg: '#e65100' },
  voucherPAY: { bg: '#e3f2fd', fg: '#1565c0' },
  voucherREC: { bg: '#f3e5f5', fg: '#6a1b9a' },
  voucherINV: { bg: '#fce4ec', fg: '#c62828' },
  voucherSO: { bg: '#e0f7fa', fg: '#00695c' },
  voucherPO: { bg: '#f1f8e9', fg: '#558b2f' },
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
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#1565c0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
};

export const Typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  h4: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.text },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, color: Colors.textSecondary },
  label: { fontSize: 11, fontWeight: '500' as const, color: Colors.textMuted, letterSpacing: 0.5 },
  number: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  numberSmall: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
};
