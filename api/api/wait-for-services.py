#!/usr/bin/env python
import os
import time
import sys
import subprocess

# List of services to check, format: "host1:port1 host2:port2"
SERVICES = os.getenv("WAIT_FOR_SERVICES", "rethinkdb-master:28015 minio:9000")

def wait_for_services():
    """Waits for services to be available."""
    print("Python Entrypoint: Starting service dependency check...")
    print(f"WAIT_FOR_SERVICES: {SERVICES}")
    if not SERVICES:
        print("No services to wait for.")
        return

    for service in SERVICES.split():
        try:
            host, port_str = service.split(':', 1)
            port = int(port_str)
        except ValueError:
            print(f"Invalid service format: {service}. Skipping.")
            continue

        print(f"Waiting for service at {host}:{port}...")

        while True:
            try:
                # Use ping to check host reachability
                result = subprocess.run(['ping', '-c', '1', host], capture_output=True, text=True, check=False)
                if result.returncode == 0:
                    print(f"Service {host}:{port} is reachable (ping successful).")
                    # Now try to connect to the port
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                        s.settimeout(2)
                        s.connect((host, port))
                    print(f"Service {host}:{port} is ready.")
                    break  # Exit the while loop on success
                else:
                    print(f"Service {host}:{port} not reachable (ping failed). Retrying in 2 seconds...")
                    time.sleep(2)
            except (socket.timeout, ConnectionRefusedError, OSError) as e:
                print(f"Service {host}:{port} not ready yet ({e.__class__.__name__}). Retrying in 2 seconds...")
                time.sleep(2)

if __name__ == "__main__":
    wait_for_services()

    # The command to execute is passed as arguments to this script
    cmd = sys.argv[1:]
    if not cmd:
        print("Error: No command specified to run after waiting.", file=sys.stderr)
        sys.exit(1)

    print(f"All services are up. Executing command: {' '.join(cmd)}")
    # Replace the current process with the specified command
    os.execvp(cmd[0], cmd)
