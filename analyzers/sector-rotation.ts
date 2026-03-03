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
 * 生成分析推理说明（通俗版，≤15字）
 * @param pair ETF对
 * @param zScore Z分数
 * @param signal 信号类型
 * @param delta 趋势动量
 * @param deltaTrend Delta趋势方向
 */
function generateReasoning(
  pair: EtfPair,
  zScore: number,
  signal: string,
  delta: number = 0,
  deltaTrend: 'rising' | 'falling' | 'stable' = 'stable'
): string {
  // 判断强度
  const isStrong = Math.abs(zScore) > CONFIG.Z_SCORE_THRESHOLD;

  // 判断趋势（结合 Delta 和趋势方向）
  const isRising = deltaTrend === 'rising' && delta > 1;
  const isFalling = deltaTrend === 'falling' && delta < -1;

  // 根据不同类型生成通俗解读
  let interpretation = '';

  switch (pair.type) {
    case 'risk_appetite': // QQQ/IWM - 科技vs小盘
      if (zScore > 0) {
        interpretation = isStrong ? '科技股强势领涨' : '科技股略强于小盘';
        if (isRising) interpretation = '科技股持续走强';
      } else {
        interpretation = isStrong ? '小盘股相对便宜' : '小盘股有轮动机会';
        if (isFalling) interpretation = '资金流向小盘股';
      }
      break;

    case 'sector_rotation': // SMH/IGV - 半导体vs软件
      if (zScore > 0) {
        interpretation = isStrong ? '芯片股领涨' : '芯片略强于软件';
        if (isRising) interpretation = '半导体持续强势';
      } else {
        interpretation = isStrong ? '软件股走强' : '软件股略占优';
        if (isFalling) interpretation = '软件板块崛起';
      }
      break;

    case 'cap_weighted': // SPY/RSP - 市值加权vs等权
      if (zScore > 0) {
        interpretation = isStrong ? '大盘股领涨' : '龙头股略强';
        if (isRising) interpretation = '大盘股持续占优';
      } else {
        interpretation = isStrong ? '小盘股活跃' : '市场广度改善';
        if (isFalling) interpretation = '小盘股开始发力';
      }
      break;

    case 'risk_sentiment': // XLK/XLU - 进攻vs防守
      if (zScore > 0) {
        interpretation = isStrong ? '风险偏好高涨' : '市场偏进攻';
        if (isRising) interpretation = '风险情绪升温';
      } else {
        interpretation = isStrong ? '避险情绪浓厚' : '市场偏防守';
        if (isFalling) interpretation = '资金转向避险';
      }
      break;

    case 'credit_risk': // HYG/IEF - 信贷风险
      if (zScore > 0) {
        interpretation = isStrong ? '风险容忍度高' : '信贷环境宽松';
        if (isRising) interpretation = '风险资产受青睐';
      } else {
        interpretation = isStrong ? '信贷风险厌恶' : '市场偏谨慎';
        if (isFalling) interpretation = '避险资产受宠';
      }
      break;

    case 'value_growth': // IVE/IVW - 价值vs成长
      if (zScore > 0) {
        interpretation = isStrong ? '价值股占优' : '价值股略强';
        if (isRising) interpretation = '价值风格持续';
      } else {
        interpretation = isStrong ? '成长股领涨' : '成长股略强';
        if (isFalling) interpretation = '成长风格回归';
      }
      break;

    default:
      interpretation = `${pair.name}信号: ${signal}`;
  }

  return interpretation;
}

/**
 * 计算线性回归斜率
 * @param values 数值数组
 * @returns 斜率
 */
function calculateSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * 分析单个ETF对
 * @param pair ETF对配置
 * @returns 分析结果
 */
