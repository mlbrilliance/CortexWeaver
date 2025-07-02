# CortexWeaver 3.0 Prompt Improvement Workflow

## Overview

The Prompt Improvement Workflow is a comprehensive self-improvement system that enables CortexWeaver to continuously evolve and optimize its agent personas based on performance data and analysis. This system provides a robust framework for generating, reviewing, approving, and applying prompt improvements while maintaining complete version control and audit trails.

## Key Features

### 🔄 Complete Improvement Lifecycle
- **Proposal Generation**: Reflector agent analyzes performance patterns and generates improvement proposals
- **Intelligent Review**: Governor agent evaluates proposals using AI-assisted decision making
- **Safe Application**: Validated improvements are applied with automatic backup creation
- **Version Control**: Complete history tracking with rollback capabilities

### 📊 Performance-Driven Improvements
- Analyzes task success rates and failure patterns
- Correlates prompt versions with performance metrics
- Identifies underperforming agent configurations
- Generates targeted improvements based on data

### 🔒 Safety and Validation
- Multi-level approval workflow
- Comprehensive validation before application
- Automatic backup creation
- Rollback capabilities for safety

### 🚀 Hot-Reload Support
- Notifies dependent systems of prompt changes
- Supports live updates without system restart
- Change tracking for development workflows

## Architecture

### Core Components

1. **PromptImprovementWorkflow**: Main orchestration class
2. **ReflectorAgent**: Performance analysis and proposal generation
3. **GovernorAgent**: Intelligent review and approval
4. **Version Control**: History tracking and rollback system
5. **Validation System**: Safety checks and validation
6. **Hot-Reload Integration**: Live update support

### Data Flow

```
1. Reflector Agent
   ↓ (analyzes performance)
2. Improvement Proposals
   ↓ (submits for approval)
3. Governor Agent
   ↓ (reviews and approves/rejects)
4. Workflow System
   ↓ (applies approved changes)
5. Updated Prompts
   ↓ (notifies systems)
6. Hot-Reload
```

## API Reference

### PromptImprovementWorkflow

#### Constructor
```typescript
new PromptImprovementWorkflow(config: PromptImprovementConfig)
```

#### Key Methods

##### `generateUnifiedDiff(originalContent, improvedContent, filename)`
Generates a unified diff between original and improved prompt content.

**Parameters:**
- `originalContent: string` - Original prompt content
- `improvedContent: string` - Improved prompt content  
- `filename: string` - Name of the prompt file

**Returns:** `Promise<string>` - Unified diff format string

##### `createPromptVersion(promptFile, originalContent, improvedContent, rationale)`
Creates a new version entry in the improvement history.

**Parameters:**
- `promptFile: string` - Path to the prompt file
- `originalContent: string` - Original content
- `improvedContent: string` - Improved content
- `rationale: string` - Explanation for the improvement

**Returns:** `Promise<PromptVersion>` - Created version object

##### `submitForApproval(proposal)`
Submits an improvement proposal to the Governor agent for approval.

**Parameters:**
- `proposal: ImprovementProposal` - Proposal to submit

**Returns:** `Promise<SubmissionResult>` - Result of submission

##### `processApproval(proposalId, decision, reviewedBy, comments?)`
Processes an approval decision from the Governor agent.

**Parameters:**
- `proposalId: string` - ID of the proposal
- `decision: ApprovalStatus` - 'approved' or 'rejected'
- `reviewedBy: string` - Identifier of the reviewer
- `comments?: string` - Optional review comments

**Returns:** `Promise<ApprovalResult>` - Result of approval processing

##### `applyPromptImprovement(version)`
Applies an approved prompt improvement to the file system.

**Parameters:**
- `version: PromptVersion` - Approved version to apply

**Returns:** `Promise<ApplicationResult>` - Result of application

##### `rollbackToVersion(promptFile, versionId)`
Rolls back a prompt file to a previous version.

**Parameters:**
- `promptFile: string` - Path to the prompt file
- `versionId: string` - ID of the version to rollback to

**Returns:** `Promise<RollbackResult>` - Result of rollback operation

