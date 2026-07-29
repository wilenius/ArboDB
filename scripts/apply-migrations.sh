#!/usr/bin/env bash
#
# Apply ArboDB migrations, each exactly once.
#
# The migration files are plain `create table` / `create policy` — they are not
# idempotent, so re-running one fails halfway and leaves the schema in a state
# nobody wants to debug in February. This records what has been applied and
# skips it next time.
#
#   ./scripts/apply-migrations.sh                       # from the stack directory
#   ARBODB_PSQL="docker exec -i my_db_container psql" ./scripts/apply-migrations.sh
#
# Set MIGRATIONS to point at the directory if it is not ./supabase/migrations.

set -euo pipefail

MIGRATIONS=${MIGRATIONS:-supabase/migrations}
ARBODB_PSQL=${ARBODB_PSQL:-"docker compose exec -T db psql"}
ARBODB_DB=${ARBODB_DB:-postgres}

psql_run() {
	# Unquoted on purpose: ARBODB_PSQL is a command line, not a single word.
	# shellcheck disable=SC2086
	$ARBODB_PSQL -v ON_ERROR_STOP=1 -U postgres -d "$ARBODB_DB" "$@"
}

if [ ! -d "$MIGRATIONS" ]; then
	echo "no migrations directory at $MIGRATIONS" >&2
	exit 1
fi

psql_run -q -c "
create table if not exists arbodb_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);" >/dev/null

applied=0
skipped=0

# Filenames are timestamped, so the glob sorts into the right order.
for path in "$MIGRATIONS"/*.sql; do
	name=$(basename "$path")
	seen=$(psql_run -tA -c "select 1 from arbodb_migrations where filename = '$name'")
	if [ -n "$seen" ]; then
		echo "  skip  $name"
		skipped=$((skipped + 1))
		continue
	fi

	echo "  apply $name"
	# Each migration and its bookkeeping go in one transaction, so a failure
	# rolls back both and the file is retried rather than recorded as done.
	{
		echo 'begin;'
		cat "$path"
		echo ";"
		echo "insert into arbodb_migrations (filename) values ('$name');"
		echo 'commit;'
	} | psql_run -q

	applied=$((applied + 1))
done

echo "applied $applied, skipped $skipped"
