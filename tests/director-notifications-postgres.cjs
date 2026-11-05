// Runs the migration against a disposable PostgreSQL container with mocked Supabase auth and dispatch.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const container = `srm-director-notifications-test-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '--mount', `type=bind,source=${path.resolve(__dirname, '..')},target=/workspace,readonly`, 'postgres:17-alpine');
  docker('exec', container, 'sh', '-c', 'for i in $(seq 1 60); do pg_isready -U postgres >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1');
  process.stdout.write(execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: fs.readFileSync(path.join(__dirname, 'director-notifications-postgres.sql'), 'utf8'), encoding: 'utf8' }));
} finally {
  docker('rm', '-f', container);
}
