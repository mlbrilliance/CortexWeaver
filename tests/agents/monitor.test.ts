import { MonitorAgent } from '../../src/agents/monitor';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('fs');

describe('MonitorAgent', () => {
  let monitor: MonitorAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'monitor-1',
    role: 'monitor',
    capabilities: ['sre-monitoring', 'alerting', 'observability', 'infrastructure'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 6000,
      temperature: 0.2
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  const mockTask = {
    id: 'task-1',
    title: 'Setup Monitoring and Alerting',
    description: 'Implement comprehensive monitoring stack with Prometheus, Grafana, and alerting rules',
    projectId: 'project-1',
    status: 'assigned',
    priority: 'high',
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockContext = {
    projectInfo: {
      name: 'Test Project',
      language: 'typescript',
      framework: 'express',
      infrastructure: 'kubernetes'
    },
    requirements: {
      monitoring: ['application-metrics', 'infrastructure-metrics', 'logs'],
      alerting: ['high-latency', 'error-rate', 'resource-usage'],
      sla: {
        availability: 99.9,
        responseTime: 200
      }
    },
    environment: 'production'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Monitoring configuration generated successfully',
        tokenUsage: { inputTokens: 400, outputTokens: 200, totalTokens: 600 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn(),
      resetTokenUsage: jest.fn(),
      setDefaultModel: jest.fn(),
      getAvailableModels: jest.fn()
    } as any;

    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);

    // Mock workspace
    mockWorkspace = {
      executeCommand: jest.fn().mockResolvedValue({
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace/task-1'),
      getProjectRoot: jest.fn().mockReturnValue('/test/workspace'),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      commitChanges: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn()
    } as any;

    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);

    // Mock cognitive canvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-1',
        type: 'monitoring',
        strength: 0.9,
        context: 'monitoring_setup_completed',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getMonitoringConfigsByProject: jest.fn().mockResolvedValue([]),
      storeMonitoringConfig: jest.fn().mockResolvedValue(true),
      findSimilarTasks: jest.fn().mockResolvedValue([])
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {} as any;
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    monitor = new MonitorAgent();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await monitor.initialize(mockConfig);
      expect(monitor.getStatus()).toBe('initialized');
      expect(monitor.getId()).toBe('monitor-1');
      expect(monitor.getRole()).toBe('monitor');
    });

    it('should validate required capabilities', async () => {
      const invalidConfig = {
        ...mockConfig,
        capabilities: ['wrong-capability']
      };
      
      await expect(monitor.initialize(invalidConfig)).rejects.toThrow('Monitor agent requires sre-monitoring capability');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should execute monitoring setup task successfully', async () => {
      const result = await monitor.executeTask();

      expect(result).toEqual({
        prometheusConfig: expect.any(String),
        grafanaDashboards: expect.any(Array),
        alertingRules: expect.any(Array),
        logConfiguration: expect.any(String),
        infrastructureMonitoring: expect.any(String),
        healthChecks: expect.any(Array),
        runbooks: expect.any(Array),
        metadata: expect.objectContaining({
          totalAlerts: expect.any(Number),
          totalDashboards: expect.any(Number),
          totalHealthChecks: expect.any(Number),
          generatedAt: expect.any(String)
        })
      });
    });

    it('should throw error if no task is assigned', async () => {
      const emptyMonitor = new MonitorAgent();
      await emptyMonitor.initialize(mockConfig);
      
      await expect(emptyMonitor.executeTask()).rejects.toThrow('No task or context available');
    });

    it('should generate comprehensive monitoring configuration', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Monitoring Configuration

## Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

## Grafana Dashboard: Application Metrics
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph"
      }
    ]
  }
}

## Alert Rules
- alert: HighLatency
  expr: http_request_duration_seconds{quantile="0.95"} > 0.2
  for: 5m
  annotations:
    summary: High latency detected

## Health Checks
- name: api-health
  endpoint: /health
  interval: 30s

