# Maverick Execution Platform - TMS Presentation Script

## 1. Opening

Good morning everyone.

We are presenting **Maverick Execution Platform - TMS**, a Training Management System built to solve the real execution problem behind training programs.

The requirement was not just to create quizzes or dashboards. It asked for an end-to-end platform covering:

- batch lifecycle management
- candidate onboarding
- trainer coordination
- attendance tracking
- assessment score management
- feedback
- notifications
- dashboards
- topper identification
- audit and reporting

Our solution brings those workflows into one connected execution platform.

## 2. Problem Breakdown

Training execution in many organizations is still fragmented.

- Batch planning happens in spreadsheets.
- Candidate lists are maintained manually.
- Trainers submit attendance through messages or files.
- Assessment scores arrive in separate Excel sheets.
- Feedback is collected late or inconsistently.
- Coordinators spend time chasing updates.
- Leaders do not get reliable real-time visibility.

This creates operational gaps:

- missed attendance uploads
- delayed assessment follow-up
- repeated absences without escalation
- unclear trainer ownership
- inconsistent topper selection
- weak auditability
- manual report preparation

Maverick TMS is built to close those gaps.

## 3. Solution Overview

Maverick TMS is a centralized training execution and governance platform.

It supports four role-based workspaces:

- **Admin**: manages users, roles, governance settings, cut-offs, topper criteria, and audit logs.
- **Training Coordinator / Manager**: manages batches, candidates, trainers, sessions, feedback, automation checks, dashboards, and reports.
- **Trainer**: works only on assigned batches and uploads attendance, assessment scores, and project evaluations.
- **Candidate**: sees batch details, sessions, attendance, reminders, linked assessments, and feedback forms.

This role separation is important because the BRD requires both governance and restricted access.

## 4. What We Implemented

### A. Batch Lifecycle Management

Training Coordinators can:

- create batches
- edit batch details
- set lifecycle status: Planned, Running, Completed, Closed
- define dates, domain, description, and schedule
- assign a lead trainer and multiple trainers
- enroll candidates manually or through Excel
- link assessments to batches

Batch changes and status transitions are audit-friendly.

### B. Trainer Workspace

Trainers are not treated as generic managers.

They get a scoped operations workspace for assigned batches only.

Trainers can:

- mark attendance manually
- upload attendance through Excel
- upload assessment score files
- upload project evaluation scores and evidence filenames
- view assigned batch context

This directly satisfies the trainer responsibility section of the BRD.

### C. Attendance Governance

Attendance is handled in two modes:

- manual UI marking
- Excel upload

The system validates and logs attendance uploads.

It also includes:

- configurable attendance cut-off
- missed attendance alert simulation
- consecutive absence alert simulation
- visible attendance health
- versioned attendance history showing old status, new status, source, timestamp, and changed-by user

This makes attendance auditable instead of just editable.

### D. Assessment Management

Training Coordinators can define assessment setup:

- assessment type
- schedule
- Excel template name
- question file name
- maximum score
- passing score
- status

Trainers and coordinators can upload assessment score files.

The upload process checks:

- candidate existence
- score ranges
- duplicate rows
- upload errors

Errors are visible in the Training Ops audit panel.

### E. Project Evaluation

Project evaluation is implemented as a separate workflow.

For each candidate, the evaluator can store:

- batch
- project title
- score
- evidence file name
- remarks
- evaluator identity

Project scores also feed the topper calculation.

### F. Feedback Management

Coordinators can open feedback windows.

Candidates submit structured feedback covering:

- overall rating
- training content quality
- trainer effectiveness
- written feedback
- suggested action item

Feedback is visible to coordinators and included in consolidated reports.

### G. Notification and Automation Simulation

The system includes an automation control panel for the BRD notification events:

- attendance not submitted before cut-off
- continuous absence streak
- upcoming assessment reminder
- feedback reminder before closure

Each run creates logged notification records and automation run history.

For demo purposes, this gives judges a clear view of how the operational alert engine works.

### H. Topper Center

The Reports page now includes a visible Topper Center.

Topper logic is transparent:

- assessment score weight
- project score weight
- minimum attendance threshold

