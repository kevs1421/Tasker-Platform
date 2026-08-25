-- ============================================================
-- Yber Digitals — Clean Seed Database
-- Generated for SQLite (Prisma compatible)
-- Passwords: admin@... → admin123, team@... → team123, client@... → client123
--   (SHA-256 hashed)
-- ============================================================

-- ─── Drop & Recreate (run on a fresh DB) ─────────────────
-- These tables are created by Prisma; only data is inserted here.
-- If you need a fresh start, delete db/custom.db and run:
--   bun run db:push
-- Then execute this SQL:
--   sqlite3 db/custom.db < db/seed.sql

PRAGMA foreign_keys = ON;

-- ─── Users ──────────────────────────────────────────────
INSERT INTO "User" ("id","email","password","name","phone","company","avatar","role","status","createdAt","updatedAt") VALUES
('cmrdtzwl90000wg7yvownk6z4','admin@yberdigitals.com','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9','Alex Morgan','+1 (555) 100-0001','Yber Digitals',NULL,'admin','active','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000'),
('cmrdtzwle0001wg7y9fqm55mi','sarah@yberdigitals.com','127c116a9f4e2228d43f82bdb8534f237ddb91797a385d4a27cf941c5fb49d01','Sarah Chen','+1 (555) 200-0001',NULL,NULL,'team','active','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000'),
('cmrdtzwlf0002wg7y18qds8y7','mike@yberdigitals.com','127c116a9f4e2228d43f82bdb8534f237ddb91797a385d4a27cf941c5fb49d01','Mike Johnson','+1 (555) 200-0002',NULL,NULL,'team','active','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000'),
('cmrdtzwlh0004wg7yaa3ol8f7','john@client.com','186474c1f2c2f735a54c2cf82ee8e87f2a5cd30940e280029363fecedfc5328c','John Smith','+1 (555) 300-0001','Acme Corp',NULL,'client','active','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000'),
('cmrdtzwli0005wg7yhxtxtd7u','lisa@client.com','186474c1f2c2f735a54c2cf82ee8e87f2a5cd30940e280029363fecedfc5328c','Lisa Davis','+1 (555) 300-0002','TechStart Inc.',NULL,'client','active','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000');

-- ─── Projects ───────────────────────────────────────────
INSERT INTO "Project" ("id","name","description","color","status","priority","dueDate","createdAt","updatedAt","createdBy") VALUES
('cmrdtzwm00007wg7yykvgjlng','Website Redesign','Complete redesign of the company website with modern UI/UX patterns and responsive design.','#f59e0b','active','high','2025-04-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwl90000wg7yvownk6z4'),
('cmrdtzwm4000dwg7y59idwcn4','Mobile App Development','Native mobile application for iOS and Android platforms with real-time features.','#10b981','active','high','2025-05-30 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwl90000wg7yvownk6z4'),
('cmrdtzwm7000jwg7yu2mi6zbm','API Integration','Third-party API integration and microservices architecture setup.','#ef4444','active','medium','2025-03-30 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwle0001wg7y9fqm55mi'),
('cmrdtzwm9000owg7yx94gza8x','Marketing Campaign','Q2 digital marketing campaign planning and execution across multiple channels.','#8b5cf6','active','low','2025-06-01 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwl90000wg7yvownk6z4');

