// analyzers/news-aggregator.ts - 新闻聚合和情感分析
// 从Massive API获取新闻并进行情感分析

import { massiveClient } from '../fetchers/massive-client';
import { MassiveNewsItem, NewsAnalysis } from '../fetchers/types';

/**
 * 分析新闻情感
 * 基于新闻标题和描述进行简单的情感判断
 * @param news 新闻列表
 */
function analyzeSentiment(news: MassiveNewsItem[]): 'positive' | 'negative' | 'neutral' {
  if (news.length === 0) return 'neutral';
  
  // 正面关键词
  const positiveKeywords = [
    'surge', 'jump', 'rise', 'gain', 'bull', 'buy', 'upgrade',
    'beat', 'strong', 'growth', 'profit', 'record', 'high',
    '上涨', '突破', '新高', '增长', '盈利'
  ];
  
  // 负面关键词
  const negativeKeywords = [
    'drop', 'fall', 'decline', 'bear', 'sell', 'downgrade',
    'miss', 'weak', 'loss', 'low', 'crash', 'concern',
    '下跌', '暴跌', '亏损', '风险', '担忧'
  ];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const item of news) {
    const text = `${item.title} ${item.description || ''}`.toLowerCase();
    
    // 如果API已经提供了情感标签，直接使用
    if (item.sentiment) {
      if (item.sentiment === 'positive') positiveScore += 2;
      else if (item.sentiment === 'negative') negativeScore += 2;
      continue;
    }
    
    // 关键词匹配
    for (const keyword of positiveKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        positiveScore += 1;
      }
    }
    
    for (const keyword of negativeKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        negativeScore += 1;
      }
    }
  }
  
  // 判断整体情感
  const diff = positiveScore - negativeScore;
  const threshold = news.length * 0.3; // 阈值：30%的新闻数量
  
  if (diff > threshold) return 'positive';
  if (diff < -threshold) return 'negative';
  return 'neutral';
}

/**
 * 提取关键事件
 * 从新闻中提取重要信息
 * @param news 新闻列表
 * @param maxEvents 最大事件数量
 */
function extractKeyEvents(news: MassiveNewsItem[], maxEvents: number = 5): string[] {
  const events: string[] = [];
  
  for (const item of news.slice(0, maxEvents)) {
    // 简化标题，去除过长内容
    const title = item.title.length > 80 
      ? item.title.substring(0, 77) + '...' 
      : item.title;
    
    events.push(title);
  }
  
  return events;
}

/**
 * 判断新闻影响级别
 * @param news 新闻列表
 * @param sentiment 情感倾向
 */
function determineImpactLevel(
  news: MassiveNewsItem[],
  sentiment: 'positive' | 'negative' | 'neutral'
): 'high' | 'medium' | 'low' {
  if (news.length === 0) return 'low';
  
  // 负面新闻通常影响更大
  if (sentiment === 'negative' && news.length >= 3) return 'high';
  
  // 大量正面新闻也可能有高影响
  if (sentiment === 'positive' && news.length >= 5) return 'high';
  
  // 中等数量的新闻
  if (news.length >= 2) return 'medium';
  
  return 'low';
}

/**
 * 分析单只股票的新闻
 * @param ticker 股票代码
 * @param limit 新闻数量限制
 * @returns 新闻分析结果
 */
async function analyzeStockNews(
  ticker: string,
  limit: number = 10
): Promise<NewsAnalysis> {
  console.log(`[NewsAggregator] Analyzing news for ${ticker}...`);
  
  try {
    // 获取新闻
    const news = await massiveClient.getNews(ticker, limit);
    
    // 分析情感
    const sentiment = analyzeSentiment(news);
    
    // 提取关键事件
    const keyEvents = extractKeyEvents(news);
    
    // 判断影响级别
    const impactLevel = determineImpactLevel(news, sentiment);
    
    console.log(`[NewsAggregator] ${ticker} news analyzed:`, {
      count: news.length,
      sentiment,
      impactLevel
    });
    
    return {
      ticker,
      news,
      sentiment,
      keyEvents,
      impactLevel
    };
  } catch (error) {
    console.error(`[NewsAggregator] Failed to analyze news for ${ticker}:`, error);
    
    return {
      ticker,
      news: [],
      sentiment: 'neutral',
      keyEvents: [`新闻获取失败: ${error}`],
      impactLevel: 'low'
    };
  }
}

/**
 * 批量分析多只股票的新闻
 * @param tickers 股票代码列表
 * @param limit 每只股票的新闻数量
 * @returns 新闻分析结果列表
 */
export async function aggregateNews(
  tickers: string[],
  limit: number = 10
): Promise<NewsAnalysis[]> {
  console.log('[NewsAggregator] Starting news aggregation...');
  
  const analyses = await Promise.all(
    tickers.map(ticker => analyzeStockNews(ticker, limit))
  );
  
  // 统计情感分布
  const sentimentCounts = analyses.reduce((acc, analysis) => {
    acc[analysis.sentiment] = (acc[analysis.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('[NewsAggregator] Aggregation complete. Sentiment distribution:', sentimentCounts);
  
  return analyses;
}

/**
 * 获取高影响新闻
 * @param analyses 新闻分析结果
 */
export function getHighImpactNews(analyses: NewsAnalysis[]): NewsAnalysis[] {
  return analyses.filter(
    analysis => analysis.impactLevel === 'high' && analysis.news.length > 0
  );
}

/**
 * 获取负面新闻
 * @param analyses 新闻分析结果
 */
export function getNegativeNews(analyses: NewsAnalysis[]): NewsAnalysis[] {
  return analyses.filter(
    analysis => analysis.sentiment === 'negative'
  );
}

/**
 * 生成新闻摘要
 * @param analyses 新闻分析结果
 */
export function generateNewsSummary(analyses: NewsAnalysis[]): string {
  const highImpact = getHighImpactNews(analyses);
  const negative = getNegativeNews(analyses);
  
  let summary = '';
  
  if (highImpact.length > 0) {
    summary += `⚠️ 高影响新闻: ${highImpact.map(a => a.ticker).join(', ')}\n`;
  }
  
  if (negative.length > 0) {
    summary += `🔴 负面新闻: ${negative.map(a => a.ticker).join(', ')}\n`;
  }
  
  return summary || '✅ 整体新闻情绪平稳';
}
