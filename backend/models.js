const mongoose = require('mongoose');
const { Schema } = mongoose;

// Mixin for Soft Delete & Audit
const auditFields = {
    deleted_at: { type: Date, default: null, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' }, // useful for team/admin audit
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' }
};

const toJSONTransform = (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.tokenHash; // Security
    return ret;
};

// --- USER ---
const UserSchema = new Schema({
    email: { type: String, required: true }, // Uniqueness handled by index
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    ...auditFields
}, { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { transform: toJSONTransform }
});
// Unique email only for active users (allows re-registering if soft deleted user exists?? Usually no, but allows unique constraint to ignore deleted)
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });


// --- REFRESH TOKEN ---
const RefreshTokenSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true }, // Store hash, not raw token
    expires: { type: Date, required: true },
    created: { type: Date, default: Date.now },
    createdByIp: { type: String },
    revoked: { type: Date },
    revokedByIp: { type: String },
    replacedByToken: { type: String },
    ...auditFields
}, {
    toJSON: { transform: toJSONTransform }
});
RefreshTokenSchema.index({ user: 1 });
RefreshTokenSchema.index({ tokenHash: 1 });

// --- BOARD ---
const BoardSchema = new Schema({
    title: { type: String, required: true },
    background: { type: String },
    archived: { type: Boolean, default: false },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ...auditFields
}, { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true, transform: toJSONTransform }
});
BoardSchema.index({ user_id: 1, deleted_at: 1 }); // Main query index
BoardSchema.index({ user_id: 1, _id: 1 });

// --- LIST ---
const ListSchema = new Schema({
    title: { type: String, required: true },
    position: { type: Number, default: 0 },
    board_id: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    color: { type: String },
    task_color: { type: String },
    archived: { type: Boolean, default: false },
    ...auditFields
}, { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true, transform: toJSONTransform }
});
ListSchema.index({ board_id: 1, user_id: 1, deleted_at: 1 });
ListSchema.index({ user_id: 1, _id: 1 });
ListSchema.index({ user_id: 1, deleted_at: 1, board_id: 1 }); // For filtered fetches

// --- TASK ---
const TaskSchema = new Schema({
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    description: { type: String },
    due_date: { type: Date },
    recurrence: { type: String },
    is_starred: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
    list_id: { type: Schema.Types.ObjectId, ref: 'List', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Task' },
    completed_at: { type: Date },
    ...auditFields
}, { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true, transform: toJSONTransform }
});
TaskSchema.index({ list_id: 1, user_id: 1, deleted_at: 1 });
TaskSchema.index({ user_id: 1, _id: 1 });
TaskSchema.index({ parent_id: 1 });
TaskSchema.index({ user_id: 1, deleted_at: 1, list_id: 1 }); // Fast list-to-task mapping
TaskSchema.index({ user_id: 1, deleted_at: 1, completed: 1 }); // For archive/dashboard views

// --- ATTACHMENT ---
const AttachmentSchema = new Schema({
    task_id: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    file_name: { type: String, required: true },
    file_url: { type: String, required: true },
    file_type: { type: String },
    ...auditFields
}, { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true, transform: toJSONTransform }
});
AttachmentSchema.index({ task_id: 1, user_id: 1, deleted_at: 1 });

const User = mongoose.model('User', UserSchema);
const Board = mongoose.model('Board', BoardSchema);
const List = mongoose.model('List', ListSchema);
const Task = mongoose.model('Task', TaskSchema);
const Attachment = mongoose.model('Attachment', AttachmentSchema);
const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

module.exports = { User, Board, List, Task, Attachment, RefreshToken };
