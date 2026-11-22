/* Purpose: load test of ParishLife's main flows against a LOCAL host only (never production): anonymous visitors opening the public
   homepage and a parish page, and signed-in office staff loading the portal (the requests the priest's portal makes on sign-in and after
   every save). Written for the test-only host ParishLife.EndToEnd, which creates fixture accounts in temporary storage and lifts the
   general per-address limit (see docs/verification/end-to-end.md); each virtual user also sends its own X-E2E-Client address.
   Main parts: PROFILES (pilot peak and ten times it), setup (signs in the fixture priest once with the manifest's test password and
   authenticator key), visitor and staff flows, thresholds on errors and p95.

   Run, from the repository root:
     1. cd frontend && npm run build && cd ..
     2. Start the host and keep its stdin open (closing stdin stops it and deletes its temporary data):
          tail -f /dev/null | dotnet run -c Release --project ParishLife.EndToEnd -- --manifest /tmp/pl-load/manifest.json --port 7311
        Wait for "E2E READY". For quieter, faster runs set Logging__LogLevel__Microsoft.AspNetCore=Warning in its environment.
     3. k6 run -e E2E_MANIFEST=/tmp/pl-load/manifest.json -e PROFILE=pilot tools/load/parishlife.k6.js
        k6 run -e E2E_MANIFEST=/tmp/pl-load/manifest.json -e PROFILE=tenx  tools/load/parishlife.k6.js
        Wait 30 s between runs: setup signs the priest in, and each authenticator code signs in once.
   Optional: -e BASE_URL=https://localhost:7311 (default: the manifest's baseUrl), -e HOLD=1m, -e RAMP=30s.
   The run refuses any host that is not local. Local timings are not production timings (local file storage, one machine). */
import http from "k6/http";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { check, sleep, fail } from "k6";

const M = JSON.parse(open(__ENV.E2E_MANIFEST));
const BASE = (__ENV.BASE_URL || M.baseUrl).replace(/\/$/, "");
const host = BASE.replace(/^https?:\/\//, "").split(/[:/]/)[0];
if (!/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(host))
    throw new Error(
        `Refusing to load-test ${host}: only local hosts are allowed (never production).`,
    );

/* Pilot peak (an assumption, the owner has not given one): one parish, 40 visitors reading the public site and 10 office staff working
   in the portal at the same moment. Ten times that is 400 and 100. Think times are a person reading a page, not a script. */
const PROFILES = {
    pilot: { visitors: 40, staff: 10 },
    tenx: { visitors: 400, staff: 100 },
};
const profile =
    PROFILES[__ENV.PROFILE || "pilot"] || fail("PROFILE must be pilot or tenx");
const ramp = __ENV.RAMP || "30s",
    hold = __ENV.HOLD || "2m";

export const options = {
    insecureSkipTLSVerify: true, // the local development certificate
    scenarios: {
        visitors: {
            executor: "ramping-vus",
            exec: "visitor",
            stages: [
                { duration: ramp, target: profile.visitors },
                { duration: hold, target: profile.visitors },
                { duration: "10s", target: 0 },
            ],
        },
        staff: {
            executor: "ramping-vus",
            exec: "staff",
            stages: [
                { duration: ramp, target: profile.staff },
                { duration: hold, target: profile.staff },
                { duration: "10s", target: 0 },
            ],
        },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
        "http_req_duration{flow:visitor}": ["p(95)<1000"],
        "http_req_duration{flow:staff}": ["p(95)<1500"],
    },
};

/* The fixture's authenticator code (RFC 6238, SHA-1, 30 s, 6 digits) from the manifest's Base32 test key. */
function totp(secret, at = Date.now()) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const c of secret.replace(/=+$/, ""))
        bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
    const key = new Uint8Array(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
    const counter = new Uint8Array(8);
    let step = Math.floor(at / 30000);
    for (let i = 7; i >= 0; i--, step = Math.floor(step / 256))
        counter[i] = step % 256;
    const hash = new Uint8Array(
        encoding.b64decode(
            crypto.hmac("sha1", key.buffer, counter.buffer, "base64"),
            "std",
        ),
    );
    const o = hash[hash.length - 1] & 15;
    const value =
        ((hash[o] & 0x7f) << 24) |
        (hash[o + 1] << 16) |
        (hash[o + 2] << 8) |
        hash[o + 3];
    return String(value % 1000000).padStart(6, "0");
}

