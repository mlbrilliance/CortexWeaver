import * as fs from 'fs';
import * as path from 'path';

/**
 * PersonaTemplates handles the creation of agent persona files
 */
export class PersonaTemplates {
  
  static async createPromptsDirectory(projectRoot: string): Promise<void> {
    const promptsPath = path.join(projectRoot, 'prompts');
    
    // Create prompts directory if it doesn't exist
    if (!fs.existsSync(promptsPath)) {
      fs.mkdirSync(promptsPath, { recursive: true });
    }

    // Create agent persona files
    const personaFiles = [
      'orchestrator.md',
      'governor.md',
      'reflector.md',
      'formalizer.md',
      'architect.md',
      'coder.md',
      'quality-gatekeeper.md',
      'london-tester.md',
      'chicago-tester.md',
      'property-tester.md',
      'mutation-tester.md',
      'spec-writer.md',
      'guide.md',
      'test-result-documenter.md',
      'monitor.md',
      'performance-optimizer.md',
      'cognitive-canvas-navigator.md',
      'code-savant.md'
    ];

    // Copy persona files from the source prompts directory
    const sourcePromptsPath = path.join(__dirname, '..', '..', 'prompts');
    
    for (const personaFile of personaFiles) {
      const sourcePath = path.join(sourcePromptsPath, personaFile);
      const targetPath = path.join(promptsPath, personaFile);
      
      // Only create if it doesn't exist
      if (!fs.existsSync(targetPath)) {
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
        } else {
          // Fallback: create a basic template if source doesn't exist
          const basicTemplate = this.createBasicPersonaTemplate(personaFile.replace('.md', ''));
          fs.writeFileSync(targetPath, basicTemplate);
        }
      }
    }
  }

  private static createBasicPersonaTemplate(agentName: string): string {
    return `# ${agentName.charAt(0).toUpperCase() + agentName.slice(1)} Agent

## Role
${agentName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} for CortexWeaver projects.

## Core Identity
You are the ${agentName.replace('-', ' ')} agent, responsible for specific tasks within the CortexWeaver ecosystem.

## Primary Responsibilities
- [Add specific responsibilities for this agent]
- [Define key tasks and outputs]
- [Specify interaction patterns with other agents]

## Guidelines
- Follow CortexWeaver's Specification-Driven Development approach
- Maintain high quality standards
- Collaborate effectively with other agents
- Document all decisions and rationale

---
*This is a basic template. Please customize based on the specific agent's role and responsibilities.*`;
  }
}
