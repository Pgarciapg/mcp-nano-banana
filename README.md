# MCP Nano Banana

An MCP (Model Context Protocol) server that exposes Google Gemini's image generation capabilities (Nano Banana / Nano Banana Pro) as tools that Claude can use.

## Installation

```bash
git clone https://github.com/Pgarciapg/mcp-nano-banana.git
cd mcp-nano-banana
npm install
npm run build
```

## Features

- **Text-to-Image Generation**: Generate images from text prompts
- **Image Editing**: Edit existing images using natural language
- **Image Composition**: Combine multiple images into new compositions
- **Two Models Available**:
  - `nano-banana` (gemini-2.5-flash-image): Fast, efficient, 1024px resolution
  - `nano-banana-pro` (gemini-3-pro-image-preview): Advanced, up to 4K, with thinking mode

## Setup

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create or select a project
3. Generate an API key

### 2. Set Your API Key

Add your Gemini API key to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Then reload your shell:
```bash
source ~/.zshrc
```

### 3. Configure Claude Code

Add the server to Claude Code's MCP config. Edit `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "gemini-imagen": {
      "command": "node",
      "args": ["/path/to/mcp-nano-banana/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "IMAGEN_OUTPUT_DIR": "/path/to/output/folder"
      }
    }
  }
}
```

### 4. Restart Claude Code

After configuring, restart Claude Code to load the new MCP server.

## Available Tools

### `generate_image`

Generate an image from a text prompt.

**Parameters:**
- `prompt` (required): Text description of the image to generate
- `model`: `nano-banana` (default) or `nano-banana-pro`
- `aspect_ratio`: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`
- `image_size`: `1K`, `2K`, `4K` (only for nano-banana-pro)
- `filename`: Optional output filename

### `edit_image`

Edit an existing image using text prompts.

**Parameters:**
- `prompt` (required): Description of the edit to make
- `image_path` (required): Path to the input image
- `model`: Model to use for editing
- `aspect_ratio`: Optional aspect ratio for output
- `image_size`: Resolution (only for nano-banana-pro)
- `filename`: Optional output filename

### `compose_images`

Combine multiple images into a new composition.

**Parameters:**
- `prompt` (required): How to combine the images
- `image_paths` (required): Array of paths to input images
- `model`: Model to use (nano-banana-pro recommended)
- `aspect_ratio`: Aspect ratio for output
- `image_size`: Resolution (only for nano-banana-pro)
- `filename`: Optional output filename

## Usage Examples

### Generate a simple image

```
"Generate an image of a sunset over mountains with a cabin in the foreground"
```

### Edit an existing image

```
"Add a wizard hat to the cat in this image" + provide image_path
```

### Combine multiple images

```
"Put the dress from the first image on the model from the second image" + provide image_paths array
```

## Prompting Tips

1. **Be Descriptive**: Describe scenes narratively, not as keyword lists
2. **Specify Style**: Use photography terms for photorealistic images (lens type, lighting, angles)
3. **Include Details**: Mention colors, textures, lighting, and mood
4. **Use Templates**: For specific styles (product photos, logos, etc.), follow proven templates

## Environment Variables

- `GEMINI_API_KEY` (required): Your Google Gemini API key
- `IMAGEN_OUTPUT_DIR` (optional): Directory for generated images (defaults to `./generated-images`)

## License

MIT
