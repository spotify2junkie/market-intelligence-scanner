import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSummary } from '../reporter';
import { MarketIntelligenceReport } from '../fetchers/types';

function createBaseReport(): MarketIntelligenceReport {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    marketOverview: {
      sectorRotation: [],
      overallSentiment: 'neutral',
      riskLevel: 'low'
    },
    watchlist: [],
    news: [],
    alerts: [],
    recommendations: []
  };
}

test('generateSummary applies buy>=0.6 and holding+sell filters', () => {
  const report = createBaseReport();
  report.watchlist = [
    {
      ticker: 'AAA',
      performance: {
        currentPrice: 100,
        todayChange: 0,
        todayChangePercent: 0,
        previousClose: 100,
        timestamp: report.timestamp
      },
      signal: 'buy',
      confidence: 0.6,
      keyEvents: [],
      isHolding: false
    },
    {
      ticker: 'BBB',
      performance: {
        currentPrice: 100,
        todayChange: 0,
        todayChangePercent: 0,
        previousClose: 100,
        timestamp: report.timestamp
      },
      signal: 'buy',
      confidence: 0.59,
      keyEvents: [],
      isHolding: false
    },
    {
      ticker: 'CCC',
      performance: {
        currentPrice: 100,
        todayChange: 0,
        todayChangePercent: 0,
        previousClose: 100,
        timestamp: report.timestamp
      },
      signal: 'sell',
      confidence: 0.9,
      keyEvents: [],
      isHolding: true
    },
    {
      ticker: 'DDD',
      performance: {
        currentPrice: 100,
        todayChange: 0,
        todayChangePercent: 0,
        previousClose: 100,
        timestamp: report.timestamp
      },
      signal: 'sell',
      confidence: 0.9,
      keyEvents: [],
      isHolding: false
    }
  ];

  const summary = generateSummary(report);

  assert.match(summary, /AAA/);
  assert.doesNotMatch(summary, /BBB/);
  assert.match(summary, /CCC/);
  assert.doesNotMatch(summary, /DDD/);
});
