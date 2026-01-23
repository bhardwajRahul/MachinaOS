"""Temporal activities with continuous scheduling orchestration.

Uses asyncio.wait(FIRST_COMPLETED) pattern for immediate downstream execution
when dependencies complete - no waiting for sibling branches.

This replaces LangGraph's Pregel/BSP model which uses supersteps where all
parallel nodes must complete before downstream nodes can start.

Pattern borrowed from services/execution/executor.py WorkflowExecutor.

Activities call back to MachinaOs node handlers via HTTP and broadcast
status updates via the StatusBroadcaster for real-time UI updates.
"""

import asyncio
import httpx
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Set, Optional

from temporalio import activity

from core.logging import get_logger
from core.config import Settings

logger = get_logger(__name__)

# Load settings to get the correct server port
_settings = Settings()
MACHINA_URL = f"http://{_settings.host}:{_settings.port}"

print(f"[Temporal Activities] MACHINA_URL configured: {MACHINA_URL}")


# =============================================================================
# STATUS BROADCASTING
# =============================================================================

async def broadcast_node_status(
    node_id: str,
    status: str,
    data: dict = None,
    workflow_id: str = None,
) -> None:
    """Broadcast node status update via HTTP to StatusBroadcaster.

    This allows the Temporal activity to send real-time status updates
    to connected WebSocket clients.
    """
    url = f"{MACHINA_URL}/api/workflow/broadcast-status"
    payload = {
        "node_id": node_id,
        "status": status,
        "data": data or {},
        "workflow_id": workflow_id,
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            await client.post(url, json=payload)
            print(f"[Temporal] Broadcast status: {node_id} -> {status}")
        except Exception as e:
            # Don't fail execution if broadcast fails
            print(f"[Temporal] Broadcast failed (non-fatal): {str(e)}")


# =============================================================================
# NODE EXECUTION VIA HTTP
# =============================================================================

async def execute_node_via_http(
    node_id: str,
    node_type: str,
    data: dict,
    context: dict,
) -> dict:
    """Execute a node by calling MachinaOs HTTP endpoint.

    This allows the activity to leverage all existing node handlers
    without duplicating code.
    """
    url = f"{MACHINA_URL}/api/workflow/node/execute"
    print(f"[Temporal] Executing node {node_id} ({node_type}) via {url}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                url,
                json={
                    "node_id": node_id,
                    "node_type": node_type,
                    "data": data,
                    "context": context,
                },
            )
            response.raise_for_status()
            result = response.json()
            print(f"[Temporal] Node {node_id} completed: success={result.get('success', 'N/A')}")
            return result
        except httpx.HTTPStatusError as e:
            print(f"[Temporal] HTTP ERROR {e.response.status_code} for node {node_id}: {e.response.text}")
            logger.error(
                f"Node execution HTTP error: {e.response.status_code}",
                node_id=node_id,
                node_type=node_type,
            )
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
            }
        except Exception as e:
            print(f"[Temporal] EXCEPTION for node {node_id}: {str(e)}")
            logger.error(
                f"Node execution failed: {str(e)}",
                node_id=node_id,
                node_type=node_type,
            )
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": str(e),
            }


# =============================================================================
# GRAPH UTILITIES (from WorkflowExecutor pattern)
# =============================================================================

def build_dependency_maps(
    nodes: List[Dict],
    edges: List[Dict],
) -> tuple[Dict[str, Set[str]], Dict[str, Set[str]], Dict[str, Dict]]:
    """Build dependency graph from nodes and edges.

    Returns:
        Tuple of (dependencies, dependents, node_map)
        - dependencies: node_id -> set of nodes it depends on (must complete first)
        - dependents: node_id -> set of nodes that depend on it (to schedule next)
        - node_map: node_id -> node definition
    """
    node_map = {n["id"]: n for n in nodes}
    node_ids = set(node_map.keys())

    # dependencies[node_id] = set of nodes that must complete before this node
    dependencies: Dict[str, Set[str]] = {node_id: set() for node_id in node_ids}

    # dependents[node_id] = set of nodes that depend on this node
    dependents: Dict[str, Set[str]] = {node_id: set() for node_id in node_ids}

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in node_ids and target in node_ids:
            dependencies[target].add(source)
            dependents[source].add(target)

    return dependencies, dependents, node_map


def find_ready_nodes(
    dependencies: Dict[str, Set[str]],
    completed: Set[str],
    running: Set[str],
    all_nodes: Set[str],
) -> List[str]:
    """Find nodes ready to execute (all dependencies met, not running/completed).

    Args:
        dependencies: node_id -> set of dependencies
        completed: Set of completed node IDs
        running: Set of currently running node IDs
        all_nodes: Set of all node IDs

    Returns:
        List of node IDs ready to execute
    """
    ready = []
    for node_id in all_nodes:
        if node_id in completed or node_id in running:
            continue
        # Check if all dependencies are completed
        if dependencies[node_id] <= completed:
            ready.append(node_id)
    return ready


