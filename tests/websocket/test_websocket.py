#!/usr/bin/env python3
"""
Test WebSocket connection for remote Android devices

Before running, set environment variables:
  export WEBSOCKET_API_KEY=your-web-api-key
  export ANDROID_API_KEY=your-android-api-key (optional, for bidirectional test)
  export WEBSOCKET_URL=ws://your-relay-server.com/ws
"""
import asyncio
import json
import os
import sys
import aiohttp

# Load from environment - NO FALLBACK
WEBSOCKET_API_KEY = os.getenv('WEBSOCKET_API_KEY')
ANDROID_API_KEY = os.getenv('ANDROID_API_KEY')
WEBSOCKET_URL = os.getenv('WEBSOCKET_URL', '')

if not WEBSOCKET_API_KEY:
    print("ERROR: WEBSOCKET_API_KEY environment variable not set")
    print("Usage: WEBSOCKET_API_KEY=your-key python test_websocket.py")
    sys.exit(1)

async def test_health_endpoint():
    """Test the WebSocket health endpoint"""
    base = WEBSOCKET_URL.replace('ws://', 'http://').replace('wss://', 'https://').rstrip('/ws')
    url = f"{base}/ws-health"
    print(f"\nTesting health endpoint: {url}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                print(f"Status: {response.status}")
                content = await response.text()
                print(f"Response: {content}")

                if response.status == 200:
                    print("Health check: PASSED")
                    return True
                else:
                    print("Health check: FAILED")
                    return False
    except Exception as e:
        print(f"Health check error: {e}")
        return False

async def test_stats_endpoint():
    """Test the WebSocket stats endpoint"""
    base = WEBSOCKET_URL.replace('ws://', 'http://').replace('wss://', 'https://').rstrip('/ws')
    url = f"{base}/ws-stats"
    print(f"\nTesting stats endpoint: {url}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                print(f"Status: {response.status}")
                content = await response.text()
                print(f"Response: {content}")

                if response.status == 200:
                    print("Stats check: PASSED")
                    return True
                else:
                    print("Stats check: FAILED")
                    return False
    except Exception as e:
        print(f"Stats check error: {e}")
        return False

async def test_websocket_connection():
    """Test WebSocket connection with API key authentication"""
    url = WEBSOCKET_URL
    web_api_key = WEBSOCKET_API_KEY

    print(f"\nTesting WebSocket connection: {url}")
    print(f"Using Web API Key: {web_api_key[:20]}...")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(url, timeout=10) as ws:
                print("WebSocket connection: ESTABLISHED")

                # Wait for initial "connected" message
                try:
                    msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        print(f"Received welcome: {data}")

                        if data.get('type') != 'connected':
                            print("Unexpected welcome message")
                            return False
                except asyncio.TimeoutError:
                    print("No welcome message received")
                    return False

                # Now send registration with API key
                register_message = {
                    "type": "register",
                    "clientType": "web",
                    "clientId": "test_client_001",
                    "apiKey": web_api_key
                }
                await ws.send_json(register_message)
                print(f"Sent registration: {register_message}")

                # Wait for registration response
                try:
                    msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
                    print(f"Received: {msg.data}")

                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        print(f"Parsed response: {data}")

                        if data.get('type') == 'registered':
                            print("Registration: SUCCESS")
                            print(f"Client ID: {data.get('clientId')}")

                            # Test sending data message
                            data_message = {
                                "type": "data",
                                "payload": {
                                    "action": "test",
                                    "timestamp": asyncio.get_event_loop().time()
                                }
                            }
                            await ws.send_json(data_message)
                            print(f"Sent data message: {data_message}")

                            # Wait for any response (timeout is expected if no Android client)
                            try:
                                msg2 = await asyncio.wait_for(ws.receive(), timeout=3.0)
                                if msg2.type == aiohttp.WSMsgType.TEXT:
                                    response = json.loads(msg2.data)
                                    print(f"Response to data: {response}")
                            except asyncio.TimeoutError:
                                print("No response to data message (expected - no Android clients)")

                            # Test ping/pong
                            ping_message = {"type": "ping"}
                            await ws.send_json(ping_message)
                            print(f"Sent ping: {ping_message}")

                            try:
                                msg3 = await asyncio.wait_for(ws.receive(), timeout=3.0)
                                if msg3.type == aiohttp.WSMsgType.TEXT:
                                    pong = json.loads(msg3.data)
                                    print(f"Received pong: {pong}")
                                    if pong.get('type') == 'pong':
                                        print("Ping/Pong: SUCCESS")
                            except asyncio.TimeoutError:
                                print("No pong response")

                            print("WebSocket test: PASSED")
                            return True
                        elif data.get('type') == 'error':
                            print(f"Registration FAILED: {data.get('message')}")
                            print("WebSocket test: FAILED")
                            return False

                except asyncio.TimeoutError:
                    print("No registration response received (timeout)")
                    print("WebSocket test: FAILED")
                    return False

    except aiohttp.ClientConnectorError as e:
        print(f"Connection error: {e}")
        return False
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_android_to_web_flow():
    """Test Android -> WebSocket -> Web bidirectional data flow"""
    url = WEBSOCKET_URL
    web_api_key = WEBSOCKET_API_KEY
    android_api_key = ANDROID_API_KEY

    if not android_api_key:
        print(f"\nSkipping Android -> WebSocket -> Web bidirectional flow test")
        print("ANDROID_API_KEY not set in environment")
        return True  # Don't fail, just skip

    print(f"\nTesting Android -> WebSocket -> Web bidirectional flow")
    print("=" * 60)

    try:
        async with aiohttp.ClientSession() as session:
            # Step 1: Connect Web client
            print("\n[WEB] Connecting...")
            web_ws = await session.ws_connect(url, timeout=10)
            msg = await asyncio.wait_for(web_ws.receive(), timeout=5.0)
            print(f"[WEB] {json.loads(msg.data).get('message')}")

            # Register Web client
            await web_ws.send_json({
                "type": "register",
                "clientType": "web",
                "clientId": "test_web_001",
                "apiKey": web_api_key
            })

            msg = await asyncio.wait_for(web_ws.receive(), timeout=5.0)
            web_reg = json.loads(msg.data)
            if web_reg.get('type') != 'registered':
                print(f"[WEB] Registration FAILED: {web_reg}")
                return False
            print(f"[WEB] Registered as: {web_reg.get('clientId')}")

            # Step 2: Connect Android client
            print("\n[ANDROID] Connecting...")
            android_ws = await session.ws_connect(url, timeout=10)
            msg = await asyncio.wait_for(android_ws.receive(), timeout=5.0)
            print(f"[ANDROID] {json.loads(msg.data).get('message')}")

            # Register Android client
            await android_ws.send_json({
                "type": "register",
                "clientType": "android",
                "clientId": "test_android_001",
                "apiKey": android_api_key
            })

            msg = await asyncio.wait_for(android_ws.receive(), timeout=5.0)
            android_reg = json.loads(msg.data)
            if android_reg.get('type') != 'registered':
                print(f"[ANDROID] Registration FAILED: {android_reg}")
                return False
            print(f"[ANDROID] Registered as: {android_reg.get('clientId')}")

            # Web should receive join notification
            try:
                msg = await asyncio.wait_for(web_ws.receive(), timeout=3.0)
                notif = json.loads(msg.data)
                if notif.get('type') == 'client_joined':
                    print(f"[WEB] Notification: Android client {notif.get('clientId')} joined")
            except asyncio.TimeoutError:
                pass

            # Step 3: Android sends battery data broadcast
            print("\n[ANDROID] Broadcasting battery status...")
            await android_ws.send_json({
                "type": "data",
                "payload": {
                    "service": "battery",
                    "level": 85,
                    "charging": True
                }
            })

            msg = await asyncio.wait_for(web_ws.receive(), timeout=5.0)
            data = json.loads(msg.data)
            if data.get('type') == 'data' and data.get('fromType') == 'android':
                print(f"[WEB] Received from Android: {data.get('payload')}")
            else:
                print(f"[WEB] Unexpected message: {data}")
                return False

            # Step 4: Web sends targeted command to Android
            print("\n[WEB] Sending targeted command to Android...")
            await web_ws.send_json({
                "type": "data",
                "targetId": "test_android_001",
                "payload": {"action": "get_location"}
            })

            msg = await asyncio.wait_for(android_ws.receive(), timeout=5.0)
            cmd = json.loads(msg.data)
            if cmd.get('type') == 'data' and cmd.get('fromType') == 'web':
                print(f"[ANDROID] Received command: {cmd.get('payload')}")
            else:
                print(f"[ANDROID] Unexpected message: {cmd}")
                return False

            # Step 5: Android responds with location
            print("\n[ANDROID] Sending location response...")
            await android_ws.send_json({
                "type": "data",
                "targetId": "test_web_001",
                "payload": {
                    "service": "location",
                    "lat": 37.7749,
                    "lng": -122.4194
                }
            })

            msg = await asyncio.wait_for(web_ws.receive(), timeout=5.0)
            loc = json.loads(msg.data)
            if loc.get('type') == 'data' and loc.get('fromType') == 'android':
                payload = loc.get('payload')
                print(f"[WEB] Received location: {payload.get('lat')}, {payload.get('lng')}")
                print("\nBidirectional flow test: PASSED")
                await web_ws.close()
                await android_ws.close()
                return True

            await web_ws.close()
            await android_ws.close()
            return False

    except Exception as e:
        print(f"Flow test error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    print("=" * 60)
    print("WebSocket Connection Test for Remote Android Devices")
    print("=" * 60)

    results = {
        "health": await test_health_endpoint(),
        "stats": await test_stats_endpoint(),
        "websocket": await test_websocket_connection(),
        "android_web_flow": await test_android_to_web_flow()
    }

    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"{test_name.upper()}: {status}")

    all_passed = all(results.values())
    print("\n" + "=" * 60)
    if all_passed:
        print("Overall: ALL TESTS PASSED")
    else:
        print("Overall: SOME TESTS FAILED")
    print("=" * 60)

    return all_passed

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        exit(1)
