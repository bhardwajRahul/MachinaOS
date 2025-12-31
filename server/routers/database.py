"""Database operations routes (replaces frontend storage)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

from core.container import container
from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/database", tags=["database"])


class NodeParameterRequest(BaseModel):
    node_id: str
    parameters: Dict[str, Any]


class WorkflowSaveRequest(BaseModel):
    workflow_id: str
    name: str
    data: Dict[str, Any]


@router.post("/node-parameters")
async def save_node_parameters(
    request: NodeParameterRequest,
    database: Database = Depends(lambda: container.database())
):
    """Save node parameters (replaces frontend Dexie)."""
    try:
        success = await database.save_node_parameters(request.node_id, request.parameters)
        return {"success": success}
    except Exception as e:
        logger.error("Failed to save node parameters", error=str(e))
        return {"success": False, "error": str(e)}


@router.get("/node-parameters/{node_id}")
async def get_node_parameters(
    node_id: str,
    database: Database = Depends(lambda: container.database())
):
    """Get node parameters (replaces frontend Dexie)."""
    try:
        parameters = await database.get_node_parameters(node_id)
        return {"success": True, "parameters": parameters}
    except Exception as e:
        logger.error("Failed to get node parameters", error=str(e))
        return {"success": False, "error": str(e)}


@router.delete("/node-parameters/{node_id}")
async def delete_node_parameters(
    node_id: str,
    database: Database = Depends(lambda: container.database())
):
    """Delete node parameters (replaces frontend Dexie)."""
    try:
        success = await database.delete_node_parameters(node_id)
        return {"success": success}
    except Exception as e:
        logger.error("Failed to delete node parameters", error=str(e))
        return {"success": False, "error": str(e)}


# ============================================================================
# Workflow Operations
# ============================================================================

@router.post("/workflows")
async def save_workflow(
    request: WorkflowSaveRequest,
    database: Database = Depends(lambda: container.database())
):
    """Save workflow to database."""
    try:
        success = await database.save_workflow(
            workflow_id=request.workflow_id,
            name=request.name,
            data=request.data
        )
        return {"success": success, "workflow_id": request.workflow_id}
    except Exception as e:
        logger.error("Failed to save workflow", error=str(e))
        return {"success": False, "error": str(e)}


@router.get("/workflows")
async def get_all_workflows(
    database: Database = Depends(lambda: container.database())
):
    """Get all workflows."""
    try:
        workflows = await database.get_all_workflows()
        return {
            "success": True,
            "workflows": [
                {
                    "id": w.id,
                    "name": w.name,
                    "nodeCount": len(w.data.get("nodes", [])) if w.data else 0,
                    "createdAt": w.created_at.isoformat() if w.created_at else None,
                    "lastModified": w.updated_at.isoformat() if w.updated_at else None
                }
                for w in workflows
            ]
        }
    except Exception as e:
        logger.error("Failed to get workflows", error=str(e))
        return {"success": False, "error": str(e)}


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    database: Database = Depends(lambda: container.database())
):
    """Get workflow by ID."""
    try:
        workflow = await database.get_workflow(workflow_id)
        if workflow:
            return {
                "success": True,
                "workflow": {
                    "id": workflow.id,
                    "name": workflow.name,
                    "data": workflow.data,
                    "createdAt": workflow.created_at.isoformat() if workflow.created_at else None,
                    "lastModified": workflow.updated_at.isoformat() if workflow.updated_at else None
                }
            }
        return {"success": False, "error": "Workflow not found"}
    except Exception as e:
        logger.error("Failed to get workflow", error=str(e))
        return {"success": False, "error": str(e)}


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    database: Database = Depends(lambda: container.database())
):
    """Delete workflow."""
    try:
        success = await database.delete_workflow(workflow_id)
        return {"success": success, "workflow_id": workflow_id}
    except Exception as e:
        logger.error("Failed to delete workflow", error=str(e))
        return {"success": False, "error": str(e)}