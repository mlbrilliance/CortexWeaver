import * as fs from 'fs';
import * as path from 'path';

/**
 * DockerBaseTemplates handles basic Docker files like Dockerfile and .dockerignore
 */
export class DockerBaseTemplates {
  
  static async createDockerfile(projectRoot: string): Promise<void> {
    const dockerfilePath = path.join(projectRoot, 'Dockerfile');
    
    if (fs.existsSync(dockerfilePath)) {
      return; // Don't overwrite existing Dockerfile
    }

    const dockerfileContent = `# CortexWeaver Project Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S cortexweaver && \\
    adduser -S cortexweaver -u 1001

# Change ownership of the app directory
RUN chown -R cortexweaver:cortexweaver /app

# Switch to non-root user
USER cortexweaver

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
`;

    fs.writeFileSync(dockerfilePath, dockerfileContent);
  }

  static async createDockerIgnore(projectRoot: string): Promise<void> {
    const dockerIgnorePath = path.join(projectRoot, '.dockerignore');
    
    if (fs.existsSync(dockerIgnorePath)) {
      return; // Don't overwrite existing .dockerignore
    }

    const dockerIgnoreContent = `# CortexWeaver Docker ignore file

# Git
.git
.gitignore

# Documentation
README.md
docs/

# Development files
.env.example
.env.local
.env.development.local

# Node modules (will be installed in container)
node_modules/
npm-debug.log*

# Build artifacts
dist/
build/

# IDE files
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Test files
coverage/
.nyc_output

# CortexWeaver specific
.cortex-history/
.cortex-cache/
prototypes/
`;

    fs.writeFileSync(dockerIgnorePath, dockerIgnoreContent);
  }

  static async createDockerfileDev(projectRoot: string): Promise<void> {
    const dockerfileDevPath = path.join(projectRoot, 'Dockerfile.dev');
    
    if (fs.existsSync(dockerfileDevPath)) {
      return; // Don't overwrite existing development Dockerfile
    }

    const dockerfileDevContent = `# Development Dockerfile for CortexWeaver
FROM node:18-alpine

# Install development tools
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Create non-root user for development
RUN addgroup -g 1001 -S cortexweaver && \\
    adduser -S cortexweaver -u 1001

# Change ownership of the app directory
RUN chown -R cortexweaver:cortexweaver /app

# Switch to non-root user
USER cortexweaver

# Expose port and debugging port
EXPOSE 3000 9229

# Development command with hot reload and debugging
CMD ["npm", "run", "dev"]
`;

    fs.writeFileSync(dockerfileDevPath, dockerfileDevContent);
  }
}