-- ─── Project Members ────────────────────────────────────
INSERT INTO "ProjectMember" ("id","projectId","userId","role") VALUES
('cmrdtzwm00009wg7yfd4ff9q0','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','owner'),
('cmrdtzwm0000awg7y02x3d4e8','cmrdtzwm00007wg7yykvgjlng','cmrdtzwle0001wg7y9fqm55mi','member'),
('cmrdtzwm0000bwg7yr1g3e1co','cmrdtzwm00007wg7yykvgjlng','cmrdtzwlf0002wg7y18qds8y7','member'),
('cmrdtzwm4000fwg7ybzx8hvol','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','owner'),
('cmrdtzwm4000gwg7y3agwnf41','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwlf0002wg7y18qds8y7','member'),
('cmrdtzwm9000qwg7ycm1lpuuq','cmrdtzwm9000owg7yx94gza8x','cmrdtzwl90000wg7yvownk6z4','owner'),
('cmrdtzwm9000rwg7yaf5tx66k','cmrdtzwm9000owg7yx94gza8x','cmrdtzwle0001wg7y9fqm55mi','member'),
('cmrdtzwm7000lwg7ymtxyo83p','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwle0001wg7y9fqm55mi','owner'),
('cmrdtzwm7000mwg7yxm9trvep','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwl90000wg7yvownk6z4','member');

-- ─── Client Projects ────────────────────────────────────
INSERT INTO "ClientProject" ("id","clientId","projectId","addedAt") VALUES
('cmrdtzwmb000swg7y2l3u3q4u','cmrdtzwlh0004wg7yaa3ol8f7','cmrdtzwm00007wg7yykvgjlng','2026-07-09 18:19:37.000'),
('cmrdtzwmb000twg7ys2aa40jr','cmrdtzwlh0004wg7yaa3ol8f7','cmrdtzwm4000dwg7y59idwcn4','2026-07-09 18:19:37.000'),
('cmrdtzwmb000uwg7yme3va72x','cmrdtzwli0005wg7yhxtxtd7u','cmrdtzwm9000owg7yx94gza8x','2026-07-09 18:19:37.000');

-- ─── Onboarding Forms ───────────────────────────────────
INSERT INTO "OnboardingForm" ("id","title","description","status","stepsJson","projectId","clientId","createdAt","updatedAt") VALUES
('cmrdtzwmc000wwg7ylejpnxq4','New Client Onboarding','Complete onboarding for new client projects','published','[{"title":"Company Information","description":"Tell us about your company","fields":[{"name":"companyName","label":"Company Name","type":"text","required":true},{"name":"industry","label":"Industry","type":"select","required":true,"options":["Technology","Healthcare","Finance","Education","Retail","Other"]},{"name":"companySize","label":"Company Size","type":"select","required":true,"options":["1-10","11-50","51-200","200+"]},{"name":"website","label":"Company Website","type":"url","required":false}]},{"title":"Brand Guidelines","description":"Share your brand identity","fields":[{"name":"brandColors","label":"Brand Colors","type":"text","required":true},{"name":"logoDescription","label":"Logo Description","type":"textarea","required":false},{"name":"brandVoice","label":"Brand Voice","type":"select","required":true,"options":["Professional","Casual","Playful","Authoritative","Friendly"]}]},{"title":"Project Requirements","description":"Define your project scope","fields":[{"name":"projectGoals","label":"Project Goals","type":"textarea","required":true},{"name":"targetAudience","label":"Target Audience","type":"textarea","required":false},{"name":"competitors","label":"Main Competitors","type":"textarea","required":false},{"name":"budget","label":"Budget Range","type":"select","required":true,"options":["Under $10K","$10K-$50K","$50K-$100K","$100K+"]}]}]','cmrdtzwm00007wg7yykvgjlng',NULL,'2026-07-09 18:19:37.000','2026-07-09 18:19:37.000'),
('cmrdtzwme000ywg7ycsimeuk5','Mobile App Onboarding','Onboarding form for mobile app projects','published','[{"title":"App Requirements","description":"Define your mobile app needs","fields":[{"name":"platforms","label":"Target Platforms","type":"select","required":true,"options":["iOS Only","Android Only","Both iOS & Android"]},{"name":"keyFeatures","label":"Key Features","type":"textarea","required":true},{"name":"existingApp","label":"Existing App URL (if any)","type":"url","required":false}]},{"title":"Design Preferences","description":"Tell us about your design preferences","fields":[{"name":"designStyle","label":"Preferred Design Style","type":"select","required":true,"options":["Minimalist","Material Design","Flat","Neumorphic","Custom"]},{"name":"referenceApps","label":"Reference Apps","type":"textarea","required":false}]}]','cmrdtzwm4000dwg7y59idwcn4',NULL,'2026-07-09 18:19:37.000','2026-07-09 18:19:37.000');

