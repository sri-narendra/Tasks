const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

// Password Policy: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const RegisterSchema = z.object({
  email: z.string().email(),
  password: passwordSchema
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password required')
});

const BoardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  background: z.string().optional()
});

const UpdateBoardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  background: z.string().optional(),
  archived: z.boolean().optional()
});

const ListSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  boardId: objectIdSchema
});

const UpdateListSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  task_color: z.string().optional(),
  archived: z.boolean().optional(),
  position: z.number().optional()
});

const TaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  listId: objectIdSchema,
  description: z.string().optional().nullable(),
  due_date: z.string().datetime().optional().nullable().or(z.string().optional().nullable()), 
  completed: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  recurrence: z.string().optional().nullable(),
  parent_id: objectIdSchema.optional().nullable(),
  position: z.number().optional()
});

const UpdateTaskSchema = TaskSchema.partial().extend({
    completed_at: z.date().optional()
});

const AttachmentSchema = z.object({
  taskId: objectIdSchema,
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  fileType: z.string().optional()
});

const BulkTaskSchema = z.object({
    tasks: z.array(TaskSchema.extend({
        listId: objectIdSchema
    }))
});

module.exports = {
    objectIdSchema,
    RegisterSchema,
    LoginSchema,
    BoardSchema,
    UpdateBoardSchema,
    ListSchema,
    UpdateListSchema,
    TaskSchema,
    UpdateTaskSchema,
    AttachmentSchema,
    ReorderSchema,
    BulkTaskSchema
};
