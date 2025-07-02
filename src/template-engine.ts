import * as fs from 'fs/promises';
import * as path from 'path';

export interface TemplateContext {
  [key: string]: any;
}

/**
 * Simple template engine for processing prompt templates
 * Supports Handlebars-like syntax: {{variable}} and {{#if condition}}
 */
export class TemplateEngine {
  private templateCache: Map<string, string> = new Map();
  private templateDir: string;

  constructor(templateDir: string = './prompts') {
    this.templateDir = templateDir;
  }

  /**
   * Render a template with the given context
   */
  async render(templatePath: string, context: TemplateContext): Promise<string> {
    const template = await this.loadTemplate(templatePath);
    return this.processTemplate(template, context);
  }

  /**
   * Load template from file (with caching)
   */
  private async loadTemplate(templatePath: string): Promise<string> {
    const fullPath = path.isAbsolute(templatePath) 
      ? templatePath 
      : path.join(this.templateDir, templatePath);

    if (this.templateCache.has(fullPath)) {
      return this.templateCache.get(fullPath)!;
    }

    try {
      const template = await fs.readFile(fullPath, 'utf-8');
      this.templateCache.set(fullPath, template);
      return template;
    } catch (error) {
      throw new Error(`Failed to load template ${fullPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Process template with context data
   */
  private processTemplate(template: string, context: TemplateContext): string {
    let result = template;

    // Process conditional blocks first
    result = this.processConditionals(result, context);

    // Process loops
    result = this.processLoops(result, context);

    // Process simple variable substitutions
    result = this.processVariables(result, context);

    return result;
  }

  /**
   * Process {{#if condition}} blocks
   */
  private processConditionals(template: string, context: TemplateContext): string {
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(ifRegex, (match, condition, content) => {
      const value = this.resolveValue(condition.trim(), context);
      return this.isTruthy(value) ? content : '';
    });
  }

  /**
   * Process {{#each array}} blocks
   */
  private processLoops(template: string, context: TemplateContext): string {
    const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachRegex, (match, arrayPath, content) => {
      const array = this.resolveValue(arrayPath.trim(), context);
      
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map(item => {
        // Create context for each item
        const itemContext = { ...context, ...item };
        return this.processVariables(content, itemContext);
      }).join('');
    });
  }

  /**
   * Process {{variable}} substitutions
   */
  private processVariables(template: string, context: TemplateContext): string {
    const variableRegex = /\{\{([^#\/][^}]*)\}\}/g;
    
    return template.replace(variableRegex, (match, path) => {
      const value = this.resolveValue(path.trim(), context);
      return this.formatValue(value);
    });
  }

  /**
   * Resolve a dot-notation path to a value in the context
   */
  private resolveValue(path: string, context: TemplateContext): any {
    const parts = path.split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return '';
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Check if a value is truthy for conditionals
   */
  private isTruthy(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return !!value;
  }

  /**
   * Format a value for output
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      // For objects and arrays, try to format them nicely
      if (Array.isArray(value)) {
        return value.map(item => this.formatValue(item)).join(', ');
      }
      
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}