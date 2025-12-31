// Android Device Management Nodes
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { API_CONFIG } from '../config/api';

export const androidDeviceNodes: Record<string, INodeTypeDescription> = {
  androidDeviceSetup: {
    displayName: 'Android Device Setup',
    name: 'androidDeviceSetup',
    icon: '🔌',
    group: ['android', 'setup'],
    version: 1,
    subtitle: 'Connect Android Device',
    description: 'Setup Android device connection via local ADB or remote relay with QR code pairing',
    defaults: { name: 'Android Device Setup', color: '#3DDC84' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger device setup',
      required: false
    }],
    outputs: [{
      name: 'main',
      displayName: 'Output',
      type: 'main' as NodeConnectionType,
      description: 'Device connection status'
    }],
    properties: [
      {
        displayName: 'Connection Type',
        name: 'connection_type',
        type: 'options',
        options: [
          {
            name: 'Local ADB Device',
            value: 'local',
            description: 'Connect to Android device via USB/ADB with port forwarding'
          },
          {
            name: 'Remote Relay (QR Pairing)',
            value: 'remote',
            description: 'Connect via relay server with QR code pairing'
          }
        ],
        default: 'remote',
        required: true,
        description: 'Choose connection method: local ADB or remote relay'
      },
      // Local ADB options
      {
        displayName: 'Android Device',
        name: 'device_id',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAndroidDevices'
        },
        displayOptions: {
          show: {
            connection_type: ['local']
          }
        },
        options: [],
        default: '',
        required: true,
        description: 'Select connected Android device (from adb devices)'
      },
      {
        displayName: 'Auto Setup Port Forwarding',
        name: 'auto_forward',
        type: 'boolean',
        displayOptions: {
          show: {
            connection_type: ['local']
          }
        },
        default: true,
        required: false,
        description: 'Automatically setup ADB port forwarding when node executes'
      },
      {
        displayName: 'Port',
        name: 'port',
        type: 'number',
        displayOptions: {
          show: {
            connection_type: ['local']
          }
        },
        default: 8888,
        required: true,
        description: 'Port number for local ADB port forwarding'
      },
      // Remote relay options
      {
        displayName: 'Relay URL',
        name: 'websocket_url',
        type: 'string',
        displayOptions: {
          show: {
            connection_type: ['remote']
          }
        },
        default: '',
        required: true,
        placeholder: 'wss://your-relay-server.com/ws',
        description: 'Relay server URL for QR code pairing with Android device'
      }
    ],
    methods: {
      loadOptions: {
        async getAndroidDevices(this: any): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const response = await fetch(`${API_CONFIG.PYTHON_BASE_URL}/api/android/devices`, {
              credentials: 'include'
            });
            const data = await response.json();

            if (data.success && data.devices) {
              return data.devices.map((device: any) => ({
                name: `${device.model || device.id} (${device.id})`,
                value: device.id,
                description: `${device.state} - Android ${device.android_version || 'Unknown'}`
              }));
            }

            return [];
          } catch (error) {
            console.error('Failed to load Android devices:', error);
            return [];
          }
        }
      }
    }
  }
};

export const ANDROID_DEVICE_NODE_TYPES = ['androidDeviceSetup'];
