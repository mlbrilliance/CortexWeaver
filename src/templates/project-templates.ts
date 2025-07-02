import { PlanTemplates } from './plan-templates';
import { PersonaTemplates } from './persona-templates';
import { PrototypeTemplates } from './prototype-templates';

/**
 * ProjectTemplates coordinates the creation of main project structure files
 * Now uses modular approach with specialized template classes
 */
export class ProjectTemplates {
  
  static async createPlanTemplate(projectRoot: string): Promise<void> {
    return PlanTemplates.createPlanTemplate(projectRoot);
  }

  static async createPromptsDirectory(projectRoot: string): Promise<void> {
    return PersonaTemplates.createPromptsDirectory(projectRoot);
  }

  static async createPrototypesDirectory(projectRoot: string): Promise<void> {
    return PrototypeTemplates.createPrototypesDirectory(projectRoot);
  }

  static async createPrototypesReadme(prototypesPath: string): Promise<void> {
    return PrototypeTemplates.createPrototypesReadme(prototypesPath);
  }

  static async createPrototypeTemplates(prototypesPath: string): Promise<void> {
    return PrototypeTemplates.createPrototypeTemplates(prototypesPath);
  }
}