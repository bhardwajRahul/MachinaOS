"""Temporal workflow definition for MachinaOs.

The workflow is a thin wrapper that delegates execution to a continuous
scheduling activity. Uses asyncio.wait(FIRST_COMPLETED) pattern for immediate
downstream execution when dependencies complete - no waiting for sibling branches.

This replaces LangGraph's Pregel/BSP model which uses supersteps where all
parallel nodes must complete before downstream nodes can start.
"""

from datetime import timedelta
from typing import Any, Dict

from temporalio import workflow
from temporalio.common import RetryPolicy

# Import activities through the unsafe imports mechanism
# This is required because Temporal sandboxes workflow imports
with workflow.unsafe.imports_passed_through():
    from .activities import execute_workflow_with_continuous_scheduling


@workflow.defn(sandboxed=False)
class MachinaWorkflow:
    """Temporal workflow with continuous scheduling orchestration.

    The actual graph execution happens in an activity using the
    asyncio.wait(FIRST_COMPLETED) pattern for true parallel pipelines
    where each path progresses independently.
    """

    @workflow.run
    async def run(self, workflow_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute workflow via continuous scheduling activity.

        Args:
            workflow_data: Dict containing:
                - nodes: List of node definitions
                - edges: List of edge definitions
                - session_id: Session identifier
                - workflow_id: Workflow ID for tracking

        Returns:
            Dict with success, outputs, and execution_trace
        """
        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])
        session_id = workflow_data.get("session_id", "default")
        workflow_id = workflow_data.get("workflow_id")

        if not nodes:
            return {
                "success": False,
                "error": "No nodes provided",
                "outputs": {},
                "execution_trace": [],
            }

        # Execute the entire workflow in a single activity
        # Continuous scheduling handles parallel execution inside the activity
        return await workflow.execute_activity(
            execute_workflow_with_continuous_scheduling,
            args=[nodes, edges, session_id, workflow_id],
            start_to_close_timeout=timedelta(minutes=30),
            heartbeat_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=60),
                maximum_attempts=3,
            ),
        )
