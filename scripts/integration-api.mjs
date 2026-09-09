const baseUrl = process.env.HOMEEDU_API_URL ?? 'http://127.0.0.1:8080/api/v1'
const setupToken = process.env.HOMEEDU_SETUP_TOKEN ?? 'development-setup-token'
let cookie = ''

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
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
const quiz = await request(`/lessons/${lesson.lesson.id}/quizzes`, {
  method: 'POST', body: JSON.stringify({ title: 'Проверка дробей', prompt: 'Какая дробь равна 1/2?', options: ['2/4', '1/3', '3/4'], correctOption: 0, explanation: '2/4 сокращается до 1/2.', position: 0 }),
})
const multipleQuiz = await request(`/lessons/${lesson.lesson.id}/quizzes`, {
  method: 'POST', body: JSON.stringify({ title: 'Чётные числа', prompt: 'Выбери все чётные числа', questionType: 'multiple_choice', options: ['2', '3', '4'], correctOptions: [0, 2], explanation: 'Два и четыре делятся на два.', position: 1 }),
})
const numberQuiz = await request(`/lessons/${lesson.lesson.id}/quizzes`, {
  method: 'POST', body: JSON.stringify({ title: 'Десятичная дробь', prompt: 'Запиши половину числом', questionType: 'number', correctNumber: 0.5, tolerance: 0, position: 2 }),
})
const textQuiz = await request(`/lessons/${lesson.lesson.id}/quizzes`, {
  method: 'POST', body: JSON.stringify({ title: 'Термин', prompt: 'Как называется нижняя часть дроби?', questionType: 'short_text', acceptedAnswers: ['знаменатель'], position: 3 }),
})
const parentQuizzes = await request(`/lessons/${lesson.lesson.id}/quizzes`)
assert(parentQuizzes.quizzes.length === 4, 'All quiz question types were not created')
const homework = await request(`/lessons/${lesson.lesson.id}/homeworks`, {
  method: 'POST', body: JSON.stringify({ title: 'Объясни дробь', instructions: 'Объясни своими словами, почему 2/4 равно 1/2.', position: 1 }),
})
const tree = await request(`/curricula/${curriculum.curriculum.id}`)
assert(tree.curriculum.subjects[0].sections[0].topics[0].lessons.length === 1, 'Curriculum tree is incomplete')

await request('/auth/logout', { method: 'POST' })
cookie = ''
await request('/auth/parent/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'parent@homeedu.test', password: 'HomeEdu-test-2026!' }),
})
assert((await request('/me')).principal.role === 'parent', 'Parent login failed')
const scheduledDate = new Date().toISOString().slice(0, 10)
await request(`/students/${sara.student.id}/plan-items`, {
  method: 'POST', body: JSON.stringify({ lessonId: lesson.lesson.id, scheduledDate, isRequired: true, position: 0 }),
})
const weeklyPlan = await request(`/students/${sara.student.id}/weekly-plan?weekStart=${scheduledDate}`)
assert(weeklyPlan.items.length === 1, 'Parent weekly plan item was not saved')

