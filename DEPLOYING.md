# Deploying ArboDB on a Manjaro server

This puts the whole thing on one machine: the Supabase stack in Docker, the app
built to static files, and nginx in front doing HTTPS. It ends with the same
demo garden you see locally, so you can confirm the deployment works before
replacing the contents with real data.

Budget an hour. Everything here is `sudo`-on-your-own-box work; nothing needs a
cloud account except the free Maanmittauslaitos API key.

**One thing to decide first: the app must be served over HTTPS.** Field mode
reads the device GPS, and browsers only expose `navigator.geolocation` in a
secure context. Over plain `http://` on a LAN address, the whole point of the
app stops working. [Not a public domain?](#not-a-public-domain) covers the
options if the server has no public hostname.

---

## 1. Packages

```bash
sudo pacman -Syu
sudo pacman -S --needed docker docker-compose git nodejs npm nginx certbot certbot-nginx postgresql-libs
```

**If `pacman -Syu` upgraded the kernel, reboot before going further.** Arch and
Manjaro replace `/usr/lib/modules/<running-version>` with the new kernel's
directory, so the running kernel can no longer load any module it has not
already loaded — including the netfilter modules Docker needs to set up
networking. Check:

```bash
uname -r ; ls /usr/lib/modules/
```

If the version `uname -r` prints is not one of the directories listed, reboot.
Skipping this produces a confusing failure two steps later, at
`docker compose up`, rather than here — see [troubleshooting](#troubleshooting).

`postgresql-libs` is only for the `psql` client — the database itself runs in
Docker. Check Node is 20 or newer with `node -v`.

Then confirm Docker is actually in the state the rest of this guide assumes:

```bash
systemctl is-enabled docker.service docker.socket   # at least one "enabled"
docker info >/dev/null 2>&1 && echo "docker works as this user"
```

If neither unit reports `enabled`, the daemon will not start at boot — and the
stack's `restart: unless-stopped` policy then never gets a chance to fire, so the
arboretum stays down after a power cut until someone logs in. Fix with
`sudo systemctl enable --now docker.service`.

If `docker info` failed, either prefix every `docker` command below with `sudo`,
or add yourself to the `docker` group with
`sudo usermod -aG docker "$USER"` and log back in. That group is root-equivalent
— anyone in it can mount the host filesystem into a container — so preferring
`sudo` is a reasonable choice rather than an inconvenience.

Arch and Manjaro ship both units disabled after `pacman -S docker`, unlike
Debian's package, which is why this is worth checking rather than assuming
either way.

---

## 2. The Supabase stack

Supabase publishes a Docker Compose bundle. Pin it to a tag rather than tracking
`master`, so an upstream change never surprises a running arboretum. `--branch`
takes a tag, and combined with `--depth 1` you get exactly that one commit.

```bash
sudo mkdir -p /srv/arbodb && sudo chown "$USER" /srv/arbodb
cd /srv/arbodb

SUPABASE_TAG=v1.26.07
git clone --depth 1 --branch "$SUPABASE_TAG" \
  https://github.com/supabase/supabase.git supabase-src

cp -r supabase-src/docker stack
cp stack/.env.example stack/.env
echo "$SUPABASE_TAG" > /srv/arbodb/STACK_VERSION
```

`v1.26.07` is what this guide was checked against. List newer ones without
cloning:

```bash
git ls-remote --tags --refs https://github.com/supabase/supabase.git | tail -5
```

Note that `--depth 1` fetches a single commit, so you cannot later `git checkout`
a different tag in that clone — to change versions, clone again at the new tag.
That is the point: the version you deployed is the version sitting on disk.

### Secrets

The upstream instructions send you to a web page to mint the API keys, which
means pasting your server's signing secret into someone else's website. They are
ordinary HS256 JWTs, so generate them locally instead:

```bash
cd /path/to/ArboDB
node scripts/make-keys.mjs --years 10
```

That prints `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
`DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, `SECRET_KEY_BASE` and
`VAULT_ENC_KEY`. Copy each value into the matching key in `/srv/arbodb/stack/.env`.

- `ANON_KEY` is public — it ships inside the browser bundle, and row level
  security is what protects the data.
- `SERVICE_ROLE_KEY` **bypasses row level security entirely**. It stays on the
  server. Never put it in a `PUBLIC_` variable.

**Run this once.** Every invocation mints entirely new secrets, so it is not a
way to look a key up later. `stack/.env` is the record of what the stack is
actually running:

```bash
grep '^ANON_KEY=' /srv/arbodb/stack/.env | cut -d= -f2-   # read it back
node scripts/make-keys.mjs --check /srv/arbodb/stack/.env # verify, generate nothing
```

`--check` confirms `ANON_KEY` and `SERVICE_ROLE_KEY` are signed by the
`JWT_SECRET` sitting beside them and have not expired. Re-running the generator
against a live stack is worse than useless: the keys stop matching, and
`POSTGRES_PASSWORD` is written into the database at first init, so changing it
locks the stack out of its own data.

### The rest of `.env`

Set these, replacing `arbo.example.fi` with your hostname:

```ini
SITE_URL=https://arbo.example.fi
API_EXTERNAL_URL=https://arbo.example.fi
SUPABASE_PUBLIC_URL=https://arbo.example.fi

# Any signed-in account can write to the whole register — see the RLS policies in
# the migration. So open registration would hand the arboretum to the internet.
DISABLE_SIGNUP=true
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false
```

`ENABLE_EMAIL_AUTOCONFIRM=true` is right here because you create the accounts
yourself in step 4. Magic-link sign-in additionally needs the `SMTP_*` block
filled in; password sign-in works without it, and for two users that is fine.

### Ports: publish one, and only to localhost

At `v1.26.07` exactly two services publish host ports, and all four bind to
every interface. On a server already running other things that is both a
collision risk and an exposure risk — the pooler's 5432 accepts password
authentication.

The app needs **one** of them. Everything inside the stack talks over the
compose network (`http://kong:8000`, `db:5432`), and the migration commands
below go through `docker compose exec`, not a published port. So delete the
other three rather than finding free numbers for them.

First see what is already taken:

```bash
sudo ss -tlnp                                        # everything listening
sudo ss -tlnp | grep -E ':(8000|8443|5432|6543)\b'   # just the four in question
```

Pick a free port for Kong. **The number goes in `stack/.env` and nowhere else in
the stack:**

```ini
KONG_HTTP_PORT=8100
```

Then in `stack/docker-compose.yml`, add the `127.0.0.1:` prefix and delete the
rest. Leave `${KONG_HTTP_PORT}` as a variable — Compose substitutes it from
`.env`, so you never edit the number here:

```yaml
  kong:
    ports:
      - 127.0.0.1:${KONG_HTTP_PORT}:8000/tcp
      # deleted: ${KONG_HTTPS_PORT}:8443 — nginx terminates TLS and talks
      # plain HTTP to Kong over the loopback.

  supavisor:
    # ports: block deleted entirely. Nothing outside the stack connects to
    # Postgres directly.
```

The three parts are `HOST_IP:HOST_PORT:CONTAINER_PORT`. That trailing `8000` is
Kong's port *inside* its own container — it always listens there regardless of
what you publish it as, so it stays 8000 whatever you choose.

So the port you picked appears in exactly two files: `stack/.env`, and the
`proxy_pass` line in the nginx config, which cannot read `.env`. Check that
Compose resolved it as you expect:

```bash
docker compose config | grep -A5 'kong:' | grep -i published
```

**Do not renumber `POSTGRES_PORT` to dodge a conflict.** Unlike the others it is
not merely a host mapping — it is the port Postgres actually listens on inside
the container, and every service's connection string is built from it. Removing
the published line is the fix; changing the value is a different, larger change.
`KONG_HTTP_PORT`, `KONG_HTTPS_PORT` and `POOLER_PROXY_PORT_TRANSACTION` appear
nowhere except their port mappings, so those are safe to change or drop.

Confirm what is left, then start it:

```bash
grep -n -A4 'ports:' stack/docker-compose.yml    # expect one entry, on 127.0.0.1
```

```bash
cd /srv/arbodb/stack
docker compose up -d
docker compose ps            # every service should be running or healthy
```

Give it a minute on first boot — Postgres initialises before the rest come up.

---

## 3. Schema and demo data

From your ArboDB checkout on the server:

```bash
cd /srv/arbodb
git clone <your-arbodb-remote> app     # or rsync the working copy over
cd app
```

Wait until `docker compose ps` shows everything healthy before this step. The
migrations touch `auth.users` and `storage.buckets`, and those schemas are
created by the auth and storage services during their own first-boot migrations.
Run too early and you get `relation "storage.buckets" does not exist`.

Apply the schema from the stack directory:

```bash
cd /srv/arbodb/stack
MIGRATIONS=/srv/arbodb/app/supabase/migrations /srv/arbodb/app/scripts/apply-migrations.sh
```

The script applies each migration exactly once, in filename order, recording
what it has done in an `arbodb_migrations` table. Each file runs inside a
transaction together with its own bookkeeping row, so a migration that fails
rolls back completely and is retried next run rather than being recorded as
done. It exits non-zero on failure.

This matters because the migration files are ordinary `create table` /
`create policy` statements — **they are not idempotent**. Re-running one by hand
fails partway through and leaves a schema that is tedious to unpick. Let the
script decide what to apply.

Then the demo garden — the Torppa plot, 15 taxa, 17 plantings, 20 specimens, 33
observations:

```bash
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < /srv/arbodb/app/supabase/seed.sql
```

Verify:

```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "select name, boundary_source, (select count(*) from plantings) as plantings from gardens;"
```

You should see `Torppa | drawn | 17`.

### Delete the demo accounts

`seed.sql` also creates two accounts whose passwords are published in this
repository. Remove them before the server is reachable:

```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "delete from auth.users where email like '%@arbodb.test';"
```

Nothing in the arboretum schema references `auth.users`, so this deletes the
logins and leaves every planting, specimen and observation untouched.

---

## 4. Create the real accounts

Use the Auth admin API rather than inserting into `auth.users` by hand. GoTrue
reads its token columns into plain strings and a `NULL` there breaks *every*
sign-in with a confusing "Database error querying schema" — the admin endpoint
gets this right.

```bash
cd /srv/arbodb/stack
SERVICE_KEY=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
KONG_PORT=$(grep '^KONG_HTTP_PORT=' .env | cut -d= -f2-)

EMAIL=friend@example.fi

# Prompts you to CHOOSE the password for this new account. -s means nothing is
# echoed as you type, so it stays out of the terminal scrollback; typing it as a
# command argument instead would put it in ~/.bash_history.
read -rs -p "Password for $EMAIL: " PW; echo

# Piped into curl rather than passed as an argument, because arguments are
# visible in `ps` to anyone else on the box while the command runs. jq does the
# JSON quoting: a password containing a quote, a backslash or a dollar sign
# would otherwise be mangled by the shell, and the only symptom would be a
# sign-in that fails weeks later with "check your email and password".
jq -n --arg e "$EMAIL" --arg p "$PW" \
   '{email:$e, password:$p, email_confirm:true}' |
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  "http://127.0.0.1:$KONG_PORT/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-

unset PW
```

**Check that it printed `HTTP 200`** and a JSON user object with an `id`. Any
other status means the account was not created, and the only symptom later is a
login that fails with "check your email and password". `pacman -S jq` if you
need it.

Repeat for your own account. Pick the passwords with a password manager; with
`DISABLE_SIGNUP=true` these are the only two ways in.

Confirm both landed:

```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "select email, email_confirmed_at is not null as confirmed from auth.users;"
```

---

## 5. Build the app

`PUBLIC_*` variables are inlined into the bundle at build time, not read at
runtime. So `.env` must be correct **before** `npm run build`, and changing the
URL later means rebuilding.

```bash
cd /srv/arbodb/app
cp .env.example .env
```

```ini
PUBLIC_SUPABASE_URL=https://arbo.example.fi
PUBLIC_SUPABASE_ANON_KEY=<the ANON_KEY from step 2>
PUBLIC_MML_API_KEY=<your Maanmittauslaitos key>
PUBLIC_MAP_CENTER_LAT=60.09336
PUBLIC_MAP_CENTER_LON=23.02110
PUBLIC_MAP_ZOOM=17
```

The map centre is only a fallback for before any garden exists; the Torppa row
carries its own centre and wins.

```bash
npm ci
npm run build        # emits build/
```

`PUBLIC_SUPABASE_URL` points at the app's own hostname because nginx proxies the
API under the same origin — one certificate, and no CORS to configure.

---

## 6. nginx

### Already running nginx for other sites?

Then most of this section is a no-op and you only need the server block. The
arboretum is one more virtual host; nothing here changes global config.

- Step 1's `pacman -S --needed` skips packages you already have and reconfigures
  nothing.
- Skip the renewal timer below — it is already running, and the new certificate
  joins it.
- Put the file wherever your nginx keeps vhosts. If you use
  `sites-available` / `sites-enabled` rather than `conf.d`, put it there and
  symlink it.
- `sudo nginx -t` before every reload, and **reload rather than restart** so your
  other sites do not drop connections.
- `certbot -d arb.hw.iki.fi` issues a separate certificate for just that name and
  leaves your existing ones alone.

The one thing to check is that the port you gave Kong does not collide with
anything already listening — see [the ports
section](#ports-publish-one-and-only-to-localhost).

### Installing it

Put the built files where nginx can read them:

```bash
sudo mkdir -p /srv/arbodb/www
sudo rsync -a --delete /srv/arbodb/app/build/ /srv/arbodb/www/
```

The server block is in this repo at
[`deploy/nginx-arbodb.conf`](deploy/nginx-arbodb.conf). Install it, with your
own hostname substituted:

```bash
sudo cp /srv/arbodb/app/deploy/nginx-arbodb.conf /etc/nginx/conf.d/arbodb.conf
sudo sed -i 's/arb\.hw\.iki\.fi/YOUR-HOSTNAME/g' /etc/nginx/conf.d/arbodb.conf
```

If your nginx uses `sites-available` / `sites-enabled` rather than `conf.d`,
put it there and symlink it instead.

### Getting the certificate

The file ships listening on port 80 with no TLS directives, because certbot
writes those itself and nginx will not start while it references a certificate
that does not exist yet.

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d arb.hw.iki.fi
```

Certbot rewrites `listen 80` to `listen 443 ssl`, adds the `ssl_certificate`
lines and the `options-ssl-nginx` / `ssl_dhparam` includes, appends a second
server block redirecting port 80 to https, and reloads. Do not add any of that
by hand — certbot owns those lines and rewrites them on renewal.

On Arch and Manjaro the renewal timer is **not** enabled by `pacman -S certbot`,
so a certificate that works today quietly expires in 90 days:

```bash
systemctl is-enabled certbot-renew.timer   # expect "enabled"
sudo systemctl enable --now certbot-renew.timer
sudo certbot renew --dry-run               # proves renewal works before it matters
```

If you already have certificates renewing for `mf.hw.iki.fi`, this is presumably
handled and the new domain joins the same timer.

### If the hostname has an AAAA record

```bash
dig +short AAAA arb.hw.iki.fi     # empty means IPv4 only, nothing to do
```

`listen 80` / `listen 443 ssl` bind IPv4 only. If the name also resolves over
IPv6 and nginx is not listening there, IPv6-only clients get connection refused
— and Finnish mobile networks do hand out IPv6, so this bites exactly the phone
in the garden while working perfectly on the desktop.

Uncomment the `listen [::]:80;` line **before** running certbot; it converts
whatever listeners it finds, so both end up on 443 with the certificate.

### What the config does

- Proxies **only** `/rest/`, `/auth/` and `/storage/` to Kong on the loopback.
  The port in `proxy_pass` must match `KONG_HTTP_PORT` in `stack/.env` — it ships
  as `8100`. Kong serves Studio on its catch-all `/` route and pg-meta on `/pg/`,
  so a blanket `location / { proxy_pass ... }` would publish the database
  dashboard alongside the arboretum. Everything not in those three prefixes is
  served from disk.
- Keeps `proxy_pass http://…` even once the site is HTTPS. TLS terminates at
  nginx, and the hop to Kong is loopback — those packets never reach a network
  interface, so there is nothing to encrypt them against:

  ```
  phone ──HTTPS──▶ nginx ──HTTP──▶ Kong
         (public)          (127.0.0.1)
  ```

  Certbot edits only `listen` and the `ssl_*` directives; it does not touch
  `proxy_pass`, and it should not. `X-Forwarded-Proto $scheme` is how the
  upstream still knows the original request was HTTPS.
- Serves the SPA with `try_files $uri $uri/ /index.html`, so client-side routes
  like `/kartta` and `/istutus/<uuid>` return the shell instead of 404.
- Caches `/_app/immutable/` for a year (the filenames are content-hashed) and
  marks `index.html`, `manifest.webmanifest` and `_app/version.json` `no-cache`.
  Getting that backwards leaves clients on a stale shell pointing at asset URLs
  that no longer exist.
- Sets `client_max_body_size 25M` for photo and map-layer uploads, which travel
  through `/storage/`. The default 1M would reject them.
- Has no websocket upgrade block, because the app uses no realtime
  subscriptions. Add one if that changes.

### Not a public domain?

You still need HTTPS for GPS to work. **Tailscale** is the least painful route:
`tailscale cert <host>.<tailnet>.ts.net` issues a real, publicly-trusted
certificate for a private machine, and you point `ssl_certificate` at the files
it writes. A self-signed certificate also works, but the root has to be
installed on the phone or the browser refuses the origin — which blocks GPS
just the same.

Plain `http://` to a LAN IP is the one option that does not work. It looks fine
on the desktop and then silently fails in the field.

---

## 7. Keeping it alive

The stack comes back on boot when two things are both true: the compose services
carry a restart policy, and the Docker daemon starts at boot. At `v1.26.07` all
11 services carry `restart: unless-stopped`, so the first half is already done.
Confirm the second, and confirm the first if you pinned a different tag:

```bash
cd /srv/arbodb/stack
grep -c 'restart: unless-stopped' docker-compose.yml   # 11 at v1.26.07
systemctl is-enabled docker.service docker.socket      # expect an "enabled"
```

The honest test is to reboot the server once, before it holds anything you care
about, and confirm the app answers on its own. This is the part nobody notices
is broken until the first power cut.

### Backups

Two things need backing up: the database, and the uploaded photos.

Put the work in a script rather than in `ExecStart` — systemd has its own
opinions about `$`, and a backup that silently writes to a file literally named
`$(date)` is worse than no backup.

`/srv/arbodb/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /srv/arbodb/stack
out=/srv/arbodb/backup
day=$(date +%Y%m%d)
mkdir -p "$out"

docker compose exec -T db pg_dump -U postgres -Fc postgres > "$out/arbodb-$day.dump"
tar czf "$out/storage-$day.tgz" -C /srv/arbodb/stack volumes/storage
find "$out" -name '*.dump' -o -name '*.tgz' -mtime +30 -delete

# An empty dump is a failed dump. Fail loudly so the timer reports it.
test -s "$out/arbodb-$day.dump"
```

```bash
chmod +x /srv/arbodb/backup.sh
```

`/etc/systemd/system/arbodb-backup.service`:

```ini
[Unit]
Description=ArboDB backup

[Service]
Type=oneshot
ExecStart=/srv/arbodb/backup.sh
```

`/etc/systemd/system/arbodb-backup.timer`:

```ini
[Unit]
Description=Nightly ArboDB backup

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now arbodb-backup.timer
sudo systemctl start arbodb-backup.service    # run once now
ls -la /srv/arbodb/backup                     # and check something landed
```

A backup you have never restored is a guess — run `pg_restore --list` against
the dump once to confirm it holds tables and not an error message.

Copy `/srv/arbodb/backup` off the machine periodically. A dump sitting on the
same disk as the database does not survive the disk.

### Updating the app

```bash
cd /srv/arbodb/app
git pull
npm ci && npm run build
sudo rsync -a --delete build/ /srv/arbodb/www/

# New migrations, if any. Already-applied ones are skipped.
cd /srv/arbodb/stack
MIGRATIONS=/srv/arbodb/app/supabase/migrations /srv/arbodb/app/scripts/apply-migrations.sh
```

Run `sudo systemctl start arbodb-backup.service` first — a schema change is
exactly when you want last night's dump to be this morning's.

Never run `seed.sql` against a server holding real data. It is demo content, and
it will add a second copy of the demo garden.

### Reaching Studio

Studio has no host port of its own — Kong serves it as the catch-all `/` route,
behind basic auth. Since the server block proxies only `/rest/*`, `/auth/*` and
`/storage/*`, Studio is not reachable from outside, and neither is the `/pg/*`
route into pg-meta. That is deliberate: proxying `/` to Kong would publish the
database dashboard along with the app.

So tunnel to Kong, not to Studio:

```bash
ssh -L 8100:127.0.0.1:8100 you@arb.hw.iki.fi
```

Then open <http://127.0.0.1:8100> and sign in with `DASHBOARD_USERNAME` /
`DASHBOARD_PASSWORD`. Use `KONG_HTTP_PORT` from `.env` if you changed it.

---

## Troubleshooting

**`Failed to Setup IP tables … MASQUERADE revision 0 not supported, missing
kernel module?`** at `docker compose up` — the kernel was upgraded and the
machine has not been rebooted. `pacman` swaps `/usr/lib/modules/` to the new
version, so the running kernel cannot load `xt_MASQUERADE` any more and Docker
cannot create the network's NAT rule. Confirm with
`uname -r ; ls /usr/lib/modules/`; if the running version is missing from that
listing, reboot. The half-created network cleans itself up, but
`docker network prune` is harmless if one is left behind.

**"An invalid response was received from the upstream server"** — Kong caches
container IPs and holds stale ones after the database container is recreated.
`docker compose restart kong`.

**Sign-in fails with "Database error querying schema"** — a row in `auth.users`
has `NULL` in one of the token columns. Created through the admin API in step 4
this cannot happen; hand-inserted rows must set `confirmation_token`,
`recovery_token`, `email_change` and `email_change_token_new` to `''`.

**Sign-in returns `400 invalid_credentials`** — everything between the browser
and GoTrue is working; this is only about the account. GoTrue deliberately does
not distinguish "no such user" from "wrong password", so ask the database:

```bash
cd /srv/arbodb/stack
docker compose exec -T db psql -U postgres -d postgres -c \
  "select email, email_confirmed_at is not null as confirmed from auth.users;"
```

No rows means step 4 never completed — most likely its `curl` failed and the
error scrolled past. Run it again and check for `HTTP 200`.

If the account is there, the password is not what you think it is. Rather than
guess, set a new one:

```bash
SERVICE_KEY=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
KONG_PORT=$(grep '^KONG_HTTP_PORT=' .env | cut -d= -f2-)
# Not UID — bash reserves that one and the assignment would fail.
USER_ID=$(docker compose exec -T db psql -U postgres -d postgres -tA -c \
  "select id from auth.users where email = 'friend@example.fi';" | tr -d '\r')

read -rs -p "New password: " PW; echo
jq -n --arg p "$PW" '{password:$p}' |
curl -s -w '\nHTTP %{http_code}\n' -X PUT \
  "http://127.0.0.1:$KONG_PORT/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-
unset PW
```

**`relation "storage.buckets" does not exist`** while applying migrations — the
storage service had not finished its own first-boot migrations. Wait for
`docker compose ps` to show it healthy and run the script again; the failed
migration was rolled back, so it simply retries.

**`permission denied for table plantings`** — the migration's `GRANT` block did
not run. Grants and RLS policies are separate gates and PostgREST needs both.
Check `select * from arbodb_migrations;` to see what actually applied.

**The map shows OpenStreetMap instead of the aerial photo** — `PUBLIC_MML_API_KEY`
was empty at build time. Fix `.env` and rebuild; the app degrades deliberately
rather than showing a broken map.

**The app loads but every request 401s** — `PUBLIC_SUPABASE_ANON_KEY` in the
app's `.env` does not match the stack. Compare it against the live value and
check the stack's own keys are internally consistent:

```bash
grep '^ANON_KEY=' /srv/arbodb/stack/.env | cut -d= -f2-
grep '^PUBLIC_SUPABASE_ANON_KEY=' /srv/arbodb/app/.env | cut -d= -f2-
node /srv/arbodb/app/scripts/make-keys.mjs --check /srv/arbodb/stack/.env
```

If the two differ, copy the stack's value into the app's `.env` and rebuild —
`PUBLIC_*` variables are baked in at build time, so editing `.env` alone changes
nothing. If `--check` reports a signature mismatch, the stack's own `.env` is
inconsistent: some keys were regenerated and others were not.

**GPS never gets a fix on the phone, but works on the desktop** — the site is not
on a secure origin. See [Not a public domain?](#not-a-public-domain).
