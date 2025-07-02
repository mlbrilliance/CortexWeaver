import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthMethod, AuthProvider } from './index';

/**
 * AuthStrategies handles the various authentication strategies and validation logic
 */
export class AuthStrategies {
  private homeDir: string;

  constructor() {
    this.homeDir = process.env.HOME || os.homedir();
  }

  /**
   * Discover Claude authentication methods in order of priority:
   * 1. Claude Code session tokens
   * 2. Claude Code config files
   * 3. ANTHROPIC_API_KEY environment variable
   * 4. CLAUDE_API_KEY environment variable (legacy)
   */
  async discoverClaudeAuthentication(): Promise<AuthProvider> {
    // 1. Check for Claude Code session tokens (highest priority)
    const sessionAuth = await this.checkClaudeCodeSession();
    if (sessionAuth && sessionAuth.method === AuthMethod.CLAUDE_CODE_SESSION) {
      return sessionAuth;
    }

    // 2. Check for Claude Code config files
    const configAuth = await this.checkClaudeCodeConfig();
    if (configAuth && configAuth.method === AuthMethod.CLAUDE_CODE_CONFIG) {
      return configAuth;
    }

    // 3. Check for ANTHROPIC_API_KEY environment variable
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      return {
        method: AuthMethod.API_KEY,
        details: { api_key: anthropicApiKey }
      };
    }

    // 4. Check for CLAUDE_API_KEY environment variable (legacy)
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (claudeApiKey) {
      return {
        method: AuthMethod.API_KEY,
        details: { api_key: claudeApiKey }
      };
    }

    // If we found an expired session, report that specifically
    if (sessionAuth && sessionAuth.error) {
      return sessionAuth;
    }

