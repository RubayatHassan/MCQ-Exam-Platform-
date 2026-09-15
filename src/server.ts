import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient, Role, ExamStatus, AttemptStatus } from '@prisma/client';

const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 4000);
const secret = process.env.JWT_ACCESS_SECRET ?? 'development-only-secret-change-me';
type Claims = { sub: string; role: Role; email: string };
declare global { namespace Express { interface Request { user?: Claims } } }

const app = express();
app.use(helmet()); app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' })); app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req,res,next)).catch(next);
const auth = (roles?: Role[]) => (req: Request, res: Response, next: NextFunction) => { const token = req.headers.authorization?.replace('Bearer ',''); if (!token) return res.status(401).json({success:false,error:{message:'Authentication required'}}); try { const claims = jwt.verify(token, secret) as Claims; if (roles && !roles.includes(claims.role)) return res.status(403).json({success:false,error:{message:'Insufficient permissions'}}); req.user=claims; next(); } catch { return res.status(401).json({success:false,error:{message:'Invalid or expired token'}}); } };
const idParam = z.object({ id: z.string().min(1) });
const questionInput = z.object({ prompt:z.string().min(1), optionA:z.string().min(1), optionB:z.string().min(1), optionC:z.string().min(1), optionD:z.string().min(1), correctAnswer:z.enum(['A','B','C','D']), explanation:z.string().optional() });
const examInput = z.object({ title:z.string().min(1), description:z.string().optional(), instructions:z.string().optional(), marksPerQuestion:z.number().int().positive(), negativeMarks:z.number().min(0), durationMinutes:z.number().int().positive(), startsAt:z.string().datetime().optional(), endsAt:z.string().datetime().optional() });
const send = (res:Response, data:unknown, status=200) => res.status(status).json({success:true,data});
const fail = (res:Response, message:string, status=400) => res.status(status).json({success:false,error:{message}});

app.get('/health', (_req,res)=>send(res,{status:'ok',service:'mcq-exam-platform-api'}));
app.post('/api/v1/auth/register', asyncRoute(async (req,res)=>{ const input=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8)}).parse(req.body); const passwordHash=await bcrypt.hash(input.password,12); const user=await prisma.user.create({data:{...input,passwordHash},select:{id:true,name:true,email:true,role:true}}); send(res,user,201); }));
app.post('/api/v1/auth/login', asyncRoute(async (req,res)=>{ const input=z.object({email:z.string().email(),password:z.string()}).parse(req.body); const user=await prisma.user.findUnique({where:{email:input.email}}); if(!user || user.status!=='ACTIVE' || !(await bcrypt.compare(input.password,user.passwordHash))) return fail(res,'Invalid credentials',401); const token=jwt.sign({sub:user.id,role:user.role,email:user.email},secret,{expiresIn:(process.env.JWT_ACCESS_EXPIRES_IN??'15m') as jwt.SignOptions['expiresIn']}); send(res,{accessToken:token,user:{id:user.id,name:user.name,email:user.email,role:user.role}}); }));
app.get('/api/v1/auth/me',auth(),asyncRoute(async(req,res)=>send(res,await prisma.user.findUnique({where:{id:req.user!.sub},select:{id:true,name:true,email:true,role:true,status:true}}))));
app.get('/api/v1/students/me/profile',auth([Role.STUDENT]),asyncRoute(async(req,res)=>{
  const profile=await prisma.user.findUnique({where:{id:req.user!.sub},select:{id:true,name:true,email:true,role:true,status:true,createdAt:true,updatedAt:true}});
  if(!profile)return fail(res,'Profile not found',404); send(res,profile);
}));
app.patch('/api/v1/students/me/profile',auth([Role.STUDENT]),asyncRoute(async(req,res)=>{
  const input=z.object({name:z.string().min(2).max(100).optional(),email:z.string().email().optional()}).strict().refine(v=>Object.keys(v).length>0,{message:'At least one profile field is required'}).parse(req.body);
  if(input.email){const existing=await prisma.user.findFirst({where:{email:input.email,id:{not:req.user!.sub}}});if(existing)return fail(res,'Email is already in use',409);}
  const profile=await prisma.user.update({where:{id:req.user!.sub},data:input,select:{id:true,name:true,email:true,role:true,status:true,updatedAt:true}}); send(res,profile);
}));
app.patch('/api/v1/students/me/password',auth([Role.STUDENT]),asyncRoute(async(req,res)=>{
  const input=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(8).max(128)}).parse(req.body);
  const user=await prisma.user.findUnique({where:{id:req.user!.sub}}); if(!user || !(await bcrypt.compare(input.currentPassword,user.passwordHash)))return fail(res,'Current password is incorrect',400);
  await prisma.user.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(input.newPassword,12)}}); send(res,{message:'Password updated successfully'});
}));

