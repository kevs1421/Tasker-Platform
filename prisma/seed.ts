import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  // Seed only the initial admin account — no mock/demo data.
  // All other users, projects, and tasks should be created
  // through the application UI by the admin.
  const adminEmail = 'admin@yberdigitals.com'
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: await hashPassword('admin123'),
        name: 'Admin',
        role: 'admin',
        status: 'active',
      },
    })
    console.log('✅ Admin account created:', adminEmail)
  } else {
    console.log('ℹ️  Admin account already exists:', adminEmail)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
