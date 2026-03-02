// analyzers/watchlist-tracker.ts - 个股追踪器
// 追踪7只重点个股的表现和AI分析

import { investXClient } from '../fetchers/investx-client';
import { CONFIG } from '../config';
import { WatchlistItemAnalysis, InvestXPerformance, InvestXMultiAgentAnalysis } from '../fetchers/types';

/**
 * 提取关键事件
 * 从AI分析中提取关键信息
 * @param aiAnalysis AI分析结果
 * @param performance 表现数据
 */
function extractKeyEvents(
  aiAnalysis: InvestXMultiAgentAnalysis | undefined,
  performance: InvestXPerformance
): string[] {
  const events: string[] = [];
  
  // 价格相关事件
  if (Math.abs(performance.todayChangePercent) > 3) {
    events.push(
      `价格${performance.todayChangePercent > 0 ? '大涨' : '大跌'} ${Math.abs(performance.todayChangePercent).toFixed(2)}%`
    );
  }
  
  // AI分析相关事件
  if (aiAnalysis) {
    // 共识信号
    if (aiAnalysis.consensus.confidence > 0.7) {
      events.push(
        `AI共识: ${aiAnalysis.consensus.signal.toUpperCase()} (置信度 ${(aiAnalysis.consensus.confidence * 100).toFixed(0)}%)`
      );
    }
    
    // 提取各个智能体的关键观点
    const uniqueSignals = new Set(aiAnalysis.agents.map(a => a.signal));
    if (uniqueSignals.size > 1) {
      events.push('智能体观点分歧明显');
    }
    
    // 添加主要推理（如果有）
    if (aiAnalysis.consensus.reasoning) {
      // 简化推理，只取前100字符
      const shortReasoning = aiAnalysis.consensus.reasoning.substring(0, 100);
      events.push(`分析: ${shortReasoning}...`);
    }
  }
  
  return events;
}

/**
 * 确定最终信号
 * 综合价格表现和AI分析
 * @param performance 表现数据
 * @param aiAnalysis AI分析结果
 */
function determineFinalSignal(
  performance: InvestXPerformance,
  aiAnalysis: InvestXMultiAgentAnalysis | undefined
): { signal: 'buy' | 'sell' | 'hold'; confidence: number } {
  // 如果没有AI分析，基于价格表现判断
  if (!aiAnalysis) {
    if (performance.todayChangePercent > 2) {
      return { signal: 'buy', confidence: 0.5 };
    } else if (performance.todayChangePercent < -2) {
      return { signal: 'sell', confidence: 0.5 };
    }
    return { signal: 'hold', confidence: 0.5 };
  }
  
  // 使用AI共识信号
  return {
    signal: aiAnalysis.consensus.signal,
    confidence: aiAnalysis.consensus.confidence
  };
}

/**
 * 分析单只股票
 * @param ticker 股票代码
 * @returns 分析结果
 */
async function analyzeWatchlistItem(ticker: string): Promise<WatchlistItemAnalysis> {
  console.log(`[WatchlistTracker] Analyzing ${ticker}...`);

  try {
    // 并发获取表现数据、AI分析、技术指标和图表数据
    const [performance, aiAnalysis, technicals, chartData] = await Promise.all([
      investXClient.getPerformance(ticker),
      investXClient.getMultiAgentAnalysis(ticker).catch(err => {
        console.warn(`[WatchlistTracker] AI analysis failed for ${ticker}:`, err.message);
        return undefined;
      }),
      investXClient.getTechnicals(ticker, '1d').catch(err => {
        console.warn(`[WatchlistTracker] Technicals failed for ${ticker}:`, err.message);
        return undefined;
      }),
      investXClient.getChartData(ticker, '1d').catch(err => {
        console.warn(`[WatchlistTracker] Chart data failed for ${ticker}:`, err.message);
        return undefined;
      })
    ]);

    // 确定信号
    const { signal, confidence } = determineFinalSignal(performance, aiAnalysis);

    // 提取关键事件
    const keyEvents = extractKeyEvents(aiAnalysis, performance);

    console.log(`[WatchlistTracker] ${ticker} analyzed:`, {
      price: performance.currentPrice,
      change: performance.todayChangePercent.toFixed(2) + '%',
      signal,
      confidence: confidence.toFixed(2),
      rsi: technicals?.rsi?.toFixed(2)
    });

    return {
      ticker,
      performance,
      aiAnalysis,
      technicals,
      chartData,
      signal,
      confidence,
      keyEvents
    };
  } catch (error) {
    console.error(`[WatchlistTracker] Failed to analyze ${ticker}:`, error);
    
    // 返回默认的中性结果
    return {
      ticker,
      performance: {
        currentPrice: 0,
        todayChange: 0,
        todayChangePercent: 0,
        previousClose: 0,
        timestamp: new Date().toISOString()
      },
      signal: 'hold',
      confidence: 0,
      keyEvents: [`数据获取失败: ${error}`]
    };
  }
}

/**
 * 分析所有watchlist股票
 * @returns 所有股票的分析结果
 */
export async function analyzeWatchlist(): Promise<WatchlistItemAnalysis[]> {
  console.log('[WatchlistTracker] Starting watchlist analysis...');
  
  const analyses = await Promise.all(
    CONFIG.WATCHLIST.map(ticker => analyzeWatchlistItem(ticker))
  );
  
  // 统计信号分布
  const signalCounts = analyses.reduce((acc, analysis) => {
    acc[analysis.signal] = (acc[analysis.signal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('[WatchlistTracker] Analysis complete. Signal distribution:', signalCounts);
  
  return analyses;
}

/**
 * 获取高置信度的交易机会
 * @param analyses 分析结果
 * @param minConfidence 最小置信度
 */
export function getHighConfidenceSignals(
  analyses: WatchlistItemAnalysis[],
  minConfidence: number = 0.7
): WatchlistItemAnalysis[] {
  return analyses.filter(
    analysis => analysis.confidence >= minConfidence && analysis.signal !== 'hold'
  );
}

/**
 * 获取异常波动股票
 * @param analyses 分析结果
 * @param threshold 波动阈值（百分比）
 */
export function getVolatileStocks(
  analyses: WatchlistItemAnalysis[],
  threshold: number = 3
): WatchlistItemAnalysis[] {
  return analyses.filter(
    analysis => Math.abs(analysis.performance.todayChangePercent) > threshold
  );
}
