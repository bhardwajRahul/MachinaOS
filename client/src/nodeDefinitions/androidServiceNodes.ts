// Android Service Nodes - Individual nodes for each Android system service
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { API_CONFIG } from '../config/api';

// ============================================================================
// ANDROID SERVICE NODES - Individual nodes for each Android system service
// ============================================================================

// Helper function to create Android service node definition
function createAndroidServiceNode(config: {
  name: string;
  displayName: string;
  serviceId: string;
  icon: string;
  color: string;
  group: string[];
  description: string;
  defaultAction: string;
  additionalProperties?: Array<{
    displayName: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'options' | 'multiOptions' | 'collection' | 'fixedCollection' | 'color' | 'dateTime' | 'json' | 'notice' | 'hidden' | 'resourceLocator' | 'code' | 'file';
    default?: any;
    required?: boolean;
    description?: string;
    placeholder?: string;
    displayOptions?: {
      show?: Record<string, any[]>;
    };
  }>;
}): INodeTypeDescription {
  return {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon,
    group: config.group,
    version: 1,
    subtitle: `Android ${config.group[1]} Service`,
    description: config.description,
    defaults: { name: config.displayName, color: config.color },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Service trigger',
      required: false
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Service execution result'
      },
      {
        name: 'tool',
        displayName: 'Tool Output',
        type: 'main' as NodeConnectionType,
        description: 'Connect to Android Toolkit (top handle)'
      }
    ],
    properties: [
      // Hidden service_id - automatically set based on node type
      {
        displayName: 'Service ID',
        name: 'service_id',
        type: 'hidden',
        default: config.serviceId,
        required: true
      },

      // Hidden Android device connection settings - use defaults
      {
        displayName: 'Android Host',
        name: 'android_host',
        type: 'hidden',
        default: 'localhost',
        required: true
      },

      {
        displayName: 'Android Port',
        name: 'android_port',
        type: 'hidden',
        default: 8888,
        required: true
      },

      // Display label for this service node
      {
        displayName: 'Label',
        name: 'label',
        type: 'string',
        default: config.displayName,
        required: false,
        description: 'Custom label for this node instance'
      },

      // Dynamic Action field - loads options based on node type
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAndroidServiceActions'
        },
        options: [],
        default: config.defaultAction,
        required: true,
        description: `Action to perform on ${config.displayName}`
      },
      // Add any additional properties for this specific node
      ...(config.additionalProperties || [])
    ],
    methods: {
      loadOptions: {
        async getAndroidServiceActions(this: any): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const response = await fetch(`${API_CONFIG.PYTHON_BASE_URL}/api/android/services/${config.serviceId}/actions`, {
              credentials: 'include'
            });
            const data = await response.json();

            if (data.success && data.actions) {
              return data.actions.map((action: any) => ({
                name: action.name,
                value: action.value,
                description: action.description
              }));
            }

            return [];
          } catch (error) {
            console.error(`Failed to load ${config.displayName} actions:`, error);
            return [];
          }
        }
      }
    }
  };
}

