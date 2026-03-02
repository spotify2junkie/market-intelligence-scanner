// fetchers/massive-client.ts - Massive API客户端
// 负责与Massive新闻API通信，获取市场新闻数据

import fetch from 'node-fetch';
import { CONFIG } from '../config';
import { MassiveNewsItem, MassiveNewsResponse } from './types';

/**
 * Massive API客户端类
 * 封装了所有与Massive News API的交互
 */
export class MassiveClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor(
    baseUrl: string = CONFIG.MASSIVE_BASE_URL,
    apiKey: string = CONFIG.MASSIVE_API_KEY
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }
  
  /**
   * 获取特定股票的新闻
   * @param ticker 股票代码
   * @param limit 返回新闻数量，默认10条
   * @returns 新闻数组
   */
  async getNews(ticker: string, limit: number = 10): Promise<MassiveNewsItem[]> {
    try {
      const url = `${this.baseUrl}/reference/news`;
      const params = new URLSearchParams({
        ticker: ticker,
        limit: limit.toString()
      });
      
      console.log(`[Massive] Fetching news for ${ticker} (limit: ${limit})`);
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey, // 某些API使用这个header
        },
      });
      
      if (!response.ok) {
        throw new Error(
          `Failed to fetch news for ${ticker}: ${response.status} ${response.statusText}`
        );
      }
      
      const data = await response.json();
      
      // 处理不同的API响应格式
      let newsArray: MassiveNewsItem[] = [];
      if (Array.isArray(data)) {
        // 如果直接返回数组
        newsArray = data;
      } else if (data && data.news && Array.isArray(data.news)) {
        // 如果返回 { news: [] } 格式
        newsArray = data.news;
      } else if (data && data.results && Array.isArray(data.results)) {
        // 如果返回 { results: [] } 格式
        newsArray = data.results;
      } else {
        console.warn(`[Massive] Unexpected response format for ${ticker}:`, typeof data);
      }
      
      console.log(`[Massive] News received for ${ticker}`, {
        count: newsArray.length
      });
      
      return newsArray;
    } catch (error) {
      console.error(`[Massive] Failed to get news for ${ticker}:`, error);
      
      // 返回空数组而不是抛出错误，保证系统稳定性
      return [];
    }
  }
  
  /**
   * 批量获取多个股票的新闻
   * @param tickers 股票代码数组
   * @param limit 每个股票的新闻数量
   * @returns 新闻映射（ticker -> news[]）
   */
  async getBatchNews(
    tickers: string[],
    limit: number = 10
  ): Promise<Map<string, MassiveNewsItem[]>> {
    const results = new Map<string, MassiveNewsItem[]>();
    
    // 并发获取所有股票新闻
    const promises = tickers.map(async (ticker) => {
      const news = await this.getNews(ticker, limit);
      results.set(ticker, news);
    });
    
    await Promise.all(promises);
    
    return results;
  }
  
  /**
   * 获取市场整体新闻（不指定股票）
   * @param limit 返回新闻数量
   * @returns 新闻数组
   */
  async getMarketNews(limit: number = 20): Promise<MassiveNewsItem[]> {
    try {
      const url = `${this.baseUrl}/reference/news`;
      const params = new URLSearchParams({
        limit: limit.toString()
      });
      
      console.log(`[Massive] Fetching market news (limit: ${limit})`);
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        throw new Error(
          `Failed to fetch market news: ${response.status} ${response.statusText}`
        );
      }
      
      const data = await response.json() as MassiveNewsResponse;
      
      console.log(`[Massive] Market news received`, {
        count: data.news.length
      });
      
      return data.news;
    } catch (error) {
      console.error('[Massive] Failed to get market news:', error);
      return [];
    }
  }
}

// 导出默认实例
export const massiveClient = new MassiveClient();