The ranking shows:

- candidate name
- assessment score
- project score
- attendance percentage
- final topper score

The same data is exported in the Training Ops Excel report.

### I. Report Center

The Reports page is aligned to the BRD.

It includes:

- Training Ops Excel export
- Training Ops PDF export
- quiz/assessment reports
- consolidated candidate status filters:
  - discontinued
  - not cleared
  - offered
  - onboarded / active

The Excel workbook includes batch summary, candidate status, attendance, assessments, assessment setup, attendance uploads, project evaluations, topper criteria, topper candidates, feedback, notifications, and automation runs.

### J. Governance Console

Admins get a dedicated governance console.

They can:

- manage user roles
- set attendance cut-off
- set absence alert days
- configure feedback window defaults
- configure topper weights
- configure minimum attendance
- review admin audit logs

This gives the platform a real governance layer rather than only operational screens.

## 5. AI Intelligence Layer

Beyond the BRD baseline, Maverick TMS includes an intelligence layer:

- predictive readiness scoring
- cognitive load detection
- panic-mode detection
- anti-gaming / memorization detection
- batch DNA fingerprinting
- trainer impact scoring
- knowledge decay tracking

This makes the platform more than a tracking tool. It helps training teams decide where to intervene.

## 6. Suggested Live Demo Order

Use this order during the final presentation:

1. Landing page and Maverick TMS positioning
2. Manager dashboard
3. Training Ops screen
4. Batch creation with multi-trainer assignment
5. Batch editing and lifecycle status
6. Candidate upload / assignment
7. Session scheduling
8. Attendance manual marking
9. Attendance Excel upload
10. Attendance version audit panel
11. Assessment setup
12. Assessment score upload and error logging
13. Project evaluation upload
14. Automation control panel
15. Candidate training hub and feedback form
16. Report Center
17. Topper Center
18. Admin Governance Console
19. Analytics and AI cockpit

## 7. Why This Stands Out

Many teams may build:

- a quiz app
- a dashboard
- an LMS-style page
- a report export screen

Maverick TMS stands out because it combines:

- execution workflows
- role-based access
- trainer accountability
- Excel upload governance
- automation simulation
- audit history
- topper transparency
- BRD-aligned reports
- AI-powered assessment intelligence

It is not just digitizing training. It is making training execution observable, governed, and measurable.

## 8. Judge Q&A

### Q1. Is this only a quiz platform?

No. Quizzes are one part of the assessment layer. The main platform covers batch lifecycle, attendance, trainer coordination, feedback, automation, topper logic, and reports.

### Q2. How is trainer access handled?

Trainers enter a scoped workspace and operate on assigned batches. They can upload attendance, assessment scores, and project evaluations without getting full coordinator/admin control.

### Q3. How do you handle missed attendance?

The system has a configurable cut-off time and an automation simulation that creates coordinator email-style notification records when attendance is missing after the cut-off.

### Q4. How do you identify toppers?

Topper criteria are configurable by Admin. The Reports page shows the exact inputs: assessment score, project score, attendance percentage, and final weighted topper score.

### Q5. What makes the reporting BRD-aligned?

The Report Center includes Excel/PDF exports and visible candidate filters for discontinued, not cleared, offered, and onboarded/active candidates. The Excel workbook includes operational, assessment, feedback, topper, and notification sheets.

### Q6. What is the biggest business value?

It reduces manual coordination, gives leaders real-time visibility, enforces operational discipline, and creates audit-ready evidence for training execution.

## 9. Closing

The BRD asked for a centralized platform to manage the complete training lifecycle.

Maverick TMS delivers:

- batch management
- candidate onboarding
- trainer coordination
- attendance tracking
- assessment uploads
- project evaluations
- feedback management
- automated alerts
- dashboards
- topper reporting
- governance controls
- audit logs

On top of that, the platform adds behavioral and readiness intelligence so training leaders can act earlier and more confidently.

## 10. Final One-Line Pitch

**Maverick Execution Platform - TMS is a role-based training execution platform that unifies batches, candidates, trainers, attendance, assessments, feedback, automation, topper logic, reports, and AI intelligence in one governed system.**
