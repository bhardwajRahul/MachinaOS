#!/usr/bin/env python3
"""
Android Service Nodes Integration Test
Tests all 16 individual Android service nodes
"""

import requests
import json
import time
from typing import Dict, Any

API_URL = "http://localhost:3010/api/workflow/execute-node"

# Service definitions: (node_type, service_id, action, category)
SERVICES = [
    # System Monitoring (4)
    ("batteryMonitor", "battery", "status", "System Monitoring"),
    ("networkMonitor", "network", "status", "System Monitoring"),
    ("systemInfo", "system_info", "info", "System Monitoring"),  # Fixed: info not status
    ("location", "location", "current", "System Monitoring"),    # Fixed: current not status

    # App Management (2)
    ("appLauncher", "app_launcher", "launch", "App Management"),
    ("appList", "app_list", "list", "App Management"),           # Fixed: list not status

    # Device Automation (6)
    ("wifiAutomation", "wifi_automation", "status", "Device Automation"),
    ("bluetoothAutomation", "bluetooth_automation", "status", "Device Automation"),
    ("audioAutomation", "audio_automation", "get_volume", "Device Automation"),  # Fixed: get_volume
    ("deviceStateAutomation", "device_state_automation", "status", "Device Automation"),
    ("screenControlAutomation", "screen_control_automation", "status", "Device Automation"),
    ("airplaneModeControl", "airplane_mode_control", "status", "Device Automation"),

    # Sensors (2)
    ("motionDetection", "motion_detection", "current_motion", "Sensors"),              # Fixed: current_motion
    ("environmentalSensors", "environmental_sensors", "ambient_conditions", "Sensors"), # Fixed: ambient_conditions

    # Media (2)
    ("cameraControl", "camera_control", "camera_info", "Media"),        # Fixed: camera_info
    ("mediaControl", "media_control", "volume_control", "Media"),       # Fixed: volume_control
]

def test_service(node_type: str, service_id: str, action: str) -> Dict[str, Any]:
    """Test a single Android service node"""
    node_id = f"{node_type}-test-{int(time.time()*1000)}"

    payload = {
        "node_id": node_id,
        "node_type": node_type,
        "parameters": {
            "service_id": service_id,
            "android_host": "localhost",
            "android_port": 8888,
            "action": action,
            "parameters": "{}"
        }
    }

    try:
        response = requests.post(API_URL, json=payload, timeout=10)
        result = response.json()

        success = result.get("success", False)
        exec_time = result.get("execution_time", 0)

        # Check if it's actually calling Android API (not generic execution)
        is_real_call = exec_time > 0.01  # Real Android calls take >10ms

        return {
            "passed": success and is_real_call,
            "exec_time": exec_time,
            "response": result
        }
    except Exception as e:
        return {
            "passed": False,
            "exec_time": 0,
            "error": str(e)
        }

def main():
    print("=" * 60)
    print("Android Service Nodes Integration Test")
    print("=" * 60)
    print()

    results = []
    current_category = None

    for node_type, service_id, action, category in SERVICES:
        # Print category header
        if category != current_category:
            if current_category is not None:
                print()
            print(f"\n{category} ({sum(1 for _, _, _, c in SERVICES if c == category)} nodes)")
            print("-" * 60)
            current_category = category

        print(f"Testing {node_type:25s} ({service_id}/{action})... ", end="", flush=True)

        result = test_service(node_type, service_id, action)
        results.append((node_type, result))

        if result["passed"]:
            exec_time = result["exec_time"]
            print(f"PASS ({exec_time:.3f}s)")
        else:
            exec_time = result.get("exec_time", 0)
            error = result.get("error", "Unknown error")
            print(f"FAIL ({exec_time:.3f}s) - {error}")

    # Summary
    print()
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, r in results if r["passed"])
    failed = len(results) - passed

    print(f"PASSED: {passed}/16")
    print(f"FAILED: {failed}/16")
    print()

    if failed > 0:
        print("Failed services:")
        for node_type, result in results:
            if not result["passed"]:
                error = result.get("error", "Low execution time")
                print(f"  - {node_type}: {error}")
        print()

    if failed == 0:
        print("All Android service nodes working correctly!")
        return 0
    else:
        print(f"{failed} service(s) failed. Check Android device connection.")
        return 1

if __name__ == "__main__":
    exit(main())
