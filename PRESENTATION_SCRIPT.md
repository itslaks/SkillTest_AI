# SkillTest — Maverick TMS
# PRESENTATION SCRIPT
# Hexaware Technologies | Capstone Project

---

## 🎬 OPENING (30 seconds)

"Good [morning/afternoon], everyone.

What you're about to see is **Maverick TMS** — a full-scale enterprise Training Management System built for Hexaware. This isn't a prototype. This is a production-ready platform that currently handles quiz creation, AI-powered assessment, training operations, batch management, and enterprise-grade data analytics — all in one unified system.

Let me walk you through the three core pillars of this platform."

---

## 🔐 SECTION 1 — THREE-TIER ROLE SYSTEM (2 minutes)

### Slide: Show Login Page

"The platform supports **three distinct roles**, each with its own experience, its own interface, and its own level of access."

**[Point to the three role cards on the login page]**

"First: **Admin** — this is the top-most authority. There is exactly one admin account. The admin controls who becomes a trainer, what governance rules apply, and has a bird's-eye view of the entire platform.

Second: **Trainer** — trainers create assessments, manage batches, run sessions, and track student outcomes. A trainer must go through an **approval process** before they can access the platform.

Third: **Student** — employees and candidates who take assessments, earn badges, track their own progress, and participate in the leaderboard. Students sign up and get instant access."

---

## 📝 SECTION 2 — SIGN-UP FLOW (2 minutes)

### Slide: Show Sign-Up Page

**[Navigate to `/auth/sign-up`]**

"Here's our sign-up page. Notice the role selector — this is not just a dropdown. Students and Trainers see a completely different journey from this exact moment.

**Student flow**: I select Student, fill in my name, email, and password — I click Create Account. Within seconds, my account is verified and I'm in.

**Trainer flow**: I select Trainer. Notice immediately a yellow notice appears: *'Your account will be reviewed by an admin before you can log in.'* When a trainer submits, their account is created — but it sits in a **pending** state. They cannot log in until the admin approves it."

---

## 🔑 SECTION 3 — ADMIN CONSOLE: TRAINER APPROVAL (2 minutes)

### Slide: Log in as Admin

**[Log in with admin@hexaware.com / Zxcv,0987]**

"I'm logging in as Admin. Notice the platform knows — I'm taken directly to the **Admin Governance Console**, not the trainer dashboard."

**[Show the Pending Sign-Ups card at the top]**

"Right at the top of the Admin Console, there's a **Pending Trainer Sign-Ups** section. It shows an amber alert badge whenever there are trainers waiting for approval.

For each pending trainer — I can see their name, email, department, and when they applied. Two buttons: **Approve** or **Reject**.

The moment I click **Approve** — that trainer's account is activated. On their next login attempt, they get in. If I **Reject** — they see a rejection message and need to contact me.

This is clean, simple, and the admin always has control."

---

## 👨‍🏫 SECTION 4 — TRAINER DASHBOARD (1.5 minutes)

### Slide: Show Trainer Dashboard

**[Log in as trainer@hexaware.com / Asdf,1234]**

"Now I'm logged in as a **Trainer**. Notice the sidebar — it shows a **violet Trainer badge**. The navigation is scoped to only what a trainer needs: Dashboard, Training Ops, Quizzes, Employees.

The welcome banner shows **Trainer Dashboard** in violet — visually distinct from the Manager view. Trainers create quizzes, manage batches, run sessions, and track how their students are performing."

---

## 🎓 SECTION 5 — STUDENT PORTAL (1.5 minutes)

### Slide: Show Student Dashboard

**[Log in as any student account]**

"Now the Student portal. This is a completely different world — teal and black, focused on the learner's journey.

The student sees their next assigned quiz, their readiness meter, their streak, points, badges, and knowledge decay alerts. Everything is personalized to their progress.

From here they can take quizzes, view the leaderboard, access training notes, and submit feedback — all in one place."

---

## 📊 SECTION 6 — PLATFORM CAPABILITIES (2 minutes)

### Slide: Manager Dashboard Features

"Let me quickly show what this platform can do at scale:

- **AI-powered question generation** — paste content, get 20 MCQs in seconds
- **Assessment import** — upload competitor assessment Excel sheets, analyze performance
- **Batch DNA Fingerprint** — understand your entire batch's strengths and weaknesses
- **Trainer Impact Score** — measure how effective each trainer's batch is performing
- **Cognitive Load Detector** — detects when a student is overwhelmed during a quiz
- **Knowledge Decay Tracking** — alerts when a student hasn't revised a topic in 14+ days
- **Full Training Ops** — batches, sessions, attendance, reminders, feedback cycle

And all of this is real-time, server-rendered, and secure with Row-Level Security enforced at the database layer."

---

## 🔒 SECTION 7 — SECURITY & SCALE (1 minute)

"Security is non-negotiable.

Every input goes through **Zod validation** on the server. Admins use a **service role client** that bypasses RLS only on trusted server routes. Regular users cannot access admin data under any circumstances.

The RBAC system is enforced at **three layers**:
1. The login redirect (role determines where you land)
2. Each route's server component (unauthorized users are redirected)
3. The database (RLS policies block unauthorized queries)

We've also optimized for **1,000+ concurrent users** — connection pooling, cached queries, minimal client-side rendering."

---

## 🎯 CLOSING (30 seconds)

"To summarize — Maverick TMS is:

✅ **Three distinct role experiences** — Admin, Trainer, Student
✅ **Trainer approval workflow** — no unauthorized access
✅ **AI-powered assessments** — intelligent, adaptive
✅ **Full training lifecycle** — from batch creation to graduation
✅ **Production-ready** — deployed on Vercel, secured with Supabase

This is the platform Hexaware can use to manage thousands of employees across training programs — right now, today.

Thank you."

---

## 📌 QUICK REFERENCE DURING DEMO

| Action | URL | Credentials |
|--------|-----|-------------|
| Admin login | `/auth/login` | `admin@hexaware.com` / `Zxcv,0987` |
| Trainer login | `/auth/login` | `trainer@hexaware.com` / `Asdf,1234` |
| New trainer sign-up | `/auth/sign-up` | Select Trainer role |
| New student sign-up | `/auth/sign-up` | Select Student role |
| Admin console | `/manager/admin` | Must be logged in as admin |
| Forgot password | `/auth/reset-password` | Any registered email |

---

## ⚠️ PRE-DEMO CHECKLIST

- [ ] Run `025_trainer_approval.sql` in Supabase SQL Editor
- [ ] Confirm `admin@hexaware.com` has role `admin` and `approval_status = approved`
- [ ] Confirm `trainer@hexaware.com` has role `trainer` and `approval_status = approved`
- [ ] Clear any test pending trainer accounts from the demo environment
- [ ] Open the site in a fresh browser window to avoid cached sessions
- [ ] Have a second browser window ready for the trainer account demo

---

*Presentation Script — Maverick TMS | Hexaware Capstone*
