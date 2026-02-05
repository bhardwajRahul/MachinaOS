# Temporal Distributed Node Execution Architecture

## Overview

Each workflow node executes as an **independent Temporal activity** with its own isolated context, enabling horizontal scaling across distributed workers.

## System Architecture

```
                        TEMPORAL SERVER (port 7233)
                                  |
              Task Queue: machina-tasks
  +---------------------------------------------------------------+
  |  Workflow: MachinaWorkflow (orchestrator only)                |
  |  - Parses graph structure from React Flow                     |
  |  - Filters config nodes (tools, memory, services)             |
  |  - Schedules node activities (FIRST_COMPLETED pattern)        |
  |  - Collects results and routes outputs to dependent nodes     |
  +---------------------------------------------------------------+
                                  |
          Activity Queue (distributed to workers)
    +--------+  +--------+  +--------+  +--------+
    | Node A |  | Node B |  | Node C |  | Node D |
    +--------+  +--------+  +--------+  +--------+
         |          |           |           |
         v          v           v           v
  +----------+  +----------+  +----------+  +----------+
  | Worker 1 |  | Worker 2 |  | Worker 3 |  | Worker N |
  | aiAgent  |  | timer    |  | console  |  | http     |
  +----------+  +----------+  +----------+  +----------+
         |          |           |           |
         +----------+-----------+-----------+
                           |
                           v WebSocket
                   +----------------+
                   | MachinaOs      |
                   | /ws/internal   |
                   +----------------+
```

## Key Architecture Principles

### 1. Node = Independent Activity

Each node runs as a separate Temporal activity with:
- **Own context** - No shared mutable state between nodes
- **Own retry policy** - Failed nodes retry independently (up to 3 attempts)
- **Own timeout** - Long AI nodes don't block short nodes (10 min default)
- **Own worker** - Can execute on any available worker in the cluster

### 2. Workflow = Pure Orchestrator

The workflow ONLY orchestrates:
- Parses the graph structure from React Flow nodes/edges
- Filters out config nodes (tools, memory, model configs)
- Determines execution order based on dependencies
- Schedules activities using FIRST_COMPLETED pattern
- Collects results and routes outputs to dependent nodes

**NO business logic in workflow** - all execution happens in activities.

### 3. Context Passing (Immutable)

Each node receives an immutable context snapshot:

```python
context = {
    "node_id": "aiAgent-123",
    "node_type": "aiAgent",
    "node_data": {
        "model": "gpt-4",
        "prompt": "{{chattrigger.message}}",
        "systemMessage": "You are a helpful assistant"
    },
    "inputs": {  # Outputs from upstream nodes
        "chatTrigger-456": {"message": "Hello", "timestamp": "..."},
    },
    "workflow_id": "workflow-789",
    "session_id": "session-xyz",
    "nodes": [...],  # Full list for tool/memory detection
    "edges": [...],  # Full list for tool/memory detection
}
```

## Execution Flow

### 1. Workflow Receives Request

```
MachinaOs Server
       |
       v execute_workflow()
TemporalExecutor
       |
       v client.execute_workflow()
Temporal Server
       |
       v schedules workflow task
MachinaWorkflow.run()
```

### 2. Workflow Orchestrates Nodes (FIRST_COMPLETED Pattern)

```python
# 1. Filter config nodes
exec_nodes, exec_edges = self._filter_executable_graph(nodes, edges)

# 2. Build dependency graph
deps, node_map = self._build_dependency_maps(exec_nodes, exec_edges)

# 3. Handle pre-executed triggers
for node in exec_nodes:
    if node.get("_pre_executed"):
        completed.add(node["id"])

# 4. Continuous scheduling loop
while True:
    ready = self._find_ready_nodes(deps, completed, running, node_map)

    for node_id in ready:
        handle = workflow.start_activity(
            "execute_node_activity",
            args=[context],
            start_to_close_timeout=timedelta(minutes=10),
        )
        running[node_id] = handle

    if not running:
        break

    done_id, result = await self._wait_any_complete(running)
    completed.add(done_id)
    outputs[done_id] = result
```

### 3. Activity Executes Node via WebSocket

```python
@activity.defn
async def execute_node_activity(self, context: Dict) -> Dict:
    node_id = context["node_id"]
    node_type = context["node_type"]

    # Execute via WebSocket to MachinaOs
    async with self.session.ws_connect(self.ws_url) as ws:
        await ws.send_json({
            "type": "execute_node",
            "node_id": node_id,
            "node_type": node_type,
            "parameters": context["node_data"],
            ...
        })

        # Wait for response
        async for msg in ws:
            if msg.data["request_id"] == request_id:
                return msg.data

    return result
```

## Connection Pooling

Activities use a shared aiohttp.ClientSession for connection pooling:

