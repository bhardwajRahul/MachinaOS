"""Temporal workflow - Pure orchestrator for distributed node execution.

The workflow ONLY orchestrates:
- Parses graph structure
- Filters config nodes (tools, memory, services)
- Determines execution order based on dependencies
- Schedules node activities (can run on ANY worker)
- Collects results and routes outputs to dependent nodes

NO business logic in workflow - all execution happens in activities.
This enables massive horizontal scaling and multi-tenant distribution.
"""

from datetime import timedelta
from typing import Any, Dict, List, Set

from temporalio import workflow
from temporalio.common import RetryPolicy

# Config handles - nodes connecting via these are config nodes (not executed)
CONFIG_HANDLES = {"input-tools", "input-memory", "input-model"}

# Android service types (connect to androidTool, not executed directly)
ANDROID_SERVICE_TYPES = {
    "batteryMonitor", "locationService", "deviceState",
    "systemInfo", "appList", "appLauncher",
}

@workflow.defn(sandboxed=False)
class MachinaWorkflow:
    """Distributed workflow orchestrator.

    This workflow ONLY orchestrates - all execution happens in activities
    that can run on any worker in the cluster.

    Features:
    - Continuous scheduling (FIRST_COMPLETED pattern)
    - Per-node retry policies
    - Config node filtering (tools, memory, services)
    - Multi-tenant support via tenant_id in context
    """

    @workflow.run
    async def run(self, workflow_data: Dict[str, Any]) -> Dict[str, Any]:
        print("[Workflow] ========== RUN METHOD CALLED ==========")
        """Execute workflow by orchestrating node activities.

        Args:
            workflow_data: Dict containing:
                - nodes: List of node definitions from React Flow
                - edges: List of edge definitions from React Flow
                - session_id: Session identifier
                - workflow_id: Workflow ID for tracking
                - tenant_id: Tenant identifier for multi-tenancy

        Returns:
            Dict with success, outputs, execution_trace, and errors
        """
        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])
        session_id = workflow_data.get("session_id", "default")
        workflow_id = workflow_data.get("workflow_id")
        tenant_id = workflow_data.get("tenant_id")

        workflow.logger.info(
            f"Starting workflow orchestration: {len(nodes)} nodes, {len(edges)} edges"
        )
        # Debug print for console visibility
        print(f"[Workflow] Starting: {len(nodes)} nodes, {len(edges)} edges")

        if not nodes:
            return {
                "success": False,
                "error": "No nodes provided",
                "outputs": {},
                "execution_trace": [],
            }

        # 1. Filter out config nodes (tools, memory, services)
        exec_nodes, exec_edges = self._filter_executable_graph(nodes, edges)

        workflow.logger.info(
            f"After filtering: {len(exec_nodes)} executable nodes "
            f"(filtered {len(nodes) - len(exec_nodes)} config nodes)"
        )
        print(f"[Workflow] Executable: {len(exec_nodes)}, Config filtered: {len(nodes) - len(exec_nodes)}")

        # 2. Build dependency maps
        deps, node_map = self._build_dependency_maps(exec_nodes, exec_edges)

        # 3. Initialize state
        outputs: Dict[str, Any] = {}  # node_id -> result
        completed: Set[str] = set()
        running: Dict[str, Any] = {}  # node_id -> activity handle
        errors: List[Dict] = []
        execution_trace: List[str] = []

        # 4. Handle pre-executed triggers (already have their output)
        pre_executed_count = 0
        for node in exec_nodes:
            if node.get("_pre_executed"):
                node_id = node["id"]
                outputs[node_id] = {
                    "success": True,
                    "result": node.get("_trigger_output", {}),
                    "pre_executed": True,
                }
                completed.add(node_id)
                execution_trace.append(node_id)
                pre_executed_count += 1
                workflow.logger.info(f"Pre-executed trigger: {node_id}")

        workflow.logger.info(f"Pre-executed: {pre_executed_count}, To execute: {len(node_map) - pre_executed_count}")
        print(f"[Workflow] Pre-executed: {pre_executed_count}, To execute: {len(node_map) - pre_executed_count}")

        # 5. Retry policy for node activities
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            maximum_interval=timedelta(seconds=30),
            maximum_attempts=3,
        )

        # 6. Continuous scheduling loop
        loop_count = 0
        while True:
            loop_count += 1
            # Find ready nodes (all deps completed, not running/completed)
            ready = self._find_ready_nodes(deps, completed, running, node_map)
            workflow.logger.info(f"Loop {loop_count}: ready={len(ready)}, running={len(running)}, completed={len(completed)}")
            print(f"[Workflow] Loop {loop_count}: ready={len(ready)}, running={len(running)}, completed={len(completed)}")

            # Start activities for ready nodes
            for node_id in ready:
                node = node_map[node_id]

                # Build immutable context for this node
                context = {
                    "node_id": node_id,
                    "node_type": node.get("type", "unknown"),
                    "node_data": node.get("data", {}),
                    "inputs": self._get_node_inputs(node_id, deps, outputs),
                    "workflow_id": workflow_id,
                    "tenant_id": tenant_id,
                    "session_id": session_id,
                    "nodes": nodes,  # Full list for tool/memory detection
                    "edges": edges,  # Full list for tool/memory detection
                    # Include pre-executed info if applicable
                    "pre_executed": node.get("_pre_executed", False),
                    "trigger_output": node.get("_trigger_output"),
                }

                # Schedule activity by name (for class-based activities)
                # The activity is registered as NodeExecutionActivities.execute_node_activity
                handle = workflow.start_activity(
                    "execute_node_activity",
                    args=[context],
                    start_to_close_timeout=timedelta(minutes=10),
                    heartbeat_timeout=timedelta(minutes=2),
                    retry_policy=retry_policy,
                )
                running[node_id] = handle

                workflow.logger.info(f"Scheduled activity for node: {node_id}")
                print(f"[Workflow] Scheduled: {node_id}")

            # Exit if nothing running and nothing ready
            if not running:
                break

            # Wait for ANY activity to complete (FIRST_COMPLETED pattern)
            done_id, result = await self._wait_any_complete(running)

            if result.get("success"):
                outputs[done_id] = result
                completed.add(done_id)
                execution_trace.append(done_id)
                workflow.logger.info(f"Node completed: {done_id}")
            else:
                # Node failed after all retries
                error_info = {
                    "node_id": done_id,
                    "error": result.get("error", "Unknown error"),
                }
                errors.append(error_info)
                workflow.logger.error(f"Node failed: {done_id} - {error_info['error']}")

                # Stop workflow on failure
                # TODO: Could add option to continue with partial results
                break

        # Build final result
        success = len(errors) == 0 and len(completed) == len(node_map)

        workflow.logger.info(
            f"Workflow complete: success={success}, "
            f"executed={len(execution_trace)}/{len(node_map)}"
        )
        print(f"[Workflow] Complete: success={success}, executed={len(execution_trace)}/{len(node_map)}")

        return {
            "success": success,
            "outputs": outputs,
            "execution_trace": execution_trace,
            "errors": errors if errors else None,
        }

    def _get_node_inputs(
        self,
        node_id: str,
        deps: Dict[str, Set[str]],
        outputs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Get outputs from upstream nodes as inputs for this node."""
        inputs = {}
        for dep_id in deps.get(node_id, set()):
            if dep_id in outputs:
                inputs[dep_id] = outputs[dep_id].get("result", {})
        return inputs

    async def _wait_any_complete(self, running: Dict[str, Any]) -> tuple:
        """Wait for any activity to complete, return (node_id, result).

        Uses Temporal's native wait mechanism for efficient polling.
        """
        # Convert to list for iteration
        items = list(running.items())

        # Check if any already done
        for node_id, handle in items:
            if handle.done():
                del running[node_id]
                try:
                    result = await handle
                    return node_id, result
                except Exception as e:
                    return node_id, {"success": False, "error": str(e)}

        # Wait for first completion using Temporal's wait
        handles = [h for _, h in items]

        # Use asyncio.wait pattern via workflow.wait
        await workflow.wait_condition(
            lambda: any(h.done() for _, h in items)
        )

        # Find the completed one
        for node_id, handle in items:
            if handle.done():
                del running[node_id]
                try:
                    result = await handle
                    return node_id, result
                except Exception as e:
                    return node_id, {"success": False, "error": str(e)}

        # Should not reach here
        raise RuntimeError("No activity completed after wait")

    def _filter_executable_graph(
        self,
        nodes: List[Dict],
        edges: List[Dict],
    ) -> tuple:
        """Filter out config nodes based on edge handles.

        Config nodes (tools, memory, model configs) connect via special handles
        and are consumed by their target nodes, not executed independently.

        Returns:
            Tuple of (executable_nodes, executable_edges)
        """
        node_map = {n["id"]: n for n in nodes}
        config_ids = set()

        for edge in edges:
            handle = edge.get("targetHandle", "")
            source_id = edge.get("source")

            # Edges to config handles mean source is a config node
            if handle in CONFIG_HANDLES:
                config_ids.add(source_id)

            # Android services connecting to androidTool
            source_node = node_map.get(source_id, {})
            if source_node.get("type") in ANDROID_SERVICE_TYPES:
                config_ids.add(source_id)

        # Filter nodes and edges
        exec_nodes = [n for n in nodes if n["id"] not in config_ids]
        exec_edges = [
            e for e in edges
            if e.get("source") not in config_ids
            and e.get("target") not in config_ids
            and e.get("targetHandle", "") not in CONFIG_HANDLES
        ]

        return exec_nodes, exec_edges

    def _build_dependency_maps(
        self,
        nodes: List[Dict],
        edges: List[Dict],
    ) -> tuple:
        """Build dependency graph from nodes and edges.

        Returns:
            Tuple of (dependencies_map, node_map)
            - dependencies_map: node_id -> set of node IDs it depends on
            - node_map: node_id -> node definition
        """
        node_map = {n["id"]: n for n in nodes}
        node_ids = set(node_map.keys())

        deps = {nid: set() for nid in node_ids}

        for edge in edges:
            src, tgt = edge.get("source"), edge.get("target")
            if src in node_ids and tgt in node_ids:
                deps[tgt].add(src)

        return deps, node_map

    def _find_ready_nodes(
        self,
        deps: Dict[str, Set[str]],
        completed: Set[str],
        running: Dict[str, Any],
        node_map: Dict[str, Dict],
    ) -> List[str]:
        """Find nodes ready to execute.

        A node is ready when:
        - All its dependencies have completed
        - It's not already running
        - It's not already completed
        """
        ready = []
        for node_id in node_map:
            if node_id in completed or node_id in running:
                continue
            if deps[node_id] <= completed:
                ready.append(node_id)
        return ready