-- ─── Tasks ──────────────────────────────────────────────
INSERT INTO "Task" ("id","title","description","status","priority","dueDate","createdAt","updatedAt","projectId","createdById","tags") VALUES
('cmrdtzwmf0010wg7yhezq6wv0','Create wireframes for homepage',NULL,'done','high','2025-02-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','critical,frontend'),
('cmrdtzwmh0014wg7yc2s4gbs2','Design system setup',NULL,'done','high','2025-02-20 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','critical,design'),
('cmrdtzwmk0018wg7ysr61uxo4','Build responsive navigation',NULL,'in_progress','high','2025-03-01 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','frontend'),
('cmrdtzwmn001cwg7yu6x0jtrx','Implement hero section',NULL,'in_progress','medium','2025-03-10 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','frontend'),
('cmrdtzwmo001gwg7y4mmvhruc','Create contact form',NULL,'todo','medium','2025-03-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','frontend,forms'),
('cmrdtzwmq001kwg7ykg0gwrrt','Blog page layout',NULL,'todo','low','2025-03-20 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','content'),
('cmrdtzwmt001owg7ygt1fei2x','SEO optimization',NULL,'in_review','high','2025-03-25 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm00007wg7yykvgjlng','cmrdtzwl90000wg7yvownk6z4','seo,backend'),
('cmrdtzwmw001wwg7y40lt5mg6','UI/UX research and planning',NULL,'done','high','2025-03-01 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','critical,design'),
('cmrdtzwn20020wg7y1laq85ke','Set up React Native project',NULL,'done','high','2025-03-05 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','mobile,setup'),
('cmrdtzwn50024wg7yo5j8l8zg','Authentication flow',NULL,'in_progress','high','2025-03-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','mobile,auth'),
('cmrdtzwn60028wg7ylhs0ew97','Dashboard screen',NULL,'in_progress','medium','2025-03-20 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','mobile,ui'),
('cmrdtzwn7002cwg7yjgrp4ulh','Push notifications',NULL,'todo','medium','2025-04-01 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','mobile,backend'),
('cmrdtzwn9002gwg7y0683mqpv','Offline mode support',NULL,'todo','low','2025-04-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','mobile'),
('cmrdtzwna002kwg7yl7afepwz','App store submission',NULL,'todo','high','2025-05-20 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm4000dwg7y59idwcn4','cmrdtzwl90000wg7yvownk6z4','mobile,release'),
('cmrdtzwnc002owg7y2v6gsmex','API documentation review',NULL,'done','medium','2025-02-10 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwl90000wg7yvownk6z4','backend,docs'),
('cmrdtzwnh002swg7ypvjuk9sa','Payment gateway integration',NULL,'in_progress','urgent','2025-03-05 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwl90000wg7yvownk6z4','critical,backend,payments'),
('cmrdtzwni002wwg7yqm2xpvcn','Webhook setup',NULL,'in_progress','high','2025-03-10 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwl90000wg7yvownk6z4','backend'),
('cmrdtzwnk0030wg7yfqc9xs8s','Error handling middleware',NULL,'todo','medium','2025-03-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwl90000wg7yvownk6z4','backend'),
('cmrdtzwnl0034wg7y1md1jcm5','Rate limiting',NULL,'todo','low','2025-03-20 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm7000jwg7yu2mi6zbm','cmrdtzwl90000wg7yvownk6z4','backend,security'),
('cmrdtzwnn0038wg7ypigxtem9','Market research report',NULL,'done','medium','2025-03-01 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm9000owg7yx94gza8x','cmrdtzwl90000wg7yvownk6z4','marketing,research'),
('cmrdtzwno003cwg7y0ob6lkz7','Content calendar creation',NULL,'in_progress','medium','2025-03-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm9000owg7yx94gza8x','cmrdtzwl90000wg7yvownk6z4','marketing,content'),
('cmrdtzwnv003gwg7yzqfz4aho','Social media strategy',NULL,'todo','high','2025-04-01 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm9000owg7yx94gza8x','cmrdtzwl90000wg7yvownk6z4','marketing,social'),
('cmrdtzwnx003kwg7yny3gnhsf','Email campaign setup',NULL,'todo','medium','2025-04-15 00:00:00.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000','cmrdtzwm9000owg7yx94gza8x','cmrdtzwl90000wg7yvownk6z4','marketing,email');

