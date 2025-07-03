import * as fs from 'fs';
import * as path from 'path';

/**
 * MCPTemplates handles the creation of MCP server configuration files
 */
export class MCPTemplates {
  
  static async createMCPConfig(projectRoot: string): Promise<void> {
    const mcpConfigPath = path.join(projectRoot, '.mcp.json');
    
    // Only create if it doesn't exist
    if (!fs.existsSync(mcpConfigPath)) {
      const mcpConfig = this.createDefaultMCPConfig();
      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    }
  }

  private static createDefaultMCPConfig(): any {
    return {
      "mcpServers": {
        "neo4j-memory": {
          "command": "docker",
          "args": [
            "run", "--rm", "-i",
            "--network", "host",
            "--env", "NEO4J_URI=bolt://localhost:7687",
            "--env", "NEO4J_USERNAME=neo4j",
            "--env", "NEO4J_PASSWORD=cortexweaver",
            "mcp/memory:latest"
          ],
          "env": {
            "NEO4J_URI": "bolt://localhost:7687",
            "NEO4J_USERNAME": "neo4j", 
            "NEO4J_PASSWORD": "cortexweaver"
          },
          "description": "Neo4j MCP server for CortexWeaver cognitive canvas"
        },
        "github": {
          "command": "docker",
          "args": [
            "run", "--rm", "-i",
            "--network", "host",
            "--env", "GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_TOKEN}",
            "--env", "GITHUB_TOOLSETS=context,repos,issues,pull_requests,actions,code_security",
            "--env", "GITHUB_READ_ONLY=1",
            "--env", "GITHUB_DYNAMIC_TOOLSETS=1",
            "mcp/github:latest"
          ],
          "env": {
            "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}",
            "GITHUB_TOOLSETS": "context,repos,issues,pull_requests,actions,code_security",
            "GITHUB_READ_ONLY": "1",
            "GITHUB_DYNAMIC_TOOLSETS": "1"
          },
          "description": "GitHub MCP server for repository operations"
        },
        "filesystem": {
          "command": "npx",
          "args": [
            "@modelcontextprotocol/server-filesystem",
            "${PROJECT_ROOT}"
          ],
          "env": {
            "PROJECT_ROOT": "${PROJECT_ROOT}"
          },
          "description": "Filesystem MCP server for file operations"
        }
      },
      "cortexweaver": {
        "cognitive_canvas": {
          "enabled": true,
          "storage_provider": "neo4j-memory",
          "pheromone_decay": 0.95,
          "memory_consolidation": true
        },
        "agent_communication": {
          "enabled": true,
          "channels": ["neo4j-memory"],
          "persistence": true
        },
        "project_integration": {
          "github_enabled": true,
          "filesystem_enabled": true
        }
      }
    };
  }

  static async validateMCPConfig(projectRoot: string): Promise<boolean> {
    const mcpConfigPath = path.join(projectRoot, '.mcp.json');
    
    if (!fs.existsSync(mcpConfigPath)) {
      return false;
    }

    try {
      const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Basic validation
      return !!(config.mcpServers && typeof config.mcpServers === 'object');
    } catch (error) {
      return false;
    }
  }

  static async getMCPConfig(projectRoot: string): Promise<any> {
    const mcpConfigPath = path.join(projectRoot, '.mcp.json');
    
    if (!fs.existsSync(mcpConfigPath)) {
      throw new Error('.mcp.json configuration file not found. Run "cortex-weaver init" to create it.');
    }

    try {
      const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      throw new Error(`Failed to parse .mcp.json: ${(error as Error).message}`);
    }
  }
}