// A 404 (a profile or homepage not published yet) and a 403 (a module the role may not open) are ordinary answers, not failures.
http.setResponseCallback(
    http.expectedStatuses({ min: 200, max: 399 }, 403, 404),
);

const json = (r) => {
    try {
        return r.json();
    } catch {
        return null;
    }
};

export function setup() {
    const headers = {
        "X-E2E-Client": "10.20.0.1",
        "Content-Type": "application/json",
    };
    const csrf = () =>
        json(http.get(`${BASE}/api/auth/csrf`, { headers })).token;
    let token = csrf();
    const login = http.post(
        `${BASE}/api/auth/login`,
        JSON.stringify({
            username: M.accounts.priest.username,
            password: M.password,
        }),
        {
            headers: { ...headers, "X-CSRF-TOKEN": token },
        },
    );
    const challenge =
        json(login)?.challenge ||
        fail("sign-in did not ask for the authenticator: " + login.status);
    const mfa = http.post(
        `${BASE}/api/auth/login/mfa`,
        JSON.stringify({
            accountId: challenge.accountId,
            challenge: challenge.challenge,
            code: totp(M.totpSecret),
        }),
        { headers: { ...headers, "X-CSRF-TOKEN": token } },
    );
    if (mfa.status !== 200)
        fail(
            "authenticator step failed: " +
                mfa.status +
                " (each code signs in once; wait 30 s and retry)",
        );
    const cookies = http.cookieJar().cookiesForURL(BASE);
    return {
        cookie: Object.entries(cookies)
            .map(([name, values]) => `${name}=${values[0]}`)
            .join("; "),
        appointment: M.accounts.priest.appointmentId,
        parish: M.parishId,
    };
}

// One instant per iteration, as the browser does, so a 31-day window is exactly 31 days (the API refuses longer).
let now = Date.now();
const iso = (days) => new Date(now + days * 86400000).toISOString();
const day = (days) => iso(days).slice(0, 10);
// Any other error is counted by http_req_failed; the first few per virtual user are named so a failing run says what failed.
let named = 0;
function report(responses) {
    for (const r of responses)
        if (
            !check(r, {
                "answered (403/404 are ordinary answers)": (x) =>
                    x.status < 400 || x.status === 403 || x.status === 404,
            }) &&
            named++ < 3
        )
            console.warn(
                `${r.status} ${r.request.method} ${r.url.replace(BASE, "")}`,
            );
    return responses;
}
const client = () => `10.30.${Math.floor(__VU / 250)}.${__VU % 250}`;

/* One visitor: the homepage as the browser loads it (directory, published content, each listed parish's website, next month of
   events and profile), then one parish's own page. */
export function visitor() {
    now = Date.now();
    const params = {
        headers: { "X-E2E-Client": client() },
        tags: { flow: "visitor" },
    };
    const get = (urls) =>
        report(http.batch(urls.map((u) => ["GET", BASE + u, null, params])));
    const page = http.get(`${BASE}/public.html`, params);
    check(page, { "public page 200": (r) => r.status === 200 });
    const directory = json(http.get(`${BASE}/api/public/parishes`, params));
    const parishes = (directory?.items || [])
        .slice(0, 40)
        .map((p) => p.parishId);
    get([
        "/api/public/homepage?lang=en",
        "/api/public/homepage?lang=ar",
        "/api/public/app/manifest",
        "/api/public/app/offline-policy",
    ]);
    for (let i = 0; i < parishes.length; i += 6) {
        const urls = [];
        for (const id of parishes.slice(i, i + 6)) {
            const base = `/api/public/parishes/${id}`;
            urls.push(
                `${base}/website`,
                `${base}/calendar?start=${encodeURIComponent(iso(-1))}&end=${encodeURIComponent(iso(30))}&size=50`,
                `${base}/profile`,
            );
        }
        get(urls);
    }
    get([
        `/api/public/parishes/${M.parishId}/liturgical-calendar?from=${day(0)}&to=${day(6)}&lang=en`,
    ]);
    sleep(5 + Math.random() * 10);

    const base = `/api/public/parishes/${M.parishId}`;
    const windows = [-7, 24, 55, 86, 117].map(
        (a) =>
            `${base}/calendar?start=${encodeURIComponent(iso(a))}&end=${encodeURIComponent(iso(Math.min(a + 31, 120)))}&size=50`,
    );
    http.get(`${BASE}/public.html?parish=${M.parishId}`, params);
    get([
        `${base}/website`,
        ...windows,
        `${base}/ministries?size=50`,
        `${base}/liturgical-calendar?from=${day(-7)}&to=${day(120)}&lang=en`,
        `${base}/liturgical-calendar?from=${day(-7)}&to=${day(120)}&lang=ar`,
        `${base}/profile`,
        `${base}/announcements`,
    ]);
    sleep(5 + Math.random() * 10);
}