app.post('/api/v1/questions',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const input=questionInput.parse(req.body); send(res,await prisma.question.create({data:{...input,createdById:req.user!.sub}}),201); }));
app.get('/api/v1/questions',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const page=Math.max(Number(req.query.page??1),1),limit=Math.min(Math.max(Number(req.query.limit??20),1),100); send(res,{items:await prisma.question.findMany({skip:(page-1)*limit,take:limit,orderBy:{createdAt:'desc'},select:{id:true,prompt:true,optionA:true,optionB:true,optionC:true,optionD:true,correctAnswer:true,explanation:true}}),page,limit}); }));

app.post('/api/v1/exams',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const input=examInput.parse(req.body); send(res,await prisma.exam.create({data:{...input,startsAt:input.startsAt?new Date(input.startsAt):undefined,endsAt:input.endsAt?new Date(input.endsAt):undefined,createdById:req.user!.sub}}),201); }));
app.get('/api/v1/exams',auth(),asyncRoute(async(req,res)=>{ const status=req.query.status as ExamStatus|undefined; send(res,await prisma.exam.findMany({where:{status},orderBy:{createdAt:'desc'},include:{_count:{select:{questions:true,attempts:true}}}})); }));
app.get('/api/v1/exams/:id',auth(),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const exam=await prisma.exam.findUnique({where:{id},include:{questions:{orderBy:{order:'asc'},include:{question:{select:{id:true,prompt:true,optionA:true,optionB:true,optionC:true,optionD:true}}}}}}); if(!exam)return fail(res,'Exam not found',404); send(res,exam); }));
app.post('/api/v1/exams/:id/questions',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const input=z.object({questionId:z.string(),order:z.number().int().positive()}).parse(req.body); send(res,await prisma.examQuestion.create({data:{examId:id,...input}}),201); }));
app.post('/api/v1/exams/:id/preview',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const exam=await prisma.exam.findUnique({where:{id},include:{questions:{orderBy:{order:'asc'},include:{question:true}}}}); if(!exam)return fail(res,'Exam not found',404); send(res,exam); }));
app.post('/api/v1/exams/:id/publish',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const count=await prisma.examQuestion.count({where:{examId:id}}); if(!count)return fail(res,'An exam must contain at least one question'); send(res,await prisma.exam.update({where:{id},data:{status:ExamStatus.PUBLISHED}})); }));

