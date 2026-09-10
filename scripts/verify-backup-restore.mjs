import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { databaseSnapshot, dumpDatabase, mysqlServer, restoreDatabase } from './lib/docker-mysql-backup.mjs'

const source = 'homeedu'
const restored = 'homeedu_restore_test'
const temporary = mkdtempSync(join(tmpdir(), 'homeedu-backup-check-'))

try {
  const before = databaseSnapshot(source)
  const dump = dumpDatabase(source)
  if (dump.length < 1024 || !dump.includes(Buffer.from('CREATE TABLE')))
    throw new Error('Резервная копия пуста или не содержит схему')
  writeFileSync(join(temporary, 'homeedu.sql'), dump, { mode: 0o600 })
  mysqlServer(
    `DROP DATABASE IF EXISTS ${restored}; CREATE DATABASE ${restored} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  restoreDatabase(restored, dump)
  const after = databaseSnapshot(restored)
  if (after !== before)
    throw new Error(`Состояние восстановленной базы отличается:\nSOURCE\n${before}\nRESTORED\n${after}`)
  console.log(`Backup restore OK: schema, exact row counts and table checksums match`)
} finally {
  mysqlServer(`DROP DATABASE IF EXISTS ${restored}`)
  rmSync(temporary, { recursive: true, force: true })
}
