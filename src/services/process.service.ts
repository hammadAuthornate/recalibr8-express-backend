import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { BotConfig, BotProcess, BotState } from "../types/bot";
import { ApiError } from "../utils/apiError";

export class ProcessService {
  private static readonly PROCESSES_FILE = path.join(
    process.cwd(),
    "bot-processes.json"
  );

  private static async readProcesses(): Promise<Record<string, BotProcess>> {
    try {
      const data = await fs.readFile(this.PROCESSES_FILE, "utf-8");
      return JSON.parse(data) as Record<string, BotProcess>;
    } catch (error) {
      return {};
    }
  }

  private static async writeProcesses(
    processes: Record<string, BotProcess>
  ): Promise<void> {
    await fs.writeFile(
      this.PROCESSES_FILE,
      JSON.stringify(processes, null, 2),
      "utf-8"
    );
  }

  static async startProcess(config: BotConfig): Promise<BotProcess> {
    // Check if process already exists
    const processes = await this.readProcesses();
    if (processes[config.processKey]) {
      throw new ApiError(400, "Bot already running for this process key");
    }

    // Get the bot script path
    const botScriptPath = path.join(
      process.cwd(),
      "src",
      "public",
      "bots",
      `${config.processKey}.js`
    );
    const botConfigPath = path.join(process.cwd(), `${config.processKey}.json`);

    // Save bot config to file
    await fs.writeFile(botConfigPath, JSON.stringify(config, null, 2), "utf-8");

    // Spawn the process
    const child = spawn("node", [botScriptPath, botConfigPath]);

    if (!child.pid) {
      throw new ApiError(500, "Failed to spawn bot process");
    }

    // Create bot process object
    const botProcess: BotProcess = {
      pid: child.pid,
      status: "running",
      config,
      error: "",
      lastUpdated: new Date().toISOString(),
      state: {},
      performance: {
        totalTrades: 0,
        profitableTrades: 0,
        totalPnL: 0,
        maxProfit: 0,
        maxLoss: 0,
        assetHigh: 0,
        assetLow: 0,
        tradeHistory: {
          symbol: config.symbol,
          startTime: new Date(),
          endTime: new Date(),
          totalTrades: 0,
          winningTrades: 0,
          winRate: 0,
          totalPnL: 0,
          maxProfit: 0,
          maxLoss: 0,
          assetHigh: 0,
          assetLow: 0,
          trades: [],
          parameters: {
            atrPeriod: config.atrPeriod,
            depositAmount: config.depositAmount,
            interval: "1h",
          },
        },
      },
    };

    // Save process state
    processes[config.processKey] = botProcess;
    await this.writeProcesses(processes);

    // Handle process output
    child.stdout.on("data", async (data) => {
      const output = data.toString();
      console.log(`[Bot ${config.processKey}] Output: ${output}`);
      await this.handleProcessOutput(config.processKey, output);
    });

    child.stderr.on("data", async (data) => {
      if (data.toString().includes("DeprecationWarning")) return;

      console.error(`[Bot ${config.processKey}] Error: ${data.toString()}`);
      await this.updateProcessError(config.processKey, data.toString());
    });

    child.on("close", async (code) => {
      console.log(
        `[Bot ${config.processKey}] Process exited with code ${code}`
      );
      await this.updateProcessStatus(config.processKey, "stopped");
    });

    return botProcess;
  }

  static async getAllProcesses(): Promise<BotProcess[]> {
    const processes = await this.readProcesses();
    return Object.values(processes);
  }

  static async getProcessByKey(processKey: string): Promise<BotProcess> {
    const processes = await this.readProcesses();
    const process = processes[processKey];

    if (!process) {
      throw new ApiError(404, "Process not found");
    }

    return process;
  }

