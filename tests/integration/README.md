# CortexWeaver Integration Tests

This directory contains comprehensive end-to-end integration tests for the CortexWeaver agent orchestration system. These tests validate the complete SDD (Specification-Driven Development) workflow pipeline and ensure all system components work together seamlessly.

## Test Structure

### 📋 Test Categories

#### 1. **E2E Orchestration** (`e2e-orchestration.test.ts`)
- **Purpose**: Tests the complete SDD workflow pipeline: BDD → Formalization → Architecture → Implementation → Testing
- **Coverage**: 
  - Full project initialization and setup
  - Agent coordination and communication
  - Workflow completion validation
  - Real-world usage scenarios
- **Key Scenarios**:
  - Web application development workflow
  - Microservices architecture project
  - Data science project workflow
  - System reliability and health validation

#### 2. **Contract Workflow** (`contract-workflow.test.ts`)
- **Purpose**: Tests contract generation, validation, and consumption throughout the development lifecycle
- **Coverage**:
  - BDD specification to formal contract transformation
  - Contract compliance checking and validation
  - Contract versioning and evolution
  - Contract-driven test generation
- **Key Scenarios**:
  - OpenAPI contract generation from BDD specs
  - JSON Schema creation for data models
  - Property-based test contract definition
  - Contract breaking change detection

#### 3. **Error Recovery** (`error-recovery.test.ts`)
- **Purpose**: Tests comprehensive error handling and recovery mechanisms
- **Coverage**:
  - Database connection failures and recovery
  - Agent spawn failures and cleanup
  - Resource exhaustion scenarios
  - Network failures and retry mechanisms
  - Graceful degradation patterns
- **Key Scenarios**:
  - Database connection loss and restoration
  - Session failure recovery
  - Memory exhaustion handling
  - Circuit breaker pattern implementation

#### 4. **Performance Testing** (`performance.test.ts`)
- **Purpose**: Tests system performance under various load conditions
- **Coverage**:
  - Initialization performance benchmarks
  - Database operation performance
  - Memory usage and resource efficiency
  - Concurrent operation handling
  - Scalability testing
- **Key Scenarios**:
  - High-frequency database operations
  - Concurrent agent spawning
  - Memory leak detection
  - Load testing scenarios

#### 5. **Cognitive Canvas** (`cognitive-canvas.test.ts`)
- **Purpose**: Tests knowledge graph construction and querying capabilities
- **Coverage**:
  - Knowledge graph construction and evolution
  - Relationship tracking and inference
  - Snapshot and restore capabilities
  - Complex knowledge queries
  - Temporal knowledge tracking
- **Key Scenarios**:
  - Knowledge graph analytics
  - Cross-project knowledge sharing
  - Referential integrity maintenance
  - Graph traversal and path finding

#### 6. **Workspace & Session Management** (`workspace-session.test.ts`)
- **Purpose**: Tests workspace isolation and session lifecycle management
- **Coverage**:
  - Workspace isolation and management
  - Session lifecycle and monitoring
  - Resource cleanup and recovery
  - Concurrent session handling
  - Performance optimization
- **Key Scenarios**:
  - Workspace state synchronization
  - Session failure recovery
  - Resource contention handling
  - Performance benchmarking

#### 7. **MCP Integration** (`mcp-integration.test.ts`)
- **Purpose**: Tests Model Context Protocol server integration
- **Coverage**:
  - MCP server connection and communication
  - Resource discovery and management
  - Tool execution and coordination
  - Error handling and fallback mechanisms
  - Performance and reliability testing
- **Key Scenarios**:
  - Multi-server coordination
  - Agent-MCP integration
  - Partial functionality handling
  - High-frequency operations

## 🚀 Running Tests

### Prerequisites

1. **Neo4j Database**: Ensure Neo4j is running and accessible
   ```bash
   # Default connection: bolt://localhost:7687
   # Username: neo4j
   # Password: password (or set NEO4J_PASSWORD env var)
   ```

2. **Environment Variables**:
   ```bash
   export NEO4J_URI="bolt://localhost:7687"
   export NEO4J_USERNAME="neo4j"
   export NEO4J_PASSWORD="your-password"
   export CLAUDE_API_KEY="your-claude-api-key"
   ```

### Test Commands

#### Run All Tests
```bash
npm test                    # Run all tests (unit + integration)
npm run test:ci            # CI-friendly test run
```

