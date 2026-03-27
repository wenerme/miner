export function isMineWebDevEnv(): boolean {
  const globalFlag = (globalThis as { __MINEWEB_DEV__?: unknown }).__MINEWEB_DEV__;
  if (typeof globalFlag === 'boolean') {
    return globalFlag;
  }

  const nodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
  if (nodeEnv) {
    return nodeEnv !== 'production';
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return true;
    }
  }

  return false;
}
