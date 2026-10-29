import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const registerWorkspaceSchema = z.object({
  workspaceName: z.string().min(2, 'Business name must be at least 2 characters long').max(255),
  businessType: z.string().min(2, 'Please select a business type').default('Contractor / Builder'),
  serviceArea: z.string().min(2, 'Please provide delivery area or cities').default('Delhi NCR'),
  adminName: z.string().min(2, 'Contact name must be at least 2 characters long'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterWorkspaceInput = z.infer<typeof registerWorkspaceSchema>;
