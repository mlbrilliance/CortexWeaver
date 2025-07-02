/**
 * Context Primer Analysis Module
 * 
 * Contains file scanning, analysis, and relevance calculation functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskData, CodeModuleData, ContractData } from '../cognitive-canvas';
import { AgentType } from '../orchestrator';
import { WorkspaceFileInfo, ContractSnippet, ContextPrimingOptions } from './types';

export class ContextAnalysis {
  constructor(private contractsPath: string = './contracts') {}

  async scanWorkspaceFiles(rootPath: string): Promise<WorkspaceFileInfo[]> {
    const files: WorkspaceFileInfo[] = [];
    
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(rootPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common directories we don't want to scan
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          
          // Recursively scan subdirectories
          const subFiles = await this.scanWorkspaceFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const fileInfo = this.analyzeFile(fullPath, stats);
          if (fileInfo) {
            files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${rootPath}:`, error);
    }
    
    return files;
  }

  analyzeFile(filePath: string, stats: any): WorkspaceFileInfo | null {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    
    // Determine file type and language
    let type: 'source' | 'test' | 'config' | 'documentation';
    let language: string;
    
    if (basename.includes('test') || basename.includes('spec') || filePath.includes('/test/')) {
      type = 'test';
    } else if (['.md', '.txt', '.rst', '.adoc'].includes(ext)) {
      type = 'documentation';
    } else if (['.json', '.yaml', '.yml', '.toml', '.ini', '.config'].includes(ext)) {
      type = 'config';
    } else {
      type = 'source';
    }
    
    // Determine language
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown'
    };
    
    language = languageMap[ext] || 'unknown';
    
    // Skip files that are too large or irrelevant
    if (stats.size > 1024 * 1024) { // Skip files larger than 1MB
      return null;
    }
    
    return {
      path: filePath,
      type,
      language,
      size: stats.size,
      lastModified: stats.mtime,
      relevanceScore: 0 // Will be calculated later
    };
  }

  async extractContractSnippets(): Promise<ContractSnippet[]> {
    const snippets: ContractSnippet[] = [];
    
    try {
      const contractFiles = await this.scanContractFiles(this.contractsPath);
      
      for (const file of contractFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const snippet = this.parseContractFile(file, content);
        if (snippet) {
          snippets.push(snippet);
        }
      }
    } catch (error) {
      console.warn('Failed to extract contract snippets:', error);
    }
    
    return snippets;
  }

  private async scanContractFiles(contractsPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(contractsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(contractsPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanContractFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.yaml', '.yml', '.json', '.ts', '.js'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan contracts directory ${contractsPath}:`, error);
    }
    
    return files;
  }

  private parseContractFile(filePath: string, content: string): ContractSnippet | null {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);
    
    let type: 'openapi' | 'json-schema' | 'property-definition';
    let description: string;
    
    // Determine contract type based on file path and content
    if (filePath.includes('openapi') || content.includes('swagger') || content.includes('openapi')) {
      type = 'openapi';
      description = `OpenAPI specification from ${basename}`;
    } else if (filePath.includes('schema') || content.includes('"$schema"')) {
      type = 'json-schema';
      description = `JSON Schema definition from ${basename}`;
    } else if (filePath.includes('properties') || content.includes('properties')) {
      type = 'property-definition';
      description = `Property definition from ${basename}`;
    } else {
      return null;
    }
    
    // Truncate content if too long
    const maxLength = 2000;
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + '\n... (truncated)'
      : content;
    
    return {
      file: filePath,
      type,
      content: truncatedContent,
      description,
      relevanceScore: 0 // Will be calculated later
    };
  }

  prioritizeCodeModules(
    modules: CodeModuleData[], 
    task: TaskData, 
    agentType: AgentType, 
    maxCount: number
  ): CodeModuleData[] {
    return modules
      .map(module => ({
        ...module,
        relevanceScore: this.calculateModuleRelevance(module, task, agentType)
      }))
      .sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore)
      .slice(0, maxCount);
  }

  prioritizeContracts(
    contracts: ContractData[], 
    task: TaskData, 
    agentType: AgentType
  ): ContractData[] {
    return contracts
      .map(contract => ({
        ...contract,
        relevanceScore: this.calculateContractDataRelevance(contract, task, agentType)
      }))
      .sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore);
  }

  calculateModuleRelevance(module: CodeModuleData, task: TaskData, agentType: AgentType): number {
    let score = 0;
    
    // Base relevance from keywords in module name and file path
    const keywords = this.extractKeywords(task.title + ' ' + task.description);
    const moduleText = (module.name + ' ' + module.filePath).toLowerCase();
    
    for (const keyword of keywords) {
      if (moduleText.includes(keyword.toLowerCase())) {
        score += 0.3;
      }
    }
    
    // Agent-specific relevance
    switch (agentType) {
      case 'SpecWriter':
        if (module.type === 'component' || module.filePath.includes('spec')) score += 0.2;
        break;
      case 'Formalizer':
        if (module.type === 'module' || module.filePath.includes('contract')) score += 0.2;
        break;
      case 'Architect':
        if (module.type === 'module' || module.type === 'class') score += 0.2;
        break;
      case 'Coder':
        if (module.type === 'function' || module.type === 'class') score += 0.2;
        break;
      case 'Tester':
        if (module.filePath.includes('test') || module.type === 'function') score += 0.2;
        break;
    }
    
    // Recency bonus
    if (module.updatedAt) {
      const daysSinceUpdate = (Date.now() - new Date(module.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  calculateContractDataRelevance(contract: ContractData, task: TaskData, agentType: AgentType): number {
    let score = 0;
    
    // Keyword matching
    const keywords = this.extractKeywords(task.title + ' ' + task.description);
    const contractText = (contract.name + ' ' + (contract.description || '')).toLowerCase();
    
    for (const keyword of keywords) {
      if (contractText.includes(keyword.toLowerCase())) {
        score += 0.4;
      }
    }
    
    // Agent-specific contract type preferences
    switch (agentType) {
      case 'SpecWriter':
        if (contract.type === 'openapi') score += 0.3;
        break;
      case 'Formalizer':
        score += 0.4; // All contracts are relevant for formalizer
        break;
      case 'Architect':
        if (contract.type === 'openapi' || contract.type === 'json-schema') score += 0.3;
        break;
      case 'Coder':
        if (contract.type === 'openapi' || contract.type === 'json-schema') score += 0.3;
        break;
      case 'Tester':
        score += 0.2; // Contracts help with test validation
        break;
    }
    
    return Math.min(score, 1.0);
  }

  calculateFileRelevance(file: WorkspaceFileInfo, task: TaskData, agentType: AgentType): number {
    let score = 0;
    
    // Keyword matching
    const keywords = this.extractKeywords(task.title + ' ' + task.description);
    const filePath = file.path.toLowerCase();
    
    for (const keyword of keywords) {
      if (filePath.includes(keyword.toLowerCase())) {
        score += 0.3;
      }
    }
    
    // Agent-specific file type preferences
    switch (agentType) {
      case 'SpecWriter':
        if (file.type === 'documentation' || file.language === 'markdown') score += 0.2;
        break;
      case 'Formalizer':
        if (file.type === 'source' || file.path.includes('contract')) score += 0.2;
        break;
      case 'Architect':
        if (file.type === 'source' || file.type === 'config') score += 0.2;
        break;
      case 'Coder':
        if (file.type === 'source') score += 0.3;
        break;
      case 'Tester':
        if (file.type === 'test' || file.type === 'source') score += 0.2;
        break;
    }
    
    // Language relevance
    if (['typescript', 'javascript'].includes(file.language)) score += 0.1;
    
    // Recency bonus
    const daysSinceModified = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 7) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  calculateContractRelevance(snippet: ContractSnippet, task: TaskData, agentType: AgentType): number {
    let score = 0;
    
    // Keyword matching
    const keywords = this.extractKeywords(task.title + ' ' + task.description);
    const snippetText = (snippet.file + ' ' + snippet.description + ' ' + snippet.content).toLowerCase();
    
    for (const keyword of keywords) {
      if (snippetText.includes(keyword.toLowerCase())) {
        score += 0.4;
      }
    }
    
    // Agent-specific contract type preferences
    switch (agentType) {
      case 'SpecWriter':
        if (snippet.type === 'openapi') score += 0.3;
        break;
      case 'Formalizer':
        score += 0.4; // All contract snippets are relevant
        break;
      case 'Architect':
        if (snippet.type === 'openapi') score += 0.3;
        break;
      case 'Coder':
        if (snippet.type === 'openapi' || snippet.type === 'json-schema') score += 0.3;
        break;
      case 'Tester':
        score += 0.2;
        break;
    }
    
    return Math.min(score, 1.0);
  }

  extractKeywords(text: string): string[] {
    // Simple keyword extraction - remove common words and split
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10); // Limit keywords
  }

  getPheromoneTypesForAgent(agentType: AgentType): string[] {
    const baseTypes = ['success', 'failure', 'warning', 'insight'];
    
    switch (agentType) {
      case 'SpecWriter':
        return [...baseTypes, 'specification', 'requirements', 'bdd'];
      case 'Formalizer':
        return [...baseTypes, 'contracts', 'verification', 'formal'];
      case 'Architect':
        return [...baseTypes, 'architecture', 'design', 'patterns'];
      case 'Coder':
        return [...baseTypes, 'implementation', 'bugs', 'performance'];
      case 'Tester':
        return [...baseTypes, 'testing', 'coverage', 'validation'];
      default:
        return baseTypes;
    }
  }

  /**
   * Estimate task complexity based on description and keywords
   */
  estimateTaskComplexity(task: TaskData): 'low' | 'medium' | 'high' {
    const text = (task.title + ' ' + task.description).toLowerCase();
    const keywords = this.extractKeywords(text);
    
    // High complexity indicators
    const highComplexityWords = [
      'architecture', 'design', 'system', 'integration', 'performance', 
      'security', 'scalability', 'distributed', 'microservice', 'database',
      'optimization', 'refactor', 'migration', 'framework', 'api'
    ];
    
    // Medium complexity indicators  
    const mediumComplexityWords = [
      'implement', 'feature', 'component', 'service', 'module',
      'interface', 'class', 'function', 'method', 'algorithm'
    ];
    
    // Low complexity indicators
    const lowComplexityWords = [
      'fix', 'update', 'modify', 'add', 'remove', 'change',
      'style', 'format', 'documentation', 'comment', 'variable'
    ];
    
    let highScore = 0;
    let mediumScore = 0;
    let lowScore = 0;
    
    for (const keyword of keywords) {
      if (highComplexityWords.some(word => keyword.includes(word))) highScore++;
      else if (mediumComplexityWords.some(word => keyword.includes(word))) mediumScore++;
      else if (lowComplexityWords.some(word => keyword.includes(word))) lowScore++;
    }
    
    // Length-based complexity (longer descriptions often indicate more complex tasks)
    const descriptionLength = text.length;
    if (descriptionLength > 500) highScore++;
    else if (descriptionLength > 200) mediumScore++;
    else lowScore++;
    
    // Priority consideration
    if (task.priority === 'high') highScore++;
    else if (task.priority === 'medium') mediumScore++;
    else lowScore++;
    
    // Determine complexity based on scores
    if (highScore >= mediumScore && highScore >= lowScore) return 'high';
    if (mediumScore >= lowScore) return 'medium';
    return 'low';
  }
}