/* One office member: the portal load the priest's browser makes (its people, sacraments, calendar, finance, communications and
   administration modules), as on sign-in and after each save. */
export function staff(data) {
    now = Date.now();
    const params = {
        headers: {
            "X-E2E-Client": client(),
            Cookie: data.cookie,
            "X-ParishLife-Appointment": data.appointment,
        },
        tags: { flow: "staff" },
    };
    const p = `/api/parishes/${data.parish}`;
    const month = (n) => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCMonth(d.getUTCMonth() + n);
        return d.toISOString();
    };
    const sacraments = [
        "Baptism",
        "Confirmation",
        "FirstCommunion",
        "Marriage",
        "Funeral",
        "Anointing",
        "Other",
    ].map((s) => `${p}/sacraments?sacrament=${s}&size=100`);
    const months = [-1, 0, 1, 2, 3].map(
        (n) =>
            `${p}/calendar/events?size=100&start=${encodeURIComponent(month(n))}&end=${encodeURIComponent(month(n + 1))}`,
    );
    const urls = [
        "/api/auth/me",
        "/api/me/parishes",
        "/api/me/capacities",
        "/api/auth/profile",
        "/api/notifications?size=50",
        p,
        `${p}/people?pageSize=100&`,
        `${p}/people/facts?size=100`,
        `${p}/consents?kind=Directory&size=100`,
        ...sacraments,
        `${p}/certificates`,
        `${p}/sacraments/corrections`,
        `${p}/sacraments/anniversaries?from=${day(0)}&days=92`,
        `${p}/sacraments/requirements`,
        `${p}/facilities?size=100`,
        `${p}/maintenance-blocks?start=${encodeURIComponent(iso(-31))}&end=${encodeURIComponent(iso(0))}&size=100`,
        `${p}/reservations?start=${encodeURIComponent(iso(-31))}&end=${encodeURIComponent(iso(0))}&size=100`,
        `${p}/equipment?size=100`,
        `${p}/facility-issues?size=100`,
        `${p}/renters`,
        ...months,
        `${p}/ministries?size=100`,
        ...[
            "funds",
            "balances",
            "campaigns",
            "pledges",
            "contributions",
            "expenses",
            "bank/lines",
            "bank/reconciliations",
            "exchange-rates",
            "budgets",
            "recurring-gifts",
            "receipts",
            "sessions",
        ].map((f) => `${p}/finance/${f}`),
        `${p}/office-ledger/entries`,
        `${p}/office-ledger/balances`,
        `${p}/office-ledger/openings`,
        `${p}/broadcasts`,
        `${p}/broadcast-templates`,
        `${p}/announcements`,
        `${p}/website/sections`,
        `${p}/prayer-intentions`,
        `${p}/requests?size=100`,
        `${p}/requests/mine?size=100`,
        `${p}/person-account-links/mine`,
        `${p}/pastoral-notes`,
        `${p}/workflows?size=50`,
        `${p}/workflow-runs?size=50`,
        `${p}/status/history`,
        `${p}/audit?size=100`,
    ];
    // the browser keeps six connections to one host over HTTP/1.1 (production today), so six at a time
    for (let i = 0; i < urls.length; i += 6) {
        const responses = http.batch(
            urls.slice(i, i + 6).map((u) => ["GET", BASE + u, null, params]),
        );
        report(responses);
    }
    sleep(10 + Math.random() * 10);
}
