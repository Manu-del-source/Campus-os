'use server';

import { z } from 'zod';
import { authenticateUser, createSession, toAuthContext } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function loginAction(input: { email: string; password: string }): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please provide a valid email and password.',
    };
  }

  const { email, password } = parsed.data;
  const user = await authenticateUser(email, password);

  if (!user) {
    return {
      success: false,
      error: 'Those credentials did not match an active account.',
    };
  }

  await createSession(user.id);
  const context = toAuthContext(user);

  await recordAudit(context, {
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    summary: 'User signed in',
  });

  return {
    success: true,
    redirectTo: user.isPlatformAdmin ? '/platform' : '/dashboard',
  };
}
