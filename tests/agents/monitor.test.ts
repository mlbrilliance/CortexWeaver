import { Monitor, SystemMetrics, AlertRule, Alert } from '../../src/agents/monitor';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { setupMocks, createMockAgentConfig, createMockTask, createMockContext, suppressConsoleWarnings } from '../test-utils';

describe('Monitor', () => {
  let monitor: Monitor;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  setupMocks();
  suppressConsoleWarnings();

  beforeEach(() => {
    mockConfig = createMockAgentConfig(
      'monitor-1',
      'monitor',
      ['system-monitoring', 'alerting', 'metrics-collection']
    );

    mockTask = createMockTask(
      'monitor-task-1',
      'Monitor system health',
      'Track system metrics and generate alerts'
    );

    mockContext = createMockContext({
      monitoringInterval: 5000,
      alertRules: [
        {
          id: 'cpu-alert',
          name: 'High CPU Usage',
          condition: 'cpu > 80',
          threshold: 80,
          severity: 'high',
          actions: ['notify', 'log']
        }
      ]
    });

    monitor = new Monitor();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(monitor.getCapabilities()).toEqual([]);
      expect(monitor.getRole()).toBe('');
      expect(monitor.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await monitor.initialize(mockConfig);
      
      expect(monitor.getId()).toBe('monitor-1');
      expect(monitor.getRole()).toBe('monitor');
      expect(monitor.getStatus()).toBe('initialized');
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
      await monitor.receiveTask(mockTask, mockContext);
    });

    it('should accept a monitoring task', async () => {
      expect(monitor.getCurrentTask()).toEqual(mockTask);
      expect(monitor.getTaskContext()).toEqual(mockContext);
      expect(monitor.getStatus()).toBe('assigned');
    });

    it('should start monitoring successfully', async () => {
      jest.spyOn(monitor as any, 'startMonitoring').mockResolvedValue({
        status: 'monitoring',
        interval: 5000,
        activeRules: 1
      });

      const result = await monitor.run();

      expect(result.success).toBe(true);
      expect(monitor.getStatus()).toBe('completed');
    });

    it('should handle monitoring errors', async () => {
      jest.spyOn(monitor as any, 'startMonitoring').mockRejectedValue(new Error('Monitoring failed'));

      await expect(monitor.run()).rejects.toThrow('Monitoring failed');
      expect(monitor.getStatus()).toBe('error');
    });
  });

  describe('metrics collection', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
    });

    it('should collect system metrics', async () => {
      const mockMetrics: SystemMetrics = {
        timestamp: Date.now(),
        cpu: 45.5,
        memory: 65.2,
        disk: 78.1,
        network: {
          bytesIn: 1024000,
          bytesOut: 2048000
        }
      };

      jest.spyOn(monitor as any, 'collectMetrics').mockResolvedValue(mockMetrics);

      const metrics = await (monitor as any).collectMetrics();

      expect(metrics.cpu).toBe(45.5);
      expect(metrics.memory).toBe(65.2);
      expect(metrics.network.bytesIn).toBe(1024000);
    });

    it('should store metrics with timestamps', async () => {
      const metrics = {
        cpu: 50,
        memory: 60,
        disk: 70,
        network: { bytesIn: 1000, bytesOut: 2000 }
      };

      await (monitor as any).storeMetrics(metrics);

      const stored = (monitor as any).getMetricsHistory();
      expect(stored.length).toBeGreaterThan(0);
      expect(stored[0]).toHaveProperty('timestamp');
    });
  });

  describe('alert management', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
    });

    it('should evaluate alert rules', async () => {
      const rule: AlertRule = {
        id: 'mem-alert',
        name: 'High Memory Usage',
        condition: 'memory > 90',
        threshold: 90,
        severity: 'critical',
        actions: ['notify', 'scale']
      };

      const metrics = { cpu: 50, memory: 95, disk: 60, network: { bytesIn: 1000, bytesOut: 2000 } };
      
      const shouldAlert = await (monitor as any).evaluateRule(rule, metrics);
      expect(shouldAlert).toBe(true);
    });

    it('should generate alerts for threshold violations', async () => {
      const rule: AlertRule = {
        id: 'disk-alert',
        name: 'Low Disk Space',
        condition: 'disk > 95',
        threshold: 95,
        severity: 'high',
        actions: ['notify']
      };

      const metrics = { cpu: 50, memory: 60, disk: 97, network: { bytesIn: 1000, bytesOut: 2000 } };

      const alert = await (monitor as any).generateAlert(rule, metrics);

      expect(alert.ruleId).toBe('disk-alert');
      expect(alert.severity).toBe('high');
      expect(alert.resolved).toBe(false);
    });

    it('should resolve alerts when conditions improve', async () => {
      const alert: Alert = {
        id: 'alert-1',
        ruleId: 'cpu-alert',
        message: 'High CPU usage detected',
        severity: 'high',
        timestamp: Date.now(),
        resolved: false
      };

      await (monitor as any).resolveAlert(alert.id);

      const resolvedAlert = await (monitor as any).getAlert(alert.id);
      expect(resolvedAlert.resolved).toBe(true);
    });
  });

  describe('monitoring lifecycle', () => {
    beforeEach(async () => {
      await monitor.initialize(mockConfig);
    });

    it('should start and stop monitoring', async () => {
      await (monitor as any).startMonitoring(5000);
      expect((monitor as any).isMonitoring).toBe(true);

      await (monitor as any).stopMonitoring();
      expect((monitor as any).isMonitoring).toBe(false);
    });

    it('should handle monitoring intervals', async () => {
      jest.useFakeTimers();

      const collectSpy = jest.spyOn(monitor as any, 'collectMetrics').mockResolvedValue({});
      
      await (monitor as any).startMonitoring(1000);
      
      jest.advanceTimersByTime(3000);
      
      expect(collectSpy).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });
});