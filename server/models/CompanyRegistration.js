const db = require('../config/database');

class CompanyRegistration {

    static async create(registrationData) {
        const { 
                    company_name, 
                    company_size, 
                    industry, 
                    full_name, 
                    work_email, 
                    password_hash,
                    agree_to_terms 
                } = registrationData;


            const [result] = await db.query(
                `INSERT INTO company_registrations 
                (company_name, company_size, industry, full_name, work_email, password_hash, agree_to_terms) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [company_name, company_size, industry, full_name, work_email, password_hash, agree_to_terms]
            );
            
            return result.insertId;
        }

        static async findByEmail(email) {
            const [rows] = await db.query(
                'SELECT * FROM company_registrations WHERE work_email = ?',
                [email]
            );
            return rows[0];
        }
        static async findById(id) {
            const [rows] = await db.query(
                'SELECT * FROM company_registrations WHERE id = ?',
                [id]
            );
            return rows[0];
        }
}

module.exports = CompanyRegistration;