await request('/auth/logout', { method: 'POST' })
cookie = ''
await request('/auth/student/login', {
  method: 'POST',
  body: JSON.stringify({ studentId: sara.student.id, pin: '1206' }),
})
const student = await request('/me')
assert(student.principal.displayName === 'Сара' && student.principal.grade === 6, 'Sara login failed')
const studentLessons = await request('/student/lessons')
assert(studentLessons.lessons.length === 1, 'Sara must see her assigned lesson')
const todayLessons = await request('/student/today')
assert(todayLessons.lessons.length === 1 && todayLessons.lessons[0].isRequired, 'Sara today plan is incorrect')
assert(studentLessons.lessons[0].progress.status === 'not_started', 'New lesson must not be started')
const studentLesson = await request(`/student/lessons/${lesson.lesson.id}`)
assert(studentLesson.lesson.blocks.length === 2, 'Student lesson must contain ordered blocks')
assert(studentLesson.lesson.quizzes.length === 4 && studentLesson.lesson.quizzes[0].question.correctAnswer === undefined, 'Quiz answer leaked to student')
assert(studentLesson.lesson.homeworks.length === 1, 'Homework is missing from student lesson')
const wrongAttempt = await request(`/student/quizzes/${quiz.quiz.id}/attempts`, { method: 'POST', body: JSON.stringify({ selectedOption: 1 }) })
assert(wrongAttempt.attempt.score === 0 && !wrongAttempt.attempt.correct, 'Wrong quiz answer was accepted')
const correctAttempt = await request(`/student/quizzes/${quiz.quiz.id}/attempts`, { method: 'POST', body: JSON.stringify({ selectedOption: 0 }) })
assert(correctAttempt.attempt.score === 100 && correctAttempt.attempt.correct, 'Correct quiz answer was rejected')
const multipleAttempt = await request(`/student/quizzes/${multipleQuiz.quiz.id}/attempts`, { method: 'POST', body: JSON.stringify({ selectedOptions: [2, 0] }) })
assert(multipleAttempt.attempt.correct, 'Multiple-choice answer was rejected')
const numberAttempt = await request(`/student/quizzes/${numberQuiz.quiz.id}/attempts`, { method: 'POST', body: JSON.stringify({ numberAnswer: 0.5 }) })
assert(numberAttempt.attempt.correct, 'Numeric answer was rejected')
const textAttempt = await request(`/student/quizzes/${textQuiz.quiz.id}/attempts`, { method: 'POST', body: JSON.stringify({ textAnswer: '  ЗНАМЕНАТЕЛЬ  ' }) })
assert(textAttempt.attempt.correct, 'Normalized short-text answer was rejected')
const learningMastery = await request('/student/mastery')
assert(learningMastery.topics[0].status === 'learning' && learningMastery.topics[0].evidenceCount === 5, 'Quiz evidence did not update topic mastery')
await request(`/student/homeworks/${homework.homework.id}/submission`, { method: 'PUT', body: JSON.stringify({ responseText: 'Если разделить две части из четырёх, получится половина.', submit: false }) })
const attachment = new FormData()
attachment.set('file', new File([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
], 'тетрадь.png', { type: 'image/png' }))
const uploaded = await request(`/student/homeworks/${homework.homework.id}/files`, { method: 'POST', body: attachment })
assert(uploaded.file.originalName === 'тетрадь.png', 'Homework attachment was not uploaded')
const submitted = await request(`/student/homeworks/${homework.homework.id}/submission`, { method: 'PUT', body: JSON.stringify({ responseText: 'Если разделить две части из четырёх, получится половина.', submit: true }) })
assert(submitted.submission.status === 'submitted', 'Homework was not submitted')
await request(`/student/lessons/${lesson.lesson.id}/progress`, {
  method: 'PATCH', body: JSON.stringify({ lastBlockPosition: 1, completed: false }),
})
await request(`/student/lessons/${lesson.lesson.id}/progress`, {
  method: 'PATCH', body: JSON.stringify({ lastBlockPosition: 2, completed: true }),
})
const completedLessons = await request('/student/lessons')
assert(completedLessons.lessons[0].progress.status === 'completed', 'Lesson completion was not saved')
await request(`/student/lessons/${lesson.lesson.id}/reflection`, {
  method: 'POST', body: JSON.stringify({ feeling: 'need_help', comment: 'Нужно повторить знаменатели' }),
})
const reflectedLesson = await request(`/student/lessons/${lesson.lesson.id}`)
assert(reflectedLesson.lesson.reflection.feeling === 'need_help', 'Student reflection was not saved')

