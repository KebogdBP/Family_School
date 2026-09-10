import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dumpDatabase } from './lib/docker-mysql-backup.mjs'

const directory = resolve(process.env.HOMEEDU_BACKUP_DIR ?? 'backups')
mkdirSync(directory, { recursive: true, mode: 0o700 })
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
const path = resolve(directory, `homeedu-${stamp}.sql`)
writeFileSync(path, dumpDatabase(), { mode: 0o600 })
console.log(`MySQL backup created: ${path}`)
