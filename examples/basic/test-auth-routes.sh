#!/bin/bash

# Test script for auth route verification with shield middleware
# Tests various auth scenarios on protected routes

set -e

BASE_URL="http://localhost:3001"
TEMP_DIR="/tmp/auth-test"
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
    local token=${6:-""}
    
    log_info "Testing: $test_name"
    
    local response_file="$TEMP_DIR/response_$$.json"
    local status_code
    
    if [[ "$method" == "POST" ]]; then
        status_code=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            ${token:+-H "Authorization: Bearer $token"} \
            -d "$data" \
            "$BASE_URL$endpoint" \
            -o "$response_file")
    else
        status_code=$(curl -s -w "%{http_code}" -X GET \
            ${token:+-H "Authorization: Bearer $token"} \
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

log_info "Starting auth route tests..."
echo "========================================"

# Test 1: Get public user route (should succeed without auth)
test_endpoint "POST" "/user/findMany" '{}' "200" "Public user findMany should be accessible"

# Test 2: Get protected user create route without token (should fail)
test_endpoint "POST" "/user/create" '{"data":{"email":"test@example.com","name":"Test User"}}' "401" "Protected user create without token should return 401"

# Test 3: Get protected route with invalid token (should fail)
test_endpoint "POST" "/user/create" '{"data":{"email":"test@example.com","name":"Test User"}}' "403" "Protected route with invalid token should return 403" "invalid-token"

# Test 4: Get auth token from the generate-token endpoint  
log_info "Getting auth token from generate-token endpoint..."
TOKEN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"alice@example.com"}' \
    "$BASE_URL/auth/generate-token")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.meta.authToken // empty')

if [[ -n "$TOKEN" ]]; then
    log_success "Got valid token from generate-token endpoint"
    
    # Test 5: Get protected route with valid token (should succeed)
    test_endpoint "POST" "/user/create" '{"data":{"email":"new@example.com","name":"New User"}}' "200" "Protected route with valid token should succeed" "$TOKEN"
    
    # Test 6: Try admin operation with user token (should fail)
    test_endpoint "POST" "/user/deleteMany" '{}' "500" "Admin operation with user token should be rejected" "$TOKEN"
else
    log_error "Failed to get valid token from generate-token endpoint"
fi

log_info "Auth tests completed!"
echo "========================================"

# Cleanup
rm -rf $TEMP_DIR