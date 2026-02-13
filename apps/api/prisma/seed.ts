import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Seed is intentionally minimal — real users are created via GitHub OAuth.
  // This seed only verifies the DB connection and schema are working.
  const userCount = await prisma.user.count()
  console.log(`Database ready. Current user count: ${userCount}`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
