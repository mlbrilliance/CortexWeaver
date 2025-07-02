import { WorkflowStep, WorkflowManager } from './workflow-manager';
import { CognitiveCanvas, TaskData } from '../cognitive-canvas';
import { ParsedPlan, Feature } from '../plan-parser';
import { StatusManager } from './status-manager';

/**
 * Filter artifacts by workflow step relevance
 */
export function filterArtifactsByWorkflowStep(nodes: any[], step: WorkflowStep): any[] {
  return nodes
    .filter(node => {
      const stepRelevance = calculateStepRelevance(node, step);
      return stepRelevance > 0.3; // Filter out low-relevance artifacts
    })
    .map(node => ({
      id: node.id,
      name: node.properties.name || node.id,
      type: node.type,
      relevanceScore: node.relevanceScore,
      stepRelevance: calculateStepRelevance(node, step),
      properties: extractRelevantProperties(node, step)
    }))
    .sort((a, b) => b.stepRelevance - a.stepRelevance)
    .slice(0, 10); // Limit to top 10 most relevant
}

/**
 * Calculate step relevance for a node
 */
export function calculateStepRelevance(node: any, step: WorkflowStep): number {
  const stepKeywords: Record<WorkflowStep, string[]> = {
    'DEFINE_REQUIREMENTS': ['requirement', 'spec', 'story', 'criteria'],
    'FORMALIZE_CONTRACTS': ['contract', 'interface', 'condition', 'invariant'],
    'PROTOTYPE_LOGIC': ['prototype', 'poc', 'proof', 'validate'],
    'DESIGN_ARCHITECTURE': ['architecture', 'design', 'pattern', 'component'],
    'IMPLEMENT_CODE': ['implementation', 'code', 'function', 'class'],
    'EXECUTE_TESTS': ['test', 'testing', 'validation', 'verification']
  };

  const keywords = stepKeywords[step] || [];
  const nodeText = `${node.type} ${node.properties.name || ''} ${node.properties.description || ''}`.toLowerCase();
  
  const matchCount = keywords.filter(keyword => nodeText.includes(keyword.toLowerCase())).length;
  return Math.min(matchCount / keywords.length, 1.0);
}

/**
 * Extract relevant properties for workflow step
 */
export function extractRelevantProperties(node: any, step: WorkflowStep): any {
  const relevantPropsMap: Record<WorkflowStep, string[]> = {
    'DEFINE_REQUIREMENTS': ['title', 'description', 'acceptanceCriteria', 'priority'],
    'FORMALIZE_CONTRACTS': ['interface', 'preconditions', 'postconditions', 'invariants'],
    'PROTOTYPE_LOGIC': ['implementation', 'validation', 'testResults'],
    'DESIGN_ARCHITECTURE': ['components', 'patterns', 'dependencies', 'interfaces'],
    'IMPLEMENT_CODE': ['functions', 'classes', 'modules', 'dependencies'],
    'EXECUTE_TESTS': ['testCases', 'coverage', 'results', 'performance']
  };

  const relevantProps = relevantPropsMap[step] || ['name', 'description', 'type'];
  const filtered: any = {};
  
  relevantProps.forEach(prop => {
    if (node.properties[prop] !== undefined) {
      filtered[prop] = node.properties[prop];
    }
  });
  
  return filtered;
}

/**
 * Extract workflow relevant patterns
 */
export function extractWorkflowRelevantPatterns(insights: any[], step: WorkflowStep): any[] {
  return insights
    .filter(insight => {
      const stepRelevance = calculatePatternRelevance(insight, step);
      return stepRelevance > 0.4;
    })
    .map(insight => ({
      type: insight.type,
      description: insight.description,
      confidence: insight.confidence,
      evidence: insight.evidence,
      stepRelevance: calculatePatternRelevance(insight, step)
    }))
    .sort((a, b) => b.stepRelevance - a.stepRelevance)
    .slice(0, 5); // Limit to top 5 patterns
}

/**
 * Calculate pattern relevance for workflow step
 */
export function calculatePatternRelevance(insight: any, step: WorkflowStep): number {
  const stepPatterns: Record<WorkflowStep, string[]> = {
    'DEFINE_REQUIREMENTS': ['requirement pattern', 'specification pattern', 'user story pattern'],
    'FORMALIZE_CONTRACTS': ['contract pattern', 'interface pattern', 'validation pattern'],
    'PROTOTYPE_LOGIC': ['prototype pattern', 'validation pattern', 'proof pattern'],
    'DESIGN_ARCHITECTURE': ['architectural pattern', 'design pattern', 'structural pattern'],
    'IMPLEMENT_CODE': ['implementation pattern', 'coding pattern', 'module pattern'],
    'EXECUTE_TESTS': ['testing pattern', 'validation pattern', 'quality pattern']
  };

  const patterns = stepPatterns[step] || [];
  const insightText = `${insight.type} ${insight.description}`.toLowerCase();
  
  const matchCount = patterns.filter(pattern => insightText.includes(pattern.toLowerCase())).length;
  return Math.min(matchCount / patterns.length, 1.0);
}

