// Runs only against a new disposable PostgreSQL container, without published ports or volumes.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const container = `srm-material-test-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '--mount', `type=bind,source=${path.resolve(__dirname, '..')},target=/workspace,readonly`, 'postgres:17-alpine');
  docker('exec', container, 'sh', '-c', 'for i in $(seq 1 60); do pg_isready -U postgres >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1');
  // Only the closure function is needed from the previous migration, not unrelated reporting functions.
  const sql = require('node:fs').readFileSync(path.join(__dirname, 'material-closure.sql'), 'utf8')
    .replace('\\ir ../supabase/migrations/20261026213552_atomic_closure_and_stable_pagination.sql',
      () => require('node:fs').readFileSync(path.join(__dirname, '../supabase/migrations/20261026213552_atomic_closure_and_stable_pagination.sql'), 'utf8')
        .split('CREATE OR REPLACE FUNCTION public.get_director_incidents_page')[0])
    .replaceAll('\\ir ../supabase/', '\\ir /workspace/supabase/');
  process.stdout.write(execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8' }));
} finally {
  docker('rm', '-f', container);
}
