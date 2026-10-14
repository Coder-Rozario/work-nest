const CompanyRegistration = require('../models/CompanyRegistration');
const UserLogin = require('../models/UserLogin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');


const registerCompany = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { 
            company_name, 
            company_size, 
            industry, 
            full_name, 
            work_email, 
            password,
            agree_to_terms 
        } = req.body;

        const existingUser = await CompanyRegistration.findByEmail(work_email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

      
        const registrationData = {
            company_name,
            company_size,
            industry,
            full_name,
            work_email,
            password_hash,
            agree_to_terms: agree_to_terms ? 1 : 0
        };

    
        const companyId = await CompanyRegistration.create(registrationData);

        await UserLogin.create({
            company_id: companyId,
            email: work_email,
            password_hash,
            role: 'admin'
        });

    
        const token = jwt.sign(
            { 
                id: companyId, 
                email: work_email,
                company_name: company_name,
                role: 'admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );


        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token: token,
            user: {
                id: companyId,
                name: full_name,
                email: work_email,
                company: company_name,
                role: 'admin'
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

const loginUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        const user = await UserLogin.findByEmail(normalizedEmail);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                company_id: user.company_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const company = await CompanyRegistration.findById(user.company_id);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                company_id: user.company_id,
                company_name: company?.company_name || '',
                name: company?.full_name || ''
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

module.exports = {
    registerCompany,
    loginUser
};