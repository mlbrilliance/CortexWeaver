# CortexWeaver

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/cortexweaver/cortexweaver)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://www.npmjs.com/package/cortex-weaver)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

CortexWeaver is a command-line interface (CLI) tool that orchestrates a swarm of specialized AI agents, powered by Claude Code and Gemini CLI, to assist in software development. It transforms a high-level project plan (plan.md) into a series of coordinated, parallelized tasks executed by agents with distinct roles.

## 🚀 Key Features

- **Multi-Agent Orchestration**: Coordinate 14+ specialized AI agents for comprehensive development lifecycle
- **Intelligent Task Parallelization**: Automatically break down complex projects into concurrent workstreams
- **Advanced Testing Suite**: Four specialized testing approaches (London/Chicago TDD, Property-based, Mutation)
- **Pheromone Guidance System**: Bio-inspired coordination and strategic oversight across agent swarm
- **Knowledge Graph Navigation**: Semantic discovery and pattern analysis through Neo4j integration
- **Real-time Monitoring**: Track progress across all active agents with comprehensive status reporting
- **Git Worktree Management**: Isolate agent work in separate git worktrees for safe parallel development
- **Impasse Detection & Resolution**: Smart retry logic with escalation to specialized problem-solving agents
- **Multi-API Integration**: Seamless coordination between Claude and Gemini AI models
- **Quality Governance**: Multi-layered validation from code quality to performance optimization

## 🏗️ Architecture Overview

CortexWeaver employs a sophisticated multi-layered agent ecosystem with 14 specialized agents organized into functional categories:

```
                              ┌─────────────────┐
                              │   Orchestrator  │
                              │  (Coordination) │
                              └─────────┬───────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
          ┌─────────▼─────────┐ ┌───────▼───────┐ ┌─────────▼─────────┐
          │  CORE DEVELOPMENT │ │    TESTING    │ │ QUALITY & ANALYSIS│
          │                   │ │  SPECIALISTS  │ │                   │
          │ • Architect       │ │ • Chicago     │ │ • Quality Gate    │
          │ • Coder           │ │ • London      │ │ • Test Documenter │
          │ • Spec Writer     │ │ • Property    │ │ • Perf Optimizer  │
          │ • CodeSavant      │ │ • Mutation    │ │ • Monitor         │
          └───────────────────┘ └───────────────┘ └───────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                    ┌───────────────────▼───────────────────┐
                    │        GOVERNANCE & NAVIGATION        │
                    │                                       │
                    │  • Governor (Meta-Strategy)          │
                    │  • Cognitive Canvas Navigator        │
                    │  • Guide (Learning Paths)            │
                    └───────────────────────────────────────┘
```

## 📦 Installation & Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **Docker** and **Docker Compose** (for MCP servers)
- **Git** >= 2.25.0 (for worktree support)
- **Neo4j** database (for knowledge graph navigation)
- API keys for Claude (Anthropic) and Gemini (Google)

### Installation

```bash
# Install globally via npm
npm install -g cortex-weaver

# Verify installation
cortex-weaver --version
```

### Initial Setup

1. **Initialize a new project:**
   ```bash
   mkdir my-project
   cd my-project
   cortex-weaver init
   ```

2. **Configure environment variables:**
   ```bash
   # Edit the generated .env file
   nano .env
   ```

   Required environment variables:
   ```env
   ANTHROPIC_API_KEY=your_claude_api_key
   GOOGLE_API_KEY=your_gemini_api_key
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_neo4j_password
   CORTEX_WEAVER_WORKSPACE=/path/to/workspace
   CORTEX_WEAVER_LOG_LEVEL=info
   ```

3. **Start MCP servers:**
   ```bash
   # Uses the generated docker-compose.yml
   docker-compose up -d
   ```

4. **Verify setup:**
   ```bash
   cortex-weaver doctor
   ```

## 🎯 Usage Guide

### Creating Project Plans

Create a `plan.md` file in your project root:

```markdown
# Project: E-commerce API

## Objective
Build a RESTful API for an e-commerce platform with user authentication, product management, and order processing.

## Requirements
- User registration and authentication (JWT)
- Product CRUD operations with categories
- Shopping cart functionality
- Order management system
- Payment integration (Stripe)
- API documentation (OpenAPI/Swagger)

## Technical Stack
- Node.js with Express.js
- PostgreSQL database
- Redis for caching
- Docker for containerization

## Deliverables
1. Database schema and migrations
2. Authentication middleware
3. Product management endpoints
4. Cart and order processing
5. Payment integration
6. Comprehensive test suite
7. API documentation
8. Docker deployment configuration
```

### Running Orchestration

```bash
# Start the orchestration process
cortex-weaver start

# Start with specific configuration
cortex-weaver start --config custom-config.json

# Start with limited agents
cortex-weaver start --agents architect,coder,tester
```

### Monitoring Progress

```bash
# Check overall status
cortex-weaver status

# Detailed agent status
cortex-weaver status --detailed

# Watch real-time updates
cortex-weaver status --watch

# View specific agent logs
cortex-weaver logs architect
```

### Agent Session Management

```bash
# List active agent sessions
cortex-weaver sessions

# Attach to specific agent
cortex-weaver attach architect

# Send message to agent
cortex-weaver send coder "Focus on error handling"

# Pause/resume agents
cortex-weaver pause tester
cortex-weaver resume tester
```

### Worktree and Merge Management

```bash
# List active worktrees
cortex-weaver worktrees

# Review changes before merging
cortex-weaver review architect

# Merge completed work
cortex-weaver merge architect --branch feature/auth

# Clean up completed worktrees
cortex-weaver cleanup
```

## 🤖 Agent System

CortexWeaver features a sophisticated ecosystem of **14 specialized agents** organized into four functional categories, each optimized for specific aspects of the software development lifecycle.

### 🏗️ Core Development Agents

#### Orchestrator Agent
- **Role**: Project coordination and task delegation
- **Capabilities**: Plan parsing, task breakdown, resource allocation, agent coordination
- **Model**: Claude Sonnet for strategic thinking

#### Architect Agent
- **Role**: System design and technical architecture
- **Capabilities**: Creates comprehensive DESIGN.md files, Mermaid diagrams, API specifications, data models, architectural decision records
- **Model**: Claude Sonnet for complex architectural reasoning
- **Output**: Visual diagrams, technical documentation, system blueprints

#### Coder Agent
- **Role**: Implementation and code generation
- **Capabilities**: Clean code generation, comprehensive unit tests, compilation handling, version control, impasse detection
- **Model**: Claude Haiku for fast, efficient code generation
- **Features**: Smart retry logic, workspace management, automated testing

#### Spec Writer Agent
- **Role**: Requirements and specification documentation
- **Capabilities**: User story creation, Gherkin BDD scenarios, non-functional requirements, feature file generation
- **Model**: Gemini API for diverse specification approaches
- **Output**: Structured specifications, .feature files, validation criteria

#### CodeSavant Agent
- **Role**: Complex problem resolution and impasse handling
- **Capabilities**: Advanced debugging, technical research, deep architectural analysis, solution synthesis
- **Model**: Claude Opus for maximum reasoning power
- **Specialization**: Handles complex technical challenges that stump other agents

### 🧪 Testing Specialists

CortexWeaver implements **four distinct testing philosophies** to ensure comprehensive test coverage:

#### Chicago Tester (Classicist Style)
- **Philosophy**: Chicago School TDD with state-based verification
- **Approach**: Uses real objects when practical, focuses on final outcomes
- **Capabilities**: End-to-end behavior verification, integration testing, workflow validation
- **Model**: Claude Sonnet for thorough state analysis
- **Best For**: Business logic validation, system integration tests

#### London Tester (Mockist Style)
- **Philosophy**: London School TDD with interaction-based testing
- **Approach**: Mocks ALL dependencies for complete isolation
- **Capabilities**: Behavior verification, interaction testing, collaboration pattern validation
- **Model**: Claude Sonnet for detailed interaction analysis
- **Best For**: Unit testing with complex dependencies, protocol verification

#### Property Tester
- **Philosophy**: Property-based testing with mathematical rigor
- **Approach**: Identifies invariants and generates diverse input combinations
- **Capabilities**: Edge case discovery, round-trip testing, metamorphic property validation
- **Model**: Claude Sonnet for invariant identification
- **Best For**: Mathematical functions, data transformations, API contracts

