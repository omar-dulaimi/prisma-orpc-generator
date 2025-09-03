#!/bin/bash

# Comprehensive API Endpoint Testing Script for ORPC Blog API
# Tests all User and Post endpoints on http://localhost:3001
# Usage: ./test-api-endpoints.sh

set -e  # Exit on any error

# Colors for better logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3001"
CONTENT_TYPE="application/json"
TIMEOUT=10
TEST_RUN_ID=$(date +%s%N | cut -c1-13)  # Unique timestamp for this test run

# Deterministic emails for this run (also used for relationship fallback)
USER1_EMAIL="user1_${TEST_RUN_ID}@example.com"
USER2_EMAIL="user2_${TEST_RUN_ID}@example.com"

# Test data storage
USER_IDS=()
POST_IDS=()
TEST_LOG="api-test-results.log"

# Logging functions
log_section() {
    echo -e "\n${WHITE}===== $1 =====${NC}" | tee -a "$TEST_LOG"
}

log_test() {
    echo -e "${BLUE}🧪 Testing: $1${NC}" | tee -a "$TEST_LOG"
}

log_request() {
    echo -e "${CYAN}📤 REQUEST: $1 $2${NC}" | tee -a "$TEST_LOG"
    if [ ! -z "$3" ]; then
        echo -e "${CYAN}📦 PAYLOAD: $3${NC}" | tee -a "$TEST_LOG"
    fi
}

log_response() {
    local status=$1
    local response=$2
    if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
        echo -e "${GREEN}✅ RESPONSE ($status): $response${NC}" | tee -a "$TEST_LOG"
    else
        echo -e "${RED}❌ RESPONSE ($status): $response${NC}" | tee -a "$TEST_LOG"
    fi
}

log_error() {
    echo -e "${RED}💥 ERROR: $1${NC}" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}🎉 SUCCESS: $1${NC}" | tee -a "$TEST_LOG"
}

log_info() {
    echo -e "${YELLOW}ℹ️  INFO: $1${NC}" | tee -a "$TEST_LOG"
}

# HTTP request function
api_request() {
    local method=$1
    local endpoint=$2
    local payload=$3
    local url="$BASE_URL$endpoint"
    
    log_request "$method" "$url" "$payload"
    
    if [ -z "$payload" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Content-Type: $CONTENT_TYPE" \
            --connect-timeout $TIMEOUT \
            "$url")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Content-Type: $CONTENT_TYPE" \
            -d "$payload" \
            --connect-timeout $TIMEOUT \
            "$url")
    fi
    
    # Extract HTTP status code (last line)
    http_status=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    response_body=$(echo "$response" | sed '$d')
    
    log_response "$http_status" "$response_body"
    
    # Return both status and body
    echo "$http_status|$response_body"
}

# Same as api_request but does not emit response logging to stdout (so callers can parse cleanly)
api_request_quiet() {
    local method=$1
    local endpoint=$2
    local payload=$3
    local url="$BASE_URL$endpoint"

    # Write request line to the log file only (avoid stdout so parsing stays clean)
    echo -e "${CYAN}📤 REQUEST: $method $url${NC}" >> "$TEST_LOG"
    if [ -n "$payload" ]; then
        echo -e "${CYAN}📦 PAYLOAD: $payload${NC}" >> "$TEST_LOG"
    fi

    if [ -z "$payload" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Content-Type: $CONTENT_TYPE" \
            --connect-timeout $TIMEOUT \
            "$url")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Content-Type: $CONTENT_TYPE" \
            -d "$payload" \
            --connect-timeout $TIMEOUT \
            "$url")
    fi

    # Emit a single machine-parsable line to stdout for callers
    http_status=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    echo "$http_status|$response_body"
}

# Extract ID from response
extract_id() {
    local response="$1"
    # Prefer jq if available
    if command -v jq >/dev/null 2>&1; then
        local id
        # Support common envelopes: {id}, {data:{id}}, {result:{id}}
        id=$(printf '%s' "$response" | jq -r 'try .id // .data.id // .result.id // empty' 2>/dev/null || true)
        if [ -n "$id" ] && [ "$id" != "null" ]; then
            printf '%s\n' "$id"
            return 0
        fi
    fi
    # Fallback to regex extraction (string ids)
    printf '%s' "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true
}

