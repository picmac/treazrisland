#!/usr/bin/env bash

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::The jq CLI is required to query GitHub's runner API. Install jq in the runner image."
  exit 1
fi

required_label="${REQUIRED_LABEL:-treaz-home}"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY environment variable is required}"

token="${ACTIONS_ADMIN_TOKEN:-}"
if [[ -z "${token}" ]]; then
  token="${GITHUB_TOKEN:-}"
fi

if [[ -z "${token}" ]]; then
  echo "::warning::No token available to query the GitHub API. Skipping runner verification."
  exit 0
fi

api_url="https://api.github.com/repos/${repository}/actions/runners?per_page=100"
tmp_file="$(mktemp)"
trap 'rm -f "${tmp_file}"' EXIT

http_status=$(curl -sS \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${token}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -o "${tmp_file}" \
  -w "%{http_code}" \
  "${api_url}" || true)

if [[ -z "${http_status}" ]]; then
  http_status="000"
fi

case "${http_status}" in
  000)
    echo "::error::Network failure while querying self-hosted runners."
    cat "${tmp_file}"
    exit 1
    ;;
  401)
    if [[ -n "${ACTIONS_ADMIN_TOKEN:-}" ]]; then
      echo "::warning::The token supplied in ACTIONS_ADMIN_TOKEN was rejected (HTTP 401). Ensure it is a classic PAT with admin:org or a fine-grained token with Repository administration → Read permission."
    else
      echo "::warning::GitHub's workflow token was rejected when listing self-hosted runners (HTTP 401)."
    fi
    echo "::notice::Skipping deploy runner availability check because authentication failed."
    exit 0
    ;;
  403)
    if [[ -n "${ACTIONS_ADMIN_TOKEN:-}" ]]; then
      echo "::warning::The token supplied in ACTIONS_ADMIN_TOKEN cannot list self-hosted runners (HTTP 403)."
      echo "::notice::Ensure the secret stores a classic PAT with admin:org or a fine-grained token with Repository administration → Read."
    else
      echo "::warning::GitHub's workflow token cannot access the self-hosted runner API (HTTP 403)."
      echo "::notice::Add a classic PAT with the admin:org scope as the ACTIONS_ADMIN_TOKEN secret to re-enable verification, or check the runner status manually."
    fi
    echo "::notice::Skipping deploy runner availability check because the API call is not permitted with the current token."
    exit 0
    ;;
  404)
    echo "::warning::Self-hosted runner API returned HTTP 404. This can occur for private forks or when the token lacks access to the repository metadata."
    echo "::notice::Skipping deploy runner availability check because the repository information is unavailable with the supplied credentials."
    exit 0
    ;;
  200)
    ;;
  *)
    echo "::error::Failed to query self-hosted runners (HTTP ${http_status})."
    cat "${tmp_file}"
    exit 1
    ;;
esac

matching_count=$(jq --arg label "${required_label}" '[(.runners // [])[] | select(((.labels // []) | map(.name) | index($label)) != null)] | length' "${tmp_file}")

if [[ "${matching_count}" == "0" ]]; then
  echo "::error::No self-hosted runners registered with the \"${required_label}\" label. Register the production deploy runner or update .github/workflows/ci.yml."
  exit 1
fi

online_count=$(jq --arg label "${required_label}" '[(.runners // [])[] | select(((.labels // []) | map(.name) | index($label)) != null and .status == "online")] | length' "${tmp_file}")

if [[ "${online_count}" == "0" ]]; then
  matching_names=$(jq -r --arg label "${required_label}" '[(.runners // [])[] | select(((.labels // []) | map(.name) | index($label)) != null) | .name] | join(", ")' "${tmp_file}")
  if [[ -z "${matching_names}" ]]; then
    matching_names="unknown"
  fi
  echo "::error::Self-hosted runners with the \"${required_label}\" label are offline. Current registered runners: ${matching_names}. Start the Actions runner service on the deployment host."
  exit 1
fi

online_names=$(jq -r --arg label "${required_label}" '[(.runners // [])[] | select(((.labels // []) | map(.name) | index($label)) != null and .status == "online") | .name] | join(", ")' "${tmp_file}")

if [[ -z "${online_names}" ]]; then
  online_names="unknown"
fi

echo "Deploy runner(s) online: ${online_names}"
