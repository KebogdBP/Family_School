import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const parent = { email: 'parent-e2e@homeedu.test', password: 'HomeEdu-e2e-2026!' }
type Child = { id: string; name: string; pin: string; lessonId: string; lessonTitle: string; answer: string }
let api: APIRequestContext
let children: Child[] = []
const endpoint = (path: string) => `/api/v1${path}`
const expectAccessible = async (page: Page) => {
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious')).toEqual([])
}

async function parentLogin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(parent.email)
  await page.getByLabel('Пароль').fill(parent.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Ученики' })).toBeVisible()
}

async function childLogin(page: Page, child: Child) {
  const card = page.locator('.child-card').filter({ hasText: child.name })
  await card.getByRole('button', { name: 'Перейти в профиль' }).click()
  await card.getByLabel(`PIN для ${child.name}`).fill(child.pin)
  await card.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: `Привет, ${child.name}!` })).toBeVisible()
}

async function completeChildCycle(page: Page, child: Child) {
  await childLogin(page, child)
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Диагностика' }).click()
  await expect(page.getByRole('heading', { name: /стартовая проверка/i })).toBeVisible()
  await expectAccessible(page)
  for (const question of await page.locator('fieldset').all()) await question.locator('label').first().click()
  await page.getByRole('button', { name: 'Завершить диагностику' }).click()
  await expect(page.getByText('Рекомендуемый первый шаг')).toBeVisible()

  await page.getByRole('link', { name: 'Сегодня' }).click()
  const lesson = page.locator('.student-lesson-card').filter({ hasText: child.lessonTitle })
  await lesson.getByRole('link').click()
  await expect(page.getByRole('heading', { name: child.lessonTitle })).toBeVisible()
  while (await page.getByRole('button', { name: /^(Дальше →|Завершить урок)$/ }).count()) {
    await page.getByRole('button', { name: /^(Дальше →|Завершить урок)$/ }).click()
  }
  await expectAccessible(page)
  const quiz = page.locator('.student-quiz')
  if (child.answer === 'first-option') await quiz.locator('label').first().click()
  else await quiz.getByLabel('Твой ответ').fill(child.answer)
  await quiz.getByRole('button', { name: 'Проверить ответ' }).click()
  await expect(quiz.getByText('Верно! Отличная работа.')).toBeVisible()
  const homework = page.locator('.student-homework')
  await homework.locator('textarea').fill(`${child.name}: самостоятельное решение с объяснением.`)
  await homework.getByRole('button', { name: 'Отправить на проверку' }).click()
  await expect(homework.getByText('Работа отправлена и ждёт проверки.')).toBeVisible()
  await page.getByRole('button', { name: 'Получилось' }).click()
  await page.locator('.reflection-card').getByRole('button', { name: 'Сохранить ответ' }).click()
  await expect(page.getByText('Спасибо, ответ сохранён.')).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()

  await parentLogin(page)
  await expectAccessible(page)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await page.getByRole('link', { name: 'Проверка работ' }).click()
  await expectAccessible(page)
  const review = page.locator('.review-card').filter({ hasText: child.name }).filter({ hasText: child.lessonTitle })
  await review.getByLabel('Комментарий').fill('Решение проверено в браузерном сценарии.')
  await review.getByLabel('Ребёнок самостоятельно объяснил ход решения').check()
  await review.getByRole('button', { name: 'Принять работу' }).click()
  await expect(review.getByText('Проверено')).toBeVisible()
  await page.getByRole('link', { name: 'Дети' }).click()
}

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: 'http://127.0.0.1:8080' })
  const setup = await api.post(endpoint('/setup'), { headers: { 'X-Setup-Token': 'development-setup-token' }, data: { familyName: 'Семья E2E', displayName: 'Игорь', ...parent } })
  expect(setup.ok(), await setup.text()).toBeTruthy()
  for (const item of [
    { name: 'Давид', grade: 4, age: 10, pin: '1004', route: 'david-fractions', title: 'Доля и целое', answer: 'first-option' },
    { name: 'Сара', grade: 6, age: 12, pin: '1206', route: 'sara-fractions', title: 'Сокращение дробей', answer: '3/4' },
  ]) {
    const created = await (await api.post(endpoint('/students'), { data: { displayName: item.name, grade: item.grade, age: item.age, pin: item.pin } })).json()
    const installed = await (await api.post(endpoint(`/students/${created.student.id}/pilot-content/${item.route}`))).json()
    const tree = await (await api.get(endpoint(`/curricula/${installed.curriculumId}`))).json()
    const lessons = tree.curriculum.subjects.flatMap((subject: any) => subject.sections.flatMap((section: any) => section.topics.flatMap((topic: any) => topic.lessons)))
    const lesson = lessons.find((value: any) => value.title === item.title)
    expect(lesson).toBeTruthy()
    const planned = await api.post(endpoint(`/students/${created.student.id}/plan-items`), { data: { lessonId: lesson.id, scheduledDate: new Date().toISOString().slice(0, 10), isRequired: true, position: 0 } })
    expect(planned.ok()).toBeTruthy()
    children.push({ id: created.student.id, name: item.name, pin: item.pin, lessonId: lesson.id, lessonTitle: item.title, answer: item.answer })
  }
})

test.afterAll(async () => { await api?.dispose() })

test('Сара и Давид проходят полный учебный цикл, а родитель утверждает план', async ({ page }) => {
  await parentLogin(page)
  await page.goto('/несуществующая-страница')
  await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Вернуться в кабинет' }).click()
  const davidCard = page.locator('.child-card').filter({ hasText: 'Давид' })
  await davidCard.getByRole('link', { name: 'План недели' }).click()
  await page.getByRole('button', { name: 'Позже →' }).click()
  await page.getByRole('button', { name: 'Собрать черновик' }).click()
  await expect(page.getByText('Черновик · можно изменить')).toBeVisible()
  await page.getByRole('link', { name: 'К ученикам' }).click()
  for (const child of children) await completeChildCycle(page, child)
  const saraCard = page.locator('.child-card').filter({ hasText: 'Сара' })
  await saraCard.getByRole('button', { name: 'Удалить профиль' }).click()
  await saraCard.getByLabel('Введите имя «Сара»').fill('Сара')
  await saraCard.getByLabel('Пароль родителя').fill(parent.password)
  await saraCard.getByRole('button', { name: 'Удалить Сара' }).click()
  await expect(saraCard).toHaveCount(0)
  await expect(page.locator('.child-card').filter({ hasText: 'Давид' })).toBeVisible()
})
