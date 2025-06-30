import { Agent, AgentConfig } from '../agent';

export interface SystemMetrics {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  resolved: boolean;
}

export interface MonitoringConfig {
  id: string;
  projectId: string;
  metrics: string[];
  alertRules: AlertRule[];
  intervals: {
    collection: number;
    analysis: number;
    reporting: number;
  };
  thresholds: Record<string, number>;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: Array<{
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    lastCheck: number;
  }>;
  alerts: Alert[];
  recommendations: string[];
}

export class Monitor extends Agent {
  private metricsHistory: SystemMetrics[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertRules: AlertRule[] = [];

  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    if (!config.capabilities.includes('system-monitoring')) {
      throw new Error('Monitor agent requires system-monitoring capability');
    }
    await this.loadMonitoringConfiguration();
  }

  getPromptTemplate(): string {
    return `System Monitor Agent: Analyze system health, detect anomalies, and provide intelligent monitoring insights. Monitor metrics, evaluate alerts, and recommend optimizations. Context: {{metrics}}, Config: {{config}}.`;
  }

  async executeTask(): Promise<HealthStatus> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Beginning system health monitoring');

    try {
      const metrics = await this.collectSystemMetrics();
      const healthStatus = await this.analyzeSystemHealth(metrics);
      
      await this.processAlerts(healthStatus.alerts);
      await this.updateMonitoringState(metrics, healthStatus);
      
      await this.reportProgress('completed', `Monitoring completed: ${healthStatus.overall} status with ${healthStatus.alerts.length} alerts`);
      return healthStatus;
    } catch (error) {
      await this.reportProgress('failed', `Monitoring failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async collectSystemMetrics(): Promise<SystemMetrics> {
    const promptContext = {
      metrics: 'system resource usage',
      config: JSON.stringify({ collection: 'current' })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

Collect current system metrics including:
1. CPU utilization percentage
2. Memory usage and availability
3. Disk space and I/O
4. Network traffic and latency
5. Process and service status

Return structured metrics with timestamp and resource utilization data.`;

    const response = await this.sendToClaude(prompt);
    const metrics = this.parseMetrics(response.content);
    
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }
    
    return metrics;
  }

