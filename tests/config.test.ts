import { ConfigService } from '../src/config';
import * as fs from 'fs';
import * as path from 'path';
import { setupFileSystemMocks } from './test-utils';

describe('ConfigService', () => {
  setupFileSystemMocks();
  
  const testProjectRoot = '/tmp/test-cortexweaver';
  const testEnvFile = path.join(testProjectRoot, '.env');
  const testConfigFile = path.join(testProjectRoot, '.cortexweaver', 'config.json');

  // Mock file storage for this test
  const mockFileSystem = new Map<string, string>();

  beforeEach(() => {
    // Clear mock file system
    mockFileSystem.clear();
    
    // Set up mocks to use our in-memory file system
    (fs.existsSync as jest.Mock).mockImplementation((filepath: string) => {
      return mockFileSystem.has(filepath);
    });
    
    (fs.readFileSync as jest.Mock).mockImplementation((filepath: string) => {
      return mockFileSystem.get(filepath) || '';
    });
    
    (fs.writeFileSync as jest.Mock).mockImplementation((filepath: string, content: string) => {
      mockFileSystem.set(filepath, content);
    });
    
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    // rmSync might not be available in the mock, so check first
    if (fs.rmSync) {
      (fs.rmSync as jest.Mock).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    // Clear mock file system instead of using rmSync
    mockFileSystem.clear();
    // Clean up environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  describe('loadEnvironmentVariables', () => {
    it('should load environment variables from .env file', () => {
      const envContent = 'CLAUDE_API_KEY=test-claude-key\nGEMINI_API_KEY=test-gemini-key\n';
      fs.writeFileSync(testEnvFile, envContent);

      const config = new ConfigService(testProjectRoot);
      const env = config.loadEnvironmentVariables();

      expect(env.CLAUDE_API_KEY).toBe('test-claude-key');
      expect(env.GEMINI_API_KEY).toBe('test-gemini-key');
    });

    it('should return empty object if .env file does not exist', () => {
      const config = new ConfigService(testProjectRoot);
      const env = config.loadEnvironmentVariables();

      expect(env).toEqual({});
    });
  });

  describe('loadProjectConfig', () => {
    it('should load project configuration from config.json', () => {
      const configContent = {
        models: {
          claude: 'claude-3-sonnet-20240229',
          gemini: 'gemini-pro'
        },
        costs: {
          claudeTokenCost: 0.003,
          geminiTokenCost: 0.0005
        },
        budget: {
          maxTokens: 100000,
          maxCost: 300
        }
      };
      fs.writeFileSync(testConfigFile, JSON.stringify(configContent, null, 2));

      const config = new ConfigService(testProjectRoot);
      const projectConfig = config.loadProjectConfig();

      expect(projectConfig.models.claude).toBe('claude-3-sonnet-20240229');
      expect(projectConfig.costs.claudeTokenCost).toBe(0.003);
      expect(projectConfig.budget.maxTokens).toBe(100000);
    });

    it('should return default configuration if config.json does not exist', () => {
      const config = new ConfigService(testProjectRoot);
      const projectConfig = config.loadProjectConfig();

      expect(projectConfig.models.claude).toBe('claude-3-opus-20240229');
      expect(projectConfig.models.gemini).toBe('gemini-pro');
      expect(projectConfig.budget.maxTokens).toBe(50000);
    });
  });

  describe('getRequiredEnvVar', () => {
    it('should return environment variable value when it exists', () => {
      process.env.TEST_VAR = 'test-value';
      
      const config = new ConfigService(testProjectRoot);
      const value = config.getRequiredEnvVar('TEST_VAR');

      expect(value).toBe('test-value');
      delete process.env.TEST_VAR;
    });

    it('should throw error when required environment variable is missing', () => {
      const config = new ConfigService(testProjectRoot);
      
      expect(() => {
        config.getRequiredEnvVar('MISSING_VAR');
      }).toThrow('Required environment variable MISSING_VAR is not set');
    });
  });

  describe('saveProjectConfig', () => {
    it('should save project configuration to config.json', () => {
      const config = new ConfigService(testProjectRoot);
      const testConfig = {
        models: { claude: 'test-model', gemini: 'test-gemini' },
        costs: { claudeTokenCost: 0.001, geminiTokenCost: 0.0001 },
        budget: { maxTokens: 75000, maxCost: 150 }
      };

      config.saveProjectConfig(testConfig);

      const savedContent = fs.readFileSync(testConfigFile, 'utf-8');
      const savedConfig = JSON.parse(savedContent);
      expect(savedConfig.models.claude).toBe('test-model');
      expect(savedConfig.budget.maxTokens).toBe(75000);
    });
  });

  describe('AuthManager integration', () => {
    it('should get Claude API key from AuthManager when available', async () => {
      // Setup AuthManager with API key
      process.env.ANTHROPIC_API_KEY = 'sk-ant-auth-manager-key';
      
      const config = new ConfigService(testProjectRoot);
      const apiKey = await config.getClaudeApiKey();
      
      expect(apiKey).toBe('sk-ant-auth-manager-key');
    });

    it('should fallback to environment variable when AuthManager fails', async () => {
      // Clean up any existing ANTHROPIC_API_KEY to test fallback
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      
      // Setup environment variable but no AuthManager config
      process.env.CLAUDE_API_KEY = 'sk-claude-fallback-key';
      
      const config = new ConfigService('/nonexistent/path');
      const apiKey = await config.getClaudeApiKey();
      
      expect(apiKey).toBe('sk-claude-fallback-key');
      
      delete process.env.CLAUDE_API_KEY;
    });

    it('should get Gemini API key from AuthManager when available', async () => {
      // Setup AuthManager with API key
      process.env.GOOGLE_API_KEY = 'google-auth-manager-key';
      
      const config = new ConfigService(testProjectRoot);
      const apiKey = await config.getGeminiApiKey();
      
      expect(apiKey).toBe('google-auth-manager-key');
    });

    it('should check authentication status', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.GOOGLE_API_KEY = 'google-test-key';
      
      const config = new ConfigService(testProjectRoot);
      const authStatus = await config.checkAuthenticationStatus();
      
      expect(authStatus).toHaveProperty('claude');
      expect(authStatus).toHaveProperty('gemini');
      expect(authStatus).toHaveProperty('recommendations');
      expect(Array.isArray(authStatus.recommendations)).toBe(true);
    });
  });
});