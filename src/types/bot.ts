export interface BOT extends BotConfig {
  id?: string;
  prompt: string;
  userId: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type BotMode = "watcher" | "action";
export type BotStatus = "stopped" | "running" | "error";

export interface BotConfig {
  processKey: string;
  symbol: string;
  mode: BotMode;
  binanceApiKey?: string;
  binanceApiSecret?: string;
  atrPeriod: number;
  depositAmount: number;
  stateTimeout: number;
  tradeFrequencyThreshold: number;
  tradeFrequencyWindow: number;
  performanceMetrics?: PerformanceMetrics;
  backtest?: HistoricalAnalysisResult;
  state?: BotState;
  trades: Array<{
    type: "BUY" | "SELL";
    entry: number;
    exit: number | null;
    quantity: number;
    pnl: number | null;
    time: number;
  }>;
}

export interface BotState {
  upperBreakout?: number;
  lowerBreakout?: number;
  currentPrice?: number;
  tradeState?: "BUY" | "SELL" | null;
  entryPrice?: number;
  tradeQuantity?: number;
  atr?: number;
  atrMultiplier?: number;
  movingAverage?: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  profitableTrades: number;
  totalPnL: number;
  maxProfit: number;
  maxLoss: number;
  assetHigh: number;
  assetLow: number;
  tradeHistory: HistoricalAnalysisResult;
}

export interface BotProcess {
  pid?: number;
  status: BotStatus;
  config: BotConfig;
  error?: string;
  lastUpdated?: string;
  state: BotState;
  performance: PerformanceMetrics;
}

export interface HistoricalAnalysisResult {
  symbol: string;
  startTime: Date;
  endTime: Date;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  totalPnL: number;
  maxProfit: number;
  maxLoss: number;
  assetHigh: number;
  assetLow: number;
  trades: Array<{
    type: "BUY" | "SELL";
    entry: number;
    exit: number | null;
    quantity: number;
    pnl: number | null;
    time: number;
  }>;
  parameters: {
    atrPeriod: number;
    depositAmount: number;
    interval: string;
  };
}

export type ManageProcessFn = (
  processKey: string,
  output: string
) => Promise<void>;

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: Date;
}

export interface PriceData {
  high: number;
  low: number;
  close: number;
}
