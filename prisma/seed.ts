import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  // Prevent seeding in production environment
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production. Set NODE_ENV to "development" to run seeds.')
  }

  // ── 1. Admin account ──
  const adminEmail = 'admin@yberdigitals.com'
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    const adminPassword = process.env.ADMIN_SEED_PASSWORD
    if (!adminPassword) {
      throw new Error('ADMIN_SEED_PASSWORD environment variable is required. Set it before running the seed script.')
    }
    admin = await prisma.user.create({
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

  // ── 2. Team member ──
  let kevin = await prisma.user.findUnique({ where: { email: 'kevin@yberdigitals.com' } })
  if (!kevin) {
    kevin = await prisma.user.create({
      data: {
        email: 'kevin@yberdigitals.com',
        password: await hashPassword('kevin123'),
        name: 'Kevin',
        role: 'team',
        status: 'active',
      },
    })
    console.log('Team member created: kevin@yberdigitals.com')
  }

  // ── 3. Training member ──
  let kevs = await prisma.user.findUnique({ where: { email: 'kevs@yberdigitals.com' } })
  if (!kevs) {
    kevs = await prisma.user.create({
      data: {
        email: 'kevs@yberdigitals.com',
        password: await hashPassword('kevs123'),
        name: 'Kevs',
        role: 'training',
        status: 'active',
      },
    })
    console.log('Training member created: kevs@yberdigitals.com')
  }

  // ── 4. Client users ──
  let kevinP = await prisma.user.findUnique({ where: { email: 'kevinp@yberdigitals.com' } })
  if (!kevinP) {
    kevinP = await prisma.user.create({
      data: {
        email: 'kevinp@yberdigitals.com',
        password: await hashPassword('kevinp123'),
        name: 'Kevin P',
        role: 'client',
        status: 'active',
        company: 'Acme Corp',
      },
    })
    console.log('Client created: kevinp@yberdigitals.com')
  }

  let pKevin = await prisma.user.findUnique({ where: { email: 'pkevin@yberdigitals.com' } })
  if (!pKevin) {
    pKevin = await prisma.user.create({
      data: {
        email: 'pkevin@yberdigitals.com',
        password: await hashPassword('pkevin123'),
        name: 'P Kevin',
        role: 'client',
        status: 'active',
        company: 'Beta Inc',
      },
    })
    console.log('Client created: pkevin@yberdigitals.com')
  }

  // ── 5. Projects ──
  // Project 1: Yber Digitals Website
  let project1 = await prisma.project.findFirst({ where: { name: 'Yber Digitals Website' } })
  if (!project1) {
    project1 = await prisma.project.create({
      data: {
        name: 'Yber Digitals Website',
        description: 'Complete website redesign and development for Yber Digitals with modern UI/UX',
        color: '#f59e0b',
        status: 'active',
        priority: 'high',
        dueDate: new Date('2026-12-31'),
        createdBy: admin.id,
        members: {
          create: [
            { userId: admin.id, role: 'owner' },
            { userId: kevin!.id, role: 'member' },
            { userId: kevs!.id, role: 'member' },
            { userId: kevinP!.id, role: 'member' },
          ],
        },
      },
    })
    // Create ClientProject link for kevinP
    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: kevinP!.id, projectId: project1.id } },
      create: { clientId: kevinP!.id, projectId: project1.id },
      update: {},
    })
    console.log('Project created: Yber Digitals Website')
  }

  // Project 2: YDS Mobile App
  let project2 = await prisma.project.findFirst({ where: { name: 'YDS Mobile App' } })
  if (!project2) {
    project2 = await prisma.project.create({
      data: {
        name: 'YDS Mobile App',
        description: 'Mobile application development for Yber Digitals Services',
        color: '#10b981',
        status: 'active',
        priority: 'medium',
        dueDate: new Date('2027-03-15'),
        createdBy: admin.id,
        members: {
          create: [
            { userId: admin.id, role: 'owner' },
            { userId: kevin!.id, role: 'member' },
            { userId: kevs!.id, role: 'member' },
            { userId: kevinP!.id, role: 'member' },
            { userId: pKevin!.id, role: 'member' },
          ],
        },
      },
    })
    // Create ClientProject links
    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: kevinP!.id, projectId: project2.id } },
      create: { clientId: kevinP!.id, projectId: project2.id },
      update: {},
    })
    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: pKevin!.id, projectId: project2.id } },
      create: { clientId: pKevin!.id, projectId: project2.id },
      update: {},
    })
    console.log('Project created: YDS Mobile App')
  }

  // Project 3: Brand Identity Design (for pKevin only)
  let project3 = await prisma.project.findFirst({ where: { name: 'Brand Identity Design' } })
  if (!project3) {
    project3 = await prisma.project.create({
      data: {
        name: 'Brand Identity Design',
        description: 'Complete brand identity package including logo, color palette, and brand guidelines',
        color: '#8b5cf6',
        status: 'active',
        priority: 'high',
        dueDate: new Date('2026-11-30'),
        createdBy: admin.id,
        members: {
          create: [
            { userId: admin.id, role: 'owner' },
            { userId: kevin!.id, role: 'member' },
            { userId: pKevin!.id, role: 'member' },
          ],
        },
      },
    })
    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: pKevin!.id, projectId: project3.id } },
      create: { clientId: pKevin!.id, projectId: project3.id },
      update: {},
    })
    console.log('Project created: Brand Identity Design')
  }

  // ── 6. Tasks for Project 1 (Yber Digitals Website) ──
  const project1TaskCount = await prisma.task.count({ where: { projectId: project1.id } })
  if (project1TaskCount === 0) {
    await prisma.task.createMany({
      data: [
        { title: 'Brand Identity Design', status: 'done', priority: 'high', projectId: project1.id, createdById: admin.id },
        { title: 'Website Wireframes', status: 'done', priority: 'high', projectId: project1.id, createdById: admin.id },
        { title: 'Homepage Development', status: 'in_progress', priority: 'high', projectId: project1.id, createdById: admin.id },
        { title: 'Content Strategy', status: 'in_review', priority: 'medium', projectId: project1.id, createdById: admin.id },
        { title: 'SEO Optimization', status: 'todo', priority: 'medium', projectId: project1.id, createdById: admin.id },
        { title: 'Mobile Responsiveness', status: 'todo', priority: 'high', projectId: project1.id, createdById: admin.id },
        { title: 'Contact Form Setup', status: 'in_progress', priority: 'low', projectId: project1.id, createdById: admin.id },
        { title: 'Performance Testing', status: 'todo', priority: 'medium', projectId: project1.id, createdById: admin.id },
      ],
    })
    console.log('Tasks created for Yber Digitals Website')
  }

  // ── 7. Tasks for Project 2 (YDS Mobile App) ──
  const project2TaskCount = await prisma.task.count({ where: { projectId: project2.id } })
  if (project2TaskCount === 0) {
    await prisma.task.createMany({
      data: [
        { title: 'App Architecture Design', status: 'done', priority: 'high', projectId: project2.id, createdById: admin.id },
        { title: 'User Authentication Flow', status: 'done', priority: 'high', projectId: project2.id, createdById: admin.id },
        { title: 'Dashboard UI Development', status: 'done', priority: 'high', projectId: project2.id, createdById: admin.id },
        { title: 'API Integration', status: 'in_progress', priority: 'high', projectId: project2.id, createdById: admin.id },
        { title: 'Push Notifications', status: 'in_progress', priority: 'medium', projectId: project2.id, createdById: admin.id },
        { title: 'Offline Mode Support', status: 'todo', priority: 'medium', projectId: project2.id, createdById: admin.id },
        { title: 'App Store Submission', status: 'todo', priority: 'low', projectId: project2.id, createdById: admin.id },
      ],
    })
    console.log('Tasks created for YDS Mobile App')
  }

  // ── 8. Tasks for Project 3 (Brand Identity Design) ──
  const project3TaskCount = await prisma.task.count({ where: { projectId: project3.id } })
  if (project3TaskCount === 0) {
    await prisma.task.createMany({
      data: [
        { title: 'Logo Concept Design', status: 'done', priority: 'high', projectId: project3.id, createdById: admin.id },
        { title: 'Color Palette Selection', status: 'done', priority: 'high', projectId: project3.id, createdById: admin.id },
        { title: 'Typography Selection', status: 'in_review', priority: 'medium', projectId: project3.id, createdById: admin.id },
        { title: 'Brand Guidelines Document', status: 'todo', priority: 'medium', projectId: project3.id, createdById: admin.id },
        { title: 'Business Card Design', status: 'todo', priority: 'low', projectId: project3.id, createdById: admin.id },
      ],
    })
    console.log('Tasks created for Brand Identity Design')
  }

  console.log('\n✅ Seed completed successfully!')
  console.log('\nCredentials:')
  console.log('  Admin:   admin@yberdigitals.com / admin123')
  console.log('  Team:    kevin@yberdigitals.com / kevin123')
  console.log('  Training: kevs@yberdigitals.com / kevs123')
  console.log('  Client:  kevinp@yberdigitals.com / kevinp123')
  console.log('  Client:  pkevin@yberdigitals.com / pkevin123')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
