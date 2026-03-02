# 市场情报扫描器 (Market Intelligence Scanner)

实时监控美股市场，分析板块轮动、个股表现和新闻情感，自动生成市场情报报告并推送到Telegram。

## 📋 功能特性

### 1. ETF板块轮动分析
分析6对关键ETF的相对强度，识别市场风格和风险偏好：
- **QQQ/IWM** - 科技vs小盘（风险偏好）
- **SMH/IGV** - 半导体vs软件（板块轮动）
- **SPY/RSP** - 市值加权vs等权（大盘vs广度）
- **XLK/XLU** - 进攻vs防守（风险情绪）
- **HYG/IEF** - 信贷风险（信用利差）
- **IVE/IVW** - 价值vs成长（风格轮动）

算法：
- Ratio = Price1 / Price2
- Z-Score = (Current_Ratio - MA20) / σ20
- ATR调整的相对强度 = (Return1 - Return2) / (ATR1 + ATR2)

### 2. 个股智能追踪
监控7只重点个股，获取AI分析信号：
- TSLA（特斯拉）
- NVDA（英伟达）
- META（Meta）
- GOOGL（Google）
- NBIS（Nebius）
- HOOD（Robinhood）
- TQQQ（3倍做多QQQ）

### 3. 新闻情感分析
从Massive API获取实时新闻，分析情感倾向和影响级别。

### 4. 综合报告生成
生成包含以下内容的Markdown报告：
- 市场概览（情绪、风险水平）
- 板块轮动分析
- 个股信号
- 新闻摘要
- 警报和建议

### 5. Telegram推送
自动推送市场情报到Telegram频道。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件或设置环境变量：

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 3. 运行扫描

```bash
# 开发模式
npm run dev

# 编译并运行
npm run scan

# 持续监控（需要安装nodemon）
npm run watch
```

## 📁 项目结构

```
market-intelligence-scanner/
├── config.ts              # 配置文件
├── scanner.ts             # 主入口
├── reporter.ts            # 报告生成器
├── notifier.ts            # Telegram推送
├── fetchers/
│   ├── types.ts           # 类型定义
│   ├── investx-client.ts  # InvestX API客户端
│   └── massive-client.ts  # Massive API客户端
├── analyzers/
│   ├── sector-rotation.ts     # 板块轮动分析
│   ├── watchlist-tracker.ts   # 个股追踪
│   └── news-aggregator.ts     # 新闻聚合
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 配置说明

在 `config.ts` 中可以调整：

- **ETF_PAIRS**: 自定义ETF对
- **WATCHLIST**: 自定义监控股票列表
- **Z_SCORE_WINDOW**: Z-Score计算窗口（默认20日）
- **Z_SCORE_THRESHOLD**: 极端信号阈值（默认2.0）
- **SCAN_INTERVAL_MINUTES**: 扫描间隔（默认30分钟）

## 📊 API说明

### InvestX API

基础URL: `https://investx-production.up.railway.app`

- `GET /api/performance?ticker=XXX` - 获取股票表现
- `GET /api/chart-data?ticker=XXX&timeframe=30m` - 获取K线数据
- `GET /api/multi-agent-analyze?ticker=XXX` - 获取AI分析

### Massive API

基础URL: `https://api.massive.com/v2`

- `GET /reference/news?ticker=XXX` - 获取股票新闻

## 🎯 使用场景

1. **日常监控**: 每30分钟自动扫描，了解市场动态
2. **交易决策**: 高置信度AI信号辅助买卖决策
3. **风险预警**: 极端信号和异常波动提醒
4. **新闻追踪**: 及时获取重要新闻和情感分析

## 📝 示例输出

```markdown
# 📈 市场情报扫描报告

**扫描时间**: 2024-03-15 21:30

## 🌐 市场概览

- **整体情绪**: 🐂 BULLISH
- **风险水平**: 🟡 MEDIUM

## 📊 板块轮动分析

### 🚀 科技vs小盘 (QQQ/IWM)
- **QQQ**: $450.25 (+1.23%)
- **IWM**: $198.50 (+0.45%)
- **比率**: 2.2675 (+0.78%)
- **Z-Score**: 1.85
- **信号**: bullish
```

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License