#### Mutation Tester
- **Philosophy**: Test suite quality assessment through systematic code mutations
- **Approach**: Analyzes mutation survivors to identify test gaps
- **Capabilities**: Test effectiveness auditing, gap analysis, improvement recommendations
- **Model**: Claude Sonnet for quality analysis
- **Best For**: Test suite validation, quality assurance, CI/CD optimization

### 🔍 Quality & Analysis Agents

#### Quality Gatekeeper Agent
- **Role**: Post-development quality validation
- **Capabilities**: Linting validation, test verification, coverage analysis, threshold enforcement
- **Model**: Claude Sonnet for comprehensive quality assessment
- **Features**: Automated quality reports, pass/fail gating

#### Test Result Documenter Agent
- **Role**: Test documentation and reporting
- **Capabilities**: Coverage analysis, failure categorization, trend analysis, metric visualization
- **Model**: Claude Haiku for efficient documentation generation
- **Output**: Charts, metrics, actionable recommendations

#### Performance Optimizer Agent
- **Role**: System performance analysis and optimization
- **Capabilities**: Bottleneck identification, optimization strategies, resource efficiency analysis
- **Model**: Claude Sonnet for performance reasoning
- **Focus**: Latency, throughput, scalability improvements

#### Monitor Agent
- **Role**: System health monitoring and anomaly detection
- **Capabilities**: Metrics collection, alert management, health status analysis
- **Model**: Claude Haiku for real-time monitoring
- **Features**: Configurable alerts, trend analysis

### 🧭 Governance & Navigation Agents

#### Governor Agent
- **Role**: Meta-strategist and project oversight
- **Capabilities**: Cost monitoring, budget enforcement, quality analysis, strategic guidance
- **Model**: Claude Sonnet for strategic oversight
- **Features**: **Pheromone-based guidance system**, improvement proposals, resource optimization

#### Cognitive Canvas Navigator Agent
- **Role**: Knowledge graph exploration and insight discovery
- **Capabilities**: Semantic queries, structural analysis, pattern discovery, temporal/causal analysis
- **Model**: Claude Sonnet for graph reasoning
- **Technology**: Neo4j integration for graph navigation

#### Guide Agent
- **Role**: Intelligent guidance and learning path creation
- **Capabilities**: Project assessment, recommendation generation, adaptive learning paths
- **Model**: Claude Haiku for responsive guidance
- **Features**: Experience-level adaptation, contextual advice

### 🔄 Advanced Agent Capabilities

#### Impasse Detection & Resolution Workflow

When agents encounter complex technical challenges:

1. **Automatic Detection**: Smart retry logic identifies when agents are stuck
2. **Escalation Protocol**: Failed agents signal for specialized intervention
3. **Context Analysis**: CodeSavant analyzes problem, codebase, and attempted solutions
4. **Research Phase**: Conducts technical research, documentation review, and exploration
5. **Solution Synthesis**: Develops comprehensive solution approach with multiple strategies
6. **Guided Implementation**: Provides detailed instructions to the original agent
7. **Continuous Monitoring**: Follow-up support with additional intervention if needed

#### Pheromone Guidance System

Inspired by swarm intelligence, the Governor Agent implements a **chemical-trail coordination system**:

- **Success Pheromones**: Reinforce successful patterns and approaches
- **Warning Pheromones**: Mark problematic areas or approaches to avoid
- **Coordination Signals**: Guide agent priorities and resource allocation
- **Adaptive Learning**: System improves over time based on accumulated experience

## ⚙️ Configuration

### Project Configuration (`.cortexweaver/config.json`)

```json
{
  "project": {
    "name": "my-project",
    "version": "1.0.0",
    "workspace": "./workspace"
  },
  "agents": {
    "orchestrator": {
      "model": "claude-3-sonnet-20241022",
      "max_tokens": 8000,
      "temperature": 0.1
    },
    "architect": {
      "model": "claude-3-sonnet-20241022",
      "max_tokens": 8000,
      "temperature": 0.2
    },
    "coder": {
      "model": "claude-3-haiku-20241022",
      "max_tokens": 4000,
      "temperature": 0.1
    },
    "reviewer": {
      "model": "claude-3-sonnet-20241022",
      "max_tokens": 6000,
      "temperature": 0.1
    },
    "tester": {
      "model": "gemini-1.5-pro",
      "max_tokens": 8000,
      "temperature": 0.2
    },
    "codesavant": {
      "model": "claude-3-opus-20241022",
      "max_tokens": 32000,
      "temperature": 0.1
    }
  },
  "budget": {
    "daily_limit": 100.00,
    "per_agent_limit": 20.00,
    "currency": "USD"
  },
  "execution": {
    "max_concurrent_agents": 3,
    "task_timeout": 3600,
    "auto_merge": false,
    "backup_frequency": 300
  }
}
```

