#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { VALID_LAYOUTS } from "../src/validate.mjs";
import { LAYOUT_DESCRIPTIONS, handleListLayouts, handleGenerateTimeline } from "./handlers.mjs";

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
        "Pass yaml (inline string) or yamlPath (path to a .yaml file). " +
        "Returns HTML (format=html) or a PNG image (format=png). " +
        "PNG requires puppeteer: run `npm install puppeteer` once before use.",
      inputSchema: {
        type: "object",
        properties: {
          yaml: {
            type: "string",
            description:
              "Inline YAML content (historymap format). Mutually exclusive with yamlPath.",
          },
          yamlPath: {
            type: "string",
            description:
              "Absolute path to a .yaml file on disk. Use this for iterative editing workflows to avoid passing large strings. Mutually exclusive with yaml.",
          },
          layout: {
            type: "string",
            enum: VALID_LAYOUTS,
            description:
              `Layout style (overrides the layout field in YAML). One of: ${VALID_LAYOUTS.join(", ")}. ` +
              `Descriptions: ${VALID_LAYOUTS.map((l) => `${l} — ${LAYOUT_DESCRIPTIONS[l]}`).join("; ")}.`,
          },
          format: {
            type: "string",
            enum: ["html", "png"],
            description:
              'Output format. "html" returns the generated HTML string; "png" returns a screenshot. Default: "png".',
          },
          width: {
            type: "number",
            description:
              "Viewport width in pixels for PNG output (default: 1400). Use 1400+ for Japanese text to avoid narrow line wrapping.",
          },
        },
      },
    },
    {
      name: "list_layouts",
      description:
        "List all 10 available timeline layout styles with a short description of when to use each.",
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
