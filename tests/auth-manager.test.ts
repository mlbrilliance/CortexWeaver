import { AuthManager, AuthProvider, AuthStatus, AuthMethod } from '../src/auth-manager';
import * as fs from 'fs';
import * as path from 'path';

describe('AuthManager', () => {
  const testProjectRoot = '/tmp/test-cortexweaver-auth';
  const testHomeDir = '/tmp/test-home';
  let authManager: AuthManager;
  let originalHome: string | undefined;

  beforeEach(() => {
    // Clean up test directories
    [testProjectRoot, testHomeDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
      fs.mkdirSync(dir, { recursive: true });
    });

    // Mock home directory
    originalHome = process.env.HOME;
    process.env.HOME = testHomeDir;

    authManager = new AuthManager(testProjectRoot);
  });

  afterEach(() => {
    // Restore original home directory
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    // Clean up test directories
    [testProjectRoot, testHomeDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    });

    // Clean up environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  describe('initialization', () => {
    it('should initialize with correct project root', () => {
      expect(authManager.getProjectRoot()).toBe(testProjectRoot);
    });

    it('should initialize with empty authentication state', async () => {
      const status = await authManager.getAuthStatus();
      expect(status.claudeAuth.method).toBe(AuthMethod.NONE);
      expect(status.geminiAuth.method).toBe(AuthMethod.NONE);
      expect(status.claudeAuth.isAuthenticated).toBe(false);
      expect(status.geminiAuth.isAuthenticated).toBe(false);
    });
  });

  describe('Claude Code authentication detection', () => {
    it('should detect Claude Code session token authentication', async () => {
      // Mock Claude Code session file
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      
      const sessionData = {
        session_token: 'mock-session-token-12345',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        user_id: 'test-user-123'
      };
      
      fs.writeFileSync(
        path.join(claudeDir, 'session.json'), 
        JSON.stringify(sessionData, null, 2)
      );

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.CLAUDE_CODE_SESSION);
      expect(status.claudeAuth.isAuthenticated).toBe(true);
      expect(status.claudeAuth.details?.session_token).toBe('mock-session-token-12345');
    });

    it('should detect Claude Code config file authentication', async () => {
      // Mock Claude Code config file
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      
      const configData = {
        api_key: 'sk-claude-test-key-12345',
        default_model: 'claude-3-opus-20240229',
        max_tokens: 4096
      };
      
      fs.writeFileSync(
        path.join(claudeDir, 'config.json'), 
        JSON.stringify(configData, null, 2)
      );

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.CLAUDE_CODE_CONFIG);
      expect(status.claudeAuth.isAuthenticated).toBe(true);
      expect(status.claudeAuth.details?.api_key).toBe('sk-claude-test-key-12345');
    });

    it('should handle expired Claude Code session tokens', async () => {
      // Mock expired Claude Code session file
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      
      const sessionData = {
        session_token: 'expired-session-token',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
        user_id: 'test-user-123'
      };
      
      fs.writeFileSync(
        path.join(claudeDir, 'session.json'), 
        JSON.stringify(sessionData, null, 2)
      );

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.NONE);
      expect(status.claudeAuth.isAuthenticated).toBe(false);
      expect(status.claudeAuth.error).toContain('expired');
    });
  });

  describe('Gemini CLI authentication detection', () => {
    it('should detect Gemini CLI authentication', async () => {
      // Mock Gemini CLI config
      const googleDir = path.join(testHomeDir, '.config', 'gcloud');
      fs.mkdirSync(googleDir, { recursive: true });
      
      const credentialsData = {
        client_id: 'mock-client-id',
        client_secret: 'mock-client-secret',
        refresh_token: 'mock-refresh-token',
        type: 'authorized_user'
      };
      
      fs.writeFileSync(
        path.join(googleDir, 'application_default_credentials.json'), 
        JSON.stringify(credentialsData, null, 2)
      );

      // Mock Gemini CLI config
      const geminiConfigData = {
        api_key: 'gemini-api-key-12345',
        project: 'test-project'
      };
      
      fs.writeFileSync(
        path.join(googleDir, 'gemini-config.json'), 
        JSON.stringify(geminiConfigData, null, 2)
      );

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.geminiAuth.method).toBe(AuthMethod.GEMINI_CLI);
      expect(status.geminiAuth.isAuthenticated).toBe(true);
      expect(status.geminiAuth.details?.api_key).toBe('gemini-api-key-12345');
    });

    it('should handle missing Gemini CLI configuration', async () => {
      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.geminiAuth.method).toBe(AuthMethod.NONE);
      expect(status.geminiAuth.isAuthenticated).toBe(false);
    });
  });

  describe('API key fallback authentication', () => {
    it('should detect ANTHROPIC_API_KEY environment variable', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.claudeAuth.isAuthenticated).toBe(true);
      expect(status.claudeAuth.details?.api_key).toBe('sk-ant-test-key-12345');
    });

    it('should detect CLAUDE_API_KEY environment variable as fallback', async () => {
      process.env.CLAUDE_API_KEY = 'sk-claude-legacy-key-12345';

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.claudeAuth.isAuthenticated).toBe(true);
      expect(status.claudeAuth.details?.api_key).toBe('sk-claude-legacy-key-12345');
    });

    it('should detect GOOGLE_API_KEY environment variable', async () => {
      process.env.GOOGLE_API_KEY = 'google-api-key-12345';

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.geminiAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.geminiAuth.isAuthenticated).toBe(true);
      expect(status.geminiAuth.details?.api_key).toBe('google-api-key-12345');
    });

    it('should detect GEMINI_API_KEY environment variable as fallback', async () => {
      process.env.GEMINI_API_KEY = 'gemini-legacy-key-12345';

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.geminiAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.geminiAuth.isAuthenticated).toBe(true);
      expect(status.geminiAuth.details?.api_key).toBe('gemini-legacy-key-12345');
    });
  });

  describe('authentication priority and precedence', () => {
    it('should prioritize Claude Code session over API keys', async () => {
      // Set API key
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key';

      // Mock Claude Code session (higher priority)
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      
      const sessionData = {
        session_token: 'session-token-12345',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        user_id: 'test-user-123'
      };
      
      fs.writeFileSync(
        path.join(claudeDir, 'session.json'), 
        JSON.stringify(sessionData, null, 2)
      );

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.CLAUDE_CODE_SESSION);
      expect(status.claudeAuth.details?.session_token).toBe('session-token-12345');
    });

    it('should prioritize Claude Code config over API keys when session not available', async () => {
      // Set API key
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key';

      // Mock Claude Code config (medium priority)
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      
      const configData = {
        api_key: 'sk-claude-config-key',
        default_model: 'claude-3-opus-20240229'
      };
      
      fs.writeFileSync(
        path.join(claudeDir, 'config.json'), 
        JSON.stringify(configData, null, 2)
      );

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.CLAUDE_CODE_CONFIG);
      expect(status.claudeAuth.details?.api_key).toBe('sk-claude-config-key');
    });

    it('should prioritize ANTHROPIC_API_KEY over CLAUDE_API_KEY', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-primary-key';
      process.env.CLAUDE_API_KEY = 'sk-claude-secondary-key';

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.claudeAuth.details?.api_key).toBe('sk-ant-primary-key');
    });
  });

  describe('authentication validation', () => {
    it('should validate Claude session token format', async () => {
      const isValid = await authManager.validateClaudeAuth({
        method: AuthMethod.CLAUDE_CODE_SESSION,
        details: { session_token: 'valid-session-token-format' }
      });

      expect(isValid).toBe(true);
    });

    it('should validate Claude API key format', async () => {
      const validKey = await authManager.validateClaudeAuth({
        method: AuthMethod.API_KEY,
        details: { api_key: 'sk-ant-valid-key-format' }
      });

      const invalidKey = await authManager.validateClaudeAuth({
        method: AuthMethod.API_KEY,
        details: { api_key: 'invalid-key-format' }
      });

      expect(validKey).toBe(true);
      expect(invalidKey).toBe(false);
    });

    it('should validate Gemini API key format', async () => {
      const validKey = await authManager.validateGeminiAuth({
        method: AuthMethod.API_KEY,
        details: { api_key: 'valid-gemini-key-format' }
      });

      expect(validKey).toBe(true);
    });
  });

  describe('authentication switching', () => {
    it('should allow switching between authentication methods', async () => {
      // Initial setup with API key
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key';
      await authManager.discoverAuthentication();

      let status = await authManager.getAuthStatus();
      expect(status.claudeAuth.method).toBe(AuthMethod.API_KEY);

      // Switch to manual API key
      await authManager.setClaudeAuth({
        method: AuthMethod.API_KEY,
        details: { api_key: 'sk-ant-manual-key' }
      });

      status = await authManager.getAuthStatus();
      expect(status.claudeAuth.details?.api_key).toBe('sk-ant-manual-key');
    });

    it('should allow clearing authentication', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key';
      await authManager.discoverAuthentication();

      let status = await authManager.getAuthStatus();
      expect(status.claudeAuth.isAuthenticated).toBe(true);

      await authManager.clearClaudeAuth();

      status = await authManager.getAuthStatus();
      expect(status.claudeAuth.method).toBe(AuthMethod.NONE);
      expect(status.claudeAuth.isAuthenticated).toBe(false);
    });
  });

  describe('authentication refresh and expiration', () => {
    it('should detect expired authentication and mark as invalid', async () => {
      // Mock expired session
      const expiredAuth = {
        method: AuthMethod.CLAUDE_CODE_SESSION,
        details: {
          session_token: 'expired-token',
          expires_at: new Date(Date.now() - 1000).toISOString()
        }
      };

      const isExpired = await authManager.isAuthExpired(expiredAuth);
      expect(isExpired).toBe(true);
    });

    it('should handle authentication refresh for session tokens', async () => {
      // This would typically involve calling Claude Code CLI to refresh
      // For now, we'll test the interface
      const refreshResult = await authManager.refreshClaudeAuth();
      
      // Should return false if no refresh mechanism available
      expect(refreshResult).toBe(false);
    });
  });

  describe('comprehensive authentication status', () => {
    it('should provide detailed authentication status', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.GOOGLE_API_KEY = 'google-test-key';

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status).toHaveProperty('claudeAuth');
      expect(status).toHaveProperty('geminiAuth');
      expect(status).toHaveProperty('recommendations');
      expect(status).toHaveProperty('lastChecked');

      expect(status.claudeAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.claudeAuth.isAuthenticated).toBe(true);
      expect(status.geminiAuth.method).toBe(AuthMethod.API_KEY);
      expect(status.geminiAuth.isAuthenticated).toBe(true);

      expect(Array.isArray(status.recommendations)).toBe(true);
      expect(status.lastChecked).toBeInstanceOf(Date);
    });

    it('should provide helpful recommendations when no authentication found', async () => {
      const status = await authManager.getAuthStatus();

      expect(status.recommendations.some(rec => 
        rec.includes('Claude Code CLI') || rec.includes('ANTHROPIC_API_KEY')
      )).toBe(true);
      expect(status.recommendations.some(rec => 
        rec.includes('Gemini CLI') || rec.includes('GOOGLE_API_KEY')
      )).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted configuration files gracefully', async () => {
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      
      // Write invalid JSON
      fs.writeFileSync(path.join(claudeDir, 'session.json'), 'invalid-json-content');

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.NONE);
      expect(status.claudeAuth.error).toContain('configuration');
    });

    it('should handle file system permission errors gracefully', async () => {
      // Mock a permission error by creating a directory where a file should be
      const claudeDir = path.join(testHomeDir, '.config', 'claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.mkdirSync(path.join(claudeDir, 'session.json')); // Directory instead of file

      await authManager.discoverAuthentication();
      const status = await authManager.getAuthStatus();

      expect(status.claudeAuth.method).toBe(AuthMethod.NONE);
    });
  });
});