## Runbook: High Latency
1. Check application logs
2. Verify database connections`,
        tokenUsage: { inputTokens: 400, outputTokens: 300, totalTokens: 700 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await monitor.executeTask();

      expect(result.prometheusConfig).toContain('scrape_interval');
      expect(result.grafanaDashboards).toHaveLength(1);
      expect(result.alertingRules).toHaveLength(1);
      expect(result.healthChecks).toHaveLength(1);
      expect(result.runbooks).toHaveLength(1);
    });

    it('should create monitoring configuration files', async () => {
      const writeFileSpy = jest.spyOn(monitor as any, 'writeFile').mockResolvedValue(undefined);
      
      await monitor.executeTask();

      expect(writeFileSpy).toHaveBeenCalledWith(
        'monitoring/prometheus.yml',
        expect.stringContaining('global:')
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        'monitoring/grafana/dashboards/application-metrics.json',
        expect.any(String)
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        'monitoring/alerts/alert-rules.yml',
        expect.any(String)
      );
    });

    it('should report progress during execution', async () => {
      const reportProgressSpy = jest.spyOn(monitor as any, 'reportProgress');
      
      await monitor.executeTask();

      expect(reportProgressSpy).toHaveBeenCalledWith('started', 'Beginning monitoring and alerting setup');
      expect(reportProgressSpy).toHaveBeenCalledWith('completed', 'Monitoring setup completed');
    });

    it('should validate monitoring requirements', async () => {
      const contextWithoutRequirements = { ...mockContext };
      delete contextWithoutRequirements.requirements;
      
      await monitor.receiveTask(mockTask, contextWithoutRequirements);
      
      await expect(monitor.executeTask()).rejects.toThrow('Monitoring requirements not specified');
    });
  });

  describe('getPromptTemplate', () => {
    it('should return comprehensive prompt template', () => {
      const template = monitor.getPromptTemplate();
      
      expect(template).toContain('SRE monitoring expert');
      expect(template).toContain('{{taskDescription}}');
      expect(template).toContain('{{monitoringRequirements}}');
      expect(template).toContain('Prometheus');
      expect(template).toContain('Grafana');
      expect(template).toContain('alerting rules');
    });
  });

  describe('configuration parsing', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should parse Prometheus configuration correctly', () => {
      const content = `
## Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'app'
    static_configs:
      - targets: ['localhost:3000']
`;
      const config = (monitor as any).parsePrometheusConfig(content);
      expect(config).toContain('scrape_interval: 15s');
      expect(config).toContain('job_name: \'app\'');
    });

    it('should parse Grafana dashboards correctly', () => {
      const content = `
## Grafana Dashboard: Application Metrics
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph"
      }
    ]
  }
}

## Grafana Dashboard: System Metrics
{
  "dashboard": {
    "title": "System Metrics",
    "panels": []
  }
}
`;
      const dashboards = (monitor as any).parseGrafanaDashboards(content);
      expect(dashboards).toHaveLength(2);
      expect(dashboards[0].name).toBe('Application Metrics');
      expect(dashboards[0].config).toContain('Response Time');
    });

    it('should parse alerting rules correctly', () => {
      const content = `
## Alert Rules
- alert: HighLatency
  expr: http_request_duration_seconds{quantile="0.95"} > 0.2
  for: 5m
  annotations:
    summary: High latency detected

- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 2m
`;
      const rules = (monitor as any).parseAlertingRules(content);
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('HighLatency');
      expect(rules[0].condition).toContain('http_request_duration_seconds');
      expect(rules[0].severity).toBe('warning');
    });

    it('should parse health checks correctly', () => {
      const content = `
## Health Checks
- name: api-health
  endpoint: /health
  interval: 30s
  timeout: 5s

- name: database-health
  endpoint: /db/health
  interval: 60s
`;
      const checks = (monitor as any).parseHealthChecks(content);
      expect(checks).toHaveLength(2);
      expect(checks[0].name).toBe('api-health');
      expect(checks[0].endpoint).toBe('/health');
      expect(checks[0].interval).toBe('30s');
    });

    it('should parse runbooks correctly', () => {
      const content = `
## Runbook: High Latency
1. Check application logs for errors
2. Verify database connection status
3. Check resource utilization

