import * as fs from 'fs';
import * as path from 'path';

/**
 * DockerComposeTemplates handles Docker Compose configurations
 */
export class DockerComposeTemplates {
  
  static async createDockerCompose(projectRoot: string): Promise<void> {
    const dockerComposePath = path.join(projectRoot, 'docker-compose.yml');
    
    if (fs.existsSync(dockerComposePath)) {
      return; // Don't overwrite existing docker-compose
    }

    const dockerComposeContent = `version: '3.8'

services:
  neo4j:
    image: neo4j:5.15
    container_name: cortexweaver-neo4j
    environment:
      NEO4J_AUTH: neo4j/cortexweaver
      NEO4J_dbms_memory_heap_initial__size: 512m
      NEO4J_dbms_memory_heap_max__size: 1G
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    restart: unless-stopped

  mcp-neo4j-memory:
    image: mcpneo4j/memory:latest
    container_name: cortexweaver-mcp-neo4j
    environment:
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USERNAME: neo4j
      NEO4J_PASSWORD: cortexweaver
    depends_on:
      - neo4j
    restart: unless-stopped

  github-mcp-server:
    image: ghcr.io/github/github-mcp-server:latest
    container_name: cortexweaver-github-mcp
    environment:
      GITHUB_PERSONAL_ACCESS_TOKEN: \${GITHUB_TOKEN}
      GITHUB_TOOLSETS: "context,repos,issues,pull_requests,actions,code_security"
      GITHUB_READ_ONLY: "1"
      GITHUB_DYNAMIC_TOOLSETS: "1"
    restart: unless-stopped

volumes:
  neo4j_data:
  neo4j_logs:
`;

    fs.writeFileSync(dockerComposePath, dockerComposeContent);
  }

  static async createDockerComposeOverride(projectRoot: string): Promise<void> {
    const dockerComposeOverridePath = path.join(projectRoot, 'docker-compose.override.yml');
    
    if (fs.existsSync(dockerComposeOverridePath)) {
      return; // Don't overwrite existing override
    }

    const dockerComposeOverrideContent = `# Docker Compose override for development
# This file is automatically loaded by docker-compose
# Use it for development-specific configurations

version: '3.8'

services:
  neo4j:
    # Development-specific Neo4j configuration
    environment:
      NEO4J_dbms_logs_debug_level: DEBUG
    volumes:
      - ./neo4j-dev-data:/data
      - ./neo4j-dev-logs:/logs

  # Add your application service for development
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src:ro
      - ./package.json:/app/package.json:ro
      - ./package-lock.json:/app/package-lock.json:ro
    ports:
      - "3000:3000"
      - "9229:9229"  # Node.js debugging port
    environment:
      NODE_ENV: development
      DEBUG: "cortexweaver:*"
    depends_on:
      - neo4j
    command: npm run dev

  # Development database admin interface
  neo4j-admin:
    image: neo4j:5.15
    container_name: cortexweaver-neo4j-admin
    environment:
      NEO4J_AUTH: none
    ports:
      - "7475:7474"
    volumes:
      - neo4j_data:/data:ro
    profiles:
      - admin
`;

    fs.writeFileSync(dockerComposeOverridePath, dockerComposeOverrideContent);
  }
}