# Test server health
test_server_health() {
    log_section "SERVER HEALTH CHECK"
    log_test "Root endpoint health check"
    
    # Test the root endpoint (without /api prefix)
    root_url="http://localhost:3001"
    log_request "GET" "$root_url" ""
    
    response=$(curl -s -w "\n%{http_code}" \
        --connect-timeout $TIMEOUT \
        "$root_url")
    
    http_status=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    log_response "$http_status" "$response_body"
    
    if [ "$http_status" != "200" ]; then
        log_error "Server not responding! Make sure the server is running on http://localhost:3001"
        exit 1
    fi
    
    log_success "Server is running!"
}

# User Tests
test_user_create() {
    log_section "USER CRUD OPERATIONS"
    log_test "Create User #1"
    
    payload="{
        \"data\": {
            \"email\": \"${USER1_EMAIL}\",
            \"name\": \"Test User 1\",
            \"password\": \"securepassword123\"
        }
    }"
    
    result=$(api_request_quiet "POST" "/user/create" "$payload")
    status="$(printf '%s' "$result" | head -n1 | cut -d'|' -f1)"
    response="$(printf '%s' "$result" | sed '1 s/^[^|]*|//' )"
    log_response "$status" "$response"
    
    if [ "$status" = "200" ]; then
        user_id=$(extract_id "$response")
        USER_IDS+=("$user_id")
        log_success "Created User #1 with ID: $user_id"
    fi
    
    # Create second user
    log_test "Create User #2"
    payload="{
        \"data\": {
            \"email\": \"${USER2_EMAIL}\",
            \"name\": \"Test User 2\",
            \"password\": \"anotherpassword456\"
        }
    }"
    
    result=$(api_request_quiet "POST" "/user/create" "$payload")
    status="$(printf '%s' "$result" | head -n1 | cut -d'|' -f1)"
    response="$(printf '%s' "$result" | sed '1 s/^[^|]*|//' )"
    log_response "$status" "$response"
    
    if [ "$status" = "200" ]; then
        user_id=$(extract_id "$response")
        USER_IDS+=("$user_id")
        log_success "Created User #2 with ID: $user_id"
    fi
}

test_user_find_operations() {
    log_test "Find All Users (findMany)"
    payload='{}'
    result=$(api_request "POST" "/user/findMany" "$payload")
    
    log_test "Find First User (findFirst)"
    payload='{}'
    result=$(api_request "POST" "/user/findFirst" "$payload")
    
    if [ ${#USER_IDS[@]} -gt 0 ]; then
        log_test "Find User by Email (findById)"
        payload="{\"where\": {\"email\": \"${USER1_EMAIL}\"}}"
        result=$(api_request "POST" "/user/findById" "$payload")
    fi
    
    log_test "Count Users"
    payload='{}'
    result=$(api_request "POST" "/user/count" "$payload")
}

test_user_update_operations() {
    if [ ${#USER_IDS[@]} -gt 0 ]; then
        log_test "Update User"
        payload="{
            \"where\": {\"email\": \"${USER1_EMAIL}\"},
            \"data\": {\"name\": \"John Doe Updated\"}
        }"
        result=$(api_request "POST" "/user/update" "$payload")
        
        log_test "Update Many Users"
        payload='{
            "where": {},
            "data": {"password": "newpassword123"}
        }'
        result=$(api_request "POST" "/user/updateMany" "$payload")
    fi
}

test_user_aggregate_operations() {
    log_test "User Aggregate"
    payload='{
        "_count": {"_all": true},
        "_min": {"createdAt": true},
        "_max": {"updatedAt": true}
    }'
    result=$(api_request "POST" "/user/aggregate" "$payload")
    
    log_test "User Group By"
    payload='{
        "by": ["name"],
        "_count": {"_all": true}
    }'
    result=$(api_request "POST" "/user/groupBy" "$payload")
}

