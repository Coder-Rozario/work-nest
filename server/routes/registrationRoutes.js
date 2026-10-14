const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { registerCompany, loginUser } = require('../controllers/registrationController');

const registrationValidation = [
    body('company_name')
        .trim()
        .notEmpty().withMessage('Company name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Company name must be between 2-100 characters'),
    
    body('company_size')
        .notEmpty().withMessage('Company size is required'),
    
    body('industry')
        .notEmpty().withMessage('Industry is required'),
    
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),
    
    body('work_email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter'),
    
    body('confirm_password')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    
    body('agree_to_terms')
        .isBoolean().withMessage('Must agree to terms')
        .custom(value => value === true).withMessage('You must agree to the Terms of Service')
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
];

router.post('/register', registrationValidation, registerCompany);
router.post('/login', loginValidation, loginUser);

module.exports = router;