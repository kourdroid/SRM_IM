const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const container = `srm-report-check-${process.pid}`;

function run(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `docker ${args.join(' ')} failed`);
  return result.stdout;
}
function migration(file) {
  return fs.readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8');
}
function definition(file, name) {
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\([\\s\\S]*?\\n(?:\\$\\$|\\$function\\$);`, 'i');
  const match = migration(file).match(pattern);
  if (!match) throw new Error(`Missing ${name} in ${file}`);
  return match[0];
}

const schema = `
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),name text,role text,approval_status text);
CREATE TABLE public.communes(id uuid PRIMARY KEY,name text);
CREATE TABLE public.incidents(id uuid PRIMARY KEY,title text,type text,incident_type text,depart_hta text,village text,status text,created_by uuid,date timestamptz,equipment_used text NOT NULL,created_at timestamptz,archived_at timestamptz,commune_id uuid,reclamation boolean,closed_at timestamptz,latitude double precision,longitude double precision,media_urls text[],description text,reclamation_name text,reclamation_by text);
CREATE TABLE public.incident_materials(id uuid PRIMARY KEY,incident_id uuid,material_name text,quantity numeric,created_at timestamptz);
CREATE TABLE public.report_exports(id uuid DEFAULT gen_random_uuid(),requested_by uuid,start_date date,end_date date,format text);
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT,INSERT ON public.report_exports TO authenticated;
CREATE VIEW private.active_incidents WITH (security_invoker=true) AS SELECT * FROM public.incidents WHERE archived_at IS NULL;
`;
const approval = '20260605140204_user_profile_admin_approval.sql';
const helpers = ['is_admin', 'is_director', 'is_admin_or_director'].map(name => definition(approval, name));
const reports = [
  ['20260526003000_incident_archive_reporting.sql', 'get_incident_report_summary'],
  ['20260608120000_incident_materials.sql', 'get_incident_report_breakdowns'],
  ['20261026213552_atomic_closure_and_stable_pagination.sql', 'get_incident_report_rows'],
].map(([file, name]) => definition(file, name).replace(/public\.incidents\b/g, 'private.active_incidents'));
const sql = [schema, ...helpers, ...reports, migration('20261104131618_director_report_access.sql'),
  migration('20261105090000_report_access_denied_errors.sql'), fs.readFileSync(path.join(__dirname, 'director-report-access.sql'), 'utf8')].join('\n');

try {
  run(['run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_PASSWORD=local-test', 'postgres:17-alpine']);
  const ready = spawnSync('docker', ['exec', container, 'sh', '-c', 'until pg_isready -U postgres >/dev/null; do sleep 1; done'], { encoding: 'utf8', timeout: 30000 });
  if (ready.status !== 0) throw new Error(ready.stderr || 'PostgreSQL did not become ready');
  process.stdout.write(run(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql));
  console.log('Director report PostgreSQL canary passed (minimal schema, actual report functions).');
} finally {
  spawnSync('docker', ['stop', container], { stdio: 'ignore' });
}
