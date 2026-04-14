// WhatsApp Node Definitions - Messaging integration via whatsmeow
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';
import { API_CONFIG } from '../config/api';

// Get WebSocket URL dynamically based on environment
const getWebSocketUrl = (): string => {
  const baseUrl = API_CONFIG.PYTHON_BASE_URL;

  // Production: empty base URL means use current origin
  if (!baseUrl) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${window.location.host}/ws/status`;
  }

  // Development: convert http(s) to ws(s)
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = baseUrl.replace(/^https?/, wsProtocol);
  return `${wsUrl}/ws/status`;
};

// Helper to make WebSocket requests
async function wsRequest(type: string, data: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getWebSocketUrl());
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket request timeout'));
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type, ...data }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(event.data);
        ws.close();
        resolve(response);
      } catch (e) {
        ws.close();
        reject(e);
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      ws.close();
      reject(error);
    };
  });
}

// ============================================================================
// WHATSAPP ICONS (SVG Data URIs)
// ============================================================================

// WhatsApp Send - Paper plane (send message)
const WHATSAPP_SEND_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2325D366'%3E%3Cpath d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'/%3E%3C/svg%3E";

// WhatsApp Connect - Official WhatsApp logo (exported for use in skill nodes)
export const WHATSAPP_CONNECT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2325D366'%3E%3Cpath d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/%3E%3C/svg%3E";

// WhatsApp Receive - Notification bell with dot (trigger node)
const WHATSAPP_RECEIVE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2325D366'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z'/%3E%3Ccircle cx='18' cy='6' r='4'/%3E%3C/svg%3E";

// WhatsApp DB - Database icon (query contacts, groups, messages)
const WHATSAPP_DB_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2325D366'%3E%3Cpath d='M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-4c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V13zm0-4c0 .5-2.13 2-6 2s-6-1.5-6-2V6.77C7.61 7.55 9.72 8 12 8s4.39-.45 6-1.23V9z'/%3E%3C/svg%3E";

// ============================================================================
// WHATSAPP NODES
// ============================================================================

export const whatsappNodes: Record<string, INodeTypeDescription> = {
  // WhatsApp Send Message Node - Enhanced with full schema support
  whatsappSend: {
    displayName: 'WhatsApp Send',
    name: 'whatsappSend',
    icon: WHATSAPP_SEND_ICON,
    group: ['whatsapp', 'tool'],
    version: 1,
    subtitle: 'Send WhatsApp Message',
    description: 'Send text, media, location, or contact messages via WhatsApp',
    defaults: { name: 'WhatsApp Send', color: '#25D366' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Message input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Message output'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  // WhatsApp Receive Message - triggers workflow on incoming messages
  whatsappReceive: {
    displayName: 'WhatsApp Receive',
    name: 'whatsappReceive',
    icon: WHATSAPP_RECEIVE_ICON,
    group: ['whatsapp', 'trigger'],
    version: 1,
    subtitle: 'On Message Received',
    description: 'Trigger workflow when WhatsApp message is received. Outputs message data including sender, content, and metadata.',
    defaults: { name: 'WhatsApp Receive', color: '#075E54' },
    inputs: [],
    outputs: [{
      name: 'main',
      displayName: 'Message',
      type: 'main' as NodeConnectionType,
      description: 'Received message data (message_id, sender, sender_phone, chat_id, message_type, text, timestamp, is_group, is_from_me, group_info.sender_jid, group_info.sender_phone, group_info.sender_name)'
    }],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
    methods: {
      loadOptions: {
        async getWhatsAppGroups(): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const response = await wsRequest('whatsapp_groups') as { success: boolean; groups?: Array<{ jid: string; name: string; participant_count?: number; is_community?: boolean }> };

            if (response.success && response.groups) {
              // Filter out communities - they don't have regular chat history
              const regularGroups = response.groups.filter((group) => !group.is_community);
              if (regularGroups.length === 0) {
                return [{ name: 'No groups found', value: '', description: 'Only communities found (no chat history)' }];
              }
              return regularGroups.map((group) => ({
                name: group.name || group.jid,
                value: group.jid,
                description: group.participant_count ? `${group.participant_count} members` : undefined
              }));
            }
            return [{ name: 'No groups found', value: '', description: 'Connect WhatsApp first' }];
          } catch (error) {
            console.error('Error loading WhatsApp groups:', error);
            return [{ name: 'Error loading groups', value: '', description: 'Check WhatsApp connection' }];
          }
        },

        async getGroupMembers(this: { getCurrentNodeParameter: (name: string) => string }): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const groupId = this.getCurrentNodeParameter('group_id');
            if (!groupId) {
              return [{ name: 'Select a group first', value: '', description: 'Choose a group above' }];
            }

            const response = await wsRequest('whatsapp_group_info', { group_id: groupId }) as {
              success: boolean;
              participants?: Array<{ phone: string; name: string; jid: string; is_admin?: boolean }>;
              name?: string;
            };

            if (response.success && response.participants && response.participants.length > 0) {
              // Add "All Members" option first
              const options: Array<{name: string, value: string, description?: string}> = [
                { name: 'All Members', value: '', description: 'Receive from anyone in group' }
              ];

              // Add each participant
              for (const p of response.participants) {
                const displayName = p.name || p.phone;
                const adminLabel = p.is_admin ? ' (Admin)' : '';
                options.push({
                  name: `${displayName}${adminLabel}`,
                  value: p.phone,
                  description: p.phone
                });
              }

              return options;
            }

            return [{ name: 'No members found', value: '', description: 'Could not load group members' }];
          } catch (error) {
            console.error('Error loading group members:', error);
            return [{ name: 'Error loading members', value: '', description: 'Check WhatsApp connection' }];
          }
        },

        async getWhatsAppChannels(): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const response = await wsRequest('whatsapp_newsletters') as { success: boolean; channels?: Array<{ jid: string; name: string; subscriber_count?: number; role?: string }> };

            if (response.success && response.channels) {
              if (response.channels.length === 0) {
                return [{ name: 'No channels found', value: '', description: 'Follow some channels first' }];
              }
              return response.channels.map((ch) => ({
                name: ch.name || ch.jid,
                value: ch.jid,
                description: ch.subscriber_count ? `${ch.subscriber_count} subscribers` : undefined
              }));
            }
            return [{ name: 'No channels found', value: '', description: 'Connect WhatsApp first' }];
          } catch (error) {
            console.error('Error loading WhatsApp channels:', error);
            return [{ name: 'Error loading channels', value: '', description: 'Check WhatsApp connection' }];
          }
        }
      }
    }
  },

  // WhatsApp DB Node - Query contacts, groups, messages
  // Can be used as workflow node OR as AI Agent tool (group includes 'tool')
  whatsappDb: {
    displayName: 'WhatsApp DB',
    name: 'whatsappDb',
    icon: WHATSAPP_DB_ICON,
    group: ['whatsapp', 'tool'],
    version: 1,
    subtitle: 'Query WhatsApp',
    description: 'Query WhatsApp database - contacts, groups, messages, contact info',
    defaults: { name: 'WhatsApp DB', color: '#25D366' },
    inputs: [{
      name: 'main',
      displayName: 'Input',
      type: 'main' as NodeConnectionType,
      description: 'Trigger input'
    }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main' as NodeConnectionType,
        description: 'Query result'
      },
      {
        name: 'tool',
        displayName: 'Tool',
        type: 'main' as NodeConnectionType,
        description: 'Connect to AI Agent tool handle'
      }
    ],
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
    methods: {
      loadOptions: {
        async getWhatsAppGroups(): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const response = await wsRequest('whatsapp_groups') as { success: boolean; groups?: Array<{ jid: string; name: string; participant_count?: number; is_community?: boolean }> };

            if (response.success && response.groups) {
              const regularGroups = response.groups.filter((group) => !group.is_community);
              if (regularGroups.length === 0) {
                return [{ name: 'No groups found', value: '', description: 'Only communities found' }];
              }
              return regularGroups.map((group) => ({
                name: group.name || group.jid,
                value: group.jid,
                description: group.participant_count ? `${group.participant_count} members` : undefined
              }));
            }
            return [{ name: 'No groups found', value: '', description: 'Connect WhatsApp first' }];
          } catch (error) {
            console.error('Error loading WhatsApp groups:', error);
            return [{ name: 'Error loading groups', value: '', description: 'Check WhatsApp connection' }];
          }
        },

        async getWhatsAppChannels(): Promise<Array<{name: string, value: string, description?: string}>> {
          try {
            const response = await wsRequest('whatsapp_newsletters') as { success: boolean; channels?: Array<{ jid: string; name: string; subscriber_count?: number; role?: string }> };

            if (response.success && response.channels) {
              if (response.channels.length === 0) {
                return [{ name: 'No channels found', value: '', description: 'Follow some channels first' }];
              }
              return response.channels.map((ch) => ({
                name: ch.name || ch.jid,
                value: ch.jid,
                description: [ch.role, ch.subscriber_count ? `${ch.subscriber_count} subscribers` : ''].filter(Boolean).join(' - ') || undefined
              }));
            }
            return [{ name: 'No channels found', value: '', description: 'Connect WhatsApp first' }];
          } catch (error) {
            console.error('Error loading WhatsApp channels:', error);
            return [{ name: 'Error loading channels', value: '', description: 'Check WhatsApp connection' }];
          }
        }
      }
    }
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export const WHATSAPP_NODE_TYPES = ['whatsappSend', 'whatsappReceive', 'whatsappDb'];