    // No authentication found
    return {
      method: AuthMethod.NONE,
      error: 'No Claude authentication found'
    };
  }

  /**
   * Check for Claude Code session authentication
   */
  private async checkClaudeCodeSession(): Promise<AuthProvider | null> {
    try {
      const sessionPath = path.join(this.homeDir, '.config', 'claude', 'session.json');
      
      if (!fs.existsSync(sessionPath)) {
        return null;
      }

      const sessionContent = fs.readFileSync(sessionPath, 'utf-8');
      const sessionData = JSON.parse(sessionContent);

      // Check if session is expired
      if (sessionData.expires_at) {
        const expiresAt = new Date(sessionData.expires_at);
        if (expiresAt <= new Date()) {
          return {
            method: AuthMethod.NONE,
            error: 'Claude Code session token has expired'
          };
        }
      }

      return {
        method: AuthMethod.CLAUDE_CODE_SESSION,
        details: {
          session_token: sessionData.session_token,
          expires_at: sessionData.expires_at,
          user_id: sessionData.user_id
        }
      };
    } catch (error) {
      return {
        method: AuthMethod.NONE,
        error: `Failed to read Claude Code session configuration: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check for Claude Code config file authentication
   */
  private async checkClaudeCodeConfig(): Promise<AuthProvider | null> {
    try {
      const configPath = path.join(this.homeDir, '.config', 'claude', 'config.json');
      
      if (!fs.existsSync(configPath)) {
        return null;
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const configData = JSON.parse(configContent);

      if (!configData.api_key) {
        return null;
      }

      return {
        method: AuthMethod.CLAUDE_CODE_CONFIG,
        details: {
          api_key: configData.api_key
        }
      };
    } catch (error) {
      return {
        method: AuthMethod.NONE,
        error: `Failed to read Claude Code configuration: ${(error as Error).message}`
      };
    }
  }

  /**
   * Discover Gemini authentication methods in order of priority:
   * 1. Gemini CLI configuration
   * 2. GOOGLE_API_KEY environment variable
   * 3. GEMINI_API_KEY environment variable (legacy)
   */
  async discoverGeminiAuthentication(): Promise<AuthProvider> {
    // 1. Check for Gemini CLI configuration
    const geminiCliAuth = await this.checkGeminiCli();
    if (geminiCliAuth && geminiCliAuth.method === AuthMethod.GEMINI_CLI) {
      return geminiCliAuth;
    }

    // 2. Check for GOOGLE_API_KEY environment variable
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (googleApiKey) {
      return {
        method: AuthMethod.API_KEY,
        details: { api_key: googleApiKey }
      };
    }

    // 3. Check for GEMINI_API_KEY environment variable (legacy)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      return {
        method: AuthMethod.API_KEY,
        details: { api_key: geminiApiKey }
      };
    }

    // No authentication found
    return {
      method: AuthMethod.NONE,
      error: 'No Gemini authentication found'
    };
  }

  /**
   * Check for Gemini CLI authentication
   */
  private async checkGeminiCli(): Promise<AuthProvider | null> {
    try {
      // Check for Google Cloud SDK credentials
      const gcloudDir = path.join(this.homeDir, '.config', 'gcloud');
      const credentialsPath = path.join(gcloudDir, 'application_default_credentials.json');
      const geminiConfigPath = path.join(gcloudDir, 'gemini-config.json');

      // Check if either credentials exist
      if (!fs.existsSync(credentialsPath) && !fs.existsSync(geminiConfigPath)) {
        return null;
      }

      let authDetails: any = {};

      // Read Google Cloud credentials if available
      if (fs.existsSync(credentialsPath)) {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
        const credentialsData = JSON.parse(credentialsContent);
        
        authDetails.client_id = credentialsData.client_id;
        authDetails.client_secret = credentialsData.client_secret;
        authDetails.refresh_token = credentialsData.refresh_token;
      }

      // Read Gemini CLI config if available
      if (fs.existsSync(geminiConfigPath)) {
        const geminiContent = fs.readFileSync(geminiConfigPath, 'utf-8');
        const geminiData = JSON.parse(geminiContent);
        
        authDetails.api_key = geminiData.api_key;
        authDetails.project = geminiData.project;
      }

      return {
        method: AuthMethod.GEMINI_CLI,
        details: authDetails
      };
    } catch (error) {
      return {
        method: AuthMethod.NONE,
        error: `Failed to read Gemini CLI configuration: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check if authentication is valid and not expired
   */
  async isAuthenticationValid(auth: AuthProvider): Promise<boolean> {
    if (auth.method === AuthMethod.NONE) {
      return false;
    }

    // Check for authentication errors
    if (auth.error) {
      return false;
    }

    // Check for expiration
    if (await this.isAuthExpired(auth)) {
      return false;
    }

    // Validate based on method
    if (auth.method === AuthMethod.CLAUDE_CODE_SESSION || 
        auth.method === AuthMethod.CLAUDE_CODE_CONFIG) {
      return await this.validateClaudeAuth(auth);
    }

    if (auth.method === AuthMethod.GEMINI_CLI) {
      return await this.validateGeminiAuth(auth);
    }

    if (auth.method === AuthMethod.API_KEY) {
      return await this.validateApiKeyAuth(auth);
    }

    return false;
  }

  /**
   * Check if authentication is expired
   */
  async isAuthExpired(auth: AuthProvider): Promise<boolean> {
    if (auth.details?.expires_at) {
      const expiresAt = new Date(auth.details.expires_at);
      return expiresAt <= new Date();
    }
    return false;
  }

  /**
   * Validate Claude authentication
   */
  async validateClaudeAuth(auth: AuthProvider): Promise<boolean> {
    if (auth.method === AuthMethod.CLAUDE_CODE_SESSION) {
      return !!(auth.details?.session_token);
    }

    if (auth.method === AuthMethod.CLAUDE_CODE_CONFIG || auth.method === AuthMethod.API_KEY) {
      const apiKey = auth.details?.api_key;
      return !!(apiKey && (apiKey.startsWith('sk-ant-') || apiKey.startsWith('sk-claude-')));
    }

    return false;
  }

  /**
   * Validate Gemini authentication
   */
  async validateGeminiAuth(auth: AuthProvider): Promise<boolean> {
    if (auth.method === AuthMethod.GEMINI_CLI) {
      return !!(auth.details?.api_key || auth.details?.refresh_token);
    }

    if (auth.method === AuthMethod.API_KEY) {
      return !!(auth.details?.api_key);
    }

    return false;
  }

  /**
   * Validate API key authentication
   */
  private async validateApiKeyAuth(auth: AuthProvider): Promise<boolean> {
    const apiKey = auth.details?.api_key;
    if (!apiKey) return false;

    // Basic format validation
    return apiKey.length > 10; // Very basic validation
  }

  /**
   * Generate authentication recommendations
   */
  generateRecommendations(claudeAuth: AuthProvider, geminiAuth: AuthProvider): string[] {
    const recommendations: string[] = [];

    // Claude recommendations
    if (claudeAuth.method === AuthMethod.NONE) {
      recommendations.push(
        'No Claude authentication found. Install Claude Code CLI or set ANTHROPIC_API_KEY environment variable.'
      );
    } else if (claudeAuth.error) {
      recommendations.push(`Claude authentication issue: ${claudeAuth.error}`);
    }

    // Gemini recommendations
    if (geminiAuth.method === AuthMethod.NONE) {
      recommendations.push(
        'No Gemini authentication found. Install Gemini CLI or set GOOGLE_API_KEY environment variable.'
      );
    } else if (geminiAuth.error) {
      recommendations.push(`Gemini authentication issue: ${geminiAuth.error}`);
    }

    // Priority recommendations
    if (claudeAuth.method === AuthMethod.API_KEY && !claudeAuth.details?.api_key?.startsWith('sk-ant-')) {
      recommendations.push(
        'Consider using Claude Code CLI for better authentication management and Max Plan features.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All authentication methods are properly configured.');
    }

    return recommendations;
  }

  /**
   * Attempt to refresh Claude authentication
   */
  async refreshClaudeAuth(): Promise<boolean> {
    // For now, we don't implement automatic refresh
    // This would require calling Claude Code CLI or handling OAuth flows
    return false;
  }

  /**
   * Attempt to refresh Gemini authentication
   */
  async refreshGeminiAuth(): Promise<boolean> {
    // For now, we don't implement automatic refresh
    // This would require calling gcloud CLI or handling OAuth flows
    return false;
  }
}