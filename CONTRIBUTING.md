# Contributing to CortexWeaver

Thank you for your interest in contributing to CortexWeaver! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **Git** >= 2.25.0
- **TypeScript** knowledge
- **Neo4j** (optional, for knowledge graph features)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/cortexweaver/cortexweaver.git
   cd cortexweaver
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Development Commands

```bash
# Development mode with TypeScript compilation
npm run dev

# Build the project
npm run build

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Generate test coverage
npm run test:coverage

# Clean build artifacts
npm run clean
```

## Project Structure

```
cortexweaver/
├── src/
│   ├── agents/              # Agent implementations
│   │   ├── architect/       # Architect agent (modular)
│   │   ├── coder/          # Coder agent (modular)
│   │   ├── cognitive-canvas-navigator/  # Navigation agent (modular)
│   │   └── *.ts            # Single-file agents
│   ├── cli/                # CLI commands and utilities
│   │   ├── commands.ts     # Command implementations
│   │   ├── parsers.ts      # Argument parsing
│   │   └── validators.ts   # Input validation
│   ├── cognitive-canvas/   # Knowledge graph operations
│   ├── orchestrator/       # Task coordination
│   ├── types/              # Type definitions
│   └── *.ts               # Core modules
├── tests/                  # Test suites
│   ├── agents/            # Agent tests
│   ├── integration/       # Integration tests
│   └── *.test.ts         # Unit tests
├── contracts/             # Contract examples
├── prompts/              # Agent personas
└── docs/                 # Documentation
```

### Key Directories

- **`src/agents/`**: All agent implementations
- **`src/cli/`**: Command-line interface implementation
- **`src/cognitive-canvas/`**: Knowledge graph and navigation
- **`src/orchestrator/`**: Task coordination and management
- **`tests/`**: Comprehensive test suites

## Coding Standards

### File Organization

1. **500-Line Limit**: Keep files under 500 lines for maintainability
2. **Modular Structure**: Break large components into modules
3. **Consistent Naming**: Use clear, descriptive names
4. **Index Files**: Use index.ts for clean exports

### TypeScript Guidelines

1. **Strict Type Checking**: Enable all strict TypeScript options
2. **Interface Definitions**: Define clear interfaces for all public APIs
3. **Type Exports**: Export types alongside implementations
4. **No Any**: Avoid `any` type; use proper type definitions

### Code Style

1. **ESLint Configuration**: Follow the project's ESLint rules
2. **Prettier Formatting**: Use Prettier for consistent formatting
3. **Import Organization**: Group imports logically
4. **Error Handling**: Implement comprehensive error handling

### Example Agent Structure

For complex agents, use modular structure:

```typescript
// agents/my-agent/types.ts
export interface MyAgentConfig {
  // type definitions
}

// agents/my-agent/core.ts
export class MyAgentCore {
  // core logic
}

// agents/my-agent/index.ts
export { MyAgent } from './my-agent';
export type { MyAgentConfig } from './types';

// agents/my-agent.ts (main file)
export class MyAgent extends Agent {
  // main agent implementation
}
```

## Testing

### Test Structure

1. **Unit Tests**: Test individual components and functions
2. **Integration Tests**: Test component interactions
3. **Agent Tests**: Comprehensive agent behavior tests

### Writing Tests

```typescript
import { MyAgent } from '../src/agents/my-agent';

describe('MyAgent', () => {
  let agent: MyAgent;

  beforeEach(() => {
    agent = new MyAgent();
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
  });

  it('should execute tasks', async () => {
    const result = await agent.executeTask();
    expect(result).toMatchObject({
      success: true
    });
  });
});
```

### Test Guidelines

1. **Descriptive Names**: Use clear test descriptions
2. **Setup/Teardown**: Proper test isolation
3. **Mock External Dependencies**: Use mocks for external services
4. **Coverage**: Aim for comprehensive test coverage

## Pull Request Process

### Before Submitting

1. **Run Tests**: Ensure all tests pass
   ```bash
   npm test
   ```

2. **Check Linting**: Fix any linting issues
   ```bash
   npm run lint
   ```

3. **Build Successfully**: Verify build works
   ```bash
   npm run build
   ```

4. **Update Documentation**: Update relevant documentation

### PR Guidelines

1. **Clear Description**: Explain what changes you made and why
2. **Single Responsibility**: Keep PRs focused on a single feature/fix
3. **Test Coverage**: Include tests for new functionality
4. **Documentation**: Update docs for user-facing changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
```

## Issue Guidelines

### Bug Reports

Include:
- **Environment**: Node.js version, OS, etc.
- **Steps to Reproduce**: Clear reproduction steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Logs/Errors**: Relevant error messages

### Feature Requests

Include:
- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other approaches considered
- **Implementation**: Implementation suggestions (optional)

## Development Guidelines

### Adding New Agents

1. **Create Agent Directory** (for complex agents):
   ```bash
   mkdir src/agents/my-agent
   ```

2. **Implement Core Files**:
   - `types.ts` - Type definitions
   - `my-agent.ts` - Main implementation
   - `index.ts` - Exports

3. **Add Tests**:
   ```bash
   touch tests/agents/my-agent.test.ts
   ```

4. **Update Documentation**: Add agent to README.md

### Modifying CLI Commands

1. **Update Command Implementation** in `src/cli/commands.ts`
2. **Update Argument Parsing** in `src/cli/parsers.ts`
3. **Add Validation** in `src/cli/validators.ts`
4. **Update Main CLI** in `src/index.ts`
5. **Add Tests** for new functionality

### Database Changes

1. **Update Schema** if needed
2. **Add Migration Scripts** (if applicable)
3. **Update Types** in TypeScript
4. **Test Database Operations**

## Code Review Process

### For Reviewers

1. **Functionality**: Does the code work as intended?
2. **Style**: Does it follow project conventions?
3. **Tests**: Are there adequate tests?
4. **Documentation**: Is documentation updated?
5. **Performance**: Any performance implications?

### For Contributors

1. **Be Responsive**: Address review feedback promptly
2. **Ask Questions**: Clarify unclear feedback
3. **Learn**: Use reviews as learning opportunities
4. **Iterate**: Be prepared to make multiple revisions

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Ask questions or discuss ideas
- **Code Review**: Get feedback on draft PRs

## Recognition

Contributors will be acknowledged in:
- Project README.md
- Release notes
- Special recognition for significant contributions

Thank you for contributing to CortexWeaver! Your efforts help make this project better for everyone.