await request('/auth/logout', { method: 'POST' })
cookie = ''
await request('/auth/student/login', {
  method: 'POST', body: JSON.stringify({ studentId: david.student.id, pin: '1004' }),
})
const davidLessons = await request('/student/lessons')
assert(davidLessons.lessons.length === 0, 'David must not see Sara lessons')
const davidToday = await request('/student/today')
assert(davidToday.lessons.length === 0, 'David must not see Sara plan')
const davidMastery = await request('/student/mastery')
assert(davidMastery.topics.length === 0, 'David must not see Sara mastery evidence')
const davidAchievements = await request('/student/achievements')
assert(davidAchievements.achievements.length === 0, 'David must not see Sara achievements')
const forbiddenFile = await fetch(new URL(uploaded.file.url, baseUrl), { headers: { Cookie: cookie } })
assert(forbiddenFile.status === 404, 'David must not access Sara attachment')

await request('/auth/logout', { method: 'POST' })
cookie = ''
const guestFile = await fetch(new URL(uploaded.file.url, baseUrl))
assert(guestFile.status === 401, 'Guest must not access a private attachment')
await request('/auth/parent/login', {
  method: 'POST', body: JSON.stringify({ email: 'parent@homeedu.test', password: 'HomeEdu-test-2026!' }),
})
const report = await request(`/students/${sara.student.id}/progress-report`)
assert(report.summary.completed === 1 && report.summary.needsHelp === 1, 'Parent report is incorrect')
const queue = await request('/review-submissions')
assert(queue.submissions.length === 1 && queue.submissions[0].studentName === 'Сара', 'Parent review queue is incorrect')
assert(queue.submissions[0].files.length === 1, 'Homework attachment is missing from review queue')
const fileResponse = await fetch(new URL(uploaded.file.url, baseUrl), { headers: { Cookie: cookie } })
assert(fileResponse.ok && fileResponse.headers.get('content-type') === 'image/png', 'Authorized attachment download failed')
await request(`/submissions/${queue.submissions[0].id}/reviews`, { method: 'POST', body: JSON.stringify({ decision: 'needs_revision', grade: null, comment: 'Добавь пример с сокращением дроби.' }) })
await request('/auth/logout', { method: 'POST' }); cookie = ''
await request('/auth/student/login', { method: 'POST', body: JSON.stringify({ studentId: sara.student.id, pin: '1206' }) })
await request(`/student/homeworks/${homework.homework.id}/submission`, { method: 'PUT', body: JSON.stringify({ responseText: '2/4 сокращаем на 2 и получаем 1/2 — половину.', submit: true }) })
await request('/auth/logout', { method: 'POST' }); cookie = ''
await request('/auth/parent/login', { method: 'POST', body: JSON.stringify({ email: 'parent@homeedu.test', password: 'HomeEdu-test-2026!' }) })
const revisedQueue = await request('/review-submissions')
await request(`/submissions/${revisedQueue.submissions[0].id}/reviews`, { method: 'POST', body: JSON.stringify({ decision: 'accepted', grade: 5, comment: 'Теперь есть пример — работа принята.', independentExplanation: true }) })
const reviewedQueue = await request('/review-submissions')
assert(reviewedQueue.submissions[0].status === 'reviewed', 'Revised homework review was not saved')
const masteryReport = await request(`/students/${sara.student.id}/progress-report`)
assert(masteryReport.mastery[0].status === 'needs_reinforcement' && masteryReport.summary.topicsToReview === 1, 'Homework evidence did not schedule topic review')
assert(masteryReport.achievements.some((item) => item.code === 'independent_revision'), 'Independent revision achievement was not awarded')
assert(masteryReport.achievements.some((item) => item.code === 'independent_explanation'), 'Independent explanation achievement was not awarded')
assert(masteryReport.summary.achievements === 2, 'Achievement count is incorrect')
assert(masteryReport.masterySubjects[0].title === 'Математика' && masteryReport.masterySubjects[0].score > 0, 'Subject progress was not calculated')

console.log('Integration OK: learning, private files, mastery, revision achievements and family isolation are persistent')
