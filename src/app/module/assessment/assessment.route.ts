import { Router } from 'express';
import { PrismaClient, Role, ExamStatus, AttemptStatus } from '@prisma/client';
import { z } from 'zod';
import { auth as requireAuth } from '../../middleware/checkAuth.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { prisma } from '../../lib/prisma.js';
export const assessmentRouter = Router();
const router = assessmentRouter;

const auth = (roles?: Role[]) => requireAuth(...(roles ?? []));
const asyncRoute = catchAsync;
const send = sendResponse;
const fail = (res: import('express').Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });
const idParam = z.object({ id: z.string().min(1) });
const questionInput = z.object({
  prompt: z.string().min(1),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().optional(),
});
const examInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  marksPerQuestion: z.number().int().positive(),
  negativeMarks: z.number().min(0),
  durationMinutes: z.number().int().positive(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});
router.post(
  '/api/v1/questions',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const input = questionInput.parse(req.body);
    send(
      res,
      await prisma.question.create({ data: { ...input, createdById: req.user!.sub } }),
      201,
    );
  }),
);
router.get(
  '/api/v1/questions',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const page = Math.max(Number(req.query.page ?? 1), 1),
      limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    send(res, {
      items: await prisma.question.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          prompt: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctAnswer: true,
          explanation: true,
        },
      }),
      page,
      limit,
    });
  }),
);

router.post(
  '/api/v1/exams',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const input = examInput.parse(req.body);
    send(
      res,
      await prisma.exam.create({
        data: {
          ...input,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
          createdById: req.user!.sub,
        },
      }),
      201,
    );
  }),
);
router.get(
  '/api/v1/exams',
  auth(),
  asyncRoute(async (req, res) => {
    const status = req.query.status as ExamStatus | undefined;
    send(
      res,
      await prisma.exam.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { questions: true, attempts: true } } },
      }),
    );
  }),
);
router.get(
  '/api/v1/exams/:id',
  auth(),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                prompt: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
              },
            },
          },
        },
      },
    });
    if (!exam) return fail(res, 'Exam not found', 404);
    send(res, exam);
  }),
);
router.post(
  '/api/v1/exams/:id/questions',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const input = z
      .object({ questionId: z.string(), order: z.number().int().positive() })
      .parse(req.body);
    send(res, await prisma.examQuestion.create({ data: { examId: id, ...input } }), 201);
  }),
);
router.post(
  '/api/v1/exams/:id/preview',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' }, include: { question: true } } },
    });
    if (!exam) return fail(res, 'Exam not found', 404);
    send(res, exam);
  }),
);
router.post(
  '/api/v1/exams/:id/publish',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const count = await prisma.examQuestion.count({ where: { examId: id } });
    if (!count) return fail(res, 'An exam must contain at least one question');
    send(res, await prisma.exam.update({ where: { id }, data: { status: ExamStatus.PUBLISHED } }));
  }),
);

const canStart = (exam: { status: ExamStatus; startsAt: Date | null; endsAt: Date | null }) =>
  exam.status === ExamStatus.PUBLISHED &&
  (!exam.startsAt || exam.startsAt <= new Date()) &&
  (!exam.endsAt || exam.endsAt > new Date());
router.post(
  '/api/v1/exams/:id/start',
  auth([Role.STUDENT]),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                prompt: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
              },
            },
          },
        },
      },
    });
    if (!exam || !canStart(exam)) return fail(res, 'Exam is not currently available', 409);
    const attempt = await prisma.attempt.upsert({
      where: { examId_studentId: { examId: id, studentId: req.user!.sub } },
      create: {
        examId: id,
        studentId: req.user!.sub,
        totalMarks: exam.questions.length * exam.marksPerQuestion,
      },
      update: {},
    });
    send(res, {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      expiresAt: new Date(attempt.startedAt.getTime() + exam.durationMinutes * 60_000),
      exam,
    });
  }),
);
const submitAttempt = async (
  id: string,
  userId: string,
  answers: Record<string, string>,
  status: AttemptStatus,
) =>
  prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.findFirst({
      where: { id, studentId: userId },
      include: { exam: { include: { questions: { include: { question: true } } } } },
    });
    if (!attempt) throw new Error('NOT_FOUND');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) return attempt;
    const now = new Date();
    const expired =
      now.getTime() > attempt.startedAt.getTime() + attempt.exam.durationMinutes * 60_000;
    const finalStatus = expired ? AttemptStatus.AUTO_SUBMITTED : status;
    let score = 0;
    const rows = attempt.exam.questions.map(({ question }) => {
      const answer = answers[question.id] ?? null;
      const correct = answer === question.correctAnswer;
      const marks = correct
        ? attempt.exam.marksPerQuestion
        : answer
          ? -attempt.exam.negativeMarks
          : 0;
      score += marks;
      return { attemptId: id, questionId: question.id, answer, isCorrect: correct, marks };
    });
    await tx.attemptAnswer.createMany({ data: rows, skipDuplicates: true });
    return tx.attempt.update({
      where: { id },
      data: { status: finalStatus, submittedAt: now, score },
    });
  });
router.post(
  '/api/v1/attempts/:id/submit',
  auth([Role.STUDENT]),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const answers = z.record(z.string(), z.string()).parse(req.body.answers ?? {});
    try {
      send(res, await submitAttempt(id, req.user!.sub, answers, AttemptStatus.SUBMITTED));
    } catch (e) {
      if ((e as Error).message === 'NOT_FOUND') return fail(res, 'Attempt not found', 404);
      throw e;
    }
  }),
);
router.get(
  '/api/v1/attempts/:id',
  auth(),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const attempt = await prisma.attempt.findFirst({
      where: { id, ...(req.user!.role === Role.STUDENT ? { studentId: req.user!.sub } : {}) },
      include: {
        exam: { select: { id: true, title: true, durationMinutes: true } },
        answers: { select: { questionId: true, answer: true, isCorrect: true, marks: true } },
      },
    });
    if (!attempt) return fail(res, 'Attempt not found', 404);
    send(res, attempt);
  }),
);
router.get(
  '/api/v1/admin/exams/:id/results',
  auth([Role.ADMIN, Role.SUPER_ADMIN]),
  asyncRoute(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const rows = await prisma.attempt.findMany({
      where: {
        examId: id,
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] },
      },
      orderBy: { score: 'desc' },
      include: { student: { select: { id: true, name: true, email: true } } },
    });
    send(res, { examId: id, total: rows.length, results: rows });
  }),
);
