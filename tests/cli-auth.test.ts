import { CLI } from '../src/cli';
import { AuthManager } from '../src/auth-manager';

// Mock AuthManager
jest.mock('../src/auth-manager');
jest.mock('fs');
jest.mock('../src/config');

const MockAuthManager = AuthManager as jest.MockedClass<typeof AuthManager>;

describe('CLI Authentication Integration', () => {
  let cli: CLI;
  let mockAuthManager: jest.Mocked<AuthManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAuthManager = {
      getAuthStatus: jest.fn(),
      discoverAuthentication: jest.fn(),
      setClaudeAuth: jest.fn(),
      setGeminiAuth: jest.fn(),
      validateClaudeAuth: jest.fn(),
      validateGeminiAuth: jest.fn(),
      getClaudeCredentials: jest.fn(),
      getGeminiCredentials: jest.fn(),
      isFullyAuthenticated: jest.fn(),
      getAuthReport: jest.fn(),
      getProjectRoot: jest.fn(),
      isAuthExpired: jest.fn(),
      clearClaudeAuth: jest.fn(),
      clearGeminiAuth: jest.fn(),
      refreshClaudeAuth: jest.fn(),
      refreshGeminiAuth: jest.fn(),
      getClaudeAuthMethod: jest.fn(),
      getGeminiAuthMethod: jest.fn()
    } as any;

    MockAuthManager.mockImplementation(() => mockAuthManager);
    
    cli = new CLI();
  });

  describe('authStatus', () => {
    it('should display current authentication status', async () => {
      const mockAuthState = {
        current: {
          method: 'claude-code' as const,
          source: 'Claude Code CLI',
          status: 'active' as const,
          lastValidated: new Date('2023-01-01'),
          metadata: { userId: 'test-user', plan: 'Max' }
        },
        available: [
          {
            method: 'claude-code' as const,
            source: 'Claude Code CLI',
            status: 'active' as const,
            metadata: { userId: 'test-user', plan: 'Max' }
          }
        ],
        lastCheck: new Date('2023-01-01')
      };

      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthState);

      const result = await cli.authStatus();

      expect(result).toContain('CortexWeaver Authentication Status');
      expect(result).toContain('Current Authentication:');
      expect(result).toContain('claude-code');
      expect(result).toContain('Claude Code CLI');
      expect(result).toContain('Available Authentication Methods:');
      expect(mockAuthManager.getAuthenticationStatus).toHaveBeenCalled();
    });

    it('should display no authentication message when none configured', async () => {
      const mockAuthState = {
        current: null,
        available: [],
        lastCheck: new Date('2023-01-01')
      };

      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthState);

      const result = await cli.authStatus();

      expect(result).toContain('No Active Authentication');
      expect(result).toContain('cortex-weaver auth configure');
    });

    it('should handle authentication status errors', async () => {
      mockAuthManager.getAuthenticationStatus.mockRejectedValue(new Error('Auth check failed'));

      await expect(cli.authStatus()).rejects.toThrow('Failed to get authentication status: Auth check failed');
    });
  });

  describe('authConfigure', () => {
    it('should show available methods when no method specified', async () => {
      mockAuthManager.discoverAuthentication.mockResolvedValue([]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.authConfigure();

      expect(consoleSpy).toHaveBeenCalledWith('\n📋 Available authentication methods:');
      expect(consoleSpy).toHaveBeenCalledWith('1. claude-code - Use Claude Code CLI (recommended for Max Plan users)');
      expect(consoleSpy).toHaveBeenCalledWith('2. gemini-cli - Use Google Cloud CLI with Gemini API');
      expect(consoleSpy).toHaveBeenCalledWith('3. direct-api - Use direct API keys in environment variables');

      consoleSpy.mockRestore();
    });

    it('should configure specific authentication method', async () => {
      const mockAuth = {
        method: 'claude-code' as const,
        source: 'Claude Code CLI',
        status: 'active' as const
      };

      mockAuthManager.configureAuthentication.mockResolvedValue();
      mockAuthManager.discoverAuthentication.mockResolvedValue([mockAuth]);
      mockAuthManager.switchAuthentication.mockResolvedValue();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.authConfigure('claude-code');

      expect(mockAuthManager.configureAuthentication).toHaveBeenCalledWith('claude-code');
      expect(mockAuthManager.discoverAuthentication).toHaveBeenCalled();
      expect(mockAuthManager.switchAuthentication).toHaveBeenCalledWith('claude-code');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Successfully configured and activated claude-code authentication');

      consoleSpy.mockRestore();
    });

    it('should handle invalid authentication method', async () => {
      await expect(cli.authConfigure('invalid-method')).rejects.toThrow(
        'Invalid authentication method. Use one of: claude-code, gemini-cli, direct-api'
      );
    });

    it('should handle configuration errors', async () => {
      mockAuthManager.configureAuthentication.mockRejectedValue(new Error('Config failed'));

      await expect(cli.authConfigure('claude-code')).rejects.toThrow(
        'Failed to configure authentication: Config failed'
      );
    });
  });

  describe('authSwitch', () => {
    it('should switch authentication method successfully', async () => {
      mockAuthManager.switchAuthentication.mockResolvedValue();
      
      const mockAuthState = {
        current: {
          method: 'claude-code' as const,
          source: 'Claude Code CLI',
          status: 'active' as const
        },
        available: [],
        lastCheck: new Date()
      };
      
      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthState);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.authSwitch('claude-code');

      expect(mockAuthManager.switchAuthentication).toHaveBeenCalledWith('claude-code', undefined);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Successfully switched to claude-code authentication');

      consoleSpy.mockRestore();
    });

    it('should handle authentication switch errors', async () => {
      mockAuthManager.switchAuthentication.mockRejectedValue(new Error('Switch failed'));

      await expect(cli.authSwitch('claude-code')).rejects.toThrow(
        'Failed to switch authentication: Switch failed'
      );
    });
  });

  describe('init with authentication discovery', () => {
    it('should discover and auto-configure authentication during init', async () => {
      const mockFs = require('fs');
      const mockConfig = require('../src/config');

      // Mock file system operations
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation();
      mockFs.writeFileSync.mockImplementation();

      // Mock config service
      const mockConfigService = {
        getCortexWeaverDir: jest.fn().mockReturnValue('/mock/.cortexweaver'),
        saveProjectConfig: jest.fn()
      };
      mockConfig.ConfigService.mockImplementation(() => mockConfigService);

      // Mock CLI methods
      const mockCLITemplates = require('../src/cli-templates');
      const mockCLIContracts = require('../src/cli-contracts');
      
      mockCLIContracts.CLIContracts = {
        createContractsStructure: jest.fn().mockResolvedValue(undefined)
      };
      
      mockCLITemplates.CLITemplates = {
        createPlanTemplate: jest.fn().mockResolvedValue(undefined),
        createDockerCompose: jest.fn().mockResolvedValue(undefined),
        createEnvTemplate: jest.fn().mockResolvedValue(undefined),
        createPromptsDirectory: jest.fn().mockResolvedValue(undefined)
      };

      // Mock authentication discovery
      const mockAuth = {
        method: 'claude-code' as const,
        source: 'Claude Code CLI',
        status: 'active' as const
      };

      mockAuthManager.discoverAuthentication.mockResolvedValue();
      mockAuthManager.getAuthStatus.mockResolvedValue({
        claudeAuth: {
          method: 'claude_code_session' as any,
          isAuthenticated: true
        },
        geminiAuth: {
          method: 'none' as any,
          isAuthenticated: false
        },
        recommendations: [],
        lastChecked: new Date()
      });
      mockAuthManager.setClaudeAuth.mockResolvedValue();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.init('/mock/project');

      expect(mockAuthManager.discoverAuthentication).toHaveBeenCalled();
      expect(mockAuthManager.setClaudeAuth).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('🔧 Auto-configured claude-code authentication');

      consoleSpy.mockRestore();
    });
  });

  describe('start with authentication validation', () => {
    it('should validate authentication before starting orchestrator', async () => {
      const mockFs = require('fs');
      const mockConfig = require('../src/config');

      // Mock validateProject to return true
      jest.spyOn(cli as any, 'validateProject').mockReturnValue(true);

      // Mock authentication state
      const mockAuthState = {
        current: {
          method: 'claude-code' as const,
          source: 'Claude Code CLI',
          status: 'active' as const
        },
        available: [],
        lastCheck: new Date()
      };

      const mockValidation = {
        isValid: true,
        method: 'claude-code',
        source: 'Claude Code CLI'
      };

      const mockCredentials = {
        metadata: { method: 'claude-code' }
      };

      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthState);
      mockAuthManager.validateClaudeAuth.mockResolvedValue(mockValidation.isValid);
      mockAuthManager.getClaudeCredentials.mockResolvedValue(mockCredentials);

      // Mock config service
      const mockConfigService = {
        loadProjectConfig: jest.fn().mockReturnValue({
          models: { claude: 'claude-3-opus' },
          budget: { maxCost: 100 }
        }),
        loadEnvironmentVariables: jest.fn().mockReturnValue({}),
        getRequiredEnvVar: jest.fn().mockImplementation((name) => {
          if (name === 'NEO4J_PASSWORD') return 'neo4j-pass';
          throw new Error(`Required env var ${name} not set`);
        })
      };
      
      mockConfig.ConfigService.mockImplementation(() => mockConfigService);

      // Mock Orchestrator
      const mockOrchestrator = require('../src/orchestrator');
      const mockOrchestratorInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getTokenUsage: jest.fn().mockReturnValue({ estimatedCost: 10, totalTokens: 1000 }),
        getStatus: jest.fn().mockReturnValue('ready'),
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      
      mockOrchestrator.Orchestrator.mockImplementation(() => mockOrchestratorInstance);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // We'll test just the authentication validation part by catching the orchestrator error
      try {
        await cli.start('/mock/project');
      } catch (error) {
        // Expected to fail at orchestrator level, but authentication should have been validated
      }

      expect(mockAuthManager.getAuthStatus).toHaveBeenCalled();
      expect(mockAuthManager.validateClaudeAuth).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ Using claude-code authentication (Claude Code CLI)');

      consoleSpy.mockRestore();
    });

    it('should throw error when no authentication is configured', async () => {
      // Mock validateProject to return true
      jest.spyOn(cli as any, 'validateProject').mockReturnValue(true);

      const mockAuthState = {
        current: null,
        available: [],
        lastCheck: new Date()
      };

      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthState);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(cli.start('/mock/project')).rejects.toThrow(
        'Authentication required. Run "cortex-weaver auth configure" first.'
      );

      expect(consoleSpy).toHaveBeenCalledWith('❌ No authentication configured');

      consoleSpy.mockRestore();
    });

    it('should throw error when authentication validation fails', async () => {
      // Mock validateProject to return true
      jest.spyOn(cli as any, 'validateProject').mockReturnValue(true);

      const mockAuthState = {
        current: {
          method: 'claude-code' as const,
          source: 'Claude Code CLI',
          status: 'active' as const
        },
        available: [],
        lastCheck: new Date()
      };

      const mockValidation = {
        isValid: false,
        method: 'claude-code',
        source: 'Claude Code CLI',
        error: 'Authentication expired'
      };

      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthState);
      mockAuthManager.validateClaudeAuth.mockResolvedValue(mockValidation.isValid);

      await expect(cli.start('/mock/project')).rejects.toThrow(
        'Authentication validation failed: Authentication expired'
      );
    });
  });
});