/**
 * Check if relationship is relevant for workflow step
 */
export function isRelationshipRelevantForStep(relationship: any, step: WorkflowStep): boolean {
  const relevantRelTypes: Record<WorkflowStep, string[]> = {
    'DEFINE_REQUIREMENTS': ['DEPENDS_ON', 'REQUIRES', 'SPECIFIES'],
    'FORMALIZE_CONTRACTS': ['IMPLEMENTS', 'VALIDATES', 'CONSTRAINS'],
    'PROTOTYPE_LOGIC': ['PROTOTYPES', 'VALIDATES', 'DEMONSTRATES'],
    'DESIGN_ARCHITECTURE': ['CONTAINS', 'USES', 'EXTENDS'],
    'IMPLEMENT_CODE': ['IMPLEMENTS', 'CALLS', 'INHERITS'],
    'EXECUTE_TESTS': ['TESTS', 'VERIFIES', 'VALIDATES']
  };

  const relevantTypes = relevantRelTypes[step] || [];
  return relevantTypes.includes(relationship.type);
}

/**
 * Create tasks from parsed plan
 */
export async function createTasks(
  parsedPlan: ParsedPlan,
  canvas: CognitiveCanvas,
  statusManager: StatusManager,
  workflowManager: WorkflowManager
): Promise<void> {
  const projectId = statusManager.getProjectId();
  if (!projectId) return;

  // Get dependency-ordered features
  const orderedFeatures = parsedPlan.features || [];
  if (!Array.isArray(orderedFeatures)) {
    console.warn('parsedPlan.features is not an array:', orderedFeatures);
    return;
  }
  
  const taskIdMap = new Map<string, string>();

  // Create tasks
  for (const feature of orderedFeatures) {
    const taskData: TaskData = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: feature.name,
      description: feature.description,
      status: 'pending',
      priority: feature.priority,
      projectId: projectId,
      createdAt: new Date().toISOString()
    };

    const createdTask = await canvas.createTask(taskData);
    workflowManager.setTaskFeatureMapping(createdTask.id, feature);
    taskIdMap.set(feature.name, createdTask.id);
  }

  // Create dependencies
  for (const feature of orderedFeatures) {
    const taskId = taskIdMap.get(feature.name);
    if (!taskId) continue;

    const dependencies = feature.dependencies || [];
    for (const depName of dependencies) {
      const depTaskId = taskIdMap.get(depName);
      if (depTaskId) {
        await canvas.createTaskDependency(taskId, depTaskId);
      }
    }
  }
}

/**
 * Initialize task workflow states
 */
export async function initializeTaskWorkflowStates(
  canvas: CognitiveCanvas,
  statusManager: StatusManager,
  workflowManager: WorkflowManager
): Promise<void> {
  const projectId = statusManager.getProjectId();
  if (!projectId) return;

  const tasks = await canvas.getTasksByProject(projectId);
  await workflowManager.initializeTaskWorkflowStates(tasks);
}

/**
 * Store architectural decisions from parsed plan
 */
export async function storeArchitecturalDecisions(
  parsedPlan: ParsedPlan,
  canvas: CognitiveCanvas,
  statusManager: StatusManager
): Promise<void> {
  const projectId = statusManager.getProjectId();
  if (!projectId) return;

  const decisions = parsedPlan.architectureDecisions || { technologyStack: {}, qualityStandards: {} };

  // Store technology stack decisions
  if (decisions.technologyStack && Object.keys(decisions.technologyStack).length > 0) {
    const techStackDescription = Object.entries(decisions.technologyStack)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    await canvas.storeArchitecturalDecision({
      id: `decision-tech-stack-${Date.now()}`,
      title: 'Technology Stack',
      description: techStackDescription,
      rationale: 'Technology choices for the project',
      status: 'approved',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });
  }

  // Store quality standards
  if (decisions.qualityStandards && Object.keys(decisions.qualityStandards).length > 0) {
    const qualityDescription = Object.entries(decisions.qualityStandards)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    await canvas.storeArchitecturalDecision({
      id: `decision-quality-${Date.now()}`,
      title: 'Quality Standards',
      description: qualityDescription,
      rationale: 'Quality requirements for the project',
      status: 'approved',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });
  }
}