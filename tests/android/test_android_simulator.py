#!/usr/bin/env python3
"""
Simulated Android Device - Sends dummy data through WebSocket
Simulates battery, location, and other sensor data

Required environment variables:
  WEBSOCKET_URL - WebSocket server URL (required)
  ANDROID_API_KEY - API key for WebSocket authentication
"""
import asyncio
import json
import os
import aiohttp
from aiohttp import ClientWSTimeout
from datetime import datetime
import random

class AndroidDeviceSimulator:
    """Simulates an Android device sending sensor data"""

    def __init__(self, url: str, api_key: str, device_id: str):
        self.url = url
        self.api_key = api_key
        self.device_id = device_id
        self.ws = None
        self.session = None
        self.running = False

    async def connect(self):
        """Connect to WebSocket and register"""
        print(f"[ANDROID DEVICE] Connecting to {self.url}")

        self.session = aiohttp.ClientSession()
        self.ws = await self.session.ws_connect(
            self.url,
            timeout=ClientWSTimeout(ws_close=10.0)
        )

        # Wait for welcome
        msg = await asyncio.wait_for(self.ws.receive(), timeout=5.0)
        welcome = json.loads(msg.data)
        print(f"[ANDROID DEVICE] {welcome.get('message')}")

        # Register as Android device
        register_msg = {
            "type": "register",
            "clientType": "android",
            "clientId": self.device_id,
            "apiKey": self.api_key
        }
        await self.ws.send_json(register_msg)
        print(f"[ANDROID DEVICE] Sent registration")

        # Wait for registration response
        msg = await asyncio.wait_for(self.ws.receive(), timeout=5.0)
        reg_response = json.loads(msg.data)

        if reg_response.get('type') == 'registered':
            print(f"[ANDROID DEVICE] Registered as: {reg_response.get('clientId')}")
            self.running = True
            return True
        else:
            print(f"[ANDROID DEVICE] Registration failed: {reg_response}")
            return False

    async def send_battery_status(self):
        """Send battery status data"""
        battery_level = random.randint(20, 100)
        charging = random.choice([True, False])
        temperature = round(random.uniform(25.0, 45.0), 1)

        data = {
            "type": "data",
            "payload": {
                "service": "battery",
                "action": "status",
                "data": {
                    "level": battery_level,
                    "charging": charging,
                    "temperature": temperature,
                    "voltage": round(random.uniform(3.7, 4.2), 2),
                    "health": "good",
                    "technology": "Li-ion"
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent battery status: {battery_level}% {'(charging)' if charging else ''} {temperature}°C")

    async def send_location_data(self):
        """Send GPS location data"""
        # Simulate location in San Francisco area
        lat = round(37.7749 + random.uniform(-0.1, 0.1), 6)
        lng = round(-122.4194 + random.uniform(-0.1, 0.1), 6)
        accuracy = round(random.uniform(5.0, 20.0), 1)

        data = {
            "type": "data",
            "payload": {
                "service": "location",
                "action": "get_location",
                "data": {
                    "latitude": lat,
                    "longitude": lng,
                    "accuracy": accuracy,
                    "altitude": round(random.uniform(0, 100), 1),
                    "provider": "gps",
                    "speed": round(random.uniform(0, 5), 1)
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent location: {lat}, {lng} (±{accuracy}m)")

    async def send_system_info(self):
        """Send system information"""
        data = {
            "type": "data",
            "payload": {
                "service": "system_info",
                "action": "get_info",
                "data": {
                    "android_version": "14",
                    "api_level": 34,
                    "device_model": "Pixel 8",
                    "manufacturer": "Google",
                    "total_memory": 8192,
                    "available_memory": random.randint(2000, 5000),
                    "storage_total": 128000,
                    "storage_available": random.randint(40000, 80000)
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent system info: Pixel 8, Android 14")

    async def send_network_status(self):
        """Send network status"""
        network_type = random.choice(["WIFI", "MOBILE"])
        data = {
            "type": "data",
            "payload": {
                "service": "network",
                "action": "get_status",
                "data": {
                    "connected": True,
                    "type": network_type,
                    "internet_available": True,
                    "wifi_ssid": "Home-WiFi" if network_type == "WIFI" else None,
                    "signal_strength": random.randint(1, 5)
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent network status: {network_type}")

    async def send_app_list(self):
        """Send list of installed applications"""
        apps = [
            {"package": "com.google.android.gms", "name": "Google Play Services", "version": "23.45.12"},
            {"package": "com.android.chrome", "name": "Chrome", "version": "120.0.6099"},
            {"package": "com.whatsapp", "name": "WhatsApp", "version": "2.23.24.9"},
            {"package": "com.spotify.music", "name": "Spotify", "version": "8.8.94.527"},
            {"package": "com.instagram.android", "name": "Instagram", "version": "308.0.0.38.112"}
        ]

        data = {
            "type": "data",
            "payload": {
                "service": "app_list",
                "action": "get_apps",
                "data": {
                    "apps": apps,
                    "total_count": len(apps)
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent app list: {len(apps)} apps")

    async def send_wifi_status(self):
        """Send WiFi automation status"""
        enabled = random.choice([True, False])
        data = {
            "type": "data",
            "payload": {
                "service": "wifi_automation",
                "action": "get_status",
                "data": {
                    "enabled": enabled,
                    "connected": enabled,
                    "ssid": "Home-WiFi" if enabled else None,
                    "ip_address": f"192.168.1.{random.randint(100, 200)}" if enabled else None,
                    "signal_strength": random.randint(-70, -30) if enabled else None
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent WiFi status: {'enabled' if enabled else 'disabled'}")

    async def send_bluetooth_status(self):
        """Send Bluetooth automation status"""
        enabled = random.choice([True, False])
        paired_devices = [
            {"name": "AirPods Pro", "address": "00:1A:7D:DA:71:13", "connected": True},
            {"name": "Car Bluetooth", "address": "F8:16:54:A6:01:28", "connected": False}
        ] if enabled else []

        data = {
            "type": "data",
            "payload": {
                "service": "bluetooth_automation",
                "action": "get_status",
                "data": {
                    "enabled": enabled,
                    "paired_devices": paired_devices,
                    "connected_devices": [d for d in paired_devices if d.get("connected")]
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent Bluetooth status: {'enabled' if enabled else 'disabled'}")

    async def send_audio_status(self):
        """Send audio automation status"""
        data = {
            "type": "data",
            "payload": {
                "service": "audio_automation",
                "action": "get_volume",
                "data": {
                    "music_volume": random.randint(0, 15),
                    "ring_volume": random.randint(0, 7),
                    "alarm_volume": random.randint(0, 7),
                    "notification_volume": random.randint(0, 7),
                    "muted": random.choice([True, False])
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent audio status")

    async def send_device_state(self):
        """Send device state automation status"""
        data = {
            "type": "data",
            "payload": {
                "service": "device_state_automation",
                "action": "get_state",
                "data": {
                    "airplane_mode": random.choice([True, False]),
                    "screen_on": random.choice([True, False]),
                    "power_save_mode": random.choice([True, False]),
                    "brightness": random.randint(0, 255),
                    "auto_brightness": random.choice([True, False])
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent device state")

    async def send_screen_control(self):
        """Send screen control status"""
        data = {
            "type": "data",
            "payload": {
                "service": "screen_control_automation",
                "action": "get_brightness",
                "data": {
                    "brightness": random.randint(0, 255),
                    "auto_brightness": random.choice([True, False]),
                    "screen_timeout": random.choice([15000, 30000, 60000, 300000]),
                    "screen_on": random.choice([True, False])
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent screen control status")

    async def send_motion_data(self):
        """Send motion detection sensor data"""
        data = {
            "type": "data",
            "payload": {
                "service": "motion_detection",
                "action": "get_sensors",
                "data": {
                    "accelerometer": {
                        "x": round(random.uniform(-10, 10), 3),
                        "y": round(random.uniform(-10, 10), 3),
                        "z": round(random.uniform(-10, 10), 3)
                    },
                    "gyroscope": {
                        "x": round(random.uniform(-2, 2), 3),
                        "y": round(random.uniform(-2, 2), 3),
                        "z": round(random.uniform(-2, 2), 3)
                    },
                    "orientation": random.choice(["portrait", "landscape"]),
                    "motion_detected": random.choice([True, False])
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent motion sensor data")

    async def send_environmental_sensors(self):
        """Send environmental sensor data"""
        data = {
            "type": "data",
            "payload": {
                "service": "environmental_sensors",
                "action": "get_sensors",
                "data": {
                    "temperature": round(random.uniform(20.0, 30.0), 1),
                    "humidity": round(random.uniform(30.0, 70.0), 1),
                    "pressure": round(random.uniform(990.0, 1020.0), 1),
                    "light_level": random.randint(0, 50000)
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent environmental sensor data")

    async def send_camera_info(self):
        """Send camera control info"""
        data = {
            "type": "data",
            "payload": {
                "service": "camera_control",
                "action": "get_info",
                "data": {
                    "camera_count": 3,
                    "cameras": [
                        {"id": 0, "facing": "back", "megapixels": 50},
                        {"id": 1, "facing": "front", "megapixels": 12},
                        {"id": 2, "facing": "back", "megapixels": 12, "type": "ultrawide"}
                    ],
                    "flash_available": True
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent camera info")

    async def send_media_control_status(self):
        """Send media control status"""
        data = {
            "type": "data",
            "payload": {
                "service": "media_control",
                "action": "get_status",
                "data": {
                    "playing": random.choice([True, False]),
                    "track": "Shape of You - Ed Sheeran",
                    "duration": 233000,
                    "position": random.randint(0, 233000),
                    "volume": random.randint(0, 100)
                },
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.ws.send_json(data)
        print(f"[ANDROID DEVICE] Sent media control status")

    async def listen_for_commands(self):
        """Listen for commands from Web clients"""
        while self.running:
            try:
                msg = await asyncio.wait_for(self.ws.receive(), timeout=2.0)

                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)

                    if data.get('type') == 'data':
                        payload = data.get('payload', {})
                        action = payload.get('action')
                        service = payload.get('service')

                        print(f"\n[ANDROID DEVICE] Received command: {service}/{action}")

                        # Respond based on service and action
                        # Official service IDs from androidServiceNodes.ts
                        if service == 'battery':
                            await self.send_battery_status()
                        elif service == 'location':
                            await self.send_location_data()
                        elif service == 'system_info':
                            await self.send_system_info()
                        elif service == 'network':
                            await self.send_network_status()
                        elif service == 'app_list':
                            await self.send_app_list()
                        elif service == 'app_launcher':
                            await self.send_app_list()
                        elif service == 'wifi_automation':
                            await self.send_wifi_status()
                        elif service == 'bluetooth_automation':
                            await self.send_bluetooth_status()
                        elif service == 'audio_automation':
                            await self.send_audio_status()
                        elif service == 'device_state_automation':
                            await self.send_device_state()
                        elif service == 'screen_control_automation':
                            await self.send_screen_control()
                        elif service == 'airplane_mode_control':
                            await self.send_device_state()
                        elif service == 'motion_detection':
                            await self.send_motion_data()
                        elif service == 'environmental_sensors':
                            await self.send_environmental_sensors()
                        elif service == 'camera_control':
                            await self.send_camera_info()
                        elif service == 'media_control':
                            await self.send_media_control_status()
                        else:
                            print(f"[ANDROID DEVICE] Unknown service/action: {service}/{action}")

                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    print("[ANDROID DEVICE] Connection closed")
                    self.running = False
                    break

            except asyncio.TimeoutError:
                # No message, continue listening
                continue
            except Exception as e:
                print(f"[ANDROID DEVICE] Error: {e}")
                break

    async def run_service(self):
        """Run as background service - only responds to requests"""
        print("\n[ANDROID DEVICE] Service started")
        print("[ANDROID DEVICE] Simulating all 17 Android service nodes")
        print("[ANDROID DEVICE] Listening for commands - will only send data when requested")
        print("[ANDROID DEVICE] Press Ctrl+C to stop\n")

        try:
            # Run command listener indefinitely
            await self.listen_for_commands()

        except KeyboardInterrupt:
            print("\n[ANDROID DEVICE] Service stopped by user")
            self.running = False

    async def disconnect(self):
        """Disconnect from WebSocket"""
        if self.ws:
            await self.ws.close()
            print("[ANDROID DEVICE] Disconnected")
        if self.session:
            await self.session.close()


async def main():
    print("=" * 60)
    print("Android Device Simulator - Background Service")
    print("Responds to Android service requests via WebSocket")
    print("=" * 60)

    # Configuration from environment variables
    url = os.getenv("WEBSOCKET_URL")
    android_api_key = os.getenv("ANDROID_API_KEY")

    if not url:
        print("[ERROR] WEBSOCKET_URL environment variable is required")
        print("[ERROR] Set it with: export WEBSOCKET_URL=ws://your-server/ws")
        return

    if not android_api_key:
        print("[ERROR] ANDROID_API_KEY environment variable is required")
        print("[ERROR] Set it with: export ANDROID_API_KEY=your-api-key")
        return
    device_id = f"android_pixel8_{int(datetime.now().timestamp())}"

    # Create simulator
    simulator = AndroidDeviceSimulator(url, android_api_key, device_id)

    # Connect
    if await simulator.connect():
        # Run as background service (runs indefinitely until Ctrl+C)
        await simulator.run_service()
    else:
        print("[ANDROID DEVICE] Failed to connect")

    # Disconnect
    await simulator.disconnect()

    print("\n" + "=" * 60)
    print("Service Stopped")
    print("=" * 60)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nService stopped by user")
