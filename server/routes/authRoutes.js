const express = require('express');
const { body } = require('express-validator');
const { registerUser, loginUser, getCurrentUser, changePassword, requestPasswordReset, verifyResetCode } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const registerValidation = [
  body('company_name').trim().notEmpty().withMessage('Company name is required.'),
  body('industry').trim().notEmpty().withMessage('Industry is required.'),
  body('company_size').trim().notEmpty().withMessage('Company size is required.'),
  body('full_name').trim().notEmpty().withMessage('Full name is required.'),
  body('work_email').trim().isEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const forgotPasswordValidation = [
  body('name').trim().notEmpty().withMessage('Full name is required.'),
  body('email').trim().isEmail().withMessage('Valid email is required.'),
  body('position').trim().notEmpty().withMessage('Position is required.'),
];

const verifyResetCodeValidation = [
  body('name').trim().notEmpty().withMessage('Full name is required.'),
  body('email').trim().isEmail().withMessage('Valid email is required.'),
  body('position').trim().notEmpty().withMessage('Position is required.'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('A 6-digit verification code is required.'),
];

const changePasswordValidation = [
  body('current_password').notEmpty().withMessage('Current password is required.'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.'),
];

router.post('/register', registerValidation, registerUser);
router.post('/login', loginValidation, loginUser);
router.post('/forgot-password', forgotPasswordValidation, requestPasswordReset);
router.post('/verify-reset-code', verifyResetCodeValidation, verifyResetCode);
router.get('/me', authMiddleware, getCurrentUser);
router.put('/change-password', authMiddleware, changePasswordValidation, changePassword);

module.exports = router;