```python
class NodeExecutionActivities:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session  # Shared session with connection pool

    @activity.defn
    async def execute_node_activity(self, context: Dict) -> Dict:
        # Each activity gets its own WebSocket from the pool
        async with self.session.ws_connect(self.ws_url) as ws:
            await ws.send_json(message)
            async for msg in ws:
                return msg.data

# Session configuration
connector = aiohttp.TCPConnector(
    limit=100,              # Max connections in pool
    limit_per_host=100,     # Max connections per host
    enable_cleanup_closed=True,
)
session = aiohttp.ClientSession(connector=connector)
```

Benefits:
- **No race conditions** - Each activity has exclusive WebSocket
- **Connection reuse** - TCP connections are pooled and reused
- **Configurable limits** - Control max concurrent connections

## Scaling Patterns

### Horizontal Worker Scaling

```
                 Temporal Server
                       |
       +---------------+---------------+
       v               v               v
  +---------+     +---------+     +---------+
  |Worker 1 |     |Worker 2 |     |Worker 3 |
  | Node A  |     | Node B  |     | Node C  |
  | Node D  |     | Node E  |     | Node F  |
  +---------+     +---------+     +---------+

Add more workers = handle more concurrent nodes
```

### Specialized Worker Pools (Future)

```
Queue: machina-tasks-cpu     Queue: machina-tasks-gpu
         |                             |
    +----+----+                   +----+----+
    v         v                   v         v
+-------+ +-------+           +-------+ +-------+
|CPU    | |CPU    |           |GPU    | |GPU    |
|Worker | |Worker |           |Worker | |Worker |
|timer  | |http   |           |aiAgent| |aiAgent|
+-------+ +-------+           +-------+ +-------+

Route AI nodes to GPU workers, light nodes to CPU workers
```

## Config Node Filtering

Certain nodes provide configuration rather than executing:

```python
# Config handles - nodes connecting via these are filtered out
CONFIG_HANDLES = {"input-tools", "input-memory", "input-model"}

# Android service types (connect to androidTool)
ANDROID_SERVICE_TYPES = {
    "batteryMonitor", "locationService", "deviceState",
    "systemInfo", "appList", "appLauncher",
}
```

Config nodes are:
- Filtered from the execution graph
- Their configuration is passed to target nodes via node_data
- Not scheduled as activities

## Retry & Fault Tolerance

| Scenario | Behavior |
|----------|----------|
| Node WebSocket call fails | Temporal retries (up to 3 attempts with backoff) |
| Worker crashes mid-execution | Temporal reschedules on another worker |
| Node times out (10 min) | Temporal retries with backoff |
| All retries exhausted | Workflow receives failure, stops execution |

## File Structure

```
server/services/temporal/
├── __init__.py          # Exports TemporalExecutor, TemporalClientWrapper
├── activities.py        # NodeExecutionActivities class
│   ├── execute_node_activity()   # Main activity method
│   └── _execute_via_websocket()  # WebSocket execution
├── workflow.py          # MachinaWorkflow class
│   ├── run()                     # Main orchestrator
│   ├── _filter_executable_graph() # Config node filtering
│   ├── _build_dependency_maps()   # Graph analysis
│   ├── _find_ready_nodes()        # Dependency resolution
│   └── _wait_any_complete()       # FIRST_COMPLETED wait
├── worker.py            # TemporalWorkerManager
│   ├── start()                   # Start embedded worker
│   ├── stop()                    # Cleanup
│   └── run_standalone_worker()   # For horizontal scaling
├── executor.py          # TemporalExecutor entry point
└── client.py            # TemporalClientWrapper (runtime heartbeat disabled)
```

## Implementation Notes

### Worker Registration (Critical)

For class-based activities, pass the **bound method**:

```python
# WRONG - causes "Activity <unknown> missing attributes"
activities=[self._activities]

# CORRECT - pass the bound method
activities=[self._activities.execute_node_activity]
```

### Activity Invocation (Critical)

When using class-based activities, invoke by **string name**:

```python
# WRONG - works only with standalone function activities
workflow.start_activity(execute_node_activity, args=[context])

# CORRECT - use string name for class-based activities
workflow.start_activity("execute_node_activity", args=[context])
```

### Runtime Configuration

Worker heartbeating is disabled to avoid warnings on older Temporal server versions:

```python
runtime = Runtime(
    telemetry=TelemetryConfig(),
    worker_heartbeat_interval=None,  # Disable runtime heartbeating
)
client = await Client.connect(server_address, namespace=namespace, runtime=runtime)
```

## Debugging

```bash
# Check task queue pollers
curl http://localhost:8233/api/v1/namespaces/default/task-queues/machina-tasks

# List recent workflows
curl "http://localhost:8233/api/v1/namespaces/default/workflows"

# Get workflow history
curl "http://localhost:8233/api/v1/namespaces/default/workflows/{id}/history"

# Temporal UI
open http://localhost:8233
```