## Runbook: High Error Rate
1. Review recent deployments
2. Check application health endpoints
`;
      const runbooks = (monitor as any).parseRunbooks(content);
      expect(runbooks).toHaveLength(2);
      expect(runbooks[0].name).toBe('High Latency');
      expect(runbooks[0].steps).toHaveLength(3);
      expect(runbooks[0].steps[0]).toContain('application logs');
    });
  });

  describe('infrastructure detection', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should detect Kubernetes infrastructure', () => {
      const infrastructure = (monitor as any).detectInfrastructure();
      expect(infrastructure.type).toBe('kubernetes');
      expect(infrastructure.features).toContain('pod-monitoring');
      expect(infrastructure.features).toContain('service-discovery');
    });

    it('should generate Kubernetes-specific monitoring config', () => {
      const kubernetesConfig = (monitor as any).generateKubernetesMonitoring();
      expect(kubernetesConfig).toContain('kubernetes_sd_configs');
      expect(kubernetesConfig).toContain('relabel_configs');
    });

    it('should handle Docker infrastructure', () => {
      const dockerContext = {
        ...mockContext,
        projectInfo: { ...mockContext.projectInfo, infrastructure: 'docker' }
      };
      
      const infrastructure = (monitor as any).detectInfrastructure(dockerContext);
      expect(infrastructure.type).toBe('docker');
      expect(infrastructure.features).toContain('container-monitoring');
    });
  });

  describe('alert severity classification', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should classify critical alerts correctly', () => {
      const alertRule = {
        name: 'ServiceDown',
        condition: 'up == 0',
        for: '1m'
      };
      
      const severity = (monitor as any).classifyAlertSeverity(alertRule);
      expect(severity).toBe('critical');
    });

    it('should classify warning alerts correctly', () => {
      const alertRule = {
        name: 'HighLatency',
        condition: 'http_request_duration_seconds > 0.2',
        for: '5m'
      };
      
      const severity = (monitor as any).classifyAlertSeverity(alertRule);
      expect(severity).toBe('warning');
    });

    it('should classify info alerts correctly', () => {
      const alertRule = {
        name: 'DeploymentNotification',
        condition: 'deployment_complete == 1',
        for: '0m'
      };
      
      const severity = (monitor as any).classifyAlertSeverity(alertRule);
      expect(severity).toBe('info');
    });
  });

  describe('configuration storage', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should store monitoring config in Cognitive Canvas', async () => {
      await monitor.executeTask();

      expect(mockCognitiveCanvas.storeMonitoringConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          projectId: 'project-1',
          type: 'monitoring_setup',
          configuration: expect.any(Object)
        })
      );
    });

    it('should create appropriate pheromone', async () => {
      await monitor.executeTask();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'monitoring',
          strength: 0.9,
          context: 'monitoring_setup_completed',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            infrastructureType: 'kubernetes'
          })
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should handle Claude API errors', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('Claude API error'));
      
      await expect(monitor.executeTask()).rejects.toThrow('Failed to generate monitoring configuration');
    });

    it('should handle file writing errors', async () => {
      const writeFileSpy = jest.spyOn(monitor as any, 'writeFile').mockRejectedValue(new Error('File write error'));
      
      await expect(monitor.executeTask()).rejects.toThrow('Failed to create monitoring configuration files');
    });

    it('should validate task specification', async () => {
      const invalidTask = { ...mockTask, title: '', description: '' };
      await monitor.receiveTask(invalidTask, mockContext);
      
      await expect(monitor.executeTask()).rejects.toThrow('Invalid task specification');
    });

    it('should handle invalid monitoring requirements', async () => {
      const invalidContext = {
        ...mockContext,
        requirements: { invalid: 'data' }
      };
      
      await monitor.receiveTask(mockTask, invalidContext);
      
      await expect(monitor.executeTask()).rejects.toThrow('Invalid monitoring requirements format');
    });
  });

  describe('SLA compliance', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should generate SLA-based alerts', () => {
      const sla = mockContext.requirements.sla;
      const slaAlerts = (monitor as any).generateSLAAlerts(sla);
      
      expect(slaAlerts).toContainEqual(
        expect.objectContaining({
          name: expect.stringContaining('availability'),
          threshold: 99.9
        })
      );
      
      expect(slaAlerts).toContainEqual(
        expect.objectContaining({
          name: expect.stringContaining('response_time'),
          threshold: 200
        })
      );
    });

    it('should calculate error budget alerts', () => {
      const availability = 99.9; // 99.9% availability = 0.1% error budget
      const errorBudgetAlert = (monitor as any).calculateErrorBudgetAlert(availability);
      
      expect(errorBudgetAlert.name).toContain('error_budget');
      expect(errorBudgetAlert.threshold).toBe(0.1);
    });
  });
});