#!/bin/bash
set -e

echo "🔍 Waiting for services to be ready..."

# Wait for PostgreSQL
echo "⏳ Checking PostgreSQL..."
max_attempts=30
attempt=0
until pg_isready -h localhost -p 5432 -U loopforge >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "❌ PostgreSQL failed to start after $max_attempts attempts"
    exit 1
  fi
  echo "   Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
  sleep 1
done
echo "✅ PostgreSQL is ready"

# Wait for Redis
echo "⏳ Checking Redis..."
attempt=0
until redis-cli -h localhost -p 6379 ping >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "❌ Redis failed to start after $max_attempts attempts"
    exit 1
  fi
  echo "   Waiting for Redis... (attempt $attempt/$max_attempts)"
  sleep 1
done
echo "✅ Redis is ready"

echo "🎉 All services are ready!"
