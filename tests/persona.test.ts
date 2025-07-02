import { PersonaLoader, Persona, PersonaConfig, PersonaDiff, PersonaMetrics } from '../src/persona';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('PersonaLoader', () => {
  let personaLoader: PersonaLoader;
  let mockFs: jest.Mocked<typeof fs>;
  let tempDir: string;

  // Sample persona content for testing
  const samplePersonaContent = `# Test Agent Persona

## Role
**Test Specialist & Validation Expert**

## Core Identity
You are the Test Agent, responsible for comprehensive testing and validation within the CortexWeaver system.

## Primary Responsibilities

### Testing Strategy
- Design comprehensive test strategies
- Execute test plans and validate results
- Identify edge cases and boundary conditions

### Quality Assurance
- Ensure code quality standards
- Validate implementations against requirements
- Support continuous improvement

## Behavioral Guidelines

### Testing Philosophy
- Focus on quality over quantity
- Test early and test often
- Document all findings

### Quality Standards
- Zero tolerance for critical bugs
- Comprehensive coverage required
- Clear reporting standards

## Interaction Patterns

### With Development Teams
- Collaborate on test strategy development
- Provide timely feedback on quality issues
- Support debugging and issue resolution

### With Quality Gatekeeper
- Coordinate quality standards enforcement
- Share testing insights and recommendations
- Support overall quality improvement

## Success Metrics
- Test coverage percentages
- Bug detection rates
- Quality improvement trends

## Adaptation Triggers
- When test effectiveness declines
- When new testing approaches emerge
- When quality standards change

## Version
- Initial Release: CortexWeaver 3.0
- Last Updated: 2024-01-01
- Improvement Trigger: Test effectiveness metrics, quality feedback`;

  // Sample persona with front-matter for testing
  const samplePersonaWithFrontMatter = `---
id: "test-agent"
name: "Test Agent"
category: "testing"
priority: "high"
tags: ["testing", "quality", "validation"]
dependencies: ["quality-gatekeeper"]
capabilities: ["test-design", "quality-assurance", "validation"]
modelPreferences:
  preferred: "claude-3-opus"
  alternatives: ["claude-3-sonnet"]
  complexity: "medium"
performance:
  cacheEnabled: true
  hotReloadEnabled: false
  timeoutMs: 30000
custom:
  specialization: "comprehensive-testing"
  testFrameworks: ["jest", "cypress", "playwright"]
---

# Test Agent Persona

## Role
**Test Specialist & Validation Expert**

## Core Identity
You are the Test Agent, responsible for comprehensive testing and validation within the CortexWeaver system.

## Primary Responsibilities

### Testing Strategy
- Design comprehensive test strategies
- Execute test plans and validate results
- Identify edge cases and boundary conditions

### Quality Assurance
- Ensure code quality standards
- Validate implementations against requirements
- Support continuous improvement

## Behavioral Guidelines

### Testing Philosophy
- Focus on quality over quantity
- Test early and test often
- Document all findings

### Quality Standards
- Zero tolerance for critical bugs
- Comprehensive coverage required
- Clear reporting standards

## Interaction Patterns

### With Development Teams
- Collaborate on test strategy development
- Provide timely feedback on quality issues
- Support debugging and issue resolution

### With Quality Gatekeeper
- Coordinate quality standards enforcement
- Share testing insights and recommendations
- Support overall quality improvement

## Success Metrics
- Test coverage percentages
- Bug detection rates
- Quality improvement trends

## Adaptation Triggers
- When test effectiveness declines
- When new testing approaches emerge
- When quality standards change

## Version
- Initial Release: CortexWeaver 3.0
- Last Updated: 2024-01-01
- Improvement Trigger: Test effectiveness metrics, quality feedback`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fs as jest.Mocked<typeof fs>;
    tempDir = '/tmp/test-prompts';
    
    // Setup default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({
      mtime: new Date('2024-01-01T00:00:00Z'),
      isFile: () => true,
      isDirectory: () => false
    } as fs.Stats);
    mockFs.readFileSync.mockReturnValue(samplePersonaContent);
    mockFs.readdirSync.mockReturnValue(['test-agent.md', 'other-agent.md'] as any);
    mockFs.watch.mockReturnValue({
      close: jest.fn()
    } as any);
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      personaLoader = new PersonaLoader();
      expect(personaLoader).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const config: Partial<PersonaConfig> = {
        promptsDirectory: tempDir,
        enableHotReload: true,
        cacheTtl: 600000,
        validateFormat: false
      };
      
      personaLoader = new PersonaLoader(config);
      expect(personaLoader).toBeDefined();
    });

    it('should throw error if prompts directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      expect(() => {
        new PersonaLoader({ promptsDirectory: '/nonexistent' });
      }).toThrow('Prompts directory not found');
    });
  });

  describe('loadPersona', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true,
        fallbackToRaw: true
      });
    });

    it('should successfully load and parse a valid persona', async () => {
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.success).toBe(true);
      expect(result.persona).toBeDefined();
      expect(result.persona?.role).toBe('Test Specialist & Validation Expert');
      expect(result.persona?.coreIdentity).toContain('Test Agent');
      expect(result.persona?.primaryResponsibilities).toHaveLength(3);
      expect(result.persona?.behavioralGuidelines).toHaveLength(3);
      expect(result.usedFallback).toBe(false);
      expect(result.warnings).toBeDefined();
    });

    it('should handle file not found gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await personaLoader.loadPersona('nonexistent-agent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Persona file not found');
      expect(result.persona).toBeUndefined();
    });

    it('should use fallback when parsing fails', async () => {
      const invalidContent = 'Invalid persona content without proper structure';
      mockFs.readFileSync.mockReturnValue(invalidContent);
      
      const result = await personaLoader.loadPersona('invalid-agent');
      
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.persona?.role).toBe('Unknown Role');
      expect(result.persona?.rawContent).toBe(invalidContent);
      expect(result.warnings).toContain(expect.stringContaining('Failed to parse persona'));
    });

    it('should return cached persona on subsequent calls', async () => {
      // First call
      await personaLoader.loadPersona('test-agent');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result = await personaLoader.loadPersona('test-agent');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should reload when file is modified', async () => {
      // First call
      await personaLoader.loadPersona('test-agent');
      
      // Simulate file modification
      const newMtime = new Date('2024-01-02T00:00:00Z');
      mockFs.statSync.mockReturnValue({
        mtime: newMtime,
        isFile: () => true,
        isDirectory: () => false
      } as fs.Stats);
      
      // Second call should reload
      await personaLoader.loadPersona('test-agent');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Persona Parsing', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
    });

    it('should parse interaction patterns correctly', async () => {
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.persona?.interactionPatterns).toBeDefined();
      expect(result.persona?.interactionPatterns['With Development Teams']).toHaveLength(3);
      expect(result.persona?.interactionPatterns['With Quality Gatekeeper']).toHaveLength(3);
    });

    it('should parse version information correctly', async () => {
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.persona?.version).toBeDefined();
      expect(result.persona?.version.initialRelease).toBe('CortexWeaver 3.0');
      expect(result.persona?.version.lastUpdated).toBe('2024-01-01');
      expect(result.persona?.version.improvementTrigger).toContain('Test effectiveness metrics');
    });

    it('should handle missing sections gracefully', async () => {
      const minimalContent = `# Minimal Agent Persona

## Role
**Minimal Agent**

## Core Identity
Minimal agent for testing.`;
      
      mockFs.readFileSync.mockReturnValue(minimalContent);
      
      const result = await personaLoader.loadPersona('minimal-agent');
      
      expect(result.success).toBe(true);
      expect(result.persona?.primaryResponsibilities).toHaveLength(0);
      expect(result.persona?.behavioralGuidelines).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('generatePromptTemplate', () => {
    let testPersona: Persona;

    beforeEach(async () => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
      
      const result = await personaLoader.loadPersona('test-agent');
      testPersona = result.persona!;
    });

    it('should generate prompt template with persona information', () => {
      const prompt = personaLoader.generatePromptTemplate(testPersona);
      
      expect(prompt).toContain('Test Specialist & Validation Expert');
      expect(prompt).toContain('## Identity');
      expect(prompt).toContain('Test Agent');
      expect(prompt).toContain('## Primary Responsibilities');
      expect(prompt).toContain('Design comprehensive test strategies');
    });

    it('should include context variables in prompt', () => {
      const context = {
        taskTitle: 'Test Task',
        projectName: 'Test Project',
        priority: 'high'
      };
      
      const prompt = personaLoader.generatePromptTemplate(testPersona, context);
      
      expect(prompt).toContain('## Current Context');
      expect(prompt).toContain('taskTitle: Test Task');
      expect(prompt).toContain('projectName: Test Project');
      expect(prompt).toContain('priority: high');
    });

    it('should handle empty context gracefully', () => {
      const prompt = personaLoader.generatePromptTemplate(testPersona, {});
      
      expect(prompt).toContain('Test Specialist & Validation Expert');
      expect(prompt).not.toContain('## Current Context');
    });
  });

  describe('Hot Reloading', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        enableHotReload: true
      });
    });

    it('should setup file watcher when hot reload is enabled', async () => {
      await personaLoader.loadPersona('test-agent');
      
      expect(mockFs.watch).toHaveBeenCalledWith(
        expect.stringContaining('test-agent.md'),
        expect.any(Function)
      );
    });

    it('should not setup file watcher when hot reload is disabled', async () => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        enableHotReload: false
      });
      
      await personaLoader.loadPersona('test-agent');
      
      expect(mockFs.watch).not.toHaveBeenCalled();
    });
  });

  describe('getAvailablePersonas', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir
      });
    });

    it('should return list of available personas', () => {
      const personas = personaLoader.getAvailablePersonas();
      
      expect(personas).toContain('test-agent');
      expect(personas).toContain('other-agent');
      expect(personas).toHaveLength(2);
    });

    it('should handle directory read errors gracefully', () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory read error');
      });
      
      const personas = personaLoader.getAvailablePersonas();
      
      expect(personas).toEqual([]);
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
    });

    it('should generate warnings for incomplete personas', async () => {
      const incompleteContent = `# Incomplete Persona

## Role
**Incomplete Agent**`;
      
      mockFs.readFileSync.mockReturnValue(incompleteContent);
      
      const result = await personaLoader.loadPersona('incomplete-agent');
      
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain(expect.stringContaining('Core identity'));
      expect(result.warnings).toContain(expect.stringContaining('primary responsibilities'));
    });

    it('should skip validation when disabled', async () => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: false
      });
      
      const incompleteContent = `# Incomplete Persona

## Role
**Incomplete Agent**`;
      
      mockFs.readFileSync.mockReturnValue(incompleteContent);
      
      const result = await personaLoader.loadPersona('incomplete-agent');
      
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        cacheTtl: 1000 // 1 second for testing
      });
    });

    it('should expire cache after TTL', async () => {
      // First call
      await personaLoader.loadPersona('test-agent');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Second call should reload due to expired cache
      await personaLoader.loadPersona('test-agent');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        enableHotReload: true
      });
    });

    it('should clean up watchers and cache on dispose', async () => {
      const mockWatcher = { close: jest.fn() };
      mockFs.watch.mockReturnValue(mockWatcher as any);
      
      // Load persona to create watcher
      await personaLoader.loadPersona('test-agent');
      
      // Dispose
      personaLoader.dispose();
      
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should handle dispose errors gracefully', async () => {
      const mockWatcher = { 
        close: jest.fn().mockImplementation(() => {
          throw new Error('Close error');
        })
      };
      mockFs.watch.mockReturnValue(mockWatcher as any);
      
      await personaLoader.loadPersona('test-agent');
      
      expect(() => personaLoader.dispose()).not.toThrow();
    });
  });

  describe('Front-matter Support', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
    });

    it('should parse front-matter metadata correctly', async () => {
      mockFs.readFileSync.mockReturnValue(samplePersonaWithFrontMatter);
      
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.success).toBe(true);
      expect(result.persona?.metadata).toBeDefined();
      expect(result.persona?.metadata.id).toBe('test-agent');
      expect(result.persona?.metadata.name).toBe('Test Agent');
      expect(result.persona?.metadata.category).toBe('testing');
      expect(result.persona?.metadata.priority).toBe('high');
      expect(result.persona?.metadata.tags).toEqual(['testing', 'quality', 'validation']);
      expect(result.persona?.metadata.dependencies).toEqual(['quality-gatekeeper']);
      expect(result.persona?.metadata.capabilities).toEqual(['test-design', 'quality-assurance', 'validation']);
    });

    it('should parse model preferences from front-matter', async () => {
      mockFs.readFileSync.mockReturnValue(samplePersonaWithFrontMatter);
      
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.persona?.metadata.modelPreferences).toBeDefined();
      expect(result.persona?.metadata.modelPreferences?.preferred).toBe('claude-3-opus');
      expect(result.persona?.metadata.modelPreferences?.alternatives).toEqual(['claude-3-sonnet']);
      expect(result.persona?.metadata.modelPreferences?.complexity).toBe('medium');
    });

    it('should parse performance settings from front-matter', async () => {
      mockFs.readFileSync.mockReturnValue(samplePersonaWithFrontMatter);
      
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.persona?.metadata.performance).toBeDefined();
      expect(result.persona?.metadata.performance?.cacheEnabled).toBe(true);
      expect(result.persona?.metadata.performance?.hotReloadEnabled).toBe(false);
      expect(result.persona?.metadata.performance?.timeoutMs).toBe(30000);
    });

    it('should handle persona without front-matter gracefully', async () => {
      mockFs.readFileSync.mockReturnValue(samplePersonaContent);
      
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.success).toBe(true);
      expect(result.persona?.metadata).toBeDefined();
      expect(result.persona?.metadata.id).toBe('test-agent');
      expect(result.persona?.metadata.category).toBe('general');
      expect(result.persona?.metadata.priority).toBe('medium');
    });

    it('should handle invalid YAML front-matter gracefully', async () => {
      const invalidFrontMatter = `---
invalid: yaml: content: [
---

# Test Agent Persona

## Role
**Test Agent**`;
      
      mockFs.readFileSync.mockReturnValue(invalidFrontMatter);
      
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.success).toBe(true);
      expect(result.persona?.metadata.category).toBe('general');
    });
  });

  describe('Persona Diff Generation', () => {
    let oldPersona: Persona;
    let newPersona: Persona;

    beforeEach(async () => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });

      // Load old persona
      mockFs.readFileSync.mockReturnValue(samplePersonaContent);
      const oldResult = await personaLoader.loadPersona('test-agent');
      oldPersona = oldResult.persona!;

      // Create modified persona
      const modifiedContent = samplePersonaContent.replace(
        '- Design comprehensive test strategies',
        '- Design comprehensive test strategies\n- Implement automated testing frameworks'
      ).replace(
        '**Test Specialist & Validation Expert**',
        '**Senior Test Specialist & Validation Expert**'
      );
      
      mockFs.readFileSync.mockReturnValue(modifiedContent);
      const newResult = await personaLoader.loadPersona('test-agent-modified');
      newPersona = newResult.persona!;
    });

    it('should generate diff between two personas', () => {
      const diff = personaLoader.generatePersonaDiff(oldPersona, newPersona);
      
      expect(diff).toBeDefined();
      expect(diff.changes).toBeDefined();
      expect(diff.summary).toBeDefined();
      expect(diff.timestamp).toBeDefined();
      expect(diff.oldVersion).toBeDefined();
      expect(diff.newVersion).toBeDefined();
    });

    it('should detect role changes', () => {
      const diff = personaLoader.generatePersonaDiff(oldPersona, newPersona);
      
      const roleChange = diff.changes.find(change => change.field === 'role');
      expect(roleChange).toBeDefined();
      expect(roleChange?.type).toBe('modified');
      expect(roleChange?.oldValue).toBe('Test Specialist & Validation Expert');
      expect(roleChange?.newValue).toBe('Senior Test Specialist & Validation Expert');
    });

    it('should detect added responsibilities', () => {
      const diff = personaLoader.generatePersonaDiff(oldPersona, newPersona);
      
      const addedResponsibilities = diff.changes.filter(
        change => change.field === 'primaryResponsibilities' && change.type === 'added'
      );
      expect(addedResponsibilities.length).toBeGreaterThan(0);
      expect(addedResponsibilities[0].newValue).toBe('Implement automated testing frameworks');
    });

    it('should generate meaningful change summary', () => {
      const diff = personaLoader.generatePersonaDiff(oldPersona, newPersona);
      
      expect(diff.summary).toContain('additions');
      expect(diff.summary).toContain('modifications');
    });

    it('should handle identical personas', () => {
      const diff = personaLoader.generatePersonaDiff(oldPersona, oldPersona);
      
      expect(diff.changes).toHaveLength(0);
      expect(diff.summary).toBe('No changes detected');
    });
  });

  describe('Version History Management', () => {
    let testPersona: Persona;

    beforeEach(async () => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
      
      const result = await personaLoader.loadPersona('test-agent');
      testPersona = result.persona!;
    });

    it('should save version history', async () => {
      const changes = ['Added new responsibility', 'Updated core identity'];
      const reason = 'Performance improvement based on feedback';
      
      await personaLoader.savePersonaVersion(testPersona, changes, reason);
      
      expect(testPersona.version.history).toBeDefined();
      expect(testPersona.version.history?.length).toBe(1);
      
      const historyEntry = testPersona.version.history![0];
      expect(historyEntry.changes).toEqual(changes);
      expect(historyEntry.reason).toBe(reason);
      expect(historyEntry.version).toMatch(/^v\d+$/);
      expect(historyEntry.timestamp).toBeDefined();
    });

    it('should limit version history to 10 entries', async () => {
      // Add 15 version entries
      for (let i = 0; i < 15; i++) {
        await personaLoader.savePersonaVersion(
          testPersona, 
          [`Change ${i}`], 
          `Reason ${i}`
        );
      }
      
      expect(testPersona.version.history?.length).toBe(10);
      expect(testPersona.version.history![0].changes[0]).toBe('Change 5');
      expect(testPersona.version.history![9].changes[0]).toBe('Change 14');
    });

    it('should update lastUpdated timestamp', async () => {
      const originalTimestamp = testPersona.version.lastUpdated;
      
      await personaLoader.savePersonaVersion(
        testPersona, 
        ['Test change'], 
        'Test reason'
      );
      
      expect(testPersona.version.lastUpdated).not.toBe(originalTimestamp);
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
    });

    it('should return metrics for cached persona', async () => {
      await personaLoader.loadPersona('test-agent');
      
      const metrics = personaLoader.getPersonaMetrics('test-agent');
      
      expect(metrics).toBeDefined();
      expect(metrics?.loadTime).toBeDefined();
      expect(metrics?.cacheHits).toBe(1);
      expect(metrics?.lastLoaded).toBeDefined();
      expect(metrics?.fileSize).toBeGreaterThan(0);
      expect(metrics?.complexity).toBeGreaterThan(0);
    });

    it('should return null for non-cached persona', () => {
      const metrics = personaLoader.getPersonaMetrics('non-existent-agent');
      
      expect(metrics).toBeNull();
    });

    it('should calculate complexity score correctly', async () => {
      await personaLoader.loadPersona('test-agent');
      
      const metrics = personaLoader.getPersonaMetrics('test-agent');
      
      expect(metrics?.complexity).toBeGreaterThan(0);
      expect(metrics?.complexity).toBeLessThanOrEqual(50); // Reasonable upper bound
    });
  });

  describe('Enhanced Validation', () => {
    beforeEach(() => {
      personaLoader = new PersonaLoader({
        promptsDirectory: tempDir,
        validateFormat: true
      });
    });

    it('should validate metadata fields', async () => {
      const personaWithMissingMetadata = `---
name: "Test Agent"
# Missing required fields
---

# Test Agent Persona

## Role
**Test Agent**

## Core Identity
Test agent for validation.`;
      
      mockFs.readFileSync.mockReturnValue(personaWithMissingMetadata);
      
      const result = await personaLoader.loadPersona('incomplete-agent');
      
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate persona structure with front-matter', async () => {
      mockFs.readFileSync.mockReturnValue(samplePersonaWithFrontMatter);
      
      const result = await personaLoader.loadPersona('test-agent');
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      // Should have fewer warnings due to comprehensive structure
    });
  });
});