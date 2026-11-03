#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.mjs';
import { TinyUrlClient } from '../cli/client.mjs';
import { loadConfig } from '../cli/config.mjs';

// Initialize Client with multi-tier configuration
const config = loadConfig();
const client = new TinyUrlClient(config);

const server = new McpServer({
  name: 'tinyurl-mcp-server',
  version: '2.0.0'
});

registerTools(server, client);

// Start the stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TinyURL MCP Server running over stdio (JSON-RPC 2.0)');
}

main().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
