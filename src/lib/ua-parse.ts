import type { UAInfo } from '@/shared/types';

interface UAData {
  getHighEntropyValues(hints: string[]): Promise<{
    platform: string; platformVersion: string;
    fullVersionList: { brand: string; version: string }[];
  }>;
}

export async function captureUserAgent(): Promise<UAInfo> {
  const data = (navigator as unknown as { userAgentData?: UAData }).userAgentData;
  if (data?.getHighEntropyValues) {
    try {
      const d = await data.getHighEntropyValues(['platformVersion', 'fullVersionList']);
      const brand = d.fullVersionList.find(b => !/Not.A.Brand/i.test(b.brand))
                 ?? d.fullVersionList[0];
      return {
        userAgent: navigator.userAgent,
        platform: `${d.platform} ${d.platformVersion}`.trim(),
        browser: brand ? `${brand.brand} ${brand.version}` : 'Unknown',
      };
    } catch { /* fall through */ }
  }
  return parseUAString(navigator.userAgent);
}

export function parseUAString(ua: string): UAInfo {
  let browser = 'Unknown';
  let platform = 'Unknown';
  const chromeMatch = ua.match(/(Chrome|Edg|Firefox|Safari)\/([\d.]+)/);
  if (chromeMatch) browser = `${chromeMatch[1]} ${chromeMatch[2]}`;
  const platMatch = ua.match(/\(([^)]+)\)/);
  if (platMatch) platform = platMatch[1]!.split(';')[0]!.trim();
  return { userAgent: ua, browser, platform };
}