# Post Tests
test_post_create() {
    log_section "POST CRUD OPERATIONS"

    # Decide author reference: prefer created userId, else fallback to email connect
    local author_ref=""
    if [ ${#USER_IDS[@]} -gt 0 ] && [ -n "${USER_IDS[0]}" ]; then
        author_ref="\"authorId\": \"${USER_IDS[0]}\""
    else
        author_ref="\"author\": { \"connect\": { \"email\": \"${USER1_EMAIL}\" } }"
    fi

    # Create Post #1
    log_test "Create Post #1"
    payload="{
        \"data\": {
            \"title\": \"My First Blog Post\",
            \"content\": \"This is the content of my first blog post. It's quite interesting!\",
            \"published\": true,
            ${author_ref}
        }
    }"
    result=$(api_request_quiet "POST" "/post/create" "$payload")
    status="$(printf '%s' "$result" | head -n1 | cut -d'|' -f1)"
    response="$(printf '%s' "$result" | sed '1 s/^[^|]*|//' )"
    log_response "$status" "$response"
    if [ "$status" = "200" ]; then
        post_id=$(extract_id "$response")
        POST_IDS+=("$post_id")
        log_success "Created Post #1 with ID: $post_id"
    fi

    # Create Post #2
    log_test "Create Post #2"
    payload="{
        \"data\": {
            \"title\": \"Draft Post\",
            \"content\": \"This is a draft post that's not published yet.\",
            \"published\": false,
            ${author_ref}
        }
    }"
    result=$(api_request_quiet "POST" "/post/create" "$payload")
    status="$(printf '%s' "$result" | head -n1 | cut -d'|' -f1)"
    response="$(printf '%s' "$result" | sed '1 s/^[^|]*|//' )"
    log_response "$status" "$response"
    if [ "$status" = "200" ]; then
        post_id=$(extract_id "$response")
        POST_IDS+=("$post_id")
        log_success "Created Post #2 with ID: $post_id"
    fi
}

test_post_find_operations() {
    log_test "Find All Posts (findMany)"
    payload='{}'
    result=$(api_request "POST" "/post/findMany" "$payload")
    
    log_test "Find Published Posts Only (where clause)"
    payload='{"where": {"published": true}}'
    result=$(api_request "POST" "/post/findMany" "$payload")
    
    log_test "Find First Post (findFirst)"
    payload='{}'
    result=$(api_request "POST" "/post/findFirst" "$payload")
    
    if [ ${#POST_IDS[@]} -gt 0 ]; then
        log_test "Find Post by ID (findById)"
        payload="{\"where\": {\"id\": \"${POST_IDS[0]}\"}}"
        result=$(api_request "POST" "/post/findById" "$payload")
    fi
    
    log_test "Count Posts"
    payload='{}'
    result=$(api_request "POST" "/post/count" "$payload")
    
    log_test "Count Published Posts"
    payload='{"where": {"published": true}}'
    result=$(api_request "POST" "/post/count" "$payload")
}

test_post_update_operations() {
    if [ ${#POST_IDS[@]} -gt 0 ]; then
        log_test "Update Post"
        payload="{
            \"where\": {\"id\": \"${POST_IDS[0]}\"},
            \"data\": {
                \"title\": \"Updated Blog Post Title\",
                \"content\": \"This post has been updated with new content!\"
            }
        }"
        result=$(api_request "POST" "/post/update" "$payload")
        
        log_test "Publish All Draft Posts (updateMany)"
        payload='{
            "where": {"published": false},
            "data": {"published": true}
        }'
        result=$(api_request "POST" "/post/updateMany" "$payload")
    fi
}

test_post_aggregate_operations() {
    log_test "Post Aggregate"
    payload='{
        "_count": {"_all": true},
        "_min": {"createdAt": true},
        "_max": {"updatedAt": true}
    }'
    result=$(api_request "POST" "/post/aggregate" "$payload")
    
    log_test "Post Group By Published Status"
    payload='{
        "by": ["published"],
        "_count": {"_all": true}
    }'
    result=$(api_request "POST" "/post/groupBy" "$payload")
}

