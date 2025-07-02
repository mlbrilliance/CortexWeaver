import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { 
  Persona, 
  PersonaConfig, 
  PersonaLoadResult, 
  PersonaCacheEntry, 
  PersonaVersion, 
  PersonaMetadata,
  PersonaMetrics,
  PersonaVersionEntry 
} from './types';

/**
 * PersonaLoader class for loading and managing agent personas
 * Extracted from the main persona.ts file to handle file loading and caching
 */
export class PersonaLoader {
  private config: PersonaConfig;
  private cache: Map<string, PersonaCacheEntry> = new Map();
  private watchers: Map<string, fs.FSWatcher> = new Map();

  constructor(config: Partial<PersonaConfig> = {}) {
    this.config = {
      promptsDirectory: config.promptsDirectory || path.join(process.cwd(), 'prompts'),
      enableHotReload: config.enableHotReload ?? false,
      cacheTtl: config.cacheTtl ?? 300000, // 5 minutes
      validateFormat: config.validateFormat ?? true,
      fallbackToRaw: config.fallbackToRaw ?? true,
      ...config
    };

    // Ensure prompts directory exists
    if (!fs.existsSync(this.config.promptsDirectory)) {
      throw new Error(`Prompts directory not found: ${this.config.promptsDirectory}`);
    }
  }

  /**
   * Load a persona for the specified agent
   */
  async loadPersona(agentName: string): Promise<PersonaLoadResult> {
    try {
      const personaPath = this.getPersonaPath(agentName);
      
      // Check cache first
      const cached = this.getCachedPersona(agentName, personaPath);
      if (cached) {
        return {
          success: true,
          persona: cached,
          usedFallback: false,
          warnings: []
        };
      }

      // Load from file
      const result = await this.loadPersonaFromFile(personaPath);
      
      // Cache the result if successful
      if (result.success && result.persona) {
        this.cachePersona(agentName, result.persona, personaPath);
        
        // Setup hot reload if enabled
        if (this.config.enableHotReload) {
          this.setupHotReload(agentName, personaPath);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to load persona for ${agentName}: ${(error as Error).message}`,
        usedFallback: false,
        warnings: []
      };
    }
  }

  /**
   * Load persona from file and parse it
   */
  private async loadPersonaFromFile(filePath: string): Promise<PersonaLoadResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `Persona file not found: ${filePath}`,
          usedFallback: false,
          warnings: []
        };
      }

      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Try to parse the persona
      const parseResult = this.parsePersona(content, filePath, stats.mtime);
      
      if (parseResult.success && parseResult.persona) {
        return parseResult;
      }

      // If parsing failed and fallback is enabled, return raw content
      if (this.config.fallbackToRaw) {
        const fallbackPersona: Persona = {
          role: this.extractRole(content) || 'Unknown Role',
          coreIdentity: this.extractCoreIdentity(content) || content.substring(0, 200) + '...',
          primaryResponsibilities: [],
          behavioralGuidelines: [],
          interactionPatterns: {},
          successMetrics: [],
          adaptationTriggers: [],
          version: {
            initialRelease: 'Unknown',
            lastUpdated: stats.mtime.toISOString(),
            improvementTrigger: 'Fallback mode'
          },
          metadata: {
            id: path.basename(filePath, '.md'),
            name: path.basename(filePath, '.md'),
            category: 'fallback',
            priority: 'medium',
            tags: ['fallback'],
            dependencies: [],
            capabilities: [],
            custom: {}
          },
          rawContent: content,
          filePath,
          lastModified: stats.mtime
        };

        return {
          success: true,
          persona: fallbackPersona,
          usedFallback: true,
          warnings: [`Failed to parse persona, using fallback: ${parseResult.error}`]
        };
      }

      return parseResult;
    } catch (error) {
      return {
        success: false,
        error: `Error reading persona file: ${(error as Error).message}`,
        usedFallback: false,
        warnings: []
      };
    }
  }

  /**
   * Parse persona markdown content into structured format
   */
  private parsePersona(content: string, filePath: string, lastModified: Date): PersonaLoadResult {
    try {
      const warnings: string[] = [];
      
      // Parse front-matter and content
      const { frontMatter, markdownContent } = this.parseFrontMatter(content);
      
      // Extract metadata from front-matter
      const metadata = this.extractMetadata(frontMatter, filePath);
      
      // Extract role
      const role = this.extractRole(markdownContent);

      // Extract core identity
      const coreIdentity = this.extractCoreIdentity(markdownContent);

      // Extract sections
      const primaryResponsibilities = this.extractListSection(markdownContent, 'Primary Responsibilities');
      const behavioralGuidelines = this.extractListSection(markdownContent, 'Behavioral Guidelines');
      const interactionPatterns = this.extractInteractionPatterns(markdownContent);
      const successMetrics = this.extractListSection(markdownContent, 'Success Metrics');
      const adaptationTriggers = this.extractListSection(markdownContent, 'Adaptation Triggers');
      const technicalExpertise = this.extractListSection(markdownContent, 'Technical Expertise');
      const toolsAndTechniques = this.extractListSection(markdownContent, 'Tools & Techniques');
      
      // Extract version information
      const version = this.extractVersion(markdownContent);

      const persona: Persona = {
        role: role || 'Unknown Role',
        coreIdentity: coreIdentity || 'No core identity defined',
        primaryResponsibilities,
        behavioralGuidelines,
        interactionPatterns,
        successMetrics,
        adaptationTriggers,
        version,
        metadata,
        technicalExpertise: technicalExpertise.length > 0 ? technicalExpertise : undefined,
        toolsAndTechniques: toolsAndTechniques.length > 0 ? toolsAndTechniques : undefined,
        rawContent: content,
        filePath,
        lastModified
      };

      // Validate if enabled
      if (this.config.validateFormat) {
        const validationWarnings = this.validatePersona(persona);
        warnings.push(...validationWarnings);
      }

      return {
        success: true,
        persona,
        usedFallback: false,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse persona: ${(error as Error).message}`,
        usedFallback: false,
        warnings: []
      };
    }
  }

  private parseFrontMatter(content: string): { frontMatter: any; markdownContent: string } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    
    if (match) {
      try {
        const frontMatter = yaml.load(match[1]) || {};
        return { frontMatter, markdownContent: match[2] };
      } catch (error) {
        return { frontMatter: {}, markdownContent: content };
      }
    }
    
    return { frontMatter: {}, markdownContent: content };
  }

