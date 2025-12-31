#!/usr/bin/env python3
"""
Test WebSocket connection from React Flow workflow node
Simulates executing the androidDeviceSetup node with remote connection
"""
import requests
import json
import os

def test_android_device_setup_remote():
    """Test Android Device Setup node with remote WebSocket connection"""

    print("Testing Android Device Setup Node - Remote WebSocket")
    print("=" * 60)

    # Workflow execution endpoint
    url = "http://localhost:3010/api/nodes/execute"

    # Simulate androidDeviceSetup node execution with remote connection
    payload = {
        "nodeId": "test_node_001",
        "nodeType": "androidDeviceSetup",
        "parameters": {
            "connection_type": "remote",
            "websocket_url": os.getenv('WEBSOCKET_URL', ''),
            "port": 8888
        },
        "inputs": {},
        "workflow": {
            "nodes": [],
            "edges": []
        }
    }

    print(f"\nSending request to: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")

    try:
        response = requests.post(url, json=payload, timeout=30)

        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body:")
        print(json.dumps(response.json(), indent=2))

        if response.status_code == 200:
            result = response.json()

            if result.get('success'):
                connection_info = result.get('result', {})
                print("\nWebSocket Connection: SUCCESS")
                print(f"  Client ID: {connection_info.get('client_id')}")
                print(f"  Status: {connection_info.get('status')}")
                print(f"  Registered: {connection_info.get('registered')}")
                print(f"  WebSocket URL: {connection_info.get('websocket_url')}")
                print(f"  Message: {connection_info.get('message')}")
                return True
            else:
                print(f"\nWebSocket Connection: FAILED")
                print(f"  Error: {result.get('error')}")
                return False
        else:
            print(f"\nHTTP Request FAILED: {response.status_code}")
            return False

    except requests.exceptions.ConnectionError:
        print("\nERROR: Cannot connect to backend server")
        print("Make sure the Python backend is running on http://localhost:3010")
        return False
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("React Flow Node WebSocket Test")
    print("=" * 60)

    result = test_android_device_setup_remote()

    print("\n" + "=" * 60)
    if result:
        print("Test Result: PASSED")
    else:
        print("Test Result: FAILED")
    print("=" * 60)

    exit(0 if result else 1)
