// scanner.ts - 市场情报扫描器主入口
// 协调所有模块，执行完整的市场扫描流程

import { CONFIG } from './config';
import { MarketIntelligenceReport, WatchlistItemAnalysis, NewsAnalysis } from './fetchers/types';
import { analyzeSectorRotation, calculateOverallSentiment, calculateRiskLevel } from './analyzers/sector-rotation';
import { analyzeWatchlist, getVolatileStocks } from './analyzers/watchlist-tracker';
import { aggregateNews, getHighImpactNews } from './analyzers/news-aggregator';
import { getIntradayRotation } from './analyzers/intraday-rotation';
import { generateReport } from './reporter';
import { notifyReport, notifyAlert } from './notifier';

function isUsMarketOpen(): boolean {
  const now = new Date();
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etNow.getDay();
  const hour = etNow.getHours();
  const minute = etNow.getMinutes();

  if (day === 0 || day === 6) {
    return false;
  }

  if (hour > 9 && hour < 16) {
    return true;
  }

  return hour === 9 && minute >= 30;
}

/**
 * 生成警报列表
 * @param sectorAnalyses 板块轮动分析
 * @param watchlistAnalyses watchlist分析
 * @param newsAnalyses 新闻分析
 */
function generateAlerts(
  sectorAnalyses: Awaited<ReturnType<typeof analyzeSectorRotation>>,
  watchlistAnalyses: WatchlistItemAnalysis[],
  newsAnalyses: NewsAnalysis[]
): string[] {
  const alerts: string[] = [];
  const buyOpportunities = watchlistAnalyses.filter(
    item => item.signal === 'buy' && item.confidence >= 0.6
  );
  const holdingSellSignals = watchlistAnalyses.filter(
    item => item.signal === 'sell' && item.isHolding
  );
  
  // 检查极端板块轮动信号
  for (const analysis of sectorAnalyses) {
    if (Math.abs(analysis.zScore) > CONFIG.Z_SCORE_THRESHOLD) {
      alerts.push(
        `${analysis.pair.name}出现极端信号 (Z-Score: ${analysis.zScore.toFixed(2)})`
      );
    }
  }
  
  for (const item of buyOpportunities) {
    alerts.push(
      `${item.ticker}高置信度${item.signal.toUpperCase()}信号 (${(item.confidence * 100).toFixed(0)}%)`
    );
  }

  for (const item of holdingSellSignals) {
    alerts.push(
      `${item.ticker}持仓${item.signal.toUpperCase()}提醒 (${(item.confidence * 100).toFixed(0)}%)`
    );
  }
  
  // 检查异常波动
  const volatile = getVolatileStocks(watchlistAnalyses, 5);
  for (const item of volatile) {
    alerts.push(
      `${item.ticker}异常波动 (${item.performance.todayChangePercent.toFixed(2)}%)`
    );
  }
  
  // 检查高影响新闻
  const highImpactNews = getHighImpactNews(newsAnalyses);
  for (const analysis of highImpactNews) {
    alerts.push(
      `${analysis.ticker}出现高影响${analysis.sentiment}新闻`
    );
  }
  
  return alerts;
}

/**
 * 生成操作建议（简化版）
 * @param report 市场情报报告
 */
function generateRecommendations(report: MarketIntelligenceReport): string[] {
  const recommendations: string[] = [];
  const buyOpportunities = report.watchlist
    .filter(item => item.signal === 'buy' && item.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence);
  const holdingSellSignals = report.watchlist
    .filter(item => item.signal === 'sell' && item.isHolding)
    .sort((a, b) => b.confidence - a.confidence);

  if (buyOpportunities.length > 0) {
    const topBuy = buyOpportunities.slice(0, 3).map(item => item.ticker).join(', ');
    recommendations.push(`优先关注买入机会: ${topBuy}`);
  }

  if (holdingSellSignals.length > 0) {
    const riskNames = holdingSellSignals.slice(0, 3).map(item => item.ticker).join(', ');
    recommendations.push(`持仓卖出提醒: ${riskNames}`);
  }
  
  // 基于市场情绪
  if (report.marketOverview.overallSentiment === 'bullish') {
    recommendations.push('市场情绪偏多，可考虑适度加仓');
  } else if (report.marketOverview.overallSentiment === 'bearish') {
    recommendations.push('市场情绪偏空，建议保持谨慎，控制仓位');
  }
  
  // 基于风险水平
  if (report.marketOverview.riskLevel === 'high') {
    recommendations.push('⚠️ 风险水平较高，建议设置止损');
  }
  
  // 基于板块轮动
  const strongSignals = report.marketOverview.sectorRotation.filter(
    a => a.signal.includes('strong')
  );
  if (strongSignals.length > 0) {
    const types = [...new Set(strongSignals.map(a => a.pair.type))];
    recommendations.push(`关注板块: ${types.join(', ')}`);
  }
  
  return recommendations;
}

