import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'

execFileSync('docker', ['compose', 'up', '-d', '--build', 'api'], { stdio: 'inherit' })

const secret = 'password=Secret-123 pin=1206 answer=3/4 file=Сара-домашняя-работа.pdf'
const php = [
  "require '/var/www/html/bootstrap.php';",
  `HomeEdu\\Logger::exception(new RuntimeException(${JSON.stringify(secret)}), [`,
  "'requestId'=>'safe-test-123',",
  "'method'=>'POST',",
  "'path'=>'/api/v1/student/homeworks/example/submission?token=private',",
  "'status'=>500,",
  "'phase'=>'test',",
  ']);',
].join('')
const result = spawnSync('docker', ['compose', 'exec', '-T', 'api', 'php', '-r', php], { encoding: 'utf8' })

assert.equal(result.status, 0, result.stderr)
const line = result.stderr.trim().split('\n').at(-1)
assert.ok(line, 'Logger did not write a record')
const record = JSON.parse(line)
assert.equal(record.event, 'request.failed')
assert.equal(record.requestId, 'safe-test-123')
assert.equal(record.method, 'POST')
assert.equal(record.path, '/api/v1/student/homeworks/example/submission')
assert.equal(record.status, 500)
assert.match(record.fingerprint, /^[a-f0-9]{16}$/)
assert.ok(!result.stderr.includes(secret), 'Log contains the exception message')
for (const value of ['Secret-123', '1206', '3/4', 'Сара-домашняя-работа.pdf', 'token=private']) {
  assert.ok(!result.stderr.includes(value), `Log leaked sensitive value: ${value}`)
}

console.log('Safe structured logging test passed.')