-- ─── Task Assignments ───────────────────────────────────
INSERT INTO "TaskAssignment" ("id","taskId","userId","assignedAt") VALUES
('cmrdtzwmf0012wg7yqc8t2q3c','cmrdtzwmf0010wg7yhezq6wv0','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwmh0016wg7yfnd6bae0','cmrdtzwmh0014wg7yc2s4gbs2','cmrdtzwlf0002wg7y18qds8y7','2026-07-09 18:19:37.000'),
('cmrdtzwmk001awg7yk04oo5ue','cmrdtzwmk0018wg7ysr61uxo4','cmrdtzwlf0002wg7y18qds8y7','2026-07-09 18:19:37.000'),
('cmrdtzwmn001ewg7ylwv0tuba','cmrdtzwmn001cwg7yu6x0jtrx','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwmo001iwg7yi3judt8k','cmrdtzwmo001gwg7y4mmvhruc','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwmq001mwg7ykjdz4qb7','cmrdtzwmq001kwg7ykg0gwrrt','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwmt001qwg7yntib4rez','cmrdtzwmt001owg7ygt1fei2x','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwmw001ywg7y5qxloekn','cmrdtzwmw001wwg7y40lt5mg6','cmrdtzwlf0002wg7y18qds8y7','2026-07-09 18:19:37.000'),
('cmrdtzwn20022wg7ypzib572x','cmrdtzwn20020wg7y1laq85ke','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwn50026wg7yyhq98gc5','cmrdtzwn50024wg7yo5j8l8zg','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwn6002awg7y7zz8d1pb','cmrdtzwn60028wg7ylhs0ew97','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwn8002ewg7yqlx38x6h','cmrdtzwn7002cwg7yjgrp4ulh','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwn9002iwg7ye289zdho','cmrdtzwn9002gwg7y0683mqpv','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwna002mwg7ynnsa4z3h','cmrdtzwna002kwg7yl7afepwz','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwnc002qwg7yf9p5hj3z','cmrdtzwnc002owg7y2v6gsmex','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwnh002uwg7yj71ohq1g','cmrdtzwnh002swg7ypvjuk9sa','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwni002ywg7ygs8n0654','cmrdtzwni002wwg7yqm2xpvcn','cmrdtzwlf0002wg7y18qds8y7','2026-07-09 18:19:37.000'),
('cmrdtzwnk0032wg7ym54d6qoj','cmrdtzwnk0030wg7yfqc9xs8s','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwnl0036wg7ys2u8vrt8','cmrdtzwnl0034wg7y1md1jcm5','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwnn003awg7yjjfmzf6b','cmrdtzwnn0038wg7ypigxtem9','cmrdtzwl90000wg7yvownk6z4','2026-07-09 18:19:37.000'),
('cmrdtzwno003ewg7yuspymael','cmrdtzwno003cwg7y0ob6lkz7','cmrdtzwle0001wg7y9fqm55mi','2026-07-09 18:19:37.000'),
('cmrdtzwnv003iwg7yice15w05','cmrdtzwnv003gwg7yzqfz4aho','cmrdtzwlf0002wg7y18qds8y7','2026-07-09 18:19:37.000'),
('cmrdtzwnx003mwg7y3cpa4jdz','cmrdtzwnx003kwg7yny3gnhsf','cmrdtzwlf0002wg7y18qds8y7','2026-07-09 18:19:37.000');

