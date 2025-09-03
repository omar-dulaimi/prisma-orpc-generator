#!/bin/bash

# Test script for Prisma error mapping verification
# Tests various Prisma error scenarios to verify proper HTTP status mapping

set -e

BASE_URL="http://localhost:3001"
TEMP_DIR="/tmp/prisma-error-test"
mkdir -p $TEMP_DIR

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    log_info "Testing: $test_name"
    
    local response_file="$TEMP_DIR/response_$$.json"
    local status_code
    
    if [[ "$method" == "POST" ]]; then
        status_code=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" \
            -o "$response_file")
    else
        status_code=$(curl -s -w "%{http_code}" -X GET \
            "$BASE_URL$endpoint" \
            -o "$response_file")
    fi
    
    echo "  Status: $status_code"
    echo "  Response: $(cat $response_file | jq -C . 2>/dev/null || cat $response_file)"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$test_name passed (Status: $status_code)"
    else
        log_error "$test_name failed - Expected: $expected_status, Got: $status_code"
    fi
    
    echo "----------------------------------------"
    rm -f "$response_file"
}

# Wait for server to be ready
log_info "Waiting for server to be ready..."
for i in {1..10}; do
    if curl -s "$BASE_URL" > /dev/null 2>&1; then
        log_success "Server is ready"
        break
    fi
    sleep 1
done

log_info "Starting Prisma error mapping tests..."
echo "========================================"

# Test 1: Create a user first (should succeed)
log_info "Creating a test user first..."
test_endpoint "POST" "/user/create" '{
    "data": {
        "email": "test@example.com",
        "name": "Test User",
        "password": "password123"
    }
}' "200" "Create initial user"

# Test 2: P2002 - Unique constraint violation (duplicate email)
log_info "Testing P2002 - Unique constraint violation"
test_endpoint "POST" "/user/create" '{
    "data": {
        "email": "test@example.com",
        "name": "Another User", 
        "password": "password456"
    }
}' "409" "P2002 - Duplicate email should return 409 CONFLICT"

# Test 3: P2025 - Record not found
log_info "Testing P2025 - Record not found"
test_endpoint "POST" "/user/findUniqueOrThrow" '{
    "where": {
        "id": "non-existent-id"
    }
}' "404" "P2025 - Non-existent user should return 404 NOT_FOUND"

# Test 4: Try to update non-existent user (another P2025 case)
log_info "Testing P2025 - Update non-existent record"
test_endpoint "POST" "/user/update" '{
    "where": {
        "id": "non-existent-id"
    },
    "data": {
        "name": "Updated Name"
    }
}' "404" "P2025 - Update non-existent user should return 404 NOT_FOUND"

# Test 5: P2003 - Foreign key constraint (create post with invalid authorId)
log_info "Testing P2003 - Foreign key constraint violation" 
test_endpoint "POST" "/post/create" '{
    "data": {
        "title": "Test Post",
        "content": "Test content",
        "authorId": "non-existent-author-id"
    }
}' "409" "P2003 - Invalid foreign key should return 409 CONFLICT"

# Test 6: Try to delete user with posts (might trigger foreign key constraint)
# First create a post with valid authorId
log_info "Creating a post to test cascading delete..."

# Get the created user's ID first
USER_ID=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"where": {"email": "test@example.com"}}' \
    "$BASE_URL/user/findUnique" | jq -r '.data.id // empty' 2>/dev/null || echo "")

if [[ -n "$USER_ID" && "$USER_ID" != "null" ]]; then
    log_info "Found user ID: $USER_ID"
    
    # Create a post
    test_endpoint "POST" "/post/create" '{
        "data": {
            "title": "Test Post",
            "content": "Test content", 
            "authorId": "'"$USER_ID"'"
        }
    }' "200" "Create post with valid authorId"
    
    # Try to delete the user (this might cause P2003 if cascade delete is not configured)
    test_endpoint "POST" "/user/delete" '{
        "where": {
            "id": "'"$USER_ID"'"
        }
    }' "409" "P2003 - Delete user with posts should return 409 CONFLICT (if no cascade)"
else
    log_error "Could not retrieve user ID for foreign key test"
fi

log_info "Error mapping tests completed!"
echo "========================================"

# Cleanup
rm -rf $TEMP_DIR