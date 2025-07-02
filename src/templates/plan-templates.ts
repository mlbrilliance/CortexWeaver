import * as fs from 'fs';
import * as path from 'path';

/**
 * PlanTemplates handles the creation of project plan and documentation files
 */
export class PlanTemplates {
  
  static async createPlanTemplate(projectRoot: string): Promise<void> {
    const planPath = path.join(projectRoot, 'plan.md');
    
    if (fs.existsSync(planPath)) {
      return; // Don't overwrite existing plan
    }

    const planTemplate = `# Project Plan

## Overview
Describe your project goals and high-level architecture here.

## Specification-Driven Development (SDD)

This project follows CortexWeaver's Specification-Driven Development approach:

1. **Contracts First**: All features begin with formal specifications in \`/contracts/\`
2. **Agent Verification**: Multiple AI agents verify implementation against contracts
3. **Oracle-Driven Testing**: Property-based tests derive from formal contracts

### Contract Structure
- \`/contracts/api/\` - OpenAPI specifications for all endpoints
- \`/contracts/schemas/\` - JSON Schema definitions for data models
- \`/contracts/properties/\` - Property-based test invariants and oracles
- \`/contracts/examples/\` - Sample data and usage patterns

## Features

### Feature 1: Authentication System
- **Priority**: High
- **Description**: Implement user authentication with JWT tokens
- **Dependencies**: []
- **Agent**: Architect → Formalizer → Coder → Testers
- **Contracts Required**:
  - [ ] OpenAPI spec for auth endpoints (\`/contracts/api/auth-api.yaml\`)
  - [ ] User schema definition (\`/contracts/schemas/models/user.schema.json\`)
  - [ ] Auth property tests (\`/contracts/properties/invariants/auth.properties.ts\`)
  - [ ] Request/response examples (\`/contracts/examples/\`)
- **Acceptance Criteria**:
  - [ ] User registration endpoint
  - [ ] User login endpoint  
  - [ ] JWT token validation middleware
  - [ ] Password hashing and verification

#### SDD Workflow:
1. [ ] **Spec Writer**: Define BDD scenarios for authentication
2. [ ] **Formalizer**: Create formal contracts from BDD scenarios
3. [ ] **Architect**: Design architecture based on contracts
4. [ ] **Coder**: Implement code satisfying contracts
5. [ ] **Property Tester**: Verify implementation against invariants
6. [ ] **Quality Gatekeeper**: Validate contract compliance

#### Microtasks:
- [ ] Define authentication BDD scenarios
- [ ] Create OpenAPI spec for auth endpoints
- [ ] Define user data model schema
- [ ] Specify password security invariants
- [ ] Design token validation properties
- [ ] Implement authentication service
- [ ] Create comprehensive property-based tests
- [ ] Validate contract compliance

### Feature 2: User Dashboard
- **Priority**: Medium
- **Description**: Create user dashboard with profile management
- **Dependencies**: [Feature 1]
- **Agent**: Coder → Property Tester
- **Contracts Required**:
  - [ ] Dashboard API specification
  - [ ] Profile data schemas
  - [ ] UI component invariants
  - [ ] User interaction examples
- **Acceptance Criteria**:
  - [ ] User profile display
  - [ ] Profile editing functionality
  - [ ] Activity history
  - [ ] Settings management

#### SDD Workflow:
1. [ ] **Spec Writer**: Define dashboard BDD scenarios
2. [ ] **Formalizer**: Create dashboard contracts
3. [ ] **Architect**: Design dashboard architecture
4. [ ] **Coder**: Implement dashboard components
5. [ ] **Property Tester**: Test UI invariants
6. [ ] **Quality Gatekeeper**: Validate user experience

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js with Express/Fastify
- **Database**: PostgreSQL with TypeORM
- **Frontend**: React with TypeScript
- **Testing**: Jest with Supertest + Property-based testing
- **Documentation**: OpenAPI/Swagger (auto-generated from contracts)
- **Contracts**: OpenAPI 3.0+, JSON Schema Draft 7+

### SDD Quality Standards
- **Contract Coverage**: All features must have formal contracts
- **Property Testing**: Minimum 80% property-based test coverage
- **Oracle Verification**: All critical paths verified by test oracles
- **Contract-Code Sync**: Implementation must match contracts (CI/CD enforced)
- **Multi-Agent Verification**: At least 2 agents must verify each feature

### Quality Standards
- **Test Coverage**: Minimum 80%
- **Code Style**: ESLint + Prettier
- **Documentation**: All public APIs documented via contracts
- **Performance**: API responses < 200ms p95
- **Contract Compliance**: All endpoints must match OpenAPI specs

## Agent Workflow

The CortexWeaver multi-agent system follows this verification ecosystem:

1. **Orchestrator**: Coordinates the entire workflow
2. **Spec Writer**: Creates human-readable BDD scenarios
3. **Formalizer**: Translates BDD to formal machine-readable contracts
4. **Architect**: Designs system architecture from contracts
5. **Coder**: Implements code satisfying contracts
6. **Property Tester**: Verifies implementation with property-based tests
7. **Quality Gatekeeper**: Ensures contract compliance and quality

## Notes
- All features must start with contract definition in \`/contracts/\`
- Use property-based testing for comprehensive verification
- Contracts serve as the "oracle" for determining correct behavior
- Multiple AI agents provide verification redundancy
- Implementation is contract-driven, not prompt-driven
`;

    fs.writeFileSync(planPath, planTemplate);
  }
}
