#!/usr/bin/env bash
# Start server.py and the Worker (wrangler dev) on fresh databases with the same test
# accounts, then run differential.mjs against both. Needs wrangler (WRANGLER=path).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
WRANGLER="${WRANGLER:-npx wrangler}"
PY_PORT=4399; CF_PORT=8787
rm -rf "$WORK/py" "$WORK/cf"; mkdir -p "$WORK/py" "$WORK/cf"
export NO_PROXY='*' no_proxy='*'

HASH=$(cd "$REPO" && python3 -c "import server; print(server.password_hash('test-password-123'))")
USERS_SQL="INSERT INTO users VALUES('u-fr-antoine','fr-antoine','Fr Antoine Khoury','priest','beirut','p17','$HASH');
INSERT INTO users VALUES('u-rita','rita','Rita Nassar','secretary','beirut','p4','$HASH');
INSERT INTO users VALUES('u-nabil','nabil','Nabil Saade','treasurer','beirut','p15','$HASH');
INSERT INTO users VALUES('u-maya','maya','Maya Haddad','leader','beirut','p3','$HASH');
INSERT INTO users VALUES('u-carla','carla','Carla Abou Jaoude','member','beirut','p6','$HASH');
INSERT INTO users VALUES('u-tony','tony','Tony Gemayel','member','beirut','p5','$HASH');
INSERT INTO users VALUES('u-bishop','bishop','Bishop','bishop','beirut',NULL,'$HASH');
INSERT INTO assignments VALUES('u-fr-antoine','p-elias'),('u-rita','p-elias'),('u-nabil','p-elias'),('u-maya','p-elias'),('u-carla','p-elias'),('u-tony','p-elias');
INSERT INTO complaint_reviewers VALUES('p-elias','u-fr-antoine','[\"Assign\", \"ManageCategories\", \"Resolve\", \"Respond\", \"Review\", \"ViewIdentity\", \"ViewSensitive\"]');"

# server.py on a fresh database
(cd "$WORK/py" && python3 - "$REPO" "$WORK/py/db.sqlite3" <<'PY'
import sys, pathlib, sqlite3
sys.path.insert(0, sys.argv[1]); import server
server.DB = pathlib.Path(sys.argv[2]); server.init_db()
PY
)
python3 -c "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(sys.argv[2]); c.commit()" "$WORK/py/db.sqlite3" "$USERS_SQL"
(cd "$WORK/py" && exec >/dev/null 2>&1 && nohup python3 -c "
import sys, pathlib; sys.path.insert(0, '$REPO'); import server
server.DB = pathlib.Path('$WORK/py/db.sqlite3'); sys.argv = ['server.py', '$PY_PORT']; server.main()" > "$WORK/py/server.log" 2>&1 &)

# the Worker on a fresh local D1: start once to create and seed it, add the accounts, restart
start_cf() { (cd "$REPO" && WRANGLER_SEND_METRICS=false nohup $WRANGLER dev --port $CF_PORT --ip 127.0.0.1 --persist-to "$WORK/cf" --var PARISH_TIMEZONE:UTC > "$WORK/cf/wrangler.log" 2>&1 &); }
wait_for() { for i in $(seq 1 90); do curl -s -o /dev/null --noproxy '*' "$1" && return 0; sleep 1; done; echo "timeout $1"; exit 1; }
stop_cf() { pkill -f "[w]rangler dev --port $CF_PORT" || true; pkill -f "[w]orkerd serve" || true; sleep 2; }
start_cf; wait_for "http://127.0.0.1:$CF_PORT/api/public/parishes"
curl -s --noproxy '*' "http://127.0.0.1:$CF_PORT/api/public/parishes" > /dev/null
stop_cf
D1=$(find "$WORK/cf/v3/d1" -name '*.sqlite' ! -name 'metadata.sqlite' | head -1)
python3 -c "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(sys.argv[2]); c.commit()" "$D1" "$USERS_SQL"
start_cf; wait_for "http://127.0.0.1:$CF_PORT/api/public/parishes"
wait_for "http://127.0.0.1:$PY_PORT/api/public/parishes"

set +e
node "$REPO/cloudflare/test/differential.mjs" "http://127.0.0.1:$PY_PORT" "http://127.0.0.1:$CF_PORT"
STATUS=$?
pkill -f "[s]erver.main()" || true
stop_cf
echo "py db: $WORK/py/db.sqlite3"; echo "cf db: $D1"
exit $STATUS
