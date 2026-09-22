import { Request, Response } from "express";
import { setAuthCookies } from "../../constants/cookies";
import { asyncHandler } from "../../utils/asyncHandler";
import { ListUsersQuery, UpdateUserRoleInput, UpdateUserStatusInput, UserIdParam } from "./schemas/user.schema";
import { usersService } from "./users.service";

export const usersController = {
  becomeInstructor: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await usersService.becomeInstructor(req.user!.id);
    // Replaces the session so the new role takes effect on the very next request.
    setAuthCookies(res, tokens);
    res.status(200).json({ status: "success", data: { user } });
  }),

  // `req.query` is typed by Express as `ParsedQs` (raw strings), but the
  // `validate(listUsersQuerySchema, "query")` middleware that always runs
  // before this handler replaces it at runtime with a parsed/coerced
  // `ListUsersQuery` (numbers, enum). The cast documents that contract
  // instead of fighting Express's route-handler generics for it.
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListUsersQuery;
    const result = await usersService.list(query);
    res.status(200).json({ status: "success", data: result });
  }),

  getById: asyncHandler(async (req: Request<UserIdParam>, res: Response) => {
    const user = await usersService.getById(req.params.id);
    res.status(200).json({ status: "success", data: { user } });
  }),

  updateRole: asyncHandler(async (req: Request<UserIdParam, unknown, UpdateUserRoleInput>, res: Response) => {
    const user = await usersService.updateRole(req.params.id, req.body, req.user!.id);
    res.status(200).json({ status: "success", data: { user } });
  }),

  updateStatus: asyncHandler(
    async (req: Request<UserIdParam, unknown, UpdateUserStatusInput>, res: Response) => {
      const user = await usersService.updateStatus(req.params.id, req.body, req.user!.id);
      res.status(200).json({ status: "success", data: { user } });
    }
  ),
};
