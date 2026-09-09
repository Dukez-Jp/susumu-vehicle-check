#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir/.."
component=${1:-all}
case "$component" in all|backend|web|mobile|infrastructure) ;; *) printf 'Unknown component\n' >&2; exit 2 ;; esac
if [[ "$component" == all || "$component" == infrastructure ]]; then
  python3 -B -m unittest discover -s scripts/tests -v
  for script in scripts/*.sh; do bash -n "$script"; done
fi
if [[ "$component" == all || "$component" == backend ]]; then
  dotnet restore backend/Susumu.slnx
  dotnet build backend/Susumu.slnx -c Release --no-restore
  dotnet test backend/Susumu.slnx -c Release --no-build --logger trx --results-directory artifacts/test-results/backend
fi
if [[ "$component" == all || "$component" == web ]]; then
  (cd admin-web && npm ci && npm run lint && npm test && npm run build)
fi
if [[ "$component" == all || "$component" == mobile ]]; then
  (
    cd mobile
    flutter pub get
    dart run build_runner build --delete-conflicting-outputs
    dart format --output=none --set-exit-if-changed lib test
    flutter analyze --fatal-infos
    flutter test
    if [[ "${BUILD_DEV_APK:-false}" == true ]]; then
      flutter build apk --debug --dart-define=ALLOW_HTTP_DEV=true
    fi
  )
fi
printf '%s checks passed. Only the selected checks were run.\n' "$component"
