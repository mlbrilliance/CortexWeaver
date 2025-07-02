import * as fsp from 'fs/promises';
import * as path from 'path';
import { CodeFileInfo, FileSearchOptions } from './index';

/**
 * FileAnalyzer handles code file analysis and language detection
 */
export class FileAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze a single code file
   */
  async analyzeCodeFile(
    filePath: string, 
    rootPath: string, 
    includeContent: boolean = false
  ): Promise<CodeFileInfo | null> {
    try {
      const stats = await fsp.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath).toLowerCase();
      const relativePath = path.relative(rootPath, filePath);
      
      // Determine file type
      let type: 'source' | 'test' | 'config' | 'documentation';
      if (basename.includes('test') || basename.includes('spec') || relativePath.includes('/test/') || relativePath.includes('/tests/')) {
        type = 'test';
      } else if (['.md', '.txt', '.rst', '.adoc'].includes(ext)) {
        type = 'documentation';
      } else if (['.json', '.yaml', '.yml', '.toml', '.ini', '.config', '.env'].includes(ext)) {
        type = 'config';
      } else {
        type = 'source';
      }
      
      // Determine language
      const language = this.getLanguageFromExtension(ext);
      
      // Skip files that are too large
      if (stats.size > (1024 * 1024)) { // 1MB
        return null;
      }
      
      let content: string | undefined;
      if (includeContent) {
        const fileContent = await this.readFileContent(filePath);
        content = fileContent ?? undefined;
      }
      
      return {
        path: filePath,
        relativePath,
        type,
        language,
        size: stats.size,
        lastModified: stats.mtime,
        content
      };
    } catch (error) {
      console.warn(`Failed to analyze file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if a file should be included based on options
   */
  shouldIncludeFile(file: CodeFileInfo, options: FileSearchOptions): boolean {
    // Check file type inclusion options
    if (!options.includeTests && file.type === 'test') return false;
    if (!options.includeDocs && file.type === 'documentation') return false;
    if (!options.includeConfig && file.type === 'config') return false;
    
    // Check file size
    if (options.maxFileSize && file.size > options.maxFileSize) return false;
    
    // Check extensions
    if (options.extensions && options.extensions.length > 0) {
      const ext = path.extname(file.path).toLowerCase();
      if (!options.extensions.includes(ext)) return false;
    }
    
    return true;
  }

  /**
   * Read file content safely
   */
  async readFileContent(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
      const stats = await fsp.stat(fullPath);
      
      // Skip files that are too large
      if (stats.size > 1024 * 1024) { // 1MB limit
        console.warn(`File ${filePath} is too large (${stats.size} bytes), skipping content read`);
        return null;
      }
      
      return await fsp.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get language from file extension
   */
  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.vb': 'vbnet',
      '.pl': 'perl',
      '.r': 'r',
      '.m': 'matlab',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.md': 'markdown',
      '.tex': 'latex',
      '.sql': 'sql'
    };
    
    return languageMap[ext] || 'unknown';
  }
}