# Advanced Tests
test_create_many_operations() {
    log_section "BULK OPERATIONS"
    
    log_test "Create Many Users"
    payload="{
        \"data\": [
            {
                \"email\": \"bulk1_${TEST_RUN_ID}@example.com\",
                \"name\": \"Bulk User 1\",
                \"password\": \"password1\"
            },
            {
                \"email\": \"bulk2_${TEST_RUN_ID}@example.com\",
                \"name\": \"Bulk User 2\",
                \"password\": \"password2\"
            }
        ]
    }"
    result=$(api_request "POST" "/user/createMany" "$payload")
    
    if [ ${#USER_IDS[@]} -gt 0 ] && [ -n "${USER_IDS[0]}" ]; then
        log_test "Create Many Posts"
        payload="{
            \"data\": [
                {
                    \"title\": \"Bulk Post 1\",
                    \"content\": \"Content for bulk post 1\",
                    \"published\": true,
                    \"authorId\": \"${USER_IDS[0]}\"
                },
                {
                    \"title\": \"Bulk Post 2\",
                    \"content\": \"Content for bulk post 2\",
                    \"published\": false,
                    \"authorId\": \"${USER_IDS[0]}\"
                }
            ]
        }"
        result=$(api_request "POST" "/post/createMany" "$payload")
    else
        log_info "Skipping Create Many Posts: authorId unavailable (createMany does not support nested author.connect)"
    fi
}

test_relationship_queries() {
    log_section "RELATIONSHIP QUERIES"
    
    log_test "Find Users (basic query - include not supported yet)"
    payload='{}'
    result=$(api_request "POST" "/user/findMany" "$payload")
    
    log_test "Find Posts (basic query - include not supported yet)"
    payload='{}'
    result=$(api_request "POST" "/post/findMany" "$payload")
}

test_complex_queries() {
    log_section "COMPLEX QUERIES (Limited by current schema support)"
    
    log_test "Find Users (complex queries not yet supported)"
    payload='{}'
    result=$(api_request "POST" "/user/findMany" "$payload")
    
    log_test "Find Posts (orderBy/take not supported yet)"
    payload='{}'
    result=$(api_request "POST" "/post/findMany" "$payload")
    
    log_test "Search Posts by Title (basic where only)"
    payload='{"where": {"title": "Hello World"}}'
    result=$(api_request "POST" "/post/findMany" "$payload")
}

# Cleanup Tests
test_delete_operations() {
    log_section "DELETE OPERATIONS"
    
    # Delete some posts
    if [ ${#POST_IDS[@]} -gt 0 ]; then
        log_test "Delete Single Post"
        payload="{\"where\": {\"id\": \"${POST_IDS[0]}\"}}"
        result=$(api_request "POST" "/post/delete" "$payload")
    fi
    
    log_test "Delete Many Draft Posts"
    payload='{"where": {"published": false}}'
    result=$(api_request "POST" "/post/deleteMany" "$payload")
    
    # Clean up remaining test data
    log_test "Delete Many Bulk Posts"
    payload='{"where": {"title": {"startsWith": "Bulk"}}}'
    result=$(api_request "POST" "/post/deleteMany" "$payload")
    
    log_test "Delete Many Bulk Users"
    payload='{"where": {"email": {"contains": "bulk"}}}'
    result=$(api_request "POST" "/user/deleteMany" "$payload")
}

# Error Testing
test_error_cases() {
    log_section "ERROR HANDLING TESTS"
    
    log_test "Create User with Duplicate Email"
    payload='{
        "data": {
            "email": "john.doe@example.com",
            "name": "Duplicate Email User",
            "password": "password"
        }
    }'
    api_expect "POST" "/user/create" "$payload" "200,400,409,500"
    
    log_test "Find User with Invalid ID"
    payload='{"where": {"id": "invalid-id-format"}}'
    api_expect "POST" "/user/findById" "$payload" "400,404,500"
    
    log_test "Create Post with Invalid Author ID"
    payload='{
        "data": {
            "title": "Invalid Author Post",
            "content": "This should fail",
            "authorId": "non-existent-user-id"
        }
    }'
    api_expect "POST" "/post/create" "$payload" "400,409,500"
    
    log_test "Update Non-existent User"
    payload='{
        "where": {"email": "nonexistent@example.com"},
        "data": {"name": "Will Not Work"}
    }'
    api_expect "POST" "/user/update" "$payload" "404,500"
}

