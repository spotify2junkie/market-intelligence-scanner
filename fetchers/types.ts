// types.ts - 类型定义

// InvestX API响应类型
export interface InvestXPerformance {
  currentPrice: number;
  todayChange: number;          // 日变化（绝对值或百分比，取决于API）
  todayChangeAbs?: number;      // 日变化绝对值
  todayChangePercent: number;   // 日变化百分比
  previousClose: number;
  timestamp: string;
}

export interface InvestXChartData {
  bars: Array<{
    t: number;  // timestamp
    o: number;  // open
    h: number;  // high
    l: number;  // low
    c: number;  // close
    v: number;  // volume
  }>;
  supportResistance?: {
    supports: number[];
    resistances: number[];
  };
}

export interface InvestXMultiAgentAnalysis {
  ticker: string;
  consensus: {
    signal: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
  };
  agents: Array<{
    id: string;
    name: string;
    signal: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
  }>;
  entry?: {
    price: number;
    range?: [number, number];
  };
  stopLoss?: number;
  takeProfit?: number[];
  timestamp: string;
}

export interface InvestXWatchlistItem {
  ticker: string;
  isHolding: boolean;
  entryPrice?: number;
  positionSize?: number;
  currentPrice?: number;
  lastSignal?: 'buy' | 'sell' | 'hold';
  confidence?: number;
}

// Massive API响应类型
export interface MassiveNewsItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  published_utc: string;
  source: string;
  tickers?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface MassiveNewsResponse {
  news: MassiveNewsItem[];
  timestamp: string;
}

// 分析结果类型
export interface EtfPairAnalysis {
  pair: {
    name: string;
    ticker1: string;
    ticker2: string;
    type: string;
  };
  ratio: number;
  ratioChange: number;
  zScore: number;
  delta: number;  // 趋势动量：5日均值偏离或20日斜率
  deltaTrend: 'rising' | 'falling' | 'stable';  // Delta趋势方向
  atrAdjustedDiff: number;
  signal: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  reasoning: string;
  priceData: {
    ticker1: InvestXPerformance;
    ticker2: InvestXPerformance;
  };
}

// 技术指标类型
export interface InvestXTechnicals {
  ticker: string;
  timeframe: string;
  rsi?: number;
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages?: {
    sma20?: number;
    sma50?: number;
    ema12?: number;
    ema26?: number;
  };
  timestamp: string;
}

export interface WatchlistItemAnalysis {
  ticker: string;
  performance: InvestXPerformance;
  aiAnalysis?: InvestXMultiAgentAnalysis;
  chartData?: InvestXChartData;
  technicals?: InvestXTechnicals;
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  keyEvents: string[];
  isHolding: boolean;  // 是否持仓
  entryPrice?: number;  // 持仓成本
  positionSize?: number; // 持仓数量
}

export interface NewsAnalysis {
  ticker: string;
  news: MassiveNewsItem[];
  sentiment: 'positive' | 'negative' | 'neutral';
  keyEvents: string[];
  impactLevel: 'high' | 'medium' | 'low';
}

export interface IntradayRotationItem {
  ticker: string;
  sector: string;
  fromOpenPercent: number;
  relativeStrengthVsSpy: number;
  vwap: number;
  vwapDeviationPercent: number;
  signal: 'inflow' | 'outflow' | 'neutral';
}

// 综合报告类型
export interface MarketIntelligenceReport {
  timestamp: string;
  marketOverview: {
    sectorRotation: EtfPairAnalysis[];
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    riskLevel: 'high' | 'medium' | 'low';
  };
  intradayRotation?: IntradayRotationItem[];
  watchlist: WatchlistItemAnalysis[];
  news: NewsAnalysis[];
  alerts: string[];
  recommendations: string[];
}
