import { ProjectTemplates } from './project-templates';
import { ConfigTemplates } from './config-templates';
import { DockerTemplates } from './docker-templates';

/**
 * CLITemplates Module
 * Handles creation of various template files and directory structures
 * 
 * This is the main entry point that delegates to specialized template modules:
 * - ProjectTemplates: Main project structure and prompts
 * - ConfigTemplates: Configuration files and schemas
 * - DockerTemplates: Docker and Kubernetes configurations
 */
export class CLITemplates {
  
  // Project structure methods - delegate to ProjectTemplates
  static async createPlanTemplate(projectRoot: string): Promise<void> {
    return ProjectTemplates.createPlanTemplate(projectRoot);
  }

  static async createPromptsDirectory(projectRoot: string): Promise<void> {
    return ProjectTemplates.createPromptsDirectory(projectRoot);
  }

  static async createPrototypesDirectory(projectRoot: string): Promise<void> {
    return ProjectTemplates.createPrototypesDirectory(projectRoot);
  }

  static async createPrototypesReadme(prototypesPath: string): Promise<void> {
    return ProjectTemplates.createPrototypesReadme(prototypesPath);
  }

  static async createPrototypeTemplates(prototypesPath: string): Promise<void> {
    return ProjectTemplates.createPrototypeTemplates(prototypesPath);
  }

  // Configuration methods - delegate to ConfigTemplates
  static async createEnvTemplate(projectRoot: string): Promise<void> {
    return ConfigTemplates.createEnvTemplate(projectRoot);
  }

  static async createOpenApiTemplate(apiPath: string): Promise<void> {
    return ConfigTemplates.createOpenApiTemplate(apiPath);
  }

  static async createJsonSchemaTemplates(schemasPath: string): Promise<void> {
    return ConfigTemplates.createJsonSchemaTemplates(schemasPath);
  }

  static async createContractsDirectory(projectRoot: string): Promise<void> {
    return ConfigTemplates.createContractsDirectory(projectRoot);
  }

  static async createGitIgnoreTemplate(projectRoot: string): Promise<void> {
    return ConfigTemplates.createGitIgnoreTemplate(projectRoot);
  }

  // Docker methods - delegate to DockerTemplates
  static async createDockerCompose(projectRoot: string): Promise<void> {
    return DockerTemplates.createDockerCompose(projectRoot);
  }

  static async createDockerfile(projectRoot: string): Promise<void> {
    return DockerTemplates.createDockerfile(projectRoot);
  }

  static async createDockerIgnore(projectRoot: string): Promise<void> {
    return DockerTemplates.createDockerIgnore(projectRoot);
  }

  static async createDockerComposeOverride(projectRoot: string): Promise<void> {
    return DockerTemplates.createDockerComposeOverride(projectRoot);
  }

  static async createDockerfileDev(projectRoot: string): Promise<void> {
    return DockerTemplates.createDockerfileDev(projectRoot);
  }

  static async createKubernetesTemplates(projectRoot: string): Promise<void> {
    return DockerTemplates.createKubernetesTemplates(projectRoot);
  }

  static async createHelmChart(projectRoot: string): Promise<void> {
    return DockerTemplates.createHelmChart(projectRoot);
  }

  // Convenience methods for common operations
  static async createFullProjectStructure(projectRoot: string): Promise<void> {
    // Create all essential project files and directories
    await Promise.all([
      this.createPlanTemplate(projectRoot),
      this.createEnvTemplate(projectRoot),
      this.createGitIgnoreTemplate(projectRoot),
      this.createContractsDirectory(projectRoot),
      this.createPromptsDirectory(projectRoot),
      this.createPrototypesDirectory(projectRoot),
    ]);
  }

  static async createDockerSetup(projectRoot: string): Promise<void> {
    // Create Docker-related files
    await Promise.all([
      this.createDockerCompose(projectRoot),
      this.createDockerfile(projectRoot),
      this.createDockerIgnore(projectRoot),
      this.createDockerComposeOverride(projectRoot),
      this.createDockerfileDev(projectRoot),
    ]);
  }

  static async createKubernetesSetup(projectRoot: string): Promise<void> {
    // Create Kubernetes deployment files
    await Promise.all([
      this.createKubernetesTemplates(projectRoot),
      this.createHelmChart(projectRoot),
    ]);
  }

  // Backward compatibility - maintain existing interfaces
  static createBasicPersonaTemplate(agentName: string): string {
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