/**
 * 执行市场扫描
 * @returns 市场情报报告
 */
export async function scanMarket(): Promise<MarketIntelligenceReport> {
  console.log('='.repeat(60));
  console.log('[Scanner] Starting market intelligence scan...');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 并发执行所有分析
    console.log('\n[Scanner] Phase 1: Fetching data and analyzing...');
    
    const [sectorAnalyses, watchlistAnalyses] = await Promise.all([
      // 板块轮动分析
      analyzeSectorRotation(),
      
      // Watchlist分析（动态从 API 获取 ticker 列表）
      analyzeWatchlist(),
    ]);

    // 盘中轮动分析（盘前用 preMarket，盘中用 open）
    const intradayRotation = await getIntradayRotation();
    
    // 新闻分析（使用动态的 watchlist ticker 列表）
    const newsTickers = watchlistAnalyses.map(a => a.ticker);
    const newsAnalyses = await aggregateNews(newsTickers, 10);
    
    console.log('\n[Scanner] Phase 2: Generating insights...');
    
    // 计算市场整体情绪和风险
    const overallSentiment = calculateOverallSentiment(sectorAnalyses);
    const riskLevel = calculateRiskLevel(sectorAnalyses);
    
    console.log(`[Scanner] Overall sentiment: ${overallSentiment}`);
    console.log(`[Scanner] Risk level: ${riskLevel}`);
    
    // 生成初步报告
    const report: MarketIntelligenceReport = {
      timestamp: new Date().toISOString(),
      marketOverview: {
        sectorRotation: sectorAnalyses,
        overallSentiment,
        riskLevel
      },
      intradayRotation,
      watchlist: watchlistAnalyses,
      news: newsAnalyses,
      alerts: [],
      recommendations: []
    };
    
    // 生成警报
    report.alerts = generateAlerts(sectorAnalyses, watchlistAnalyses, newsAnalyses);
    console.log(`[Scanner] Generated ${report.alerts.length} alerts`);
    
    // 生成建议
    report.recommendations = generateRecommendations(report);
    console.log(`[Scanner] Generated ${report.recommendations.length} recommendations`);
    
    const elapsed = Date.now() - startTime;
    console.log('\n' + '='.repeat(60));
    console.log(`[Scanner] Scan completed in ${elapsed}ms`);
    console.log('='.repeat(60));
    
    return report;
  } catch (error) {
    console.error('[Scanner] Scan failed:', error);
    throw error;
  }
}

/**
 * 执行扫描并发送通知
 */
export async function scanAndNotify(): Promise<void> {
  try {
    // 执行扫描
    const report = await scanMarket();
    
    // 生成报告
    const fullReport = generateReport(report);
    console.log('\n[Scanner] Full Report:\n');
    console.log(fullReport);
    
    // 发送通知
    await notifyReport(report);
    
    // 如果有紧急警报，额外发送
    const urgentAlerts = report.alerts.filter(alert => 
      alert.includes('异常波动') || alert.includes('极端信号')
    );
    
    if (urgentAlerts.length > 0) {
      await notifyAlert(urgentAlerts.join('\n'));
    }
  } catch (error) {
    console.error('[Scanner] Scan and notify failed:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    await scanAndNotify();
    process.exit(0);
  } catch (error) {
    console.error('[Main] Fatal error:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

// 导出主函数供外部调用
export { main };
