"""
MCP (Model Context Protocol) server for Voicebox.

Exposes TTS generation as tools that AI assistants (Claude, Cursor, etc.)
can call. Wraps the REST API v1 endpoints.

Run standalone:
    python -m backend.mcp_server --transport sse --port 8001
Or via stdio:
    python -m backend.mcp_server --transport stdio
"""

import argparse
import asyncio
import json
import logging
import os

import httpx
from mcp.server import Server
from mcp.types import TextContent, Tool

logger = logging.getLogger(__name__)

BASE_URL = os.environ.get("VOICEBOX_URL", "http://localhost:8000")
API_KEY = os.environ.get("VOICEBOX_API_KEY", "")

server = Server("voicebox")


def _auth_headers() -> dict[str, str]:
    if API_KEY:
        return {"Authorization": f"Bearer {API_KEY}"}
    return {}


# --- Tools ---

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="generate_speech",
            description=(
                "Generate speech audio from text. Returns a URL to the generated audio file. "
                "Supports multiple TTS models and voices."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The text to convert to speech",
                    },
                    "voice": {
                        "type": "string",
                        "description": "Voice name (e.g. 'rachel', 'af_heart', 'am_adam'). Use list_voices to see options.",
                        "default": "af_heart",
                    },
                    "model": {
                        "type": "string",
                        "description": "TTS model: 'kokoro-82M' (fast), 'qwen-tts-1.7B' (cloning), 'elevenlabs-v2' (cloud)",
                        "default": "kokoro-82M",
                    },
                    "language": {
                        "type": "string",
                        "description": "Language code (en, ja, zh, ko, fr, de, etc.)",
                        "default": "en",
                    },
                    "instruct": {
                        "type": "string",
                        "description": "Voice style instruction (e.g. 'speak slowly with warmth')",
                    },
                },
                "required": ["text"],
            },
        ),
        Tool(
            name="list_voices",
            description="List all available voices across all TTS backends (Kokoro, ElevenLabs, etc.)",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="list_models",
            description="List all TTS models with their status (loaded, downloaded, available)",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        if name == "generate_speech":
            return await _generate_speech(arguments)
        elif name == "list_voices":
            return await _list_voices()
        elif name == "list_models":
            return await _list_models()
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        logger.error(f"Tool {name} failed: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _generate_speech(args: dict) -> list[TextContent]:
    text = args.get("text", "")
    if not text:
        return [TextContent(type="text", text="Error: 'text' is required")]

    payload = {
        "text": text,
        "language": args.get("language", "en"),
        "model_name": args.get("model", "kokoro-82M"),
        "voice_name": args.get("voice", "af_heart"),
    }
    if args.get("instruct"):
        payload["instruct"] = args["instruct"]

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{BASE_URL}/generate",
            json=payload,
            headers=_auth_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

    audio_url = f"{BASE_URL}/audio/{data['id']}"
    duration = data.get("duration", 0)

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "audio_url": audio_url,
            "generation_id": data["id"],
            "duration_seconds": round(duration, 1),
            "text": text[:100],
        }, indent=2),
    )]


async def _list_voices() -> list[TextContent]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{BASE_URL}/api/v1/voices",
            headers=_auth_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

    # Format for readability
    lines = ["Available voices by model:\n"]
    for model, voices in data.get("voices", {}).items():
        lines.append(f"  {model}: {', '.join(voices[:10])}")
        if len(voices) > 10:
            lines.append(f"    ... and {len(voices) - 10} more")
    return [TextContent(type="text", text="\n".join(lines))]


async def _list_models() -> list[TextContent]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{BASE_URL}/api/v1/models",
            headers=_auth_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

    lines = ["TTS Models:\n"]
    for m in data.get("models", []):
        status_parts = []
        if m.get("loaded"):
            status_parts.append("loaded")
        elif m.get("downloaded"):
            status_parts.append("ready")
        elif m.get("is_cloud"):
            status_parts.append("cloud")
        else:
            status_parts.append("not downloaded")
        status = ", ".join(status_parts)
        lines.append(f"  {m['display_name']} ({m['model_name']}): {status}")
    return [TextContent(type="text", text="\n".join(lines))]


# --- Entry point ---

def main():
    parser = argparse.ArgumentParser(description="Voicebox MCP Server")
    parser.add_argument(
        "--transport", choices=["stdio", "sse"], default="sse",
        help="MCP transport (default: sse)",
    )
    parser.add_argument("--port", type=int, default=8001, help="SSE port (default: 8001)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="SSE host")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.transport == "stdio":
        from mcp.server.stdio import stdio_server
        asyncio.run(_run_stdio())
    else:
        _run_sse(args.host, args.port)


async def _run_stdio():
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def _run_sse(host: str, port: int):
    from mcp.server.sse import SseServerTransport
    from starlette.applications import Starlette
    from starlette.routing import Mount, Route
    import uvicorn

    sse_transport = SseServerTransport("/messages/")

    async def handle_sse(request):
        async with sse_transport.connect_sse(
            request.scope, request.receive, request._send
        ) as streams:
            await server.run(
                streams[0], streams[1], server.create_initialization_options()
            )

    async def handle_messages(request):
        await sse_transport.handle_post_message(
            request.scope, request.receive, request._send
        )

    app = Starlette(
        routes=[
            Route("/sse", endpoint=handle_sse),
            Mount("/messages/", app=sse_transport.handle_post_message),
        ],
    )

    logger.info(f"Starting MCP SSE server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
