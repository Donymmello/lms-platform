import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  InstructorRequestInput,
  ListUsersQuery,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  UserIdParam,
} from "./schemas/user.schema";
import { usersService } from "./users.service";

export const usersController = {
  /**
   * Answers the same way whether the caller is a student, already an
   * instructor, or there is no admin to tell. The caller learns their request
   * was taken, and nothing about the platform's internals.
   */
  requestInstructorAccess: asyncHandler(async (req: Request, res: Response) => {
    await usersService.requestInstructorAccess(req.user!.id, req.body as InstructorRequestInput);
    res.status(202).json({ status: "success", data: { received: true } });
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