##### `validateImprovement(proposal)`
Validates an improvement proposal for safety and correctness.

**Parameters:**
- `proposal: ImprovementProposal` - Proposal to validate

**Returns:** `Promise<ValidationResult>` - Validation result with errors and warnings

##### `getVersionHistory(promptFile?)`
Retrieves version history for all prompts or a specific prompt file.

**Parameters:**
- `promptFile?: string` - Optional specific prompt file

**Returns:** `Promise<PromptVersion[]>` - Array of version entries

##### `getAuditTrail(promptFile?)`
Retrieves the complete audit trail of all improvements.

**Parameters:**
- `promptFile?: string` - Optional specific prompt file

**Returns:** `Promise<AuditTrailEntry[]>` - Array of audit entries

##### `getRecentChanges(hoursBack)`
Gets recent changes for hot-reload integration.

**Parameters:**
- `hoursBack: number` - Number of hours to look back (default: 24)

**Returns:** `Promise<ChangeNotification[]>` - Array of recent changes

## Usage Examples

### Basic Setup

```typescript
import { PromptImprovementWorkflow } from './prompt-improvement';
import { CognitiveCanvas } from './cognitive-canvas';

// Initialize the workflow
const cognitiveCanvas = new CognitiveCanvas({
  projectId: 'my-project',
  sessionId: 'my-session'
});

const workflow = new PromptImprovementWorkflow({
  workspaceRoot: '/path/to/workspace',
  cognitiveCanvas
});
```

### Processing Reflector Proposals

```typescript
// Reflector agent generates proposals
const proposals = [
  {
    file: 'agents/architect.md',
    diff: '--- original\n+++ improved\n@@ -1,2 +1,3 @@\n Original line\n+Added improvement\n Context line',
    rationale: 'Improved clarity based on performance analysis',
    priority: 'medium'
  }
];

// Process through workflow
const processed = await workflow.processReflectorProposals(proposals);
console.log(`Processed ${processed.length} proposals`);
```

### Governor Approval

```typescript
// Governor reviews and approves/rejects
const approvalResult = await workflow.processApproval(
  'proposal-id-123',
  'approved',
  'governor',
  'Good improvement that addresses identified issues'
);

console.log(`Proposal ${approvalResult.approved ? 'approved' : 'rejected'}`);
```

### Applying Improvements

```typescript
// Apply approved improvements
const versions = await workflow.getVersionHistory();
const approved = versions.filter(v => v.status === 'approved');

for (const version of approved) {
  const result = await workflow.applyPromptImprovement(version);
  if (result.success) {
    console.log(`Applied improvement to ${version.promptFile}`);
  }
}
```

### Version Control and Rollback

```typescript
// Get version history
const history = await workflow.getVersionHistory('agents/architect.md');
console.log(`Found ${history.length} versions`);

// Rollback to previous version if needed
const previousVersion = history[history.length - 2];
const rollbackResult = await workflow.rollbackToVersion(
  'agents/architect.md',
  previousVersion.id
);

if (rollbackResult.success) {
  console.log('Successfully rolled back');
}
```

## Integration with Agents

### Reflector Agent Integration

The Reflector agent automatically integrates with the prompt improvement workflow:

```typescript
// In ReflectorAgent.executeTask()
if (this.shouldAnalyzePrompts() && this.promptImprovementWorkflow) {
  const workflowResults = await this.processImprovementsWithWorkflow(promptImprovements);
  result.workflowResults = workflowResults;
}
```

### Governor Agent Integration

The Governor agent processes approval requests:

```typescript
// In GovernorAgent.executeTask()
const promptApprovals = await this.processPromptApprovalWorkflow();
result.promptApprovals = promptApprovals;
```

## Configuration

### PromptImprovementConfig

```typescript
interface PromptImprovementConfig {
  workspaceRoot: string;           // Root directory of the workspace
  cognitiveCanvas: CognitiveCanvas; // Cognitive canvas instance
  promptsDir?: string;             // Custom prompts directory (default: 'prompts')
  historyDir?: string;             // Custom history directory (default: '.cortex-history')
  backupDir?: string;              // Custom backup directory (default: '.cortex-history/backups')
}
```

