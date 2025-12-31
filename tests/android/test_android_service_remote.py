#!/usr/bin/env python3
"""
Test Android Service Nodes with Remote WebSocket Connection
Tests that Android service nodes use WebSocket when remote device is configured
"""
import requests
import json
import time
import os

def test_android_device_setup():
    """Step 1: Setup remote Android device connection"""
    print("=" * 60)
    print("Step 1: Android Device Setup (Remote WebSocket)")
    print("=" * 60)

    url = "http://localhost:3010/api/nodes/execute"
    payload = {
        "nodeId": "android_device_001",
        "nodeType": "androidDeviceSetup",
        "parameters": {
            "connection_type": "remote",
            "websocket_url": os.getenv('WEBSOCKET_URL', ''),
            "port": 8888
        },
        "inputs": {},
        "workflow": {"nodes": [], "edges": []}
    }

    try:
        response = requests.post(url, json=payload, timeout=10)

        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("\nDevice Setup: SUCCESS")
                print(f"  Connection Type: {result['result'].get('connection_type')}")
                print(f"  WebSocket URL: {result['result'].get('websocket_url')}")
                print(f"  Client ID: {result['result'].get('client_id')}")
                print(f"  Status: {result['result'].get('status')}")
                return True
            else:
                print(f"\nDevice Setup: FAILED - {result.get('error')}")
                return False
        else:
            print(f"\nDevice Setup: HTTP {response.status_code}")
            return False

    except Exception as e:
        print(f"\nDevice Setup: ERROR - {e}")
        return False


def test_battery_monitor_service():
    """Step 2: Test Battery Monitor service via WebSocket"""
    print("\n" + "=" * 60)
    print("Step 2: Battery Monitor Service (via WebSocket)")
    print("=" * 60)

    url = "http://localhost:3010/api/nodes/execute"
    payload = {
        "nodeId": "battery_node_001",
        "nodeType": "batteryMonitor",
        "parameters": {
            "service_id": "battery",
            "action": "status",
            "parameters": {}
        },
        "inputs": {},
        "workflow": {"nodes": [], "edges": []}
    }

    try:
        response = requests.post(url, json=payload, timeout=15)

        if response.status_code == 200:
            result = response.json()
            print(f"\nResponse:")
            print(json.dumps(result, indent=2))

            if result.get('success'):
                service_result = result.get('result', {})
                data = service_result.get('data', {})

                print("\nBattery Monitor: SUCCESS")
                print(f"  Connection Type: {service_result.get('connection_type')}")
                print(f"  Battery Level: {data.get('level')}%")
                print(f"  Charging: {data.get('charging')}")
                print(f"  Temperature: {data.get('temperature')}°C")
                print(f"  Health: {data.get('health')}")

                if service_result.get('connection_type') == 'remote_websocket':
                    print("\n[OK] Service used WebSocket connection!")
                    return True
                else:
                    print("\n[ERROR] Service did NOT use WebSocket connection")
                    return False
            else:
                print(f"\nBattery Monitor: FAILED - {result.get('error')}")
                return False
        else:
            print(f"\nBattery Monitor: HTTP {response.status_code}")
            print(response.text)
            return False

    except Exception as e:
        print(f"\nBattery Monitor: ERROR - {e}")
        import traceback
        traceback.print_exc()
        return False


def test_location_service():
    """Step 3: Test Location service via WebSocket"""
    print("\n" + "=" * 60)
    print("Step 3: Location Service (via WebSocket)")
    print("=" * 60)

    url = "http://localhost:3010/api/nodes/execute"
    payload = {
        "nodeId": "location_node_001",
        "nodeType": "location",
        "parameters": {
            "service_id": "location",
            "action": "current",
            "parameters": {}
        },
        "inputs": {},
        "workflow": {"nodes": [], "edges": []}
    }

    try:
        response = requests.post(url, json=payload, timeout=15)

        if response.status_code == 200:
            result = response.json()

            if result.get('success'):
                service_result = result.get('result', {})
                data = service_result.get('data', {})

                print("\nLocation Service: SUCCESS")
                print(f"  Connection Type: {service_result.get('connection_type')}")
                print(f"  Latitude: {data.get('latitude')}")
                print(f"  Longitude: {data.get('longitude')}")
                print(f"  Accuracy: {data.get('accuracy')}m")
                print(f"  Provider: {data.get('provider')}")

                if service_result.get('connection_type') == 'remote_websocket':
                    print("\n[OK] Service used WebSocket connection!")
                    return True
                else:
                    print("\n[ERROR] Service did NOT use WebSocket connection")
                    return False
            else:
                print(f"\nLocation Service: FAILED - {result.get('error')}")
                return False
        else:
            print(f"\nLocation Service: HTTP {response.status_code}")
            return False

    except Exception as e:
        print(f"\nLocation Service: ERROR - {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Android Service Remote WebSocket Test")
    print("=" * 60)
    print("\nPrerequisite: Android device simulator must be running")
    print("Run: python test_android_simulator.py\n")

    time.sleep(2)

    # Test sequence
    results = []

    # Step 1: Setup remote connection
    results.append(("Device Setup", test_android_device_setup()))

    if results[0][1]:
        # Give WebSocket time to stabilize
        time.sleep(1)

        # Step 2: Test battery service
        results.append(("Battery Monitor", test_battery_monitor_service()))

        # Step 3: Test location service
        results.append(("Location Service", test_location_service()))
    else:
        print("\n[ERROR] Skipping service tests due to setup failure")

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for test_name, passed in results:
        status = "PASSED" if passed else "FAILED"
        print(f"  {test_name}: {status}")

    all_passed = all(result[1] for result in results)
    print("\n" + "=" * 60)
    if all_passed:
        print("All Tests PASSED!")
    else:
        print("Some Tests FAILED!")
    print("=" * 60)

    exit(0 if all_passed else 1)
