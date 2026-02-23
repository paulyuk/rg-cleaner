#!/bin/bash
#
# Azure Resource Group Cleaner
# Quickly batch delete resource groups with smart filtering and safety features
#

set -euo pipefail

# Get script directory for loading config files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Default settings
AUDIT_MODE=false
TIME_FILTER="all"
SKIP_PROMPT=false

# Demo detection patterns (case-insensitive)
DEMO_PATTERNS=(
    "demo" "demos" "dmo" "demonstration"
    "offsite" "off-site" "off_site"
    "build" "ignite" "inspire" "ready" "envision"
    "summit" "conf" "conference" "meetup" "hackathon"
    "seattle" "redmond" "vegas" "orlando" "chicago" "austin" "boston" "nyc" "sf" "la"
    "london" "paris" "berlin" "tokyo" "sydney" "singapore" "amsterdam"
    "test" "tmp" "temp" "scratch" "playground" "sandbox" "poc" "prototype"
    "training" "workshop" "lab" "hands-on" "handson"
)

usage() {
    cat << EOF
${BOLD}Azure Resource Group Cleaner${NC}

${BOLD}USAGE:${NC}
    rg-cleaner [OPTIONS]

${BOLD}OPTIONS:${NC}
    -t, --time <period>     Filter RGs by creation time (default: week)
                            Options: week, month, 3months, all
    -a, --audit             Audit mode - simulate deletion without actually deleting
    -y, --yes               Skip final confirmation prompt
    -s, --subscription <id> Use specific subscription (default: current default)
    -h, --help              Show this help message

${BOLD}EXAMPLES:${NC}
    rg-cleaner                      # Interactive mode, RGs from last week
    rg-cleaner -t month             # RGs from last month
    rg-cleaner -t 3months --audit   # Audit mode, last 3 months
    rg-cleaner -t all -y            # All RGs, skip final confirmation

${BOLD}FEATURES:${NC}
    • Interactive multi-select with space bar
    • Auto-detects demo/event resource groups (highlighted in yellow)
    • Parallel deletion for speed
    • Audit mode for safe dry-runs
    • Shows resource counts per RG

EOF
    exit 0
}

log_info() { echo -e "${BLUE}ℹ${NC} $1" >&2; }
log_success() { echo -e "${GREEN}✓${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1" >&2; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; }
log_audit() { echo -e "${CYAN}[AUDIT]${NC} $1" >&2; }

# Check if az cli is installed and logged in
check_prerequisites() {
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! az account show &> /dev/null; then
        log_error "Not logged into Azure. Please run 'az login' first."
        exit 1
    fi
}

# Calculate date threshold based on time filter
get_date_threshold() {
    local period=$1
    case $period in
        week)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                date -v-7d +%Y-%m-%dT%H:%M:%SZ
            else
                date -d "7 days ago" +%Y-%m-%dT%H:%M:%SZ
            fi
            ;;
        month)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                date -v-1m +%Y-%m-%dT%H:%M:%SZ
            else
                date -d "1 month ago" +%Y-%m-%dT%H:%M:%SZ
            fi
            ;;
        3months)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                date -v-3m +%Y-%m-%dT%H:%M:%SZ
            else
                date -d "3 months ago" +%Y-%m-%dT%H:%M:%SZ
            fi
            ;;
        all)
            echo "1970-01-01T00:00:00Z"
            ;;
    esac
}

# Check if RG name matches demo patterns
is_likely_demo() {
    local rg_name=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    for pattern in "${DEMO_PATTERNS[@]}"; do
        if [[ "$rg_name" == *"$pattern"* ]]; then
            return 0
        fi
    done
    return 1
}

# Get resource count for an RG
get_resource_count() {
    local rg_name=$1
    az resource list --resource-group "$rg_name" --query "length(@)" -o tsv 2>/dev/null || echo "?"
}

