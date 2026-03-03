# 盘中实时轮动监控 - 开发计划

## 核心需求
盘中追踪大资金流向，回答"科技股抛售的资金去了哪里"

## 关键指标

### 1. 锚定开盘价的实时相对强弱 (Intraday RS)
- **计算逻辑**：
  - 板块日内涨幅 = (当前价 - 开盘价) / 开盘价
  - 板块相对强弱 = 板块日内涨幅 - SPY日内涨幅
- **数据需求**：当前价、今日开盘价

### 2. VWAP (成交量加权平均价)
- **监控方式**：价格与日内VWAP的位置关系及偏离度
- **数据需求**：Polygon API 的 `/v2/snap/locale/us/markets/stocks/tickers/{ticker}` 返回 `min/vwap`

### 3. TICK 与 TRIN
- **TICK**：当前秒向上报价股票数 - 向下报价股票数
- **TRIN**：(上涨数/下跌数) / (上涨量/下跌量)
- **数据需求**：需要特殊数据源（可能需要Polygon的指数数据或iex）

### 4. RVOL (相对成交量)
- **计算逻辑**：当前5分钟成交量 / 过去10日同一时间平均成交量
- **数据需求**：5分钟K线数据

---

## 实现方案

### Phase 1: 核心数据获取
1. 修改 `investx-client.ts` 或 `polygon.ts`：
   - 添加 `getIntradayData(ticker)` 获取开盘价、当前价、VWAP
   - 添加 `getRVOL(ticker, interval)` 计算5分钟RVOL

### Phase 2: 盘中轮动分析器
2. 新建 `analyzers/intraday-rotation.ts`：
   - `analyzeIntradayRotation()` - 分析11个板块ETF的盘中表现
   - 返回按相对强弱排序的板块列表

### Phase 3: 报告整合
3. 修改 `reporter.ts`：
   - 新增 `generateIntradayRotationSection()` 
   - 显示两列核心数据：
     - 开盘至今涨跌幅 (From Open %)
     - VWAP 状态 (高于/低于及偏离度)
   - 按强弱降序排列

### Phase 4: 市场状态判断
4. 修改 `scanner.ts`：
   - 盘中时段（21:30-04:00）显示"盘中实时轮动"板块
   - 盘前/盘后显示原来的日线级别分析

---

## 11个标普板块ETF
```typescript
const SECTOR_ETFS = [
  { ticker: 'XLK', name: '科技' },
  { ticker: 'XLY', name: '可选消费' },
  { ticker: 'XLP', name: '必需消费' },
  { ticker: 'XLV', name: '医疗' },
  { ticker: 'XLF', name: '金融' },
  { ticker: 'XLI', name: '工业' },
  { ticker: 'XLB', name: '材料' },
  { ticker: 'XLE', name: '能源' },
  { ticker: 'XLU', name: '公用事业' },
  { ticker: 'XLRE', name: '房地产' },
  { ticker: 'XLC', name: '通信' },
];
```

---

## 报告格式示例

### 盘中实时轮动 (Live Rotation)
> 🕐 更新时间: 22:15 | 美股盘中

| 板块 | 开盘至今 | vs SPY | VWAP | 偏离度 | 信号 |
|------|----------|--------|------|--------|------|
| XLU 公用事业 | +1.2% | +0.8% | ▲高于 | +0.3% | 资金流入 |
| XLV 医疗 | +0.9% | +0.5% | ▲高于 | +0.2% | 资金流入 |
| XLE 能源 | +0.5% | +0.1% | ▲高于 | +0.1% | 建仓中 |
| XLK 科技 | -1.5% | -1.9% | ▼低于 | -0.5% | 资金流出 |

**解读**: 科技股资金正在流向公用事业和医疗板块，避险情绪升温。

---

## 待确认事项
1. TICK/TRIN 数据源 - Polygon是否支持？还是需要其他API？
2. 盘中刷新频率 - 每30分钟够吗？还是需要更频繁？
3. VWAP数据 - InvestX后端是否有？还是需要直接调Polygon？
