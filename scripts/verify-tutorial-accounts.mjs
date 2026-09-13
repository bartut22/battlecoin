import { chromium, expect } from '@playwright/test'
const browser = await chromium.launch({channel:'msedge',headless:true})
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)
  await page.route('**/api/signup', route => route.fulfill({json:{username:route.request().postDataJSON().username,wallet:null}}))
  await page.route('**/api/login', route => route.fulfill({json:{username:route.request().postDataJSON().username,wallet:null}}))
  await page.goto('http://127.0.0.1:5178')
  // Reproduce a browser where another account already dismissed the old tutorial.
  await page.evaluate(()=>localStorage.setItem('battlecoin-market-arena-tutorial-v3','1'))
  const signup = async username => {
    await page.getByRole('button',{name:'Sign up',exact:true}).click()
    await page.getByLabel('Username',{exact:true}).fill(username)
    await page.getByLabel('Password',{exact:true}).fill('test-password')
    await page.getByRole('button',{name:'Create account',exact:true}).click()
    await expect(page.getByRole('complementary',{name:'Chip dialogue'})).toBeVisible({timeout:15000})
  }
  const logout = async () => {
    await page.getByRole('button',{name:'Open account menu'}).click()
    await page.getByRole('button',{name:'Log out',exact:true}).click()
  }
  await signup('first-player')
  await page.getByRole('button',{name:'Skip tutorial',exact:true}).click()
  await expect(page.locator('.rail-tabs')).toBeVisible()
  await logout()
  await signup('second-player')
  await page.reload()
  await expect(page.getByRole('complementary',{name:'Chip dialogue'})).toBeVisible()
  await page.getByRole('button',{name:'Skip tutorial',exact:true}).click()
  await logout()
  await page.getByLabel('Username',{exact:true}).fill('first-player')
  await page.getByLabel('Password',{exact:true}).fill('test-password')
  await page.getByRole('button',{name:'Enter the arena',exact:true}).click()
  await expect(page.locator('.rail-tabs')).toBeVisible({timeout:15000})
  await expect(page.getByRole('complementary',{name:'Chip dialogue'})).toHaveCount(0)
  console.log('Passed: signup ignores legacy global completion, accounts have independent completion, unfinished tutorial survives reload, returning completed account opens arena. Auth responses mocked.')
} finally { await browser.close() }