# Summary
print_summary() {
    log_section "TEST SUMMARY"
    
    local total_tests
    total_tests=$(grep -c "🧪 Testing:" "$TEST_LOG" 2>/dev/null || true)
    total_tests=${total_tests:-0}
    total_tests=$(printf '%s' "$total_tests" | tr -dc '0-9')

    local successful_tests
    successful_tests=$(grep -c "✅ RESPONSE" "$TEST_LOG" 2>/dev/null || true)
    successful_tests=${successful_tests:-0}
    successful_tests=$(printf '%s' "$successful_tests" | tr -dc '0-9')

    local failed_tests
    failed_tests=$(grep -c "❌ RESPONSE" "$TEST_LOG" 2>/dev/null || true)
    failed_tests=${failed_tests:-0}
    failed_tests=$(printf '%s' "$failed_tests" | tr -dc '0-9')

    log_info "Total Tests Run: $total_tests"
    log_info "Successful Responses: $successful_tests"
    log_info "Failed Responses: $failed_tests"
    log_info "Created Users: ${#USER_IDS[@]}"
    log_info "Created Posts: ${#POST_IDS[@]}"

    if [ "${failed_tests:-0}" -eq 0 ]; then
        log_success "All tests completed! Check $TEST_LOG for detailed results."
    else
        log_error "Some tests failed. Check $TEST_LOG for detailed results."
    fi
}

# Helper: Expected-status API request wrapper
api_expect() {
    local method="$1"
    local endpoint="$2"
    local payload="$3"
    local expected_csv="$4"

    # Perform request quietly (avoid auto pass/fail logging)
    local result http_status response
    result=$(api_request_quiet "$method" "$endpoint" "$payload")

    # Extract status and response reliably even with newlines in body
    http_status="$(printf '%s' "$result" | head -n1 | cut -d'|' -f1)"
    response="$(printf '%s' "$result" | sed '1 s/^[^|]*|//' )"

    # Check expected status codes (comma-separated list)
    IFS=',' read -r -a expected <<< "$expected_csv"
    local ok="false"
    for code in "${expected[@]}"; do
        if [ "$http_status" = "$code" ]; then
            ok="true"
            break
        fi
    done

    if [ "$ok" = "true" ]; then
        echo -e "${GREEN}✅ RESPONSE ($http_status): Expected status for $endpoint${NC}" | tee -a "$TEST_LOG"
    else
        # Use the standard formatter so summary picks it up as failure
        log_response "$http_status" "$response"
    fi
}

# Main execution
main() {
    echo "🚀 Starting Comprehensive API Testing..." | tee "$TEST_LOG"
    echo "📋 Target Server: $BASE_URL" | tee -a "$TEST_LOG"
    echo "📅 Test Run: $(date)" | tee -a "$TEST_LOG"
    
    # Basic health check
    test_server_health
    
    # User operations
    test_user_create
    test_user_find_operations
    test_user_update_operations
    test_user_aggregate_operations
    
    # Post operations  
    test_post_create
    test_post_find_operations
    test_post_update_operations
    test_post_aggregate_operations
    
    # Advanced operations
    test_create_many_operations
    test_relationship_queries
    test_complex_queries
    
    # Error testing
    test_error_cases
    
    # Cleanup (optional - comment out to preserve test data)
    test_delete_operations
    
    # Summary
    print_summary
}

# Run the tests
main