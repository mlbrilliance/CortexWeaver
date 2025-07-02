import { AuthStrategies } from './auth-strategies';

/**
 * Authentication methods supported by CortexWeaver
 */
export enum AuthMethod {
  NONE = 'none',
  CLAUDE_CODE_SESSION = 'claude_code_session',
  CLAUDE_CODE_CONFIG = 'claude_code_config',
  GEMINI_CLI = 'gemini_cli',
  API_KEY = 'api_key'
}

/**
 * Authentication provider interface
 */
export interface AuthProvider {
  method: AuthMethod;
  details?: {
    api_key?: string;
    session_token?: string;
    expires_at?: string;
    user_id?: string;
    project?: string;
    refresh_token?: string;
    client_id?: string;
    client_secret?: string;
    environment?: string;
  };
  error?: string;
}

/**
 * Authentication status for a specific service
 */
export interface AuthStatus {
  claudeAuth: AuthProvider & {
    isAuthenticated: boolean;
  };
  geminiAuth: AuthProvider & {
    isAuthenticated: boolean;
  };
  recommendations: string[];
  lastChecked: Date;
}

/**
 * AuthManager handles authentication discovery, validation, and management
 * for CortexWeaver, supporting Claude Code CLI, Gemini CLI, and direct API keys
 */
export class AuthManager {
  private projectRoot: string;
  private claudeAuth: AuthProvider | null = null;
  private geminiAuth: AuthProvider | null = null;
  private authStrategies: AuthStrategies;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.authStrategies = new AuthStrategies();
  }

  /**
   * Get the project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Discover and initialize all available authentication methods
   */
  async discoverAuthentication(): Promise<void> {
    this.claudeAuth = await this.authStrategies.discoverClaudeAuthentication();
    this.geminiAuth = await this.authStrategies.discoverGeminiAuthentication();
  }

  /**
   * Get comprehensive authentication status
   */
  async getAuthStatus(): Promise<AuthStatus> {
    // Ensure authentication is discovered
    if (!this.claudeAuth || !this.geminiAuth) {
      await this.discoverAuthentication();
    }

    const claudeAuth = this.claudeAuth || { method: AuthMethod.NONE };
    const geminiAuth = this.geminiAuth || { method: AuthMethod.NONE };

    // Check if authentication is valid and not expired
    const isClaudeAuthenticated = await this.authStrategies.isAuthenticationValid(claudeAuth);
    const isGeminiAuthenticated = await this.authStrategies.isAuthenticationValid(geminiAuth);

    // Generate recommendations
    const recommendations = this.authStrategies.generateRecommendations(claudeAuth, geminiAuth);

    return {
      claudeAuth: {
        ...claudeAuth,
        isAuthenticated: isClaudeAuthenticated
      },
      geminiAuth: {
        ...geminiAuth,
        isAuthenticated: isGeminiAuthenticated
      },
      recommendations,
      lastChecked: new Date()
    };
  }

  /**
   * Check if authentication is expired
   */
  async isAuthExpired(auth: AuthProvider): Promise<boolean> {
    return this.authStrategies.isAuthExpired(auth);
  }

  /**
   * Validate Claude authentication
   */
  async validateClaudeAuth(auth: AuthProvider): Promise<boolean> {
    return this.authStrategies.validateClaudeAuth(auth);
  }

  /**
   * Validate Gemini authentication
   */
  async validateGeminiAuth(auth: AuthProvider): Promise<boolean> {
    return this.authStrategies.validateGeminiAuth(auth);
  }

  /**
   * Manually set Claude authentication
   */
  async setClaudeAuth(auth: AuthProvider): Promise<void> {
    this.claudeAuth = auth;
  }

  /**
   * Manually set Gemini authentication
   */
  async setGeminiAuth(auth: AuthProvider): Promise<void> {
    this.geminiAuth = auth;
  }

  /**
   * Clear Claude authentication
   */
  async clearClaudeAuth(): Promise<void> {
    this.claudeAuth = { method: AuthMethod.NONE };
  }

  /**
   * Clear Gemini authentication
   */
  async clearGeminiAuth(): Promise<void> {
    this.geminiAuth = { method: AuthMethod.NONE };
  }

  /**
   * Attempt to refresh Claude authentication
   */
  async refreshClaudeAuth(): Promise<boolean> {
    return this.authStrategies.refreshClaudeAuth();
  }

  /**
   * Attempt to refresh Gemini authentication
   */
  async refreshGeminiAuth(): Promise<boolean> {
    return this.authStrategies.refreshGeminiAuth();
  }

  /**
   * Get authentication credentials for Claude
   */
  async getClaudeCredentials(): Promise<{ apiKey?: string; sessionToken?: string } | null> {
    if (!this.claudeAuth || this.claudeAuth.method === AuthMethod.NONE) {
      return null;
    }

    const details = this.claudeAuth.details;
    return {
      apiKey: details?.api_key,
      sessionToken: details?.session_token
    };
  }

  /**
   * Get authentication credentials for Gemini
   */
  async getGeminiCredentials(): Promise<{ apiKey?: string; refreshToken?: string } | null> {
    if (!this.geminiAuth || this.geminiAuth.method === AuthMethod.NONE) {
      return null;
    }

    const details = this.geminiAuth.details;
    return {
      apiKey: details?.api_key,
      refreshToken: details?.refresh_token
    };
  }

  /**
   * Get preferred authentication method for Claude
   */
  getClaudeAuthMethod(): AuthMethod {
    return this.claudeAuth?.method || AuthMethod.NONE;
  }

  /**
   * Get preferred authentication method for Gemini
   */
  getGeminiAuthMethod(): AuthMethod {
    return this.geminiAuth?.method || AuthMethod.NONE;
  }

  /**
   * Check if authentication is available for both services
   */
  async isFullyAuthenticated(): Promise<boolean> {
    const status = await this.getAuthStatus();
    return status.claudeAuth.isAuthenticated && status.geminiAuth.isAuthenticated;
  }

  /**
   * Get detailed authentication report
   */
  async getAuthReport(): Promise<string> {
    const status = await this.getAuthStatus();
    
    const report = [
      '🔐 CortexWeaver Authentication Status',
      '=' .repeat(50),
      '',
      '🤖 Claude Authentication:',
      `   Method: ${status.claudeAuth.method}`,
      `   Status: ${status.claudeAuth.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`,
      status.claudeAuth.error ? `   Error: ${status.claudeAuth.error}` : '',
      '',
      '🧠 Gemini Authentication:',
      `   Method: ${status.geminiAuth.method}`,
      `   Status: ${status.geminiAuth.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`,
      status.geminiAuth.error ? `   Error: ${status.geminiAuth.error}` : '',
      '',
      '💡 Recommendations:',
      ...status.recommendations.map(rec => `   • ${rec}`),
      '',
      `📊 Last Checked: ${status.lastChecked.toISOString()}`
    ].filter(line => line !== '').join('\n');

    return report;
  }
}

// Re-export auth strategies for testing and extensibility
export { AuthStrategies };