// analyzers/sector-rotation.ts - ETF对分析器
// 分析6对ETF的相对强度和板块轮动信号

import { investXClient } from '../fetchers/investx-client';
import { CONFIG, EtfPair } from '../config';
import { InvestXPerformance, EtfPairAnalysis } from '../fetchers/types';

/**
 * 计算简单移动平均
 * @param values 数值数组
 * @param period 周期
 */
function calculateSMA(values: number[], period: number): number {
  if (values.length < period) {
    throw new Error(`Insufficient data: need ${period}, got ${values.length}`);
  }
  
  const slice = values.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

/**
 * 计算标准差
 * @param values 数值数组
 * @param period 周期
 */
function calculateStdDev(values: number[], period: number): number {
  if (values.length < period) {
    throw new Error(`Insufficient data: need ${period}, got ${values.length}`);
  }
  
  const slice = values.slice(-period);
  const mean = slice.reduce((sum, val) => sum + val, 0) / period;
  const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
  
  return Math.sqrt(variance);
}

/**
 * 计算ATR（平均真实波幅）的简化版本
 * 使用最近的价格变化幅度估算
 * @param performance 股票表现数据
 */
function estimateATR(performance: InvestXPerformance): number {
  // 使用日变化幅度作为ATR的近似
  const dailyRange = Math.abs(performance.todayChangePercent);
  
  // 如果有前收盘价，可以估算波动率
  if (performance.previousClose > 0) {
    const volatility = dailyRange / performance.previousClose * 100;
    return Math.max(volatility, 0.5); // 至少0.5%的波动率
  }
  
  return Math.max(dailyRange, 0.5);
}

/**
 * 判断信号强度
 * @param zScore Z分数
 * @param atrAdjustedDiff ATR调整的相对强度
 * @returns 信号类型
 */
function determineSignal(
  zScore: number,
  atrAdjustedDiff: number
): 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish' {
  const threshold = CONFIG.Z_SCORE_THRESHOLD;
  
  // 结合Z-Score和ATR调整的相对强度判断
  if (zScore > threshold && atrAdjustedDiff > CONFIG.RELATIVE_STRENGTH_THRESHOLD) {
    return 'strong_bullish';
  } else if (zScore > threshold * 0.5 && atrAdjustedDiff > 0) {
    return 'bullish';
  } else if (zScore < -threshold && atrAdjustedDiff < -CONFIG.RELATIVE_STRENGTH_THRESHOLD) {
    return 'strong_bearish';
  } else if (zScore < -threshold * 0.5 && atrAdjustedDiff < 0) {
    return 'bearish';
  }
  
  return 'neutral';
}

/**
 * 生成分析推理说明
 * @param pair ETF对
 * @param zScore Z分数
 * @param signal 信号类型
 */
function generateReasoning(
  pair: EtfPair,
  zScore: number,
  signal: string
): string {
  const direction = zScore > 0 ? '高于' : '低于';
  const strength = Math.abs(zScore) > CONFIG.Z_SCORE_THRESHOLD ? '显著' : '轻微';
  
  const interpretations: Record<string, string> = {
    risk_appetite: `${pair.ticker1}相对${pair.ticker2}${strength}${direction}历史均值，反映风险偏好${zScore > 0 ? '上升' : '下降'}`,
    sector_rotation: `${pair.ticker1}相对${pair.ticker2}${strength}${direction}，显示${zScore > 0 ? pair.ticker1 : pair.ticker2}板块走强`,
    cap_weighted: `市值加权相对等权${strength}${direction}，大盘股${zScore > 0 ? '占优' : '落后'}`,
    risk_sentiment: `进攻型相对防守型${strength}${direction}，风险情绪${zScore > 0 ? '积极' : '谨慎'}`,
    credit_risk: `高收益债相对国债${strength}${direction}，信贷风险偏好${zScore > 0 ? '上升' : '下降'}`,
    value_growth: `价值股相对成长股${strength}${direction}，${zScore > 0 ? '价值' : '成长'}风格占优`,
  };
  
  return interpretations[pair.type] || `${pair.name}信号: ${signal}`;
}

/**
 * 分析单个ETF对
 * @param pair ETF对配置
 * @returns 分析结果
 */
