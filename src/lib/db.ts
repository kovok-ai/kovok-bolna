import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __globalPrismaClient: PrismaClient | undefined;
}

export const prisma =
  globalThis.__globalPrismaClient ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// In development or on Vercel/serverless environments, preserve client on globalThis
// to prevent connection exhaustion across hot-reloads and warm serverless invocations.
globalThis.__globalPrismaClient = prisma;

/**
 * Executes a callback within a transaction where the tenant context
 * is set transaction-locally using SET LOCAL app.current_workspace_id.
 * This guarantees that PostgreSQL Row-Level Security (RLS) is strictly
 * enforced and prevents connection-pool bleed in connection poolers.
 */
export async function withTenantContext<T>(
  workspaceId: string,
  callback: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    // Sanitize UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)) {
      throw new Error('Invalid workspaceId UUID provided for tenant context');
    }

    // Set transaction-local setting; resets automatically when transaction ends
    await tx.$executeRawUnsafe(`SET LOCAL app.current_workspace_id = '${workspaceId}';`);

    return await callback(tx);
  });
}