export const androidServiceNodes: Record<string, INodeTypeDescription> = {
  // ============================================================================
  // SYSTEM MONITORING SERVICES
  // ============================================================================

  batteryMonitor: createAndroidServiceNode({
    name: 'batteryMonitor',
    displayName: 'Battery Monitor',
    serviceId: 'battery',
    icon: '🔋',
    color: '#4CAF50',
    group: ['android', 'monitoring'],
    description: 'Monitor battery status, level, charging state, temperature, and health',
    defaultAction: 'status'
  }),

  networkMonitor: createAndroidServiceNode({
    name: 'networkMonitor',
    displayName: 'Network Monitor',
    serviceId: 'network',
    icon: '📡',
    color: '#2196F3',
    group: ['android', 'monitoring'],
    description: 'Monitor network connectivity status, type, and internet availability',
    defaultAction: 'status'
  }),

  systemInfo: createAndroidServiceNode({
    name: 'systemInfo',
    displayName: 'System Info',
    serviceId: 'system_info',
    icon: '📱',
    color: '#9C27B0',
    group: ['android', 'monitoring'],
    description: 'Get device and OS information including Android version, API level, memory, and hardware details',
    defaultAction: 'info'
  }),

  location: createAndroidServiceNode({
    name: 'location',
    displayName: 'Location',
    serviceId: 'location',
    icon: '📍',
    color: '#F44336',
    group: ['android', 'monitoring'],
    description: 'GPS location tracking with latitude, longitude, accuracy, and provider information',
    defaultAction: 'current'
  }),

  // ============================================================================
  // APP MANAGEMENT SERVICES
  // ============================================================================

  appLauncher: createAndroidServiceNode({
    name: 'appLauncher',
    displayName: 'App Launcher',
    serviceId: 'app_launcher',
    icon: '🚀',
    color: '#FF9800',
    group: ['android', 'apps'],
    description: 'Launch applications by package name',
    defaultAction: 'launch',
    additionalProperties: [
      {
        displayName: 'Package Name',
        name: 'package_name',
        type: 'string',
        default: '',
        required: true,
        description: 'Package name of the app to launch (e.g., com.whatsapp)',
        placeholder: 'com.example.app',
        displayOptions: {
          show: {
            action: ['launch']
          }
        }
      }
    ]
  }),

  appList: createAndroidServiceNode({
    name: 'appList',
    displayName: 'App List',
    serviceId: 'app_list',
    icon: '📋',
    color: '#00BCD4',
    group: ['android', 'apps'],
    description: 'Get list of installed applications with package names, versions, and metadata',
    defaultAction: 'list'
  }),

  // ============================================================================
  // DEVICE AUTOMATION SERVICES
  // ============================================================================

  wifiAutomation: createAndroidServiceNode({
    name: 'wifiAutomation',
    displayName: 'WiFi Automation',
    serviceId: 'wifi_automation',
    icon: '📶',
    color: '#3F51B5',
    group: ['android', 'automation'],
    description: 'WiFi control and scanning - enable, disable, get status, scan for networks',
    defaultAction: 'status'
  }),

  bluetoothAutomation: createAndroidServiceNode({
    name: 'bluetoothAutomation',
    displayName: 'Bluetooth Automation',
    serviceId: 'bluetooth_automation',
    icon: '🔵',
    color: '#2196F3',
    group: ['android', 'automation'],
    description: 'Bluetooth control - enable, disable, get status, and paired devices',
    defaultAction: 'status'
  }),

  audioAutomation: createAndroidServiceNode({
    name: 'audioAutomation',
    displayName: 'Audio Automation',
    serviceId: 'audio_automation',
    icon: '🔊',
    color: '#E91E63',
    group: ['android', 'automation'],
    description: 'Volume and audio control - get/set volume, mute, unmute',
    defaultAction: 'get_volume'
  }),

  deviceStateAutomation: createAndroidServiceNode({
    name: 'deviceStateAutomation',
    displayName: 'Device State',
    serviceId: 'device_state_automation',
    icon: '⚙️',
    color: '#607D8B',
    group: ['android', 'automation'],
    description: 'Device state control - airplane mode, screen on/off, power save mode, brightness',
    defaultAction: 'status'
  }),

  screenControlAutomation: createAndroidServiceNode({
    name: 'screenControlAutomation',
    displayName: 'Screen Control',
    serviceId: 'screen_control_automation',
    icon: '💡',
    color: '#FFC107',
    group: ['android', 'automation'],
    description: 'Screen control - brightness adjustment, wake screen, auto-brightness, screen timeout',
    defaultAction: 'status'
  }),

  airplaneModeControl: createAndroidServiceNode({
    name: 'airplaneModeControl',
    displayName: 'Airplane Mode',
    serviceId: 'airplane_mode_control',
    icon: '✈️',
    color: '#795548',
    group: ['android', 'automation'],
    description: 'Airplane mode status monitoring and control',
    defaultAction: 'status'
  }),

  // ============================================================================
  // SENSOR SERVICES (Experimental)
  // ============================================================================

  motionDetection: createAndroidServiceNode({
    name: 'motionDetection',
    displayName: 'Motion Detection',
    serviceId: 'motion_detection',
    icon: '📳',
    color: '#FF5722',
    group: ['android', 'sensors'],
    description: 'Accelerometer and gyroscope data - detect motion, shake gestures, device orientation',
    defaultAction: 'current_motion'
  }),

  environmentalSensors: createAndroidServiceNode({
    name: 'environmentalSensors',
    displayName: 'Environmental Sensors',
    serviceId: 'environmental_sensors',
    icon: '🌡️',
    color: '#009688',
    group: ['android', 'sensors'],
    description: 'Environmental sensors - temperature, humidity, pressure, light level',
    defaultAction: 'ambient_conditions'
  }),

  // ============================================================================
  // MEDIA SERVICES (Experimental)
  // ============================================================================

  cameraControl: createAndroidServiceNode({
    name: 'cameraControl',
    displayName: 'Camera Control',
    serviceId: 'camera_control',
    icon: '📷',
    color: '#673AB7',
    group: ['android', 'media'],
    description: 'Camera control - get camera info, take photos, camera capabilities',
    defaultAction: 'camera_info'
  }),

  mediaControl: createAndroidServiceNode({
    name: 'mediaControl',
    displayName: 'Media Control',
    serviceId: 'media_control',
    icon: '🎵',
    color: '#E91E63',
    group: ['android', 'media'],
    description: 'Media playback control - volume control, playback control, play media files',
    defaultAction: 'volume_control'
  })
};

// Export node type identifiers
export const ANDROID_SERVICE_NODE_TYPES = [
  // System Monitoring
  'batteryMonitor',
  'networkMonitor',
  'systemInfo',
  'location',
  // App Management
  'appLauncher',
  'appList',
  // Device Automation
  'wifiAutomation',
  'bluetoothAutomation',
  'audioAutomation',
  'deviceStateAutomation',
  'screenControlAutomation',
  'airplaneModeControl',
  // Sensors
  'motionDetection',
  'environmentalSensors',
  // Media
  'cameraControl',
  'mediaControl'
];