  static async stopProcess(processKey: string): Promise<void> {
    const processes = await this.readProcesses();
    const processBot = processes[processKey];

    if (!processBot) {
      throw new ApiError(404, "Process not found");
    }

    // Kill the process
    if (processBot.pid) {
      try {
        spawn("kill", ["-9", processBot.pid.toString()]);
      } catch (error) {
        throw new ApiError(500, "Failed to terminate process");
      }
    }

    // Clean up config file
    const configPath = path.join(process.cwd(), `${processKey}.json`);
    try {
      await fs.unlink(configPath);
    } catch (error) {
      console.error("Error deleting config file:", error);
    }

    // Remove from processes list
    delete processes[processKey];
    await this.writeProcesses(processes);
  }

  private static async updateProcessStatus(
    processKey: string,
    status: BotProcess["status"]
  ): Promise<void> {
    const processes = await this.readProcesses();
    if (processes[processKey]) {
      processes[processKey].status = status;
      processes[processKey].lastUpdated = new Date().toISOString();
      await this.writeProcesses(processes);
    }
  }

  private static async updateProcessError(
    processKey: string,
    error: string
  ): Promise<void> {
    const processes = await this.readProcesses();
    if (processes[processKey]) {
      processes[processKey].status = "error";
      processes[processKey].error = error;
      processes[processKey].lastUpdated = new Date().toISOString();
      await this.writeProcesses(processes);
    }
  }

  static async restartProcess(processKey: string): Promise<BotProcess> {
    // Get existing process
    const processes = await this.readProcesses();
    const existingProcess = processes[processKey];

    if (!existingProcess) {
      throw new ApiError(404, "Process not found");
    }

    // Stop the existing process
    await this.stopProcess(processKey);

    // Start a new process with the same config
    return await this.startProcess(existingProcess.config);
  }

  private static async handleProcessOutput(
    processKey: string,
    output: string
  ): Promise<void> {
    const processes = await this.readProcesses();
    const process = processes[processKey];

    if (!process) return;

    // Update process state based on output
    const stateUpdate = this.parseStateUpdate(output);
    const metricsUpdate = this.parseMetricsUpdate(output);

    if (stateUpdate) {
      process.state = {
        ...process.state,
        ...stateUpdate,
      };
    }

    if (metricsUpdate) {
      process.performance = {
        ...process.performance,
        ...metricsUpdate,
      };
    }

    process.lastUpdated = new Date().toISOString();
    await this.writeProcesses(processes);
  }

  private static parseStateUpdate(output: string): Partial<BotState> | null {
    const priceMatch = output.match(/Current Price: (\d+\.\d+)/);
    const upperMatch = output.match(/Upper Breakout: (\d+\.\d+)/);
    const lowerMatch = output.match(/Lower Breakout: (\d+\.\d+)/);
    const stateMatch = output.match(/Trade State: (BUY|SELL)/);

    if (!priceMatch && !upperMatch && !lowerMatch && !stateMatch) return null;

    return {
      currentPrice: priceMatch ? parseFloat(priceMatch[1]) : undefined,
      upperBreakout: upperMatch ? parseFloat(upperMatch[1]) : undefined,
      lowerBreakout: lowerMatch ? parseFloat(lowerMatch[1]) : undefined,
      tradeState: stateMatch ? (stateMatch[1] as "BUY" | "SELL") : undefined,
    };
  }

  private static parseMetricsUpdate(
    output: string
  ): Partial<BotProcess["performance"]> | null {
    const pnlMatch = output.match(/Trade PnL: (-?\d+\.\d+)/);
    const totalMatch = output.match(/Total Trades: (\d+)/);
    const profitableMatch = output.match(/Profitable Trades: (\d+)/);

    if (!pnlMatch && !totalMatch && !profitableMatch) return null;

    return {
      totalPnL: pnlMatch ? parseFloat(pnlMatch[1]) : undefined,
      totalTrades: totalMatch ? parseInt(totalMatch[1]) : undefined,
      profitableTrades: profitableMatch
        ? parseInt(profitableMatch[1])
        : undefined,
    };
  }
}
