import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Template name must be at least 3 characters")
    .max(100, "Template name cannot exceed 100 characters"),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
});