# Patterns for RGs to always exclude (never show in list)
# Load from exclude-list.txt if it exists, otherwise use defaults
load_exclude_patterns() {
    EXCLUDE_PATTERNS=()
    local exclude_file="${SCRIPT_DIR}/exclude-list.txt"
    
    if [[ -f "$exclude_file" ]]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^# ]] && continue
            EXCLUDE_PATTERNS+=("$line")
        done < "$exclude_file"
        log_info "Loaded ${#EXCLUDE_PATTERNS[@]} exclude patterns from exclude-list.txt"
    else
        # Default patterns if no file exists
        EXCLUDE_PATTERNS=(
            "^DefaultResourceGroup"
            "^NetworkWatcherRG$"
            "^cloud-shell-storage"
            "^LogAnalyticsDefaultResources$"
            "^dashboards$"
            "^cleanupservice$"
            "^Shared-"
            "^ascexport$"
            "^Default-ApplicationInsights"
            "^pyacrgroup$"
            "_managed$"
            "^MC_"
        )
    fi
}

# Check if RG should be excluded entirely
should_exclude_rg() {
    local rg_name="$1"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        if echo "$rg_name" | grep -qiE "$pattern"; then
            return 0
        fi
    done
    return 1
}

# Fetch resource groups and filter out excluded ones
fetch_resource_groups() {
    log_info "Fetching resource groups..."
    
    local all_rgs
    all_rgs=$(az group list --query "[].{name:name, location:location}" -o json 2>/dev/null)
    
    if [[ -z "$all_rgs" || "$all_rgs" == "[]" ]]; then
        log_warn "No resource groups found in current subscription."
        exit 0
    fi
    
    # Filter out excluded RGs
    local filtered_rgs="["
    local first=true
    local rg_count=$(echo "$all_rgs" | jq 'length')
    local excluded_names=()
    
    for ((i=0; i<rg_count; i++)); do
        local name=$(echo "$all_rgs" | jq -r ".[$i].name")
        local location=$(echo "$all_rgs" | jq -r ".[$i].location")
        
        if should_exclude_rg "$name"; then
            excluded_names+=("$name")
            continue
        fi
        
        if $first; then
            first=false
        else
            filtered_rgs+=","
        fi
        filtered_rgs+="{\"name\":\"$name\",\"location\":\"$location\"}"
    done
    
    filtered_rgs+="]"
    
    # Show excluded RGs
    if [[ ${#excluded_names[@]} -gt 0 ]]; then
        echo "" >&2
        echo -e "${CYAN}Excluded ${#excluded_names[@]} resource groups:${NC}" >&2
        for name in "${excluded_names[@]}"; do
            echo -e "  ${CYAN}○${NC} $name" >&2
        done
        echo "" >&2
    fi
    
    if [[ "$filtered_rgs" == "[]" ]]; then
        log_warn "No resource groups found after filtering."
        exit 0
    fi
    
    echo "$filtered_rgs"
}

# Interactive selection using fzf or fallback
select_resource_groups() {
    local rgs_json=$1
    local selected=()
    
    # Parse JSON and build selection list
    local rg_list=()
    local rg_details=()
    
    # Get count of RGs
    local rg_count=$(echo "$rgs_json" | jq 'length')
    
    # Skip resource counting for large lists (too slow)
    local count_resources=true
    if [[ $rg_count -gt 20 ]]; then
        log_info "(Skipping resource counts for $rg_count RGs)"
        count_resources=false
    fi
    
    for ((i=0; i<rg_count; i++)); do
        local name=$(echo "$rgs_json" | jq -r ".[$i].name")
        local location=$(echo "$rgs_json" | jq -r ".[$i].location")
        local resource_count="?"
        if $count_resources; then
            resource_count=$(get_resource_count "$name")
        fi
        local demo_flag=""
        
        if is_likely_demo "$name"; then
            demo_flag="${YELLOW}[DEMO]${NC} "
        fi
        
        rg_list+=("$name")
        rg_details+=("$demo_flag$name (${location}, ${resource_count} resources)")
    done
    
    if [[ ${#rg_list[@]} -eq 0 ]]; then
        log_warn "No resource groups found matching criteria."
        exit 0
    fi
    
    echo ""
    echo -e "${BOLD}Found ${#rg_list[@]} resource groups:${NC}"
    echo -e "${YELLOW}Yellow [DEMO]${NC} = Likely demo/event (auto-deselected)"
    echo ""
    
    # Selection state (1 = selected, 0 = deselected)
    # DEMO RGs are auto-deselected by default
    local selection_state=()
    local is_demo=()
    for i in "${!rg_list[@]}"; do
        if is_likely_demo "${rg_list[$i]}"; then
            selection_state+=("0")  # DEMO: deselected by default
            is_demo+=("1")
        else
            selection_state+=("1")  # Normal: selected by default
            is_demo+=("0")
        fi
    done
    
    # Interactive selection loop
    local current_index=0
    local done_selecting=false
    
    while ! $done_selecting; do
        clear
        echo -e "${BOLD}Select Resource Groups to Delete${NC}"
        echo -e "Use ${CYAN}↑/↓/j/k${NC} navigate, ${CYAN}SPACE/x${NC} toggle, ${CYAN}a${NC} all, ${CYAN}n${NC} none, ${CYAN}ENTER${NC} confirm, ${CYAN}q${NC} quit"
        echo ""
        
        for i in "${!rg_list[@]}"; do
            local marker="[ ]"
            local color=""
            if [[ "${selection_state[$i]}" == "1" ]]; then
                marker="${GREEN}[✓]${NC}"
            fi
            
            if [[ $i -eq $current_index ]]; then
                echo -e " → $marker ${rg_details[$i]}"
            else
                echo -e "   $marker ${rg_details[$i]}"
            fi
        done
        
        echo ""
        local selected_count=0
        for state in "${selection_state[@]}"; do
            [[ "$state" == "1" ]] && ((selected_count++)) || true
        done
        echo -e "Selected: ${BOLD}$selected_count${NC} of ${#rg_list[@]}"
        
        # Read single keypress - use different approach for space detection
        local key=""
        IFS= read -rsn1 key
        
        # Handle special case: empty read could be Enter OR failed read
        # Check for escape sequences (arrow keys)
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.1 rest
            key+="$rest"
        fi
        
        case "$key" in
            $'\x1b[A'|k)  # Up arrow or k
                ((current_index > 0)) && ((current_index--)) || true
                ;;
            $'\x1b[B'|j)  # Down arrow or j
                ((current_index < ${#rg_list[@]} - 1)) && ((current_index++)) || true
                ;;
            ' ')  # Space - toggle selection
                if [[ "${selection_state[$current_index]}" == "1" ]]; then
                    selection_state[$current_index]="0"
                else
                    selection_state[$current_index]="1"
                fi
                ;;
            x|t)  # x or t - also toggle (alternative to space)
                if [[ "${selection_state[$current_index]}" == "1" ]]; then
                    selection_state[$current_index]="0"
                else
                    selection_state[$current_index]="1"
                fi
                ;;
            a)  # Select all
                for i in "${!selection_state[@]}"; do
                    selection_state[$i]="1"
                done
                ;;
            n)  # Select none
                for i in "${!selection_state[@]}"; do
                    selection_state[$i]="0"
                done
                ;;
            ''|$'\n')  # Enter - confirm
                done_selecting=true
                ;;
            q)  # Quit
                log_info "Cancelled by user."
                exit 0
                ;;
        esac
    done
    
    # Build final selection
    SELECTED_RGS=()
    for i in "${!rg_list[@]}"; do
        if [[ "${selection_state[$i]}" == "1" ]]; then
            SELECTED_RGS+=("${rg_list[$i]}")
        fi
    done
}

# Delete resource groups in parallel
delete_resource_groups() {
    local rgs=("$@")
    
    if [[ ${#rgs[@]} -eq 0 ]]; then
        log_warn "No resource groups selected for deletion."
        exit 0
    fi
    
    echo ""
    echo -e "${BOLD}Resource groups to be deleted:${NC}"
    for rg in "${rgs[@]}"; do
        if is_likely_demo "$rg"; then
            echo -e "  ${YELLOW}•${NC} $rg ${YELLOW}[DEMO]${NC}"
        else
            echo -e "  ${RED}•${NC} $rg"
        fi
    done
    echo ""
    
    if $AUDIT_MODE; then
        log_audit "AUDIT MODE - No actual deletions will occur"
        echo ""
        for rg in "${rgs[@]}"; do
            log_audit "Would delete: $rg"
        done
        echo ""
        log_audit "Audit complete. ${#rgs[@]} resource groups would be deleted."
        return 0
    fi
    
    if ! $SKIP_PROMPT; then
        echo -e "${RED}${BOLD}WARNING: This action cannot be undone!${NC}"
        echo -n "Delete ${#rgs[@]} resource group(s)? [y/N]: "
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "Deletion cancelled."
            exit 0
        fi
    fi
    
    echo ""
    log_info "Deleting ${#rgs[@]} resource groups (with retry for locked resources)..."
    
    local completed=0
    local failed=0
    local failed_rgs=()
    
    # First pass: initiate deletions with slight stagger to avoid lock contention
    for rg in "${rgs[@]}"; do
        echo -ne "  Deleting: $rg... "
        
        local retry_count=0
        local max_retries=3
        local success=false
        
        while [[ $retry_count -lt $max_retries ]]; do
            if az group delete --name "$rg" --yes --no-wait 2>/dev/null; then
                echo -e "${GREEN}initiated${NC}"
                ((completed++))
                success=true
                break
            else
                ((retry_count++))
                if [[ $retry_count -lt $max_retries ]]; then
                    echo -ne "${YELLOW}retry ${retry_count}${NC}... "
                    sleep $((retry_count * 2))  # Exponential backoff: 2s, 4s, 6s
                fi
            fi
        done
        
        if ! $success; then
            echo -e "${RED}failed${NC}"
            failed_rgs+=("$rg")
            ((failed++))
        fi
        
        # Small delay between deletions to reduce 429 errors
        sleep 0.5
    done
    
    echo ""
    
    # Retry failed deletions after a longer wait
    if [[ ${#failed_rgs[@]} -gt 0 ]]; then
        log_warn "${#failed_rgs[@]} resource group(s) failed. Retrying in 10 seconds..."
        sleep 10
        
        for rg in "${failed_rgs[@]}"; do
            echo -ne "  Retrying: $rg... "
            if az group delete --name "$rg" --yes --no-wait 2>/dev/null; then
                echo -e "${GREEN}initiated${NC}"
                ((completed++))
                ((failed--))
            else
                echo -e "${RED}failed (may need manual deletion)${NC}"
            fi
            sleep 1
        done
        echo ""
    fi
    
    log_success "Deletion initiated for $completed resource group(s)"
    [[ $failed -gt 0 ]] && log_error "Failed to initiate $failed resource group(s) - retry later or delete manually"
    
    echo ""
    log_info "Resource groups are being deleted asynchronously."
    log_info "Use 'az group list' to check remaining resource groups."
}

# Main entry point
main() {
    local subscription=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--time)
                TIME_FILTER="$2"
                shift 2
                ;;
            -a|--audit)
                AUDIT_MODE=true
                shift
                ;;
            -y|--yes)
                SKIP_PROMPT=true
                shift
                ;;
            -s|--subscription)
                subscription="$2"
                shift 2
                ;;
            -h|--help)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    check_prerequisites
    
    # Load exclude patterns from file or use defaults
    load_exclude_patterns
    
    # Set subscription if specified
    if [[ -n "$subscription" ]]; then
        log_info "Setting subscription to: $subscription"
        az account set --subscription "$subscription"
    fi
    
    local current_sub=$(az account show --query "{name:name, id:id}" -o tsv)
    echo ""
    echo -e "${BOLD}Azure Resource Group Cleaner${NC}"
    echo -e "Subscription: ${CYAN}$current_sub${NC}"
    $AUDIT_MODE && echo -e "Mode: ${YELLOW}AUDIT (dry-run)${NC}" || echo -e "Mode: ${RED}LIVE${NC}"
    echo ""
    
    local rgs_json=$(fetch_resource_groups)
    
    select_resource_groups "$rgs_json"
    delete_resource_groups "${SELECTED_RGS[@]+"${SELECTED_RGS[@]}"}"
}

main "$@"