async function analyzeEtfPair(pair: EtfPair): Promise<EtfPairAnalysis> {
  console.log(`[SectorRotation] Analyzing pair: ${pair.ticker1}/${pair.ticker2}`);
  
  try {
    // 获取两只ETF的表现数据和历史数据
    const [perf1, perf2, chart1, chart2] = await Promise.all([
      investXClient.getPerformance(pair.ticker1),
      investXClient.getPerformance(pair.ticker2),
      investXClient.getChartData(pair.ticker1, '1d'),
      investXClient.getChartData(pair.ticker2, '1d')
    ]);
    
    // 计算当前比率
    const currentRatio = perf1.currentPrice / perf2.currentPrice;
    
    // 计算前一日比率（用于计算变化）
    const previousRatio = perf1.previousClose / perf2.previousClose;
    const ratioChange = (currentRatio - previousRatio) / previousRatio * 100;
    
    // 计算历史比率序列（用于 Z-Score 和 Delta）
    const historicalRatios: number[] = [];
    const minLength = Math.min(chart1.bars.length, chart2.bars.length);
    
    // 取最近 20 天的数据
    const lookbackDays = Math.min(20, minLength);
    for (let i = minLength - lookbackDays; i < minLength; i++) {
      const bar1 = chart1.bars[i] as any;
      const bar2 = chart2.bars[i] as any;
      
      // 兼容两种字段名：c/close
      const c1 = bar1.c !== undefined ? bar1.c : bar1.close;
      const c2 = bar2.c !== undefined ? bar2.c : bar2.close;
      
      if (c1 && c2 && c2 > 0) {
        const ratio = c1 / c2;
        historicalRatios.push(ratio);
      }
    }
    
    // 如果历史数据不足，添加当前比率
    if (historicalRatios.length < 5) {
      historicalRatios.push(currentRatio);
    }
    
    // 计算 Z-Score
    let zScore = 0;
    if (historicalRatios.length >= 5) {
      const mean = calculateSMA(historicalRatios, historicalRatios.length);
      const stdDev = calculateStdDev(historicalRatios, historicalRatios.length);
      
      if (stdDev > 0) {
        zScore = (currentRatio - mean) / stdDev;
      }
    }
    
    // 计算 Delta（趋势动量）
    let delta = 0;
    let deltaTrend: 'rising' | 'falling' | 'stable' = 'stable';
    
    if (historicalRatios.length >= 5) {
      // 方法1: 5日均值偏离
      const ma5 = calculateSMA(historicalRatios, Math.min(5, historicalRatios.length));
      
      // 避免除以零
      if (ma5 > 0) {
        delta = ((currentRatio - ma5) / ma5) * 100;
      } else {
        delta = 0;
      }
      
      // 方法2: 计算20日斜率（如果有足够数据）
      if (historicalRatios.length >= 10) {
        const slope = calculateSlope(historicalRatios);
        // 如果斜率显著，使用斜率作为补充
        if (Math.abs(slope) > 0.0001) {
          delta = delta * 0.5 + slope * 100 * 0.5;  // 综合两个指标
        }
      }
      
      // 判断趋势方向
      if (delta > 0.5) deltaTrend = 'rising';
      else if (delta < -0.5) deltaTrend = 'falling';
      else deltaTrend = 'stable';
    } else {
      // 如果历史数据不足，使用日变化作为 Delta
      delta = ratioChange;
      deltaTrend = ratioChange > 0.5 ? 'rising' : ratioChange < -0.5 ? 'falling' : 'stable';
    }
    
    // 计算ATR调整的相对强度
    const return1 = perf1.todayChangePercent;
    const return2 = perf2.todayChangePercent;
    const atr1 = estimateATR(perf1);
    const atr2 = estimateATR(perf2);
    const atrAdjustedDiff = (return1 - return2) / (atr1 + atr2);
    
    // 判断信号（结合 Z-Score 和 Delta）
    const signal = determineSignal(zScore, atrAdjustedDiff);
    
    // 生成推理（结合 Delta）
    const reasoning = generateReasoning(pair, zScore, signal, delta, deltaTrend);
    
    console.log(`[SectorRotation] Pair ${pair.ticker1}/${pair.ticker2} analyzed:`, {
      ratio: currentRatio.toFixed(4),
      zScore: zScore.toFixed(2),
      delta: delta.toFixed(2),
      deltaTrend,
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
      delta,
      deltaTrend,
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
      delta: 0,
      deltaTrend: 'stable',
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
