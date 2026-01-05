#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

// Initialize the Google GenAI client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Default output directory for generated images
const OUTPUT_DIR = process.env.IMAGEN_OUTPUT_DIR || path.join(process.cwd(), "generated-images");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Available aspect ratios
const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

// Available image sizes (only for gemini-3-pro-image-preview)
const IMAGE_SIZES = ["1K", "2K", "4K"];

// Available models
const MODELS = {
  "nano-banana": "gemini-2.5-flash-image",
  "nano-banana-pro": "gemini-3-pro-image-preview",
};

const server = new Server(
  {
    name: "mcp-gemini-imagen",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_image",
        description: `Generate an image from a text prompt using Google Gemini's image generation.

Models available:
- nano-banana (gemini-2.5-flash-image): Fast, efficient, 1024px resolution. Best for high-volume tasks.
- nano-banana-pro (gemini-3-pro-image-preview): Advanced, up to 4K resolution, with thinking mode. Best for professional assets.

Tips for better results:
- Describe the scene narratively, don't just list keywords
- Be specific about lighting, camera angles, and styles
- Use photography terms for photorealistic images
- Specify aspect ratio based on your use case`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The text prompt describing the image to generate. Be descriptive and specific.",
            },
            model: {
              type: "string",
              enum: ["nano-banana", "nano-banana-pro"],
              default: "nano-banana",
              description: "The model to use. nano-banana is faster, nano-banana-pro is higher quality with up to 4K.",
            },
            aspect_ratio: {
              type: "string",
              enum: ASPECT_RATIOS,
              default: "1:1",
              description: "The aspect ratio of the generated image.",
            },
            image_size: {
              type: "string",
              enum: IMAGE_SIZES,
              default: "1K",
              description: "The resolution of the output (only for nano-banana-pro). Options: 1K, 2K, 4K.",
            },
            filename: {
              type: "string",
              description: "Optional filename for the output image (without extension). If not provided, a timestamp-based name will be used.",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "edit_image",
        description: `Edit an existing image using text prompts. Supports:
- Adding/removing elements
- Style transfer
- Inpainting (changing specific parts)
- Combining multiple images

Provide the path to an existing image and describe the changes you want.`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Description of the edit to make. Be specific about what to change and what to preserve.",
            },
            image_path: {
              type: "string",
              description: "Path to the input image file to edit.",
            },
            model: {
              type: "string",
              enum: ["nano-banana", "nano-banana-pro"],
              default: "nano-banana",
              description: "The model to use for editing.",
            },
            aspect_ratio: {
              type: "string",
              enum: ASPECT_RATIOS,
              description: "Optional aspect ratio for the output image.",
            },
            image_size: {
              type: "string",
              enum: IMAGE_SIZES,
              default: "1K",
              description: "The resolution of the output (only for nano-banana-pro).",
            },
            filename: {
              type: "string",
              description: "Optional filename for the output image.",
            },
          },
          required: ["prompt", "image_path"],
        },
      },
      {
        name: "compose_images",
        description: `Combine multiple images into a new composition.

nano-banana supports up to 3 input images.
nano-banana-pro supports up to 14 input images (up to 5 humans, 6 objects).

Great for:
- Product mockups
- Fashion photos (dress on model)
- Creative collages
- Style transfer from multiple references`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Description of how to combine the images. Be specific about which elements from each image to use.",
            },
            image_paths: {
              type: "array",
              items: { type: "string" },
              description: "Array of paths to input images to combine.",
              minItems: 2,
              maxItems: 14,
            },
            model: {
              type: "string",
              enum: ["nano-banana", "nano-banana-pro"],
              default: "nano-banana-pro",
              description: "The model to use. nano-banana-pro recommended for multi-image composition.",
            },
            aspect_ratio: {
              type: "string",
              enum: ASPECT_RATIOS,
              default: "1:1",
              description: "The aspect ratio of the output image.",
            },
            image_size: {
              type: "string",
              enum: IMAGE_SIZES,
              default: "2K",
              description: "The resolution of the output (only for nano-banana-pro).",
            },
            filename: {
              type: "string",
              description: "Optional filename for the output image.",
            },
          },
          required: ["prompt", "image_paths"],
        },
      },
    ],
  };
});

