import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { nodeDefinitions } from '../../nodeDefinitions';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Node, Edge } from 'reactflow';
import { useDragVariable } from '../../hooks/useDragVariable';
import { useAppTheme } from '../../hooks/useAppTheme';

interface InputSectionProps {
  nodeId: string;
  visible?: boolean;
}

interface NodeData {
  id: string;           // Unique key (includes handle suffix for multi-output)
  sourceNodeId: string; // Original node ID for template variable resolution
  name: string;
  type: string;
  icon: string;
  inputData?: any;
  outputSchema: Record<string, any>;
  hasExecutionData: boolean;
}

// Helper to render icon (handles both image URLs and emoji/text)
const renderNodeIcon = (icon: string, size: number = 16) => {
  if (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/')) {
    return (
      <img
        src={icon}
        alt="icon"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  return <span style={{ fontSize: size - 2 }}>{icon}</span>;
};

const InputSection: React.FC<InputSectionProps> = ({ nodeId, visible = true }) => {
  const theme = useAppTheme();
  const { currentWorkflow } = useAppStore();
  const { getNodeOutput } = useWebSocket();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [connectedNodes, setConnectedNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const { handleVariableDragStart, getTemplateVariableName } = useDragVariable(nodeId);

  // Fetch connected node data with execution results from backend
  useEffect(() => {
    const fetchConnectedNodes = async () => {
      if (!currentWorkflow || !nodeId) {
        setConnectedNodes([]);
        return;
      }

      setLoading(true);
      const nodes = currentWorkflow.nodes || [];
      const edges = currentWorkflow.edges || [];

      // Helper to check if a handle is a config/auxiliary handle (not main data flow)
      const isConfigHandle = (handle: string | null | undefined): boolean => {
        if (!handle) return false;
        // Config handles follow pattern: input-<type> where type is not 'main', 'chat', or 'task'
        // Examples: input-memory, input-tools, input-model, input-skill
        // Non-config (primary data) handles: input-main, input-chat, input-task
        // Note: input-task is for taskTrigger node output which should be visible as draggable variables
        if (handle.startsWith('input-') && handle !== 'input-main' && handle !== 'input-chat' && handle !== 'input-task') {
          return true;
        }
        return false;
      };

      // Helper to check if a node is a config/auxiliary node (connects to config handles)
      const isConfigNode = (nodeType: string | undefined): boolean => {
        if (!nodeType) return false;
        const definition = nodeDefinitions[nodeType];
        if (!definition) return false;
        // Config nodes typically have 'memory' or 'tool' in their group
        const groups = definition.group || [];
        return groups.includes('memory') || groups.includes('tool');
      };

      // Get current node info
      const currentNode = nodes.find((node: Node) => node.id === nodeId);
      const currentNodeType = currentNode?.type;

      // Agent node types that support skills (have input-skill handle)
      const AGENT_WITH_SKILLS_TYPES = [
        'aiAgent', 'chatAgent', 'android_agent', 'coding_agent',
        'web_agent', 'task_agent', 'social_agent', 'travel_agent',
        'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent',
        'autonomous_agent', 'orchestrator_agent'
      ];
      // Check if current node is an agent that shows skills in Middle Section
      const isAgentWithSkills = AGENT_WITH_SKILLS_TYPES.includes(currentNodeType || '');

      // Collect all edges to process (direct + inherited from parent for config nodes)
      interface EdgeWithLabel { edge: Edge; label?: string; targetHandleLabel?: string }
      const edgesToProcess: EdgeWithLabel[] = [];

      // 1. Add direct incoming edges to main data handles
      // Skip config handle connections (memory, tools, skill) for agent nodes - they're shown in Middle Section
      const directEdges = edges.filter((edge: Edge) => edge.target === nodeId);
      directEdges.forEach(edge => {
        // Skip config handle edges for agent nodes - they have dedicated UI in Middle Section
        if (isAgentWithSkills && isConfigHandle(edge.targetHandle)) {
          return;
        }
        // Extract target handle name for display (e.g., "input-skill" -> "skill")
        let targetHandleLabel: string | undefined;
        if (edge.targetHandle && edge.targetHandle.startsWith('input-') && edge.targetHandle !== 'input-main') {
          targetHandleLabel = edge.targetHandle.replace('input-', '');
        }
        edgesToProcess.push({ edge, targetHandleLabel });
      });

      // 2. If current node is a config node (memory, tool), inherit parent node's main inputs
      if (isConfigNode(currentNodeType)) {
        const outgoingEdges = edges.filter((edge: Edge) => edge.source === nodeId);

        for (const outEdge of outgoingEdges) {
          // Check if connected to a config handle on the target
          if (isConfigHandle(outEdge.targetHandle)) {
            const targetNode = nodes.find((node: Node) => node.id === outEdge.target);
            if (!targetNode) continue;

            const targetDef = nodeDefinitions[targetNode.type || ''];
            const targetName = targetDef?.displayName || targetNode.type;

            // Find nodes connected to the parent's main input (non-config handles)
            const parentInputEdges = edges.filter(
              (e: Edge) => e.target === targetNode.id && !isConfigHandle(e.targetHandle)
            );

            for (const parentEdge of parentInputEdges) {
              edgesToProcess.push({ edge: parentEdge, label: `via ${targetName}` });
            }
          }
        }
      }

      const nodeDataPromises = edgesToProcess.map(async ({ edge, label, targetHandleLabel }) => {
        const sourceNode = nodes.find((node: Node) => node.id === edge.source);
        const nodeType = sourceNode?.type || '';
        const nodeDef = nodeDefinitions[nodeType];

        // Determine output key from sourceHandle (edge-aware for multi-output nodes)
        let outputKey = 'output_0';
        if (edge.sourceHandle && edge.sourceHandle.startsWith('output-')) {
          const handleName = edge.sourceHandle.replace('output-', '');
          outputKey = `output_${handleName}`;
        }

        let executionData = await getNodeOutput(edge.source, outputKey);

        // Fallback to output_0 if specific handle output not found
        if (!executionData && outputKey !== 'output_0') {
          executionData = await getNodeOutput(edge.source, 'output_0');
        }
        let inputData: any = null;
        let outputSchema: Record<string, any>;
        let hasExecutionData = false;

        if (executionData && executionData[0] && executionData[0][0]) {
          const rawData = executionData[0][0].json || executionData[0][0];
          if (typeof rawData === 'object' && rawData !== null) {
            inputData = rawData;
            outputSchema = rawData;
            hasExecutionData = true;
          } else {
            inputData = { value: rawData };
            outputSchema = { value: typeof rawData };
            hasExecutionData = true;
          }
        } else {
          hasExecutionData = false;

          if (nodeType === 'start') {
            try {
              const initialData = sourceNode?.data?.initialData || '{}';
              outputSchema = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
            } catch (e) {
              outputSchema = {};
            }
          } else {
            const sampleSchemas: Record<string, Record<string, any>> = {
              location: { latitude: 'number', longitude: 'number', accuracy: 'number', provider: 'string', altitude: 'number' },
              ai: { response: 'string', thinking: 'string', model: 'string', provider: 'string', finish_reason: 'string', timestamp: 'string' },
              file: { fileName: 'string', fileSize: 'number' },
              whatsapp: {
                message_id: 'string',
                sender: 'string',
                sender_phone: 'string',
                chat_id: 'string',
                message_type: 'string',
                text: 'string',
                timestamp: 'string',
                is_group: 'boolean',
                is_from_me: 'boolean',
                push_name: 'string',
                media: 'object',
                group_info: {
                  group_jid: 'string',
                  sender_jid: 'string',
                  sender_phone: 'string',
                  sender_name: 'string'
                }
              },
              whatsappDb: {
                // Output varies by operation - this shows chat_history output
                operation: 'string',
                // chat_history output
                messages: [
                  {
                    text: 'string',
                    sender: 'string',
                    sender_phone: 'string',
                    message_type: 'string',
                    timestamp: 'string',
                    message_id: 'string',
                    is_from_me: 'boolean',
                    is_group: 'boolean',
                    push_name: 'string',
                    index: 'number'
                  }
                ],
                total: 'number',
                has_more: 'boolean',
                count: 'number',
                chat_type: 'string',
                // search_groups / list_contacts output
                groups: [{ jid: 'string', name: 'string', participant_count: 'number' }],
                contacts: [{ jid: 'string', phone: 'string', name: 'string', push_name: 'string' }],
                // get_group_info output
                participants: [{ jid: 'string', phone: 'string', name: 'string', is_admin: 'boolean' }],
                // get_contact_info output
                jid: 'string',
                phone: 'string',
                name: 'string',
                push_name: 'string',
                business_name: 'string',
                is_business: 'boolean',
                is_contact: 'boolean',
                profile_pic: 'string',
                timestamp: 'string'
              },
              webhook: {
                method: 'string',
                path: 'string',
                headers: 'object',
                query: 'object',
                body: 'string',
                json: 'object'
              },
              // Twitter node output schemas
              twitter: {
                tweet_id: 'string',
                text: 'string',
                author_id: 'string',
                created_at: 'string',
                action: 'string'
              },
              twitterSearch: {
                tweets: [{
                  id: 'string',
                  text: 'string',
                  author_id: 'string',
                  created_at: 'string'
                }],
                count: 'number',
                query: 'string'
              },
              twitterUser: {
                id: 'string',
                username: 'string',
                name: 'string',
                profile_image_url: 'string',
                verified: 'boolean'
              },
              // Gmail node output schemas
              gmail: {
                message_id: 'string',
                thread_id: 'string',
                to: 'string',
                subject: 'string',
                label_ids: 'array'
              },
              gmailSearch: {
                messages: [{
                  message_id: 'string',
                  thread_id: 'string',
                  from: 'string',
                  to: 'string',
                  subject: 'string',
                  date: 'string',
                  snippet: 'string',
                  labels: 'array'
                }],
                count: 'number',
                query: 'string',
                result_size_estimate: 'number'
              },
              gmailRead: {
                message_id: 'string',
                thread_id: 'string',
                from: 'string',
                to: 'string',
                cc: 'string',
                subject: 'string',
                date: 'string',
                snippet: 'string',
                body: 'string',
                labels: 'array',
                attachments: 'array'
              },
              // Google Calendar
              calendarCreate: {
                event_id: 'string',
                title: 'string',
                start: 'string',
                end: 'string',
                description: 'string',
                location: 'string',
                html_link: 'string',
                status: 'string'
              },
              calendarList: {
                events: 'array',
                count: 'number'
              },
              calendarUpdate: {
                event_id: 'string',
                title: 'string',
                start: 'string',
                end: 'string',
                updated: 'string'
              },
              calendarDelete: {
                deleted: 'boolean',
                event_id: 'string'
              },
              // Google Drive
              driveUpload: {
                file_id: 'string',
                name: 'string',
                mime_type: 'string',
                web_view_link: 'string',
                web_content_link: 'string',
                size: 'number'
              },
              driveDownload: {
                file_id: 'string',
                name: 'string',
                content: 'string',
                mime_type: 'string',
                size: 'number'
              },
              driveList: {
                files: 'array',
                count: 'number',
                next_page_token: 'string'
              },
              driveShare: {
                file_id: 'string',
                permission_id: 'string',
                role: 'string',
                email: 'string'
              },
              // Google Sheets
              sheetsRead: {
                values: 'array',
                range: 'string',
                rows: 'number',
                columns: 'number',
                major_dimension: 'string'
              },
              sheetsWrite: {
                updated_range: 'string',
                updated_rows: 'number',
                updated_columns: 'number',
                updated_cells: 'number'
              },
              sheetsAppend: {
                updated_range: 'string',
                updated_rows: 'number',
                updated_columns: 'number',
                updated_cells: 'number',
                table_range: 'string'
              },
              // Google Tasks
              tasksCreate: {
                task_id: 'string',
                title: 'string',
                notes: 'string',
                due: 'string',
                status: 'string'
              },
              tasksList: {
                tasks: 'array',
                count: 'number'
              },
              tasksComplete: {
                task_id: 'string',
                title: 'string',
                status: 'string',
                completed: 'string'
              },
              tasksUpdate: {
                task_id: 'string',
                title: 'string',
                notes: 'string',
                due: 'string',
                status: 'string'
              },
              tasksDelete: {
                deleted: 'boolean',
                task_id: 'string'
              },
              // Google Contacts (People API)
              contactsCreate: {
                resource_name: 'string',
                display_name: 'string',
                email: 'string',
                phone: 'string',
                company: 'string'
              },
              contactsList: {
                contacts: 'array',
                count: 'number',
                total_people: 'number',
                next_page_token: 'string'
              },
              contactsSearch: {
                contacts: 'array',
                count: 'number'
              },
              contactsGet: {
                resource_name: 'string',
                display_name: 'string',
                given_name: 'string',
                family_name: 'string',
                email: 'string',
                phone: 'string',
                company: 'string',
                job_title: 'string'
              },
              contactsUpdate: {
                resource_name: 'string',
                display_name: 'string',
                email: 'string',
                phone: 'string'
              },
              contactsDelete: {
                deleted: 'boolean',
                resource_name: 'string'
              },
              httpRequest: {
                status: 'number',
                data: 'any',
                headers: 'object',
                url: 'string',
                method: 'string'
              },
              python: { output: 'any' },
              javascript: { output: 'any' },
              memory: {
                session_id: 'string',
                messages: 'array',
                message_count: 'number',
                memory_type: 'string',
                window_size: 'number'
              },
              cronScheduler: {
                timestamp: 'string',
                iteration: 'number',
                start_mode: 'string',
                frequency: 'string',
                timezone: 'string',
                schedule: 'string',
                scheduled_time: 'string',
                triggered_at: 'string',
                waited_seconds: 'number',
                message: 'string'
              },
              // Android service schemas
              android: {
                service_id: 'string',
                action: 'string',
                data: 'object',
                success: 'boolean'
              },
              batteryMonitor: {
                battery_level: 'number',
                is_charging: 'boolean',
                temperature_celsius: 'number',
                health: 'string',
                voltage: 'number'
              },
              systemInfo: {
                device_model: 'string',
                android_version: 'string',
                api_level: 'number',
                manufacturer: 'string',
                total_memory: 'number',
                available_memory: 'number'
              },
              networkMonitor: {
                connected: 'boolean',
                type: 'string',
                wifi_ssid: 'string',
                ip_address: 'string'
              },
              wifiAutomation: {
                wifi_enabled: 'boolean',
                ssid: 'string',
                ip_address: 'string',
                signal_strength: 'number'
              },
              bluetoothAutomation: {
                bluetooth_enabled: 'boolean',
                paired_devices: 'array',
                connected_devices: 'array'
              },
              audioAutomation: {
                music_volume: 'number',
                ring_volume: 'number',
                muted: 'boolean'
              },
              androidLocation: {
                latitude: 'number',
                longitude: 'number',
                accuracy: 'number',
                provider: 'string',
                altitude: 'number',
                speed: 'number',
                bearing: 'number'
              },
              appLauncher: {
                package_name: 'string',
                launched: 'boolean',
                app_name: 'string'
              },
              appList: {
                apps: 'array',
                count: 'number'
              },
              deviceStateAutomation: {
                airplane_mode: 'boolean',
                screen_on: 'boolean',
                brightness: 'number'
              },
              screenControlAutomation: {
                brightness: 'number',
                auto_brightness: 'boolean',
                screen_timeout: 'number'
              },
              airplaneModeControl: {
                airplane_mode_enabled: 'boolean'
              },
              motionDetection: {
                accelerometer: { x: 'number', y: 'number', z: 'number' },
                gyroscope: { x: 'number', y: 'number', z: 'number' },
                motion_detected: 'boolean'
              },
              environmentalSensors: {
                temperature: 'number',
                humidity: 'number',
                pressure: 'number',
                light_level: 'number'
              },
              cameraControl: {
                cameras: 'array',
                photo_path: 'string',
                success: 'boolean'
              },
              mediaControl: {
                volume: 'number',
                is_playing: 'boolean',
                current_track: 'string'
              },
              chatTrigger: {
                message: 'string',
                timestamp: 'string',
                session_id: 'string'
              },
              taskTrigger: {
                task_id: 'string',
                status: 'string',      // 'completed' or 'error'
                agent_name: 'string',
                agent_node_id: 'string',
                parent_node_id: 'string',
                result: 'string',      // Present when status='completed'
                error: 'string',       // Present when status='error'
                workflow_id: 'string',
              },
              // Social nodes schema (4 output handles)
              social: {
                // Output 1: message text for LLM input
                message: 'string',
                // Output 2: media data
                media: {
                  url: 'string',
                  type: 'string',
                  mimetype: 'string',
                  caption: 'string',
                  size: 'number',
                  thumbnail: 'string',
                  filename: 'string'
                },
                // Output 3: contact/sender info
                contact: {
                  sender: 'string',
                  sender_phone: 'string',
                  sender_name: 'string',
                  sender_username: 'string',
                  channel: 'string',
                  is_group: 'boolean',
                  group_info: 'object',
                  chat_title: 'string'
                },
                // Output 4: message metadata
                metadata: {
                  message_id: 'string',
                  chat_id: 'string',
                  timestamp: 'string',
                  message_type: 'string',
                  is_from_me: 'boolean',
                  is_forwarded: 'boolean',
                  reply_to: 'object',
                  thread_id: 'string'
                },
                // Backwards compatibility - also available at top level
                message_id: 'string',
                sender: 'string',
                sender_phone: 'string',
                sender_name: 'string',
                chat_id: 'string',
                channel: 'string',
                text: 'string',
                timestamp: 'string',
                is_group: 'boolean',
                is_from_me: 'boolean'
              },
              socialSend: {
                success: 'boolean',
                message_id: 'string',
                channel: 'string',
                recipient: 'string',
                message_type: 'string',
                timestamp: 'string'
              },
              // Document processing schemas
              httpScraper: {
                items: 'array',
                item_count: 'number',
                errors: 'array'
              },
              fileDownloader: {
                downloaded: 'number',
                skipped: 'number',
                failed: 'number',
                files: 'array',
                output_dir: 'string'
              },
              documentParser: {
                documents: 'array',
                parsed_count: 'number',
                failed: 'array'
              },
              textChunker: {
                chunks: 'array',
                chunk_count: 'number'
              },
              embeddingGenerator: {
                embeddings: 'array',
                embedding_count: 'number',
                dimensions: 'number',
                chunks: 'array'
              },
              vectorStore: {
                stored_count: 'number',
                matches: 'array',
                collection_name: 'string',
                backend: 'string'
              }
            };

            // Node type detection
            const isMemory = nodeType === 'simpleMemory';
            const nodeTypeLower = nodeType.toLowerCase();
            // AI agent types that use the AI output schema
            const aiAgentTypes = ['aiAgent', 'chatAgent', 'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent', 'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent', 'autonomous_agent', 'orchestrator_agent'];
            const isAI = !isMemory && (nodeTypeLower.includes('chatmodel') || aiAgentTypes.includes(nodeType));
            const isFile = nodeType.includes('file');
            const isWhatsAppDb = nodeType === 'whatsappDb';
            const isWhatsApp = !isWhatsAppDb && (nodeType.includes('whatsapp') || nodeType.includes('Whatsapp'));
            const isWebhook = nodeType === 'webhookTrigger';
            const isHttpRequest = nodeType === 'httpRequest';
            const isPython = nodeType.includes('python') || nodeType.includes('Python');
            const isJavaScript = nodeType.includes('javascript') || nodeType.includes('Javascript');
            const isCodeExecutor = isPython || isJavaScript;
            const isCronScheduler = nodeType === 'cronScheduler';
            const isChatTrigger = nodeType === 'chatTrigger';
            const isTaskTrigger = nodeType === 'taskTrigger';
            const isSocialReceive = nodeType === 'socialReceive';
            const isSocialSend = nodeType === 'socialSend';
            const isGmailSend = nodeType === 'gmailSend';
            const isGmailSearch = nodeType === 'gmailSearch';
            const isGmailRead = nodeType === 'gmailRead';

            // Google Workspace nodes detection
            const googleWorkspaceNodeTypes = [
              'calendarCreate', 'calendarList', 'calendarUpdate', 'calendarDelete',
              'driveUpload', 'driveDownload', 'driveList', 'driveShare',
              'sheetsRead', 'sheetsWrite', 'sheetsAppend',
              'tasksCreate', 'tasksList', 'tasksComplete', 'tasksUpdate', 'tasksDelete',
              'contactsCreate', 'contactsList', 'contactsSearch', 'contactsGet', 'contactsUpdate', 'contactsDelete'
            ];
            const isGoogleWorkspaceNode = googleWorkspaceNodeTypes.includes(nodeType);

            // Document processing node detection
            const documentNodeTypes = ['httpScraper', 'fileDownloader', 'documentParser', 'textChunker', 'embeddingGenerator', 'vectorStore'];
            const isDocumentNode = documentNodeTypes.includes(nodeType);

            // Android service node detection - check for specific Android node types
            const androidNodeTypes = [
              'batteryMonitor', 'systemInfo', 'networkMonitor',
              'wifiAutomation', 'bluetoothAutomation', 'audioAutomation',
              'deviceStateAutomation', 'screenControlAutomation', 'airplaneModeControl',
              'motionDetection', 'environmentalSensors', 'cameraControl', 'mediaControl',
              'appLauncher', 'appList'
            ];
            const isAndroidNode = androidNodeTypes.includes(nodeType);
            const isAndroidLocation = nodeType === 'location';

            // Location nodes (Google Maps, not Android location)
            const isLocationNode = nodeType.includes('location') && !isAndroidLocation;
            const isGoogleMaps = nodeType === 'gmaps_create' || nodeType === 'gmaps_locations' || nodeType === 'gmaps_nearby_places';

            // Select appropriate schema
            if (isAndroidLocation) {
              outputSchema = sampleSchemas.androidLocation;
            } else if (isAndroidNode && sampleSchemas[nodeType as keyof typeof sampleSchemas]) {
              outputSchema = sampleSchemas[nodeType as keyof typeof sampleSchemas];
            } else if (isDocumentNode && sampleSchemas[nodeType as keyof typeof sampleSchemas]) {
              outputSchema = sampleSchemas[nodeType as keyof typeof sampleSchemas];
            } else if (isGoogleWorkspaceNode && sampleSchemas[nodeType as keyof typeof sampleSchemas]) {
              outputSchema = sampleSchemas[nodeType as keyof typeof sampleSchemas];
            } else {
              outputSchema = isLocationNode || isGoogleMaps ? sampleSchemas.location :
                            isMemory ? sampleSchemas.memory :
                            isAI ? sampleSchemas.ai :
                            isFile ? sampleSchemas.file :
                            isWhatsAppDb ? sampleSchemas.whatsappDb :
                            isWhatsApp ? sampleSchemas.whatsapp :
                            isGmailSend ? sampleSchemas.gmail :
                            isGmailSearch ? sampleSchemas.gmailSearch :
                            isGmailRead ? sampleSchemas.gmailRead :
                            isWebhook ? sampleSchemas.webhook :
                            isHttpRequest ? sampleSchemas.httpRequest :
                            isCodeExecutor ? sampleSchemas.python :
                            isCronScheduler ? sampleSchemas.cronScheduler :
                            isChatTrigger ? sampleSchemas.chatTrigger :
                            isTaskTrigger ? sampleSchemas.taskTrigger :
                            isSocialReceive ? sampleSchemas.social :
                            isSocialSend ? sampleSchemas.socialSend :
                            { data: 'any' };
            }

            // Filter schema for multi-output nodes based on connected handle
            // When connected via specific output handle, show only that handle's schema
            if (isSocialReceive && edge.sourceHandle && edge.sourceHandle.startsWith('output-')) {
              const handleName = edge.sourceHandle.replace('output-', '');
              const socialSchema = sampleSchemas.social as Record<string, any>;
              if (handleName && socialSchema[handleName]) {
                // Show only the specific output's schema
                outputSchema = typeof socialSchema[handleName] === 'object'
                  ? socialSchema[handleName]
                  : { [handleName]: socialSchema[handleName] };
              }
            }
          }
        }

        const baseName = sourceNode?.data?.label || nodeDef?.displayName || nodeType;

        // Build display name with handle info for multi-output and multi-input nodes
        let displayName = baseName;
        let handleSuffix = '';

        // Add source handle (output) info: "Node → message"
        if (edge.sourceHandle && edge.sourceHandle.startsWith('output-')) {
          const handleName = edge.sourceHandle.replace('output-', '');
          handleSuffix = handleName;
          displayName = `${baseName} → ${handleName}`;
        }

        // Add target handle (input) info: "Node (skill)" or "Node → message (skill)"
        if (targetHandleLabel) {
          displayName = `${displayName} (${targetHandleLabel})`;
          handleSuffix = handleSuffix ? `${handleSuffix}-${targetHandleLabel}` : targetHandleLabel;
        }

        // Add inherited label: "Node (via Parent)"
        if (label) {
          displayName = `${displayName} (${label})`;
        }

        // Use unique key combining source node ID, source handle, and target handle
        // to avoid duplicate keys when multiple edges connect the same nodes
        const uniqueId = handleSuffix ? `${edge.source}-${handleSuffix}` : edge.source;

        return {
          id: uniqueId,
          sourceNodeId: edge.source, // Keep original node ID for template variable resolution
          name: displayName,
          type: nodeType,
          icon: nodeDef?.icon || '',
          inputData,
          outputSchema,
          hasExecutionData
        };
      });

      const nodeDataResults = await Promise.all(nodeDataPromises);
      setConnectedNodes(nodeDataResults);
      // Auto-expand all nodes initially
      setExpandedNodes(new Set(nodeDataResults.map(n => n.id)));
      setLoading(false);
    };

    fetchConnectedNodes();
  }, [nodeId, currentWorkflow, getNodeOutput]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Render draggable property
  // NOTE: sourceNodeId is the unique node ID, used for template variable resolution
  const renderDraggableProperty = (key: string, value: any, sourceNodeId: string, path: string = '', depth: number = 0, maxArrayItems: number = 3) => {
    const currentPath = path ? `${path}.${key}` : key;
    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    const isArray = Array.isArray(value);

    // Handle arrays - show indexed items
    if (isArray && value.length > 0) {
      const templateName = getTemplateVariableName(sourceNodeId);
      const itemsToShow = Math.min(value.length, maxArrayItems);

      return (
        <div key={currentPath} style={{ marginLeft: depth > 0 ? 16 : 0, marginBottom: 8 }}>
          <div style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.textMuted,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {key}
            <span style={{
              fontSize: '10px',
              color: theme.dracula.purple,
              padding: '1px 6px',
              backgroundColor: theme.dracula.purple + '20',
              borderRadius: theme.borderRadius.sm,
            }}>
              [{value.length} items]
            </span>
          </div>
          <div>
            {/* Render first N array items with their index */}
            {value.slice(0, itemsToShow).map((item: any, index: number) => {
              const indexedPath = `${key}[${index}]`;
              const fullIndexedPath = path ? `${path}.${indexedPath}` : indexedPath;

              if (typeof item === 'object' && item !== null) {
                // Object item - render its properties with indexed path
                return (
                  <div key={`${currentPath}[${index}]`} style={{
                    marginLeft: 8,
                    marginBottom: 8,
                    padding: theme.spacing.xs,
                    backgroundColor: theme.colors.backgroundElevated,
                    borderRadius: theme.borderRadius.sm,
                    border: `1px dashed ${theme.colors.border}`,
                  }}>
                    <div style={{
                      fontSize: theme.fontSize.xs,
                      fontWeight: theme.fontWeight.medium,
                      color: theme.dracula.cyan,
                      marginBottom: 4,
                    }}>
                      [{index}]
                    </div>
                    {Object.entries(item).map(([itemKey, itemValue]) => {
                      const itemPath = `${fullIndexedPath}.${itemKey}`;
                      // For nested objects within array items, render as draggable
                      if (typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue)) {
                        return (
                          <div key={itemPath} style={{ marginLeft: 8, marginBottom: 4 }}>
                            <div style={{
                              fontSize: theme.fontSize.xs,
                              color: theme.colors.textMuted,
                              marginBottom: 2,
                            }}>
                              {itemKey}:
                            </div>
                            {Object.entries(itemValue as Record<string, any>).map(([nestedKey, nestedValue]) => (
                              <div
                                key={`${itemPath}.${nestedKey}`}
                                draggable
                                onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, `${itemPath}.${nestedKey}`, nestedValue)}
                                style={{
                                  marginBottom: 4,
                                  marginLeft: 8,
                                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                  backgroundColor: theme.colors.backgroundAlt,
                                  border: `1px solid ${theme.colors.focus}`,
                                  borderRadius: theme.borderRadius.sm,
                                  cursor: 'grab',
                                  fontSize: theme.fontSize.xs,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = theme.colors.focusRing;
                                  e.currentTarget.style.borderColor = theme.dracula.cyan;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                                  e.currentTarget.style.borderColor = theme.colors.focus;
                                }}
                              >
                                <span style={{ color: theme.colors.templateVariable, fontFamily: 'monospace' }}>
                                  {`{{${templateName}.${itemPath}.${nestedKey}}}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      // Primitive value in array item
                      return (
                        <div
                          key={itemPath}
                          draggable
                          onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, itemPath, itemValue)}
                          style={{
                            marginBottom: 4,
                            marginLeft: 8,
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            backgroundColor: theme.colors.backgroundAlt,
                            border: `1px solid ${theme.colors.focus}`,
                            borderRadius: theme.borderRadius.sm,
                            cursor: 'grab',
                            fontSize: theme.fontSize.xs,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.focusRing;
                            e.currentTarget.style.borderColor = theme.dracula.cyan;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                            e.currentTarget.style.borderColor = theme.colors.focus;
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ color: theme.colors.templateVariable, fontFamily: 'monospace' }}>
                                {`{{${templateName}.${itemPath}}}`}
                              </span>
                              <span style={{ color: theme.colors.textMuted, marginLeft: 8 }}>
                                {itemKey}: {typeof itemValue}
                              </span>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.colors.templateVariable} strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <polyline points="19 12 12 19 5 12"/>
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                // Primitive array item
                return (
                  <div
                    key={`${currentPath}[${index}]`}
                    draggable
                    onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, fullIndexedPath, item)}
                    style={{
                      marginBottom: 4,
                      marginLeft: 8,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: theme.colors.backgroundAlt,
                      border: `1px solid ${theme.colors.focus}`,
                      borderRadius: theme.borderRadius.sm,
                      cursor: 'grab',
                      fontSize: theme.fontSize.xs,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.focusRing;
                      e.currentTarget.style.borderColor = theme.dracula.cyan;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                      e.currentTarget.style.borderColor = theme.colors.focus;
                    }}
                  >
                    <span style={{ color: theme.colors.templateVariable, fontFamily: 'monospace' }}>
                      {`{{${templateName}.${fullIndexedPath}}}`}
                    </span>
                    <span style={{ color: theme.colors.textMuted, marginLeft: 8 }}>
                      [{index}]: {typeof item}
                    </span>
                  </div>
                );
              }
            })}
            {/* Show "and N more" if array has more items */}
            {value.length > maxArrayItems && (
              <div style={{
                marginLeft: 8,
                fontSize: theme.fontSize.xs,
                color: theme.colors.textMuted,
                fontStyle: 'italic',
              }}>
                ... and {value.length - maxArrayItems} more items
              </div>
            )}
          </div>
        </div>
      );
    }

    // Handle empty arrays
    if (isArray && value.length === 0) {
      return (
        <div key={currentPath} style={{ marginLeft: depth > 0 ? 16 : 0, marginBottom: 8 }}>
          <div style={{
            fontSize: theme.fontSize.xs,
            color: theme.colors.textMuted,
          }}>
            {key}: <span style={{ fontStyle: 'italic' }}>empty array</span>
          </div>
        </div>
      );
    }

    // Handle objects
    if (isObject) {
      return (
        <div key={currentPath} style={{ marginLeft: depth > 0 ? 16 : 0, marginBottom: 8 }}>
          <div style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.textMuted,
            marginBottom: 4,
          }}>
            {key}:
          </div>
          <div>
            {Object.entries(value as Record<string, any>).map(([subKey, subValue]) =>
              renderDraggableProperty(subKey, subValue, sourceNodeId, currentPath, depth + 1)
            )}
          </div>
        </div>
      );
    }

    const templateName = getTemplateVariableName(sourceNodeId);
    return (
      <div
        key={currentPath}
        draggable
        onDragStart={(e) => handleVariableDragStart(e, sourceNodeId, currentPath, value)}
        style={{
          marginBottom: 8,
          marginLeft: depth > 0 ? 16 : 0,
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.backgroundAlt,
          border: `1px solid ${theme.colors.focus}`,
          borderRadius: theme.borderRadius.md,
          cursor: 'grab',
          transition: theme.transitions.fast,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.focusRing;
          e.currentTarget.style.borderColor = theme.dracula.cyan;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
          e.currentTarget.style.borderColor = theme.colors.focus;
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.medium,
              color: theme.colors.templateVariable,
              marginBottom: 2,
            }}>
              {`{{${templateName}.${currentPath}}}`}
            </div>
            <div style={{
              fontSize: theme.fontSize.xs,
              color: theme.colors.textSecondary,
            }}>
              {key}: {typeof value}
            </div>
          </div>
          {/* Drag icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.templateVariable} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>
      </div>
    );
  };

  if (!visible) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.backgroundPanel,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: `3px solid ${theme.colors.border}`,
          borderTopColor: theme.dracula.cyan,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: theme.spacing.lg,
        }} />
        <style>
          {`@keyframes spin { to { transform: rotate(360deg); } }`}
        </style>
        <div style={{
          fontSize: theme.fontSize.sm,
          color: theme.colors.textSecondary,
        }}>
          Loading input data...
        </div>
      </div>
    );
  }

  // Empty state
  if (connectedNodes.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.backgroundPanel,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
      }}>
        {/* Link icon */}
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: theme.spacing.lg }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <div style={{
          fontSize: theme.fontSize.base,
          fontWeight: theme.fontWeight.medium,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xs,
        }}>
          No connected inputs
        </div>
        <div style={{
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          textAlign: 'center',
        }}>
          Connect nodes to see input data and available variables
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.backgroundPanel,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: `${theme.spacing.md} ${theme.spacing.lg}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flexShrink: 0,
      }}>
        {/* Database icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
        <span style={{
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.semibold,
          color: theme.colors.text,
        }}>
          Input Data & Variables
        </span>
        <span style={{
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.medium,
          color: theme.dracula.cyan,
          padding: `2px ${theme.spacing.sm}`,
          backgroundColor: theme.dracula.cyan + '20',
          borderRadius: theme.borderRadius.sm,
        }}>
          {connectedNodes.length}
        </span>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: theme.spacing.md,
      }}>
        {connectedNodes.map((node) => {
          const isExpanded = expandedNodes.has(node.id);

          return (
            <div key={node.id} style={{
              marginBottom: theme.spacing.md,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderLeft: `3px solid ${node.hasExecutionData ? theme.dracula.green : theme.dracula.orange}`,
              borderRadius: theme.borderRadius.md,
              overflow: 'hidden',
            }}>
              {/* Node Header */}
              <div
                onClick={() => toggleNode(node.id)}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  backgroundColor: theme.colors.backgroundAlt,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: theme.transitions.fast,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  {renderNodeIcon(node.icon, 18)}
                  <span style={{
                    fontSize: theme.fontSize.sm,
                    fontWeight: theme.fontWeight.semibold,
                    color: theme.colors.text,
                  }}>
                    {node.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  {/* Status badge */}
                  <span style={{
                    fontSize: '10px',
                    fontWeight: theme.fontWeight.medium,
                    color: node.hasExecutionData ? theme.dracula.green : theme.dracula.orange,
                    padding: `2px ${theme.spacing.xs}`,
                    backgroundColor: node.hasExecutionData ? theme.dracula.green + '20' : theme.dracula.orange + '20',
                    borderRadius: theme.borderRadius.sm,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {node.hasExecutionData ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={theme.dracula.green} stroke="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={theme.dracula.orange} stroke="none">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                      </svg>
                    )}
                    {node.hasExecutionData ? 'LIVE' : 'SCHEMA'}
                  </span>
                  {/* Expand arrow */}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Node Content */}
              {isExpanded && (
                <div style={{
                  padding: theme.spacing.md,
                  borderTop: `1px solid ${theme.colors.border}`,
                }}>
                  {/* Schema info banner */}
                  {!node.hasExecutionData && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      marginBottom: theme.spacing.md,
                      backgroundColor: theme.dracula.cyan + '10',
                      border: `1px solid ${theme.dracula.cyan}40`,
                      borderRadius: theme.borderRadius.sm,
                      fontSize: theme.fontSize.xs,
                      color: theme.dracula.cyan,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={theme.dracula.cyan} stroke="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                      </svg>
                      Schema view - Execute this node to see actual input data
                    </div>
                  )}

                  {/* Live data preview */}
                  {node.hasExecutionData && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <div style={{
                        fontSize: theme.fontSize.xs,
                        fontWeight: theme.fontWeight.medium,
                        color: theme.colors.textMuted,
                        marginBottom: theme.spacing.xs,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Received Data
                      </div>
                      <pre style={{
                        margin: 0,
                        padding: theme.spacing.sm,
                        fontSize: theme.fontSize.xs,
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                        backgroundColor: theme.colors.backgroundElevated,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                        overflow: 'auto',
                        maxHeight: '120px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: theme.dracula.foreground,
                      }}>
                        {JSON.stringify(node.inputData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Draggable variables */}
                  <div style={{
                    fontSize: theme.fontSize.xs,
                    fontWeight: theme.fontWeight.medium,
                    color: theme.colors.textMuted,
                    marginBottom: theme.spacing.sm,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Drag Variables to Parameters
                  </div>
                  <div>
                    {typeof node.outputSchema === 'object' && node.outputSchema !== null
                      ? Object.entries(node.outputSchema).map(([key, value]) =>
                          renderDraggableProperty(key, value, node.sourceNodeId || node.id)
                        )
                      : (
                        <div style={{
                          fontSize: theme.fontSize.sm,
                          color: theme.colors.textMuted,
                          fontStyle: 'italic',
                        }}>
                          No variables available
                        </div>
                      )
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        fontSize: theme.fontSize.xs,
        color: theme.colors.textMuted,
        textAlign: 'center',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Drag variables into parameter fields to use them
      </div>
    </div>
  );
};

export default InputSection;
