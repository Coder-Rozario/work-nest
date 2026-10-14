const db = require('../config/database');

class UserLogin {
    static async create({ company_id, email, password_hash, role = 'admin' }) {
        const [result] = await db.query(
            `INSERT INTO user_login (company_id, email, password_hash, role) VALUES (?, ?, ?, ?)
            `,
            [company_id, email, password_hash, role]
        );

        return result.insertId;
    }

    static async findByEmail(email) {
        const [rows] = await db.query(
            'SELECT * FROM user_login WHERE email = ?',
            [email]
        );

        return rows[0];
    }
}

module.exports = UserLogin;
