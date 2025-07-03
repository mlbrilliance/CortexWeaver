/**
 * Gemini CLI Client
 * Integrates with Google's Gemini CLI tool for agent operations
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface GeminiClientConfig {
  apiKey?: string;
  useApiKey?: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface GeminiResponse {
  content: string;
  success: boolean;
  error?: string;
  executionTime: number;
}

export interface GeminiSessionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export class GeminiClient {
  private config: GeminiClientConfig;
  private tempDir: string;

  constructor(config: GeminiClientConfig = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 2,
      useApiKey: config.useApiKey || false,
      ...config
    };
    
    this.tempDir = path.join(os.tmpdir(), 'cortexweaver-gemini');
    this.ensureTempDir();
  }

  /**
   * Check if Gemini CLI is available
   */
  async checkGeminiAvailability(): Promise<boolean> {
    try {
      const result = await this.executeCommand('gemini --version', { timeout: 5000 });
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send message to Gemini CLI and get response
   */
  async sendMessage(
    message: string, 
    options: GeminiSessionOptions = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    
    try {
      // Prepare environment
      const env = await this.prepareEnvironment();
      
      // Create temporary prompt file
      const promptPath = await this.createPromptFile(message, options);
      
      // Execute Gemini CLI command
      const command = this.buildGeminiCommand(promptPath);
      const result = await this.executeCommand(command, { env });
      
      // Cleanup
      this.cleanup(promptPath);
      
      return {
        content: result.stdout || '',
        success: result.success,
        error: result.stderr,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        content: '',
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Send message using interactive session mode
   */
  async sendMessageInteractive(
    message: string,
    options: GeminiSessionOptions = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    
    try {
      const env = await this.prepareEnvironment();
      const promptWithSystem = this.buildPromptWithSystem(message, options);
      
      // Use echo to pipe to gemini CLI
      const command = `echo "${this.escapeForShell(promptWithSystem)}" | gemini`;
      const result = await this.executeCommand(command, { env, shell: true });
      
      return {
        content: result.stdout || '',
        success: result.success,
        error: result.stderr,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        content: '',
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Prepare environment for Gemini CLI execution
   */
  private async prepareEnvironment(): Promise<Record<string, string>> {
    const env = { ...process.env };
    
    // Set Gemini API key if provided
    if (this.config.apiKey) {
      env.GEMINI_API_KEY = this.config.apiKey;
    }
    
    // Check for existing API key in environment
    if (!env.GEMINI_API_KEY && !env.GOOGLE_API_KEY) {
      // Try to load from .env file
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const geminiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
        const googleKeyMatch = envContent.match(/GOOGLE_API_KEY=(.+)/);
        
        if (geminiKeyMatch) {
          env.GEMINI_API_KEY = geminiKeyMatch[1].trim().replace(/["']/g, '');
        } else if (googleKeyMatch) {
          env.GEMINI_API_KEY = googleKeyMatch[1].trim().replace(/["']/g, '');
        }
      }
    }
    
    return env;
  }

  /**
   * Create temporary prompt file for Gemini CLI
   */
  private async createPromptFile(
    message: string, 
    options: GeminiSessionOptions
  ): Promise<string> {
    const promptContent = this.buildPromptWithSystem(message, options);
    const fileName = `gemini-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`;
    const filePath = path.join(this.tempDir, fileName);
    
    await fs.promises.writeFile(filePath, promptContent, 'utf8');
    return filePath;
  }

  /**
   * Build Gemini CLI command
   */
  private buildGeminiCommand(promptPath: string): string {
    // Use the -p flag for prompt mode as mentioned in the GitHub repo
    return `gemini -p < "${promptPath}"`;
  }

  /**
   * Build prompt with system instructions
   */
  private buildPromptWithSystem(
    message: string, 
    options: GeminiSessionOptions
  ): string {
    let prompt = '';
    
    // Add system prompt if provided
    if (options.systemPrompt) {
      prompt += `System: ${options.systemPrompt}\n\n`;
    }
    
    // Add the main message
    prompt += message;
    
    return prompt;
  }

  /**
   * Execute shell command with timeout and error handling
   */
  private async executeCommand(
    command: string, 
    options: { env?: Record<string, string>; timeout?: number; shell?: boolean } = {}
  ): Promise<{ success: boolean; stdout?: string; stderr?: string }> {
    return new Promise((resolve) => {
      const timeout = options.timeout || this.config.timeout;
      const env = options.env || process.env;
      
      let child: ChildProcess;
      
      if (options.shell) {
        child = spawn(command, { shell: true, env });
      } else {
        const [cmd, ...args] = command.split(' ');
        child = spawn(cmd, args, { env });
      }
      
      let stdout = '';
      let stderr = '';
      let completed = false;
      
      // Set up timeout
      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          child.kill('SIGTERM');
          resolve({
            success: false,
            stderr: 'Command timed out'
          });
        }
      }, timeout);
      
      // Collect stdout
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }
      
      // Collect stderr
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      // Handle completion
      child.on('close', (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          
          resolve({
            success: code === 0,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        }
      });
      
      // Handle errors
      child.on('error', (error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          
          resolve({
            success: false,
            stderr: error.message
          });
        }
      });
    });
  }

  /**
   * Escape string for shell command
   */
  private escapeForShell(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * Ensure temp directory exists
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Cleanup temporary files
   */
  private cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Get client configuration
   */
  getConfiguration(): GeminiClientConfig {
    return { ...this.config };
  }

  /**
   * Update client configuration
   */
  updateConfiguration(updates: Partial<GeminiClientConfig>): void {
    Object.assign(this.config, updates);
  }
}