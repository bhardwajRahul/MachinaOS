---
name: android-skill
description: Control Android devices - battery, wifi, bluetooth, apps, location, camera, and sensors. Use when user wants to interact with their Android phone or tablet.
metadata:
  author: machina
  version: "2.0"
  category: device
---

# Android Device Control

This skill provides context for monitoring and controlling Android devices.

## How It Works

This skill provides instructions and context. To execute Android actions, connect the **Android Toolkit** node to the Zeenie's `input-tools` handle, then connect Android service nodes to the toolkit:

```
[Battery Monitor] --+
                    |
[WiFi Automation] --+--> [Android Toolkit] --> [Zeenie]
                    |
[Location]       ---+
```

## Available Android Service Nodes

Connect these to the Android Toolkit:

| Node | Capabilities |
|------|-------------|
| **Battery Monitor** | Battery level, charging status, health, temperature |
| **WiFi Automation** | Enable/disable WiFi, scan networks, get status |
| **Bluetooth Automation** | Enable/disable Bluetooth, paired devices |
| **App Launcher** | Launch applications by package name |
| **App List** | List installed applications |
| **Location** | Get current GPS coordinates |
| **Audio Automation** | Volume control, mute/unmute |
| **Screen Control** | Brightness, wake/sleep screen |
| **Camera Control** | Camera info, capture photos |
| **Motion Detection** | Accelerometer, gyroscope data |
| **Environmental Sensors** | Temperature, humidity, pressure |

## Example Interactions

**User**: "What's my phone's battery level?"
- Use the Battery Monitor service with action "status"

**User**: "Turn off WiFi"
- Use the WiFi Automation service with action "disable"

**User**: "What apps are installed?"
- Use the App List service with action "list"

**User**: "Open Chrome"
- Use the App Launcher service with action "launch", package_name "com.android.chrome"

**User**: "Where is my phone?"
- Use the Location service with action "current"

**User**: "Set volume to 50%"
- Use the Audio Automation service with action "set_volume", volume 50

## Device Connection

Before using Android tools, ensure:
1. Device is connected via ADB (USB) or remote WebSocket
2. Android Device Setup node shows connected status (green indicator)
3. Required permissions are granted on the device

## Error Handling

- If device is not connected, inform user to check connection
- If permission is denied, suggest enabling it in device settings
- If action fails, provide the error message and suggest alternatives

## Setup Requirements

1. Connect this skill to Zeenie's `input-skill` handle
2. Add **Android Toolkit** node and connect to Zeenie's `input-tools` handle
3. Connect desired Android service nodes to the Android Toolkit
4. Ensure Android device is paired (green status indicator)
