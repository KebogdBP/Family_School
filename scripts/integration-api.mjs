const baseUrl = process.env.HOMEEDU_API_URL ?? 'http://127.0.0.1:8080/api/v1'
const setupToken = process.env.HOMEEDU_SETUP_TOKEN ?? 'development-setup-token'
let cookie = ''

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (cookie) headers.set('Cookie', cookie)

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';', 1)[0]
  const body = await response.json()
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`)
  return body
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

await request('/health')
await request('/setup', {
  method: 'POST',
  headers: { 'X-Setup-Token': setupToken },
  body: JSON.stringify({
    familyName: 'Семья HomeEdu',
    displayName: 'Игорь',
    email: 'parent@homeedu.test',
    password: 'HomeEdu-test-2026!',
  }),
})

const parent = await request('/me')
assert(parent.principal.role === 'parent', 'Setup did not create a parent session')

const sara = await request('/students', {
  method: 'POST',
  body: JSON.stringify({ displayName: 'Сара', grade: 6, age: 12, pin: '1206' }),
})
const david = await request('/students', {
  method: 'POST',
  body: JSON.stringify({ displayName: 'Давид', grade: 4, age: 10, pin: '1004' }),
})
const students = await request('/students')
assert(students.students.length === 2, 'Expected exactly two students')
assert(students.students.some((student) => student.id === sara.student.id), 'Sara is missing')
assert(students.students.some((student) => student.id === david.student.id), 'David is missing')

const mathematics = await request('/subjects', {
  method: 'POST',
  body: JSON.stringify({ title: 'Математика', color: '#2563EB' }),
})
const curriculum = await request('/curricula', {
  method: 'POST',
  body: JSON.stringify({ studentId: sara.student.id, title: '6 класс', schoolYear: '2026/2027' }),
})
const assignment = await request(`/curricula/${curriculum.curriculum.id}/subjects`, {
  method: 'POST', body: JSON.stringify({ subjectId: mathematics.subject.id, position: 0 }),
})
const section = await request(`/curriculum-subjects/${assignment.curriculumSubject.id}/sections`, {
  method: 'POST', body: JSON.stringify({ title: 'Обыкновенные дроби', position: 0 }),
})
const topic = await request(`/sections/${section.section.id}/topics`, {
  method: 'POST', body: JSON.stringify({ title: 'Общий знаменатель', position: 0 }),
})
const lesson = await request(`/topics/${topic.topic.id}/lessons`, {
  method: 'POST', body: JSON.stringify({ title: 'Приведение дробей', summary: 'Первый урок', position: 0 }),
})
await request(`/lessons/${lesson.lesson.id}/blocks`, {
  method: 'POST',
  body: JSON.stringify({ blockType: 'markdown', content: { text: 'Найдём общий знаменатель.' }, position: 0 }),
})
await request(`/lessons/${lesson.lesson.id}/blocks`, {
  method: 'POST',
  body: JSON.stringify({ blockType: 'video', content: { url: 'https://example.com/fractions', caption: 'Разбор темы' }, position: 1 }),
})
const content = await request(`/lessons/${lesson.lesson.id}/content`)
assert(content.lesson.blocks.length === 2, 'Lesson blocks are incomplete')
const tree = await request(`/curricula/${curriculum.curriculum.id}`)
assert(tree.curriculum.subjects[0].sections[0].topics[0].lessons.length === 1, 'Curriculum tree is incomplete')

await request('/auth/logout', { method: 'POST' })
cookie = ''
await request('/auth/parent/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'parent@homeedu.test', password: 'HomeEdu-test-2026!' }),
})
assert((await request('/me')).principal.role === 'parent', 'Parent login failed')

await request('/auth/logout', { method: 'POST' })
cookie = ''
await request('/auth/student/login', {
  method: 'POST',
  body: JSON.stringify({ studentId: sara.student.id, pin: '1206' }),
})
const student = await request('/me')
assert(student.principal.displayName === 'Сара' && student.principal.grade === 6, 'Sara login failed')

console.log('Integration OK: auth, Sara and David, curriculum tree, lesson blocks, parent login, Sara PIN login')