-- ─── Subtasks ───────────────────────────────────────────
INSERT INTO "Subtask" ("id","title","completed","taskId","createdAt") VALUES
('cmrdtzwny003nwg7yq3x9j5pl','Desktop layout',1,'cmrdtzwmf0010wg7yhezq6wv0','2026-07-09 18:19:37.000'),
('cmrdtzwny003owg7yy4s8k8je','Tablet layout',1,'cmrdtzwmf0010wg7yhezq6wv0','2026-07-09 18:19:37.000'),
('cmrdtzwny003pwg7yufq55moc','Mobile layout',0,'cmrdtzwmf0010wg7yhezq6wv0','2026-07-09 18:19:37.000'),
('cmrdtzwo4003qwg7yn1hhomcv','Color palette definition',1,'cmrdtzwmh0014wg7yc2s4gbs2','2026-07-09 18:19:37.000'),
('cmrdtzwo4003rwg7yavx7fw8w','Typography scale',1,'cmrdtzwmh0014wg7yc2s4gbs2','2026-07-09 18:19:37.000'),
('cmrdtzwo4003swg7yhknzzqlu','Component library',0,'cmrdtzwmh0014wg7yc2s4gbs2','2026-07-09 18:19:37.000');

-- ─── Comments ───────────────────────────────────────────
INSERT INTO "Comment" ("id","content","createdAt","updatedAt","taskId","userId") VALUES
('cmrdtzwo5003twg7ycl3zrqjy','Started working on the responsive navigation. Will share the Figma link shortly.','2026-07-09 18:19:37.637','2026-07-09 18:19:37.637','cmrdtzwmk0018wg7ysr61uxo4','cmrdtzwle0001wg7y9fqm55mi'),
('cmrdtzwo5003uwg7y3vacxupc','Looks great! Make sure to test on Safari and Firefox.','2026-07-09 18:19:37.637','2026-07-09 18:19:37.637','cmrdtzwmk0018wg7ysr61uxo4','cmrdtzwl90000wg7yvownk6z4'),
('cmrdtzwo5003vwg7yy17l6kof','Added mobile hamburger menu with smooth animation. PR is ready for review.','2026-07-09 18:19:37.637','2026-07-09 18:19:37.637','cmrdtzwmk0018wg7ysr61uxo4','cmrdtzwle0001wg7y9fqm55mi');

