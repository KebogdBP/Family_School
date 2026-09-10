import { execFileSync } from 'node:child_process'

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })

run('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '120'])
run('docker', [
  'compose',
  'exec',
  '-T',
  'mysql',
  'mysql',
  '-uroot',
  '-phomeedu-root-dev-password',
  '-e',
  "DROP DATABASE IF EXISTS homeedu; CREATE DATABASE homeedu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON homeedu.* TO 'homeedu'@'%'; FLUSH PRIVILEGES;",
])
run('docker', ['compose', 'exec', '-T', 'api', 'php', 'bin/migrate.php'])
