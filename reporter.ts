// reporter.ts - 市场情报报告生成器
// 生成简明、信息丰富的综合分析报告

import {
  MarketIntelligenceReport,
  EtfPairAnalysis,
  WatchlistItemAnalysis,
  NewsAnalysis
} from './fetchers/types';
import { calculateOverallSentiment, calculateRiskLevel } from './analyzers/sector-rotation';
import { generateNewsSummary } from './analyzers/news-aggregator';

/**
 * 格式化价格
 */
function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null || isNaN(price)) {
    return 'N/A';
  }
  return '$' + price.toFixed(2);
}

/**
 * 格式化百分比
 */
function formatPercent(percent: number | undefined): string {
  if (percent === undefined || percent === null || isNaN(percent)) {
    return 'N/A';
  }
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * 格式化 RSI
 */
function formatRSI(rsi: number | undefined): string {
  if (rsi === undefined || rsi === null || isNaN(rsi)) {
    return 'N/A';
  }
  
  let status = '';
  if (rsi > 70) status = ' ⚠️超买';
  else if (rsi < 30) status = ' ⚠️超卖';
  
  return rsi.toFixed(1) + status;
}

/**
 * 格式化 MACD
 */
function formatMACD(macd: any | undefined): string {
  if (!macd || macd.value === undefined) {
    return 'N/A';
  }
  
  const signal = macd.histogram > 0 ? '📈' : '📉';
  return `${signal} ${macd.histogram.toFixed(2)}`;
}

/**
 * 生成大盘表格（精简版）
 */
function generateSectorRotationSection(analyses: EtfPairAnalysis[]): string {
  let section = '## 📊 大盘指标\n\n';
  section += '| 指标 | 比率 | 涨跌 | 信号 | 解读 |\n';
  section += '|------|------|------|------|------|\n';

  for (const analysis of analyses) {
    const ratio = analysis.ratio ? analysis.ratio.toFixed(3) : 'N/A';
    const change = formatPercent(analysis.ratioChange);

    // 简化信号显示
    let signalIcon = '➡️';
    if (analysis.signal.includes('bullish')) signalIcon = '📈';
    else if (analysis.signal.includes('bearish')) signalIcon = '📉';

    // 解读限制在20字以内
    let shortReasoning = analysis.reasoning.split('，')[0].split('。')[0];
    if (shortReasoning.length > 20) {
      shortReasoning = shortReasoning.substring(0, 18) + '...';
    }

    section += `| ${analysis.pair.name} | ${ratio} | ${change} | ${signalIcon} | ${shortReasoning} |\n`;
  }

  return section;
}

/**
 * 生成个股表格（精简版，移除 Agent 分析）
 */
function generateWatchlistSection(analyses: WatchlistItemAnalysis[]): string {
  let section = '## 👀 Watch List\n\n';

  // 单一表格：股票、价格、涨跌、RSI、MACD、支撑位、阻力位
  section += '| 股票 | 价格 | 涨跌 | RSI | MACD | 支撑 | 阻力 |\n';
  section += '|------|------|------|-----|------|------|------|\n';

  for (const analysis of analyses) {
    const ticker = analysis.ticker;

    // 价格
    const price = formatPrice(analysis.performance?.currentPrice);
    const change = formatPercent(analysis.performance?.todayChangePercent);

    // RSI（简化，只显示数值和状态图标）
    let rsi = 'N/A';
    if (analysis.technicals?.rsi !== undefined && analysis.technicals?.rsi !== null) {
      const rsiVal = analysis.technicals.rsi;
      let status = '';
      if (rsiVal > 70) status = '⚠️';
      else if (rsiVal < 30) status = '⚠️';
      rsi = `${rsiVal.toFixed(1)}${status}`;
    }

    // MACD（简化）
    const macd = formatMACD(analysis.technicals?.macd);

    // Support & Resistance
    let support = 'N/A';
    let resistance = 'N/A';

    if (analysis.chartData?.supportResistance) {
      const sr = analysis.chartData.supportResistance;
      if (sr.supports && sr.supports.length > 0) {
        support = formatPrice(sr.supports[0]);
      }
      if (sr.resistances && sr.resistances.length > 0) {
        resistance = formatPrice(sr.resistances[0]);
      }
    }

    section += `| **${ticker}** | ${price} | ${change} | ${rsi} | ${macd} | ${support} | ${resistance} |\n`;
  }

  return section;
}

/**
 * 生成新闻摘要（精简版：股票代码 + 情绪 + 1条标题，最多50字）
 */
function generateNewsSection(newsAnalyses: NewsAnalysis[]): string {
  let section = '## 📰 新闻\n\n';

  // 只展示有新闻的股票
  const newsWithContent = newsAnalyses.filter(n => n.news.length > 0);

  if (newsWithContent.length === 0) {
    section += '_暂无重要新闻_\n\n';
    return section;
  }

  // 最多展示8只股票的新闻
  const toShow = newsWithContent.slice(0, 8);

  for (const analysis of toShow) {
    // 情绪图标
    const sentimentEmoji = analysis.sentiment === 'positive' ? '📈' :
                           analysis.sentiment === 'negative' ? '📉' : '📊';
    const sentimentLabel = analysis.sentiment === 'positive' ? '利多' :
                           analysis.sentiment === 'negative' ? '利空' : '中性';

    // 只取第一条新闻标题，限制在50字
    const firstNews = analysis.news[0];
    let title = firstNews.title;
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    section += `**${analysis.ticker}** ${sentimentEmoji}\`${sentimentLabel}\` ${title}\n`;
  }

  return section;
}

/**
 * 判断美股市场状态
 */
function getMarketStatus(): { status: string; note: string } {
  const now = new Date();
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = etNow.getHours();
  const minute = etNow.getMinutes();
  const day = etNow.getDay();
  
  // 周末
  if (day === 0 || day === 6) {
    return { status: '休市', note: '美股周末休市，数据为上周五收盘数据' };
  }
  
  // 美东时间 9:30-16:00 为开盘
  if (hour > 9 && hour < 16) {
    return { status: '开盘', note: '美股开盘中' };
  }
  if (hour === 9 && minute >= 30) {
    return { status: '开盘', note: '美股开盘中' };
  }
  
  // 盘前 4:00-9:30
  if (hour >= 4 && hour < 9) {
    return { status: '盘前', note: '美股盘前，部分数据可能不可用' };
  }
  if (hour === 9 && minute < 30) {
    return { status: '盘前', note: '美股盘前，部分数据可能不可用' };
  }
  
  // 盘后 16:00-20:00
  if (hour >= 16 && hour < 20) {
    return { status: '盘后', note: '美股盘后交易中' };
  }
  
  // 休市
  return { status: '休市', note: '美股休市，数据为上一交易日收盘数据' };
}

/**
 * 生成完整报告（精简版，确保在4000字符以内）
 */
export function generateReport(report: MarketIntelligenceReport): string {
  console.log('[Reporter] Generating compact report...');

  let markdown = '# 📈 市场情报\n\n';

  // 市场状态说明
  const marketStatus = getMarketStatus();
  const now = new Date();
  const beijingTime = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const etTime = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit'
  });

  markdown += `> 🕐 北京时间 ${beijingTime} | 美东时间 ${etTime} | **${marketStatus.status}**\n`;
  markdown += `> _${marketStatus.note}_\n\n`;

  // 市场概览（简化为一行）
  const sentimentEmoji = report.marketOverview.overallSentiment === 'bullish' ? '📈' :
                         report.marketOverview.overallSentiment === 'bearish' ? '📉' : '😐';
  const riskEmoji = report.marketOverview.riskLevel === 'high' ? '🔴' :
                    report.marketOverview.riskLevel === 'medium' ? '🟡' : '🟢';

  markdown += `情绪:${sentimentEmoji} | 风险:${riskEmoji}\n\n---\n\n`;

  // 1. 大盘表格
  markdown += generateSectorRotationSection(report.marketOverview.sectorRotation);
  markdown += '\n---\n\n';

  // 2. 个股表格
  markdown += generateWatchlistSection(report.watchlist);
  markdown += '\n---\n\n';

  // 3. 新闻摘要
  markdown += generateNewsSection(report.news);

  // 4. 警报和建议（合并，最多各3条）
  if (report.alerts.length > 0 || report.recommendations.length > 0) {
    markdown += '\n---\n\n';

    if (report.alerts.length > 0) {
      markdown += '⚠️ **警报**: ';
      markdown += report.alerts.slice(0, 3).join(' | ');
      markdown += '\n';
    }

    if (report.recommendations.length > 0) {
      markdown += '💡 **建议**: ';
      markdown += report.recommendations.slice(0, 3).join(' | ');
      markdown += '\n';
    }
  }

  return markdown;
}

