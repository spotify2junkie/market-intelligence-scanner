// test-api.ts - 测试 API 客户端修改
import { investXClient } from './fetchers/investx-client';

async function testAPI() {
  const ticker = 'TSLA';
  
  console.log('='.repeat(60));
  console.log(`Testing API client for ${ticker}`);
  console.log('='.repeat(60));
  
  try {
    // 测试技术指标
    console.log('\n[TEST] Fetching technicals...');
    const technicals = await investXClient.getTechnicals(ticker, '1d');
    console.log('[TEST] Technicals result:', {
      rsi: technicals.rsi,
      macd: technicals.macd,
      hasData: !!(technicals.rsi || technicals.macd),
      fullData: technicals
    });
    
    // 测试图表数据
    console.log('\n[TEST] Fetching chart data...');
    const chartData = await investXClient.getChartData(ticker, '1d');
    console.log('[TEST] Chart data result:', {
      barsCount: chartData.bars.length,
      hasSupportResistance: !!chartData.supportResistance,
      supports: chartData.supportResistance?.supports?.length || 0,
      resistances: chartData.supportResistance?.resistances?.length || 0
    });
    
    // 测试多智能体分析
    console.log('\n[TEST] Fetching multi-agent analysis...');
    const aiAnalysis = await investXClient.getMultiAgentAnalysis(ticker);
    console.log('[TEST] AI analysis result:', {
      signal: aiAnalysis.consensus.signal,
      confidence: aiAnalysis.consensus.confidence,
      hasReasoning: !!aiAnalysis.consensus.reasoning,
      agentsCount: aiAnalysis.agents.length
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('[TEST] All API tests completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('[TEST] Test failed:', error);
  }
}

testAPI();
