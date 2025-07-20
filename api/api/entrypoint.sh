#!/bin/sh
# entrypoint.sh

# Exit immediately if a command exits with a non-zero status.
set -e

# List of services to check. Format: <hostname>:<port>
SERVICES="rethinkdb-master:28015 minio:9000"

echo "Docker Swarm Entrypoint: Starting service dependency check..."

# Loop through each service
for service in $SERVICES; do
  host=$(echo $service | cut -d: -f1)
  port=$(echo $service | cut -d: -f2)

  echo "Waiting for service $host on port $port..."

  # Use a loop with netcat to check if the port is open on the host.
  # This effectively checks if the service is up and running.
  while ! nc -z "$host" "$port"; do
    echo "Service $host is not yet available. Retrying in 1 second..."
    sleep 1
  done

  echo "Service $host is ready."
done

echo "All services are up. Starting the application."

# Execute the command passed to this script (the Dockerfile's CMD)
exec "$@"
