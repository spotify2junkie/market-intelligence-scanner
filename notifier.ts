// notifier.ts - Telegram通知推送
// 负责将市场情报报告推送到Telegram

import fetch from 'node-fetch';
import { CONFIG } from './config';
import { MarketIntelligenceReport } from './fetchers/types';
import { generateReport, generateSummary } from './reporter';

/**
 * Telegram API响应类型
 */
interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

/**
 * Telegram通知器类
 * 封装了所有Telegram推送逻辑
 */
export class TelegramNotifier {
  private botToken: string;
  private chatId: string;
  private apiUrl: string;
  
  constructor() {
    this.botToken = CONFIG.TELEGRAM_BOT_TOKEN;
    this.chatId = CONFIG.TELEGRAM_CHAT_ID;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    // 验证配置
    if (!this.botToken || !this.chatId) {
      console.warn('[Telegram] Missing bot token or chat ID. Notifications will be disabled.');
    }
  }
  
  /**
   * 检查通知器是否可用
   */
  isEnabled(): boolean {
    return Boolean(this.botToken && this.chatId);
  }
  
  /**
   * 发送文本消息
   * @param text 消息文本（支持Markdown）
   * @param parseMode 解析模式
   */
  async sendMessage(
    text: string,
    parseMode: 'Markdown' | 'HTML' = 'Markdown'
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      console.warn('[Telegram] Notifications disabled - missing configuration');
      return false;
    }
    
    try {
      const url = `${this.apiUrl}/sendMessage`;
      
      console.log('[Telegram] Sending message...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: text,
          parse_mode: parseMode,
          disable_web_page_preview: true
        })
      });
      
      const data = await response.json() as TelegramResponse;
      
      if (!data.ok) {
        console.error('[Telegram] Failed to send message:', data.description);
        return false;
      }
      
      console.log('[Telegram] Message sent successfully');
      return true;
    } catch (error) {
      console.error('[Telegram] Error sending message:', error);
      return false;
    }
  }
  
  /**
   * 发送市场情报报告（单条消息，不分割）
   * @param report 市场情报报告
   */
  async sendReport(report: MarketIntelligenceReport): Promise<boolean> {
    console.log('[Telegram] Preparing to send market intelligence report...');

    // 生成完整报告
    const fullReport = generateReport(report);

    // Telegram 消息长度限制为 4096 字符
    // 确保报告在限制内，不分割发送
    const maxLength = 4000;
    const messageToSend = fullReport.length > maxLength
      ? fullReport.substring(0, maxLength) + '\n\n_...已截断_'
      : fullReport;

    return await this.sendMessage(messageToSend, 'Markdown');
  }
  
  /**
   * 发送紧急警报
   * @param alertMessage 警报消息
   */
  async sendAlert(alertMessage: string): Promise<boolean> {
    const message = `🚨 **紧急警报**\n\n${alertMessage}`;
    return await this.sendMessage(message);
  }
  
  /**
   * 发送每日摘要
   * @param summary 摘要内容
   */
  async sendDailySummary(summary: string): Promise<boolean> {
    const message = `📅 **每日市场摘要**\n\n${summary}`;
    return await this.sendMessage(message);
  }
  
  /**
   * 测试通知
   * 发送测试消息验证配置
   */
  async test(): Promise<boolean> {
    const message = `✅ **测试消息**\n\n市场情报扫描器已启动！`;
    return await this.sendMessage(message);
  }
}

// 导出默认实例
export const telegramNotifier = new TelegramNotifier();

/**
 * 便捷函数：发送报告
 */
export async function notifyReport(report: MarketIntelligenceReport): Promise<boolean> {
  return await telegramNotifier.sendReport(report);
}

/**
 * 便捷函数：发送警报
 */
export async function notifyAlert(message: string): Promise<boolean> {
  return await telegramNotifier.sendAlert(message);
}
