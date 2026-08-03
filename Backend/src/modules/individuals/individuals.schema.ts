import { z } from "zod";

const availabilityEnum = z.enum(["IMMEDIATE", "ONE_MONTH", "THREE_MONTHS", "NOT_LOOKING"]);

const skillSchema = z.object({
  name: z.string().min(1).max(100),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).optional(),
  years: z.number().int().min(0).max(50).optional(),
});

const experienceSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
  end_date: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM").optional(),
  current: z.boolean().default(false),
  description: z.string().max(2000).optional(),
});

const educationSchema = z.object({
  degree: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  field: z.string().max(200).optional(),
  start_year: z.number().int().min(1950).max(2100),
  end_year: z.number().int().min(1950).max(2100).optional(),
  current: z.boolean().default(false),
});

const certificationSchema = z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM").optional(),
  url: z.string().url().optional(),
});

const languageSchema = z.object({
  name: z.string().min(1).max(100),
  level: z.enum(["BASIC", "CONVERSATIONAL", "PROFESSIONAL", "FLUENT", "NATIVE"]),
});

export const upsertIndividualProfileSchema = z.object({
  headline: z.string().max(300).optional(),
  bio: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  website_url: z.string().url().optional().or(z.literal("")),
  linkedin_url: z.string().url().optional().or(z.literal("")),
  github_url: z.string().url().optional().or(z.literal("")),
  availability: availabilityEnum.optional(),
  skills: z.array(skillSchema).max(50).optional(),
  experience: z.array(experienceSchema).max(20).optional(),
  education: z.array(educationSchema).max(10).optional(),
  certifications: z.array(certificationSchema).max(20).optional(),
  languages: z.array(languageSchema).max(20).optional(),
});

export type UpsertIndividualProfileInput = z.infer<typeof upsertIndividualProfileSchema>;