### 🎯 Model Selection & Optimization

#### Strategic Model Assignment
- **Claude Opus**: Maximum reasoning power for CodeSavant complex problem resolution
- **Claude Sonnet**: Balanced reasoning and speed for architecture, testing, quality analysis
- **Claude Haiku**: Fast, efficient processing for coding, documentation, monitoring
- **Gemini Pro**: Alternative perspective for specification writing and diverse approaches

#### Multi-API Integration Benefits
- **Diverse Perspectives**: Different AI models bring unique strengths to problem-solving
- **Cost Optimization**: Strategic model selection balances capability with budget
- **Resilience**: Fallback options ensure continued operation if one API is unavailable
- **Specialization**: Each model optimized for specific types of cognitive tasks

## 📋 Examples

### Sample Plan Structure

```markdown
# Project: [Name]

## Objective
[Clear project goal and purpose]

## Requirements
- [Functional requirement 1]
- [Functional requirement 2]
- [Non-functional requirement 1]

## Technical Stack
- [Technology 1]
- [Technology 2]

## Architecture Constraints
- [Constraint 1]
- [Constraint 2]

## Success Criteria
- [Measurable outcome 1]
- [Measurable outcome 2]

## Timeline
- Phase 1: [Description] (X days)
- Phase 2: [Description] (Y days)
```

### 🗺️ Common Workflows

**1. Full Stack Application Development:**
```bash
# Complete development lifecycle with all core agents
cortex-weaver start --agents architect,spec-writer,coder,chicago-tester,quality-gatekeeper
```

**2. Comprehensive Testing Strategy:**
```bash
# Multi-approach testing for critical systems
cortex-weaver start --agents london-tester,chicago-tester,property-tester,mutation-tester
```

**3. Legacy Code Modernization:**
```bash
# Refactoring with thorough test coverage
cortex-weaver start --agents architect,mutation-tester,coder,london-tester,performance-optimizer
```

**4. Bug Investigation & Resolution:**
```bash
# Deep debugging with specialized problem-solving
cortex-weaver start --agents codesavant,monitor --mode debug
```

**5. Quality Audit & Optimization:**
```bash
# Comprehensive quality analysis
cortex-weaver start --agents quality-gatekeeper,performance-optimizer,test-documenter,mutation-tester
```

### 🧪 Specialized Testing Workflows

#### When to Use Each Testing Agent

**Chicago Tester** - Use for:
- Business logic validation with real object interactions
- Integration testing across system boundaries
- End-to-end workflow verification
- State-based testing where final outcomes matter most

```bash
# Best for: E-commerce checkout flow, data processing pipelines
cortex-weaver start --agents chicago-tester --focus integration
```

**London Tester** - Use for:
- Unit testing with complex dependencies
- Protocol and interface verification
- Isolated component testing
- Behavior-driven development (BDD)

```bash
# Best for: API clients, service layers, dependency injection
cortex-weaver start --agents london-tester --focus unit-isolation
```

**Property Tester** - Use for:
- Mathematical functions and algorithms
- Data transformation validation
- API contract testing
- Edge case discovery

```bash
# Best for: Parsers, encoders, mathematical libraries
cortex-weaver start --agents property-tester --focus edge-cases
```

**Mutation Tester** - Use for:
- Test suite quality assessment
- Critical path validation
- CI/CD pipeline optimization
- Security-sensitive code validation

```bash
# Best for: Payment processing, authentication, core business logic
cortex-weaver start --agents mutation-tester --focus test-quality
```

#### Combined Testing Strategies

**Comprehensive Coverage:**
```bash
# Layer multiple testing approaches for maximum confidence
cortex-weaver start --agents chicago-tester,london-tester,property-tester --parallel
```

