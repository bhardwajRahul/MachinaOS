"""Code execution node handlers - Python and JavaScript executors."""

import time
from datetime import datetime
from typing import Dict, Any, Optional
from core.logging import get_logger
from services.nodejs_client import NodeJSClient

logger = get_logger(__name__)

# Module-level client instance (initialized on first use)
_nodejs_client: Optional[NodeJSClient] = None


def get_nodejs_client(base_url: str, timeout: int) -> NodeJSClient:
    """Get or create Node.js client instance."""
    global _nodejs_client
    if _nodejs_client is None:
        _nodejs_client = NodeJSClient(base_url, timeout)
    return _nodejs_client


async def handle_python_executor(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    connected_outputs: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Handle Python executor node execution.

    Executes Python code with input data access and console output capture.

    Args:
        node_id: The node ID
        node_type: The node type (pythonExecutor)
        parameters: Resolved parameters
        context: Execution context
        connected_outputs: Outputs from connected nodes

    Returns:
        Execution result dict with output and console output
    """
    import io
    start_time = time.time()
    console_output = ""

    try:
        code = parameters.get('code', '')
        int(parameters.get('timeout', 30))

        if not code.strip():
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "pythonExecutor",
                "error": "No code provided",
                "console_output": "",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        # Get input data from connected nodes
        input_data = connected_outputs or {}

        # Capture stdout for console output
        stdout_capture = io.StringIO()

        # Create execution namespace with safe builtins
        import math
        import json as json_module

        # Custom print function that writes to our capture buffer
        def captured_print(*args, **kwargs):
            kwargs['file'] = stdout_capture
            print(*args, **kwargs)

        safe_builtins = {
            'abs': abs, 'all': all, 'any': any, 'bool': bool,
            'dict': dict, 'enumerate': enumerate, 'filter': filter,
            'float': float, 'int': int, 'len': len, 'list': list,
            'map': map, 'max': max, 'min': min, 'print': captured_print,
            'range': range, 'round': round, 'set': set, 'sorted': sorted,
            'str': str, 'sum': sum, 'tuple': tuple, 'type': type, 'zip': zip,
            'True': True, 'False': False, 'None': None,
            'math': math, 'json': json_module
        }

        namespace = {
            '__builtins__': safe_builtins,
            'input_data': input_data,
            'output': None
        }

        # Execute code with timeout
        exec(code, namespace)

        # Get output and console output
        output = namespace.get('output', None)
        console_output = stdout_capture.getvalue()

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "pythonExecutor",
            "result": {
                "output": output,
                "console_output": console_output,
                "timestamp": datetime.now().isoformat()
            },
            "console_output": console_output,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("Python execution failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "pythonExecutor",
            "error": str(e),
            "console_output": console_output,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_javascript_executor(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    connected_outputs: Dict[str, Any] = None,
    nodejs_url: str = None,
    nodejs_timeout: int = None
) -> Dict[str, Any]:
    """Handle JavaScript executor node execution.

    Executes JavaScript code via persistent Node.js server.

    Args:
        node_id: The node ID
        node_type: The node type (javascriptExecutor)
        parameters: Resolved parameters
        context: Execution context
        connected_outputs: Outputs from connected nodes
        nodejs_url: Node.js server URL (from settings)
        nodejs_timeout: Request timeout in seconds (from settings)

    Returns:
        Execution result dict with output and console output
    """
    start_time = time.time()

    try:
        code = parameters.get('code', '')
        timeout_ms = int(parameters.get('timeout', 30)) * 1000  # Convert to milliseconds

        if not code.strip():
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "javascriptExecutor",
                "error": "No code provided",
                "console_output": "",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        # Get input data from connected nodes
        input_data = connected_outputs or {}

        # Get Node.js client
        client = get_nodejs_client(
            nodejs_url or "http://localhost:3020",
            nodejs_timeout or 30
        )

        # Execute via Node.js server
        result = await client.execute(
            code=code,
            input_data=input_data,
            timeout=timeout_ms,
            language="javascript"
        )

        if result.get("success"):
            return {
                "success": True,
                "node_id": node_id,
                "node_type": "javascriptExecutor",
                "result": {
                    "output": result.get("output"),
                    "console_output": result.get("console_output", ""),
                    "timestamp": datetime.now().isoformat()
                },
                "console_output": result.get("console_output", ""),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "javascriptExecutor",
                "error": result.get("error", "Unknown error"),
                "console_output": result.get("console_output", ""),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error("JavaScript execution failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "javascriptExecutor",
            "error": str(e),
            "console_output": "",
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_typescript_executor(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    connected_outputs: Dict[str, Any] = None,
    nodejs_url: str = None,
    nodejs_timeout: int = None
) -> Dict[str, Any]:
    """Handle TypeScript executor node execution.

    Executes TypeScript code via persistent Node.js server.

    Args:
        node_id: The node ID
        node_type: The node type (typescriptExecutor)
        parameters: Resolved parameters
        context: Execution context
        connected_outputs: Outputs from connected nodes
        nodejs_url: Node.js server URL (from settings)
        nodejs_timeout: Request timeout in seconds (from settings)

    Returns:
        Execution result dict with output and console output
    """
    start_time = time.time()

    try:
        code = parameters.get('code', '')
        timeout_ms = int(parameters.get('timeout', 30)) * 1000

        if not code.strip():
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "typescriptExecutor",
                "error": "No code provided",
                "console_output": "",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        input_data = connected_outputs or {}

        client = get_nodejs_client(
            nodejs_url or "http://localhost:3020",
            nodejs_timeout or 30
        )

        result = await client.execute(
            code=code,
            input_data=input_data,
            timeout=timeout_ms,
            language="typescript"
        )

        if result.get("success"):
            return {
                "success": True,
                "node_id": node_id,
                "node_type": "typescriptExecutor",
                "result": {
                    "output": result.get("output"),
                    "console_output": result.get("console_output", ""),
                    "timestamp": datetime.now().isoformat()
                },
                "console_output": result.get("console_output", ""),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "typescriptExecutor",
                "error": result.get("error", "Unknown error"),
                "console_output": result.get("console_output", ""),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error("TypeScript execution failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "typescriptExecutor",
            "error": str(e),
            "console_output": "",
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
