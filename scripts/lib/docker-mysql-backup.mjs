import { spawnSync } from 'node:child_process'

const compose = (args, options = {}) => {
  const result = spawnSync('docker', ['compose', ...args], { encoding: null, maxBuffer: 64 * 1024 * 1024, ...options })
  if (result.status !== 0)
    throw new Error(Buffer.from(result.stderr ?? '').toString() || `docker compose завершился с кодом ${result.status}`)
  return Buffer.from(result.stdout ?? '')
}

export const mysql = (database, sql) =>
  compose([
    'exec',
    '-T',
    'mysql',
    'sh',
    '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B "$1" -e "$2"',
    'mysql-command',
    database,
    sql,
  ])
    .toString()
    .trim()

export const mysqlServer = (sql) =>
  compose([
    'exec',
    '-T',
    'mysql',
    'sh',
    '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B -e "$1"',
    'mysql-server-command',
    sql,
  ])
    .toString()
    .trim()

export const dumpDatabase = (database = 'homeedu') =>
  compose([
    'exec',
    '-T',
    'mysql',
    'sh',
    '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF --default-character-set=utf8mb4 "$1"',
    'mysql-dump',
    database,
  ])

export const restoreDatabase = (database, dump) => {
  compose(
    [
      'exec',
      '-T',
      'mysql',
      'sh',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 "$1"',
      'mysql-restore',
      database,
    ],
    { input: dump },
  )
}

export const databaseSnapshot = (database) => {
  const tables = mysqlServer(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='${database}' ORDER BY table_name`,
  )
    .split('\n')
    .filter(Boolean)
  if (tables.length === 0) throw new Error(`В базе ${database} нет таблиц`)
  const union = tables
    .map((table) => `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM \`${table}\``)
    .join(' UNION ALL ')
  const counts = mysql(database, union)
  const checksums = mysqlServer(`CHECKSUM TABLE ${tables.map((table) => `\`${database}\`.\`${table}\``).join(',')}`)
    .split('\n')
    .map((line) => line.replace(`${database}.`, ''))
    .join('\n')
  return `${counts}\n-- checksums --\n${checksums}`
}
