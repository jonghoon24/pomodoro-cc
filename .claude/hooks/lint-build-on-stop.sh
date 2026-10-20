#!/usr/bin/env bash
# Stop 훅: 작업 트리에 바뀐 파일이 있으면 npm run lint와 npm run build를 돌린다.
# 실패하면 exit 2로 에러 출력을 Claude에게 돌려줘 응답을 끝내지 못하고 고치게 한다.
set -uo pipefail

MAX_RETRIES=5   # 한 응답 안에서 연속으로 막는 최대 횟수 (무한 루프 방지)
TAIL_LINES=150  # 돌려줄 에러 출력 줄 수

input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# 바뀐 파일이 없으면 검사하지 않는다.
[ -z "$(git status --porcelain)" ] && exit 0

state_dir="$(git rev-parse --git-dir)/claude-stop-check"
mkdir -p "$state_dir"

# 작업 트리 지문: 추적 파일의 diff + 추적되지 않은 파일 내용 해시.
# 마지막으로 통과한 지문과 같으면(그 뒤로 바뀐 게 없으면) 다시 돌리지 않는다.
fingerprint=$(
  {
    git diff HEAD --binary
    git ls-files --others --exclude-standard | git hash-object --stdin-paths
  } | git hash-object --stdin
)
[ "$fingerprint" = "$(cat "$state_dir/passed" 2>/dev/null)" ] && exit 0

report=""
lint_out=$(npm run lint 2>&1) || report+=$'\n## npm run lint 실패\n'"$(tail -n "$TAIL_LINES" <<<"$lint_out")"$'\n'
build_out=$(npm run build 2>&1) || report+=$'\n## npm run build 실패\n'"$(tail -n "$TAIL_LINES" <<<"$build_out")"$'\n'

if [ -z "$report" ]; then
  echo "$fingerprint" >"$state_dir/passed"
  rm -f "$state_dir/retries"
  exit 0
fi

# 새 응답의 첫 Stop이면 카운터를 초기화하고, 훅 때문에 이어진 Stop이면 늘린다.
if [ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ]; then
  retries=$(( $(cat "$state_dir/retries" 2>/dev/null || echo 0) + 1 ))
else
  retries=1
fi
echo "$retries" >"$state_dir/retries"

if [ "$retries" -gt "$MAX_RETRIES" ]; then
  rm -f "$state_dir/retries"
  jq -n --arg msg "lint/build가 ${MAX_RETRIES}번 연속 실패해 Stop 훅이 더 이상 막지 않습니다. 직접 확인해 주세요." \
    '{systemMessage: $msg}'
  exit 0
fi

{
  echo "바뀐 파일이 있어 lint와 build를 돌렸는데 실패했습니다 (시도 ${retries}/${MAX_RETRIES})."
  echo "아래 에러를 고친 뒤 응답을 마치세요."
  echo "$report"
} >&2
exit 2
