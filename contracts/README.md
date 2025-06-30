# CortexWeaver Contracts Directory

This directory contains formal specifications and contracts for Specification-Driven Development (SDD) in CortexWeaver. Following the principles outlined in "The Oracle's Dilemma," this directory serves as the **formal source of truth** for AI agents, eliminating ambiguity in natural language requirements.

## Purpose

The `/contracts` directory implements the core SDD principle where:
- High-level goals are translated into formal, machine-readable specifications
- These specifications serve as unambiguous contracts for AI agents
- The **Architect** and **Spec Writer** agents populate this directory
- The **Coder** and **Tester** agents use these contracts as their primary source of truth

## Directory Structure

```
contracts/
├── README.md              # This file - explains the contracts system
├── api/                   # OpenAPI specifications and API contracts
│   ├── openapi.yaml      # Main OpenAPI specification
│   └── endpoints/        # Individual endpoint specifications
├── schemas/              # JSON Schema definitions for data models
│   ├── models/          # Core data model schemas
│   └── validation/      # Input/output validation schemas
├── properties/          # Property-based test invariants and oracles
│   ├── invariants/      # System invariants and properties
│   └── oracles/         # Test oracles and verification rules
└── examples/            # Example data, usage patterns, and test cases
    ├── requests/        # Example API requests
    ├── responses/       # Example API responses
    └── data/           # Sample data sets
```

## Usage in CortexWeaver Workflow

### 1. Specification-First Development
1. **Spec Writer** creates BDD scenarios in natural language
2. **Formalizer** translates BDD scenarios into formal contracts:
   - OpenAPI specs for APIs (`/api/`)
   - JSON schemas for data models (`/schemas/`)
   - Property definitions for testing (`/properties/`)
3. **Architect** uses contracts to design system architecture
4. **Coder** implements code that satisfies the contracts
5. **Testers** verify implementation against formal specifications

### 2. Integration with Cognitive Canvas
- The Cognitive Canvas stores relationships between contracts, code modules, and tests
- Links specific contract files to implementing functions and test files
- Provides relational context while contracts hold the formal source of truth

## File Naming Conventions

### API Contracts (`/api/`)
- `openapi.yaml` - Main OpenAPI 3.0+ specification
- `endpoints/{service}-api.yaml` - Service-specific API definitions
- `endpoints/{version}/` - Version-specific API contracts

### Schema Definitions (`/schemas/`)
- `models/{entity}.schema.json` - Core entity schemas
- `validation/{operation}.schema.json` - Input/output validation schemas
- `common.schema.json` - Shared schema definitions

### Property Definitions (`/properties/`)
- `invariants/{domain}.properties.ts` - Domain-specific invariants
- `oracles/{feature}.oracle.ts` - Feature-specific test oracles
- `constraints/{system}.constraints.ts` - System-wide constraints

### Examples (`/examples/`)
- `requests/{endpoint}-request.json` - Example API requests
- `responses/{endpoint}-response.json` - Example API responses
- `data/{entity}-samples.json` - Sample data sets

## Contract Validation

Contracts in this directory should be:
- **Formal**: Machine-readable and unambiguous
- **Complete**: Cover all specified requirements
- **Consistent**: No contradictions between contracts
- **Testable**: Enable automated verification
- **Versioned**: Track changes and maintain compatibility

## Tools and Standards

- **OpenAPI 3.0+** for API specifications
- **JSON Schema Draft 7+** for data model definitions
- **TypeScript** for property-based test definitions
- **YAML/JSON** for configuration and data formats

## Agent Responsibilities

| Agent | Responsibility |
|-------|---------------|
| **Spec Writer** | Creates initial BDD scenarios and requirements |
| **Formalizer** | Translates BDD to formal contracts |
| **Architect** | Uses contracts for architectural decisions |
| **Coder** | Implements code satisfying contracts |
| **Property Tester** | Implements property-based tests from contracts |
| **Quality Gatekeeper** | Validates contract compliance |

## Getting Started

1. **For new features**: Start by defining contracts before implementation
2. **For existing features**: Formalize existing behavior into contracts
3. **For testing**: Use contracts to generate comprehensive test suites
4. **For documentation**: Contracts serve as living API documentation

## Best Practices

1. **Contract-First**: Always define contracts before implementation
2. **Single Source of Truth**: Keep contracts synchronized with implementation
3. **Version Management**: Use semantic versioning for contract changes
4. **Backwards Compatibility**: Maintain compatibility when updating contracts
5. **Clear Naming**: Use descriptive names for all contract files
6. **Regular Validation**: Continuously validate contracts against implementation

---

*This directory is automatically created by `cortex-weaver init` and managed by CortexWeaver's multi-agent system.*