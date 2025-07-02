import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI Utilities Module
 * Contains helper methods and utilities for the CLI class
 */
export class CLIUtils {
  

  /**
   * Validate that a directory is a valid CortexWeaver project
   */
  static validateProject(projectRoot: string): boolean {
    const requiredFiles = [
      path.join(projectRoot, '.cortexweaver', 'config.json'),
      path.join(projectRoot, 'plan.md')
    ];

    const requiredDirectories = [
      path.join(projectRoot, 'contracts'),
      path.join(projectRoot, 'contracts', 'api'),
      path.join(projectRoot, 'contracts', 'schemas'),
      path.join(projectRoot, 'contracts', 'properties'),
      path.join(projectRoot, 'contracts', 'examples'),
      path.join(projectRoot, 'prototypes')
    ];

    const filesExist = requiredFiles.every(file => fs.existsSync(file));
    const directoriesExist = requiredDirectories.every(dir => fs.existsSync(dir));

    return filesExist && directoriesExist;
  }

  /**
   * Validate and potentially repair prototypes directory structure
   */
  static validatePrototypesStructure(projectRoot: string): { isValid: boolean; missingDirs: string[] } {
    const prototypesPath = path.join(projectRoot, 'prototypes');
    
    if (!fs.existsSync(prototypesPath)) {
      return { isValid: false, missingDirs: ['prototypes'] };
    }

    const expectedSubdirs = [
      'features',
      'experiments', 
      'proofs-of-concept',
      'spike-solutions',
      'technical-demos',
      'ui-mockups',
      'data-models',
      'algorithms'
    ];

    const missingDirs: string[] = [];
    
    expectedSubdirs.forEach(subdir => {
      const subdirPath = path.join(prototypesPath, subdir);
      if (!fs.existsSync(subdirPath)) {
        missingDirs.push(subdir);
      }
    });

    // Check for README.md
    const readmePath = path.join(prototypesPath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      missingDirs.push('README.md');
    }

    return {
      isValid: missingDirs.length === 0,
      missingDirs
    };
  }

  /**
   * Parse agent persona markdown files to extract metadata
   */
  static parseAgentPersona(content: string, filename: string): { name: string; role: string; description: string } {
    const lines = content.split('\n');
    let name = filename.replace(/\.(md|txt)$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let role = 'Unknown Role';
    let description = 'No description available';

    // Parse markdown format
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ') && name === filename.replace(/\.(md|txt)$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())) {
        name = line.substring(2).trim();
      } else if (line.startsWith('## Role')) {
        role = lines[i + 1]?.trim() || role;
      } else if (line.startsWith('## Description')) {
        description = lines[i + 1]?.trim() || description;
      }
    }

    return { name, role, description };
  }

  /**
   * Get icon for task status
   */
  static getTaskStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      'pending': '⏳',
      'running': '🔄',
      'completed': '✅',
      'failed': '❌',
      'impasse': '🚧',
      'error': '⚠️'
    };
    
    return iconMap[status] || '❓';
  }

  /**
   * Create default agent personas in the prompts directory
   */
  static async createDefaultAgentPersonas(promptsDir: string): Promise<void> {
    fs.mkdirSync(promptsDir, { recursive: true });

    const defaultPersonas = [
      {
        filename: 'spec-writer.md',
        content: `# Spec Writer Agent

## Role
Requirements Analysis and Specification Creation

## Description
Creates comprehensive BDD specifications and feature files based on project requirements.

## Capabilities
- User story creation
- Acceptance criteria definition
- Gherkin scenario writing
- Requirements documentation
- Behavior-driven development specifications

## Knowledge Domains
- Business analysis
- Requirements engineering
- BDD/TDD methodologies
- User experience design
`
      },
      {
        filename: 'formalizer.md',
        content: `# Formalizer Agent

## Role
Contract and Mathematical Specification

## Description
Transforms BDD specifications into formal contracts and mathematical representations.

## Capabilities
- Contract specification creation
- Mathematical modeling
- Invariant definition
- Precondition/postcondition specification
- Formal verification support

## Knowledge Domains
- Formal methods
- Mathematical modeling
- Contract-based design
- Verification and validation
`
      },
      {
        filename: 'architect.md',
        content: `# Architect Agent

## Role
System Architecture and Technical Design

## Description
Designs system architecture and makes technical decisions based on formal contracts.

## Capabilities
- System architecture design
- Technology stack decisions
- Interface design
- Scalability planning
- Technical documentation

## Knowledge Domains
- Software architecture
- Design patterns
- Technology selection
- System integration
- Performance optimization
`
      },
      {
        filename: 'coder.md',
        content: `# Coder Agent

## Role
Implementation and Development

## Description
Implements features according to specifications and formal contracts.

## Capabilities
- Code implementation
- Algorithm development
- Error handling
- Code optimization
- Documentation writing

## Knowledge Domains
- Multiple programming languages
- Software development practices
- Code quality standards
- Testing integration
- Performance optimization
`
      },
      {
        filename: 'tester.md',
        content: `# Tester Agent

## Role
Quality Assurance and Validation

## Description
Creates comprehensive test suites and validates functionality against contracts.

## Capabilities
- Test suite creation
- Contract validation
- Edge case testing
- Performance testing
- Quality metrics analysis

## Knowledge Domains
- Testing methodologies
- Test automation
- Quality assurance
- Performance testing
- Security testing
`
      }
    ];

    for (const persona of defaultPersonas) {
      const filePath = path.join(promptsDir, persona.filename);
      fs.writeFileSync(filePath, persona.content);
    }

    console.log(`✅ Created ${defaultPersonas.length} default agent personas in ${promptsDir}`);
  }
}