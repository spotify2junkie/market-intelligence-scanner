// fetchers/investx-client.ts - InvestX API客户端
// 负责与InvestX后端API通信，获取股票数据和AI分析

import fetch from 'node-fetch';
import { CONFIG } from '../config';
import {
  InvestXPerformance,
  InvestXChartData,
  InvestXMultiAgentAnalysis,
  InvestXTechnicals,
  InvestXWatchlistItem
} from './types';

/**
 * 延迟函数
 * @param ms 毫秒数
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry装饰器
 * 实现指数退避的retry逻辑
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数
 * @param baseDelayMs 基础延迟毫秒数
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = CONFIG.MAX_RETRIES,
  baseDelayMs: number = CONFIG.RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // 如果不是最后一次尝试，则等待
      if (attempt < maxRetries - 1) {
        // 指数退避：第1次等待1秒，第2次等待2秒，第3次等待4秒
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[InvestX] Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`,
          { error: lastError.message }
        );
        await delay(delayMs);
      }
    }
  }
  
  // 所有重试都失败，抛出最后的错误
  throw new Error(
    `InvestX API failed after ${maxRetries} retries: ${lastError?.message}`
  );
}

/**
 * InvestX API客户端类
 * 封装了所有与InvestX API的交互
 */
export class InvestXClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = CONFIG.INVESTX_BASE_URL) {
    this.baseUrl = baseUrl;
  }
  
  /**
   * 获取股票表现数据
   * @param ticker 股票代码
   * @returns 股票表现数据
   */
  async getPerformance(ticker: string): Promise<InvestXPerformance> {
    return withRetry(async () => {
      const url = `${this.baseUrl}/api/performance?ticker=${encodeURIComponent(ticker)}`;
      
      console.log(`[InvestX] Fetching performance for ${ticker}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(
          `Failed to fetch performance for ${ticker}: ${response.status} ${response.statusText}`
        );
      }
      
      const data = await response.json();
      
      // 处理不同的API响应格式
      let performance: InvestXPerformance;
      if (data && data.data) {
        // 如果返回 { data: {...} } 格式
        performance = data.data;
      } else {
        // 直接返回数据对象
        performance = data;
      }
      
      // 适配不同的API字段名
      // API 返回 todayChange 作为百分比，适配到 todayChangePercent
      if (performance.todayChangePercent === undefined && performance.todayChange !== undefined) {
        performance.todayChangePercent = performance.todayChange;
      }
      // API 返回 todayChangeAbs 作为绝对变化，适配到 todayChange
      if (performance.todayChange === undefined && performance.todayChangeAbs !== undefined) {
        performance.todayChange = performance.todayChangeAbs;
      } else if (performance.todayChange !== undefined && performance.todayChangeAbs !== undefined) {
        // 如果两个字段都有，todayChange 用作百分比，todayChangeAbs 用作绝对变化
        performance.todayChange = performance.todayChangeAbs;
      }

      // 验证必要字段，如果缺失则使用默认值
      if (!performance.currentPrice) performance.currentPrice = 0;
      if (!performance.todayChange) performance.todayChange = 0;
      if (!performance.todayChangePercent) performance.todayChangePercent = 0;
      if (!performance.previousClose) performance.previousClose = 0;
      if (!performance.timestamp) performance.timestamp = new Date().toISOString();
      
      console.log(`[InvestX] Performance data received for ${ticker}`, {
        price: performance.currentPrice,
        change: performance.todayChangePercent
      });
      
      return performance;
    });
  }
  
  /**
   * 获取图表数据（K线数据）
   * @param ticker 股票代码
   * @param timeframe 时间框架：'30m'（30分钟）、'1d'（1天）、'both'（两者都获取）
   * @returns 图表数据
   */
  async getChartData(
    ticker: string,
    timeframe: '30m' | '1d' | 'both'
  ): Promise<InvestXChartData> {
    return withRetry(async () => {
      const url = `${this.baseUrl}/api/chart-data`;
      const params = new URLSearchParams({
        ticker: ticker,
        timeframe: timeframe
      });

      console.log(`[InvestX] Fetching chart data for ${ticker} (${timeframe})`);

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch chart data for ${ticker}: ${response.status} ${response.statusText}`
        );
      }

      const rawData = await response.json();

      // 适配不同的API响应格式
      let data: InvestXChartData;

      if (rawData && rawData.data) {
        // 如果返回 { data: {...} } 格式
        data = rawData.data;
      } else {
        // 直接返回数据对象
        data = rawData;
      }

      // 确保 bars 数组存在
      if (!data.bars) {
        data.bars = [];
      }

      // 确保 supportResistance 对象存在
      if (!data.supportResistance) {
        data.supportResistance = {
          supports: [],
          resistances: []
        };
      }

      // 如果 supportResistance 存在但字段名不同，尝试适配
      if (data.supportResistance) {
        // 尝试不同的字段名
        const sr = data.supportResistance as any;
        if (!sr.supports && sr.support) {
          sr.supports = sr.support;
        }
        if (!sr.resistances && sr.resistance) {
          sr.resistances = sr.resistance;
        }

        // 确保数组存在
        if (!sr.supports) sr.supports = [];
        if (!sr.resistances) sr.resistances = [];
      }

      console.log(`[InvestX] Chart data received for ${ticker}`, {
        bars: data.bars.length,
        hasSupportResistance: !!data.supportResistance
      });

      return data;
    });
  }
  
  /**
   * 获取多智能体分析
   * 调用AI分析系统获取买卖信号
   * @param ticker 股票代码
   * @returns 多智能体分析结果
   */
  async getMultiAgentAnalysis(ticker: string): Promise<InvestXMultiAgentAnalysis> {
    return withRetry(async () => {
      const url = `${this.baseUrl}/api/multi-agent-analyze?ticker=${encodeURIComponent(ticker)}`;

      console.log(`[InvestX] Fetching multi-agent analysis for ${ticker}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // 如果是 404，返回默认的中性分析结果，而不是抛出错误
        if (response.status === 404) {
          console.warn(`[InvestX] Multi-agent analysis not found for ${ticker}, using default neutral analysis`);
          return {
            ticker,
            consensus: {
              signal: 'hold',
              confidence: 0.5,
              reasoning: 'AI分析暂时不可用'
            },
            agents: [],
            timestamp: new Date().toISOString()
          };
        }

        throw new Error(
          `Failed to fetch multi-agent analysis for ${ticker}: ${response.status} ${response.statusText}`
        );
      }

      const rawData = await response.json();

      // 适配不同的API响应格式
      let data: InvestXMultiAgentAnalysis;

      if (rawData && rawData.data) {
        // 如果返回 { data: {...} } 格式
        data = rawData.data;
      } else {
        // 直接返回数据对象
        data = rawData;
      }

      // 确保必要字段存在
      if (!data.ticker) data.ticker = ticker;
      if (!data.timestamp) data.timestamp = new Date().toISOString();

      const normalizeSignal = (value: unknown): 'buy' | 'sell' | 'hold' => {
        if (typeof value !== 'string') {
          return 'hold';
        }
        const normalized = value.toLowerCase();
        return normalized === 'buy' || normalized === 'sell' || normalized === 'hold'
          ? normalized
          : 'hold';
      };

      const normalizeConfidence = (value: unknown): number => {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numeric)) {
          return 0.5;
        }
        if (numeric > 1 && numeric <= 100) {
          return Math.max(0, Math.min(1, numeric / 100));
        }
        return Math.max(0, Math.min(1, numeric));
      };

      if (!data.consensus) {
        data.consensus = {
          signal: 'hold',
          confidence: 0.5,
          reasoning: '无分析数据'
        };
      } else {
        data.consensus.signal = normalizeSignal(data.consensus.signal);
        data.consensus.confidence = normalizeConfidence(data.consensus.confidence);
        if (typeof data.consensus.reasoning !== 'string') {
          data.consensus.reasoning = '无分析数据';
        }
      }

      // 确保 agents 数组存在
      if (!data.agents) {
        data.agents = [];
      }

      console.log(`[InvestX] Multi-agent analysis received for ${ticker}`, {
        signal: data.consensus.signal,
        confidence: data.consensus.confidence
      });

      return data;
    });
  }
  
  /**
   * 获取技术指标
   * @param ticker 股票代码
   * @param timeframe 时间框架：'30m' 或 '1d'
   * @returns 技术指标数据
   */
  async getTechnicals(ticker: string, timeframe: '30m' | '1d' = '1d'): Promise<InvestXTechnicals> {
    return withRetry(async () => {
      const url = `${this.baseUrl}/api/technicals`;
      const params = new URLSearchParams({
        ticker: ticker,
        timeframe: timeframe
      });

      console.log(`[InvestX] Fetching technicals for ${ticker} (${timeframe})`);

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch technicals for ${ticker}: ${response.status} ${response.statusText}`
        );
      }

      const rawData = await response.json();

      // 适配不同的API响应格式
      let data: InvestXTechnicals;

      if (rawData && rawData.data) {
        // 如果返回 { data: {...} } 格式
        data = rawData.data;
      } else {
        // 直接返回数据对象
        data = rawData;
      }

      // 确保必要字段存在
      if (!data.ticker) data.ticker = ticker;
      if (!data.timeframe) data.timeframe = timeframe;
      if (!data.timestamp) data.timestamp = new Date().toISOString();

      // 尝试从不同的字段名适配 RSI
      if (data.rsi === undefined) {
        const anyData = data as any;

        // 如果数据在 momentum 对象中
        if (anyData.momentum && anyData.momentum.rsi !== undefined) {
          data.rsi = anyData.momentum.rsi;
        } else if (anyData.rsiValue !== undefined) {
          data.rsi = anyData.rsiValue;
        } else if (anyData.RSI !== undefined) {
          data.rsi = anyData.RSI;
        }
      }

      // 尝试从不同的字段名适配 MACD
      if (!data.macd) {
        const anyData = data as any;

        // 如果数据在 momentum 对象中
        if (anyData.momentum && anyData.momentum.macdValue !== undefined) {
          data.macd = {
            value: anyData.momentum.macdValue,
            signal: anyData.momentum.macdSignal || 0,
            histogram: anyData.momentum.macdHistogram || 0
          };
        } else if (anyData.MACD) {
          data.macd = anyData.MACD;
        } else if (anyData.macdValue) {
          // 如果只有单个值，构建完整的 MACD 对象
          data.macd = {
            value: anyData.macdValue,
            signal: anyData.macdSignal || 0,
            histogram: anyData.macdHistogram || 0
          };
        }
      }

      console.log(`[InvestX] Technicals received for ${ticker}`, {
        rsi: data.rsi,
        macd: data.macd?.value
      });

      return data;
    });
  }

  /**
   * 批量获取多个股票的表现数据
   * @param tickers 股票代码数组
   * @returns 股票表现数据映射（ticker -> data）
   */
  async getBatchPerformance(tickers: string[]): Promise<Map<string, InvestXPerformance>> {
    const results = new Map<string, InvestXPerformance>();
    
    // 并发获取所有股票数据
    const promises = tickers.map(async (ticker) => {
      try {
        const data = await this.getPerformance(ticker);
        results.set(ticker, data);
      } catch (error) {
        console.error(`[InvestX] Failed to get performance for ${ticker}:`, error);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * 获取 Watchlist（包含 isHolding 信息）
   * @returns Watchlist 数据
   */
  async getWatchlist(): Promise<InvestXWatchlistItem[]> {
    return withRetry(async () => {
      const url = `${this.baseUrl}/api/watchlist`;
      
      console.log(`[InvestX] Fetching watchlist`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(
          `Failed to fetch watchlist: ${response.status} ${response.statusText}`
        );
      }
      
      const payload = await response.json() as {
        items?: unknown[];
        data?: { items?: unknown[]; watchlist?: unknown[] } | unknown[];
        watchlist?: unknown[];
      };

      const rawItems = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.watchlist)
          ? payload.watchlist
          : Array.isArray(payload.data)
            ? payload.data
            : payload.data && typeof payload.data === 'object' && 'items' in payload.data && Array.isArray(payload.data.items)
              ? payload.data.items
              : payload.data && typeof payload.data === 'object' && 'watchlist' in payload.data && Array.isArray(payload.data.watchlist)
                ? payload.data.watchlist
                : [];

      return rawItems
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => {
          const ticker = typeof item.ticker === 'string' ? item.ticker.toUpperCase() : '';
          const signal = typeof item.lastSignal === 'string' ? item.lastSignal.toLowerCase() : item.lastSignal;
          const confidence = typeof item.confidence === 'number' ? item.confidence : Number(item.confidence);
          const entryPrice = typeof item.entryPrice === 'number' ? item.entryPrice : Number(item.entryPrice);
          const positionSize = typeof item.positionSize === 'number' ? item.positionSize : Number(item.positionSize);
          const currentPrice = typeof item.currentPrice === 'number' ? item.currentPrice : Number(item.currentPrice);
          const isHoldingRaw = item.isHolding;
          const isHolding =
            isHoldingRaw === true ||
            isHoldingRaw === 1 ||
            isHoldingRaw === '1' ||
            (typeof isHoldingRaw === 'string' && isHoldingRaw.toLowerCase() === 'true');

          return {
            ticker,
            isHolding,
            entryPrice: Number.isFinite(entryPrice) ? entryPrice : undefined,
            positionSize: Number.isFinite(positionSize) ? positionSize : undefined,
            currentPrice: Number.isFinite(currentPrice) ? currentPrice : undefined,
            lastSignal: signal === 'buy' || signal === 'sell' || signal === 'hold' ? signal : undefined,
            confidence: Number.isFinite(confidence) ? confidence : undefined
          } satisfies InvestXWatchlistItem;
        })
        .filter(item => item.ticker.length > 0);
    });
  }
}

// 导出默认实例
export const investXClient = new InvestXClient();
