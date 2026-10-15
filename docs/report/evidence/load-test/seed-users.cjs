// Creates 50 load-test accounts on the LOCAL Supabase stack only (127.0.0.1). Never run against production.
const path = require("path");
const repo = process.argv[2];
const req = require("module").createRequire(path.join(repo, "package.json"));
const { createClient } = req("@supabase/supabase-js");

const URL = "http://127.0.0.1:54321";
// Local secret key, from `npx supabase status -o env` (SECRET_KEY); run-all.sh and run-native.sh export it.
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SECRET) throw new Error("Set SUPABASE_SECRET_KEY to the local key from `npx supabase status -o env`");
const PASSWORD = "LoadTest-2026!";
const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

(async () => {
  const users = [];
  for (let i = 1; i <= 50; i++) {
    const n = String(i).padStart(2, "0");
    const { data, error } = await admin.auth.admin.createUser({
      email: `load${n}@meq.test`, password: PASSWORD, email_confirm: true,
      user_metadata: { display_name: `Load ${n}` },
    });
    if (error) throw error;
    users.push({ n: i, id: data.user.id, email: `load${n}@meq.test` });
  }
  require("fs").writeFileSync(path.join(__dirname, "users.json"), JSON.stringify(users, null, 1));
  console.log("created", users.length);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
