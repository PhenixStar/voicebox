# Phase 08 — MCP Server

## Overview
- **Priority:** Medium
- **Status:** Pending
- **Effort:** M (16h)
- **Depends on:** Phase 07 (REST API v1 must exist for MCP to wrap)

## Key Insights

MCP (Model Context Protocol) enables AI tools (Claude, Cursor, etc.) to use Voicebox as a voice generation tool. Very few TTS tools expose MCP — this is a differentiator.

**Design:** Thin Python MCP server using `mcp` SDK that wraps REST API v1 endpoints. Runs as sidecar process in same Docker container or as standalone script.

**Transport:** SSE (Server-Sent Events) for remote access. stdio for local-only.

## MVP Tool Surface (3 tools)

```
generate_speech(text, voice?, model?, language?, format?)
  → Returns audio URL or base64 audio data

list_voices()
  → Returns catalog of all voices across all backends

list_models()
  → Returns model status (loaded/downloaded/available)
```

## Related Code Files

### Create
- `repo/modded/backend/mcp_server.py` — MCP server implementation
- `repo/modded/backend/mcp_tools.py` — Tool definitions wrapping REST API

### Modify
- `Dockerfile` — Add MCP server process to supervisord (optional)
- `docker-compose.yml` — Expose MCP port if using SSE transport

## Implementation Steps

1. **Install MCP SDK:**
   ```
   pip install mcp
   ```

2. **Implement MCP server:**
   ```python
   from mcp.server import Server
   from mcp.types import Tool, TextContent
   import httpx

   server = Server("voicebox")
   BASE_URL = "http://localhost:8080"

   @server.tool()
   async def generate_speech(
       text: str,
       voice: str = "rachel",
       model: str = "elevenlabs-v2",
       language: str = "en",
   ) -> list[TextContent]:
       """Generate speech audio from text."""
       async with httpx.AsyncClient() as client:
           resp = await client.post(f"{BASE_URL}/api/v1/generate", json={...})
           data = resp.json()
           return [TextContent(type="text", text=f"Audio: {data['audio_path']}")]

   @server.tool()
   async def list_voices() -> list[TextContent]:
       """List all available voices across all TTS backends."""
       ...

   @server.tool()
   async def list_models() -> list[TextContent]:
       """List TTS models and their status."""
       ...
   ```

3. **SSE transport for remote access:**
   ```python
   from mcp.server.sse import SseServerTransport
   from starlette.applications import Starlette

   transport = SseServerTransport("/mcp/messages")
   app = Starlette(routes=[...])
   ```

4. **Add to Docker supervisord config** as optional process.

5. **Test with Claude Desktop:**
   ```json
   {
     "mcpServers": {
       "voicebox": {
         "url": "http://voice.nulled.ai/mcp/sse"
       }
     }
   }
   ```

## Todo List
- [ ] Install `mcp` SDK
- [ ] Implement `generate_speech` tool
- [ ] Implement `list_voices` tool
- [ ] Implement `list_models` tool
- [ ] Set up SSE transport
- [ ] Test with Claude Desktop or MCP inspector
- [ ] Add to Docker supervisord (optional)
- [ ] Document MCP connection instructions

## Success Criteria
- Claude Desktop can connect to Voicebox MCP server
- `generate_speech` tool produces valid audio
- `list_voices` returns all voices from all backends
- Server handles concurrent requests without blocking

## Risk Assessment
- **Low:** MCP is stateless wrapper over REST — minimal new logic
- **Medium:** SSE transport through nginx requires `proxy_buffering off` config