## Data Structures

### PromptVersion

```typescript
interface PromptVersion {
  id: string;                    // Unique version identifier
  promptFile: string;            // Path to the prompt file
  originalContent: string;       // Original content
  improvedContent: string;       // Improved content
  diff: string;                  // Unified diff
  rationale: string;             // Reason for improvement
  timestamp: string;             // Creation timestamp
  status: PromptVersionStatus;   // Current status
  approvedBy?: string;           // Who approved it
  approvedAt?: string;           // When it was approved
  appliedAt?: string;            // When it was applied
  rollbackReason?: string;       // Reason for rollback if any
}
```

### ImprovementProposal

```typescript
interface ImprovementProposal {
  id: string;                    // Unique proposal identifier
  promptFile: string;            // Target prompt file
  originalContent: string;       // Current content
  improvedContent: string;       // Proposed content
  diff: string;                  // Generated diff
  rationale: string;             // Improvement rationale
  priority: ImprovementPriority; // Priority level
  submittedBy: string;           // Submitter identifier
  submittedAt: string;           // Submission timestamp
  status: PromptVersionStatus;   // Current status
  reviewedBy?: string;           // Reviewer identifier
  reviewedAt?: string;           // Review timestamp
  comments?: string;             // Review comments
}
```

## File Structure

The workflow creates and manages the following directory structure:

```
workspace/
├── prompts/                    # Prompt files
│   ├── agents/
│   │   ├── architect.md
│   │   ├── coder.md
│   │   └── ...
│   └── ...
├── .cortex-history/           # Version control directory
│   ├── versions.json          # Version history
│   ├── audit.json            # Audit trail
│   └── backups/              # Backup files
│       ├── architect.md.v1.backup
│       └── ...
└── ...
```

## Security and Safety

### Validation Checks
- File existence validation
- Content integrity checks
- Diff format validation
- Rationale requirement
- Size change analysis

### Backup Strategy
- Automatic backup before any changes
- Timestamped backup files
- Rollback capability
- Version history preservation

### Approval Workflow
- Multi-stage review process
- AI-assisted evaluation
- Rule-based safety checks
- Audit trail maintenance

## Performance Considerations

### Optimization Features
- Efficient diff generation
- Incremental version storage
- Smart caching of analysis results
- Asynchronous processing

### Scalability
- Supports large prompt files
- Handles multiple concurrent proposals
- Efficient history queries
- Minimal memory footprint

## Troubleshooting

### Common Issues

1. **Workflow not initialized**
   - Ensure CognitiveCanvas is properly configured
   - Check workspace root permissions

2. **Proposals not being processed**
   - Verify pheromone communication between agents
   - Check agent initialization order

3. **Approval failures**
   - Validate proposal format
   - Check Governor agent configuration

4. **Application errors**
   - Verify file permissions
   - Check backup directory access

### Debug Mode

Enable verbose logging by setting environment variable:
```bash
export CORTEX_DEBUG_PROMPTS=true
```

## Migration Guide

### From Legacy System

If migrating from an older prompt management system:

1. **Backup existing prompts**
2. **Initialize new workflow**
3. **Import existing versions if needed**
4. **Update agent configurations**
5. **Test approval workflow**

### Version Compatibility

- Compatible with CortexWeaver 3.0+
- Requires Node.js 18+
- TypeScript 4.5+

## Best Practices

### Prompt Improvement Guidelines

1. **Clear Rationales**: Always provide detailed explanations for improvements
2. **Small Changes**: Make incremental improvements rather than large rewrites
3. **Test Impact**: Monitor performance after applying improvements
4. **Regular Reviews**: Periodically review and clean up version history

### Development Workflow

1. **Feature Branches**: Use separate branches for experimental improvements
2. **Peer Review**: Have improvements reviewed by team members
3. **Gradual Rollout**: Apply improvements to non-critical agents first
4. **Monitoring**: Set up alerts for improvement failures

## Contributing

To contribute to the prompt improvement workflow:

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

## License

This prompt improvement workflow is part of CortexWeaver and is licensed under the MIT License.