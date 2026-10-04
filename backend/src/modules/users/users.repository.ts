import { Prisma, Role, User } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ListUsersQuery } from "./schemas/user.schema";

function buildWhere(query: Pick<ListUsersQuery, "search" | "role">): Prisma.UserWhereInput {
  return {
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const usersRepository = {
  async findMany(query: ListUsersQuery): Promise<{ users: User[]; total: number }> {
    const where = buildWhere(query);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  /**
   * Who to tell when someone asks to teach. Read from the database rather than
   * configured, so adding an admin is enough and there is no second place to
   * keep in step. Deactivated accounts are left out: they cannot act on it.
   */
  findAdmins(): Promise<User[]> {
    return prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true } });
  },

  updateRole(id: string, role: Role): Promise<User> {
    return prisma.user.update({ where: { id }, data: { role } });
  },

  updateStatus(id: string, isActive: boolean): Promise<User> {
    return prisma.user.update({ where: { id }, data: { isActive } });
  },
};
