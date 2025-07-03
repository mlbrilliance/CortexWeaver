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

## Getting Started

1. **For new features**: Start by defining contracts before implementation
2. **For existing features**: Formalize existing behavior into contracts
3. **For testing**: Use contracts to generate comprehensive test suites
4. **For documentation**: Contracts serve as living API documentation

See the template files in each subdirectory for examples and guidance.

---

*This directory is automatically created by `cortex-weaver init` and managed by CortexWeaver's multi-agent system.*