# =============================================================================
# SINGLE NODE EXECUTION
# =============================================================================

async def execute_single_node(
    node: Dict,
    nodes: List[Dict],
    edges: List[Dict],
    outputs: Dict[str, Any],
    session_id: str,
    workflow_id: Optional[str],
) -> Dict[str, Any]:
    """Execute a single node, handling pre-executed triggers and disabled nodes.

    Args:
        node: Node definition
        nodes: All nodes in workflow
        edges: All edges in workflow
        outputs: Current outputs from completed nodes
        session_id: Session identifier
        workflow_id: Workflow ID for tracking

    Returns:
        Execution result dict
    """
    node_id = node["id"]
    node_type = node.get("type", "unknown")

    print(f"[Temporal] Processing node: {node_id} (type={node_type}, _pre_executed={node.get('_pre_executed')})")

    # Check if this is a pre-executed trigger node
    if node.get("_pre_executed"):
        print(f"[Temporal] Skipping pre-executed trigger node: {node_id}")
        trigger_output = node.get("_trigger_output", {})
        result = {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": trigger_output,
            "skipped": True,
            "reason": "pre-executed trigger",
            "timestamp": datetime.now().isoformat(),
        }

        await broadcast_node_status(
            node_id=node_id,
            status="success",
            data={"result": trigger_output, "pre_executed": True},
            workflow_id=workflow_id,
        )

        return result

    # Check if node is disabled
    if node.get("data", {}).get("disabled"):
        print(f"[Temporal] Skipping disabled node: {node_id}")
        result = {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "skipped": True,
            "reason": "disabled",
            "timestamp": datetime.now().isoformat(),
        }

        await broadcast_node_status(
            node_id=node_id,
            status="skipped",
            data={"disabled": True},
            workflow_id=workflow_id,
        )

        return result

    # Build context for node execution
    context = {
        "outputs": outputs,
        "nodes": nodes,
        "edges": edges,
        "session_id": session_id,
        "workflow_id": workflow_id,
    }

    # Broadcast "executing" status BEFORE execution
    await broadcast_node_status(
        node_id=node_id,
        status="executing",
        data={"node_type": node_type},
        workflow_id=workflow_id,
    )

    # Execute node via MachinaOs
    result = await execute_node_via_http(
        node_id=node_id,
        node_type=node_type,
        data={},  # Let server load from DB
        context=context,
    )

    # Add timestamp
    result["timestamp"] = datetime.now().isoformat()

    # Broadcast result status AFTER execution
    if result.get("success"):
        await broadcast_node_status(
            node_id=node_id,
            status="success",
            data={"result": result.get("result"), "execution_time": result.get("execution_time")},
            workflow_id=workflow_id,
        )
    else:
        await broadcast_node_status(
            node_id=node_id,
            status="error",
            data={"error": result.get("error")},
            workflow_id=workflow_id,
        )

    return result


# =============================================================================
# CONTINUOUS SCHEDULING ACTIVITY
# =============================================================================

