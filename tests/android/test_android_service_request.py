#!/usr/bin/env python3
"""
Test Android Service Request-Response Pattern
Demonstrates how Android device only responds to specific service requests

Before running: export WEBSOCKET_API_KEY=your-key
"""
import asyncio
import json
import os
import sys
import aiohttp
from aiohttp import ClientWSTimeout

# Load from environment - NO FALLBACK
WEBSOCKET_API_KEY = os.getenv('WEBSOCKET_API_KEY')
WEBSOCKET_URL = os.getenv('WEBSOCKET_URL', '')

if not WEBSOCKET_API_KEY:
    print("ERROR: WEBSOCKET_API_KEY environment variable not set")
    print("Usage: WEBSOCKET_API_KEY=your-key python test_android_service_request.py")
    sys.exit(1)

async def test_service_request():
    """Test requesting specific services from Android device"""

    print("=" * 60)
    print("Android Service Request-Response Test")
    print("=" * 60)

    # Configuration
    url = WEBSOCKET_URL
    web_api_key = WEBSOCKET_API_KEY
    web_client_id = "test_web_requester"

    # Connect as Web client
    print("\n[Web Client] Connecting...")
    session = aiohttp.ClientSession()
    ws = await session.ws_connect(url, timeout=ClientWSTimeout(ws_close=10.0))

    # Wait for welcome
    msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
    welcome = json.loads(msg.data)
    print(f"[Web Client] {welcome.get('message')}")

    # Register
    await ws.send_json({
        "type": "register",
        "clientType": "web",
        "clientId": web_client_id,
        "apiKey": web_api_key
    })

    msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
    register_response = json.loads(msg.data)
    print(f"[Web Client] Registered: {register_response.get('type')}")

    # Request battery status from Android device
    print("\n[Web Client] Requesting battery status from Android device...")
    await ws.send_json({
        "type": "data",
        "payload": {
            "action": "get_battery_status",
            "service": "batteryMonitor"
        }
    })

    # Wait for response from Android
    print("[Web Client] Waiting for Android response...")
    try:
        msg = await asyncio.wait_for(ws.receive(), timeout=10.0)
        if msg.type == aiohttp.WSMsgType.TEXT:
            response = json.loads(msg.data)
            print(f"\n[Web Client] Received response:")
            print(json.dumps(response, indent=2))

            if response.get('type') == 'data':
                payload = response.get('payload', {})
                data = payload.get('data', {})
                print(f"\n[Android Response]")
                print(f"  Service: {payload.get('service')}")
                print(f"  Battery Level: {data.get('level')}%")
                print(f"  Charging: {data.get('charging')}")
                print(f"  Temperature: {data.get('temperature')}°C")
                print(f"  Health: {data.get('health')}")
    except asyncio.TimeoutError:
        print("[Web Client] No response from Android device (timeout)")
        print("Make sure Android simulator is running")

    # Request location data
    print("\n[Web Client] Requesting location from Android device...")
    await ws.send_json({
        "type": "data",
        "payload": {
            "action": "get_location",
            "service": "location"
        }
    })

    # Wait for response
    print("[Web Client] Waiting for Android response...")
    try:
        msg = await asyncio.wait_for(ws.receive(), timeout=10.0)
        if msg.type == aiohttp.WSMsgType.TEXT:
            response = json.loads(msg.data)

            if response.get('type') == 'data':
                payload = response.get('payload', {})
                data = payload.get('data', {})
                print(f"\n[Android Response]")
                print(f"  Service: {payload.get('service')}")
                print(f"  Latitude: {data.get('latitude')}")
                print(f"  Longitude: {data.get('longitude')}")
                print(f"  Accuracy: {data.get('accuracy')}m")
                print(f"  Provider: {data.get('provider')}")
    except asyncio.TimeoutError:
        print("[Web Client] No response from Android device (timeout)")

    # Disconnect
    await ws.close()
    await session.close()

    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    try:
        asyncio.run(test_service_request())
    except KeyboardInterrupt:
        print("\n\nTest stopped by user")
