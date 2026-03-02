// scanner.ts - 市场情报扫描器主入口
// 协调所有模块，执行完整的市场扫描流程

import { CONFIG } from './config';
import { MarketIntelligenceReport, WatchlistItemAnalysis, NewsAnalysis } from './fetchers/types';
import { analyzeSectorRotation, calculateOverallSentiment, calculateRiskLevel } from './analyzers/sector-rotation';
import { analyzeWatchlist, getHighConfidenceSignals, getVolatileStocks } from './analyzers/watchlist-tracker';
import { aggregateNews, getHighImpactNews, getNegativeNews } from './analyzers/news-aggregator';
import { generateReport, generateSummary } from './reporter';
import { notifyReport, notifyAlert } from './notifier';

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
  
  // 检查极端板块轮动信号
  for (const analysis of sectorAnalyses) {
    if (Math.abs(analysis.zScore) > CONFIG.Z_SCORE_THRESHOLD) {
      alerts.push(
        `${analysis.pair.name}出现极端信号 (Z-Score: ${analysis.zScore.toFixed(2)})`
      );
    }
  }
  
  // 检查高置信度交易信号
  const highConfidence = getHighConfidenceSignals(watchlistAnalyses, 0.8);
  for (const item of highConfidence) {
    alerts.push(
      `${item.ticker}高置信度${item.signal.toUpperCase()}信号 (${(item.confidence * 100).toFixed(0)}%)`
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
 * 生成操作建议
 * @param report 市场情报报告
 */
function generateRecommendations(report: MarketIntelligenceReport): string[] {
  const recommendations: string[] = [];
  
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
  
  // 基于高置信度信号
  const buySignals = getHighConfidenceSignals(report.watchlist, 0.7)
    .filter(a => a.signal === 'buy');
  if (buySignals.length > 0) {
    recommendations.push(
      `潜在买入机会: ${buySignals.map(a => a.ticker).join(', ')}`
    );
  }
  
  const sellSignals = getHighConfidenceSignals(report.watchlist, 0.7)
    .filter(a => a.signal === 'sell');
  if (sellSignals.length > 0) {
    recommendations.push(
      `建议减仓/止盈: ${sellSignals.map(a => a.ticker).join(', ')}`
    );
  }
  
  // 基于新闻
  const negativeNews = getNegativeNews(report.news);
  if (negativeNews.length >= 3) {
    recommendations.push('多个股票出现负面新闻，注意风险');
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
    
    const [sectorAnalyses, watchlistAnalyses, newsAnalyses] = await Promise.all([
      // 板块轮动分析
      analyzeSectorRotation(),
      
      // Watchlist分析
      analyzeWatchlist(),
      
      // 新闻分析（只分析watchlist中的股票）
      aggregateNews(CONFIG.WATCHLIST, 10)
    ]);
    
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
