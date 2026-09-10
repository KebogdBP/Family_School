import fs from 'node:fs'
import path from 'node:path'
import PhpParser from 'php-parser'

const parser = new PhpParser.Engine({
  parser: { php7: true, suppressErrors: false },
  ast: { withPositions: true },
})

function phpFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return phpFiles(target)
    return entry.name.endsWith('.php') ? [target] : []
  })
}

for (const file of [...phpFiles('apps/api'), ...phpFiles('deploy')]) {
  parser.parseCode(fs.readFileSync(file, 'utf8'), file)
  process.stdout.write(`OK ${file}\n`)
}
