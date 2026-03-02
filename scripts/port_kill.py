#!/usr/bin/env python3
"""
Cross-platform port and process management using psutil.
Uses native OS APIs -- no shell pipes, terminal-agnostic.

Usage:
  python port_kill.py --kill-port 3000 3010 9400 3020
  python port_kill.py --kill-machina --root /path/to/project [--exclude clean.js]
  python port_kill.py --kill-pattern temporal --root /path/to/project
  python port_kill.py --check-port 3010
"""
import argparse
import json
import os
import subprocess
import sys

try:
    import psutil
except ImportError:
    # psutil not installed -- exit non-zero so Node.js callers fall through to native commands
    print(json.dumps({"error": "psutil not installed", "results": []}), file=sys.stderr)
    sys.exit(1)


def find_pids_by_port(port):
    """Find PIDs using a port via psutil native APIs."""
    pids = set()
    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.laddr and conn.laddr.port == port and conn.pid:
                pids.add(conn.pid)
    except psutil.AccessDenied:
        # macOS: net_connections() requires root, fall back to lsof
        if sys.platform == "darwin":
            try:
                output = subprocess.check_output(
                    ["lsof", "-ti", f":{port}"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                )
                for line in output.strip().splitlines():
                    try:
                        pids.add(int(line.strip()))
                    except ValueError:
                        pass
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass
    except OSError:
        pass
    return pids


def kill_pid(pid, graceful_timeout=3):
    """Kill a process: terminate first, then force kill after timeout."""
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.terminate()
        try:
            proc.wait(timeout=graceful_timeout)
        except psutil.TimeoutExpired:
            proc.kill()
        return {"pid": pid, "name": name, "killed": True}
    except psutil.NoSuchProcess:
        return {"pid": pid, "name": "", "killed": False}
    except psutil.AccessDenied:
        return {"pid": pid, "name": "", "killed": False}


def cmd_kill_port(ports):
    """Kill all processes on the given ports."""
    results = []
    my_pid = os.getpid()
    for port in ports:
        pids = find_pids_by_port(port)
        killed = []
        for pid in pids:
            if pid == my_pid:
                continue
            r = kill_pid(pid)
            if r["killed"]:
                killed.append(r)
        results.append({"port": port, "killed": killed})
    return results


def cmd_check_port(ports):
    """Check which ports are in use."""
    results = []
    for port in ports:
        pids = find_pids_by_port(port)
        in_use = []
        for pid in pids:
            try:
                proc = psutil.Process(pid)
                in_use.append({"pid": pid, "name": proc.name()})
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                in_use.append({"pid": pid, "name": ""})
        results.append({"port": port, "in_use": in_use})
    return results


def cmd_kill_machina(root_dir, exclude_script=None):
    """Kill Python/Node processes belonging to the MachinaOS project."""
    root_norm = root_dir.lower().replace("\\", "/")
    killed = []
    my_pid = os.getpid()
    target_names = {"python", "python3", "python.exe", "node", "node.exe"}

    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            name = (proc.info["name"] or "").lower()
            if name not in target_names:
                continue
            cmdline = proc.info.get("cmdline") or []
            cmd = " ".join(cmdline).lower().replace("\\", "/")
            if root_norm not in cmd:
                continue
            if exclude_script and exclude_script.lower() in cmd:
                continue
            if proc.pid == my_pid:
                continue
            # Graceful termination first, then force kill after timeout
            result = kill_pid(proc.pid, graceful_timeout=2)
            if result["killed"]:
                killed.append({"pid": proc.pid, "name": name})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    return killed


def cmd_kill_pattern(pattern, root_dir=None):
    """Kill processes matching a name pattern, optionally scoped to project root."""
    pattern_lower = pattern.lower()
    root_norm = root_dir.lower().replace("\\", "/") if root_dir else None
    killed = []
    my_pid = os.getpid()

    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            name = (proc.info["name"] or "").lower()
            cmdline = proc.info.get("cmdline") or []
            cmd = " ".join(cmdline).lower().replace("\\", "/")
            if pattern_lower not in name and pattern_lower not in cmd:
                continue
            if root_norm and root_norm not in cmd:
                continue
            if proc.pid == my_pid:
                continue
            proc.kill()
            killed.append({"pid": proc.pid, "name": name})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    return killed


def main():
    parser = argparse.ArgumentParser(description="Cross-platform port/process management")
    parser.add_argument("--kill-port", nargs="+", type=int, help="Kill processes on these ports")
    parser.add_argument("--check-port", nargs="+", type=int, help="Check if ports are in use")
    parser.add_argument("--kill-machina", action="store_true", help="Kill MachinaOS project processes")
    parser.add_argument("--kill-pattern", type=str, default=None, help="Kill processes matching name pattern")
    parser.add_argument("--root", type=str, default=".", help="Project root directory")
    parser.add_argument("--exclude", type=str, default=None, help="Script name to exclude from killing")

    args = parser.parse_args()

    if args.kill_port:
        results = cmd_kill_port(args.kill_port)
        print(json.dumps({"action": "kill_port", "results": results}))
    elif args.check_port:
        results = cmd_check_port(args.check_port)
        print(json.dumps({"action": "check_port", "results": results}))
    elif args.kill_machina:
        killed = cmd_kill_machina(args.root, args.exclude)
        print(json.dumps({"action": "kill_machina", "killed": killed}))
    elif args.kill_pattern:
        killed = cmd_kill_pattern(args.kill_pattern, args.root)
        print(json.dumps({"action": "kill_pattern", "killed": killed}))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
