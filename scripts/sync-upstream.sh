#!/bin/bash

# =============================================================================
# Medusa Railway Template - Upstream Sync Script
# =============================================================================
# Syncs everything from upstream EXCEPT preserved files (Railway customizations).
#
# Usage:
#   ./scripts/sync-upstream.sh [options]
#
# Options:
#   --dry-run         Show what would be done without making changes
#   --backend-only    Only sync backend
#   --storefront-only Only sync storefront
#   --branch NAME     Create changes on a new branch (default: sync-upstream-YYYYMMDD)
#   --no-branch       Make changes directly on current branch
#   --help            Show this help message
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMP_DIR="${ROOT_DIR}/.sync-temp"
CONFIG_FILE="${ROOT_DIR}/.sync-config.json"

# Default options
DRY_RUN=false
SYNC_BACKEND=true
SYNC_STOREFRONT=true
CREATE_BRANCH=true
BRANCH_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --backend-only) SYNC_STOREFRONT=false; shift ;;
        --storefront-only) SYNC_BACKEND=false; shift ;;
        --branch) BRANCH_NAME="$2"; shift 2 ;;
        --no-branch) CREATE_BRANCH=false; shift ;;
        --help) head -18 "$0" | tail -15; exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
    esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    command -v git &> /dev/null || { log_error "git required"; exit 1; }
    command -v jq &> /dev/null || { log_error "jq required (brew install jq)"; exit 1; }
    [ -f "$CONFIG_FILE" ] || { log_error "Config not found: $CONFIG_FILE"; exit 1; }
    log_success "Prerequisites OK"
}

read_config() {
    STOREFRONT_REPO=$(jq -r '.upstream.storefront.repo' "$CONFIG_FILE")
    STOREFRONT_BRANCH=$(jq -r '.upstream.storefront.branch' "$CONFIG_FILE")
    # Backend now uses create-medusa-app instead of git clone, no repo/branch needed
}

clone_upstream() {
    log_info "Cloning upstream repositories..."
    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    
    if [ "$SYNC_STOREFRONT" = true ]; then
        log_info "  Cloning storefront..."
        git clone --depth 1 --branch "$STOREFRONT_BRANCH" "$STOREFRONT_REPO" "$TEMP_DIR/storefront-upstream" 2>&1 | grep -v "^remote:"
    fi
    
    if [ "$SYNC_BACKEND" = true ]; then
        log_info "  Creating backend with create-medusa-app..."
        
        # Isolate from root workspace to prevent pnpm lockfile errors
        touch "$TEMP_DIR/pnpm-workspace.yaml"
        
        # Use create-medusa-app to scaffold a fresh backend (non-interactive)
        # --skip-db: Skip database creation/migrations (we don't need them for sync)
        # --no-browser: Don't try to open browser after creation
        # --directory-path: Specify where to create the project (avoids dot in path issue)
        # echo n: Answer 'no' to the Next.js starter prompt for fully non-interactive execution
        # CI=true: Fixes pnpm error "Aborted removal of modules directory due to no TTY"
        echo n | CI=true pnpm dlx create-medusa-app@latest backend-upstream --directory-path "$TEMP_DIR" --skip-db --no-browser 2>&1 || {
            log_error "Failed to create backend with create-medusa-app"
            exit 1
        }
    fi
    
    log_success "Upstream cloned"
}

create_branch() {
    if [ "$CREATE_BRANCH" = true ] && [ "$DRY_RUN" = false ]; then
        [ -z "$BRANCH_NAME" ] && BRANCH_NAME="update/sync-upstream-$(date +%Y%m%d)"
        log_info "Creating branch: $BRANCH_NAME"
        git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
    fi
}

