#!/bin/sh

echo "Starting Backend Health Check..."

if [ -z "$NEXT_PUBLIC_MEDUSA_BACKEND_URL" ]; then
  echo "Error: NEXT_PUBLIC_MEDUSA_BACKEND_URL is not set."
  echo "Please set this environment variable in your Railway service settings."
  exit 1
fi

echo "Target Backend URL: $NEXT_PUBLIC_MEDUSA_BACKEND_URL"

# Loop until the backend returns HTTP 200
# We use curl with -f (fail on error), -s (silent), -o /dev/null (no output)
# We strictly check for a successful response from /health
MAX_RETRIES=${MAX_RETRIES:-20}
COUNT=0
until curl -f -s -o /dev/null "$NEXT_PUBLIC_MEDUSA_BACKEND_URL/health"; do
  echo "Backend ($NEXT_PUBLIC_MEDUSA_BACKEND_URL) is not ready. Waiting 30 seconds... ($((COUNT+1))/$MAX_RETRIES)"
  sleep 30
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "Error: Timeout waiting for backend to be ready."
    exit 1
  fi
done

echo "Backend is active and healthy! Proceeding..."