@activity.defn
async def execute_workflow_with_continuous_scheduling(
    nodes: List[Dict],
    edges: List[Dict],
    session_id: str = "default",
    workflow_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute workflow with continuous scheduling (FIRST_COMPLETED pattern).

    When any node completes, immediately check for and start newly-ready
    dependent nodes. This enables true parallel pipelines where each path
    progresses independently without waiting for sibling branches.

    Pattern from WorkflowExecutor._execute_with_continuous_scheduling

    Args:
        nodes: List of node definitions (may include _pre_executed trigger nodes)
        edges: List of edge definitions
        session_id: Session identifier
        workflow_id: Workflow ID for tracking

    Returns:
        Dict with success, outputs, and execution_trace
    """
    activity.logger.info(
        f"Executing workflow with {len(nodes)} nodes, {len(edges)} edges (continuous scheduling)"
    )
    print(f"[Temporal] Starting continuous scheduling execution")

    try:
        # Build dependency graph
        dependencies, dependents, node_map = build_dependency_maps(nodes, edges)
        all_node_ids = set(node_map.keys())

        # Track execution state
        outputs: Dict[str, Any] = {}
        execution_trace: List[str] = []
        completed: Set[str] = set()
        running: Set[str] = set()
        errors: List[Dict] = []

        # Collect pre-executed trigger outputs
        for node in nodes:
            if node.get("_pre_executed") and node.get("_trigger_output"):
                node_id = node["id"]
                outputs[node_id] = {
                    "success": True,
                    "node_id": node_id,
                    "node_type": node.get("type", "unknown"),
                    "result": node["_trigger_output"],
                    "pre_executed": True,
                }
                completed.add(node_id)
                execution_trace.append(node_id)
                print(f"[Temporal] Pre-loaded trigger output: {node_id}")

                # Broadcast success for pre-executed trigger
                await broadcast_node_status(
                    node_id=node_id,
                    status="success",
                    data={"result": node["_trigger_output"], "pre_executed": True},
                    workflow_id=workflow_id,
                )

        # Find initial ready nodes
        ready_node_ids = find_ready_nodes(dependencies, completed, running, all_node_ids)

        if not ready_node_ids:
            print(f"[Temporal] No ready nodes found, workflow complete or stuck")
            return {
                "success": len(completed) == len(all_node_ids),
                "outputs": outputs,
                "execution_trace": execution_trace,
            }

        print(f"[Temporal] Initial ready nodes: {ready_node_ids}")

        # Track running tasks: task -> node_id
        task_to_node_id: Dict[asyncio.Task, str] = {}
        pending_tasks: Set[asyncio.Task] = set()
        workflow_failed = False

        def create_node_task(node_id: str) -> asyncio.Task:
            """Create and track a task for node execution."""
            node = node_map[node_id]
            running.add(node_id)

            task = asyncio.create_task(
                execute_single_node(
                    node=node,
                    nodes=nodes,
                    edges=edges,
                    outputs=outputs,
                    session_id=session_id,
                    workflow_id=workflow_id,
                ),
                name=f"node_{node_id}"
            )
            task_to_node_id[task] = node_id
            pending_tasks.add(task)
            return task

        # Start initial ready nodes
        for node_id in ready_node_ids:
            create_node_task(node_id)
            print(f"[Temporal] Scheduled initial node: {node_id}")

        # Send heartbeat
        activity.heartbeat(f"Started {len(ready_node_ids)} initial nodes")

        # Continuous scheduling loop
        while pending_tasks and not workflow_failed:
            # Wait for ANY task to complete (FIRST_COMPLETED pattern)
            done, pending_tasks = await asyncio.wait(
                pending_tasks,
                return_when=asyncio.FIRST_COMPLETED
            )

            # Process each completed task
            for task in done:
                node_id = task_to_node_id[task]
                running.discard(node_id)

                try:
                    result = task.result()

                    if result.get("success"):
                        # Success - store output and find newly ready nodes
                        outputs[node_id] = result
                        completed.add(node_id)
                        execution_trace.append(node_id)

                        print(f"[Temporal] Node {node_id} completed successfully")
                        activity.heartbeat(f"Completed: {node_id}")

                        # Find nodes that are now ready (their dependencies just completed)
                        newly_ready = find_ready_nodes(dependencies, completed, running, all_node_ids)

                        # Schedule newly ready nodes immediately
                        for ready_id in newly_ready:
                            create_node_task(ready_id)
                            print(f"[Temporal] Scheduled dependent: {ready_id} (triggered by {node_id})")

                    else:
                        # Node failed
                        error_msg = result.get("error", "Unknown error")
                        outputs[node_id] = result
                        errors.append({
                            "node_id": node_id,
                            "error": error_msg,
                            "timestamp": datetime.now().isoformat(),
                        })
                        print(f"[Temporal] Node {node_id} failed: {error_msg}")
                        workflow_failed = True

                except asyncio.CancelledError:
                    print(f"[Temporal] Node {node_id} was cancelled")
                    outputs[node_id] = {
                        "success": False,
                        "error": "Cancelled",
                        "node_id": node_id,
                    }

                except Exception as e:
                    error_msg = str(e)
                    print(f"[Temporal] Node {node_id} exception: {error_msg}")
                    outputs[node_id] = {
                        "success": False,
                        "error": error_msg,
                        "node_id": node_id,
                    }
                    errors.append({
                        "node_id": node_id,
                        "error": error_msg,
                        "timestamp": datetime.now().isoformat(),
                    })
                    workflow_failed = True

        # Handle workflow failure - cancel remaining tasks
        if workflow_failed and pending_tasks:
            print(f"[Temporal] Workflow failed, cancelling {len(pending_tasks)} remaining tasks")

            for task in pending_tasks:
                task.cancel()

            # Wait for cancelled tasks
            if pending_tasks:
                cancelled_done, _ = await asyncio.wait(
                    pending_tasks,
                    return_when=asyncio.ALL_COMPLETED
                )

                for task in cancelled_done:
                    node_id = task_to_node_id.get(task)
                    if node_id and node_id not in outputs:
                        outputs[node_id] = {
                            "success": False,
                            "error": "Cancelled due to workflow failure",
                            "node_id": node_id,
                        }

        # Final heartbeat
        activity.heartbeat(f"Workflow complete: {len(execution_trace)} nodes executed")

        success = not workflow_failed and len(completed) == len(all_node_ids)
        print(f"[Temporal] Workflow finished: success={success}, executed={len(execution_trace)}/{len(all_node_ids)}")

        return {
            "success": success,
            "outputs": outputs,
            "execution_trace": execution_trace,
            "errors": errors if errors else None,
        }

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        error_details = f"{type(e).__name__}: {str(e)}"
        activity.logger.error(f"Workflow failed: {error_details}\n{tb}")
        print(f"[Temporal] Workflow exception: {error_details}")
        print(f"[Temporal] Traceback:\n{tb}")
        return {
            "success": False,
            "error": error_details,
            "outputs": {},
            "execution_trace": [],
        }