  private extractMetadata(frontMatter: any, filePath: string): PersonaMetadata {
    const defaultMetadata: PersonaMetadata = {
      id: path.basename(filePath, '.md'),
      name: frontMatter.name || path.basename(filePath, '.md'),
      category: frontMatter.category || 'general',
      priority: frontMatter.priority || 'medium',
      tags: frontMatter.tags || [],
      dependencies: frontMatter.dependencies || [],
      capabilities: frontMatter.capabilities || [],
      modelPreferences: frontMatter.modelPreferences,
      performance: frontMatter.performance,
      custom: frontMatter.custom || {}
    };

    return { ...defaultMetadata, ...frontMatter };
  }

  private extractRole(content: string): string | null {
    const roleMatch = content.match(/##\s*Role\s*\n\*\*(.*?)\*\*/);
    return roleMatch ? roleMatch[1].trim() : null;
  }

  private extractCoreIdentity(content: string): string | null {
    const match = content.match(/##\s*Core Identity\s*\n([\s\S]*?)(?=\n##|\n$)/);
    return match ? match[1].trim() : null;
  }

  private extractListSection(content: string, sectionName: string): string[] {
    const headerPattern = new RegExp(`(##|###)\\s*${sectionName}\\s*\\n`, 'i');
    const headerMatch = content.match(headerPattern);
    
    if (!headerMatch) return [];
    
    const headerIndex = headerMatch.index! + headerMatch[0].length;
    const afterHeader = content.substring(headerIndex);
    const nextHeaderMatch = afterHeader.match(/\n(##|###)\s/);
    const sectionContent = nextHeaderMatch 
      ? afterHeader.substring(0, nextHeaderMatch.index)
      : afterHeader;
    
    return sectionContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(item => item.length > 0);
  }

  private extractInteractionPatterns(content: string): Record<string, string[]> {
    const patterns: Record<string, string[]> = {};
    const sectionMatch = content.match(/##\s*Interaction Patterns\s*\n([\s\S]*?)(?=\n##|\n$)/);
    if (!sectionMatch) return patterns;
    
    const sectionContent = sectionMatch[1];
    const subsectionMatches = sectionContent.matchAll(/###\s*(.+?)\n([\s\S]*?)(?=\n###|\n$|$)/g);
    
    for (const match of subsectionMatches) {
      const title = match[1].trim();
      const subsectionText = match[2];
      
      if (title) {
        const items = subsectionText.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(item => item.length > 0);
        
        if (items.length > 0) {
          patterns[title] = items;
        }
      }
    }
    
    return patterns;
  }

  private extractVersion(content: string): PersonaVersion {
    const versionMatch = content.match(/##\s*Version\s*\n([\s\S]*?)(?=\n##|\n$)/);
    
    const defaultVersion: PersonaVersion = {
      initialRelease: 'Unknown',
      lastUpdated: new Date().toISOString(),
      improvementTrigger: 'Unknown'
    };
    
    if (!versionMatch) return defaultVersion;
    
    const versionContent = versionMatch[1];
    const initialMatch = versionContent.match(/-\s*Initial Release:\s*(.*)/);
    const updatedMatch = versionContent.match(/-\s*Last Updated:\s*(.*)/);
    const triggerMatch = versionContent.match(/-\s*Improvement Trigger:\s*(.*)/);
    
    return {
      initialRelease: initialMatch ? initialMatch[1].trim() : defaultVersion.initialRelease,
      lastUpdated: updatedMatch ? updatedMatch[1].trim() : defaultVersion.lastUpdated,
      improvementTrigger: triggerMatch ? triggerMatch[1].trim() : defaultVersion.improvementTrigger
    };
  }

  private validatePersona(persona: Persona): string[] {
    const warnings: string[] = [];
    
    if (!persona.role || persona.role === 'Unknown Role') {
      warnings.push('Missing or invalid role definition');
    }
    
    if (!persona.coreIdentity || persona.coreIdentity.length < 50) {
      warnings.push('Core identity is missing or too short');
    }
    
    if (persona.primaryResponsibilities.length === 0) {
      warnings.push('No primary responsibilities defined');
    }
    
    if (persona.behavioralGuidelines.length === 0) {
      warnings.push('No behavioral guidelines defined');
    }
    
    if (Object.keys(persona.interactionPatterns).length === 0) {
      warnings.push('No interaction patterns defined');
    }
    
    if (persona.successMetrics.length === 0) {
      warnings.push('No success metrics defined');
    }
    
    return warnings;
  }

  private getPersonaPath(agentName: string): string {
    return path.join(this.config.promptsDirectory, `${agentName}.md`);
  }


  private getCachedPersona(agentName: string, filePath: string): Persona | null {
    const cached = this.cache.get(agentName);
    if (!cached) return null;
    
    // Check if cache is still valid
    const now = new Date();
    const cacheAge = now.getTime() - cached.loadedAt.getTime();
    if (cacheAge > this.config.cacheTtl) {
      this.cache.delete(agentName);
      return null;
    }
    
    // Check if file has been modified
    try {
      const currentStats = fs.statSync(filePath);
      if (currentStats.mtime.getTime() > cached.fileStats.mtime.getTime()) {
        this.cache.delete(agentName);
        return null;
      }
    } catch {
      // File might have been deleted
      this.cache.delete(agentName);
      return null;
    }
    
    return cached.persona;
  }

  private cachePersona(agentName: string, persona: Persona, filePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      this.cache.set(agentName, {
        persona,
        loadedAt: new Date(),
        fileStats: stats
      });
    } catch {
      // Ignore caching errors
    }
  }


  private setupHotReload(agentName: string, filePath: string): void {
    const existingWatcher = this.watchers.get(agentName);
    if (existingWatcher) {
      existingWatcher.close();
    }
    
    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.cache.delete(agentName);
        }
      });
      this.watchers.set(agentName, watcher);
    } catch {
      // Ignore watcher setup errors
    }
  }

  getAvailablePersonas(): string[] {
    try {
      const files = fs.readdirSync(this.config.promptsDirectory);
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => path.basename(file, '.md'));
    } catch {
      return [];
    }
  }


  getPersonaMetrics(agentName: string): PersonaMetrics | null {
    const cached = this.cache.get(agentName);
    if (!cached) return null;
    
    return {
      loadTime: Date.now() - cached.loadedAt.getTime(),
      cacheHits: 1, // Simplified - would need more sophisticated tracking
      lastLoaded: cached.loadedAt,
      fileSize: cached.persona.rawContent.length,
      complexity: this.calculateComplexity(cached.persona)
    };
  }

  private calculateComplexity(persona: Persona): number {
    const complexity = Math.min(persona.rawContent.length / 1000, 10) + 
      (persona.primaryResponsibilities.length + persona.behavioralGuidelines.length + 
       persona.successMetrics.length + persona.adaptationTriggers.length) * 0.1 +
      Object.keys(persona.interactionPatterns).length * 0.2;
    return Math.round(complexity * 10) / 10;
  }


  async savePersonaVersion(persona: Persona, changes: string[], reason: string): Promise<void> {
    const historyEntry: PersonaVersionEntry = {
      version: `v${Date.now()}`,
      timestamp: new Date().toISOString(),
      changes,
      reason,
      metrics: {}
    };
    
    if (!persona.version.history) {
      persona.version.history = [];
    }
    persona.version.history.push(historyEntry);
    persona.version.lastUpdated = historyEntry.timestamp;
    if (persona.version.history.length > 10) {
      persona.version.history = persona.version.history.slice(-10);
    }
  }

  dispose(): void {
    this.cache.clear();
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch {
        // Ignore cleanup errors
      }
    });
    this.watchers.clear();
  }
}