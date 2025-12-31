#!/usr/bin/env python3
"""Check Android service responses for errors"""

import requests
import json

API_URL = "http://localhost:3010/api/workflow/execute-node"

SERVICES = [
    ("batteryMonitor", "battery", "status"),
    ("networkMonitor", "network", "status"),
    ("systemInfo", "system_info", "status"),
    ("location", "location", "status"),
    ("appLauncher", "app_launcher", "launch"),
    ("appList", "app_list", "status"),
    ("wifiAutomation", "wifi_automation", "status"),
    ("bluetoothAutomation", "bluetooth_automation", "status"),
    ("audioAutomation", "audio_automation", "status"),
    ("deviceStateAutomation", "device_state_automation", "status"),
    ("screenControlAutomation", "screen_control_automation", "status"),
    ("airplaneModeControl", "airplane_mode_control", "status"),
    ("motionDetection", "motion_detection", "status"),
    ("environmentalSensors", "environmental_sensors", "status"),
    ("cameraControl", "camera_control", "status"),
    ("mediaControl", "media_control", "status"),
]

errors_found = []

for node_type, service_id, action in SERVICES:
    payload = {
        "node_id": f"check-{node_type}",
        "node_type": node_type,
        "parameters": {
            "service_id": service_id,
            "action": action
        }
    }

    response = requests.post(API_URL, json=payload)
    result = response.json()

    # Check if there's an error in the data
    if result.get('success') and result.get('result'):
        data = result['result'].get('data', {})
        if 'error' in data:
            errors_found.append({
                'node_type': node_type,
                'service_id': service_id,
                'action': action,
                'error': data['error']
            })
            print(f"ERROR in {node_type} ({service_id}/{action}):")
            print(f"  {data['error']}")
            print()

if errors_found:
    print(f"\nFound {len(errors_found)} services with errors:")
    for err in errors_found:
        print(f"  - {err['node_type']}: {err['error']}")
else:
    print("\nNo errors found in any service responses!")
