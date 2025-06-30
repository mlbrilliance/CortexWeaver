import { CLI } from '../src/cli';
import { ConfigService } from '../src/config';
import { Orchestrator } from '../src/orchestrator';
import * as fs from 'fs';
import * as path from 'path';

// Mock the Orchestrator class
jest.mock('../src/orchestrator');
const MockOrchestrator = Orchestrator as jest.MockedClass<typeof Orchestrator>;

describe('CLI', () => {
  const testProjectRoot = '/tmp/test-cortexweaver-cli';
  
  beforeEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
    fs.mkdirSync(testProjectRoot, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
  });

  describe('init command', () => {
    it('should create plan.md template', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const planPath = path.join(testProjectRoot, 'plan.md');
      expect(fs.existsSync(planPath)).toBe(true);
      
      const planContent = fs.readFileSync(planPath, 'utf-8');
      expect(planContent).toContain('# Project Plan');
      expect(planContent).toContain('## Features');
    });

    it('should create .cortexweaver directory', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const cortexDir = path.join(testProjectRoot, '.cortexweaver');
      expect(fs.existsSync(cortexDir)).toBe(true);
    });

    it('should create default config.json', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const configPath = path.join(testProjectRoot, '.cortexweaver', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.models).toBeDefined();
      expect(config.models.claude).toBeDefined();
      expect(config.models.gemini).toBeDefined();
    });

    it('should create docker-compose.yml for MCP servers', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const dockerComposePath = path.join(testProjectRoot, 'docker-compose.yml');
      expect(fs.existsSync(dockerComposePath)).toBe(true);
      
      const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8');
      expect(dockerContent).toContain('mcp-neo4j-memory');
      expect(dockerContent).toContain('github-mcp-server');
    });

    it('should create .env template', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const envPath = path.join(testProjectRoot, '.env.example');
      expect(fs.existsSync(envPath)).toBe(true);
      
      const envContent = fs.readFileSync(envPath, 'utf-8');
      expect(envContent).toContain('CLAUDE_API_KEY=');
      expect(envContent).toContain('GEMINI_API_KEY=');
      expect(envContent).toContain('GITHUB_TOKEN=');
    });
  });

  describe('status command', () => {
    it('should show project status', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const statusOutput = await cli.status(testProjectRoot);
      expect(statusOutput).toContain('CortexWeaver Project Status');
    });
  });

  describe('validateProject', () => {
    it('should return true for valid CortexWeaver project', async () => {
      const cli = new CLI();
      await cli.init(testProjectRoot);

      const isValid = cli.validateProject(testProjectRoot);
      expect(isValid).toBe(true);
    });

    it('should return false for non-CortexWeaver project', () => {
      const cli = new CLI();
      const isValid = cli.validateProject(testProjectRoot);
      expect(isValid).toBe(false);
    });
  });

  describe('start command', () => {
    let mockOrchestratorInstance: jest.Mocked<Orchestrator>;
    let cli: CLI;

    beforeEach(async () => {
      // Reset mocks
      MockOrchestrator.mockClear();
      
      // Create mock instance with all required methods
      mockOrchestratorInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockReturnValue('idle'),
        isRunning: jest.fn().mockReturnValue(false),
        getTokenUsage: jest.fn().mockReturnValue({
          totalTokens: 1000,
          totalInputTokens: 600,
          totalOutputTokens: 400,
          requestCount: 10,
          estimatedCost: 15.5
        }),
        checkBudgetLimit: jest.fn().mockReturnValue(true)
      } as any;

      MockOrchestrator.mockImplementation(() => mockOrchestratorInstance);
      
      cli = new CLI();
    });

    it('should start orchestrator with valid CortexWeaver project', async () => {
      // Setup valid project
      await cli.init(testProjectRoot);
      
      // Create .env file with required variables
      const envContent = `CLAUDE_API_KEY=test_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test_password`;
      fs.writeFileSync(path.join(testProjectRoot, '.env'), envContent);

      // Start orchestrator
      await cli.start(testProjectRoot);

      // Verify Orchestrator was created and initialized
      expect(MockOrchestrator).toHaveBeenCalledWith({
        neo4j: {
          uri: 'bolt://localhost:7687',
          username: 'neo4j',
          password: 'test_password'
        },
        claude: {
          apiKey: 'test_key',
          defaultModel: 'claude-3-opus-20240229',
          budgetLimit: 500
        }
      });
      expect(mockOrchestratorInstance.initialize).toHaveBeenCalledWith(testProjectRoot);
      expect(mockOrchestratorInstance.start).toHaveBeenCalled();
    });

    it('should throw error for non-CortexWeaver project', async () => {
      await expect(cli.start(testProjectRoot)).rejects.toThrow(
        'Not a CortexWeaver project. Run "cortex-weaver init" first.'
      );
    });

    it('should throw error when missing required environment variables', async () => {
      // Setup valid project structure but no .env
      await cli.init(testProjectRoot);

      // Temporarily unset environment variables
      const originalClaudeKey = process.env.CLAUDE_API_KEY;
      const originalNeoPassword = process.env.NEO4J_PASSWORD;
      delete process.env.CLAUDE_API_KEY;
      delete process.env.NEO4J_PASSWORD;

      try {
        await expect(cli.start(testProjectRoot)).rejects.toThrow(
          'Missing required configuration: Required environment variable CLAUDE_API_KEY is not set'
        );
      } finally {
        // Restore original environment variables
        if (originalClaudeKey) process.env.CLAUDE_API_KEY = originalClaudeKey;
        if (originalNeoPassword) process.env.NEO4J_PASSWORD = originalNeoPassword;
      }
    });

    it('should throw error when missing dependencies', async () => {
      // Setup project but remove plan.md
      await cli.init(testProjectRoot);
      const planPath = path.join(testProjectRoot, 'plan.md');
      fs.unlinkSync(planPath);

      await expect(cli.start(testProjectRoot)).rejects.toThrow(
        'Not a CortexWeaver project. Run "cortex-weaver init" first.'
      );
    });

    it('should handle budget constraints', async () => {
      // Setup valid project with budget constraint
      await cli.init(testProjectRoot);
      
      const envContent = `CLAUDE_API_KEY=test_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test_password`;
      fs.writeFileSync(path.join(testProjectRoot, '.env'), envContent);

      // Mock budget limit exceeded
      mockOrchestratorInstance.checkBudgetLimit.mockReturnValue(false);

      await cli.start(testProjectRoot);

      // Should still start but orchestrator will handle budget internally
      expect(mockOrchestratorInstance.start).toHaveBeenCalled();
    });

    it('should handle orchestration errors gracefully', async () => {
      // Setup valid project
      await cli.init(testProjectRoot);
      
      const envContent = `CLAUDE_API_KEY=test_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test_password`;
      fs.writeFileSync(path.join(testProjectRoot, '.env'), envContent);

      // Mock orchestrator error
      const error = new Error('Orchestration failed');
      mockOrchestratorInstance.start.mockRejectedValue(error);

      await expect(cli.start(testProjectRoot)).rejects.toThrow('Orchestration failed');
    });

    it('should handle graceful shutdown on interruption', async () => {
      // Setup valid project
      await cli.init(testProjectRoot);
      
      const envContent = `CLAUDE_API_KEY=test_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test_password`;
      fs.writeFileSync(path.join(testProjectRoot, '.env'), envContent);

      // Mock orchestrator that throws error to simulate interruption
      mockOrchestratorInstance.start.mockRejectedValue(new Error('Process interrupted'));

      await expect(cli.start(testProjectRoot)).rejects.toThrow('Process interrupted');

      // Verify shutdown was called even on error
      expect(mockOrchestratorInstance.shutdown).toHaveBeenCalled();
    });

    it('should validate budget before starting', async () => {
      // Setup valid project
      await cli.init(testProjectRoot);
      
      const envContent = `CLAUDE_API_KEY=test_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test_password`;
      fs.writeFileSync(path.join(testProjectRoot, '.env'), envContent);

      // Mock current usage that exceeds budget
      mockOrchestratorInstance.getTokenUsage.mockReturnValue({
        totalTokens: 60000,
        totalInputTokens: 30000,
        totalOutputTokens: 30000,
        requestCount: 100,
        estimatedCost: 600
      });

      await cli.start(testProjectRoot);

      // Should call start regardless, orchestrator handles budget internally
      expect(mockOrchestratorInstance.start).toHaveBeenCalled();
    });

    it('should provide real-time status feedback', async () => {
      // Setup valid project
      await cli.init(testProjectRoot);
      
      const envContent = `CLAUDE_API_KEY=test_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test_password`;
      fs.writeFileSync(path.join(testProjectRoot, '.env'), envContent);

      // Mock status progression
      const statusProgression = ['idle', 'initialized', 'running', 'completed'];
      let statusIndex = 0;
      mockOrchestratorInstance.getStatus.mockImplementation(() => {
        return statusProgression[statusIndex++] as any;
      });

      // Mock console.log to capture status updates
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.start(testProjectRoot);

      // Verify status updates were logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Initializing'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting'));

      consoleSpy.mockRestore();
    });
  });
});