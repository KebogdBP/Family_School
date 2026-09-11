import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseRoot = resolve(root, 'release/homeedu-beget')
const publicRoot = resolve(releaseRoot, 'public_html')
const privateRoot = resolve(releaseRoot, 'private')

execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
rmSync(releaseRoot, { recursive: true, force: true })
mkdirSync(resolve(publicRoot, 'api'), { recursive: true })
mkdirSync(resolve(privateRoot, 'api'), { recursive: true })
mkdirSync(resolve(privateRoot, 'uploads'), { recursive: true })

cpSync(resolve(root, 'apps/web/dist'), publicRoot, { recursive: true })
for (const name of ['bin', 'migrations', 'public', 'src', 'bootstrap.php']) {
  cpSync(resolve(root, 'apps/api', name), resolve(privateRoot, 'api', name), { recursive: true })
}

cpSync(resolve(root, 'deploy/beget/public-root.htaccess'), resolve(publicRoot, '.htaccess'))
cpSync(resolve(root, 'deploy/beget/api.htaccess'), resolve(publicRoot, 'api/.htaccess'))
cpSync(resolve(root, 'deploy/beget/api-entry.php'), resolve(publicRoot, 'api/index.php'))
cpSync(resolve(root, 'deploy/beget/private.htaccess'), resolve(privateRoot, '.htaccess'))
cpSync(resolve(root, 'deploy/beget/private.htaccess'), resolve(privateRoot, 'uploads/.htaccess'))
cpSync(resolve(root, 'deploy/beget/env.production.example'), resolve(privateRoot, 'api/.env.production.example'))

const required = [
  'public_html/index.html',
  'public_html/.htaccess',
  'public_html/api/index.php',
  'private/api/bootstrap.php',
  'private/api/bin/migrate.php',
  'private/api/.env.production.example',
  'private/uploads/.htaccess',
]
for (const path of required) {
  if (!existsSync(resolve(releaseRoot, path))) throw new Error(`Release file is missing: ${path}`)
}

const publicFiles = readFileSync(resolve(publicRoot, 'index.html'), 'utf8')
if (!publicFiles.includes('/assets/')) throw new Error('Frontend assets were not built with root-relative paths')

const publicRules = readFileSync(resolve(publicRoot, '.htaccess'), 'utf8')
if (/RewriteRule\s+\^\s+https:/i.test(publicRules) || /Strict-Transport-Security/i.test(publicRules)) {
  throw new Error('Base Beget release must not force HTTPS before a certificate is installed')
}

let version = 'unknown'
try {
  version = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
} catch {}
writeFileSync(resolve(releaseRoot, 'VERSION'), `${version}\n`)

const archive = resolve(root, 'release/homeedu-beget.tar.gz')
rmSync(archive, { force: true })
execFileSync('tar', ['-czf', archive, '-C', resolve(root, 'release'), 'homeedu-beget'], { stdio: 'inherit' })
console.log(`Beget release created: ${releaseRoot}`)
console.log(`Archive created: ${archive}`)
