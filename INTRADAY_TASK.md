开发盘中实时轮动监控功能。

## 需求
盘中追踪大资金流向，回答"科技股抛售的资金去了哪里"

## 核心指标

### 1. 锚定开盘价的实时相对强弱 (Intraday RS)
- 板块日内涨幅 = (当前价 - 开盘价) / 开盘价
- 板块相对强弱 = 板块日内涨幅 - SPY日内涨幅
- 数据来源: Polygon API 的 /v1/open-close/{ticker}/{date} 获取今日开盘价

### 2. VWAP 监控
- 价格与日内VWAP的位置关系及偏离度
- 数据来源: Polygon API 的 /v2/aggs/ticker/{ticker}/prev 返回 vw 字段

### 3. 资金流向信号判断
- 流入: 价格高于VWAP且相对强弱为正
- 流出: 价格低于VWAP且相对强弱为负

## 11个标普板块ETF
XLK(科技), XLY(可选消费), XLP(必需消费), XLV(医疗), XLF(金融), XLI(工业), XLB(材料), XLE(能源), XLU(公用事业), XLRE(房地产), XLC(通信)

## 实现位置
项目路径: /Users/yh/.openclaw/workspace/market-intelligence-scanner

1. 新建 analyzers/intraday-rotation.ts
   - getIntradayRotation() 函数
   - 获取11个板块ETF的盘中数据
   - 计算相对强弱和VWAP偏离度
   - 返回按强弱排序的结果

2. 修改 reporter.ts
   - 新增 generateIntradayRotationSection()
   - 显示格式: | 板块 | 开盘至今 | vs SPY | VWAP | 信号 |
   - 按强弱降序排列

3. 修改 scanner.ts
   - 盘中时段调用 intraday-rotation 分析
   - 添加到报告中