/**
 * 生成简短摘要（用于 Telegram 快速预览）
 */
export function generateSummary(report: MarketIntelligenceReport): string {
  let summary = '📊 **市场情报摘要**\n\n';
  
  // 市场情绪
  const sentimentEmoji = report.marketOverview.overallSentiment === 'bullish' ? '📈' :
                         report.marketOverview.overallSentiment === 'bearish' ? '📉' : '😐';
  summary += `市场情绪: ${sentimentEmoji} ${report.marketOverview.overallSentiment.toUpperCase()}\n\n`;
  
  // 个股信号
  const buySignals = report.watchlist.filter(w => w.signal === 'buy');
  const sellSignals = report.watchlist.filter(w => w.signal === 'sell');
  
  if (buySignals.length > 0) {
    summary += `🟢 买入信号: ${buySignals.map(w => w.ticker).join(', ')}\n`;
  }
  if (sellSignals.length > 0) {
    summary += `🔴 卖出信号: ${sellSignals.map(w => w.ticker).join(', ')}\n`;
  }
  
  // 高影响新闻
  const highImpactNews = report.news.filter(n => n.impactLevel === 'high');
  if (highImpactNews.length > 0) {
    summary += `\n📰 高影响新闻: ${highImpactNews.length} 只股票\n`;
  }
  
  // 警报
  if (report.alerts.length > 0) {
    summary += `\n⚠️ 警报: ${report.alerts.length} 条\n`;
  }
  
  return summary;
}