async function analyzeEtfPair(pair: EtfPair): Promise<EtfPairAnalysis> {
  console.log(`[SectorRotation] Analyzing pair: ${pair.ticker1}/${pair.ticker2}`);
  
  try {
    // 获取两只ETF的表现数据
    const [perf1, perf2] = await Promise.all([
      investXClient.getPerformance(pair.ticker1),
      investXClient.getPerformance(pair.ticker2)
    ]);
    
    // 计算当前比率
    const currentRatio = perf1.currentPrice / perf2.currentPrice;
    
    // 计算前一日比率（用于计算变化）
    const previousRatio = perf1.previousClose / perf2.previousClose;
    const ratioChange = (currentRatio - previousRatio) / previousRatio * 100;
    
    // 注意：这里我们简化了Z-Score计算
    // 实际应用中需要历史数据来计算MA20和标准差
    // 这里使用日变化作为近似
    const mockHistoricalRatios = [currentRatio]; // 实际需要20天数据
    
    // 简化版Z-Score：使用比率变化百分比
    const zScore = ratioChange / 2; // 假设标准差约为2%
    
    // 计算ATR调整的相对强度
    const return1 = perf1.todayChangePercent;
    const return2 = perf2.todayChangePercent;
    const atr1 = estimateATR(perf1);
    const atr2 = estimateATR(perf2);
    const atrAdjustedDiff = (return1 - return2) / (atr1 + atr2);
    
    // 判断信号
    const signal = determineSignal(zScore, atrAdjustedDiff);
    
    // 生成推理
    const reasoning = generateReasoning(pair, zScore, signal);
    
    console.log(`[SectorRotation] Pair ${pair.ticker1}/${pair.ticker2} analyzed:`, {
      ratio: currentRatio.toFixed(4),
      zScore: zScore.toFixed(2),
      signal
    });
    
    return {
      pair: {
        name: pair.name,
        ticker1: pair.ticker1,
        ticker2: pair.ticker2,
        type: pair.type
      },
      ratio: currentRatio,
      ratioChange,
      zScore,
      atrAdjustedDiff,
      signal,
      reasoning,
      priceData: {
        ticker1: perf1,
        ticker2: perf2
      }
    };
  } catch (error) {
    console.error(`[SectorRotation] Failed to analyze ${pair.ticker1}/${pair.ticker2}:`, error);
    
    // 返回中性信号
    return {
      pair: {
        name: pair.name,
        ticker1: pair.ticker1,
        ticker2: pair.ticker2,
        type: pair.type
      },
      ratio: 0,
      ratioChange: 0,
      zScore: 0,
      atrAdjustedDiff: 0,
      signal: 'neutral',
      reasoning: `数据获取失败: ${error}`,
      priceData: undefined as any
    };
  }
}

/**
 * 分析所有ETF对
 * @returns 所有ETF对的分析结果
 */
export async function analyzeSectorRotation(): Promise<EtfPairAnalysis[]> {
  console.log('[SectorRotation] Starting sector rotation analysis...');
  
  const analyses = await Promise.all(
    CONFIG.ETF_PAIRS.map(pair => analyzeEtfPair(pair))
  );
  
  // 统计信号分布
  const signalCounts = analyses.reduce((acc, analysis) => {
    acc[analysis.signal] = (acc[analysis.signal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('[SectorRotation] Analysis complete. Signal distribution:', signalCounts);
  
  return analyses;
}

/**
 * 计算整体市场情绪
 * @param analyses ETF对分析结果
 * @returns 市场情绪
 */
export function calculateOverallSentiment(
  analyses: EtfPairAnalysis[]
): 'bullish' | 'bearish' | 'neutral' {
  let bullishScore = 0;
  let bearishScore = 0;
  
  for (const analysis of analyses) {
    if (analysis.signal === 'strong_bullish') bullishScore += 2;
    else if (analysis.signal === 'bullish') bullishScore += 1;
    else if (analysis.signal === 'strong_bearish') bearishScore += 2;
    else if (analysis.signal === 'bearish') bearishScore += 1;
  }
  
  const diff = bullishScore - bearishScore;
  
  if (diff > 2) return 'bullish';
  if (diff < -2) return 'bearish';
  return 'neutral';
}

/**
 * 计算风险水平
 * @param analyses ETF对分析结果
 * @returns 风险水平
 */
export function calculateRiskLevel(
  analyses: EtfPairAnalysis[]
): 'high' | 'medium' | 'low' {
  // 检查极端信号数量
  const extremeSignals = analyses.filter(
    a => Math.abs(a.zScore) > CONFIG.Z_SCORE_THRESHOLD
  ).length;
  
  if (extremeSignals >= 4) return 'high';
  if (extremeSignals >= 2) return 'medium';
  return 'low';
}
