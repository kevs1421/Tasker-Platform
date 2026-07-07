import { db } from '@/lib/db'

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Users ────────────────────────────────────────────
  const admin = await db.user.create({
    data: { email: 'admin@taskflow.com', password: await hashPassword('admin123'), name: 'Alex Morgan', role: 'admin', phone: '+1 (555) 100-0001', company: 'TaskFlow Inc.' }
  })
  const team1 = await db.user.create({
    data: { email: 'sarah@taskflow.com', password: await hashPassword('team123'), name: 'Sarah Chen', role: 'team', phone: '+1 (555) 200-0001' }
  })
  const team2 = await db.user.create({
    data: { email: 'mike@taskflow.com', password: await hashPassword('team123'), name: 'Mike Johnson', role: 'team', phone: '+1 (555) 200-0002' }
  })
  const team3 = await db.user.create({
    data: { email: 'emma@taskflow.com', password: await hashPassword('team123'), name: 'Emma Wilson', role: 'team', phone: '+1 (555) 200-0003' }
  })
  const client1 = await db.user.create({
    data: { email: 'john@client.com', password: await hashPassword('client123'), name: 'John Smith', role: 'client', phone: '+1 (555) 300-0001', company: 'Acme Corp' }
  })
  const client2 = await db.user.create({
    data: { email: 'lisa@client.com', password: await hashPassword('client123'), name: 'Lisa Davis', role: 'client', phone: '+1 (555) 300-0002', company: 'TechStart Inc.' }
  })

  // ─── Projects ─────────────────────────────────────────
  const project1 = await db.project.create({
    data: {
      name: 'Website Redesign', description: 'Complete redesign of the company website with modern UI/UX patterns and responsive design.',
      color: '#f59e0b', priority: 'high', dueDate: new Date('2025-04-15'), createdBy: admin.id,
      members: { create: [{ userId: admin.id, role: 'owner' }, { userId: team1.id, role: 'member' }, { userId: team2.id, role: 'member' }] }
    }
  })
  const project2 = await db.project.create({
    data: {
      name: 'Mobile App Development', description: 'Native mobile application for iOS and Android platforms with real-time features.',
      color: '#10b981', priority: 'high', dueDate: new Date('2025-05-30'), createdBy: admin.id,
      members: { create: [{ userId: admin.id, role: 'owner' }, { userId: team2.id, role: 'member' }, { userId: team3.id, role: 'member' }] }
    }
  })
  const project3 = await db.project.create({
    data: {
      name: 'API Integration', description: 'Third-party API integration and microservices architecture setup.',
      color: '#ef4444', priority: 'medium', dueDate: new Date('2025-03-30'), createdBy: team1.id,
      members: { create: [{ userId: team1.id, role: 'owner' }, { userId: team3.id, role: 'member' }] }
    }
  })
  const project4 = await db.project.create({
    data: {
      name: 'Marketing Campaign', description: 'Q2 digital marketing campaign planning and execution across multiple channels.',
      color: '#8b5cf6', priority: 'low', dueDate: new Date('2025-06-01'), createdBy: admin.id,
      members: { create: [{ userId: admin.id, role: 'owner' }, { userId: team1.id, role: 'member' }] }
    }
  })

  // Client-project assignments
  await db.clientProject.createMany({
    data: [
      { clientId: client1.id, projectId: project1.id },
      { clientId: client1.id, projectId: project2.id },
      { clientId: client2.id, projectId: project4.id },
    ]
  })

  // ─── Onboarding Forms ─────────────────────────────────
  const form1Steps = JSON.stringify([
    { title: 'Company Information', description: 'Tell us about your company', fields: [
      { name: 'companyName', label: 'Company Name', type: 'text', required: true },
      { name: 'industry', label: 'Industry', type: 'select', required: true, options: ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Other'] },
      { name: 'companySize', label: 'Company Size', type: 'select', required: true, options: ['1-10', '11-50', '51-200', '200+'] },
      { name: 'website', label: 'Company Website', type: 'url', required: false },
    ]},
    { title: 'Brand Guidelines', description: 'Share your brand identity', fields: [
      { name: 'brandColors', label: 'Brand Colors', type: 'text', required: true, placeholder: 'e.g., #FF5733, #333333' },
      { name: 'logoDescription', label: 'Logo Description', type: 'textarea', required: false },
      { name: 'brandVoice', label: 'Brand Voice', type: 'select', required: true, options: ['Professional', 'Casual', 'Playful', 'Authoritative', 'Friendly'] },
    ]},
    { title: 'Project Requirements', description: 'Define your project scope', fields: [
      { name: 'projectGoals', label: 'Project Goals', type: 'textarea', required: true },
      { name: 'targetAudience', label: 'Target Audience', type: 'textarea', required: false },
      { name: 'competitors', label: 'Main Competitors', type: 'textarea', required: false },
      { name: 'budget', label: 'Budget Range', type: 'select', required: true, options: ['Under $10K', '$10K-$50K', '$50K-$100K', '$100K+'] },
    ]},
  ])

  await db.onboardingForm.create({
    data: { title: 'New Client Onboarding', description: 'Complete onboarding for new client projects', status: 'published', stepsJson: form1Steps, projectId: project1.id }
  })

  const form2Steps = JSON.stringify([
    { title: 'App Requirements', description: 'Define your mobile app needs', fields: [
      { name: 'platforms', label: 'Target Platforms', type: 'select', required: true, options: ['iOS Only', 'Android Only', 'Both iOS & Android'] },
      { name: 'keyFeatures', label: 'Key Features', type: 'textarea', required: true },
      { name: 'existingApp', label: 'Existing App URL (if any)', type: 'url', required: false },
    ]},
    { title: 'Design Preferences', description: 'Tell us about your design preferences', fields: [
      { name: 'designStyle', label: 'Preferred Design Style', type: 'select', required: true, options: ['Minimalist', 'Material Design', 'Flat', 'Neumorphic', 'Custom'] },
      { name: 'referenceApps', label: 'Reference Apps', type: 'textarea', required: false },
    ]},
  ])

  await db.onboardingForm.create({
    data: { title: 'Mobile App Onboarding', description: 'Onboarding form for mobile app projects', status: 'published', stepsJson: form2Steps, projectId: project2.id }
  })

  // ─── Tasks ────────────────────────────────────────────
  const taskData: Record<string, { title: string; status: string; priority: string; dueDate: string; tags: string }[]> = {
    [project1.id]: [
      { title: 'Create wireframes for homepage', status: 'done', priority: 'high', dueDate: '2025-02-15', tags: 'critical,frontend' },
      { title: 'Design system setup', status: 'done', priority: 'high', dueDate: '2025-02-20', tags: 'critical,design' },
      { title: 'Build responsive navigation', status: 'in_progress', priority: 'high', dueDate: '2025-03-01', tags: 'frontend' },
      { title: 'Implement hero section', status: 'in_progress', priority: 'medium', dueDate: '2025-03-10', tags: 'frontend' },
      { title: 'Create contact form', status: 'todo', priority: 'medium', dueDate: '2025-03-15', tags: 'frontend,forms' },
      { title: 'Blog page layout', status: 'todo', priority: 'low', dueDate: '2025-03-20', tags: 'content' },
      { title: 'SEO optimization', status: 'in_review', priority: 'high', dueDate: '2025-03-25', tags: 'seo,backend' },
      { title: 'Performance testing', status: 'todo', priority: 'medium', dueDate: '2025-04-01', tags: 'testing' },
    ],
    [project2.id]: [
      { title: 'UI/UX research and planning', status: 'done', priority: 'high', dueDate: '2025-03-01', tags: 'critical,design' },
      { title: 'Set up React Native project', status: 'done', priority: 'high', dueDate: '2025-03-05', tags: 'mobile,setup' },
      { title: 'Authentication flow', status: 'in_progress', priority: 'high', dueDate: '2025-03-15', tags: 'mobile,auth' },
      { title: 'Dashboard screen', status: 'in_progress', priority: 'medium', dueDate: '2025-03-20', tags: 'mobile,ui' },
      { title: 'Push notifications', status: 'todo', priority: 'medium', dueDate: '2025-04-01', tags: 'mobile,backend' },
      { title: 'Offline mode support', status: 'todo', priority: 'low', dueDate: '2025-04-15', tags: 'mobile' },
      { title: 'App store submission', status: 'todo', priority: 'high', dueDate: '2025-05-20', tags: 'mobile,release' },
    ],
    [project3.id]: [
      { title: 'API documentation review', status: 'done', priority: 'medium', dueDate: '2025-02-10', tags: 'backend,docs' },
      { title: 'Payment gateway integration', status: 'in_progress', priority: 'urgent', dueDate: '2025-03-05', tags: 'critical,backend,payments' },
      { title: 'Webhook setup', status: 'in_progress', priority: 'high', dueDate: '2025-03-10', tags: 'backend' },
      { title: 'Error handling middleware', status: 'todo', priority: 'medium', dueDate: '2025-03-15', tags: 'backend' },
      { title: 'Rate limiting', status: 'todo', priority: 'low', dueDate: '2025-03-20', tags: 'backend,security' },
    ],
    [project4.id]: [
      { title: 'Market research report', status: 'done', priority: 'medium', dueDate: '2025-03-01', tags: 'marketing,research' },
      { title: 'Content calendar creation', status: 'in_progress', priority: 'medium', dueDate: '2025-03-15', tags: 'marketing,content' },
      { title: 'Social media strategy', status: 'todo', priority: 'high', dueDate: '2025-04-01', tags: 'marketing,social' },
      { title: 'Email campaign setup', status: 'todo', priority: 'medium', dueDate: '2025-04-15', tags: 'marketing,email' },
    ],
  }

  const teamMembers = [team1, team2, team3]
  const allTasks: { id: string; title: string; projectId: string }[] = []

  for (const [projectId, tasks] of Object.entries(taskData)) {
    for (const t of tasks) {
      const task = await db.task.create({
        data: {
          title: t.title, status: t.status, priority: t.priority,
          dueDate: new Date(t.dueDate), projectId, createdById: admin.id, tags: t.tags,
          assignments: { create: [{ userId: teamMembers[Math.floor(Math.random() * 3)].id }] }
        }
      })
      allTasks.push({ id: task.id, title: task.title, projectId })
    }
  }

  // ─── Subtasks ─────────────────────────────────────────
  const firstTask = allTasks[0]
  if (firstTask) {
    await db.subtask.createMany({
      data: [
        { title: 'Desktop layout', completed: true, taskId: firstTask.id },
        { title: 'Tablet layout', completed: true, taskId: firstTask.id },
        { title: 'Mobile layout', completed: false, taskId: firstTask.id },
      ]
    })
  }
  const secondTask = allTasks[1]
  if (secondTask) {
    await db.subtask.createMany({
      data: [
        { title: 'Color palette definition', completed: true, taskId: secondTask.id },
        { title: 'Typography scale', completed: true, taskId: secondTask.id },
        { title: 'Component library', completed: false, taskId: secondTask.id },
      ]
    })
  }

  // ─── Comments ─────────────────────────────────────────
  const inProgressTask = allTasks.find(t => t.projectId === project1.id && t.title === 'Build responsive navigation')
  if (inProgressTask) {
    await db.comment.createMany({
      data: [
        { content: 'Started working on the responsive navigation. Will share the Figma link shortly.', taskId: inProgressTask.id, userId: team1.id },
        { content: 'Looks great! Make sure to test on Safari and Firefox.', taskId: inProgressTask.id, userId: admin.id },
        { content: 'Added mobile hamburger menu with smooth animation. PR is ready for review.', taskId: inProgressTask.id, userId: team1.id },
      ]
    })
  }

  // ─── Messages ─────────────────────────────────────────
  await db.message.createMany({
    data: [
      { content: 'Hi Sarah, how is the website redesign coming along?', senderId: admin.id, receiverId: team1.id },
      { content: 'Going well! The navigation is almost done. Should be ready for review by Friday.', senderId: team1.id, receiverId: admin.id },
      { content: 'Perfect. The client is asking about the timeline for the hero section.', senderId: admin.id, receiverId: team1.id },
      { content: 'I can have the hero section done by next Wednesday. Let me check with Mike about the assets.', senderId: team1.id, receiverId: admin.id },
      { content: 'John from Acme Corp wants to schedule a call about the project scope.', senderId: client1.id, receiverId: admin.id },
      { content: 'Sure, let me set up a meeting for Thursday at 2 PM.', senderId: admin.id, receiverId: client1.id },
      { content: 'That works perfectly. Looking forward to it!', senderId: client1.id, receiverId: admin.id },
      { content: 'Mike, can you review the API integration docs I shared?', senderId: team1.id, receiverId: team2.id },
      { content: 'Sure, I\'ll take a look this afternoon. The payment gateway spec looks complex.', senderId: team2.id, receiverId: team1.id },
    ]
  })

  // ─── Activity Log ─────────────────────────────────────
  await db.activityLog.createMany({
    data: [
      { action: 'project_created', details: 'Created project "Website Redesign"', userId: admin.id, projectId: project1.id },
      { action: 'project_created', details: 'Created project "Mobile App Development"', userId: admin.id, projectId: project2.id },
      { action: 'task_created', details: 'Created task "Create wireframes for homepage"', userId: admin.id, projectId: project1.id },
      { action: 'task_moved', details: 'Moved "Build responsive navigation" to In Progress', userId: team1.id, projectId: project1.id },
      { action: 'comment_added', details: 'Commented on "Build responsive navigation"', userId: admin.id, projectId: project1.id },
      { action: 'task_completed', details: 'Completed "Create wireframes for homepage"', userId: team1.id, projectId: project1.id },
      { action: 'member_added', details: 'Added Emma Wilson to "Mobile App Development"', userId: admin.id, projectId: project2.id },
    ]
  })

  // ─── Client Onboarding Submission ─────────────────────
  const form = await db.onboardingForm.findFirst({ where: { projectId: project1.id } })
  if (form) {
    await db.onboarding.create({
      data: {
        formId: form.id, clientId: client1.id, status: 'submitted',
        responsesJson: JSON.stringify({
          companyName: 'Acme Corp', industry: 'Technology', companySize: '51-200', website: 'https://acme.com',
          brandColors: '#FF5733, #333333', logoDescription: 'Modern geometric logo with bold typography',
          brandVoice: 'Professional', projectGoals: 'Redesign our corporate website to improve user experience and increase conversions.',
          targetAudience: 'B2B decision makers, CTOs, and engineering managers',
          competitors: 'CompetitorA.com, CompetitorB.io', budget: '$50K-$100K'
        }),
        submittedAt: new Date(Date.now() - 86400000),
      }
    })
  }

  console.log('✅ Seed data created successfully!')
  console.log('\n🔑 Demo Accounts:')
  console.log('  Admin:  admin@taskflow.com / admin123')
  console.log('  Team:   sarah@taskflow.com / team123')
  console.log('          mike@taskflow.com / team123')
  console.log('          emma@taskflow.com / team123')
  console.log('  Client: john@client.com / client123')
  console.log('          lisa@client.com / client123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())