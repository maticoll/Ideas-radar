// Single-user demo helper. In a real app this resolves the authenticated user
// (email/password or magic link). Here we ensure one demo user exists.
import { prisma } from "./db";

export async function getCurrentUser() {
  let user = await prisma.user.findFirst({ where: { email: "demo@idearadar.app" } });
  if (!user) {
    user = await prisma.user.create({ data: { name: "Corea", email: "demo@idearadar.app" } });
  }
  return user;
}
