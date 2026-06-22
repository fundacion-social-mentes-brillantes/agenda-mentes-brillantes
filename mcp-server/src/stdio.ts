import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./tools.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // En modo stdio no se debe escribir en stdout (lo usa el protocolo).
  console.error("Agenda Mentes Brillantes MCP (stdio) listo.");
}

main().catch((err) => {
  console.error("Fallo al iniciar el servidor MCP:", err);
  process.exit(1);
});
