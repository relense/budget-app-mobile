import { resolveApiUrl } from '../../../src/lib/apiUrl';

describe('resolveApiUrl', () => {
  it('rewrites localhost to the Android emulator host in dev on Android', () => {
    expect(resolveApiUrl('http://localhost:4400', 'android', true)).toBe('http://10.0.2.2:4400');
  });

  it('leaves localhost untouched on iOS', () => {
    expect(resolveApiUrl('http://localhost:4400', 'ios', true)).toBe('http://localhost:4400');
  });

  it('leaves localhost untouched outside dev', () => {
    expect(resolveApiUrl('http://localhost:4400', 'android', false)).toBe('http://localhost:4400');
  });

  it('leaves a non-localhost URL untouched regardless of platform', () => {
    expect(resolveApiUrl('https://api.example.com', 'android', true)).toBe(
      'https://api.example.com',
    );
  });
});
