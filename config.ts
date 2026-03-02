// config.ts - 配置文件

// 最先加载环境变量
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '.env') });

export const CONFIG = {
  // API配置
  INVESTX_BASE_URL: 'https://investx-production.up.railway.app',
  MASSIVE_API_KEY: 'Hsnr9gydrZkrYr5KITgfiGQO5rxFwTVk',
  MASSIVE_BASE_URL: 'https://api.massive.com/v2',
  
  // Telegram配置（从InvestX继承）
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  
  // 监控配置
  ETF_PAIRS: [
    { name: '科技vs小盘', ticker1: 'QQQ', ticker2: 'IWM', type: 'risk_appetite' },
    { name: '半导体vs软件', ticker1: 'SMH', ticker2: 'IGV', type: 'sector_rotation' },
    { name: '市值加权vs等权', ticker1: 'SPY', ticker2: 'RSP', type: 'cap_weighted' },
    { name: '进攻vs防守', ticker1: 'XLK', ticker2: 'XLU', type: 'risk_sentiment' },
    { name: '信贷风险', ticker1: 'HYG', ticker2: 'IEF', type: 'credit_risk' },
    { name: '价值vs成长', ticker1: 'IVE', ticker2: 'IVW', type: 'value_growth' },
  ],
  
  WATCHLIST: [
    'TSLA',  // 特斯拉
    'NVDA',  // 英伟达
    'META',  // Meta
    'GOOGL', // Google
    'NBIS',  // Nebius
    'HOOD',  // Robinhood
    'TQQQ',  // 3倍做多QQQ
  ],
  
  // 时间配置
  SCAN_INTERVAL_MINUTES: 30, // 每30分钟
  MARKET_HOURS: {
    start: 21, // 北京时间21:00（美股开盘）
    end: 1,    // 北京时间01:00
  },
  
  // 算法参数
  Z_SCORE_WINDOW: 20,        // 20日均线
  Z_SCORE_THRESHOLD: 2.0,    // 极端信号阈值
  RELATIVE_STRENGTH_THRESHOLD: 0.02, // 2%相对强度阈值
  
  // Retry配置
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
};

export type EtfPair = typeof CONFIG.ETF_PAIRS[0];
