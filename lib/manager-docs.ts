export type AdminGuideSection = {
  id: string
  title: string
  priority: number
  role: string
  outcome: string
  whenToUse: string
  steps: string[]
  example: string
  tips: string[]
  relatedLinks: Array<{ label: string; href: string }>
}

export const adminGuideSections: AdminGuideSection[] = [
  {
    id: 'operating-order',
    title: 'Daily Operating Order',
    priority: 1,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Know what to do first without reading the whole system.',
    whenToUse: 'Start here every morning before creating or editing training records.',
    steps: [
      'Open Training Ops and scan action alerts, attendance due, absence risks, assessment clearance, and active batches.',
      'Use the quick action strip for the next task: Create batch, Schedule session, Feedback, Attendance, Assessment, or Reports.',
      'Fix overdue attendance first, then review absence risks, then schedule sessions and assessments.',
      'Use Live Batch Board at the end to confirm learners, trainer ownership, status, linked assessments, and current edits.',
    ],
    example: 'If Attendance due shows 3, open Attendance Tracker first, update or upload attendance, then move to Session Planner.',
    tips: [
      'Treat Training Ops like a control room: urgent corrections first, new setup second, reporting last.',
      'The green/red banner after each form tells you whether the action saved or what needs fixing.',
    ],
    relatedLinks: [
      { label: 'Training Ops', href: '/manager/operations' },
      { label: 'Reports', href: '/manager/reports' },
    ],
  },
  {
    id: 'add-employees',
    title: 'Add Employees',
    priority: 2,
    role: 'Admin or manager',
    outcome: 'Create learner accounts with Employee ID and Domain ready for quizzes and batches.',
    whenToUse: 'Use before assigning quizzes or adding candidates into a training batch.',
    steps: [
      'Open Employees and choose Add Employee for one learner or Import for many learners.',
      'Enter full name, work email, Employee ID, Domain / Vertical, and optional department.',
      'Submit the form. The system creates or updates the employee profile and sends a setup email.',
      'If an employee already exists, their Employee ID and Domain are updated instead of creating a duplicate.',
    ],
    example: 'For Ram in Data Engineering, enter ram@gmail.com, employee ID HEX1234, and Domain Data Engineering. If Ram already exists, the profile is updated and setup email is resent.',
    tips: [
      'Employee ID and Domain are mandatory because reports, assignments, and batch filters depend on them.',
      'Use import for bulk onboarding, then verify the Employees list before creating batches.',
    ],
    relatedLinks: [
      { label: 'Employees', href: '/manager/employees' },
      { label: 'Profiles', href: '/profiles' },
    ],
  },
  {
    id: 'create-quiz-assign',
    title: 'Create And Assign Quiz',
    priority: 3,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Create an assessment and assign it to employees or a training batch.',
    whenToUse: 'Use when learners need a skill test, pre-assessment, sprint review, or certification trigger.',
    steps: [
      'Open Quizzes and choose Create New Quiz.',
      'Fill Basics: quiz title, topic, difficulty, question count, and time limit.',
      'Set rules: passing score, result visibility, retakes, shuffling, and feedback URL if needed.',
      'Add questions by AI generation, upload template, or both.',
      'After creation, open the quiz detail page and use Employee Assignment to assign learners.',
      'For batch-based training, link the quiz while creating a training batch or edit the batch later.',
    ],
    example: 'Create “Java Foundation Week 1”, topic Java, 25 questions, pass score 70%, then assign it to Batch Java Foundation 07.',
    tips: [
      'Keep quiz titles human-readable because they appear in reports, certificates, and chatbot answers.',
      'Use assignment after the quiz is active; draft quizzes are not visible to employees.',
    ],
    relatedLinks: [
      { label: 'Create Quiz', href: '/manager/quizzes/new' },
      { label: 'Quizzes', href: '/manager/quizzes' },
    ],
  },
  {
    id: 'create-training-batch',
    title: 'Create Training Batch',
    priority: 4,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Create the main container for learners, trainers, sessions, attendance, feedback, assessments, and reports.',
    whenToUse: 'Use after employees and quizzes are ready.',
    steps: [
      'Open Training Ops and choose Create batch.',
      'Enter batch name, domain, start date, end date, and lead trainer.',
      'Select learners from the Learners checklist.',
      'Select quizzes or assessments from the Assessments checklist.',
      'Click Create batch and confirm the green success banner.',
    ],
    example: 'Batch name: Java Foundation Batch 07. Domain: Java. Trainer: Anita. Learners: 30 Java trainees. Assessments: Java Week 1 and Java Week 2.',
    tips: [
      'A batch is the center of Training Ops. Most other tools need a batch first.',
      'Use Live Batch Board after creation to edit batch details or trainer panel.',
    ],
    relatedLinks: [
      { label: 'Create Batch', href: '/manager/operations#create-batch' },
      { label: 'Live Batch Board', href: '/manager/operations#batch-board' },
    ],
  },
  {
    id: 'session-planner',
    title: 'Session Planner',
    priority: 5,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Schedule trainer-led sessions and prepare attendance records automatically.',
    whenToUse: 'Use after a batch is created and learners are enrolled.',
    steps: [
      'Open Training Ops and choose Schedule session.',
      'Pick the target batch, enter session title, trainer, agenda, date/time, mode, and status.',
      'Keep Attendance required checked when attendance must be tracked.',
      'Click Schedule session. The system creates attendance rows for enrolled learners.',
      'Use Batch Schedule Planner to review upcoming session and assessment dates.',
    ],
    example: 'Schedule “Week 1 Foundation Lab” for Java Batch 07 at 10:00 AM, virtual mode, attendance required.',
    tips: [
      'Create sessions before using Attendance Tracker or attendance upload templates.',
      'Cancelled sessions are ignored by attendance risk automation.',
    ],
    relatedLinks: [
      { label: 'Session Planner', href: '/manager/operations#schedule-session' },
      { label: 'Batch Schedule Planner', href: '/manager/operations#schedule-planner' },
    ],
  },
  {
    id: 'communication-center',
    title: 'Communication Center',
    priority: 6,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Create batch, trainer, coordinator, or individual notifications.',
    whenToUse: 'Use for reminders, schedule updates, attendance warnings, assessment notices, and manual announcements.',
    steps: [
      'Open Training Ops and go to Session Planner & Notifications.',
      'Choose optional batch and session.',
      'Select audience: Batch, Trainers, Coordinators, or Individual.',
      'Select channel: In App, Email, or WhatsApp log.',
      'Enter title, message, optional schedule time, then create notification.',
      'Review activity in Feedback & Reminder Pulse and Notifications.',
    ],
    example: 'Send “Reminder: assessment tomorrow at 10 AM” to Batch Java Foundation 07 using Email channel.',
    tips: [
      'In-app notifications are marked sent immediately.',
      'Email records may be logged, queued, sent, or failed depending on email configuration.',
    ],
    relatedLinks: [
      { label: 'Communication Center', href: '/manager/operations#schedule-session' },
      { label: 'Notifications', href: '/manager/notifications' },
    ],
  },
  {
    id: 'batch-candidate-upload',
    title: 'Batch Candidate Upload',
    priority: 7,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Bulk enroll candidates into a batch using a spreadsheet.',
    whenToUse: 'Use when a batch has many learners or candidate status updates.',
    steps: [
      'Open Training Ops and use Batch Candidate Import.',
      'Download the template if available.',
      'Fill candidate email or Employee ID, batch, and required status details.',
      'Upload the sheet and review success and issue counts.',
      'Fix failed rows and upload again if needed.',
    ],
    example: 'Upload 100 Java trainees into Batch 07 using their official emails and employee IDs.',
    tips: [
      'Duplicate candidate rows are rejected before or during upload.',
      'Use Employee import first if candidates do not yet exist as employees.',
    ],
    relatedLinks: [
      { label: 'Training Ops', href: '/manager/operations' },
      { label: 'Employees', href: '/manager/employees' },
    ],
  },
  {
    id: 'assessment-governance',
    title: 'Assessment Governance',
    priority: 8,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Define assessment schedule, score rules, templates, and source files before scores are uploaded.',
    whenToUse: 'Use before assessment score upload or formal project/coding reviews.',
    steps: [
      'Open Training Ops and go to Assessment Governance.',
      'Choose batch and assessment type such as sprint review, coding, API coding, project, or other.',
      'Enter assessment title, schedule, max score, and passing score.',
      'Attach template name, question file name, or upload the question file.',
      'Create assessment setup and confirm it appears in Assessment Document Library.',
    ],
    example: 'Create “Sprint 2 API Coding” for Batch 07 with max score 100 and passing score 70, then upload the question-bank file.',
    tips: [
      'Use clear assessment titles because they appear in document library, schedule planner, and exports.',
      'Passing score is validated against max score.',
    ],
    relatedLinks: [
      { label: 'Assessment Governance', href: '/manager/operations#assessment-setup' },
      { label: 'Assessment Upload', href: '/manager/operations#assessment' },
    ],
  },
  {
    id: 'project-evaluation',
    title: 'Project Evaluation Evidence',
    priority: 9,
    role: 'Trainer, admin, manager, or training coordinator',
    outcome: 'Record candidate project score, evidence file, and remarks.',
    whenToUse: 'Use after capstone, coding, sprint, or project submissions.',
    steps: [
      'Open Project Evaluation Evidence.',
      'Choose batch and candidate.',
      'Enter project title and score from 0 to 100.',
      'Attach evidence file or enter evidence filename.',
      'Add remarks with strengths and improvement actions.',
      'Save. Re-saving the same candidate/project updates the existing record.',
    ],
    example: 'Candidate Ram, project “Capstone API”, score 82, evidence “ram-api-review.pdf”, remarks “Good endpoints; improve error handling.”',
    tips: [
      'Trainers can only evaluate batches assigned to them.',
      'Evidence files help reports and BRD proof stay audit-ready.',
    ],
    relatedLinks: [
      { label: 'Project Evaluation', href: '/manager/operations#project-evaluation' },
      { label: 'Document Library', href: '/manager/operations#document-library' },
    ],
  },
  {
    id: 'automation-runbook',
    title: 'Automation Runbook',
    priority: 10,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Run governed checks for attendance cutoff, absence streaks, assessment reminders, and feedback reminders.',
    whenToUse: 'Use when you want the system to create reminder/alert records based on rules.',
    steps: [
      'Open Automation Runbook.',
      'Choose the check: attendance cutoff, absence streak, assessment reminder, or feedback reminder.',
      'Optionally select one batch, or leave blank for all visible batches.',
      'Click Run governed check.',
      'Review the result in the success banner and dispatch evidence.',
    ],
    example: 'Run absence streak for Java Batch 07 to flag learners absent across the latest configured attendance-required sessions.',
    tips: [
      'Automation creates audit records so managers can prove the check was executed.',
      'Email delivery depends on SMTP or Resend configuration.',
    ],
    relatedLinks: [
      { label: 'Automation Runbook', href: '/manager/operations#automation' },
      { label: 'Settings', href: '/manager/settings' },
    ],
  },
  {
    id: 'schedule-planner',
    title: 'Batch Schedule Planner',
    priority: 11,
    role: 'All training staff',
    outcome: 'View upcoming sessions and assessments in one timeline.',
    whenToUse: 'Use when coordinating weekly delivery, trainer calendars, or assessment dates.',
    steps: [
      'Open Batch Schedule Planner.',
      'Review upcoming milestones grouped by day.',
      'Check whether each item is a Session or Assessment.',
      'Use the status badges to spot scheduled, completed, cancelled, planned, or open work.',
    ],
    example: 'Before Monday standup, scan the next eight milestones and confirm trainer ownership for every scheduled session.',
    tips: [
      'If something is missing from the planner, create a session or assessment setup first.',
      'Use it as a calendar command board, not an editing form.',
    ],
    relatedLinks: [
      { label: 'Schedule Planner', href: '/manager/operations#schedule-planner' },
      { label: 'Session Planner', href: '/manager/operations#schedule-session' },
    ],
  },
  {
    id: 'assessment-document-library',
    title: 'Assessment Document Library',
    priority: 12,
    role: 'All training staff',
    outcome: 'Find question files, templates, project evidence, and assessment artifacts.',
    whenToUse: 'Use when an auditor, trainer, or manager asks where an assessment file or evidence file is recorded.',
    steps: [
      'Open Assessment Document Library.',
      'Review assessment setup files and project evidence files.',
      'Use batch labels to identify which batch owns each document.',
      'Use missing-file rows as a cleanup list for trainers/coordinators.',
    ],
    example: 'Find “Sprint 2 API Coding” question file and Ram’s “Capstone API” evidence from one library view.',
    tips: [
      'Document Library proves that assessments and project evaluations are backed by evidence.',
      'Upload files from Assessment Governance or Project Evaluation Evidence.',
    ],
    relatedLinks: [
      { label: 'Document Library', href: '/manager/operations#document-library' },
      { label: 'BRD Proof', href: '/manager/compliance' },
    ],
  },
  {
    id: 'live-batch-board',
    title: 'Live Batch Board',
    priority: 13,
    role: 'All training staff, with edit controls for coordinators/managers/admins',
    outcome: 'Manage live batch details, trainer panel, learner statuses, and linked assessments.',
    whenToUse: 'Use after creating a batch or whenever batch ownership/status changes.',
    steps: [
      'Open Live Batch Board.',
      'Review batch title, status, dates, lead trainer, learners, sessions, assessments, and trainers.',
      'If you have edit access, change title, domain, description, status, dates, or trainer panel.',
      'Use learner status dropdowns to mark active, onboarded, offered, not cleared, or discontinued.',
      'Save batch edits and confirm the success banner.',
    ],
    example: 'After Java Batch 07 completes, set status to Completed, mark cleared learners as Onboarded, and mark remaining learners Not Cleared.',
    tips: [
      'Status changes follow lifecycle order: planned, running, completed, closed.',
      'Learner statuses drive reports and remaining-candidate counts.',
    ],
    relatedLinks: [
      { label: 'Live Batch Board', href: '/manager/operations#batch-board' },
      { label: 'Reports', href: '/manager/reports' },
    ],
  },
  {
    id: 'feedback-reminder-pulse',
    title: 'Feedback And Reminder Pulse',
    priority: 14,
    role: 'Admin, manager, or training coordinator',
    outcome: 'Open feedback windows, monitor sentiment, and review reminder delivery.',
    whenToUse: 'Use after a session, assessment, or batch milestone where learner feedback is needed.',
    steps: [
      'Open Feedback & Reminder Pulse.',
      'Review sentiment counts, average rating, content quality, and trainer effectiveness.',
      'Create a feedback window by selecting batch, optional session, title, and close date.',
      'Review dispatch evidence for sent, failed, or logged reminders.',
      'Export feedback from the Reports page when needed.',
    ],
    example: 'Open “Week 1 Feedback” for Java Batch 07 until Friday 5 PM and monitor negative feedback count.',
    tips: [
      'Feedback is submitted by employees from their Training page when a window is open.',
      'Negative feedback should become a trainer/coordinator action item.',
    ],
    relatedLinks: [
      { label: 'Feedback', href: '/manager/operations#feedback' },
      { label: 'Reports', href: '/manager/reports' },
    ],
  },
  {
    id: 'attendance-tracker',
    title: 'Attendance Tracker',
    priority: 15,
    role: 'Trainer, admin, manager, or training coordinator',
    outcome: 'Upload or manually update attendance for every session learner.',
    whenToUse: 'Use after each attendance-required session.',
    steps: [
      'Create a session first with Attendance required checked.',
      'Open Attendance Tracker.',
      'Either upload the attendance spreadsheet or manually select Present, Late, Excused, or Absent for each learner.',
      'If uploading after cutoff, enter the late submission reason.',
      'Download issue files when upload rows fail and correct them.',
    ],
    example: 'Upload attendance for “Week 1 Foundation Lab” with Email and Status columns. Failed rows show missing employee or invalid status.',
    tips: [
      'Manual changes create version history.',
      'Attendance health, cutoff misses, absence streaks, and trainer scorecards depend on this data.',
    ],
    relatedLinks: [
      { label: 'Attendance Tracker', href: '/manager/operations#attendance' },
      { label: 'Reports', href: '/manager/reports' },
    ],
  },
]

