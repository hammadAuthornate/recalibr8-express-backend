const express = require('express');
const ccxt = require('ccxt');
const app = express();
const PORT = 3000;

// Global data storage
const trades = [];
const botResults = {
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalProfit: 0,
  totalLoss: 0,
  netProfitLoss: 0,
  winRate: 0,
  currentBalance: 1000, // Starting with 1000 USDT for paper trading
  initialBalance: 1000,
  isRunning: true,
  lastUpdate: Date.now(),
  currentPrice: 0
};

// Configuration
const config = {
  exchange: 'binance',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  paperTrading: true,
  dcaSettings: {
    dipThreshold: -0.03, // Buy when price drops 3% from recent high
    positionSize: 0.1, // 10% of balance per buy
    maxPositions: 5, // Max concurrent positions
    takeProfit: 0.05, // 5% profit target
    stopLoss: -0.03, // 3% stop loss
    coolDownPeriod: 3600000 // 1 hour between buys (ms)
  }
};

// Initialize exchange (paper trading doesn't need keys)
const exchange = new ccxt[config.exchange]({
  enableRateLimit: true,
  options: { adjustForTimeDifference: true }
});

if (config.paperTrading) {
  exchange.setSandboxMode(true);
}

// Track price history for dip detection
const priceHistory = {
  high: 0,
  low: 0,
  current: 0,
  lastBuyPrice: 0,
  lastBuyTime: 0
};

// Main trading function
async function executeStrategy() {
  try {
    // Fetch current price and update tracking
    const ticker = await exchange.fetchTicker(config.symbol);
    const currentPrice = ticker.last;
    priceHistory.current = currentPrice;
    botResults.currentPrice = currentPrice;
    botResults.lastUpdate = Date.now();

    // Update high/low tracking
    if (currentPrice > priceHistory.high || priceHistory.high === 0) {
      priceHistory.high = currentPrice;
    }
    if (currentPrice < priceHistory.low || priceHistory.low === 0) {
      priceHistory.low = currentPrice;
    }

    // Calculate current drawdown from high
    const drawdown = (currentPrice - priceHistory.high) / priceHistory.high;

    // Check if we should buy (dip detected and cooldown passed)
    const openTrades = trades.filter(t => t.status === 'open');
    const canBuyMore = openTrades.length < config.dcaSettings.maxPositions;
    const cooldownPassed = Date.now() - priceHistory.lastBuyTime > config.dcaSettings.coolDownPeriod;

    if (drawdown <= config.dcaSettings.dipThreshold && canBuyMore && cooldownPassed) {
      // Execute buy
      const positionAmount = botResults.currentBalance * config.dcaSettings.positionSize;
      const buyAmount = positionAmount / currentPrice;

      const trade = {
        id: `trade-${Date.now()}`,
        symbol: config.symbol,
        side: 'buy',
        amount: buyAmount,
        price: currentPrice,
        timestamp: Date.now(),
        profit: 0,
        status: 'open'
      };

      trades.push(trade);
      priceHistory.lastBuyPrice = currentPrice;
      priceHistory.lastBuyTime = Date.now();
      botResults.currentBalance -= positionAmount;
      botResults.totalTrades++;
      updateResults();

      console.log(`BUY executed at ${currentPrice} for ${buyAmount} BTC`);
    }

    // Check open trades for exit conditions
    for (const trade of openTrades) {
      const profitPct = (currentPrice - trade.price) / trade.price;
      
      // Check take profit
      if (profitPct >= config.dcaSettings.takeProfit) {
        closeTrade(trade, currentPrice, 'take profit');
        continue;
      }

      // Check stop loss
      if (profitPct <= config.dcaSettings.stopLoss) {
        closeTrade(trade, currentPrice, 'stop loss');
        continue;
      }
    }

  } catch (error) {
    console.error('Strategy execution error:', error.message);
  }
}

function closeTrade(trade, currentPrice, reason) {
  const profit = (currentPrice - trade.price) * trade.amount;
  
  trade.profit = profit;
  trade.status = 'closed';
  
  botResults.currentBalance += trade.amount * currentPrice;
  botResults.netProfitLoss += profit;
  
  if (profit > 0) {
    botResults.winningTrades++;
    botResults.totalProfit += profit;
  } else {
    botResults.losingTrades++;
    botResults.totalLoss += Math.abs(profit);
  }
  
  botResults.winRate = (botResults.winningTrades / botResults.totalTrades) * 100;
  botResults.lastUpdate = Date.now();
  
  console.log(`Trade closed (${reason}): ${trade.amount} BTC at ${currentPrice}. Profit: ${profit.toFixed(2)} USDT`);
}

function updateResults() {
  botResults.winRate = botResults.totalTrades > 0 
    ? (botResults.winningTrades / botResults.totalTrades) * 100 
    : 0;
  botResults.lastUpdate = Date.now();
}

// API Endpoints
app.get('/api/trades', (req, res) => {
  res.json(trades);
});

app.get('/api/results', (req, res) => {
  res.json(botResults);
});

// Start the bot
async function startBot() {
  console.log('Starting DCA trading bot...');
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}`);
  
  // Run strategy every minute
  setInterval(executeStrategy, 60000);
  
  // Initial execution
  await executeStrategy();
  
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

startBot().catch(console.error);