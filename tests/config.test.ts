import { ConfigService } from '../src/config';
import * as fs from 'fs';
import * as path from 'path';

describe('ConfigService', () => {
  const testProjectRoot = '/tmp/test-cortexweaver';
  const testEnvFile = path.join(testProjectRoot, '.env');
  const testConfigFile = path.join(testProjectRoot, '.cortexweaver', 'config.json');

  beforeEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
    fs.mkdirSync(testProjectRoot, { recursive: true });
    fs.mkdirSync(path.join(testProjectRoot, '.cortexweaver'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
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
});