import { getAddressLabel } from './address-labels';

describe('getAddressLabel', () => {
  it('returns labels for curated exchange wallets', () => {
    expect(getAddressLabel('NUqLhf1p1vQyP2KJjMcEwmdEBPnbCGouVp')).toBe('Binance');
    expect(getAddressLabel('NTWC7Hh5VYMQ5K8YJbyCLbmJ4RhfQ1Ej64')).toBe('Gate.io');
  });

  it('returns undefined for unknown or empty addresses', () => {
    expect(getAddressLabel('')).toBeUndefined();
    expect(getAddressLabel('NUnknownWallet')).toBeUndefined();
    expect(getAddressLabel()).toBeUndefined();
  });
});
