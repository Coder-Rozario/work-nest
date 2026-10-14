const mysql = require('mysql2');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_HOST = String(process.env.DB_HOST || '').trim();
const DB_USER = String(process.env.DB_USER || '').trim();
const DB_NAME = String(process.env.DB_NAME || '').trim();
const DB_PASSWORD = String(process.env.DB_PASSWORD || '');

if (!DB_HOST || !DB_USER || !DB_NAME) {
  throw new Error('Missing database configuration in server/.env');
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

const promisePool = pool.promise();

const ensureUserTableColumns = async () => {
  const [columns] = await promisePool.query('SHOW COLUMNS FROM users');
  const columnNames = (columns || []).map((column) => column.Field);

  if (!columnNames.includes('full_name') && columnNames.includes('first_name')) {
    await promisePool.query(`
      UPDATE users
      SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
      WHERE TRIM(COALESCE(full_name, '')) = ''
    `);
    await promisePool.query("ALTER TABLE users CHANGE first_name full_name VARCHAR(150) NOT NULL DEFAULT ''");
  }

  if (!columnNames.includes('full_name')) {
    await promisePool.query("ALTER TABLE users ADD COLUMN full_name VARCHAR(150) NOT NULL DEFAULT ''");
  }

  if (columnNames.includes('last_name')) {
    await promisePool.query('ALTER TABLE users DROP COLUMN last_name');
  }

  if (!columnNames.includes('password_hash')) {
    await promisePool.query("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''");
  }

  if (!columnNames.includes('failed_login_attempts')) {
    await promisePool.query("ALTER TABLE users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0");
  }

  if (!columnNames.includes('locked_until')) {
    await promisePool.query("ALTER TABLE users ADD COLUMN locked_until DATETIME NULL");
  }
};

const ensureDatabaseTables = async () => {
  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(150) NOT NULL,
      industry VARCHAR(100) NOT NULL,
      company_size VARCHAR(100) NOT NULL,
      created_by_email VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'manager', 'employee') NOT NULL DEFAULT 'employee',
      position VARCHAR(100) DEFAULT '',
      team_id INT DEFAULT NULL,
      profile_photo VARCHAR(500) DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_company_email (company_id, email),
      KEY idx_company_id (company_id),
      KEY idx_role (role),
      CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500) DEFAULT ''
  `);

  await ensureUserTableColumns();

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) DEFAULT '',
      leader_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_company_team (company_id, name),
      CONSTRAINT fk_teams_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT fk_teams_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    ALTER TABLE teams
      ADD COLUMN IF NOT EXISTS leader_id INT DEFAULT NULL AFTER description
  `);

  try {
    await promisePool.query(`
      ALTER TABLE teams
        ADD CONSTRAINT fk_teams_leader
        FOREIGN KEY (leader_id) REFERENCES users(id)
        ON DELETE SET NULL
    `);
  } catch (error) {
    if (!String(error.message).includes('Duplicate key') && !String(error.message).includes('already exists')) {
      throw error;
    }
  }

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      team_name VARCHAR(150) DEFAULT NULL,
      start_date DATE DEFAULT NULL,
      due_date DATE DEFAULT NULL,
      progress INT NOT NULL DEFAULT 0,
      priority VARCHAR(30) NOT NULL DEFAULT 'Medium',
      project_type VARCHAR(60) NOT NULL DEFAULT 'Internal',
      status VARCHAR(50) DEFAULT 'To Do',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_company_id (company_id),
      CONSTRAINT fk_projects_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT fk_projects_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      project_name VARCHAR(150) DEFAULT '',
      assignee_id INT DEFAULT NULL,
      priority VARCHAR(30) DEFAULT 'Medium',
      due_date DATE DEFAULT NULL,
      status VARCHAR(40) DEFAULT 'Assigned',
      progress INT DEFAULT 0,
      progress_note TEXT,
      description TEXT,
      submission_description TEXT,
      submission_url VARCHAR(500) DEFAULT '',
      submitted_at TIMESTAMP NULL,
      manager_feedback TEXT,
      review_comment TEXT,
      reviewed_by INT DEFAULT NULL,
      approved_at TIMESTAMP NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_company_id (company_id),
      KEY idx_assignee (assignee_id),
      CONSTRAINT fk_tasks_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_tasks_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS submission_files TEXT DEFAULT ''
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      meeting_date DATE NOT NULL,
      meeting_time TIME NOT NULL,
      organizer_name VARCHAR(150) NOT NULL,
      participant_count INT NOT NULL DEFAULT 1,
      meeting_link VARCHAR(500) DEFAULT '',
      status VARCHAR(30) DEFAULT 'Upcoming',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_meetings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT fk_meetings_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS meeting_attendees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      user_id INT NOT NULL,
      invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      response_status VARCHAR(30) DEFAULT 'pending',
      UNIQUE KEY unique_meeting_user (meeting_id, user_id),
      CONSTRAINT fk_meeting_attendees_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      CONSTRAINT fk_meeting_attendees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NOT NULL,
      task_id INT DEFAULT NULL,
      check_in DATETIME DEFAULT NULL,
      check_out DATETIME DEFAULT NULL,
      note TEXT,
      duration_minutes INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_company_id (company_id),
      KEY idx_user_id (user_id),
      CONSTRAINT fk_time_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT fk_time_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_time_logs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      content TEXT,
      encrypted_text TEXT,
      nonce VARCHAR(255) DEFAULT '',
      key_version VARCHAR(30) DEFAULT 'v1',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_reset_email (email),
      KEY idx_reset_user (user_id),
      CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NOT NULL,
      email VARCHAR(255) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      address VARCHAR(255) DEFAULT '',
      office_start VARCHAR(10) DEFAULT '09:00',
      office_end VARCHAR(10) DEFAULT '17:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

module.exports = {
  promisePool,
  query: (...args) => promisePool.query(...args),
  ensureDatabaseTables,
  dbName: DB_NAME,
};