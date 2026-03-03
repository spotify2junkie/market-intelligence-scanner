import fetch from 'node-fetch';
import { investXClient } from '../fetchers/investx-client';
import { IntradayRotationItem } from '../fetchers/types';

interface SectorEtf {
  ticker: string;
  sector: string;
}

interface PolygonOpenCloseResponse {
  open?: number;
  preMarket?: number;
}

interface PolygonPrevAggResponse {
  results?: Array<{
    vw?: number;
  }>;
}

const POLYGON_BASE_URL = 'https://api.polygon.io';

const SECTOR_ETFS: SectorEtf[] = [
  { ticker: 'XLK', sector: '科技' },
  { ticker: 'XLY', sector: '可选消费' },
  { ticker: 'XLP', sector: '必需消费' },
  { ticker: 'XLV', sector: '医疗' },
  { ticker: 'XLF', sector: '金融' },
  { ticker: 'XLI', sector: '工业' },
  { ticker: 'XLB', sector: '材料' },
  { ticker: 'XLE', sector: '能源' },
  { ticker: 'XLU', sector: '公用事业' },
  { ticker: 'XLRE', sector: '房地产' },
  { ticker: 'XLC', sector: '通信' }
];

function getNyDateString(): string {
  const nyDate = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, '0');
  const day = String(nyDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculatePercentChange(current: number, base: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base <= 0) {
    return 0;
  }
  return ((current - base) / base) * 100;
}

function determineFlowSignal(
  currentPrice: number,
  vwap: number,
  relativeStrengthVsSpy: number
): 'inflow' | 'outflow' | 'neutral' {
  if (currentPrice > vwap && relativeStrengthVsSpy > 0) {
    return 'inflow';
  }
  if (currentPrice < vwap && relativeStrengthVsSpy < 0) {
    return 'outflow';
  }
  return 'neutral';
}

async function fetchOpenPrice(ticker: string, date: string, apiKey: string): Promise<number> {
  const params = new URLSearchParams({
    adjusted: 'true',
    apiKey
  });
  const url = `${POLYGON_BASE_URL}/v1/open-close/${encodeURIComponent(ticker)}/${date}?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Polygon open-close failed for ${ticker}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as PolygonOpenCloseResponse;
  // 盘中用 open，盘前用 preMarket
  const openPrice = payload.open ?? payload.preMarket;
  if (!openPrice || !Number.isFinite(openPrice)) {
    throw new Error(`Polygon open-close missing open for ${ticker}`);
  }
  return openPrice;
}

async function fetchPrevVwap(ticker: string, apiKey: string): Promise<number> {
  const params = new URLSearchParams({
    adjusted: 'true',
    apiKey
  });
  const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Polygon prev agg failed for ${ticker}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as PolygonPrevAggResponse;
  const vwap = payload.results?.[0]?.vw;
  if (!vwap || !Number.isFinite(vwap)) {
    throw new Error(`Polygon prev agg missing vw for ${ticker}`);
  }
  return vwap;
}

async function analyzeSingleSector(
  sectorEtf: SectorEtf,
  date: string,
  apiKey: string,
  spyFromOpenPercent: number
): Promise<IntradayRotationItem | null> {
  try {
    const [performance, openPrice, vwap] = await Promise.all([
      investXClient.getPerformance(sectorEtf.ticker),
      fetchOpenPrice(sectorEtf.ticker, date, apiKey),
      fetchPrevVwap(sectorEtf.ticker, apiKey)
    ]);

    const currentPrice = performance.currentPrice;
    const fromOpenPercent = calculatePercentChange(currentPrice, openPrice);
    const relativeStrengthVsSpy = fromOpenPercent - spyFromOpenPercent;
    const vwapDeviationPercent = calculatePercentChange(currentPrice, vwap);
    const signal = determineFlowSignal(currentPrice, vwap, relativeStrengthVsSpy);

    return {
      ticker: sectorEtf.ticker,
      sector: sectorEtf.sector,
      fromOpenPercent,
      relativeStrengthVsSpy,
      vwap,
      vwapDeviationPercent,
      signal
    };
  } catch (error) {
    console.error(`[IntradayRotation] Failed for ${sectorEtf.ticker}:`, error);
    return null;
  }
}

export async function getIntradayRotation(): Promise<IntradayRotationItem[]> {
  const apiKey = process.env.POLYGON_API_KEY || '';
  if (!apiKey) {
    console.warn('[IntradayRotation] POLYGON_API_KEY is missing, skipping intraday rotation.');
    return [];
  }

  const date = getNyDateString();

  try {
    const [spyPerformance, spyOpen] = await Promise.all([
      investXClient.getPerformance('SPY'),
      fetchOpenPrice('SPY', date, apiKey)
    ]);

    const spyFromOpenPercent = calculatePercentChange(spyPerformance.currentPrice, spyOpen);

    const rows = await Promise.all(
      SECTOR_ETFS.map(sectorEtf => analyzeSingleSector(sectorEtf, date, apiKey, spyFromOpenPercent))
    );

    return rows
      .filter((row): row is IntradayRotationItem => row !== null)
      .sort((a, b) => b.relativeStrengthVsSpy - a.relativeStrengthVsSpy);
  } catch (error) {
    console.error('[IntradayRotation] Analysis failed:', error);
    return [];
  }
}