// Helper function to generate a unique filename
function generateFilename(prefix: string = "image"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${timestamp}`;
}

// Helper function to read image as base64
function readImageAsBase64(imagePath: string): { data: string; mimeType: string } {
  const absolutePath = path.resolve(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new McpError(ErrorCode.InvalidParams, `Image file not found: ${absolutePath}`);
  }

  const imageData = fs.readFileSync(absolutePath);
  const base64Data = imageData.toString("base64");

  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  const mimeType = mimeTypes[ext] || "image/png";
  return { data: base64Data, mimeType };
}

// Helper function to save generated image
function saveImage(base64Data: string, filename: string): string {
  const buffer = Buffer.from(base64Data, "base64");
  const outputPath = path.join(OUTPUT_DIR, `${filename}.png`);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_image": {
        const {
          prompt,
          model = "nano-banana",
          aspect_ratio = "1:1",
          image_size = "1K",
          filename,
        } = args as {
          prompt: string;
          model?: string;
          aspect_ratio?: string;
          image_size?: string;
          filename?: string;
        };

        const modelId = MODELS[model as keyof typeof MODELS];
        if (!modelId) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid model: ${model}`);
        }

        // Build the config
        const config: Record<string, unknown> = {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: aspect_ratio,
          },
        };

        // Add image size for pro model
        if (model === "nano-banana-pro" && image_size) {
          (config.imageConfig as Record<string, unknown>).imageSize = image_size;
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config,
        });

        const outputFilename = filename || generateFilename("generated");
        let savedPath = "";
        let textResponse = "";

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.text) {
            textResponse += part.text + "\n";
          } else if (part.inlineData) {
            savedPath = saveImage(part.inlineData.data as string, outputFilename);
          }
        }

        if (!savedPath) {
          throw new McpError(ErrorCode.InternalError, "No image was generated");
        }

        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully!\n\nSaved to: ${savedPath}\n\nModel: ${model} (${modelId})\nAspect ratio: ${aspect_ratio}${model === "nano-banana-pro" ? `\nResolution: ${image_size}` : ""}\n\n${textResponse ? `Model response: ${textResponse}` : ""}`,
            },
          ],
        };
      }

      case "edit_image": {
        const {
          prompt,
          image_path,
          model = "nano-banana",
          aspect_ratio,
          image_size = "1K",
          filename,
        } = args as {
          prompt: string;
          image_path: string;
          model?: string;
          aspect_ratio?: string;
          image_size?: string;
          filename?: string;
        };

        const modelId = MODELS[model as keyof typeof MODELS];
        if (!modelId) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid model: ${model}`);
        }

        const imageData = readImageAsBase64(image_path);

        // Build contents with image and text
        const contents = [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          },
          { text: prompt },
        ];

        // Build the config
        const config: Record<string, unknown> = {
          responseModalities: ["TEXT", "IMAGE"],
        };

        if (aspect_ratio) {
          config.imageConfig = { aspectRatio: aspect_ratio };
          if (model === "nano-banana-pro" && image_size) {
            (config.imageConfig as Record<string, unknown>).imageSize = image_size;
          }
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config,
        });

        const outputFilename = filename || generateFilename("edited");
        let savedPath = "";
        let textResponse = "";

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.text) {
            textResponse += part.text + "\n";
          } else if (part.inlineData) {
            savedPath = saveImage(part.inlineData.data as string, outputFilename);
          }
        }

        if (!savedPath) {
          throw new McpError(ErrorCode.InternalError, "No image was generated");
        }

        return {
          content: [
            {
              type: "text",
              text: `Image edited successfully!\n\nInput: ${image_path}\nSaved to: ${savedPath}\n\nModel: ${model} (${modelId})${aspect_ratio ? `\nAspect ratio: ${aspect_ratio}` : ""}${model === "nano-banana-pro" ? `\nResolution: ${image_size}` : ""}\n\n${textResponse ? `Model response: ${textResponse}` : ""}`,
            },
          ],
        };
      }

      case "compose_images": {
        const {
          prompt,
          image_paths,
          model = "nano-banana-pro",
          aspect_ratio = "1:1",
          image_size = "2K",
          filename,
        } = args as {
          prompt: string;
          image_paths: string[];
          model?: string;
          aspect_ratio?: string;
          image_size?: string;
          filename?: string;
        };

        const modelId = MODELS[model as keyof typeof MODELS];
        if (!modelId) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid model: ${model}`);
        }

        // Check image count limits
        const maxImages = model === "nano-banana-pro" ? 14 : 3;
        if (image_paths.length > maxImages) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `${model} supports up to ${maxImages} input images, got ${image_paths.length}`
          );
        }

        // Build contents with all images and text
        const contents: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

        for (const imagePath of image_paths) {
          const imageData = readImageAsBase64(imagePath);
          contents.push({
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          });
        }

        contents.push({ text: prompt });

        // Build the config
        const config: Record<string, unknown> = {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: aspect_ratio,
          },
        };

        if (model === "nano-banana-pro" && image_size) {
          (config.imageConfig as Record<string, unknown>).imageSize = image_size;
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config,
        });

        const outputFilename = filename || generateFilename("composed");
        let savedPath = "";
        let textResponse = "";

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.text) {
            textResponse += part.text + "\n";
          } else if (part.inlineData) {
            savedPath = saveImage(part.inlineData.data as string, outputFilename);
          }
        }

        if (!savedPath) {
          throw new McpError(ErrorCode.InternalError, "No image was generated");
        }

        return {
          content: [
            {
              type: "text",
              text: `Images composed successfully!\n\nInput images: ${image_paths.length}\nSaved to: ${savedPath}\n\nModel: ${model} (${modelId})\nAspect ratio: ${aspect_ratio}${model === "nano-banana-pro" ? `\nResolution: ${image_size}` : ""}\n\n${textResponse ? `Model response: ${textResponse}` : ""}`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Error generating image: ${message}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Gemini Imagen server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
