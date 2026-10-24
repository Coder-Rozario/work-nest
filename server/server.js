const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const authMiddleware = require('./middleware/auth');
const { ensureDatabaseTables } = require('./config/database');
const path = require('path');
const { uploadProfilePhoto } = require('./utils/upload');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const managerRoutes = require('./routes/managerRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const messageRoutes = require('./routes/messageRoutes');
const projectRoutes = require('./routes/projectRoutes');
const timeAttendanceRoutes = require('./routes/timeAttendanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const realtimeBroadcast = require('./middleware/realtimeBroadcast');


const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);


app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // static


app.get('/api/health', (req, res) => {
  // health
  res.status(200).json({ success: true, message: 'Server is running.' });
});

app.use(realtimeBroadcast); // broadcast write operations to connected clients

app.use('/api/realtime', realtimeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/manager', authMiddleware, managerRoutes);
app.use('/api/employee', authMiddleware, employeeRoutes);
app.use('/api/meetings', authMiddleware, meetingRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/time-attendance', authMiddleware, timeAttendanceRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.post('/api/users/profile-photo', authMiddleware, uploadProfilePhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      // guard
      return res.status(400).json({ success: false, message: 'Profile photo is required.' });
    }

    const { getCompanyUploadUrl } = require('./utils/upload');
    const relativePath = getCompanyUploadUrl(req.user, req.file.filename); // path

    await require('./config/database').query(
      'UPDATE users SET profile_photo = ? WHERE id = ? AND company_id = ?',
      [relativePath, req.user.id, req.user.company_id]
    ); // save

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully.',
      data: {
        profile_photo: relativePath,
      },
    });
  } catch (error) {
    // fail
    console.error('Upload profile image error:', error);
    res.status(500).json({ success: false, message: 'Could not upload profile photo.' });
  }
});


app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
});

const startServer = async () => {
    try {
        await ensureDatabaseTables();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();