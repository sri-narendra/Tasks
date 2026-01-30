# Production Backup & Restore Strategy (MongoDB)

This document outlines the strategy for ensuring data durability and recovery for the SaaS Task Application.

## 1. Automated Backups (Atlas Recommended)
Since the application uses MongoDB, it is highly recommended to use **MongoDB Atlas** for managed backups:
- **Continuous Backups**: Enable Point-in-Time Recovery (PITR).
- **Snapshot Schedules**: 
  - Daily: Retained for 30 days.
  - Weekly: Retained for 3 months.
  - Monthly: Retained for 1 year.

## 2. Manual Backup (Self-Managed)
If running on a self-managed MongoDB instance, use `mongodump`:

### Backup Command
```bash
mongodump --uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>" --out="./backups/$(date +%Y-%m-%d)"
```

### Restore Command
```bash
mongorestore --uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>" ./backups/<folder_name>
```

## 3. Disaster Recovery (DR) Plan
1. **Detection**: Health check alerts (/health) trigger via Render/Datadog.
2. **Analysis**: Check MongoDB connection status and logs.
3. **Restoration**: 
   - Identify the last known good snapshot (typically < 24h old).
   - Restore to a new cluster if original is corrupted.
   - Update `MONGODB_URI` in Render and redeploy.
4. **Verification**: Run sanity tests (`npm test` in backend) after restoration.

## 4. Security
- Backup files MUST be encrypted at rest (S3 bucket with SSE-KMS).
- Access to backups is restricted to Lead DevOps only.
- Backups are stored in a different region than the production environment (cross-region replication).
