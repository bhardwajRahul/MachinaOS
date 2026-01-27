---
name: android-skill
description: Control Android devices - battery, wifi, bluetooth, apps, location, camera, and sensors. Use when user wants to interact with their Android phone or tablet.
allowed-tools: android-battery android-wifi android-bluetooth android-apps android-location android-audio android-screen android-camera android-sensors
metadata:
  author: machina
  version: "1.0"
  category: device
---

# Android Device Control

This skill enables you to monitor and control Android devices connected via ADB or remote WebSocket.

## Capabilities

- Monitor battery status and health
- Control WiFi and Bluetooth
- Launch and list applications
- Get device location
- Control audio and screen
- Access camera and sensors

## Tool Reference

### android-battery
Get battery information.

Parameters:
- `action`: "status" (default)

Returns: level, charging, health, temperature

### android-wifi
Control WiFi settings.

Parameters:
- `action`: "status", "enable", "disable", "scan"

### android-bluetooth
Control Bluetooth settings.

Parameters:
- `action`: "status", "enable", "disable", "paired_devices"

### android-apps
Manage applications.

Parameters:
- `action`: "list", "launch"
- `package_name` (for launch): App package name

### android-location
Get device location.

Parameters:
- `action`: "current"

Returns: latitude, longitude, accuracy, provider

### android-audio
Control audio settings.

Parameters:
- `action`: "get_volume", "set_volume", "mute", "unmute"
- `volume` (for set_volume): 0-100

### android-screen
Control screen settings.

Parameters:
- `action`: "brightness", "set_brightness", "wake", "sleep"
- `level` (for set_brightness): 0-255

### android-camera
Access camera.

Parameters:
- `action`: "info", "capture"
- `camera` (optional): "front" or "back" (default: back)

### android-sensors
Read sensor data.

Parameters:
- `action`: "motion", "environment"

## Examples

**User**: "What's my phone's battery level?"
**Action**: Use android-battery with:
- action: "status"

**User**: "Turn off WiFi"
**Action**: Use android-wifi with:
- action: "disable"

**User**: "What apps are installed?"
**Action**: Use android-apps with:
- action: "list"

**User**: "Open Chrome"
**Action**: Use android-apps with:
- action: "launch"
- package_name: "com.android.chrome"

**User**: "Where is my phone?"
**Action**: Use android-location with:
- action: "current"

**User**: "Set volume to 50%"
**Action**: Use android-audio with:
- action: "set_volume"
- volume: 50

## Device Connection

Before using Android tools, ensure:
1. Device is connected via ADB (USB) or remote WebSocket
2. Android Device Setup node shows connected status
3. Required permissions are granted on the device

## Error Handling

- If device is not connected, inform user to check connection
- If permission is denied, suggest enabling it in device settings
- If action fails, provide the error message and suggest alternatives
