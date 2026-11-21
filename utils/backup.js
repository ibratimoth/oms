// const { exec } = require('child_process');
// const path = require('path');
// const fs = require('fs');
// const cron = require('node-cron');
// require('dotenv').config();

// // Custom Target Directory on D: Drive
// const backupDir = 'D:\\NIDC\\delleomsbackup';

// // Ensure the directory exists
// if (!fs.existsSync(backupDir)) {
//   fs.mkdirSync(backupDir, { recursive: true });
// }

// // Helper: Check if a backup was already created today
// function hasBackedUpToday() {
//   const todayPrefix = `pg_backup_${new Date().toISOString().split('T')[0]}`;
//   try {
//     const files = fs.readdirSync(backupDir);
//     return files.some((file) => file.startsWith(todayPrefix));
//   } catch (err) {
//     return false;
//   }
// }

// // Function to clean up backups older than 30 days
// function cleanOldBackups() {
//   const retentionDays = 30;
//   const now = Date.now();

//   fs.readdir(backupDir, (err, files) => {
//     if (err) return;

//     files.forEach((file) => {
//       if (file.endsWith('.dump')) {
//         const filePath = path.join(backupDir, file);

//         fs.stat(filePath, (statErr, stats) => {
//           if (statErr) return;

//           const fileAgeInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
//           if (fileAgeInDays > retentionDays) {
//             fs.unlink(filePath, (unlinkErr) => {
//               if (!unlinkErr) {
//                 console.log(`[PG BACKUP CLEANUP]: Removed old backup file: ${file}`);
//               }
//             });
//           }
//         });
//       }
//     });
//   });
// }

// function runBackup() {
//   const now = new Date();
//   const timestamp = now.toISOString().replace(/[:.]/g, '-');
//   const filename = `pg_backup_${timestamp}.dump`;
//   const filePath = path.join(backupDir, filename);

//   // Database Credentials
//   const dbUser = process.env.DB_USER || 'postgres';
//   const dbHost = process.env.DB_HOST || 'localhost';
//   const dbName = process.env.DB_NAME || 'delle_ventures_oms';
//   const dbPassword = process.env.DB_PASSWORD || '2001!';

//   // Path to PostgreSQL 18 pg_dump.exe
//   const pgDumpPath = `"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"`;

//   const command = `${pgDumpPath} -h ${dbHost} -U ${dbUser} -d ${dbName} -F c -b -v -f "${filePath}"`;

//   exec(command, { env: { ...process.env, PGPASSWORD: dbPassword } }, (error, stdout, stderr) => {
//     if (error) {
//       console.error(`[PG BACKUP ERROR]: ${error.message}`);
//       return;
//     }
//     console.log(`[PG BACKUP SUCCESS]: File created at ${filePath}`);
//     cleanOldBackups();
//   });
// }

// // 1. Scheduled to run every day at 19:00 (7:00 PM)
// cron.schedule('0 19 * * *', () => {
//   console.log('Starting scheduled daily PostgreSQL backup at 19:00...');
//   runBackup();
// });

// // 2. Catch-Up Check: Run on boot/wake if today's backup is missing
// function checkAndRunMissedBackup() {
//   if (!hasBackedUpToday()) {
//     console.log('[PG BACKUP CATCH-UP]: Missed today\'s scheduled backup (PC was asleep/off). Running backup now...');
//     runBackup();
//   } else {
//     console.log('[PG BACKUP CATCH-UP]: Today\'s backup already exists. No catch-up needed.');
//   }
// }

// // Execute catch-up check immediately when server script loads
// checkAndRunMissedBackup();

// module.exports = { runBackup };


const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

// Target directory on Linux server
const backupDir = process.env.BACKUP_DIR || '/var/backups/delleoms';
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);

// Ensure the directory exists
fs.mkdirSync(backupDir, { recursive: true });

let isBackingUp = false;

// Helper: Check if a backup was already created today (UTC date prefix, matching filename)
function hasBackedUpToday() {
  const todayPrefix = `pg_backup_${new Date().toISOString().split('T')[0]}`;
  try {
    const files = fs.readdirSync(backupDir);
    return files.some((file) => file.startsWith(todayPrefix) && file.endsWith('.dump'));
  } catch (err) {
    console.error('[PG BACKUP CHECK ERROR]:', err.message);
    return false;
  }
}

// Function to clean up backups older than retentionDays
function cleanOldBackups() {
  const now = Date.now();

  fs.readdir(backupDir, (err, files) => {
    if (err) {
      console.error('[PG BACKUP CLEANUP READ ERROR]:', err.message);
      return;
    }

    files.forEach((file) => {
      if (file.endsWith('.dump')) {
        const filePath = path.join(backupDir, file);

        fs.stat(filePath, (statErr, stats) => {
          if (statErr) return;

          const fileAgeInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
          if (fileAgeInDays > retentionDays) {
            fs.unlink(filePath, (unlinkErr) => {
              if (!unlinkErr) {
                console.log(`[PG BACKUP CLEANUP]: Removed old backup file: ${file}`);
              }
            });
          }
        });
      }
    });
  });
}

function runBackup() {
  if (isBackingUp) {
    console.log('[PG BACKUP SKIPPED]: A backup is already in progress.');
    return;
  }

  const dbUser = process.env.DB_USER;
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME;
  const dbPassword = process.env.DB_PASSWORD;

  if (!dbUser || !dbName || !dbPassword) {
    console.error('[PG BACKUP ERROR]: Missing DB_USER, DB_NAME, or DB_PASSWORD in environment.');
    return;
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `pg_backup_${timestamp}.dump`;
  const filePath = path.join(backupDir, filename);

  // Use PG_DUMP_PATH in .env if needed (e.g., /usr/lib/postgresql/16/bin/pg_dump), otherwise 'pg_dump'
  const pgDumpPath = process.env.PG_DUMP_PATH || 'pg_dump';
  const command = `"${pgDumpPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -Fc -b -v -f "${filePath}"`;

  isBackingUp = true;
  console.log(`[PG BACKUP START]: Backing up "${dbName}" from ${dbHost}:${dbPort} to ${filePath}...`);

  exec(
    command,
    {
      env: { ...process.env, PGPASSWORD: dbPassword },
      maxBuffer: 1024 * 1024 * 20, // 20 MB buffer for verbose pg_dump stderr output
    },
    (error, stdout, stderr) => {
      isBackingUp = false;

      if (error) {
        console.error(`[PG BACKUP ERROR]: ${error.message}`);
        if (stderr) console.error(`[PG BACKUP STDERR]: ${stderr.trim()}`);
        return;
      }

      console.log(`[PG BACKUP SUCCESS]: File created at ${filePath}`);
      cleanOldBackups();
    }
  );
}

// 1. Scheduled to run every day at 19:00 (server local time)
cron.schedule('0 19 * * *', () => {
  console.log('Starting scheduled daily PostgreSQL backup at 19:00...');
  runBackup();
});

// 2. Catch-Up Check: Run on startup if today's backup is missing
function checkAndRunMissedBackup() {
  if (!hasBackedUpToday()) {
    console.log("[PG BACKUP CATCH-UP]: Today's backup is missing. Running backup now...");
    runBackup();
  } else {
    console.log("[PG BACKUP CATCH-UP]: Today's backup already exists. No catch-up needed.");
  }
}

checkAndRunMissedBackup();

module.exports = { runBackup };