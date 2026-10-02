import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  // Prevent seeding in production environment
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production. Set NODE_ENV to "development" to run seeds.')
  }

  // Seed only the initial admin account — no mock/demo data.
  // All other users, projects, and tasks should be created
  // through the application UI by the admin.
  const adminEmail = 'admin@yberdigitals.com'
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    const adminPassword = process.env.ADMIN_SEED_PASSWORD
    if (!adminPassword) {
      throw new Error('ADMIN_SEED_PASSWORD environment variable is required. Set it before running the seed script.')
    }
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: await hashPassword(adminPassword),
        name: 'Admin',
        role: 'admin',
        status: 'active',
      },
    })
    console.log('Admin account created:', adminEmail)
  } else {
    console.log('Admin account already exists:', adminEmail)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