**Quality-First Development:**
```bash
# Start with property-based testing, then validate with mutation testing
cortex-weaver start --agents property-tester,mutation-tester --sequence
```

**Legacy Code Hardening:**
```bash
# Use mutation testing to find gaps, then fill with London-style unit tests
cortex-weaver start --agents mutation-tester,london-tester --mode sequential
```

### Troubleshooting

**Issue**: Agents stuck in loops or impasses
**Solution**: Automatic escalation to CodeSavant with advanced debugging capabilities

**Issue**: High API costs with multiple agents
**Solution**: Strategic model selection (Haiku for simple tasks, Sonnet for complex reasoning), budget enforcement via Governor agent

**Issue**: Merge conflicts in parallel development
**Solution**: Git worktree isolation with intelligent conflict resolution

**Issue**: Test suite quality concerns
**Solution**: Deploy Mutation Tester to identify gaps and improve test effectiveness

**Issue**: Performance bottlenecks
**Solution**: Performance Optimizer agent provides automated analysis and recommendations

**Issue**: Knowledge discovery across large codebases
**Solution**: Cognitive Canvas Navigator leverages Neo4j for semantic code exploration

## 🛠️ Contributing & Development

### Architecture Decisions

- **Event-driven communication** between agents using message queues
- **Git worktrees** for isolated parallel development
- **Docker containers** for reproducible MCP server environments
- **JSON-based configuration** for flexibility and version control

### Testing Approach

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests with real agents
npm run test:e2e
```

### 📁 File Organization

```
CortexWeaver/
├── src/
│   ├── agents/                    # 14 Specialized Agent Implementations
│   │   ├── architect.ts              # System design & architecture
│   │   ├── coder.ts                  # Code implementation & testing
│   │   ├── spec-writer.ts            # Requirements & specifications
│   │   ├── chicago-tester.ts         # Classicist TDD (state-based)
│   │   ├── london-tester.ts          # Mockist TDD (interaction-based)
│   │   ├── property-tester.ts        # Property-based testing
│   │   ├── mutation-tester.ts        # Test quality auditing
│   │   ├── quality-gatekeeper.ts     # Quality validation
│   │   ├── test-result-documenter.ts # Test documentation
│   │   ├── performance-optimizer.ts  # Performance analysis
│   │   ├── monitor.ts                # System monitoring
│   │   ├── governor.ts               # Meta-strategy & oversight
│   │   ├── cognitive-canvas-navigator.ts # Knowledge graph navigation
│   │   └── guide.ts                  # Intelligent guidance
│   ├── agent.ts                   # Base agent class
│   ├── orchestrator.ts            # Multi-agent coordination
│   ├── code-savant.ts             # Complex problem resolution
│   ├── cognitive-canvas.ts        # Knowledge graph interface
│   ├── claude-client.ts           # Claude API integration
│   ├── mcp-client.ts              # MCP server communication
│   ├── session.ts                 # Agent session management
│   ├── workspace.ts               # Git worktree management
│   ├── plan-parser.ts             # Project plan processing
│   ├── config.ts                  # Configuration handling
│   └── cli.ts                     # Command-line interface
├── tests/                      # Comprehensive test suites (69+ tests)
│   └── agents/                   # Individual agent test files
├── test-init/                  # Example project initialization
│   ├── plan.md                   # Sample project plan
│   └── docker-compose.yml        # MCP server configuration
├── dist/                       # Compiled TypeScript output
└── package.json                # Dependencies & scripts
```

### 📊 Project Statistics

- **Total Agents**: 14 specialized agents
- **Test Coverage**: 69+ comprehensive test cases
- **Lines of Code**: 2000+ lines across agent implementations
- **Dependencies**: Multi-API integration (Claude, Gemini, Neo4j)
- **Architecture**: Event-driven, swarm-intelligence inspired

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Documentation](https://cortexweaver.dev/docs)
- [GitHub Repository](https://github.com/cortexweaver/cortexweaver)
- [Issue Tracker](https://github.com/cortexweaver/cortexweaver/issues)
- [Community Discord](https://discord.gg/cortexweaver)

---

**CortexWeaver** - Orchestrating AI agents for seamless software development.