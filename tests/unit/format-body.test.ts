import { describe, it, expect } from 'vitest';
import { formatIssueBody, applyBodyBudget } from '@/lib/format-body';
import type { CollectedData } from '@/shared/types';
import { BODY_BUDGET } from '@/shared/constants';

const baseCollected: CollectedData = {
  url: 'https://x.com/page',
  viewport: { w: 1440, h: 900 },
  ua: { userAgent: 'UA', platform: 'macOS 14.5', browser: 'Chrome 138' },
  consoleErrors: [],
  networkFailures: [],
  capturedAt: 1_000,
  selectedDepth: 1,
  selector: 'body > div',
  parentChainSummary: ['button', 'div.card'],
  outerHTML: '<div>x</div>',
};

describe('formatIssueBody', () => {
  it('includes user description and collected sections', () => {
    const body = formatIssueBody('설명', baseCollected);
    expect(body).toContain('## 설명');
    expect(body).toContain('설명');
    expect(body).toContain('자동 수집 정보');
    expect(body).toContain('https://x.com/page');
    expect(body).toContain('Chrome 138');
    expect(body).toContain('1440');
  });

  it('outerHTML inside <details>', () => {
    const body = formatIssueBody('x', baseCollected);
    expect(body).toContain('<details>');
    expect(body).toContain('<div>x</div>');
  });

  it('omits empty console/network sections', () => {
    const body = formatIssueBody('x', baseCollected);
    expect(body).not.toContain('콘솔 에러');
    expect(body).not.toContain('네트워크');
  });

  it('shows console + network when present', () => {
    const c: CollectedData = {
      ...baseCollected,
      consoleErrors: [{ message: 'TypeError', source: 'console.error', timestamp: 0, count: 2 }],
      networkFailures: [{ method: 'GET', url: '/api/x', status: 500, statusText: 'err', timestamp: 0, count: 1 }],
    };
    const body = formatIssueBody('x', c);
    expect(body).toContain('콘솔 에러');
    expect(body).toContain('TypeError');
    expect(body).toContain('네트워크 실패');
    expect(body).toContain('500');
  });
});

describe('formatIssueBody — anchor lines', () => {
  it('includes Anchor 체인 line when anchorChain non-empty', () => {
    const c: CollectedData = { ...baseCollected, anchorChain: ['Pricing', 'product-card'] };
    const body = formatIssueBody('x', c);
    expect(body).toContain('Anchor 체인');
    expect(body).toContain('Pricing → product-card');
  });

  it('includes 소스 파일 line when sourceFile present', () => {
    const c: CollectedData = {
      ...baseCollected,
      anchorChain: ['Pricing'],
      sourceFile: 'Pricing.tsx',
    };
    const body = formatIssueBody('x', c);
    expect(body).toContain('소스 파일');
    expect(body).toContain('Pricing.tsx');
  });

  it('omits both lines when anchorChain empty and sourceFile null', () => {
    const body = formatIssueBody('x', baseCollected);
    expect(body).not.toContain('Anchor 체인');
    expect(body).not.toContain('소스 파일');
  });

  it('emits Anchor 체인 above Selector line', () => {
    const c: CollectedData = { ...baseCollected, anchorChain: ['A'] };
    const body = formatIssueBody('x', c);
    const anchorIdx = body.indexOf('Anchor 체인');
    const selectorIdx = body.indexOf('**Selector**');
    expect(anchorIdx).toBeGreaterThan(0);
    expect(anchorIdx).toBeLessThan(selectorIdx);
  });
});

describe('applyBodyBudget', () => {
  it('returns as-is when under budget', () => {
    const out = applyBodyBudget('short body');
    expect(out).toBe('short body');
  });

  it('truncates user content when over budget', () => {
    const huge = 'a'.repeat(BODY_BUDGET + 5_000);
    const out = applyBodyBudget(huge);
    expect(out.length).toBeLessThanOrEqual(BODY_BUDGET);
    expect(out).toContain('(사용자 입력 일부 생략)');
  });
});