export const adminGuideQuickStart = [
  'Add employees with Employee ID and Domain.',
  'Create or import quizzes and keep them active.',
  'Create a training batch with learners, trainers, and linked assessments.',
  'Schedule sessions and mark attendance after every session.',
  'Create assessment setup, upload scores, and save project evidence.',
  'Open feedback windows and run automation checks.',
  'Use Live Batch Board and Reports to close the loop.',
]

export function buildAdminGuideSearchIndex() {
  return adminGuideSections
    .map((section) => [
      `TITLE: ${section.title}`,
      `ROLE: ${section.role}`,
      `OUTCOME: ${section.outcome}`,
      `WHEN: ${section.whenToUse}`,
      `STEPS: ${section.steps.join(' > ')}`,
      `EXAMPLE: ${section.example}`,
      `TIPS: ${section.tips.join(' ')}`,
    ].join('\n'))
    .join('\n\n---\n\n')
}

export function findAdminGuideAnswer(question: string) {
  const lower = question.toLowerCase()
  const docsIntent = ['how', 'guide', 'docs', 'training ops', 'batch', 'session', 'attendance', 'feedback', 'assessment', 'project', 'automation', 'communication', 'candidate', 'schedule', 'employee', 'quiz']
    .some((token) => lower.includes(token))
  if (!docsIntent) return null

  const scored = adminGuideSections
    .map((section) => {
      const haystack = `${section.title} ${section.role} ${section.outcome} ${section.whenToUse} ${section.steps.join(' ')} ${section.example} ${section.tips.join(' ')}`.toLowerCase()
      const score = lower.split(/[^a-z0-9]+/).filter((token) => token.length > 2 && haystack.includes(token)).length
      return { section, score }
    })
    .sort((a, b) => b.score - a.score)

  const match = scored[0]
  if (!match || match.score === 0) return null

  return [
    `${match.section.title}: ${match.section.outcome}`,
    `Steps: ${match.section.steps.slice(0, 3).join(' ')}`,
    `Example: ${match.section.example}`,
    `Open: ${match.section.relatedLinks[0]?.href || '/manager/docs'}`,
  ].join('\n')
}
