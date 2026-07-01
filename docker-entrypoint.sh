#!/bin/sh
set -e

mkdir -p /app/data

if [ ! -f /app/data/bisync.db ] && [ -f /app/seed/bisync.db ]; then
  echo "Initializing persistent database from seed..."
  cp /app/seed/bisync.db /app/data/bisync.db
fi

exec dotnet Bisync.Api.dll
