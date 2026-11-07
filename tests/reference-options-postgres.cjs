// Runs only against a new disposable PostgreSQL container, without published ports or volumes.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const container = `srm-reference-test-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '--mount', `type=bind,source=${path.resolve(__dirname, '..')},target=/workspace,readonly`, 'postgres:17-alpine');
  docker('exec', container, 'sh', '-c', 'for i in $(seq 1 60); do pg_isready -U postgres >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1');
  const sql = fs.readFileSync(path.join(__dirname, 'reference-options.sql'), 'utf8')
    .replaceAll('\\ir ../supabase/', '\\ir /workspace/supabase/');
  process.stdout.write(execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8' }));
} finally {
  docker('rm', '-f', container);
}
