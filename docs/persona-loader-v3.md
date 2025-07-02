# PersonaLoader 3.0 - Enhanced Agent Persona Management

The PersonaLoader system in CortexWeaver 3.0 provides dynamic loading, parsing, and management of agent personas from markdown files in the `/prompts` directory. This enhanced version includes front-matter metadata support, version tracking, diff generation, and performance monitoring.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Persona File Format](#persona-file-format)
4. [API Reference](#api-reference)
5. [Configuration](#configuration)
6. [Advanced Features](#advanced-features)
7. [Examples](#examples)
8. [Testing](#testing)

## Overview

The PersonaLoader enables the dynamic persona system that allows CortexWeaver agents to:
- Load structured persona definitions from markdown files
- Support YAML front-matter metadata for enhanced configuration
- Track version history and generate diffs for persona evolution
- Provide performance metrics and caching for optimal performance
- Enable hot-reloading for development and real-time updates

## Features

### Core Features
- ✅ **Markdown Parsing**: Parse persona files into structured data
- ✅ **Front-matter Support**: YAML metadata parsing for enhanced configuration
- ✅ **Validation**: Format validation with clear error messages
- ✅ **Fallback Support**: Graceful degradation for malformed files
- ✅ **Hot-reloading**: Real-time updates during development
- ✅ **Caching**: Performance optimization with configurable TTL

### Enhanced Features (v3.0)
- ✅ **Version Tracking**: Comprehensive version history management
- ✅ **Diff Generation**: Compare personas and track changes
- ✅ **Performance Metrics**: Monitor loading performance and complexity
- ✅ **Metadata-driven Configuration**: Agent configuration via front-matter
- ✅ **Dependency Management**: Track agent dependencies and capabilities

## Persona File Format

### Basic Structure
```markdown
---
# YAML Front-matter (optional but recommended)
id: "agent-name"
name: "Human Readable Name"
category: "development"
priority: "high"
# ... additional metadata
---

# Agent Name Persona

## Role Definition
**Agent Role Title**

Description of the agent's primary role.

## Core Responsibilities
- Responsibility 1
- Responsibility 2

## Behavioral Guidelines
- Guideline 1
- Guideline 2

## Success Metrics
- Metric 1
- Metric 2

## Version Information
- Initial Release: CortexWeaver 3.0
- Last Updated: 2024-01-01
- Improvement Trigger: Performance feedback
```

### Front-matter Metadata Schema

```yaml
---
# Required fields
id: "unique-agent-identifier"
name: "Human Readable Agent Name"
category: "development|testing|architecture|quality|governance|specialized"
priority: "high|medium|low"

# Agent relationships
tags: ["tag1", "tag2"]
dependencies: ["agent-1", "agent-2"]
capabilities: ["capability-1", "capability-2"]

# Model configuration
modelPreferences:
  preferred: "claude-3-opus"
  alternatives: ["claude-3-sonnet"]
  complexity: "high|medium|low"

# Performance settings
performance:
  cacheEnabled: true
  hotReloadEnabled: false
  timeoutMs: 30000

# Custom metadata
custom:
  specialization: "specific-area"
  frameworks: ["framework1"]
  tools: ["tool1", "tool2"]
---
```

## API Reference

### PersonaLoader Class

#### Constructor
```typescript
constructor(config: Partial<PersonaConfig> = {})
```

#### Core Methods

##### loadPersona(agentName: string)
Load and parse a persona for the specified agent.

```typescript
async loadPersona(agentName: string): Promise<PersonaLoadResult>
```

**Returns**: `PersonaLoadResult` with success status, parsed persona, warnings, and fallback information.

##### generatePromptTemplate(persona: Persona, context?: Record<string, any>)
Generate a prompt template from a persona with optional context variables.

```typescript
generatePromptTemplate(persona: Persona, context: Record<string, any> = {}): string
```

##### getAvailablePersonas()
Get list of all available persona names.

```typescript
getAvailablePersonas(): string[]
```

#### Enhanced Methods (v3.0)

##### generatePersonaDiff(oldPersona: Persona, newPersona: Persona)
Compare two personas and generate a detailed diff.

```typescript
generatePersonaDiff(oldPersona: Persona, newPersona: Persona): PersonaDiff
```

##### savePersonaVersion(persona: Persona, changes: string[], reason: string)
Save a version entry to the persona's history.

```typescript
async savePersonaVersion(persona: Persona, changes: string[], reason: string): Promise<void>
```

##### getPersonaMetrics(agentName: string)
Get performance metrics for a cached persona.

```typescript
getPersonaMetrics(agentName: string): PersonaMetrics | null
```

##### dispose()
Clean up all caches and file watchers.

```typescript
dispose(): void
```

### Interface Definitions

#### Persona
```typescript
interface Persona {
  role: string;
  coreIdentity: string;
  primaryResponsibilities: string[];
  behavioralGuidelines: string[];
  interactionPatterns: Record<string, string[]>;
  successMetrics: string[];
  adaptationTriggers: string[];
  version: PersonaVersion;
  metadata: PersonaMetadata;
  technicalExpertise?: string[];
  toolsAndTechniques?: string[];
  rawContent: string;
  filePath: string;
  lastModified: Date;
}
```

#### PersonaMetadata
```typescript
interface PersonaMetadata {
  id: string;
  name: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  dependencies: string[];
  capabilities: string[];
  modelPreferences?: {
    preferred: string;
    alternatives: string[];
    complexity: 'low' | 'medium' | 'high';
  };
  performance?: {
    cacheEnabled: boolean;
    hotReloadEnabled: boolean;
    timeoutMs: number;
  };
  custom?: Record<string, any>;
}
```

#### PersonaDiff
```typescript
interface PersonaDiff {
  oldVersion: PersonaVersion;
  newVersion: PersonaVersion;
  changes: PersonaChange[];
  summary: string;
  timestamp: string;
}
```

## Configuration

### PersonaConfig Options

```typescript
interface PersonaConfig {
  promptsDirectory: string;      // Default: './prompts'
  enableHotReload: boolean;      // Default: false
  cacheTtl: number;             // Default: 300000 (5 minutes)
  validateFormat: boolean;       // Default: true
  fallbackToRaw: boolean;       // Default: true
}
```

### Usage Example

```typescript
import { PersonaLoader } from './persona';

const loader = new PersonaLoader({
  promptsDirectory: '/path/to/prompts',
  enableHotReload: true,
  cacheTtl: 600000, // 10 minutes
  validateFormat: true,
  fallbackToRaw: true
});

// Load a persona
const result = await loader.loadPersona('architect');
if (result.success) {
  console.log('Loaded persona:', result.persona?.role);
  console.log('Metadata:', result.persona?.metadata);
} else {
  console.error('Failed to load persona:', result.error);
}
```

## Advanced Features

### Version History Management

The PersonaLoader automatically tracks version history for personas:

```typescript
// Save a new version
await loader.savePersonaVersion(persona, [
  'Added new responsibility for API design',
  'Updated behavioral guidelines for async work'
], 'Performance optimization based on user feedback');

// Version history is automatically maintained
console.log(persona.version.history); // Array of version entries
```

### Persona Diff Generation

Compare personas to track evolution:

```typescript
const oldPersona = await loader.loadPersona('architect');
const newPersona = await loader.loadPersona('architect-v2');

const diff = loader.generatePersonaDiff(oldPersona.persona!, newPersona.persona!);
console.log('Changes:', diff.summary);
console.log('Detailed changes:', diff.changes);
```

### Performance Monitoring

Track persona loading performance:

```typescript
const metrics = loader.getPersonaMetrics('architect');
if (metrics) {
  console.log('Load time:', metrics.loadTime, 'ms');
  console.log('Complexity score:', metrics.complexity);
  console.log('File size:', metrics.fileSize, 'bytes');
}
```

### Hot Reloading

Enable real-time updates during development:

```typescript
const loader = new PersonaLoader({
  enableHotReload: true
});

// File changes are automatically detected and cache is invalidated
```

## Examples

### Basic Usage
```typescript
import { PersonaLoader } from './persona';

const loader = new PersonaLoader();
const result = await loader.loadPersona('coder');

if (result.success) {
  const prompt = loader.generatePromptTemplate(result.persona!, {
    taskTitle: 'Implement user authentication',
    priority: 'high'
  });
  console.log(prompt);
}
```

### Advanced Configuration
```typescript
const loader = new PersonaLoader({
  promptsDirectory: './custom-prompts',
  enableHotReload: process.env.NODE_ENV === 'development',
  cacheTtl: 1800000, // 30 minutes
  validateFormat: true
});

// Load with error handling
try {
  const result = await loader.loadPersona('custom-agent');
  
  if (result.warnings.length > 0) {
    console.warn('Persona warnings:', result.warnings);
  }
  
  if (result.usedFallback) {
    console.warn('Using fallback mode for persona');
  }
  
  // Use the persona...
} catch (error) {
  console.error('Failed to load persona:', error);
}
```

### Persona Evolution Workflow
```typescript
// Load current persona
const currentResult = await loader.loadPersona('architect');
const currentPersona = currentResult.persona!;

// Create improved version (externally modified)
const improvedResult = await loader.loadPersona('architect-improved');
const improvedPersona = improvedResult.persona!;

// Generate diff
const diff = loader.generatePersonaDiff(currentPersona, improvedPersona);

// Review changes
console.log('Persona evolution summary:', diff.summary);
diff.changes.forEach(change => {
  console.log(`${change.type}: ${change.field}`);
  if (change.oldValue) console.log(`  Old: ${change.oldValue}`);
  if (change.newValue) console.log(`  New: ${change.newValue}`);
});

// Save version if approved
if (approveChanges(diff)) {
  await loader.savePersonaVersion(
    improvedPersona,
    diff.changes.map(c => `${c.type} ${c.field}`),
    'Performance optimization based on user feedback'
  );
}
```

## Testing

The PersonaLoader includes comprehensive test coverage:

```bash
# Run all persona tests
npm test -- --testNamePattern="PersonaLoader"

# Run specific test suites
npm test -- tests/persona.test.ts
```

### Test Coverage Areas
- ✅ Basic persona loading and parsing
- ✅ Front-matter metadata parsing
- ✅ Error handling and fallback modes
- ✅ Caching and hot-reload functionality
- ✅ Validation and warning generation
- ✅ Version history management
- ✅ Persona diff generation
- ✅ Performance metrics tracking

### Example Test Structure
```typescript
describe('PersonaLoader', () => {
  describe('Front-matter Support', () => {
    it('should parse front-matter metadata correctly', async () => {
      // Test implementation
    });
  });
  
  describe('Persona Diff Generation', () => {
    it('should generate diff between two personas', () => {
      // Test implementation
    });
  });
  
  describe('Performance Metrics', () => {
    it('should return metrics for cached persona', async () => {
      // Test implementation
    });
  });
});
```

## Migration from v2.0

If upgrading from PersonaLoader v2.0:

1. **Add front-matter to existing personas** (optional but recommended)
2. **Update persona loading code** to handle new metadata field
3. **Enable new features** like version tracking and diff generation
4. **Update tests** to cover new functionality

The PersonaLoader v3.0 is fully backward compatible with v2.0 persona files.

---

This enhanced PersonaLoader system provides a robust foundation for the dynamic agent evolution capabilities in CortexWeaver 3.0, enabling sophisticated persona management, tracking, and optimization workflows.