create_pr() {
    if [ "$DRY_RUN" = true ] || [ "$CREATE_BRANCH" = false ]; then
        return
    fi
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        log_warning "GitHub CLI (gh) not found. Skipping PR creation."
        log_info "Install with: brew install gh"
        log_info "Then run: gh pr create --base main --head $BRANCH_NAME"
        return
    fi
    
    # Check if there are changes to commit
    if git diff --quiet HEAD 2>/dev/null; then
        log_info "No changes to commit"
        return
    fi
    
    log_info "Committing changes..."
    git add -A
    git commit -m "chore: sync with upstream Medusa repositories

This commit syncs the repository with the latest changes from:
- Storefront: medusajs/nextjs-starter-medusa
- Backend: medusajs/medusa-starter-default

Railway-specific customizations have been preserved."
    
    log_info "Pushing branch..."
    git push -u origin "$BRANCH_NAME"
    
    log_info "Creating PR..."
    gh pr create \
        --base main \
        --head "$BRANCH_NAME" \
        --title "chore: sync with upstream Medusa repositories" \
        --body "## Upstream Sync

This PR syncs the repository with the latest changes from upstream Medusa repositories:

- **Storefront**: [medusajs/nextjs-starter-medusa](https://github.com/medusajs/nextjs-starter-medusa)
- **Backend**: [medusajs/medusa-starter-default](https://github.com/medusajs/medusa-starter-default)

### Preserved Customizations

- ✅ \`backend/medusa-config.ts\` (custom modules)
- ✅ \`backend/src/lib/constants.ts\`
- ✅ \`backend/src/scripts/railway/\`
- ✅ \`storefront/check-backend.sh\`
- ✅ \`railway.json\` files

### Verification Checklist

- [ ] Build backend: \`pnpm --filter backend build:ci\`
- [ ] Build storefront: \`pnpm --filter storefront build\`
- [ ] Test locally with \`pnpm dev\`
- [ ] Review dependency changes in \`package.json\` files"
    
    log_success "PR created!"
}

# Backup preserved files, sync from upstream, restore preserved files
sync_component() {
    local component="$1"
    local upstream_dir="$TEMP_DIR/${component}-upstream"
    local target_dir="$ROOT_DIR/$component"
    local backup_dir="$TEMP_DIR/${component}-backup"
    
    log_info "Syncing $component..."
    
    # Get preserved files list
    local preserve_list=$(jq -r ".${component}.preserve[]" "$CONFIG_FILE" 2>/dev/null)
    local skip_list=$(jq -r ".${component}.skipFromUpstream[]" "$CONFIG_FILE" 2>/dev/null)
    
    if [ "$DRY_RUN" = false ]; then
        mkdir -p "$backup_dir"
        
        # 1. Backup preserved files
        log_info "  Backing up preserved files..."
        for item in $preserve_list; do
            if [ -e "$target_dir/$item" ]; then
                mkdir -p "$backup_dir/$(dirname "$item")"
                cp -r "$target_dir/$item" "$backup_dir/$item"
                log_info "    Preserved: $item"
            fi
        done
        
        # 2. Build rsync exclude list
        local exclude_args=""
        for skip in $skip_list; do
            exclude_args="$exclude_args --exclude=$skip"
        done
        
        # 3. Sync from upstream (excluding skipped items)
        log_info "  Syncing from upstream..."
        rsync -a --delete $exclude_args "$upstream_dir/" "$target_dir/"
        
        # 4. Restore preserved files
        log_info "  Restoring preserved files..."
        for item in $preserve_list; do
            if [ -e "$backup_dir/$item" ]; then
                mkdir -p "$target_dir/$(dirname "$item")"
                cp -r "$backup_dir/$item" "$target_dir/$item"
            fi
        done
        
        # 5. Apply post-sync modifications
        apply_post_sync "$component" "$target_dir" "$upstream_dir"
    else
        log_info "  [DRY RUN] Would sync all files except:"
        for item in $preserve_list; do
            log_info "    - $item (preserved)"
        done
    fi
    
    log_success "$component sync complete"
}

apply_post_sync() {
    local component="$1"
    local target_dir="$2"
    local upstream_dir="$3"
    
    log_info "  Applying post-sync modifications..."
    
    # Merge package.json
    if [ -f "$upstream_dir/package.json" ]; then
        merge_package_json "$component" "$upstream_dir/package.json" "$target_dir/package.json"
    fi
    
    # Process next.config.js for storefront
    if [ "$component" = "storefront" ] && [ -f "$target_dir/next.config.js" ]; then
        sed -i '' '/checkEnvVariables/d; /check-env-variables/d' "$target_dir/next.config.js" 2>/dev/null || \
        sed -i '/checkEnvVariables/d; /check-env-variables/d' "$target_dir/next.config.js"
    fi
    
    # Append to .env.template
    append_env_template "$component" "$target_dir/.env.template"
}

merge_package_json() {
    local component="$1"
    local upstream_pkg="$2"
    local target_pkg="$3"
    
    if [ "$component" = "backend" ]; then
        jq -s '
            .[0] * {
                "name": "backend",
                "scripts": (.[0].scripts * {
                    "preinstall": "npx only-allow pnpm",
                    "build": "medusa build && node src/scripts/railway/postBuild.js",
                    "build:ci": "medusa build",
                    "start": "node src/scripts/railway/start.js && cd .medusa/server && medusa start --verbose"
                }),
                "dependencies": (.[0].dependencies * {
                    "@medusajs/dashboard": .[0].dependencies["@medusajs/cli"],
                    "@medusajs/draft-order": .[0].dependencies["@medusajs/cli"],
                    "@medusajs/event-bus-redis": .[0].dependencies["@medusajs/cli"],
                    "@medusajs/file-s3": .[0].dependencies["@medusajs/cli"],
                    "@medusajs/notification": .[0].dependencies["@medusajs/cli"],
                    "@medusajs/payment-stripe": .[0].dependencies["@medusajs/cli"],
                    "@medusajs/workflow-engine-redis": .[0].dependencies["@medusajs/cli"],
                    "pg": "^8.16.3"
                }),
                "engines": {"node": ">=20", "pnpm": ">=10"},
                "pnpm": {"overrides": {"esbuild@<=0.24.2": ">=0.25.0"}},
                "packageManager": "pnpm@10.24.0"
            }
        ' "$upstream_pkg" > "$target_pkg.tmp" && mv "$target_pkg.tmp" "$target_pkg"
    else
        jq -s '
            .[0] * {
                "name": "storefront",
                "scripts": (.[0].scripts * {
                    "build:railway": "sh ./check-backend.sh && next build"
                }),
                "packageManager": "pnpm@10.24.0"
            }
        ' "$upstream_pkg" > "$target_pkg.tmp" && mv "$target_pkg.tmp" "$target_pkg"
    fi
    
    log_info "    Merged package.json"
}

append_env_template() {
    local component="$1"
    local env_file="$2"
    
    [ ! -f "$env_file" ] && return
    
    if [ "$component" = "backend" ]; then
        cat >> "$env_file" << 'EOF'

# Railway-specific
BACKEND_URL=http://localhost:9000
MEDUSA_WORKER_MODE=shared
SHOULD_DISABLE_ADMIN=false

# S3 Storage (optional)
AWS_DEFAULT_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_ENDPOINT_URL=
AWS_S3_FILE_URL=

# Stripe (optional)
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend (optional)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Admin credentials for seeding
MEDUSA_ADMIN_EMAIL=
MEDUSA_ADMIN_PASSWORD=
MEDUSA_PUBLISHABLE_KEY=
EOF
    else
        cat >> "$env_file" << 'EOF'

# Railway-specific
MAX_RETRIES=20
EOF
    fi
    log_info "    Appended Railway vars to .env.template"
}

cleanup() {
    log_info "Cleaning up..."
    rm -rf "$TEMP_DIR"
}

show_summary() {
    echo ""
    echo "========================================"
    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}DRY RUN - No changes made${NC}"
    else
        echo -e "  ${GREEN}Sync Complete!${NC}"
        [ "$CREATE_BRANCH" = true ] && echo "  Branch: $BRANCH_NAME"
        echo ""
        echo "  Next steps:"
        echo "    pnpm install"
        echo "    pnpm --filter backend build:ci"
        echo "    pnpm --filter storefront build"
    fi
    echo "========================================"
}

main() {
    echo ""
    echo "========================================"
    echo "  Medusa Railway - Upstream Sync"
    echo "========================================"
    
    [ "$DRY_RUN" = true ] && log_warning "DRY RUN mode"
    
    check_prerequisites
    read_config
    clone_upstream
    create_branch
    
    [ "$SYNC_BACKEND" = true ] && sync_component "backend"
    [ "$SYNC_STOREFRONT" = true ] && sync_component "storefront"
    
    cleanup
    create_pr
    show_summary
}

main
