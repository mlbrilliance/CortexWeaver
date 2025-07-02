import * as fs from 'fs';
import * as path from 'path';

/**
 * EnvTemplates handles environment configuration files
 */
export class EnvTemplates {
  
  static async createEnvTemplate(projectRoot: string): Promise<void> {
    const envTemplatePath = path.join(projectRoot, '.env.example');
    
    const envTemplate = `# CortexWeaver Environment Configuration

# AI Model API Keys
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# GitHub Integration (optional)
GITHUB_TOKEN=your_github_personal_access_token_here

# Neo4j Database Configuration (for MCP)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=cortexweaver

# Optional: Custom model endpoints
# CLAUDE_API_URL=https://api.anthropic.com
# GEMINI_API_URL=https://generativelanguage.googleapis.com

# Debugging and Development
DEBUG=false
LOG_LEVEL=info
`;

    fs.writeFileSync(envTemplatePath, envTemplate);
  }

  static async createGitIgnoreTemplate(projectRoot: string): Promise<void> {
    const gitIgnorePath = path.join(projectRoot, '.gitignore');
    
    if (fs.existsSync(gitIgnorePath)) {
      return; // Don't overwrite existing .gitignore
    }

    const gitIgnoreContent = `# CortexWeaver Project .gitignore

# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
*.tsbuildinfo

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# CortexWeaver specific
.cortex-history/
.cortex-cache/
cognitive-canvas-data/

# Logs
logs/
*.log

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Neo4j data (if running locally)
neo4j-data/
`;

    fs.writeFileSync(gitIgnorePath, gitIgnoreContent);
  }
}
