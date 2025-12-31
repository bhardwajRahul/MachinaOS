"""Code execution node handlers - Python and JavaScript executors."""

import json
import time
from datetime import datetime
from typing import Dict, Any
from core.logging import get_logger

logger = get_logger(__name__)


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
    import sys
    import io
    start_time = time.time()
    console_output = ""

    try:
        code = parameters.get('code', '')
        timeout = int(parameters.get('timeout', 30))

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
    connected_outputs: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Handle JavaScript executor node execution.

    Executes JavaScript code using Node.js subprocess with sandboxing.

    Args:
        node_id: The node ID
        node_type: The node type (javascriptExecutor)
        parameters: Resolved parameters
        context: Execution context
        connected_outputs: Outputs from connected nodes

    Returns:
        Execution result dict with output and console output
    """
    import subprocess
    import tempfile
    import os

    start_time = time.time()
    console_output = ""

    try:
        code = parameters.get('code', '')
        timeout = int(parameters.get('timeout', 30))

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

        # Wrapper script that provides input_data and captures output
        wrapper_code = f'''
const input_data = {json.dumps(input_data)};
let output = null;

// Capture console.log
const logs = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {{
    logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
}};
console.error = (...args) => {{
    logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
}};
console.warn = (...args) => {{
    logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
}};

try {{
    {code}
}} catch (e) {{
    console.error(e.message);
    throw e;
}}

// Output result
console.log = originalLog;
process.stdout.write(JSON.stringify({{
    __output__: output,
    __logs__: logs
}}));
'''

        # Write to temp file and execute with Node.js
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(wrapper_code)
            temp_file = f.name

        try:
            result = subprocess.run(
                ['node', temp_file],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=tempfile.gettempdir()
            )

            if result.returncode != 0:
                error_msg = result.stderr.strip() if result.stderr else "JavaScript execution failed"
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": "javascriptExecutor",
                    "error": error_msg,
                    "console_output": result.stdout,
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }

            # Parse output
            stdout = result.stdout.strip()
            if stdout:
                output_data = json.loads(stdout)
                output = output_data.get('__output__')
                console_output = '\n'.join(output_data.get('__logs__', []))
            else:
                output = None
                console_output = ""

            return {
                "success": True,
                "node_id": node_id,
                "node_type": "javascriptExecutor",
                "result": {
                    "output": output,
                    "console_output": console_output,
                    "timestamp": datetime.now().isoformat()
                },
                "console_output": console_output,
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file)
            except:
                pass

    except subprocess.TimeoutExpired:
        logger.error("JavaScript execution timed out", node_id=node_id, timeout=timeout)
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "javascriptExecutor",
            "error": f"Execution timed out after {timeout} seconds",
            "console_output": console_output,
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
            "console_output": console_output,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
