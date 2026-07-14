#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { VALID_LAYOUTS } from "../src/validate.mjs";
import { handleListLayouts, handleGenerateTimeline } from "./handlers.mjs";

const server = new Server(
  { name: "historymap", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_timeline",
      description:
        "Generate a timeline or roadmap visualization from YAML data. " +
        "Returns the result as an HTML string (format=html) or a PNG image (format=png). " +
        "PNG output requires puppeteer to be installed (`npm install puppeteer`).",
      inputSchema: {
        type: "object",
        properties: {
          yaml: {
            type: "string",
            description:
              "YAML content in historymap data.yaml format (title, items[], optional layout/theme).",
          },
          layout: {
            type: "string",
            enum: VALID_LAYOUTS,
            description: `Layout style. One of: ${VALID_LAYOUTS.join(", ")}. Defaults to the value set in the YAML, or "zigzag".`,
          },
          format: {
            type: "string",
            enum: ["html", "png"],
            description:
              'Output format. "html" returns the generated HTML; "png" returns a screenshot image. Default: "png".',
          },
          width: {
            type: "number",
            description:
              "Viewport width in pixels for PNG output (default: 1200).",
          },
        },
        required: ["yaml"],
      },
    },
    {
      name: "list_layouts",
      description: "List all available timeline layout styles.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_layouts") return handleListLayouts();
  if (name === "generate_timeline") return handleGenerateTimeline(args);

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
