#!/usr/bin/env bash
# ===========================================
# Loopforge Studio Secret Initialization Script
# ===========================================
# This script generates required secrets for Loopforge Studio.
# It creates/updates .env.local with auto-generated values
# for NEXTAUTH_SECRET and ENCRYPTION_KEY if not already set.
#
# Usage:
#   ./scripts/init-secrets.sh
#
# The script:
#   1. Checks if .env.local exists
#   2. Generates NEXTAUTH_SECRET if not set (openssl rand -base64 32)
#   3. Generates ENCRYPTION_KEY if not set (openssl rand -hex 32)
#   4. Writes missing secrets to .env.local
#
# Note: .env.local is gitignored to prevent accidental commits

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_LOCAL_FILE="$PROJECT_ROOT/.env.local"
ENV_FILE="$PROJECT_ROOT/.env"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Loopforge Studio Secret Initialization${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check for openssl
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is required but not installed.${NC}"
    echo "Please install openssl and try again."
    exit 1
fi

# Function to check if a variable is set in a file
check_var_in_file() {
    local var_name="$1"
    local file="$2"

    if [ -f "$file" ]; then
        # Check if variable is set and not empty/placeholder
        local value=$(grep "^${var_name}=" "$file" 2>/dev/null | cut -d'=' -f2-)
        if [ -n "$value" ] && [ "$value" != "your_nextauth_secret" ] && [ "$value" != "your_64_character_hex_string" ]; then
            return 0  # Variable is set
        fi
    fi
    return 1  # Variable is not set
}

# Function to get value from file
get_var_from_file() {
    local var_name="$1"
    local file="$2"
    grep "^${var_name}=" "$file" 2>/dev/null | cut -d'=' -f2-
}

# Initialize variables
NEXTAUTH_SECRET=""
ENCRYPTION_KEY=""

# Check .env file first, then .env.local for existing values
for check_file in "$ENV_FILE" "$ENV_LOCAL_FILE"; do
    if [ -z "$NEXTAUTH_SECRET" ] && check_var_in_file "NEXTAUTH_SECRET" "$check_file"; then
        NEXTAUTH_SECRET=$(get_var_from_file "NEXTAUTH_SECRET" "$check_file")
        echo -e "${GREEN}Found existing NEXTAUTH_SECRET in $(basename "$check_file")${NC}"
    fi

    if [ -z "$ENCRYPTION_KEY" ] && check_var_in_file "ENCRYPTION_KEY" "$check_file"; then
        ENCRYPTION_KEY=$(get_var_from_file "ENCRYPTION_KEY" "$check_file")
        echo -e "${GREEN}Found existing ENCRYPTION_KEY in $(basename "$check_file")${NC}"
    fi
done

# Generate missing secrets
GENERATED_NEXTAUTH=false
GENERATED_ENCRYPTION=false

if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    GENERATED_NEXTAUTH=true
    echo -e "${YELLOW}Generated new NEXTAUTH_SECRET${NC}"
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    GENERATED_ENCRYPTION=true
    echo -e "${YELLOW}Generated new ENCRYPTION_KEY${NC}"
fi

# Only write to .env.local if we generated new secrets
if [ "$GENERATED_NEXTAUTH" = true ] || [ "$GENERATED_ENCRYPTION" = true ]; then
    echo ""
    echo -e "${BLUE}Writing secrets to .env.local...${NC}"

    # Create or append to .env.local
    if [ ! -f "$ENV_LOCAL_FILE" ]; then
        echo "# Auto-generated secrets - DO NOT COMMIT" > "$ENV_LOCAL_FILE"
        echo "# Generated on $(date)" >> "$ENV_LOCAL_FILE"
        echo "" >> "$ENV_LOCAL_FILE"
    fi

    # Add/update NEXTAUTH_SECRET if generated
    if [ "$GENERATED_NEXTAUTH" = true ]; then
        if grep -q "^NEXTAUTH_SECRET=" "$ENV_LOCAL_FILE" 2>/dev/null; then
            # Update existing line (macOS compatible)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" "$ENV_LOCAL_FILE"
            else
                sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" "$ENV_LOCAL_FILE"
            fi
        else
            echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> "$ENV_LOCAL_FILE"
        fi
    fi

    # Add/update ENCRYPTION_KEY if generated
    if [ "$GENERATED_ENCRYPTION" = true ]; then
        if grep -q "^ENCRYPTION_KEY=" "$ENV_LOCAL_FILE" 2>/dev/null; then
            # Update existing line (macOS compatible)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$ENV_LOCAL_FILE"
            else
                sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$ENV_LOCAL_FILE"
            fi
        else
            echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$ENV_LOCAL_FILE"
        fi
    fi

    echo -e "${GREEN}Secrets written to .env.local${NC}"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Display status
if [ "$GENERATED_NEXTAUTH" = true ]; then
    echo -e "NEXTAUTH_SECRET:  ${GREEN}Generated (new)${NC}"
else
    echo -e "NEXTAUTH_SECRET:  ${GREEN}Already set${NC}"
fi

if [ "$GENERATED_ENCRYPTION" = true ]; then
    echo -e "ENCRYPTION_KEY:   ${GREEN}Generated (new)${NC}"
else
    echo -e "ENCRYPTION_KEY:   ${GREEN}Already set${NC}"
fi

echo ""

# Check for required GitHub credentials
GITHUB_ID_SET=false
GITHUB_SECRET_SET=false

for check_file in "$ENV_FILE" "$ENV_LOCAL_FILE"; do
    if check_var_in_file "GITHUB_CLIENT_ID" "$check_file"; then
        GITHUB_ID_SET=true
    fi
    if check_var_in_file "GITHUB_CLIENT_SECRET" "$check_file"; then
        GITHUB_SECRET_SET=true
    fi
done

if [ "$GITHUB_ID_SET" = false ] || [ "$GITHUB_SECRET_SET" = false ]; then
    echo -e "${YELLOW}============================================${NC}"
    echo -e "${YELLOW}  ACTION REQUIRED${NC}"
    echo -e "${YELLOW}============================================${NC}"
    echo ""
    echo -e "You still need to configure GitHub OAuth credentials."
    echo ""
    echo "1. Go to: https://github.com/settings/developers"
    echo "2. Click 'New OAuth App'"
    echo "3. Fill in:"
    echo "   - Application name: Loopforge Studio"
    echo "   - Homepage URL: http://localhost:3000"
    echo "   - Authorization callback URL: http://localhost:3000/api/auth/callback/github"
    echo "4. Copy the Client ID and Client Secret"
    echo "5. Add them to your .env file:"
    echo ""
    echo "   GITHUB_CLIENT_ID=your_client_id"
    echo "   GITHUB_CLIENT_SECRET=your_client_secret"
    echo ""
else
    echo -e "${GREEN}GitHub OAuth credentials are configured.${NC}"
    echo ""
    echo -e "${GREEN}You're ready to start Loopforge Studio!${NC}"
    echo ""
    echo "Run:"
    echo "  docker compose up"
    echo ""
fi