-- ─── Messages ───────────────────────────────────────────
INSERT INTO "Message" ("id","content","senderId","receiverId","groupId","projectId","read","createdAt") VALUES
('cmrdtzwo6003wwg7yw6b2p9oy','Hi Sarah, how is the website redesign coming along?','cmrdtzwl90000wg7yvownk6z4','cmrdtzwle0001wg7y9fqm55mi',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo6003xwg7yo7pwnl4w','Going well! The navigation is almost done. Should be ready for review by Friday.','cmrdtzwle0001wg7y9fqm55mi','cmrdtzwl90000wg7yvownk6z4',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo6003ywg7yfyhue2mn','Perfect. The client is asking about the timeline for the hero section.','cmrdtzwl90000wg7yvownk6z4','cmrdtzwle0001wg7y9fqm55mi',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo6003zwg7yeebjs118','I can have the hero section done by next Wednesday. Let me check with Mike about the assets.','cmrdtzwle0001wg7y9fqm55mi','cmrdtzwl90000wg7yvownk6z4',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo60040wg7ye1crb5f3','John from Acme Corp wants to schedule a call about the project scope.','cmrdtzwlh0004wg7yaa3ol8f7','cmrdtzwl90000wg7yvownk6z4',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo60041wg7yu137cz97','Sure, let me set up a meeting for Thursday at 2 PM.','cmrdtzwl90000wg7yvownk6z4','cmrdtzwlh0004wg7yaa3ol8f7',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo60042wg7yk91x1gns','That works perfectly. Looking forward to it!','cmrdtzwlh0004wg7yaa3ol8f7','cmrdtzwl90000wg7yvownk6z4',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo60043wg7yw0c04p5a','Mike, can you review the API integration docs I shared?','cmrdtzwle0001wg7y9fqm55mi','cmrdtzwlf0002wg7y18qds8y7',NULL,NULL,0,'2026-07-09 18:19:37.638'),
('cmrdtzwo60044wg7ycsphc24o','Sure, I''ll take a look this afternoon. The payment gateway spec looks complex.','cmrdtzwlf0002wg7y18qds8y7','cmrdtzwle0001wg7y9fqm55mi',NULL,NULL,0,'2026-07-09 18:19:37.638');

-- ─── Onboarding Submission ──────────────────────────────
INSERT INTO "Onboarding" ("id","formId","clientId","status","responsesJson","reviewNotes","reviewedBy","reviewedAt","submittedAt","createdAt","updatedAt") VALUES
('cmrdtzwo8004dwg7yfs4yeedx','cmrdtzwmc000wwg7ylejpnxq4','cmrdtzwlh0004wg7yaa3ol8f7','submitted','{"companyName":"Acme Corp","industry":"Technology","companySize":"51-200","website":"https://acme.com","brandColors":"#FF5733, #333333","logoDescription":"Modern geometric logo with bold typography","brandVoice":"Professional","projectGoals":"Redesign our corporate website to improve user experience and increase conversions.","targetAudience":"B2B decision makers, CTOs, and engineering managers","competitors":"CompetitorA.com, CompetitorB.io","budget":"$50K-$100K"}',NULL,NULL,NULL,'2026-07-08 18:19:37.000','2026-07-09 18:19:37.000','2026-07-09 18:19:37.000');

-- ─── Activity Log ───────────────────────────────────────
INSERT INTO "ActivityLog" ("id","action","details","userId","projectId","taskId","createdAt") VALUES
('cmrdtzwo70045wg7yls9gwo1v','project_created','Created project "Website Redesign"','cmrdtzwl90000wg7yvownk6z4','cmrdtzwm00007wg7yykvgjlng',NULL,'2026-07-09 18:19:37.640'),
('cmrdtzwo70046wg7ynsvwiox0','project_created','Created project "Mobile App Development"','cmrdtzwl90000wg7yvownk6z4','cmrdtzwm4000dwg7y59idwcn4',NULL,'2026-07-09 18:19:37.640'),
('cmrdtzwo70047wg7yxwz4iucg','task_created','Created task "Create wireframes for homepage"','cmrdtzwl90000wg7yvownk6z4','cmrdtzwm00007wg7yykvgjlng',NULL,'2026-07-09 18:19:37.640'),
('cmrdtzwo70048wg7yees8qbml','task_moved','Moved "Build responsive navigation" to In Progress','cmrdtzwle0001wg7y9fqm55mi','cmrdtzwm00007wg7yykvgjlng',NULL,'2026-07-09 18:19:37.640'),
('cmrdtzwo70049wg7ynld9p6su','comment_added','Commented on "Build responsive navigation"','cmrdtzwl90000wg7yvownk6z4','cmrdtzwm00007wg7yykvgjlng',NULL,'2026-07-09 18:19:37.640'),
('cmrdtzwo7004awg7ywqqdd12y','task_completed','Completed "Create wireframes for homepage"','cmrdtzwle0001wg7y9fqm55mi','cmrdtzwm00007wg7yykvgjlng',NULL,'2026-07-09 18:19:37.640'),
('cmrdtzwo7004bwg7yac4c6m64','member_added','Added Sarah Chen to "Mobile App Development"','cmrdtzwl90000wg7yvownk6z4','cmrdtzwm4000dwg7y59idwcn4',NULL,'2026-07-09 18:19:37.640');