#### Run Specific Test Categories
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # All integration tests
```

#### Run Individual Test Suites
```bash
npm run test:e2e           # End-to-end orchestration tests
npm run test:contracts     # Contract workflow tests
npm run test:errors        # Error handling tests
npm run test:performance   # Performance tests
npm run test:canvas        # Cognitive Canvas tests
npm run test:workspace     # Workspace & session tests
npm run test:mcp           # MCP integration tests
```

#### Development & Debugging
```bash
npm run test:watch         # Watch mode (all tests)
npm run test:watch:unit    # Watch mode (unit tests)
npm run test:watch:integration  # Watch mode (integration tests)
```

#### Coverage Reports
```bash
npm run test:coverage              # Full coverage report
npm run test:coverage:unit         # Unit test coverage
npm run test:coverage:integration  # Integration test coverage
```

## 📊 Test Configuration

### Timeouts
- **Unit Tests**: 30 seconds
- **Integration Tests**: 5 minutes (300 seconds)
- **Slow Test Threshold**: 1 minute

### Test Environment
- **Test Database**: Isolated Neo4j instance or test database
- **Mock Services**: Claude API and MCP servers can be mocked
- **Temporary Files**: All tests use temporary directories for isolation

### Performance Thresholds

#### Initialization Performance
- Project initialization: < 10 seconds
- Large project (50+ features): < 20 seconds
- Concurrent project initialization: < 30 seconds

#### Database Performance
- Task creation: < 1 second
- Task retrieval: < 0.5 seconds
- Contract operations: < 1 second
- Batch operations (20 items): < 10 seconds

#### Agent Performance
- Agent spawning: < 2 seconds
- Concurrent agent spawning (5 agents): < 3 seconds
- Session startup: < 3 seconds average

#### Memory Usage
- Memory growth per operation: < 1MB
- Total memory increase: < 50MB for typical workflows
- Memory leak threshold: < 500KB growth per iteration

## 🛠 Test Development Guidelines

### Writing Integration Tests

1. **Isolation**: Each test should be completely isolated
2. **Cleanup**: Always clean up resources (databases, files, sessions)
3. **Timeouts**: Use appropriate timeouts for async operations
4. **Error Handling**: Test both success and failure scenarios
5. **Performance**: Include performance assertions where relevant

### Test Structure
```typescript
describe('Feature Category', () => {
  beforeAll(async () => {
    // Global setup
  });

  afterAll(async () => {
    // Global cleanup
  });

  beforeEach(() => {
    // Test setup
  });

  afterEach(async () => {
    // Test cleanup
  });

  describe('Specific Feature', () => {
    it('should test specific behavior', async () => {
      // Test implementation
    });
  });
});
```

### Mock Guidelines
- Use mocks for external services (Claude API, MCP servers)
- Keep mocks realistic and behavior-accurate
- Test both success and failure scenarios
- Mock network delays and timeouts

### Performance Testing
- Include timing assertions for critical operations
- Test memory usage and resource cleanup
- Validate scalability characteristics
- Test under concurrent load

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check Neo4j status
systemctl status neo4j

# Check connection
curl http://localhost:7474/browser/

# Reset test data
npm run test:canvas -- --testNamePattern="should handle"
```

#### Memory Issues
```bash
# Run with garbage collection exposed
node --expose-gc ./node_modules/.bin/jest

# Monitor memory usage
npm run test:performance -- --testNamePattern="memory"
```

#### Timeout Issues
```bash
# Run with increased timeout
JEST_TIMEOUT=600000 npm run test:integration

# Run specific slow tests
npm run test:e2e -- --testTimeout=600000
```

### Debug Output
```bash
# Enable verbose logging
DEBUG=cortex:* npm run test:integration

# Show console output
npm run test:integration -- --verbose

# Run single test file
npm run test:integration -- cognitive-canvas.test.ts
```

## 📈 Continuous Integration

### CI Pipeline
```yaml
# Example GitHub Actions workflow
- name: Run Unit Tests
  run: npm run test:unit

- name: Run Integration Tests
  run: npm run test:integration
  env:
    NEO4J_URI: bolt://localhost:7687
    NEO4J_USERNAME: neo4j
    NEO4J_PASSWORD: password
```

### Test Matrix
- Node.js versions: 18.x, 20.x
- Neo4j versions: 4.x, 5.x
- Operating Systems: Ubuntu, macOS, Windows

## 📋 Test Coverage Goals

| Component | Target Coverage | Current Status |
|-----------|----------------|----------------|
| E2E Workflows | 95% | ✅ Implemented |
| Contract Management | 90% | ✅ Implemented |
| Error Scenarios | 85% | ✅ Implemented |
| Performance | 80% | ✅ Implemented |
| Cognitive Canvas | 90% | ✅ Implemented |
| Workspace/Session | 85% | ✅ Implemented |
| MCP Integration | 75% | ✅ Implemented |

## 🚨 Known Limitations

1. **External Dependencies**: Some tests require external services (Neo4j)
2. **Timing Sensitivity**: Performance tests may be sensitive to system load
3. **Resource Usage**: Integration tests consume significant system resources
4. **Test Duration**: Full integration test suite takes 10-15 minutes

## 🔮 Future Enhancements

- **Distributed Testing**: Multi-node test scenarios
- **Chaos Engineering**: Fault injection testing
- **Load Testing**: High-volume production simulation
- **Security Testing**: Vulnerability and penetration testing
- **Browser Testing**: Web interface integration tests

---

For questions or issues with the integration tests, please check the main project documentation or create an issue in the repository.