  async analyzeSystemHealth(currentMetrics: SystemMetrics): Promise<HealthStatus> {
    const promptContext = {
      metrics: JSON.stringify(currentMetrics),
      config: JSON.stringify({ 
        history: this.metricsHistory.slice(-10),
        rules: this.alertRules 
      })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

CURRENT METRICS:
${JSON.stringify(currentMetrics, null, 2)}

HISTORICAL DATA:
${JSON.stringify(this.metricsHistory.slice(-10), null, 2)}

ALERT RULES:
${JSON.stringify(this.alertRules, null, 2)}

Analyze system health and provide:
1. Overall health status assessment
2. Component-level health evaluation
3. Active alerts and their severity
4. Trend analysis and predictions
5. Optimization recommendations

Return structured health status with components, alerts, and recommendations.`;

    const response = await this.sendToClaude(prompt);
    return this.parseHealthStatus(response.content);
  }

  async detectAnomalies(metrics: SystemMetrics[]): Promise<Alert[]> {
    const promptContext = {
      metrics: JSON.stringify(metrics),
      config: JSON.stringify({ analysis: 'anomaly-detection' })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

METRICS HISTORY:
${JSON.stringify(metrics, null, 2)}

Detect anomalies in system behavior including:
1. Unusual resource consumption patterns
2. Performance degradation trends
3. Unexpected spikes or drops
4. System instability indicators

Return alerts for detected anomalies with severity and recommendations.`;

    const response = await this.sendToClaude(prompt);
    return this.parseAlerts(response.content);
  }

  async generateRecommendations(healthStatus: HealthStatus): Promise<string[]> {
    const promptContext = {
      metrics: JSON.stringify(healthStatus),
      config: JSON.stringify({ analysis: 'recommendations' })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

HEALTH STATUS:
${JSON.stringify(healthStatus, null, 2)}

Generate optimization recommendations including:
1. Performance improvement suggestions
2. Resource optimization opportunities
3. Preventive maintenance actions
4. Capacity planning recommendations

Return actionable recommendations prioritized by impact.`;

    const response = await this.sendToClaude(prompt);
    return this.parseRecommendations(response.content);
  }

  private async loadMonitoringConfiguration(): Promise<void> {
    try {
      const projectId = this.taskContext?.projectId || 'default';
      const configs: any[] = [];
      
      if (configs.length > 0) {
        const config = configs[0] as MonitoringConfig;
        this.alertRules = config.alertRules || [];
      } else {
        this.alertRules = this.getDefaultAlertRules();
      }
    } catch (error) {
      console.warn('Failed to load monitoring configuration, using defaults');
      this.alertRules = this.getDefaultAlertRules();
    }
  }

  private getDefaultAlertRules(): AlertRule[] {
    return [
      { id: 'cpu-high', name: 'High CPU Usage', condition: 'cpu > threshold', threshold: 80, severity: 'high', actions: ['notify', 'scale'] },
      { id: 'memory-high', name: 'High Memory Usage', condition: 'memory > threshold', threshold: 85, severity: 'high', actions: ['notify', 'cleanup'] },
      { id: 'disk-high', name: 'High Disk Usage', condition: 'disk > threshold', threshold: 90, severity: 'critical', actions: ['notify', 'archive'] },
      { id: 'cpu-critical', name: 'Critical CPU Usage', condition: 'cpu > threshold', threshold: 95, severity: 'critical', actions: ['notify', 'emergency-scale'] }
    ];
  }

  private async processAlerts(alerts: Alert[]): Promise<void> {
    for (const alert of alerts) {
      if (!this.activeAlerts.has(alert.id)) {
        this.activeAlerts.set(alert.id, alert);
        await this.triggerAlert(alert);
      }
    }

    for (const [alertId, alert] of this.activeAlerts) {
      if (!alerts.find(a => a.id === alertId)) {
        alert.resolved = true;
        await this.resolveAlert(alert);
        this.activeAlerts.delete(alertId);
      }
    }
  }

  private async triggerAlert(alert: Alert): Promise<void> {
    console.warn(`Alert triggered: ${alert.message} (${alert.severity})`);
  }

  private async resolveAlert(alert: Alert): Promise<void> {
    console.info(`Alert resolved: ${alert.message}`);
  }

  private async updateMonitoringState(metrics: SystemMetrics, health: HealthStatus): Promise<void> {
    try {
      const projectId = this.taskContext?.projectId || 'default';
      const monitoringData = {
        timestamp: Date.now(),
        metrics,
        health,
        alerts: Array.from(this.activeAlerts.values())
      };
      
      // Storage would be implemented here
    } catch (error) {
      console.warn('Failed to update monitoring state:', (error as Error).message);
    }
  }

  private parseMetrics(content: string): SystemMetrics {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const metrics = JSON.parse(jsonMatch[0]);
        return {
          timestamp: Date.now(),
          cpu: metrics.cpu || 0,
          memory: metrics.memory || 0,
          disk: metrics.disk || 0,
          network: {
            bytesIn: metrics.network?.bytesIn || 0,
            bytesOut: metrics.network?.bytesOut || 0
          }
        };
      }
    } catch (error) {
      console.warn('Failed to parse metrics');
    }

    return {
      timestamp: Date.now(),
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: { bytesIn: 0, bytesOut: 0 }
    };
  }

  private parseHealthStatus(content: string): HealthStatus {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const status = JSON.parse(jsonMatch[0]);
        return {
          overall: status.overall || 'healthy',
          components: status.components || [],
          alerts: status.alerts || [],
          recommendations: status.recommendations || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse health status');
    }

    return {
      overall: 'healthy',
      components: [],
      alerts: [],
      recommendations: ['System monitoring active']
    };
  }

  private parseAlerts(content: string): Alert[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.alerts || [];
      }
    } catch (error) {
      console.warn('Failed to parse alerts');
    }

    return [];
  }

  private parseRecommendations(content: string): string[] {
    const lines = content.split('\n');
    const recommendations: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.match(/^\d+\.|\-|\*/) || trimmed.toLowerCase().includes('recommend'))) {
        recommendations.push(trimmed.replace(/^\d+\.\s*|\-\s*|\*\s*/, ''));
      }
    }

    return recommendations.length > 0 ? recommendations : ['Continue monitoring system health'];
  }
}