const canStart=(exam:{status:ExamStatus;startsAt:Date|null;endsAt:Date|null})=>exam.status===ExamStatus.PUBLISHED && (!exam.startsAt || exam.startsAt<=new Date()) && (!exam.endsAt || exam.endsAt>new Date());
app.post('/api/v1/exams/:id/start',auth([Role.STUDENT]),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const exam=await prisma.exam.findUnique({where:{id},include:{questions:{orderBy:{order:'asc'},include:{question:{select:{id:true,prompt:true,optionA:true,optionB:true,optionC:true,optionD:true}}}}}}); if(!exam||!canStart(exam))return fail(res,'Exam is not currently available',409); const attempt=await prisma.attempt.upsert({where:{examId_studentId:{examId:id,studentId:req.user!.sub}},create:{examId:id,studentId:req.user!.sub,totalMarks:exam.questions.length*exam.marksPerQuestion},update:{}}); send(res,{attemptId:attempt.id,startedAt:attempt.startedAt,expiresAt:new Date(attempt.startedAt.getTime()+exam.durationMinutes*60_000),exam}); }));
const submitAttempt=async(id:string,userId:string,answers:Record<string,string>,status:AttemptStatus)=>prisma.$transaction(async tx=>{ const attempt=await tx.attempt.findFirst({where:{id,studentId:userId},include:{exam:{include:{questions:{include:{question:true}}}}}}); if(!attempt)throw new Error('NOT_FOUND'); if(attempt.status!==AttemptStatus.IN_PROGRESS)return attempt; const now=new Date(); const expired=now.getTime()>attempt.startedAt.getTime()+attempt.exam.durationMinutes*60_000; const finalStatus=expired?AttemptStatus.AUTO_SUBMITTED:status; let score=0; const rows=attempt.exam.questions.map(({question})=>{const answer=answers[question.id]??null;const correct=answer===question.correctAnswer;const marks=correct?attempt.exam.marksPerQuestion:(answer? -attempt.exam.negativeMarks:0);score+=marks;return {attemptId:id,questionId:question.id,answer,isCorrect:correct,marks};}); await tx.attemptAnswer.createMany({data:rows,skipDuplicates:true}); return tx.attempt.update({where:{id},data:{status:finalStatus,submittedAt:now,score}});});
app.post('/api/v1/attempts/:id/submit',auth([Role.STUDENT]),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const answers=z.record(z.string(),z.string()).parse(req.body.answers??{}); try{send(res,await submitAttempt(id,req.user!.sub,answers,AttemptStatus.SUBMITTED));}catch(e){if((e as Error).message==='NOT_FOUND')return fail(res,'Attempt not found',404);throw e;} }));
app.get('/api/v1/attempts/:id',auth(),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const attempt=await prisma.attempt.findFirst({where:{id,...(req.user!.role===Role.STUDENT?{studentId:req.user!.sub}: {})},include:{exam:{select:{id:true,title:true,durationMinutes:true}},answers:{select:{questionId:true,answer:true,isCorrect:true,marks:true}}}}); if(!attempt)return fail(res,'Attempt not found',404); send(res,attempt); }));
app.get('/api/v1/admin/exams/:id/results',auth([Role.ADMIN,Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{ const {id}=idParam.parse(req.params); const rows=await prisma.attempt.findMany({where:{examId:id,status:{in:[AttemptStatus.SUBMITTED,AttemptStatus.AUTO_SUBMITTED]}},orderBy:{score:'desc'},include:{student:{select:{id:true,name:true,email:true}}}}); send(res,{examId:id,total:rows.length,results:rows}); }));
app.get('/api/v1/admin/users',auth([Role.SUPER_ADMIN]),asyncRoute(async(_req,res)=>send(res,await prisma.user.findMany({orderBy:{createdAt:'desc'},select:{id:true,name:true,email:true,role:true,status:true,createdAt:true}}))));
app.post('/api/v1/admin/users',auth([Role.SUPER_ADMIN]),asyncRoute(async(req,res)=>{const input=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),role:z.enum(['ADMIN','STUDENT'])}).parse(req.body);send(res,await prisma.user.create({data:{...input,passwordHash:await bcrypt.hash(input.password,12)},select:{id:true,name:true,email:true,role:true,status:true}}),201);}));
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{ if(err instanceof z.ZodError)return fail(res,'Validation failed',422); console.error(err); return fail(res,'Internal server error',500); });
if(process.env.NODE_ENV!=='test') app.listen(port,()=>console.log(`MCQ API listening on ${port}`));
export { app, prisma };


