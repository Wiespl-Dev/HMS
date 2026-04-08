const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { networkInterfaces } = require('os');
const http = require('http');
const PDFDocument = require('pdfkit');
const app = express();
const PORT = 3000;

// ==================== CORS MUST BE FIRST - BEFORE ANYTHING ELSE ====================
// Get local IP for mobile access
function getLocalIP() {
    const nets = networkInterfaces();
    const results = [];
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                results.push(net.address);
            }
        }
    }
    return results.length > 0 ? results[0] : 'localhost';
}

const LOCAL_IP = getLocalIP();

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', `http://${LOCAL_IP}:3000`, `http://${LOCAL_IP}:3000`],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// ==================== BODY PARSERS ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== STATIC FILES ====================
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// Serve FontAwesome icons from local installation
app.use('/fa-icons', express.static('C:/Users/swapnil/fontawesome-free-7.1.0-desktop/svgs/solid'));

// Serve FontAwesome icons with proper routing
app.get('/fa-icons/:iconName', (req, res) => {
    const iconName = req.params.iconName;
    const fontAwesomePath = 'C:/Users/swapnil/fontawesome-free-7.1.0-desktop';
    
    const possiblePaths = [
        path.join(fontAwesomePath, 'svgs', 'solid', `${iconName}.svg`),
        path.join(fontAwesomePath, 'svgs', 'regular', `${iconName}.svg`),
        path.join(fontAwesomePath, 'svgs', 'brands', `${iconName}.svg`),
        path.join(fontAwesomePath, 'svgs-solid', `${iconName}.svg`),
        path.join(fontAwesomePath, 'solid', `${iconName}.svg`)
    ];
    
    let foundPath = null;
    for (const iconPath of possiblePaths) {
        if (fs.existsSync(iconPath)) {
            foundPath = iconPath;
            break;
        }
    }
    
    if (foundPath) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.sendFile(foundPath);
    } else {
        console.log(`Icon not found: ${iconName}`);
        res.status(404).json({ 
            error: 'Icon not found',
            requested: iconName,
            searched_paths: possiblePaths
        });
    }
});

// Test endpoint for icons
app.get('/api/test-icons', (req, res) => {
    const testIcons = [
        'hospital', 'user-injured', 'chart-simple', 'clipboard-list', 'store',
        'database', 'shield', 'people-group', 'key', 'door-open', 'bars',
        'plus', 'eye', 'trash', 'save', 'check', 'cogs', 'calendar-plus',
        'file-medical', 'cloud-upload-alt', 'shopping-cart', 'bell', 'file',
        'download', 'id-card', 'tint', 'venus-mars', 'allergies', 'pills',
        'shield-alt', 'boxes', 'user-md', 'stethoscope', 'hospital-alt',
        'music', 'play', 'upload', 'video','broom','checklist','total','storage','calender','shedule'
    ];
    
    const protocol = req.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${req.get('host')}`;
    const testUrls = testIcons.map(icon => ({
        name: icon,
        url: `${baseUrl}/fa-icons/${icon}`,
        test_url: `${baseUrl}/fa-icons/${icon}`
    }));
    
    res.json({
        message: 'FontAwesome Icon Test',
        fontawesome_path: 'C:/Users/swapnil/fontawesome-free-7.1.0-desktop',
        test_urls: testUrls,
        instructions: 'Visit the URLs above to test if icons load correctly'
    });
});

// ==================== FILE UPLOAD CONFIGURATION ====================

// Configure multer for patient file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/patients';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const patientId = req.body.patient_id || 'temp';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, patientId + '-' + uniqueSuffix + '-' + safeName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const allowedExtensions = ['.dcm'];

    const fileExt = path.extname(file.originalname).toLowerCase();

    if (
        file.mimetype.startsWith('image/') ||
        allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.includes(fileExt)
    ) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: Images, PDF, DOC, DOCX, DICOM (.dcm)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

// Configure multer for music uploads
const musicStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/music';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `music-${uniqueSuffix}-${safeName}`);
    }
});

const musicUpload = multer({
    storage: musicStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    },
    limits: {
        fileSize: 60 * 1024 * 1024
    }
});

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/videos';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `video-${uniqueSuffix}-${safeName}`);
    }
});

const videoUpload = multer({
    storage: videoStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    },
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1GB
    }
});

// Configure multer for clean report photos
const cleanReportStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/clean-reports';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `clean-report-${uniqueSuffix}-${safeName}`);
    }
});

const cleanReportUpload = multer({
    storage: cleanReportStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// Create uploads directories if they don't exist
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads', { recursive: true });
}
if (!fs.existsSync('./uploads/patients')) {
    fs.mkdirSync('./uploads/patients', { recursive: true });
}
if (!fs.existsSync('./uploads/protocols')) {
    fs.mkdirSync('./uploads/protocols', { recursive: true });
}
if (!fs.existsSync('./uploads/music')) {
    fs.mkdirSync('./uploads/music', { recursive: true });
}
if (!fs.existsSync('./uploads/videos')) {
    fs.mkdirSync('./uploads/videos', { recursive: true });
}
if (!fs.existsSync('./uploads/clean-reports')) {
    fs.mkdirSync('./uploads/clean-reports', { recursive: true });
}
if (!fs.existsSync('./uploads/clean-reports/pdfs')) {
    fs.mkdirSync('./uploads/clean-reports/pdfs', { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));
app.use('/uploads/clean-reports', express.static('uploads/clean-reports'));
app.use('/uploads/music', express.static('uploads/music'));
app.use('/uploads/videos', express.static('uploads/videos'));

// ==================== DATABASE INITIALIZATION ====================

let db;

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database('./hospital_management.db', (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                reject(err);
                return;
            }
            
            console.log('Connected to SQLite database');
            
            database.run('PRAGMA foreign_keys = ON');
            database.run('PRAGMA journal_mode = WAL');
            database.run('PRAGMA busy_timeout = 5000');
            database.run('PRAGMA cache_size = 10000');
            
            resolve(database);
        });
        
        database.on('error', (err) => {
            console.error('Database error:', err);
        });
    });
}

// Helper function to log activities
function logActivity(user, action, details) {
    const username = user || 'System';
    
    db.run(
        "INSERT INTO activities (user, action, details) VALUES (?, ?, ?)",
        [username, action, details],
        (err) => {
            if (err) console.error('Error logging activity:', err);
        }
    );
}

// Utility function for database error handling
function handleDatabaseError(err, res, customMessage = 'Database error') {
    console.error(`${customMessage}:`, err);
    
    if (err.code === 'SQLITE_ERROR' && err.message.includes('no such table')) {
        return res.status(503).json({ 
            error: 'Database table not ready yet',
            message: 'Please wait a moment and try again'
        });
    }
    
    res.status(500).json({ error: err.message });
}

// Function to add MRD column if not exists
function addMRDColumn() {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(patients)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            const hasMRDColumn = columns.some(col => col.name === 'mrd_number');
            
            if (!hasMRDColumn) {
                console.log('Adding MRD column to patients table...');
                
                db.run("ALTER TABLE patients ADD COLUMN mrd_number TEXT", (err) => {
                    if (err) {
                        console.error('Error adding MRD column:', err);
                        reject(err);
                        return;
                    }
                    console.log('✓ MRD column added (no unique constraint — same MRD allowed for multiple surgeries)');
                    resolve();
                });
            } else {
                // Drop any existing UNIQUE index on mrd_number so same MRD
                // can be reused for a patient's second surgery
                db.run("DROP INDEX IF EXISTS idx_patients_mrd_unique", (err) => {
                    if (err) {
                        console.warn('Could not drop mrd unique index (may not exist):', err.message);
                    } else {
                        console.log('✓ MRD unique index removed — multiple surgeries per MRD now allowed');
                    }
                    resolve();
                });
            }
        });
    });
}

// Function to update table schema with missing columns
function updateTableSchema() {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(patients)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            const columnNames = columns.map(col => col.name);
            
            const requiredColumns = [
                'patient_category',
                'emergency_name', 
                'emergency_relation',
                'operation_ot', 
                'operation_doctor_role',
                'allergies', 
                'medications', 
                'medical_history', 
                'insurance',
                'insurance_id', 
                'operation_date', 
                'operation_time', 
                'operation_doctor',
                'operation_notes', 
                'eye', 
                'eye_condition', 
                'eye_surgery', 
                'vision_left', 
                'vision_right',
                'lab_name',
                'lab_registration',
                'gram_swab',
                'emr_number',
                'physician',
                'investigation_date',
                'blood_group',
                'bcva_left',
                'bcva_right',
                'specular_left',
                'specular_right',
                'cataract_type_left',
                'cataract_type_right',
                'fundus_view_left',
                'fundus_view_right',
                'pupil_dilation_left',
                'pupil_dilation_right',
                'iop_left',
                'iop_right',
                'diagnosis',
                'oct',
                'argas',
                'pentacam',
                'bscan',
                'medical_fitness',
                'ecg',
                'bt',
                'ct',
                'conj_swab',
                'verified_by',
                'verification_date',
                'verification_time',
                'signature',
                'intraop_notes',
                'postop_instructions',
                'checklist',
                'pdf_path',
                'reports_pdf_path',
                'fundus_view_notes',
                'cataract_re_text'
            ];
            
            const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
            
            if (missingColumns.length > 0) {
                console.log('Updating patients table structure...');
                console.log('Missing columns:', missingColumns);
                
                let completed = 0;
                
                missingColumns.forEach(column => {
                    const alterSql = `ALTER TABLE patients ADD COLUMN ${column} TEXT`;
                    db.run(alterSql, (err) => {
                        if (err) {
                            console.error(`Error adding column ${column}:`, err);
                        } else {
                            console.log(`✓ Added column: ${column}`);
                        }
                        
                        completed++;
                        
                        if (completed === missingColumns.length) {
                            console.log('Patients table updated successfully');
                            resolve();
                        }
                    });
                });
            } else {
                console.log('Patients table structure is up to date');
                resolve();
            }
        });
    });
}

// Create all tables
async function createTables() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Create patients table with all fields
                db.run(`CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT UNIQUE NOT NULL,
                    mrd_number TEXT NOT NULL,
                    patient_category TEXT,
                    name TEXT NOT NULL,
                    age INTEGER,
                    gender TEXT,
                    phone TEXT,
                    email TEXT,
                    address TEXT,
                    emergency_contact TEXT,
                    emergency_name TEXT,
                    emergency_relation TEXT,
                    allergies TEXT,
                    medications TEXT,
                    medical_history TEXT,
                    insurance TEXT,
                    insurance_id TEXT,
                    
                    -- Lab and identification fields
                    lab_name TEXT,
                    lab_registration TEXT,
                    gram_swab TEXT,
                    emr_number TEXT,
                    physician TEXT,
                    investigation_date TEXT,
                    blood_group TEXT,
                    
                    -- Eye examination fields
                    eye TEXT,
                    eye_condition TEXT,
                    eye_surgery TEXT,
                    vision_left TEXT,
                    vision_right TEXT,
                    bcva_left TEXT,
                    bcva_right TEXT,
                    specular_left TEXT,
                    specular_right TEXT,
                    cataract_type_left TEXT,
                    cataract_type_right TEXT,
                    fundus_view_left TEXT,
                    fundus_view_right TEXT,
                    pupil_dilation_left TEXT,
                    pupil_dilation_right TEXT,
                    iop_left TEXT,
                    iop_right TEXT,
                    diagnosis TEXT,
                    
                    -- Special investigations
                    oct TEXT,
                    argas TEXT,
                    pentacam TEXT,
                    bscan TEXT,
                    
                    -- Medical fitness
                    medical_fitness TEXT,
                    ecg TEXT,
                    bt TEXT,
                    ct TEXT,
                    conj_swab TEXT,
                    
                    -- Operation details
                    operation_ot TEXT,
                    operation_date TEXT,
                    operation_time TEXT,
                    operation_doctor TEXT,
                    operation_doctor_role TEXT,
                    operation_notes TEXT,
                    
                    -- Verification fields
                    verified_by TEXT,
                    verification_date TEXT,
                    verification_time TEXT,
                    signature TEXT,
                    intraop_notes TEXT,
                    postop_instructions TEXT,
                    
                    -- Checklist JSON (stores all other data)
                    checklist TEXT,
                    pdf_path TEXT,             
                    reports_pdf_path TEXT,   
    
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, async (err) => {
                    if (err) {
                        console.error('Error creating patients table:', err);
                        reject(err);
                        return;
                    }
                    
                    console.log('✓ Patients table created');
                    
                    try {
                        await updateTableSchema();
                        await addMRDColumn();
                    } catch (error) {
                        console.error('Error during schema update:', error);
                    }
                });

                // Create patient_reports table
                db.run(`CREATE TABLE IF NOT EXISTS patient_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    file_size INTEGER,
                    file_type TEXT,
                    upload_date DATETIME DEFAULT (datetime('now', 'localtime')),
                    description TEXT,
                    FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('Error creating patient_reports table:', err);
                    } else {
                        console.log('✓ Patient Reports table ready');
                    }
                });

                // Create patient_biometry table
                db.run(`CREATE TABLE IF NOT EXISTS patient_biometry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT NOT NULL,
                    eye TEXT CHECK(eye IN ('left', 'right')) NOT NULL,
                    al TEXT,
                    k1 TEXT,
                    k2 TEXT,
                    cyl TEXT,
                    acd TEXT,
                    lt TEXT,
                    cct TEXT,
                    wtw TEXT,
                    aconstant TEXT,
                    iol_power TEXT,
                    iol_category TEXT,
                    iol_manufacturer TEXT,
                    target_refraction TEXT,
                    measurement_date TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('Error creating biometry table:', err);
                    } else {
                        console.log('✓ Patient Biometry table ready');
                    }
                });

                // Create patient_surgical_aids table
                db.run(`CREATE TABLE IF NOT EXISTS patient_surgical_aids (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT NOT NULL,
                    surgery_date TEXT,
                    viscoat TEXT,
                    bhex_ring TEXT,
                    ctr_ring TEXT,
                    toric_sheet TEXT,
                    other_aids TEXT,
                    special_requirements TEXT,
                    access_required TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('Error creating surgical aids table:', err);
                    } else {
                        console.log('✓ Patient Surgical Aids table ready');
                    }
                });

                // Create patient_lab_results table
                db.run(`CREATE TABLE IF NOT EXISTS patient_lab_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT NOT NULL,
                    test_category TEXT NOT NULL,
                    test_name TEXT NOT NULL,
                    test_value TEXT,
                    test_unit TEXT,
                    test_date TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('Error creating lab results table:', err);
                    } else {
                        console.log('✓ Patient Lab Results table ready');
                    }
                });

                // Create items table
                db.run(`CREATE TABLE IF NOT EXISTS items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    category TEXT,
                    quantity INTEGER DEFAULT 0,
                    min_stock INTEGER DEFAULT 10,
                    price REAL DEFAULT 0,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating items table:', err);
                    } else {
                        console.log('✓ Items table ready');
                    }
                });

                // Create orders table
                db.run(`CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER,
                    item_name TEXT,
                    ot_name TEXT,
                    quantity INTEGER,
                    urgency TEXT CHECK(urgency IN ('low', 'medium', 'high', 'critical')),
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating orders table:', err);
                    } else {
                        console.log('✓ Orders table ready');
                    }
                });

                // Create activities table
                db.run(`CREATE TABLE IF NOT EXISTS activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user TEXT,
                    action TEXT,
                    details TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating activities table:', err);
                    } else {
                        console.log('✓ Activities table ready');
                    }
                });

                // Create roles table
                db.run(`CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role_id TEXT UNIQUE NOT NULL,
                    role_name TEXT NOT NULL,
                    permissions TEXT,
                    description TEXT,
                    user_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating roles table:', err);
                    } else {
                        console.log('✓ Roles table ready');
                    }
                });

                // Create users table
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role_id TEXT NOT NULL,
                    full_name TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (role_id) REFERENCES roles (role_id)
                )`, (err) => {
                    if (err) {
                        console.error('Error creating users table:', err);
                    } else {
                        console.log('✓ Users table ready');
                    }
                });

                // Create master_data table
                db.run(`CREATE TABLE IF NOT EXISTS master_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    value TEXT NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    UNIQUE(category, value)
                )`, (err) => {
                    if (err) {
                        console.error('Error creating master_data table:', err);
                    } else {
                        console.log('✓ Master Data table ready');
                    }
                });

                // Create music_files table
                db.run(`CREATE TABLE IF NOT EXISTS music_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    file_size INTEGER,
                    file_type TEXT,
                    upload_date DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating music_files table:', err);
                    } else {
                        console.log('✓ Music Files table ready');
                    }
                });

                // Create videos table
                db.run(`CREATE TABLE IF NOT EXISTS videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    ot_name TEXT NOT NULL,
                    procedure_type TEXT,
                    surgeon TEXT,
                    procedure_date TEXT,
                    notes TEXT,
                    filename TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    file_size INTEGER,
                    file_type TEXT,
                    duration TEXT,
                    upload_date DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating videos table:', err);
                    } else {
                        console.log('✓ Videos table ready');
                    }
                });

                // Create clean_reports table
                db.run(`CREATE TABLE IF NOT EXISTS clean_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_id TEXT UNIQUE NOT NULL,
                    ot_name TEXT NOT NULL,
                    report_date TEXT NOT NULL,
                    report_time TEXT NOT NULL,
                    verified_by TEXT NOT NULL,
                    notes TEXT,
                    status TEXT NOT NULL,
                    next_check_date TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating clean_reports table:', err);
                    } else {
                        console.log('✓ Clean Reports table ready');
                    }
                });

                // Create clean_report_photos table
                db.run(`CREATE TABLE IF NOT EXISTS clean_report_photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    file_size INTEGER,
                    file_type TEXT,
                    upload_date DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (report_id) REFERENCES clean_reports (report_id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('Error creating clean_report_photos table:', err);
                    } else {
                        console.log('✓ Clean Report Photos table ready');
                    }
                });

                // Create ot_schedules table
                db.run(`CREATE TABLE IF NOT EXISTS ot_schedules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schedule_id TEXT UNIQUE NOT NULL,
                    patient_name TEXT NOT NULL,
                    mrd_number TEXT NOT NULL,
                    procedure_type TEXT NOT NULL,
                    surgeon TEXT NOT NULL,
                    ot_name TEXT NOT NULL,
                    schedule_date TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    status TEXT DEFAULT 'Scheduled',
                    notes TEXT,
                    created_by TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`, (err) => {
                    if (err) {
                        console.error('Error creating ot_schedules table:', err);
                    } else {
                        console.log('✓ OT Schedules table ready');
                    }
                });
                

                // Insert sample data on first run
                db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
                    if (err) {
                        console.error('Error checking sample data:', err);
                        resolve();
                        return;
                    }
                    
                    if (row && row.count === 0) {
                        console.log('Inserting sample data...');
                        
                        // Insert sample items
                        const sampleItems = [
                            ['Surgical Gloves', 'Disposables', 100, 20, 2.50],
                            ['Syringe 10ml', 'Disposables', 50, 10, 1.20],
                            ['Bandage', 'Dressings', 75, 15, 3.00],
                            ['Antiseptic Solution', 'Medicines', 30, 5, 8.50],
                            ['Surgical Mask', 'PPE', 200, 50, 0.75],
                            ['IV Set', 'Equipment', 25, 5, 12.00],
                            ['Cotton Swabs', 'Disposables', 150, 30, 0.50],
                            ['Pain Killers', 'Medicines', 60, 10, 5.25]
                        ];

                        const itemStmt = db.prepare("INSERT INTO items (name, category, quantity, min_stock, price) VALUES (?, ?, ?, ?, ?)");
                        sampleItems.forEach(item => itemStmt.run(item));
                        itemStmt.finalize();

                        // Insert sample roles
                        const sampleRoles = [
                            ['R001', 'Administrator', 'all', 'Full system access', 1],
                            ['R002', 'Doctor', 'dashboard_view,patient_view,patient_add,patient_edit,store_view,video_manage,ot_schedule', 'Manage patients, view inventory, and manage videos', 1],
                            ['R003', 'Nurse', 'dashboard_view,patient_view,order_place,ot_schedule', 'View patients and place store orders', 1],
                            ['R004', 'Store Manager', 'dashboard_view,store_view,store_manage,order_manage,ot_schedule', 'Full inventory control', 1],
                            ['R005', 'Lab Technician', 'dashboard_view,patient_view', 'Read-only patient access', 1],
                            ['R006', 'Receptionist', 'dashboard_view,patient_view,patient_add', 'Add new patients to the system', 1]
                        ];

                        const roleStmt = db.prepare("INSERT INTO roles (role_id, role_name, permissions, description, user_count) VALUES (?, ?, ?, ?, ?)");
                        sampleRoles.forEach(role => roleStmt.run(role));
                        roleStmt.finalize();

                        // Insert sample users
                        const sampleUsers = [
                            ['admin', '123', 'R001', 'Administrator'],
                            ['doctor', '123', 'R002', 'Doctor User'],
                            ['nurse', '123', 'R003', 'Nurse User'],
                            ['store', '123', 'R004', 'Store Manager'],
                            ['lab', '123', 'R005', 'Lab Technician'],
                            ['frontdesk', '123', 'R006', 'Receptionist']
                        ];

                        const userStmt = db.prepare("INSERT INTO users (username, password, role_id, full_name) VALUES (?, ?, ?, ?)");
                        sampleUsers.forEach(user => userStmt.run(user));
                        userStmt.finalize();

                        // Insert eye master data
                        const eyeMasterData = [
                            ['eye_condition', 'Normal', 1],
                            ['eye_condition', 'Cataract', 2],
                            ['eye_condition', 'Glaucoma', 3],
                            ['eye_condition', 'Retinal Disease', 4],
                            ['eye_condition', 'Corneal Disease', 5],
                            ['eye_condition', 'Diabetic Retinopathy', 6],
                            ['eye_condition', 'Macular Degeneration', 7],
                            ['eye_surgery', 'None', 1],
                            ['eye_surgery', 'Cataract Surgery', 2],
                            ['eye_surgery', 'LASIK', 3],
                            ['eye_surgery', 'Retinal Surgery', 4],
                            ['eye_surgery', 'Glaucoma Surgery', 5],
                            ['eye_surgery', 'Corneal Transplant', 6],
                            ['eye_surgery', 'Vitrectomy', 7]
                        ];
                        
                        const eyeMasterStmt = db.prepare("INSERT INTO master_data (category, value, display_order) VALUES (?, ?, ?)");
                        eyeMasterData.forEach(item => eyeMasterStmt.run(item));
                        eyeMasterStmt.finalize();

                        // Insert master data
                        const masterData = [
                            ['patient_category', 'General', 1],
                            ['patient_category', 'Insurance', 2],
                            ['patient_category', 'Government Scheme', 3],
                            ['patient_category', 'No Insurance', 4],
                            ['gender', 'Male', 1],
                            ['gender', 'Female', 2],
                            ['gender', 'Other', 3],
                            ['allergy', 'Penicillin', 1],
                            ['allergy', 'Latex', 2],
                            ['allergy', 'Peanuts', 3],
                            ['allergy', 'Shellfish', 4],
                            ['allergy', 'Dust', 5],
                            ['medication', 'Aspirin', 1],
                            ['medication', 'Ibuprofen', 2],
                            ['medication', 'Metformin', 3],
                            ['medication', 'Lisinopril', 4],
                            ['medication', 'Amoxicillin', 5],
                            ['insurance', 'Blue Cross', 1],
                            ['insurance', 'Aetna', 2],
                            ['insurance', 'Cigna', 3],
                            ['insurance', 'UnitedHealthcare', 4],
                            ['insurance', 'Medicare', 5],
                            ['category', 'Disposables', 1],
                            ['category', 'Dressings', 2],
                            ['category', 'Medicines', 3],
                            ['category', 'Equipment', 4],
                            ['category', 'PPE', 5],
                            ['doctor', 'Dr. John Smith', 1],
                            ['doctor', 'Dr. Sarah Johnson', 2],
                            ['doctor', 'Dr. Michael Brown', 3],
                            ['doctor', 'Dr. Emily Davis', 4],
                            ['doctor', 'Dr. Robert Wilson', 5],
                            ['doctor_role', 'Cardiologist', 1],
                            ['doctor_role', 'Surgeon', 2],
                            ['doctor_role', 'Neurologist', 3],
                            ['doctor_role', 'Orthopedic', 4],
                            ['doctor_role', 'Pediatrician', 5],
                            ['doctor_role', 'General Physician', 6],
                            ['ot_name', 'OT-1', 1],
                            ['ot_name', 'OT-2', 2],
                            ['ot_name', 'OT-3', 3],
                            ['ot_name', 'Emergency OT', 4],
                            ['ot_name', 'Cardiac OT', 5],
                             ['physician', 'Dr. James Wilson', 1],
    ['physician', 'Dr. Lisa Chen', 2],
    ['physician', 'Dr. David Brown', 3],
    ['physician', 'Dr. Maria Garcia', 4],
    ['physician', 'Dr. Thomas Lee', 5],
    ['physician', 'Dr. Susan Miller', 6],
                            ['checklist', 'Pulse Rate Check', 1],
                            ['checklist', 'Blood Pressure Measurement', 2],
                            ['checklist', 'Temperature Check', 3],
                            ['checklist', 'Respiratory Rate Check', 4],
                            ['checklist', 'Oxygen Saturation Check', 5],
                            ['checklist', 'Pain Assessment', 6],
                            ['checklist', 'IV Line Check', 7],
                            ['checklist', 'Catheter Check', 8],
                            ['checklist', 'Wound Dressing Check', 9],
                            ['checklist', 'Medication Administration', 10]
                        ];

                        const masterStmt = db.prepare("INSERT INTO master_data (category, value, display_order) VALUES (?, ?, ?)");
                        masterData.forEach(item => masterStmt.run(item));
                        masterStmt.finalize();

                        console.log('Sample data inserted successfully');
                    }
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

// ==================== TEST ENDPOINTS ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        server: 'Hospital Management System',
        version: '1.0.0',
        database: 'Connected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        endpoints: [
            '/api/patients',
            '/api/items',
            '/api/orders',
            '/api/users',
            '/api/roles',
            '/api/master',
            '/api/login',
            '/api/dashboard/stats',
            '/api/test',
            '/api/ot-schedules',
            '/api/patients/search',
            '/api/patients/search/advanced',
            '/api/patients/by-mrd/:mrd',
            '/api/patients/:patientId/biometry',
            '/api/patients/:patientId/lab-results'
        ]
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Hospital Management Server is running!', 
        status: 'OK',
        timestamp: new Date().toISOString(),
        server_ip: LOCAL_IP,
        features: [
            'Patient Management', 
            'Store Management', 
            'User Management',
            'File Upload', 
            'Role Management', 
            'Protocol Photos',
            'Music Management',
            'Video Management',
            'Clean Reports',
            'OT Scheduling',
            'Biometry Tracking',
            'Lab Results',
            'Surgical Aids',
            'FontAwesome Icons'
        ]
    });
});

// Network test endpoint
app.get('/api/network-test', (req, res) => {
    res.json({
        message: 'Network test successful!',
        client_ip: req.ip || req.connection.remoteAddress,
        client_headers: req.headers,
        timestamp: new Date().toISOString(),
        server: 'Hospital Management System',
        status: 'Connected',
        access_urls: [
            `http://localhost:${PORT}`,
            `http://127.0.0.1:${PORT}`,
            `http://${LOCAL_IP}:${PORT}`
        ]
    });
});

// Database test endpoint
app.get('/api/db-test', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM patients", (err, row) => {
        if (err) {
            return res.status(500).json({ 
                error: 'Database connection failed',
                message: err.message 
            });
        }
        res.json({
            message: 'Database connection successful',
            patient_count: row.count,
            database: 'hospital_management.db',
            status: 'OK'
        });
    });
});

// Music test endpoint
app.get('/api/music-test', (req, res) => {
    res.json({
        message: 'Music endpoints are working',
        endpoints: {
            upload: 'POST /api/music',
            list: 'GET /api/music',
            get: 'GET /api/music/:id',
            delete: 'DELETE /api/music/:id'
        },
        supported_formats: ['MP3', 'WAV', 'OGG', 'M4A', 'AAC'],
        max_file_size: '100MB'
    });
});

// File upload test endpoint
app.get('/api/upload-test', (req, res) => {
    res.json({
        message: 'File upload system is ready',
        upload_directory: './uploads/patients/',
        max_file_size: '50MB',
        allowed_types: ['images', 'pdf', 'doc', 'docx']
    });
});

// Network discovery endpoint
app.get('/network-info', (req, res) => {
    const nets = networkInterfaces();
    const results = [];
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                results.push({
                    interface: name,
                    address: net.address,
                    mac: net.mac,
                    family: net.family
                });
            }
        }
    }
    
    res.json({
        server_ip: req.ip,
        client_ip: req.connection.remoteAddress,
        network_interfaces: results,
        access_urls: results.map(ip => `http://${ip.address}:${PORT}`),
        mobile_access: `http://${LOCAL_IP}:${PORT}`,
        instructions: 'Use any of the above URLs to access from other devices'
    });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// LOGIN endpoint with master account recovery
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check for master account first
    if (username === MASTER_USERNAME && password === MASTER_PASSWORD) {
        // Log master account login
        logActivity(MASTER_USERNAME, 'Master Account Login', 'Master account used for system access');
        
        return res.json({
            success: true,
            isMaster: true,
            message: 'Master account access granted',
            user: {
                id: 'master',
                username: MASTER_USERNAME,
                role: 'master_admin',
                permissions: ['*'] // Full permissions
            }
        });
    }
    
    // Regular user authentication
    db.get(`
        SELECT u.*, r.role_name, r.permissions 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.role_id 
        WHERE u.username = ? AND u.password = ?
    `, [username, password], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            // Check if this is the first user attempt (no users in system)
            db.get(`SELECT COUNT(*) as count FROM users`, [], (countErr, countRow) => {
                if (!countErr && countRow.count === 0) {
                    return res.status(401).json({ 
                        error: 'No users in system. Use master account to create initial users.',
                        hint: 'Use master account: ' + MASTER_USERNAME
                    });
                }
                return res.status(401).json({ error: 'Invalid username or password' });
            });
            return;
        }
        
        logActivity(username, 'User Login', `Logged into system`);
        
        res.json({
            success: true,
            isMaster: false,
            user: {
                id: row.id,
                username: row.username,
                role: row.role_name,
                permissions: row.permissions ? JSON.parse(row.permissions) : []
            }
        });
    });
});

// Optional: Master account recovery endpoint
app.post('/api/master/recover', (req, res) => {
    const { masterUsername, masterPassword } = req.body;
    
    // Verify master credentials
    if (masterUsername === MASTER_USERNAME && masterPassword === MASTER_PASSWORD) {
        
        // Get list of all users before potential deletion
        db.all(`SELECT id, username, role_id FROM users`, [], (err, users) => {
            if (err) {
                console.error('Error fetching users:', err);
            }
            
            // Log the recovery action
            logActivity(MASTER_USERNAME, 'Account Recovery', `System recovery initiated. Users present: ${users ? users.length : 0}`);
            
            // Optional: Create backup of users before deletion
            const backupData = users ? JSON.stringify(users) : '[]';
            
            // Delete all non-master users
            db.run(`DELETE FROM users WHERE username != ?`, [MASTER_USERNAME], function(deleteErr) {
                if (deleteErr) {
                    console.error('Error deleting users:', deleteErr);
                    return res.status(500).json({ error: 'Failed to reset users' });
                }
                
                // Reset sequences if needed (for SQLite)
                db.run(`DELETE FROM sqlite_sequence WHERE name='users'`, () => {
                    logActivity(MASTER_USERNAME, 'Account Recovery', `System reset completed. Deleted ${this.changes} users`);
                    
                    res.json({
                        success: true,
                        message: 'System recovered successfully',
                        deletedUsers: this.changes,
                        backup: backupData,
                        timestamp: new Date().toISOString()
                    });
                });
            });
        });
    } else {
        res.status(401).json({ error: 'Invalid master credentials' });
    }
});

// Optional: Create initial admin user using master account
app.post('/api/master/create-admin', (req, res) => {
    const { masterUsername, masterPassword, newAdmin } = req.body;
    
    // Verify master credentials
    if (masterUsername === MASTER_USERNAME && masterPassword === MASTER_PASSWORD) {
        
        // Check if admin role exists, if not create it
        db.get(`SELECT role_id FROM roles WHERE role_name = 'admin'`, [], (err, role) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (!role) {
                // Create admin role
                db.run(`INSERT INTO roles (role_name, permissions) VALUES (?, ?)`, 
                    ['admin', JSON.stringify(['*'])] , function(roleErr) {
                    if (roleErr) {
                        return res.status(500).json({ error: roleErr.message });
                    }
                    createAdminUser(this.lastID);
                });
            } else {
                createAdminUser(role.role_id);
            }
        });
        
        function createAdminUser(roleId) {
            // Check if username already exists
            db.get(`SELECT id FROM users WHERE username = ?`, [newAdmin.username], (checkErr, existing) => {
                if (checkErr) {
                    return res.status(500).json({ error: checkErr.message });
                }
                
                if (existing) {
                    return res.status(400).json({ error: 'Username already exists' });
                }
                
                // Create new admin user
                db.run(`INSERT INTO users (username, password, role_id, created_at) VALUES (?, ?, ?, ?)`,
                    [newAdmin.username, newAdmin.password, roleId, new Date().toISOString()],
                    function(insertErr) {
                        if (insertErr) {
                            return res.status(500).json({ error: insertErr.message });
                        }
                        
                        logActivity(MASTER_USERNAME, 'Create Admin', `Created new admin: ${newAdmin.username}`);
                        
                        res.json({
                            success: true,
                            message: 'Admin user created successfully',
                            userId: this.lastID
                        });
                    }
                );
            });
        }
    } else {
        res.status(401).json({ error: 'Invalid master credentials' });
    }
});

// ==================== PATIENT ENDPOINTS ====================

// GET all patients
app.get('/api/patients', (req, res) => {
    db.all("SELECT * FROM patients ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching patients');
        }
        res.json(rows);
    });
});

// GET single patient
app.get('/api/patients/:id', (req, res) => {
    db.get("SELECT * FROM patients WHERE patient_id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching patient');
        }
        if (!row) {
            res.status(404).json({ error: 'Patient not found' });
            return;
        }
        res.json(row);
    });
});

// GET patient's checklist
app.get('/api/patients/:id/checklist', (req, res) => {
    const patientId = req.params.id;
    
    db.get("SELECT checklist FROM patients WHERE patient_id = ?", [patientId], (err, row) => {
        if (err) {
            console.error('Error fetching checklist:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        try {
            const checklist = row.checklist ? JSON.parse(row.checklist) : [];
            res.json({
                success: true,
                patient_id: patientId,
                checklist: checklist,
                count: checklist.length
            });
        } catch (e) {
            console.error('Error parsing checklist JSON:', e);
            res.json({
                success: true,
                patient_id: patientId,
                checklist: [],
                count: 0
            });
        }
    });
});

app.post('/api/patients', upload.array('reports', 100), async (req, res) => {
    console.log('=== PATIENT UPLOAD DEBUG ===');
    console.log('Body:', req.body);
    console.log('Files received:', req.files ? req.files.length : 0);
    
    const {
        patient_id, mrd_number, patient_category, name, age, gender, phone, email, blood_group, address,
        emergency_contact, emergency_name, emergency_relation, allergies, medications, medical_history,
        insurance, insurance_id, operation_ot, operation_date, operation_time, 
        operation_doctor, operation_doctor_role, operation_notes, currentUser,
        eye, eye_condition, eye_surgery, vision_left, vision_right,
        bcva_left, bcva_right, specular_left, specular_right,
        cataract_type_left, cataract_type_right, fundus_view_left, fundus_view_right,
        pupil_dilation_left, pupil_dilation_right, iop_left, iop_right, diagnosis,
        oct, argas, pentacam, bscan,
        medical_fitness, ecg, bt, ct, conj_swab,
        lab_name, emr_number, physician, investigation_date,
        lab_registration, gram_swab,
        verified_by, verification_date, verification_time, signature,
        intraop_notes, postop_instructions,
        checklist
    } = req.body;
    
    if (!name || !phone || !age || !gender || !patient_category || !mrd_number) {
        console.error('Missing required fields');
        return res.status(400).json({ 
            error: 'Category, MRD Number, name, phone, age, and gender are required' 
        });
    }
    
    if (!mrd_number.trim()) {
        return res.status(400).json({ 
            error: 'Invalid MRD Number',
            message: 'MRD Number cannot be empty or contain only spaces'
        });
    }
    
    // Check if MRD number already exists
    db.get("SELECT patient_id, name FROM patients WHERE mrd_number = ?", [mrd_number.trim()], (err, existingPatient) => {
        if (err) {
            console.error('Error checking MRD uniqueness:', err);
            return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to check MRD number availability' 
            });
        }
        
        if (existingPatient) {
            if (req.body.new_surgery !== 'true') {
                console.log('MRD conflict detected:', existingPatient);
                return res.status(409).json({ 
                    error: 'MRD Number already exists',
                    message: `MRD "${mrd_number}" is already assigned to: ${existingPatient.name} (ID: ${existingPatient.patient_id})`,
                    can_add_surgery: true,
                    patient_id: existingPatient.patient_id,
                    patient_name: existingPatient.name
                });
            }
            console.log(`New surgery record being added for MRD: ${mrd_number}`);
        }
        
        if (patient_id) {
            db.get("SELECT patient_id, name FROM patients WHERE patient_id = ?", [patient_id], (err, existingId) => {
                if (err) {
                    console.error('Error checking patient ID:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingId) {
                    return res.status(400).json({ 
                        error: 'Patient ID already exists',
                        message: `Patient ID "${patient_id}" is already in use by patient: ${existingId.name}`
                    });
                }
                
                insertPatient(patient_id);
            });
        } else {
            const newPatientId = 'P' + Date.now().toString().slice(-6);
            insertPatient(newPatientId);
        }
    });
    
    function insertPatient(generatedPatientId) {
        let allergiesStr = '';
        let medicationsStr = '';
        let medicalHistoryStr = '';
        
        try {
            allergiesStr = allergies ? (typeof allergies === 'string' ? JSON.parse(allergies).join(', ') : allergies.join(', ')) : '';
            medicationsStr = medications ? (typeof medications === 'string' ? JSON.parse(medications).join(', ') : medications.join(', ')) : '';
            medicalHistoryStr = medical_history ? (typeof medical_history === 'string' ? medical_history : JSON.stringify(medical_history)) : '';
        } catch (e) {
            allergiesStr = allergies || '';
            medicationsStr = medications || '';
            medicalHistoryStr = medical_history || '';
        }

        let checklistStr = '[]';
        try {
            if (checklist) {
                checklistStr = typeof checklist === 'string' ? checklist : JSON.stringify(checklist);
            }
        } catch (e) {
            console.error('Error parsing checklist:', e);
            checklistStr = '[]';
        }
        
        console.log('Saving checklist data for patient:', checklistStr);
        
        db.run(
            `INSERT INTO patients (
                patient_id, mrd_number, patient_category, name, age, gender, 
                eye, eye_condition, eye_surgery, vision_left, vision_right,
                bcva_left, bcva_right, specular_left, specular_right,
                cataract_type_left, cataract_type_right, fundus_view_left, fundus_view_right,
                pupil_dilation_left, pupil_dilation_right, iop_left, iop_right, diagnosis,
                oct, argas, pentacam, bscan,
                medical_fitness, ecg, bt, ct, conj_swab,
                phone, email, blood_group, address,
                emergency_contact, emergency_name, emergency_relation,
                allergies, medications, medical_history,
                insurance, insurance_id, 
                operation_ot, operation_date, operation_time, 
                operation_doctor, operation_doctor_role, operation_notes,
                lab_name, emr_number, physician, investigation_date,
                lab_registration, gram_swab,
                verified_by, verification_date, verification_time, signature,
                intraop_notes, postop_instructions,
                checklist
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                generatedPatientId,                     // 1. patient_id
                mrd_number.trim(),                       // 2. mrd_number
                patient_category,                         // 3. patient_category
                name,                                     // 4. name
                age,                                      // 5. age
                gender,                                   // 6. gender
                eye,                                      // 7. eye
                eye_condition,                            // 8. eye_condition
                eye_surgery,                              // 9. eye_surgery
                vision_left,                              // 10. vision_left
                vision_right,                             // 11. vision_right
                bcva_left,                                // 12. bcva_left
                bcva_right,                               // 13. bcva_right
                specular_left,                            // 14. specular_left
                specular_right,                           // 15. specular_right
                cataract_type_left,                        // 16. cataract_type_left
                cataract_type_right,                       // 17. cataract_type_right
                fundus_view_left,                          // 18. fundus_view_left
                fundus_view_right,                         // 19. fundus_view_right
                pupil_dilation_left,                       // 20. pupil_dilation_left
                pupil_dilation_right,                      // 21. pupil_dilation_right
                iop_left,                                 // 22. iop_left
                iop_right,                                // 23. iop_right
                diagnosis,                                // 24. diagnosis
                oct,                                      // 25. oct
                argas,                                    // 26. argas
                pentacam,                                 // 27. pentacam
                bscan,                                    // 28. bscan
                medical_fitness,                          // 29. medical_fitness
                ecg,                                      // 30. ecg
                bt,                                       // 31. bt
                ct,                                       // 32. ct
                conj_swab,                                // 33. conj_swab
                phone,                                    // 34. phone
                email,                                    // 35. email
                blood_group,                              // 36. blood_group
                address,                                  // 37. address
                emergency_contact,                         // 38. emergency_contact
                emergency_name,                            // 39. emergency_name
                emergency_relation,                        // 40. emergency_relation
                allergiesStr,                             // 41. allergies
                medicationsStr,                           // 42. medications
                medicalHistoryStr,                         // 43. medical_history
                insurance,                                // 44. insurance
                insurance_id,                             // 45. insurance_id
                operation_ot,                             // 46. operation_ot
                operation_date,                            // 47. operation_date
                operation_time,                            // 48. operation_time
                operation_doctor,                          // 49. operation_doctor
                operation_doctor_role,                     // 50. operation_doctor_role
                operation_notes,                           // 51. operation_notes
                lab_name,                                 // 52. lab_name
                emr_number,                               // 53. emr_number
                physician,                                // 54. physician
                investigation_date,                        // 55. investigation_date
                lab_registration,                          // 56. lab_registration
                gram_swab,                                // 57. gram_swab
                verified_by,                              // 58. verified_by
                verification_date,                         // 59. verification_date
                verification_time,                         // 60. verification_time
                signature,                                // 61. signature
                intraop_notes,                            // 62. intraop_notes
                postop_instructions,                       // 63. postop_instructions
                checklistStr                              // 64. checklist
            ],
            async function(err) {
                if (err) {
                    console.error('Database error:', err);
                    
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        if (err.message.includes('mrd_number')) {
                            return res.status(400).json({ 
                                error: 'MRD Number already exists',
                                message: `MRD Number "${mrd_number}" is already in use. Please use a different MRD number.`
                            });
                        }
                        if (err.message.includes('patient_id')) {
                            return res.status(400).json({ 
                                error: 'Patient ID already exists',
                                message: `Patient ID "${generatedPatientId}" is already in use. Please try again.`
                            });
                        }
                    }
                    
                    return res.status(500).json({ 
                        error: 'Database error',
                        message: err.message 
                    });
                }
                
                console.log('Patient added successfully:', generatedPatientId, 'MRD:', mrd_number);
                console.log('Checklist saved:', checklistStr);
                
                if (req.files && req.files.length > 0) {
                    console.log(`Processing ${req.files.length} uploaded files`);
                    
                    const reports = req.files.map(file => ({
                        patient_id: generatedPatientId,
                        filename: file.filename,
                        original_name: file.originalname,
                        file_size: file.size,
                        file_type: file.mimetype,
                        description: 'Initial upload'
                    }));
                    
                    const stmt = db.prepare(`
                        INSERT INTO patient_reports (patient_id, filename, original_name, file_size, file_type, description)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    
                    for (const report of reports) {
                        await new Promise((resolve, reject) => {
                            stmt.run([
                                report.patient_id,
                                report.filename,
                                report.original_name,
                                report.file_size,
                                report.file_type,
                                report.description
                            ], function(err) {
                                if (err) {
                                    console.error('Error saving report:', err);
                                    reject(err);
                                } else {
                                    console.log(`Report saved: ${report.original_name}`);
                                    resolve();
                                }
                            });
                        });
                    }
                    
                    stmt.finalize();
                    console.log(`Added ${reports.length} reports for patient ${generatedPatientId}`);
                }
                
                logActivity(currentUser, 'Added Patient', `${name} (MRD: ${mrd_number})`);
                
                // Send response to client
                res.json({ 
                    id: this.lastID,
                    patient_id: generatedPatientId,
                    mrd_number: mrd_number,
                    message: 'Patient added successfully',
                    files_uploaded: req.files ? req.files.length : 0,
                    checklist_items: JSON.parse(checklistStr).length
                });

                // ========== AFTER RES.JSON - ADD PDF GENERATION TRIGGER HERE ==========
                // Trigger PDF generation in the background (don't await)
                setTimeout(() => {
                    const protocol = req.secure ? 'https' : 'http';
                    const host = req.get('host');
                    const pdfUrl = `${protocol}://${host}/api/patients/${generatedPatientId}/generate-pdf`;
                    
                    // Use fetch to call the PDF generation endpoint
                    const http = require('http');
                    const https = require('https');
                    const client = protocol === 'https' ? https : http;
                    
                    console.log(`📄 Triggering background PDF generation for patient ${generatedPatientId}`);
                    
                    client.get(pdfUrl, (response) => {
                        let data = '';
                        response.on('data', (chunk) => { data += chunk; });
                        response.on('end', () => {
                            try {
                                const result = JSON.parse(data);
                                if (result.success) {
                                    console.log(`✅ Background PDF generation completed for patient ${generatedPatientId}`);
                                    console.log(`   PDF saved to: ${result.pdf_files.folder}`);
                                } else {
                                    console.error(`❌ Background PDF generation failed:`, result.error);
                                }
                            } catch (e) {
                                console.error('Error parsing PDF generation response:', e);
                            }
                        });
                    }).on('error', (err) => {
                        console.error('❌ Background PDF generation error:', err);
                    });
                }, 2000); // Wait 2 seconds before generating PDF
                // ========== END PDF GENERATION TRIGGER ==========
            }
        );
    }
});

// UPDATE patient
app.put('/api/patients/:id', upload.array('reports', 100), (req, res) => {
    console.log('=== PATIENT UPDATE DEBUG ===');
    console.log('Body:', req.body);
    console.log('Files received:', req.files ? req.files.length : 0);
    
    const {
        mrd_number, name, patient_category, age, gender, phone, email, blood_group, address,
        emergency_contact, emergency_name, emergency_relation, allergies, medications, medical_history,
        insurance, insurance_id, operation_ot, operation_date, operation_time, 
        operation_doctor, operation_doctor_role, operation_notes, currentUser,
        eye, eye_condition, eye_surgery, vision_left, vision_right,
        bcva_left, bcva_right, specular_left, specular_right,
        cataract_type_left, cataract_type_right, fundus_view_left, fundus_view_right,
        pupil_dilation_left, pupil_dilation_right, iop_left, iop_right, diagnosis,
        oct, argas, pentacam, bscan,
        medical_fitness, ecg, bt, ct, conj_swab,
        lab_name, emr_number, physician, investigation_date,
        lab_registration, gram_swab,
        verified_by, verification_date, verification_time, signature,
        intraop_notes, postop_instructions,
        checklist
    } = req.body;
    
    if (!name || !phone || !age || !gender || !patient_category || !mrd_number) {
        console.error('Missing required fields');
        return res.status(400).json({ 
            error: 'Category, MRD Number, name, phone, age, and gender are required' 
        });
    }
    
    if (!mrd_number.trim()) {
        return res.status(400).json({ 
            error: 'Invalid MRD Number',
            message: 'MRD Number cannot be empty or contain only spaces'
        });
    }
    
    db.get("SELECT patient_id, mrd_number, name FROM patients WHERE patient_id = ?", [req.params.id], (err, existingPatient) => {
        if (err) {
            console.error('Error fetching patient:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!existingPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        if (existingPatient.mrd_number !== mrd_number.trim()) {
            db.get("SELECT patient_id, name FROM patients WHERE mrd_number = ? AND patient_id != ?", 
                [mrd_number.trim(), req.params.id], (err, duplicateMRD) => {
                if (err) {
                    console.error('Error checking MRD uniqueness:', err);
                    return res.status(500).json({ 
                        error: 'Database error',
                        message: 'Failed to check MRD number availability' 
                    });
                }
                
                if (duplicateMRD) {
                    return res.status(400).json({ 
                        error: 'MRD Number already exists',
                        message: `MRD Number "${mrd_number}" is already assigned to patient: ${duplicateMRD.name} (ID: ${duplicateMRD.patient_id})`
                    });
                }
                
                updatePatient();
            });
        } else {
            updatePatient();
        }
    });
    
    function updatePatient() {
        let allergiesStr = '';
        let medicationsStr = '';
        let medicalHistoryStr = '';
        
        try {
            allergiesStr = allergies ? (typeof allergies === 'string' ? JSON.parse(allergies).join(', ') : allergies.join(', ')) : '';
            medicationsStr = medications ? (typeof medications === 'string' ? JSON.parse(medications).join(', ') : medications.join(', ')) : '';
            medicalHistoryStr = medical_history ? (typeof medical_history === 'string' ? medical_history : JSON.stringify(medical_history)) : '';
        } catch (e) {
            allergiesStr = allergies || '';
            medicationsStr = medications || '';
            medicalHistoryStr = medical_history || '';
        }
        
        let checklistStr = '[]';
        try {
            checklistStr = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : '[]';
        } catch (e) {
            console.error('Error parsing checklist:', e);
            checklistStr = '[]';
        }
        
        db.run(
            `UPDATE patients SET 
                mrd_number=?, name=?, patient_category=?, age=?, gender=?, 
                eye=?, eye_condition=?, eye_surgery=?, vision_left=?, vision_right=?,
                bcva_left=?, bcva_right=?, specular_left=?, specular_right=?,
                cataract_type_left=?, cataract_type_right=?, fundus_view_left=?, fundus_view_right=?,
                pupil_dilation_left=?, pupil_dilation_right=?, iop_left=?, iop_right=?, diagnosis=?,
                oct=?, argas=?, pentacam=?, bscan=?,
                medical_fitness=?, ecg=?, bt=?, ct=?, conj_swab=?,
                phone=?, email=?, blood_group=?, address=?,
                emergency_contact=?, emergency_name=?, emergency_relation=?,
                allergies=?, medications=?, medical_history=?,
                insurance=?, insurance_id=?,
                operation_ot=?, operation_date=?, operation_time=?, 
                operation_doctor=?, operation_doctor_role=?, operation_notes=?,
                lab_name=?, emr_number=?, physician=?, investigation_date=?,
                lab_registration=?, gram_swab=?,
                verified_by=?, verification_date=?, verification_time=?, signature=?,
                intraop_notes=?, postop_instructions=?,
                checklist=?
             WHERE patient_id=?`,
            [
                mrd_number.trim(), name, patient_category, age, gender,
                eye, eye_condition, eye_surgery, vision_left, vision_right,
                bcva_left, bcva_right, specular_left, specular_right,
                cataract_type_left, cataract_type_right, fundus_view_left, fundus_view_right,
                pupil_dilation_left, pupil_dilation_right, iop_left, iop_right, diagnosis,
                oct, argas, pentacam, bscan,
                medical_fitness, ecg, bt, ct, conj_swab,
                phone, email, blood_group, address,
                emergency_contact, emergency_name, emergency_relation,
                allergiesStr, medicationsStr, medicalHistoryStr,
                insurance, insurance_id,
                operation_ot, operation_date, operation_time,
                operation_doctor, operation_doctor_role, operation_notes,
                lab_name, emr_number, physician, investigation_date,
                lab_registration, gram_swab,
                verified_by, verification_date, verification_time, signature,
                intraop_notes, postop_instructions,
                checklistStr, req.params.id
            ],
            async function(err) {
                if (err) {
                    console.error('Database error:', err);
                    
                    if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('mrd_number')) {
                        return res.status(400).json({ 
                            error: 'MRD Number already exists',
                            message: `MRD Number "${mrd_number}" is already in use. Please use a different MRD number.`
                        });
                    }
                    
                    return res.status(500).json({ 
                        error: 'Database error',
                        message: err.message 
                    });
                }
                
                console.log('Patient updated successfully:', req.params.id);
                console.log('Checklist updated:', checklistStr);
                
                if (req.files && req.files.length > 0) {
                    console.log(`Processing ${req.files.length} uploaded files for update`);
                    
                    const reports = req.files.map(file => ({
                        patient_id: req.params.id,
                        filename: file.filename,
                        original_name: file.originalname,
                        file_size: file.size,
                        file_type: file.mimetype,
                        description: 'Updated patient upload'
                    }));
                    
                    const stmt = db.prepare(`
                        INSERT INTO patient_reports (patient_id, filename, original_name, file_size, file_type, description)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    
                    for (const report of reports) {
                        await new Promise((resolve, reject) => {
                            stmt.run([
                                report.patient_id,
                                report.filename,
                                report.original_name,
                                report.file_size,
                                report.file_type,
                                report.description
                            ], function(err) {
                                if (err) {
                                    console.error('Error saving report:', err);
                                    reject(err);
                                } else {
                                    console.log(`Report saved: ${report.original_name}`);
                                    resolve();
                                }
                            });
                        });
                    }
                    
                    stmt.finalize();
                    console.log(`Added ${reports.length} reports for patient ${req.params.id}`);
                }
                
                logActivity(currentUser, 'Updated Patient', name);
                
                res.json({ 
                    message: 'Patient updated successfully',
                    changes: this.changes,
                    files_uploaded: req.files ? req.files.length : 0,
                    checklist_items: JSON.parse(checklistStr).length
                });
            }
        );
    }
});

// DELETE patient
app.delete('/api/patients/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    
    db.get("SELECT name FROM patients WHERE patient_id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching patient');
        }
        
        if (row) {
            db.all("SELECT filename FROM patient_reports WHERE patient_id = ?", [req.params.id], (err, reports) => {
                if (err) {
                    console.error('Error fetching reports for deletion:', err);
                } else {
                    reports.forEach(report => {
                        const filePath = `./uploads/patients/${report.filename}`;
                        fs.unlink(filePath, (unlinkErr) => {
                            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                                console.error('Error deleting report file:', unlinkErr);
                            }
                        });
                    });
                    
                    db.run("DELETE FROM patient_reports WHERE patient_id = ?", [req.params.id]);
                }
                
                db.run("DELETE FROM patients WHERE patient_id = ?", [req.params.id], function(err) {
                    if (err) {
                        return handleDatabaseError(err, res, 'Error deleting patient');
                    }
                    
                    logActivity(currentUser, 'Deleted Patient', row.name);
                    
                    res.json({ 
                        message: 'Patient deleted successfully',
                        changes: this.changes
                    });
                });
            });
        } else {
            res.status(404).json({ error: 'Patient not found' });
        }
    });
});
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        server: 'running',
        time: new Date()
    });
});
// GET all patients with report counts
app.get('/api/patients-with-reports', (req, res) => {
    db.all(`
        SELECT p.*, 
               COUNT(pr.id) as report_count
        FROM patients p 
        LEFT JOIN patient_reports pr ON p.patient_id = pr.patient_id 
        GROUP BY p.patient_id
        ORDER BY p.created_at DESC
    `, (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching patients with reports');
        }
        res.json(rows);
    });
});

// Check MRD availability
app.get('/api/check-mrd', (req, res) => {
    const { mrd, excludePatientId } = req.query;
    
    if (!mrd) {
        return res.status(400).json({ 
            error: 'MRD number is required',
            message: 'Please provide an MRD number to check'
        });
    }
    
    let query = "SELECT patient_id, name, mrd_number FROM patients WHERE mrd_number = ?";
    const params = [mrd.trim()];
    
    if (excludePatientId) {
        query += " AND patient_id != ?";
        params.push(excludePatientId);
    }
    
    db.get(query, params, (err, row) => {
        if (err) {
            console.error('Error checking MRD:', err);
            return res.status(500).json({ 
                error: 'Database error',
                message: 'Failed to check MRD number availability' 
            });
        }
        
        if (row) {
            res.json({
                available: false,
                exists: true,
                patient_id: row.patient_id,
                patient_name: row.name,
                mrd_number: row.mrd_number,
                can_add_surgery: true,
                message: `MRD "${mrd}" is already assigned to: ${row.name} (ID: ${row.patient_id})`
            });
        } else {
            res.json({
                available: true,
                exists: false,
                message: `MRD number "${mrd}" is available`
            });
        }
    });
});

// ==================== PATIENT SEARCH ENDPOINTS ====================

// Basic patient search
app.get('/api/patients/search', (req, res) => {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
        return res.json([]);
    }
    
    const searchTerm = `%${query}%`;
    
    db.all(
        `SELECT patient_id, name, mrd_number, age, gender, phone 
         FROM patients 
         WHERE name LIKE ? OR mrd_number LIKE ? OR phone LIKE ?
         ORDER BY 
            CASE 
                WHEN mrd_number = ? THEN 1
                WHEN name LIKE ? THEN 2
                ELSE 3
            END
         LIMIT 10`,
        [searchTerm, searchTerm, searchTerm, query, `${query}%`],
        (err, rows) => {
            if (err) {
                console.error('Error searching patients:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Advanced patient search for OT scheduling
app.get('/api/patients/search/advanced', (req, res) => {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
        return res.json([]);
    }
    
    const searchTerm = `%${query}%`;
    
    db.all(
        `SELECT 
            patient_id, 
            name, 
            mrd_number, 
            age, 
            gender, 
            phone,
            address,
            emergency_name,
            emergency_contact
         FROM patients 
         WHERE 
            name LIKE ? OR 
            mrd_number LIKE ? OR 
            phone LIKE ? OR
            patient_id LIKE ?
         ORDER BY 
            CASE 
                WHEN mrd_number = ? THEN 1
                WHEN name LIKE ? THEN 2
                ELSE 3
            END
         LIMIT 15`,
        [searchTerm, searchTerm, searchTerm, searchTerm, query, `${query}%`],
        (err, rows) => {
            if (err) {
                console.error('Error searching patients:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Get patient by MRD
app.get('/api/patients/by-mrd/:mrd', (req, res) => {
    const mrd = req.params.mrd;
    
    db.get(
        `SELECT patient_id, name, mrd_number, age, gender, phone 
         FROM patients 
         WHERE mrd_number = ?`,
        [mrd],
        (err, row) => {
            if (err) {
                console.error('Error fetching patient by MRD:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.status(404).json({ error: 'Patient not found' });
            }
            
            res.json(row);
        }
    );
});

// ==================== PATIENT REPORTS ENDPOINTS ====================

// UPLOAD patient reports
app.post('/api/patients/:patientId/reports', upload.array('reports', 100), (req, res) => {
    const patientId = req.params.patientId;
    const { currentUser } = req.body;
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Uploading ${req.files.length} reports for patient ${patientId}`);

    const reports = req.files.map(file => ({
        patient_id: patientId,
        filename: file.filename,
        original_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
        description: req.body.description || ''
    }));

    const stmt = db.prepare(`
        INSERT INTO patient_reports (patient_id, filename, original_name, file_size, file_type, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    let completed = 0;
    const insertedReports = [];

    reports.forEach(report => {
        stmt.run([
            report.patient_id,
            report.filename,
            report.original_name,
            report.file_size,
            report.file_type,
            report.description
        ], function(err) {
            if (err) {
                console.error('Error saving report to database:', err);
                return;
            }
            
            const protocol = req.secure ? 'https' : 'http';
            const baseUrl = `${protocol}://${req.get('host')}`;
            insertedReports.push({
                id: this.lastID,
                ...report,
                file_url: `${baseUrl}/uploads/patients/${report.filename}`
            });
            
            completed++;
            
            if (completed === reports.length) {
                stmt.finalize();
                
                logActivity(currentUser, 'Uploaded Reports', 
                    `Uploaded ${reports.length} files for patient ${patientId}`);
                
                res.json({
                    message: `${reports.length} files uploaded successfully`,
                    reports: insertedReports
                });
            }
        });
    });
});

// GET patient reports
app.get('/api/patients/:patientId/reports', (req, res) => {
    const patientId = req.params.patientId;
    
    db.all(`
        SELECT * FROM patient_reports 
        WHERE patient_id = ? 
        ORDER BY upload_date DESC
    `, [patientId], (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching patient reports');
        }
        
        const protocol = req.secure ? 'https' : 'http';
        const baseUrl = `${protocol}://${req.get('host')}`;
        const reportsWithUrls = rows.map(report => ({
            ...report,
            file_url: `${baseUrl}/uploads/patients/${report.filename}`
        }));
        
        res.json(reportsWithUrls);
    });
});

// DELETE patient report
app.delete('/api/patients/:patientId/reports/:reportId', (req, res) => {
    const { patientId, reportId } = req.params;
    const currentUser = req.query.currentUser || 'System';
    
    db.get(`
        SELECT filename, original_name FROM patient_reports 
        WHERE id = ? AND patient_id = ?
    `, [reportId, patientId], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching report');
        }
        
        if (!row) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        
        db.run(`
            DELETE FROM patient_reports 
            WHERE id = ? AND patient_id = ?
        `, [reportId, patientId], function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error deleting report');
            }
            
            const filePath = `./uploads/patients/${row.filename}`;
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error('Error deleting file:', unlinkErr);
                }
                
                logActivity(currentUser, 'Deleted Report', 
                    `Deleted report: ${row.original_name} for patient ${patientId}`);
                
                res.json({ 
                    message: 'Report deleted successfully',
                    changes: this.changes
                });
            });
        });
    });
});

// DOWNLOAD patient report
app.get('/api/patients/:patientId/reports/:reportId/download', (req, res) => {
    const { patientId, reportId } = req.params;
    
    db.get(`
        SELECT filename, original_name, file_type 
        FROM patient_reports 
        WHERE id = ? AND patient_id = ?
    `, [reportId, patientId], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching report');
        }
        
        if (!row) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        
        const filePath = `./uploads/patients/${row.filename}`;
        
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found on server' });
            return;
        }
        
        res.setHeader('Content-Type', row.file_type);
        res.setHeader('Content-Disposition', `attachment; filename="${row.original_name}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    });
});

// GET report count for patient
app.get('/api/patients/:patientId/reports/count', (req, res) => {
    const patientId = req.params.patientId;
    
    db.get(`
        SELECT COUNT(*) as count FROM patient_reports 
        WHERE patient_id = ?
    `, [patientId], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error counting reports');
        }
        
        res.json({ count: row ? row.count : 0 });
    });
});

// ==================== BIOMETRY ENDPOINTS ====================

// GET biometry for a patient
app.get('/api/patients/:patientId/biometry', (req, res) => {
    const patientId = req.params.patientId;
    
    db.all(
        "SELECT * FROM patient_biometry WHERE patient_id = ? ORDER BY measurement_date DESC",
        [patientId],
        (err, rows) => {
            if (err) {
                console.error('Error fetching biometry:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// ADD biometry data
app.post('/api/patients/:patientId/biometry', (req, res) => {
    const patientId = req.params.patientId;
    const {
        eye, al, k1, k2, cyl, acd, lt, cct, wtw,
        aconstant, iol_power, iol_category, iol_manufacturer,
        target_refraction, measurement_date
    } = req.body;
    
    if (!eye) {
        return res.status(400).json({ error: 'Eye (left/right) is required' });
    }
    
    db.run(
        `INSERT INTO patient_biometry (
            patient_id, eye, al, k1, k2, cyl, acd, lt, cct, wtw,
            aconstant, iol_power, iol_category, iol_manufacturer,
            target_refraction, measurement_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, eye, al, k1, k2, cyl, acd, lt, cct, wtw,
         aconstant, iol_power, iol_category, iol_manufacturer,
         target_refraction, measurement_date || new Date().toISOString().split('T')[0]],
        function(err) {
            if (err) {
                console.error('Error saving biometry:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                id: this.lastID,
                message: 'Biometry data saved successfully'
            });
        }
    );
});

// DELETE biometry
app.delete('/api/biometry/:id', (req, res) => {
    db.run("DELETE FROM patient_biometry WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting biometry:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Biometry deleted successfully' });
    });
});

// ==================== LAB RESULTS ENDPOINTS ====================

// GET lab results for a patient
app.get('/api/patients/:patientId/lab-results', (req, res) => {
    const patientId = req.params.patientId;
    const { category } = req.query;
    
    let query = "SELECT * FROM patient_lab_results WHERE patient_id = ?";
    const params = [patientId];
    
    if (category) {
        query += " AND test_category = ?";
        params.push(category);
    }
    
    query += " ORDER BY created_at DESC";
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching lab results:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ADD lab results (multiple at once)
app.post('/api/patients/:patientId/lab-results/bulk', (req, res) => {
    const patientId = req.params.patientId;
    const { results } = req.body;
    
    if (!results || !Array.isArray(results) || results.length === 0) {
        return res.status(400).json({ error: 'No lab results provided' });
    }
    
    const stmt = db.prepare(`
        INSERT INTO patient_lab_results 
        (patient_id, test_category, test_name, test_value, test_unit, test_date)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    let completed = 0;
    const insertedIds = [];
    
    results.forEach(result => {
        stmt.run([
            patientId,
            result.test_category,
            result.test_name,
            result.test_value,
            result.test_unit,
            result.test_date || new Date().toISOString().split('T')[0]
        ], function(err) {
            if (err) {
                console.error('Error saving lab result:', err);
            } else {
                insertedIds.push(this.lastID);
            }
            
            completed++;
            if (completed === results.length) {
                stmt.finalize();
                res.json({
                    message: `${insertedIds.length} lab results saved successfully`,
                    count: insertedIds.length,
                    ids: insertedIds
                });
            }
        });
    });
});

// ==================== STORE ITEMS ENDPOINTS ====================
// ==================== PATIENT PDF GENERATION ON SERVER ====================

// Configuration for PDF save directory
const PATIENT_PDF_CONFIG_FILE = './patient_pdf_config.json';
const DEFAULT_PATIENT_PDF_DIR = 'D:/Hospital_Data/Patients';

function loadPatientPDFConfig() {
    try {
        if (fs.existsSync(PATIENT_PDF_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(PATIENT_PDF_CONFIG_FILE, 'utf8'));
        }
    } catch (e) { 
        console.error('Patient PDF config read error:', e); 
    }
    return { saveDir: DEFAULT_PATIENT_PDF_DIR };
}

function savePatientPDFConfig(config) {
    try { 
        fs.writeFileSync(PATIENT_PDF_CONFIG_FILE, JSON.stringify(config, null, 2)); 
    } catch (e) { 
        console.error('Patient PDF config write error:', e); 
    }
}

// GET patient PDF configuration
app.get('/api/patient-pdf-config', (req, res) => {
    const cfg = loadPatientPDFConfig();
    res.json({ saveDir: cfg.saveDir, isConfigured: !!cfg.saveDir });
});

// POST set patient PDF save directory
app.post('/api/patient-pdf-config', (req, res) => {
    const { saveDir } = req.body;
    if (!saveDir) return res.status(400).json({ error: 'saveDir is required' });
    try {
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
        savePatientPDFConfig({ saveDir });
        res.json({ success: true, saveDir });
    } catch (e) {
        res.status(500).json({ error: 'Cannot create directory: ' + e.message });
    }
});


const { execFile } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
// To this:
const PYTHON_BIN = process.platform === 'win32' ? 'python' : 'python3';                         // or full path: '/usr/bin/python3'
const PYTHON_SCRIPT = path.join(__dirname, 'generate_patient_pdf.py'); // adjust if needed

// ── Route ─────────────────────────────────────────────────────────────────────
app.post('/api/patients/:patientId/generate-pdf', async (req, res) => {
    const patientId = req.params.patientId;

    try {
        // 1. Fetch patient data
        const patient = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM patients WHERE patient_id = ?", [patientId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!patient) {
            return res.status(404).json({ error: "Patient not found" });
        }

        // 2. Fetch reports
        const reports = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM patient_reports WHERE patient_id = ?", [patientId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // 3. Parse checklist JSON
        let checklist = {};
        try {
            checklist = patient.checklist ? JSON.parse(patient.checklist) : {};
        } catch (e) {
            console.error('Checklist parse error:', e);
        }

        // 4. Build output file path
        const cfg        = loadPatientPDFConfig();
        const mrdFolder  = patient.mrd_number || patientId;
        const patientDir = path.join(cfg.saveDir, mrdFolder);

        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }

        const fileName = `patient_record_${mrdFolder}_${Date.now()}.pdf`;
        const filePath = path.join(patientDir, fileName);

        // 5. Build JSON payload for Python
        const payload = JSON.stringify({ patient, reports, checklist });

        // 6. Call Python script
        await new Promise((resolve, reject) => {
            execFile(
                PYTHON_BIN,
                [PYTHON_SCRIPT, payload, filePath],
                { maxBuffer: 10 * 1024 * 1024 },   // 10 MB buffer — plenty for logs
                (error, stdout, stderr) => {
                    if (error) {
                        console.error('Python PDF error:', stderr || error.message);
                        return reject(new Error(stderr || error.message));
                    }
                    console.log('PDF generator:', stdout.trim());
                    resolve();
                }
            );
        });

        // 7. Update DB with generated PDF path
        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE patients SET pdf_path = ? WHERE patient_id = ?",
                [filePath, patientId],
                (err) => { if (err) reject(err); else resolve(); }
            );
        });

        // 8. Send response
        res.json({
            success:  true,
            message:  'PDF generated successfully',
            pdf:      filePath,
            folder:   patientDir,
            fileName: fileName,
            patientInfo: {
                mrd:  patient.mrd_number,
                name: patient.name,
            },
        });

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({
            error:   'PDF generation failed',
            message: error.message,
            stack:   process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
});
// DOWNLOAD patient details PDF
app.get('/api/patients/:patientId/download-pdf', (req, res) => {
    const patientId = req.params.patientId;
    
    db.get("SELECT pdf_path, mrd_number FROM patients WHERE patient_id = ?", [patientId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row || !row.pdf_path) {
            return res.status(404).json({ error: 'PDF not found for this patient' });
        }
        
        const cfg = loadPatientPDFConfig();
        const fullPath = path.join(cfg.saveDir, row.pdf_path);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'PDF file not found on server' });
        }
        
        const filename = `patient_${row.mrd_number || patientId}_details.pdf`;
        res.download(fullPath, filename);
    });
});

// DOWNLOAD patient reports PDF
app.get('/api/patients/:patientId/download-reports-pdf', (req, res) => {
    const patientId = req.params.patientId;
    
    db.get("SELECT reports_pdf_path, mrd_number FROM patients WHERE patient_id = ?", [patientId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row || !row.reports_pdf_path) {
            return res.status(404).json({ error: 'Reports PDF not found for this patient' });
        }
        
        const cfg = loadPatientPDFConfig();
        const fullPath = path.join(cfg.saveDir, row.reports_pdf_path);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Reports PDF file not found on server' });
        }
        
        const filename = `patient_${row.mrd_number || patientId}_reports.pdf`;
        res.download(fullPath, filename);
    });
});

// Helper function to format file size for PDF
function formatFileSizeForPDF(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// GET all items
app.get('/api/items', (req, res) => {
    db.all("SELECT * FROM items ORDER BY name", (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching items');
        }
        res.json(rows);
    });
});

// GET single item
app.get('/api/items/:id', (req, res) => {
    db.get("SELECT * FROM items WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching item');
        }
        res.json(row);
    });
});

// ADD new item
app.post('/api/items', (req, res) => {
    const { name, category, quantity, min_stock, price, currentUser } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Item name is required' });
    }
    
    db.run(
        "INSERT INTO items (name, category, quantity, min_stock, price) VALUES (?, ?, ?, ?, ?)",
        [name, category, quantity || 0, min_stock || 10, price || 0],
        function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error creating item');
            }
            
            logActivity(currentUser, 'Added Store Item', name);
            
            res.json({ 
                id: this.lastID, 
                message: 'Item added successfully',
                item: { id: this.lastID, name, category, quantity, min_stock, price }
            });
        }
    );
});

// UPDATE item
app.put('/api/items/:id', (req, res) => {
    const { name, category, quantity, min_stock, price, currentUser } = req.body;
    
    db.run(
        "UPDATE items SET name=?, category=?, quantity=?, min_stock=?, price=? WHERE id=?",
        [name, category, quantity, min_stock, price, req.params.id],
        function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error updating item');
            }
            
            logActivity(currentUser, 'Updated Store Item', name);
            
            res.json({ 
                message: 'Item updated successfully',
                changes: this.changes
            });
        }
    );
});

// UPDATE item stock only
app.patch('/api/items/:id/stock', (req, res) => {
    const { quantity, currentUser } = req.body;
    
    if (quantity === undefined) {
        return res.status(400).json({ error: 'Quantity is required' });
    }
    
    db.get("SELECT name FROM items WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching item');
        }
        
        if (row) {
            db.run("UPDATE items SET quantity = ? WHERE id = ?", [quantity, req.params.id], function(err) {
                if (err) {
                    return handleDatabaseError(err, res, 'Error updating stock');
                }
                
                logActivity(currentUser || 'System', 'Updated Stock', `${row.name} (Qty: ${quantity})`);
                
                res.json({ 
                    message: 'Stock updated successfully',
                    changes: this.changes
                });
            });
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    });
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'Store Manager';
    
    db.get("SELECT name FROM items WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching item');
        }
        
        if (row) {
            db.run("DELETE FROM items WHERE id = ?", [req.params.id], function(err) {
                if (err) {
                    return handleDatabaseError(err, res, 'Error deleting item');
                }
                
                logActivity(currentUser, 'Deleted Store Item', row.name);
                
                res.json({ 
                    message: 'Item deleted successfully',
                    changes: this.changes
                });
            });
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    });
});

// ==================== ORDERS ENDPOINTS ====================

// GET all orders
app.get('/api/orders', (req, res) => {
    db.all(`
        SELECT o.*, i.name as item_name 
        FROM orders o 
        LEFT JOIN items i ON o.item_id = i.id 
        ORDER BY o.created_at DESC
    `, (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching orders');
        }
        res.json(rows);
    });
});

// CREATE new order
app.post('/api/orders', (req, res) => {
    const { item_id, item_name, ot_name, quantity, urgency, currentUser } = req.body;
    
    if (!item_id || !ot_name || !quantity) {
        return res.status(400).json({ error: 'item_id, ot_name, and quantity are required' });
    }
    
    db.run(
        "INSERT INTO orders (item_id, item_name, ot_name, quantity, urgency, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        [item_id, item_name, ot_name, quantity, urgency || 'medium'],
        function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error creating order');
            }
            
            logActivity(currentUser, 'Placed Order', `${item_name} for ${ot_name}`);
            
            res.json({ 
                id: this.lastID, 
                message: 'Order placed successfully',
                order: { 
                    id: this.lastID, 
                    item_id, 
                    item_name, 
                    ot_name, 
                    quantity, 
                    urgency: urgency || 'medium',
                    status: 'pending'
                }
            });
        }
    );
});

// UPDATE order status
app.put('/api/orders/:id/status', (req, res) => {
    const { status, currentUser } = req.body;
    
    if (!['pending', 'dispatched', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, order) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching order');
        }
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        db.run(
            "UPDATE orders SET status = ? WHERE id = ?",
            [status, req.params.id],
            function(err) {
                if (err) {
                    return handleDatabaseError(err, res, 'Error updating order status');
                }
                
                if ((status === 'dispatched' || status === 'completed') && order.item_id) {
                    db.get("SELECT quantity FROM items WHERE id = ?", [order.item_id], (err, item) => {
                        if (err) {
                            console.error('Error fetching item for inventory update:', err);
                        } else if (item) {
                            const newQuantity = Math.max(0, item.quantity - order.quantity);
                            db.run(
                                "UPDATE items SET quantity = ? WHERE id = ?",
                                [newQuantity, order.item_id],
                                (err) => {
                                    if (err) {
                                        console.error('Error updating inventory:', err);
                                    } else {
                                        console.log(`Inventory updated: Item ${order.item_id} reduced by ${order.quantity}`);
                                        logActivity(currentUser || 'Store Manager', 'Reduced Inventory', 
                                            `${order.item_name} reduced by ${order.quantity} for order #${req.params.id}`);
                                    }
                                }
                            );
                        }
                    });
                }
                
                logActivity(currentUser, 'Updated Order Status', `Order #${req.params.id} - ${status}`);
                
                res.json({ 
                    message: `Order ${status} successfully`,
                    changes: this.changes
                });
            }
        );
    });
});

// DELETE order
app.delete('/api/orders/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    
    db.run("DELETE FROM orders WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return handleDatabaseError(err, res, 'Error deleting order');
        }
        
        logActivity(currentUser, 'Deleted Order', `Order #${req.params.id}`);
        
        res.json({ 
            message: 'Order deleted successfully',
            changes: this.changes
        });
    });
});

// ==================== ACTIVITIES ENDPOINTS ====================

// GET recent activities
app.get('/api/activities', (req, res) => {
    const limit = req.query.limit || 20;
    db.all("SELECT * FROM activities ORDER BY created_at DESC LIMIT ?", [limit], (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching activities');
        }
        res.json(rows);
    });
});

// ==================== ROLES ENDPOINTS ====================

// GET all roles
app.get('/api/roles', (req, res) => {
    db.all("SELECT * FROM roles ORDER BY role_id", (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching roles');
        }
        res.json(rows);
    });
});

// ADD new role
app.post('/api/roles', (req, res) => {
    const { role_id, role_name, permissions, description, user_count, currentUser } = req.body;
    
    if (!role_id || !role_name) {
        return res.status(400).json({ error: 'Role ID and name are required' });
    }
    
    db.run(
        "INSERT INTO roles (role_id, role_name, permissions, description, user_count) VALUES (?, ?, ?, ?, ?)",
        [role_id, role_name, permissions, description, user_count || 0],
        function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error creating role');
            }
            
            logActivity(currentUser || 'Administrator', 'Created Role', role_name);
            
            res.json({ 
                id: this.lastID,
                message: 'Role created successfully'
            });
        }
    );
});

// UPDATE role
app.put('/api/roles/:id', (req, res) => {
    const { role_name, permissions, description, user_count, currentUser } = req.body;
    
    db.run(
        "UPDATE roles SET role_name=?, permissions=?, description=?, user_count=? WHERE role_id=?",
        [role_name, permissions, description, user_count, req.params.id],
        function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error updating role');
            }
            
            logActivity(currentUser, 'Updated Role', role_name);
            
            res.json({ 
                message: 'Role updated successfully',
                changes: this.changes
            });
        }
    );
});

// DELETE role
app.delete('/api/roles/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'Administrator';
    
    db.get("SELECT role_name FROM roles WHERE role_id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching role');
        }
        
        if (row) {
            db.get("SELECT COUNT(*) as user_count FROM users WHERE role_id = ?", [req.params.id], (err, userRow) => {
                if (err) {
                    return handleDatabaseError(err, res, 'Error checking role usage');
                }
                
                if (userRow && userRow.user_count > 0) {
                    return res.status(400).json({ 
                        error: 'Cannot delete role', 
                        message: 'This role is assigned to one or more users. Please reassign or delete those users first.' 
                    });
                }
                
                db.run("DELETE FROM roles WHERE role_id = ?", [req.params.id], function(err) {
                    if (err) {
                        return handleDatabaseError(err, res, 'Error deleting role');
                    }
                    
                    logActivity(currentUser, 'Deleted Role', row.role_name);
                    
                    res.json({ 
                        message: 'Role deleted successfully',
                        changes: this.changes
                    });
                });
            });
        } else {
            res.status(404).json({ error: 'Role not found' });
        }
    });
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// GET all users
app.get('/api/users', (req, res) => {
    db.all(`
        SELECT u.*, r.role_name 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.role_id 
        ORDER BY u.username
    `, (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching users');
        }
        res.json(rows);
    });
});

// CREATE new user
app.post('/api/users', (req, res) => {
    const { username, password, role_id, full_name, currentUser } = req.body;
    
    if (!username || !password || !role_id) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }
    
    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error checking username');
        }
        
        if (row) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const userFullName = full_name || username;
        
        db.run(
            "INSERT INTO users (username, password, role_id, full_name) VALUES (?, ?, ?, ?)",
            [username, password, role_id, userFullName],
            function(err) {
                if (err) {
                    return handleDatabaseError(err, res, 'Error creating user');
                }
                
                db.run(
                    "UPDATE roles SET user_count = user_count + 1 WHERE role_id = ?",
                    [role_id]
                );
                
                logActivity(currentUser, 'Created User', username);
                
                res.json({ 
                    id: this.lastID,
                    message: 'User created successfully'
                });
            }
        );
    });
});

// DELETE user
app.delete('/api/users/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    
    db.get("SELECT username, role_id FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching user');
        }
        
        if (row) {
            db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
                if (err) {
                    return handleDatabaseError(err, res, 'Error deleting user');
                }
                
                if (row.role_id) {
                    db.run(
                        "UPDATE roles SET user_count = user_count - 1 WHERE role_id = ?",
                        [row.role_id]
                    );
                }
                
                logActivity(currentUser, 'Deleted User', row.username);
                
                res.json({ 
                    message: 'User deleted successfully',
                    changes: this.changes
                });
            });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

// ==================== MASTER DATA ENDPOINTS ====================

// GET master data by category
app.get('/api/master/:category', (req, res) => {
    db.all(
        "SELECT * FROM master_data WHERE category = ? ORDER BY display_order",
        [req.params.category],
        (err, rows) => {
            if (err) {
                return handleDatabaseError(err, res, 'Error fetching master data');
            }
            res.json(rows);
        }
    );
});

// GET master data values by category
app.get('/api/master-values/:category', (req, res) => {
    const { category } = req.params;
    
    db.all(
        "SELECT value FROM master_data WHERE category = ? ORDER BY display_order",
        [category],
        (err, rows) => {
            if (err) {
                console.error('Error fetching master data values:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            
            const values = rows.map(row => row.value);
            res.json(values);
        }
    );
});

// GET all master data
app.get('/api/master', (req, res) => {
    db.all("SELECT * FROM master_data ORDER BY category, display_order", (err, rows) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching master data');
        }
        res.json(rows);
    });
});

// ADD master data
app.post('/api/master', (req, res) => {
    const { category, value, display_order, currentUser } = req.body;
    
    if (!category || !value) {
        return res.status(400).json({ error: 'Category and value are required' });
    }
    
    db.run(
        "INSERT INTO master_data (category, value, display_order) VALUES (?, ?, ?)",
        [category, value, display_order || 0],
        function(err) {
            if (err) {
                return handleDatabaseError(err, res, 'Error creating master data');
            }
            
            logActivity(currentUser, 'Added Master Data', `${category}: ${value}`);
            
            res.json({ 
                id: this.lastID,
                message: 'Master data added successfully'
            });
        }
    );
});

// DELETE master data
app.delete('/api/master/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'Administrator';
    
    db.run("DELETE FROM master_data WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return handleDatabaseError(err, res, 'Error deleting master data');
        }
        
        logActivity(currentUser, 'Deleted Master Data', `ID: ${req.params.id}`);
        
        res.json({ 
            message: 'Master data deleted successfully',
            changes: this.changes
        });
    });
});


app.get('/api/music', (req,res)=>{

    db.all(
        "SELECT * FROM music_files ORDER BY upload_date DESC",
        (err,rows)=>{

            if(err){
                return res.status(500).json({error:err.message});
            }

            res.json(rows);
        }
    );

});

app.get('/api/videos',(req,res)=>{

    db.all(
        "SELECT * FROM videos ORDER BY upload_date DESC",
        (err,rows)=>{

            if(err){
                return res.status(500).json({error:err.message});
            }

            res.json(rows);
        }
    );

});
// ==================== MUSIC ENDPOINTS ====================
app.post('/api/music', musicUpload.single('music'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No music file uploaded' });
        }

        const name = req.body.name || req.file.originalname;

        db.run(
            `INSERT INTO music_files (name, filename, file_size, file_type)
             VALUES (?, ?, ?, ?)`,
            [
                name,
                req.file.filename,
                req.file.size,
                req.file.mimetype
            ],
            function(err) {
                if (err) {
                    console.error("Music insert error:", err);
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    success: true,
                    id: this.lastID,
                    filename: req.file.filename
                });
            }
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/music', (req, res) => {
    db.all("SELECT id, name, filename FROM music_files ORDER BY upload_date DESC",
    (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});


// GET music file by ID
app.get('/api/music/:id', (req, res) => {
    db.get("SELECT * FROM music_files WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching music file:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Music file not found' });
        }
        
        const protocol = req.secure ? 'https' : 'http';
        const baseUrl = `${protocol}://${req.get('host')}`;
        const musicWithUrl = {
            ...row,
            file_url: `${baseUrl}/uploads/music/${row.filename}`
        };
        
        res.json(musicWithUrl);
    });
});

// DELETE music file
app.delete('/api/music/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    
    db.get("SELECT filename FROM music_files WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching music file:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Music file not found' });
        }
        
        db.run("DELETE FROM music_files WHERE id = ?", [req.params.id], function(err) {
            if (err) {
                console.error('Error deleting music file:', err);
                return res.status(500).json({ error: err.message });
            }
            
            const filePath = `./uploads/music/${row.filename}`;
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error('Error deleting music file:', unlinkErr);
                }
                
                logActivity(currentUser, 'Deleted Music File', `File ID: ${req.params.id}`);
                
                res.json({ 
                    message: 'Music file deleted successfully',
                    changes: this.changes
                });
            });
        });
    });
});

// ==================== VIDEO ENDPOINTS ====================

// ==================== VIDEO ENDPOINTS ====================

// UPLOAD video
app.post('/api/videos', videoUpload.single('video'), (req, res) => {
    console.log('🎬 Video upload received:', {
        body: req.body,
        file: req.file ? {
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        } : null
    });

    if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
    }

    const { title, ot_name, procedure_type, surgeon, procedure_date, notes, currentUser } = req.body;

    if (!title || !ot_name) {
        // Delete uploaded file if required fields are missing
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
        return res.status(400).json({ error: 'Title and OT name are required' });
    }

    db.run(
        `INSERT INTO videos (title, ot_name, procedure_type, surgeon, procedure_date, notes, filename, original_name, file_size, file_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, ot_name, procedure_type || null, surgeon || null, procedure_date || null, notes || null, 
         req.file.filename, req.file.originalname, req.file.size, req.file.mimetype],
        function(err) {
            if (err) {
                console.error('Error saving video to database:', err);
                // Delete uploaded file if database insert fails
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                });
                return res.status(500).json({ error: err.message });
            }

            const protocol = req.secure ? 'https' : 'http';
            const baseUrl = `${protocol}://${req.get('host')}`;

            logActivity(currentUser, 'Uploaded Video', title);

            res.json({
                success: true,
                id: this.lastID,
                title: title,
                filename: req.file.filename,
                original_name: req.file.originalname,
                file_size: req.file.size,
                file_url: `${baseUrl}/uploads/videos/${req.file.filename}`,
                message: 'Video uploaded successfully'
            });
        }
    );
});

app.get('/api/videos', (req, res) => {
    db.all("SELECT id, title, ot_name, filename FROM videos ORDER BY upload_date DESC",
    (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET single video
app.get('/api/videos/:id', (req, res) => {
    db.get("SELECT * FROM videos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching video:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const protocol = req.secure ? 'https' : 'http';
        const baseUrl = `${protocol}://${req.get('host')}`;
        const videoWithUrl = {
            ...row,
            file_url: `${baseUrl}/uploads/videos/${row.filename}`
        };
        
        res.json(videoWithUrl);
    });
});

// DOWNLOAD video
app.get('/api/videos/:id/download', (req, res) => {
    db.get("SELECT filename, original_name, file_type FROM videos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching video:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const filePath = `./uploads/videos/${row.filename}`;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Video file not found on server' });
        }
        
        res.setHeader('Content-Type', row.file_type);
        res.setHeader('Content-Disposition', `attachment; filename="${row.original_name}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    });
});

// DELETE video
app.delete('/api/videos/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    
    db.get("SELECT filename, title FROM videos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching video:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        db.run("DELETE FROM videos WHERE id = ?", [req.params.id], function(err) {
            if (err) {
                console.error('Error deleting video:', err);
                return res.status(500).json({ error: err.message });
            }
            
            const filePath = `./uploads/videos/${row.filename}`;
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error('Error deleting video file:', unlinkErr);
                }
                
                logActivity(currentUser, 'Deleted Video', row.title);
                
                res.json({ 
                    message: 'Video deleted successfully',
                    changes: this.changes
                });
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// REPLACE your existing:  app.post('/api/clean-reports', ...)

// Python binary — Windows uses 'python', Linux/Mac uses 'python3'

const CLEAN_PDF_SCRIPT     = path.join(__dirname, 'generate_clean_report_pdf.py');
const PATIENT_PDF_SCRIPT   = path.join(__dirname, 'generate_patient_pdf.py');

// ── Helper: build folder path for clean reports ───────────────────────────────
// Structure: <HospitalBaseDir> / OT / <ot_name> / Clean / <YYYY-MM-DD> / filename.pdf
function getCleanReportPDFPath(baseDir, otName, reportDate, reportId) {
    const safeOT   = otName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeDate = reportDate.replace(/[^0-9\-]/g, '').substring(0, 10); // YYYY-MM-DD
    const folder   = path.join(baseDir, 'OT', safeOT, 'Clean', safeDate);
    const filename = `clean_report_${safeOT}_${safeDate}_${Date.now()}.pdf`;
    return { folder, filename, fullPath: path.join(folder, filename) };
}

// ── POST /api/clean-reports ───────────────────────────────────────────────────
app.post('/api/clean-reports', cleanReportUpload.array('photos', 10), (req, res) => {
    const {
        ot_name, report_date, report_time, verified_by, notes, status, next_check_date, currentUser
    } = req.body;

    if (!ot_name || !report_date || !report_time || !verified_by || !status) {
        return res.status(400).json({ error: 'OT name, date, time, verified by, and status are required' });
    }

    const reportId = 'CLEAN-' + Date.now();

    db.run(
        `INSERT INTO clean_reports (report_id, ot_name, report_date, report_time, verified_by, notes, status, next_check_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportId, ot_name, report_date, report_time, verified_by, notes, status, next_check_date],
        async function(err) {
            if (err) {
                console.error('Error saving clean report:', err);
                return res.status(500).json({ error: err.message });
            }

            // Save photos to DB
            let savedPhotos = [];
            if (req.files && req.files.length > 0) {
                const photosData = req.files.map(file => ({
                    report_id:     reportId,
                    filename:      file.filename,
                    original_name: file.originalname,
                    file_size:     file.size,
                    file_type:     file.mimetype,
                    // Full disk path so Python can embed the image in PDF
                    file_path:     path.join(__dirname, 'uploads', 'clean-reports', file.filename)
                }));

                const stmt = db.prepare(`
                    INSERT INTO clean_report_photos (report_id, filename, original_name, file_size, file_type)
                    VALUES (?, ?, ?, ?, ?)
                `);

                for (const photo of photosData) {
                    await new Promise((resolve, reject) => {
                        stmt.run([
                            photo.report_id,
                            photo.filename,
                            photo.original_name,
                            photo.file_size,
                            photo.file_type
                        ], function(err) {
                            if (err) { console.error('Error saving photo:', err); reject(err); }
                            else resolve();
                        });
                    });
                    savedPhotos.push(photo);
                }
                stmt.finalize();
            }

            // Send response immediately — PDF generation runs after
            logActivity(currentUser, 'Created Clean Report',
                `OT: ${ot_name}, Date: ${report_date}, Status: ${status}`);

            res.json({
                id:             this.lastID,
                report_id:      reportId,
                message:        'Clean report created successfully',
                photos_uploaded: req.files ? req.files.length : 0
            });

            // ── AUTO-GENERATE PDF in background ──────────────────────────────
            try {
                const cfg     = loadPatientPDFConfig();          // reuse same base dir config
                // Go one level up: D:/Hospital_Data/Patients -> D:/Hospital_Data
                const baseDir = path.dirname(cfg.saveDir || 'D:/Hospital_Data/Patients');
                const { folder, filename, fullPath } = getCleanReportPDFPath(
                    baseDir, ot_name, report_date, reportId
                );

                // Create folder tree if not exists
                if (!fs.existsSync(folder)) {
                    fs.mkdirSync(folder, { recursive: true });
                }

                const payload = JSON.stringify({
                    report: {
                        report_id:      reportId,
                        ot_name,
                        report_date,
                        report_time,
                        verified_by,
                        notes:          notes || '',
                        status,
                        next_check_date: next_check_date || ''
                    },
                    photos: savedPhotos   // includes file_path so Python can embed images
                });

                execFile(
                    PYTHON_BIN,
                    [CLEAN_PDF_SCRIPT, payload, fullPath],
                    { maxBuffer: 10 * 1024 * 1024 },
                    (error, stdout, stderr) => {
                        if (error) {
                            console.error('Clean report PDF error:', stderr || error.message);
                            return;
                        }
                        console.log(`Clean report PDF saved: ${fullPath}`);

                        // Save PDF path back to DB for future reference
                        db.run(
                            `UPDATE clean_reports SET pdf_path = ? WHERE report_id = ?`,
                            [fullPath, reportId],
                            (dbErr) => {
                                if (dbErr) console.error('Error saving PDF path to DB:', dbErr);
                            }
                        );
                    }
                );

            } catch (pdfErr) {
                console.error('Error triggering clean report PDF generation:', pdfErr);
                // Don't affect the response — report was saved successfully
            }
        }
    );
});
// GET all clean reports with optional search
app.get('/api/clean-reports', (req, res) => {
    const { search = '' } = req.query;
    
    let query = `
        SELECT cr.*, 
               COUNT(crp.id) as photo_count
        FROM clean_reports cr
        LEFT JOIN clean_report_photos crp ON cr.report_id = crp.report_id
    `;
    
    const params = [];
    
    if (search) {
        query += ` WHERE cr.ot_name LIKE ? OR cr.verified_by LIKE ? OR cr.report_id LIKE ?`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ` GROUP BY cr.report_id ORDER BY cr.created_at DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching clean reports:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json(rows);
    });
});

// GET clean report by ID with photos
app.get('/api/clean-reports/:id', (req, res) => {
    const reportId = req.params.id;
    
    db.get("SELECT * FROM clean_reports WHERE report_id = ?", [reportId], (err, report) => {
        if (err) {
            console.error('Error fetching clean report:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!report) {
            return res.status(404).json({ error: 'Clean report not found' });
        }
        
        db.all("SELECT * FROM clean_report_photos WHERE report_id = ?", [reportId], (err, photos) => {
            if (err) {
                console.error('Error fetching photos:', err);
                return res.status(500).json({ error: err.message });
            }
            
            const protocol = req.secure ? 'https' : 'http';
            const baseUrl = `${protocol}://${req.get('host')}`;
            const photosWithUrls = photos.map(photo => ({
                ...photo,
                photo_url: `${baseUrl}/uploads/clean-reports/${photo.filename}`
            }));
            
            res.json({
                ...report,
                photos: photosWithUrls,
                photo_count: photos.length
            });
        });
    });
});

// DELETE clean report
app.delete('/api/clean-reports/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    const reportId = req.params.id;
    
    db.get("SELECT ot_name FROM clean_reports WHERE report_id = ?", [reportId], (err, row) => {
        if (err) {
            console.error('Error fetching clean report:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Clean report not found' });
        }
        
        db.all("SELECT filename FROM clean_report_photos WHERE report_id = ?", [reportId], (err, photos) => {
            if (err) {
                console.error('Error fetching photos for deletion:', err);
            } else {
                photos.forEach(photo => {
                    const filePath = `./uploads/clean-reports/${photo.filename}`;
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                            console.error('Error deleting photo file:', unlinkErr);
                        }
                    });
                });
                
                db.run("DELETE FROM clean_report_photos WHERE report_id = ?", [reportId]);
            }
            
            db.run("DELETE FROM clean_reports WHERE report_id = ?", [reportId], function(err) {
                if (err) {
                    console.error('Error deleting clean report:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                logActivity(currentUser, 'Deleted Clean Report', 
                    `Report ID: ${reportId}, OT: ${row.ot_name}`);
                
                res.json({ 
                    message: 'Clean report deleted successfully',
                    changes: this.changes
                });
            });
        });
    });
});

// Save PDF for clean report
app.post('/api/clean-reports/:id/save-pdf', async (req, res) => {
    const reportId = req.params.id;
    
    try {
        console.log(`📄 Saving PDF for report: ${reportId}`);
        
        const report = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM clean_reports WHERE report_id = ?", [reportId], (err, row) => {
                if (err) {
                    console.error('Error fetching report:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
        
        if (!report) {
            console.error(`Report not found: ${reportId}`);
            return res.status(404).json({ 
                success: false,
                error: 'Report not found',
                message: `Clean report with ID ${reportId} was not found`
            });
        }
        
        console.log(`Found report: ${report.ot_name}, Date: ${report.report_date}`);
        
        const photos = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM clean_report_photos WHERE report_id = ?", [reportId], (err, rows) => {
                if (err) {
                    console.error('Error fetching photos:', err);
                    reject(err);
                } else {
                    console.log(`Found ${rows ? rows.length : 0} photos for report`);
                    resolve(rows || []);
                }
            });
        });
        
        const pdfFolder = './uploads/clean-reports/pdfs/';
        if (!fs.existsSync(pdfFolder)) {
            console.log(`Creating PDF folder: ${pdfFolder}`);
            fs.mkdirSync(pdfFolder, { recursive: true });
        }
        
        const safeOTName = report.ot_name.replace(/[^a-zA-Z0-9]/g, '-');
        const pdfFilename = `clean-report-${safeOTName}-${report.report_id}.pdf`;
        const pdfPath = path.join(pdfFolder, pdfFilename);
        
        console.log(`Generating PDF: ${pdfFilename}`);
        
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4',
            info: {
                Title: `Clean Report - ${report.ot_name}`,
                Author: 'Hospital Management System',
                Subject: 'OT Clean Report',
                Keywords: 'clean,report,OT,hospital',
                CreationDate: new Date()
            }
        });
        
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);
        
        // PDF Header
        doc.fontSize(24)
           .fillColor('#2c3e50')
           .font('Helvetica-Bold')
           .text('HOSPITAL MANAGEMENT SYSTEM', { 
               align: 'center',
               underline: true 
           })
           .moveDown(0.5);
        
        doc.fontSize(18)
           .fillColor('#3498db')
           .text('OPERATION THEATER CLEAN REPORT', { 
               align: 'center' 
           })
           .moveDown();
        
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .strokeColor('#3498db')
           .lineWidth(2)
           .stroke()
           .moveDown();
        
        doc.fontSize(12)
           .fillColor('#7f8c8d')
           .font('Helvetica')
           .text(`Report ID: ${report.report_id}`, { align: 'right' })
           .text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' })
           .moveDown();
        
        doc.fontSize(16)
           .fillColor('#2c3e50')
           .font('Helvetica-Bold')
           .text('1. BASIC INFORMATION', { underline: true })
           .moveDown(0.5);
        
        doc.fontSize(12)
           .fillColor('#34495e')
           .font('Helvetica');
        
        const details = [
            ['Operation Theater:', report.ot_name],
            ['Report Date:', new Date(report.report_date).toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })],
            ['Report Time:', report.report_time],
            ['Verified By:', report.verified_by],
            ['Next Check Date:', report.next_check_date ? 
                new Date(report.next_check_date).toLocaleDateString() : 'Not specified']
        ];
        
        details.forEach(([label, value]) => {
            doc.font('Helvetica-Bold').text(label, { continued: true });
            doc.font('Helvetica').fillColor('#3498db').text(` ${value}`).fillColor('#34495e');
        });
        
        doc.moveDown();
        
        doc.fontSize(16)
           .fillColor('#2c3e50')
           .font('Helvetica-Bold')
           .text('2. CLEAN STATUS ASSESSMENT', { underline: true })
           .moveDown(0.5);
        
        const statusColors = {
            'excellent': '#27ae60',
            'good': '#2ecc71', 
            'satisfactory': '#f39c12',
            'needs_improvement': '#e74c3c'
        };
        
        const statusText = report.status.toUpperCase();
        const statusColor = statusColors[report.status] || '#3498db';
        
        doc.rect(50, doc.y, 200, 30)
           .fillColor(statusColor + '20')
           .fillAndStroke(statusColor, statusColor)
           .fillColor(statusColor);
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .text(statusText, 60, doc.y + 8)
           .moveDown(1.5);
        
        const statusDescriptions = {
            'excellent': '✓ Perfect condition, exceeds all cleanliness standards',
            'good': '✓ Meets all standards, minor improvements possible',
            'satisfactory': '⚠ Acceptable but needs attention in some areas',
            'needs_improvement': '✗ Requires immediate cleaning and improvement'
        };
        
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#2c3e50')
           .text(statusDescriptions[report.status] || 'Status not specified');
        
        doc.moveDown();
        
        if (report.notes && report.notes.trim()) {
            doc.fontSize(16)
               .fillColor('#2c3e50')
               .font('Helvetica-Bold')
               .text('3. NOTES & OBSERVATIONS', { underline: true })
               .moveDown(0.5);
            
            doc.fontSize(12)
               .font('Helvetica')
               .fillColor('#34495e')
               .text(report.notes, {
                   align: 'left',
                   lineGap: 5,
                   indent: 20,
                   paragraphGap: 8
               })
               .moveDown();
        }
        
        if (photos.length > 0) {
            doc.addPage();
            
            doc.fontSize(16)
               .fillColor('#2c3e50')
               .font('Helvetica-Bold')
               .text('4. CLEANLINESS PHOTO EVIDENCE', { 
                   align: 'center',
                   underline: true 
               })
               .moveDown();
            
            doc.fontSize(10)
               .fillColor('#7f8c8d')
               .font('Helvetica')
               .text(`Total Photos: ${photos.length}`, { align: 'center' })
               .moveDown(1);
            
            const photoWidth = 240;
            const photoHeight = 180;
            const margin = 20;
            let x = 50;
            let y = doc.y;
            let photosAdded = 0;
            
            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                
                if (photosAdded > 0 && photosAdded % 2 === 0) {
                    x = 50;
                    y += photoHeight + 40;
                    
                    if (y + photoHeight > 700) {
                        doc.addPage();
                        y = 50;
                    }
                }
                
                try {
                    const photoPath = path.join(__dirname, 'uploads', 'clean-reports', photo.filename);
                    
                    if (fs.existsSync(photoPath)) {
                        doc.rect(x, y, photoWidth, photoHeight)
                           .fillColor('#f8f9fa')
                           .fillAndStroke('#ddd', '#ddd');
                        
                        try {
                            doc.image(photoPath, x + 5, y + 5, {
                                width: photoWidth - 10,
                                height: photoHeight - 30,
                                align: 'center',
                                valign: 'center'
                            });
                        } catch (imgError) {
                            doc.fontSize(10)
                               .fillColor('#999')
                               .text('Image unavailable', x, y + photoHeight/2, {
                                   width: photoWidth,
                                   align: 'center'
                               });
                        }
                        
                        doc.fontSize(8)
                           .fillColor('#666')
                           .text(`Photo ${i + 1}: ${photo.original_name || 'Clean photo'}`, x, y + photoHeight - 20, {
                               width: photoWidth,
                               align: 'center'
                           });
                        
                    } else {
                        doc.rect(x, y, photoWidth, photoHeight)
                           .strokeColor('#ddd')
                           .stroke();
                        
                        doc.fontSize(10)
                           .fillColor('#999')
                           .text('Photo file not found', x, y + photoHeight/2, {
                               width: photoWidth,
                               align: 'center'
                           });
                    }
                    
                } catch (error) {
                    console.error(`Error processing photo ${i + 1}:`, error);
                }
                
                x += photoWidth + margin;
                photosAdded++;
            }
            
            doc.moveDown(2);
        }
        
        doc.addPage();
        
        doc.fontSize(14)
           .fillColor('#2c3e50')
           .font('Helvetica-Bold')
           .text('5. VERIFICATION & APPROVAL', { 
               align: 'center',
               underline: true 
           })
           .moveDown(2);
        
        const signatureY = doc.y + 100;
        
        doc.moveTo(100, signatureY)
           .lineTo(250, signatureY)
           .strokeColor('#000')
           .stroke();
        
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text('Verified By:', 100, signatureY + 5)
           .fontSize(12)
           .fillColor('#2c3e50')
           .text(report.verified_by, 100, signatureY + 20);
        
        doc.moveTo(350, signatureY)
           .lineTo(500, signatureY)
           .strokeColor('#000')
           .stroke();
        
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text('Date:', 350, signatureY + 5)
           .fontSize(12)
           .fillColor('#2c3e50')
           .text(new Date(report.report_date).toLocaleDateString(), 350, signatureY + 20);
        
        doc.moveDown(4);
        
        const footerY = 750;
        
        doc.fontSize(9)
           .fillColor('#7f8c8d')
           .text('─'.repeat(80), 50, footerY, { align: 'center' })
           .moveDown(0.3);
        
        doc.fontSize(8)
           .fillColor('#95a5a6')
           .text('This is an electronically generated document. No physical signature required.', 50, footerY + 15, {
               align: 'center'
           })
           .text(`Document ID: ${report.report_id} | Generated by Hospital Management System v1.0`, 50, footerY + 30, {
               align: 'center'
           })
           .text(`Page ${doc.bufferedPageRange().count} of ${doc.bufferedPageRange().count}`, 50, footerY + 45, {
               align: 'center'
           });
        
        doc.end();
        
        await new Promise((resolve, reject) => {
            stream.on('finish', () => {
                console.log(`✅ PDF saved successfully: ${pdfPath}`);
                resolve();
            });
            
            stream.on('error', (err) => {
                console.error('❌ Error writing PDF:', err);
                reject(err);
            });
        });
        
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host');
        const downloadUrl = `${protocol}://${host}/uploads/clean-reports/pdfs/${pdfFilename}`;
        
        res.json({ 
            success: true, 
            message: 'PDF saved successfully',
            report_id: report.report_id,
            filename: pdfFilename,
            file_path: pdfPath,
            file_size: fs.statSync(pdfPath).size,
            download_url: `/uploads/clean-reports/pdfs/${pdfFilename}`,
            full_download_url: downloadUrl,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in save-pdf endpoint:', error);
        
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// GET clean report PDF
app.get('/api/clean-reports/:id/pdf', async (req, res) => {
    const reportId = req.params.id;
    
    try {
        const report = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM clean_reports WHERE report_id = ?", [reportId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!report) {
            return res.status(404).json({ error: 'Clean report not found' });
        }
        
        const photos = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM clean_report_photos WHERE report_id = ?", [reportId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4',
            info: {
                Title: `Clean Report - ${report.report_id}`,
                Author: 'Hospital Management System',
                Subject: 'OT Clean Report',
                Keywords: 'clean,report,OT,hospital',
                CreationDate: new Date()
            }
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="clean-report-${report.report_id}.pdf"`);
        
        doc.pipe(res);
        
        doc.fontSize(20)
           .fillColor('#2c3e50')
           .text('HOSPITAL MANAGEMENT SYSTEM', { align: 'center' });
        
        doc.fontSize(16)
           .fillColor('#3498db')
           .text('CLEAN REPORT CERTIFICATE', { align: 'center' })
           .moveDown();
        
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .strokeColor('#3498db')
           .stroke()
           .moveDown();
        
        doc.fontSize(12)
           .fillColor('#2c3e50');
        
        const details = [
            ['Report ID:', report.report_id],
            ['OT Name:', report.ot_name],
            ['Report Date:', new Date(report.report_date).toLocaleDateString()],
            ['Report Time:', report.report_time],
            ['Verified By:', report.verified_by],
            ['Status:', report.status.toUpperCase()],
            ['Next Check Date:', report.next_check_date ? new Date(report.next_check_date).toLocaleDateString() : 'N/A']
        ];
        
        details.forEach(([label, value]) => {
            doc.text(label, { continued: true, paragraphGap: 5 })
               .fillColor('#3498db')
               .text(value)
               .fillColor('#2c3e50');
        });
        
        doc.moveDown();
        
        if (report.notes) {
            doc.fontSize(14)
               .text('Notes & Observations:', { underline: true })
               .moveDown(0.5);
            
            doc.fontSize(12)
               .fillColor('#34495e')
               .text(report.notes, {
                   align: 'left',
                   lineGap: 5,
                   indent: 20
               })
               .moveDown();
        }
        
        if (photos.length > 0) {
            doc.addPage();
            
            doc.fontSize(14)
               .fillColor('#2c3e50')
               .text('Clean Report Photos', { align: 'center', underline: true })
               .moveDown();
            
            doc.fontSize(10)
               .fillColor('#7f8c8d')
               .text(`Total Photos: ${photos.length}`, { align: 'center' })
               .moveDown();
            
            const photoWidth = 240;
            const photoHeight = 160;
            const margin = 20;
            let x = 50;
            let y = doc.y;
            
            photos.forEach((photo, index) => {
                if (index > 0 && index % 2 === 0) {
                    x = 50;
                    y += photoHeight + 50;
                    
                    if (y + photoHeight > 700) {
                        doc.addPage();
                        y = 50;
                    }
                }
                
                try {
                    const photoPath = path.join(__dirname, 'uploads', 'clean-reports', photo.filename);
                    
                    if (fs.existsSync(photoPath)) {
                        doc.rect(x, y, photoWidth, photoHeight)
                           .strokeColor('#ddd')
                           .stroke();
                        
                        doc.image(photoPath, x + 2, y + 2, {
                            width: photoWidth - 4,
                            height: photoHeight - 4,
                            align: 'center',
                            valign: 'center'
                        });
                        
                        doc.fontSize(8)
                           .fillColor('#666')
                           .text(`Photo ${index + 1}`, x, y + photoHeight + 5, {
                               width: photoWidth,
                               align: 'center'
                           });
                    } else {
                        doc.rect(x, y, photoWidth, photoHeight)
                           .strokeColor('#ddd')
                           .stroke();
                        
                        doc.fontSize(10)
                           .fillColor('#999')
                           .text('Photo not available', x, y + photoHeight/2, {
                               width: photoWidth,
                               align: 'center'
                           });
                    }
                    
                } catch (error) {
                    console.error('Error adding photo to PDF:', error);
                }
                
                x += photoWidth + margin;
            });
        }
        
        doc.addPage();
        const footerY = 750;
        
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text('Report generated by Hospital Management System', 50, footerY, {
               align: 'center'
           })
           .text(`Generated on: ${new Date().toLocaleString()}`, 50, footerY + 15, {
               align: 'center'
           })
           .text(`Report ID: ${report.report_id}`, 50, footerY + 30, {
               align: 'center'
           });
        
        doc.end();
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// ==================== OT SCHEDULING ENDPOINTS ====================

// GET all OT schedules
app.get('/api/ot-schedules', (req, res) => {

    db.all(
        `SELECT *
         FROM ot_schedules
         ORDER BY schedule_date DESC, start_time ASC`,
        (err, rows) => {

            if (err) {
                console.error('Error fetching OT schedules:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json(rows || []);
        }
    );

});
// CREATE new OT schedule
app.post('/api/ot-schedules', (req, res) => {

    const {
        patient_name,
        mrd_number,
        procedure_type,
        surgeon,
        ot_name,
        schedule_date,
        start_time,
        end_time,
        status,
        notes,
        created_by
    } = req.body;

    // Validate required fields — end_time is optional
    if (!patient_name || !mrd_number || !procedure_type || !surgeon ||
        !ot_name || !schedule_date || !start_time) {

        return res.status(400).json({
            error: 'All required fields must be filled'
        });
    }

    // Check OT conflict by start_time only (end_time is no longer required)
    const conflictQuery = `
        SELECT * FROM ot_schedules
        WHERE ot_name = ?
        AND schedule_date = ?
        AND start_time = ?
        AND status != 'Cancelled'
    `;

    db.get(
        conflictQuery,
        [ ot_name, schedule_date, start_time ],
        (err, conflict) => {

            if (err) {
                console.error("Conflict check error:", err);
                return res.status(500).json({ error: err.message });
            }

            if (conflict) {
                return res.status(409).json({
                    error: 'OT already scheduled at this time',
                    message: `OT ${ot_name} already has a surgery scheduled at ${start_time} on ${schedule_date} for ${conflict.patient_name}`,
                    conflicting_schedule: conflict
                });
            }

            const scheduleId = 'OT-' + Date.now().toString().slice(-6);

db.run(
`INSERT INTO ot_schedules
(schedule_id, patient_name, mrd_number, procedure_type, surgeon,
 ot_name, schedule_date, start_time, end_time, status, notes, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
[
 scheduleId,
 patient_name,
 mrd_number,
 procedure_type,
 surgeon,
 ot_name,
 schedule_date,
 start_time,
 end_time,
 status || 'Scheduled',
 notes,
 created_by
],
function(err){

    if(err){
        console.error("Schedule insert error:", err);
        return res.status(500).json({error: err.message});
    }

    // ✅ UPDATE PATIENT TABLE
    db.run(
    `UPDATE patients
     SET operation_ot = ?,
         operation_date = ?,
         operation_time = ?,
         operation_doctor = ?
     WHERE mrd_number = ?`,
    [ot_name, schedule_date, start_time, surgeon, mrd_number],
    function(err){
        if(err){
            console.error("Patient update error:", err);
        } else {
            console.log("Patient updated:", this.changes);
        }
    });

    res.json({
        success: true,
        schedule_id: scheduleId,
        message: "OT scheduled successfully"
    });
});
        }
    );
});


// UPDATE OT schedule
app.put('/api/ot-schedules/:id', (req, res) => {
    const {
        patient_name, mrd_number, procedure_type, surgeon,
        ot_name, schedule_date, start_time, notes
    } = req.body;
    
    // Check for conflicts by start_time only, excluding current schedule
    const conflictQuery = `
        SELECT * FROM ot_schedules 
        WHERE ot_name = ? 
        AND schedule_date = ?
        AND start_time = ?
        AND id != ?
        AND status != 'Cancelled'
    `;
    
    db.get(
        conflictQuery,
        [ ot_name, schedule_date, start_time, req.params.id ],
        (err, conflict) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (conflict) {
                return res.status(409).json({ 
                    error: 'OT already scheduled at this time',
                    message: `OT ${ot_name} already has a surgery at ${start_time} on ${schedule_date} for ${conflict.patient_name}`,
                    conflicting_schedule: conflict
                });
            }
            
            db.run(
                `UPDATE ot_schedules 
                 SET patient_name=?, mrd_number=?, procedure_type=?, surgeon=?,
                     ot_name=?, schedule_date=?, start_time=?,
                     notes=?
                 WHERE id=?`,
                [patient_name, mrd_number, procedure_type, surgeon,
                 ot_name, schedule_date, start_time,
                 notes, req.params.id],
                function(err) {
                    if (err) {
                        console.error('Error updating OT schedule:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    res.json({
                        message: 'OT schedule updated successfully',
                        changes: this.changes
                    });
                }
            );
        }
    );
});

// DELETE OT schedule
app.delete('/api/ot-schedules/:id', (req, res) => {
    const currentUser = req.query.currentUser || 'System';
    
    db.run("DELETE FROM ot_schedules WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting OT schedule:', err);
            return res.status(500).json({ error: err.message });
        }
        
        logActivity(currentUser, 'Deleted OT Schedule', `Schedule ID: ${req.params.id}`);
        
        res.json({
            message: 'OT schedule deleted successfully',
            changes: this.changes
        });
    });
});

// ==================== DASHBOARD STATS ====================

// GET dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
    const stats = {};
    
    db.get("SELECT COUNT(*) as count FROM patients", (err, row) => {
        if (err) {
            return handleDatabaseError(err, res, 'Error fetching patient stats');
        }
        stats.patients = row ? row.count : 0;
        
        db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
            if (err) {
                return handleDatabaseError(err, res, 'Error fetching item stats');
            }
            stats.items = row ? row.count : 0;
            
            db.get("SELECT COUNT(*) as count FROM roles", (err, row) => {
                if (err) {
                    return handleDatabaseError(err, res, 'Error fetching role stats');
                }
                stats.roles = row ? row.count : 0;
                
                db.get("SELECT COUNT(*) as count FROM master_data", (err, row) => {
                    if (err) {
                        return handleDatabaseError(err, res, 'Error fetching master data stats');
                    }
                    stats.master_data = row ? row.count : 0;
                    
                    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                        if (err) {
                            return handleDatabaseError(err, res, 'Error fetching user stats');
                        }
                        stats.total_users = row ? row.count : 0;
                        
                        db.get("SELECT COUNT(*) as count FROM items WHERE quantity <= min_stock", (err, row) => {
                            if (err) {
                                return handleDatabaseError(err, res, 'Error fetching low stock stats');
                            }
                            stats.low_stock_items = row ? row.count : 0;
                            
                            db.get("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'", (err, row) => {
                                if (err) {
                                    return handleDatabaseError(err, res, 'Error fetching order stats');
                                }
                                stats.pending_orders = row ? row.count : 0;
                                
                                db.get("SELECT COUNT(*) as count FROM patient_reports", (err, row) => {
                                    if (err) {
                                        return handleDatabaseError(err, res, 'Error fetching report stats');
                                    }
                                    stats.total_reports = row ? row.count : 0;
                                    
                                    db.get("SELECT COUNT(*) as count FROM music_files", (err, row) => {
                                        if (err) {
                                            console.error('Error fetching music stats:', err);
                                        }
                                        stats.total_music_files = row ? row.count : 0;
                                        
                                        db.get("SELECT COUNT(*) as count FROM videos", (err, row) => {
                                            if (err) {
                                                console.error('Error fetching video stats:', err);
                                            }
                                            stats.total_videos = row ? row.count : 0;
                                            
                                            db.get("SELECT COUNT(*) as count FROM clean_reports", (err, row) => {
                                                if (err) {
                                                    console.error('Error fetching clean report stats:', err);
                                                }
                                                stats.total_clean_reports = row ? row.count : 0;
                                                
                                                db.get("SELECT COUNT(*) as count FROM ot_schedules", (err, row) => {
                                                    if (err) {
                                                        console.error('Error fetching OT schedule stats:', err);
                                                    }
                                                    stats.total_ot_schedules = row ? row.count : 0;
                                                    
                                                    db.get("SELECT COUNT(*) as count FROM patient_biometry", (err, row) => {
                                                        if (err) {
                                                            console.error('Error fetching biometry stats:', err);
                                                        }
                                                        stats.total_biometry = row ? row.count : 0;
                                                        
                                                        db.get("SELECT COUNT(*) as count FROM patient_lab_results", (err, row) => {
                                                            if (err) {
                                                                console.error('Error fetching lab results stats:', err);
                                                            }
                                                            stats.total_lab_results = row ? row.count : 0;
                                                            
                                                            res.json(stats);
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// ==================== DEVICE ENDPOINTS ====================

app.get('/api/device-info', (req, res) => {
    res.json({
        deviceName: 'OT Recording Device',
        deviceType: 'camera',
        videosCount: 5,
        status: 'online'
    });
});

app.get('/api/videos/list', (req, res) => {
    res.json([
        {
            id: '1',
            name: 'Surgery_Recording_1.mp4',
            size: 154289012,
            duration: '00:45:23',
            date: new Date().toISOString()
        }
    ]);
});

// ==================== PATIENT PDF GENERATION ====================

const PDF_CONFIG_FILE = './pdf_config.json';
const DEFAULT_PDF_DIR  = './uploads/patients/pdfs';

function loadPDFConfig() {
    try {
        if (fs.existsSync(PDF_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(PDF_CONFIG_FILE, 'utf8'));
        }
    } catch (e) { console.error('PDF config read error:', e); }
    return { saveDir: null };
}

function savePDFConfig(config) {
    try { fs.writeFileSync(PDF_CONFIG_FILE, JSON.stringify(config, null, 2)); }
    catch (e) { console.error('PDF config write error:', e); }
}

// GET current save folder
app.get('/api/pdf-config', (req, res) => {
    const cfg = loadPDFConfig();
    res.json({ saveDir: cfg.saveDir, isConfigured: !!cfg.saveDir });
});

// POST set save folder
app.post('/api/pdf-config', (req, res) => {
    const { saveDir } = req.body;
    if (!saveDir) return res.status(400).json({ error: 'saveDir is required' });
    try {
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
        savePDFConfig({ saveDir });
        res.json({ success: true, saveDir });
    } catch (e) {
        res.status(500).json({ error: 'Cannot create directory: ' + e.message });
    }
});


// Also saves a copy to the configured directory
app.post('/api/patients/:mrd/pdf', (req, res) => {
    const mrd = req.params.mrd;

    db.get("SELECT * FROM patients WHERE mrd_number = ?", [mrd], (err, patient) => {
        if (err)      return res.status(500).json({ error: err.message });
        if (!patient) return res.status(404).json({ error: 'Patient not found: ' + mrd });

        let checklist = {};
        try { checklist = patient.checklist ? JSON.parse(patient.checklist) : {}; } catch (_) {}

        // Merge flat columns into checklist for convenience
        const p = { ...patient, checklist };

        // ── resolve save directory ──────────────────────────────────
        const cfg    = loadPDFConfig();
        const saveDir = cfg.saveDir || DEFAULT_PDF_DIR;
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

        const safeMRD   = mrd.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const fileName  = `${safeMRD}.pdf`;
        const filePath  = path.join(saveDir, fileName);

        // ── PDFKit document ────────────────────────────────────────
        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true,
            info: { Title: `Patient Record - ${mrd}`, Author: 'WIESPL HMS', Subject: 'Patient Medical Record' }
        });

        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => {
            const pdfBuf = Buffer.concat(chunks);
            // save copy
            try { fs.writeFileSync(filePath, pdfBuf); } catch (e) { console.error('PDF file write error:', e); }
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': pdfBuf.length
            });
            res.send(pdfBuf);
        });

        // ── helpers ─────────────────────────────────────────────────
        const PW = 595.28, ML = 40, MR = 40, CW = PW - ML - MR;
        const C = { header: '#185A9D', section: '#EBF4FF', sectionText: '#0E366B',
                    gray: '#666', border: '#B4C8E6', alt: '#F8FAFD', black: '#1E1E1E' };

        function hline(y, color = C.border, w = 1) {
            doc.save().strokeColor(color).lineWidth(w).moveTo(ML, y).lineTo(PW - MR, y).stroke().restore();
        }

        function sectionHeader(title) {
            const y = doc.y;
            doc.rect(ML, y, CW, 16).fill(C.section).stroke(C.border);
            doc.fontSize(9).fillColor(C.sectionText).font('Helvetica-Bold')
               .text(title, ML + 6, y + 4, { width: CW - 12 });
            doc.moveDown(0.2);
        }

        function kvRow(pairs, cols = 2) {
            const colW = CW / cols;
            const rowH = 18;
            for (let i = 0; i < pairs.length; i += cols) {
                const y = doc.y;
                if (y + rowH > 800) { doc.addPage(); drawPageHeader(); }
                if (Math.floor(i / cols) % 2 === 0) doc.rect(ML, y, CW, rowH).fill(C.alt).stroke('white');
                for (let c = 0; c < cols; c++) {
                    const pair = pairs[i + c];
                    if (!pair) continue;
                    const x = ML + c * colW;
                    const label = pair[0] || '', value = (pair[1] == null || pair[1] === '') ? '—' : String(pair[1]);
                    doc.fontSize(7).fillColor(C.gray).font('Helvetica').text(label, x + 4, y + 3, { width: colW - 8, lineBreak: false });
                    doc.fontSize(8.5).fillColor(C.black).font('Helvetica').text(value, x + 4, y + 10, { width: colW - 8, lineBreak: false });
                }
                doc.y = y + rowH;
            }
            doc.moveDown(0.3);
        }

        function drawPageHeader() {
            doc.rect(0, 0, PW, 36).fill(C.header);
            doc.fontSize(14).fillColor('white').font('Helvetica-Bold')
               .text('WIESPL Eye Hospital – Patient Medical Record', ML, 8, { width: CW, align: 'center' });
            doc.fontSize(8).fillColor('white').font('Helvetica')
               .text(`MRD: ${mrd}   |   Generated: ${new Date().toLocaleString('en-IN')}`, ML, 24, { width: CW, align: 'center' });
            doc.y = 46;
        }

        // ── CONTENT ─────────────────────────────────────────────────
        drawPageHeader();

        const cl  = checklist;
        const pi2 = cl.patientInfo        || {};
        const mh  = cl.medicalHistory     || {};
        const lt  = cl.labTests           || {};
        const bl  = lt.blood              || {};
        const ur  = lt.urine              || {};
        const inf = lt.infective          || {};
        const ee  = cl.eyeExam            || {};
        const si  = cl.specialInvestigations || {};
        const mf  = cl.medicalFitness     || {};
        const bm  = cl.biometry           || {};
        const re  = bm.rightEye           || {};
        const le  = bm.leftEye            || {};
        const iol = cl.iolCalculation     || {};
        const sa  = cl.surgicalAids       || {};
        const vf  = cl.verification       || {};
        const v   = (k) => (p[k] == null || p[k] === '') ? (pi2[k] == null || pi2[k] === '' ? '—' : pi2[k]) : p[k];

        // 1. Patient Identification
        sectionHeader('1.  Patient Identification');
        kvRow([
            ['Full Name',          p.name],
            ['MRD Number',         p.mrd_number],
            ['Age',                p.age],
            ['Gender',             p.gender],
            ['Phone',              p.phone],
            ['Blood Group',        p.blood_group],
            ['Patient Category',   p.patient_category],
            ['Email',              p.email],
            ['Address',            p.address],
            ['EMR Number',         p.emr_number],
            ['Lab Name',           p.lab_name],
            ['Lab Registration',   p.lab_registration],
            ['Physician',          p.physician],
            ['Investigation Date', p.investigation_date],
            ['Insurance Provider', p.insurance],
            ['Insurance ID',       p.insurance_id]
        ]);

        // 2. Emergency Contact
        sectionHeader('2.  Emergency Contact');
        kvRow([
            ['Contact Name',  p.emergency_name],
            ['Relation',      p.emergency_relation],
            ['Contact Phone', p.emergency_contact]
        ], 3);

        // 3. Eye Details
        sectionHeader('3.  Eye Details');
        kvRow([
            ['Eye (Side)',       p.eye],
            ['Eye Condition',    p.eye_condition],
            ['Eye Surgery Type', p.eye_surgery]
        ], 3);

        // 4. Medical History
        sectionHeader('4.  Medical History');
        kvRow([
            ['Diabetic',       mh.diabetic],
            ['Diabetic Since', mh.diabeticSince],
            ['On Insulin',     mh.insulin],
            ['Cardiac',        mh.cardiac],
            ['Angioplasty',    mh.angioplasty],
            ['Bypass Surgery', mh.bypass],
            ['Blood Thinner',  mh.bloodThinner],
            ['Kidney Disease', mh.kidney],
            ['Dialysis',       mh.dialysis],
            ['Hypertension',   mh.hypertension],
            ['Thyroid',        mh.thyroid],
            ['Asthma',         mh.asthma]
        ]);

        // 5. Eye Examination
        sectionHeader('5.  Eye Examination');
        kvRow([
            ['Vision RE',         ee.visionRE   || p.vision_right],
            ['Vision LE',         ee.visionLE   || p.vision_left],
            ['BCVA RE',           ee.bcvaRE     || p.bcva_right],
            ['BCVA LE',           ee.bcvaLE     || p.bcva_left],
            ['Specular Count RE', ee.specularRE || p.specular_right],
            ['Specular Count LE', ee.specularLE || p.specular_left],
            ['Cataract Type RE',  ee.cataractTypeRE || p.cataract_type_right],
            ['Cataract Type LE',  ee.cataractTypeLE || p.cataract_type_left],
            ['Fundus View RE',    ee.fundusViewRE   || p.fundus_view_right],
            ['Fundus View LE',    ee.fundusViewLE   || p.fundus_view_left],
            ['Pupil Dilation RE', ee.pupilDilationRE|| p.pupil_dilation_right],
            ['Pupil Dilation LE', ee.pupilDilationLE|| p.pupil_dilation_left],
            ['IOP RE (mmHg)',     ee.iopRE || p.iop_right],
            ['IOP LE (mmHg)',     ee.iopLE || p.iop_left],
            ['Diagnosis',         ee.diagnosis || p.diagnosis]
        ]);

        // 6. Lab – Blood
        sectionHeader('6.  Laboratory Tests – Blood');
        kvRow([
            ['Hemoglobin (Hb)',  bl.hemoglobin], ['ESR',           bl.esr],
            ['CRP',             bl.crp],         ['Platelet Count', bl.platelet],
            ['TLC',             bl.tlc],         ['Neutrophil %',   bl.neutrophil],
            ['Lymphocyte %',    bl.lymphocyte],  ['Eosinophil %',   bl.eosinophil],
            ['Monocyte %',      bl.monocyte],    ['Basophil %',     bl.basophil],
            ['FBS',             bl.fbs],         ['PPBS',           bl.ppbs],
            ['RBS',             bl.rbs],         ['HbA1c',          bl.hba1c],
            ['Creatinine',      bl.creatinine],  ['BUN',            bl.bun],
            ['Sodium',          bl.sodium],      ['Potassium',      bl.potassium],
            ['Chloride',        bl.chloride],    ['',               '']
        ]);

        // 7. Lab – Urine
        sectionHeader('7.  Laboratory Tests – Urine');
        kvRow([
            ['Type',       ur.type],      ['Protein',    ur.protein],
            ['Glucose',    ur.glucose],   ['Ketone',     ur.ketone],
            ['Blood',      ur.blood],     ['Pus Cells',  ur.pus],
            ['Epithelial', ur.epithelial],['Bacteria',   ur.bacteria],
            ['Cast',       ur.cast],      ['',           '']
        ]);

        // 8. Infective Markers
        sectionHeader('8.  Infective Markers');
        kvRow([
            ['HBsAg', inf.hbsag], ['HCV', inf.hcv],
            ['HIV',   inf.hiv],   ['HBV', inf.hbv]
        ], 4);

        // 9. Special Investigations
        sectionHeader('9.  Special Investigations');
        kvRow([
            ['OCT',      si.oct     || p.oct],
            ['ARGAS',    si.argas   || p.argas],
            ['Pentacam', si.pentacam|| p.pentacam],
            ['B-Scan',   si.bscan   || p.bscan]
        ], 4);

        // 10. Medical Fitness
        sectionHeader('10.  Medical Fitness');
        kvRow([
            ['Fitness Status', mf.fitness  || p.medical_fitness],
            ['ECG',            mf.ecg      || p.ecg],
            ['BT',             mf.bt       || p.bt],
            ['CT',             mf.ct       || p.ct],
            ['Conj. Swab',     mf.conjSwab || p.conj_swab],
            ['Gram Swab',      lt.gramSwab || p.gram_swab]
        ], 3);

        // 11. Biometry
        sectionHeader('11.  Biometry');
        const bioFields = [
            ['Axial Length (AL)', re.al, le.al], ['K1', re.k1, le.k1],
            ['K2', re.k2, le.k2],                ['Cylinder (CYL)', re.cyl, le.cyl],
            ['ACD', re.acd, le.acd],             ['Lens Thickness (LT)', re.lt, le.lt],
            ['CCT', re.cct, le.cct],             ['WTW', re.wtw, le.wtw]
        ];
        const bioColW = CW / 3;
        // header row
        let by = doc.y;
        doc.rect(ML, by, CW, 16).fill(C.header).stroke(C.border);
        ['Parameter', 'Right Eye (RE)', 'Left Eye (LE)'].forEach((h, i) => {
            doc.fontSize(8.5).fillColor('white').font('Helvetica-Bold')
               .text(h, ML + i * bioColW + 4, by + 4, { width: bioColW - 8, lineBreak: false });
        });
        doc.y = by + 16;
        bioFields.forEach((row, i) => {
            by = doc.y;
            if (by + 18 > 800) { doc.addPage(); drawPageHeader(); by = doc.y; }
            if (i % 2 === 0) doc.rect(ML, by, CW, 18).fill(C.alt).stroke('white');
            const vals = [row[0], row[1] || '—', row[2] || '—'];
            vals.forEach((cell, ci) => {
                doc.fontSize(8.5).fillColor(ci === 0 ? C.sectionText : C.black)
                   .font(ci === 0 ? 'Helvetica-Bold' : 'Helvetica')
                   .text(cell, ML + ci * bioColW + 4, by + 5, { width: bioColW - 8, lineBreak: false });
            });
            doc.y = by + 18;
        });
        doc.moveDown(0.4);

        // 12. IOL Calculation
        sectionHeader('12.  IOL Calculation');
        kvRow([
            ['A-Constant',        iol.aconstant],
            ['IOL Power RE',      iol.iolPowerRE],
            ['IOL Power LE',      iol.iolPowerLE],
            ['IOL Category',      iol.iolCategory],
            ['IOL Category (Lab)', lt.iolCategoryLab],
            ['Manufacturer',      iol.iolManufacturer],
            ['Target RE',         iol.targetRE],
            ['Target LE',         iol.targetLE],
        ]);

        // 13. Surgical Aids
        sectionHeader('13.  Surgical Aids & Requirements');
        kvRow([
            ['Viscoat',              sa.viscoat],
            ['BHEX Ring',            sa.bhexRing],
            ['CTR Ring',             sa.ctrRing],
            ['Toric Sheet',          sa.toricSheet],
            ['Other Aids',           sa.otherAids],
            ['Special Requirements', sa.specialRequirements],
            ['Access Required',      sa.accessRequired]
        ]);

        // 14. Operation Details
        sectionHeader('14.  Operation Details');
        kvRow([
            ['Operation OT',      p.operation_ot],
            ['Operation Date',    p.operation_date],
            ['Operation Time',    p.operation_time],
            ['Surgeon / Doctor',  p.operation_doctor],
            ['Doctor Role',       p.operation_doctor_role],
            ['Operation Notes',   p.operation_notes]
        ]);

        // 15. Verification & Post-Op
        sectionHeader('15.  Verification & Post-Op');
        kvRow([
            ['Verified By',          vf.verifiedBy    || p.verified_by],
            ['Verification Date',    vf.verificationDate || p.verification_date],
            ['Verification Time',    vf.verificationTime || p.verification_time],
            ['Signature Status',     vf.signature     || p.signature],
            ['Intraop Notes',        vf.intraopNotes  || p.intraop_notes],
            ['Post-op Instructions', vf.postopInstructions || p.postop_instructions]
        ]);

        // Signature line
        doc.moveDown(1.5);
        if (doc.y + 40 > 800) { doc.addPage(); drawPageHeader(); }
        hline(doc.y);
        doc.moveDown(0.5);
        doc.fontSize(8).fillColor(C.gray).font('Helvetica')
           .text('Authorised Signature', ML, doc.y)
           .text('Verified By', PW - MR - 100, doc.y - 10, { width: 100, align: 'right' });

        // Page numbers
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            doc.fontSize(7.5).fillColor(C.gray).font('Helvetica')
               .text(`Page ${i+1} of ${totalPages}`, ML, 828, { width: CW, align: 'center' })
               .text('WIESPL HMS – Confidential Patient Record', ML, 828);
        }

        doc.end();
    });
});

// ==================== SERVE HTML ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== 404 HANDLER ====================

app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        requested_url: req.originalUrl,
        available_endpoints: [
            '/api/patients',
            '/api/items',
            '/api/orders',
            '/api/users',
            '/api/roles',
            '/api/master',
            '/api/music',
            '/api/videos',
            '/api/clean-reports',
            '/api/ot-schedules',
            '/api/login',
            '/api/dashboard/stats',
            '/api/test-icons',
            '/api/patients/search',
            '/api/patients/search/advanced',
            '/api/patients/by-mrd/:mrd',
            '/api/patients/:patientId/biometry',
            '/api/patients/:patientId/lab-results'
        ]
    });
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'Unexpected file field.' });
        }
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message
    });
});

// ==================== START SERVER ====================

const server = http.createServer(app);

// ==================== FIX OT SCHEDULES FOREIGN KEY ====================
// The ot_schedules table had FOREIGN KEY (mrd_number) REFERENCES patients(mrd_number).
// After we removed the UNIQUE constraint on mrd_number (to allow multiple surgeries),
// SQLite throws a foreign key mismatch error on every INSERT.
// This migration recreates the table without that foreign key constraint.
function fixOTSchedulesForeignKey() {
    return new Promise((resolve) => {
        // Check if the table has the bad FK by checking sqlite_master
        db.get(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='ot_schedules'",
            [],
            (err, row) => {
                if (err || !row) return resolve();
                
                // If the FK is still present, rebuild the table
                if (row.sql && row.sql.includes('FOREIGN KEY')) {
                    console.log('Fixing ot_schedules foreign key constraint...');
                    db.serialize(() => {
                        db.run("ALTER TABLE ot_schedules RENAME TO ot_schedules_backup", (err) => {
                            if (err) { console.warn('Rename failed:', err.message); return resolve(); }
                            
                            db.run(`CREATE TABLE ot_schedules (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                schedule_id TEXT UNIQUE NOT NULL,
                                patient_name TEXT NOT NULL,
                                mrd_number TEXT NOT NULL,
                                procedure_type TEXT NOT NULL,
                                surgeon TEXT NOT NULL,
                                ot_name TEXT NOT NULL,
                                schedule_date TEXT NOT NULL,
                                start_time TEXT NOT NULL,
                                end_time TEXT,
                                status TEXT DEFAULT 'Scheduled',
                                notes TEXT,
                                created_by TEXT,
                                created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                            )`, (err) => {
                                if (err) { console.warn('Recreate failed:', err.message); return resolve(); }
                                
                                db.run(`INSERT INTO ot_schedules 
                                    SELECT id, schedule_id, patient_name, mrd_number, procedure_type,
                                           surgeon, ot_name, schedule_date, start_time, end_time,
                                           status, notes, created_by, created_at
                                    FROM ot_schedules_backup`, (err) => {
                                    if (err) console.warn('Data copy warning:', err.message);
                                    
                                    db.run("DROP TABLE IF EXISTS ot_schedules_backup", () => {
                                        console.log('✓ ot_schedules foreign key constraint removed');
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                } else {
                    resolve(); // Already fixed
                }
            }
        );
    });
}

// ==================== BACKFILL EYE FROM CHECKLIST ====================
// Fixes old patients that were saved before the eye field was correctly captured.
// Reads the checklist JSON (which always had eye data) and writes it back to
// the top-level eye, eye_condition, eye_surgery columns.
function backfillEyeFromChecklist() {
    return new Promise((resolve) => {
        db.all(
            "SELECT patient_id, eye, checklist FROM patients WHERE (eye IS NULL OR eye = '') AND checklist IS NOT NULL AND checklist != ''",
            [],
            (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    if (err) console.warn('Backfill query error:', err.message);
                    return resolve();
                }
                console.log(`Backfilling eye field for ${rows.length} patient(s)...`);
                let done = 0;
                rows.forEach(row => {
                    try {
                        const cl = JSON.parse(row.checklist);
                        // eye value is stored in patientInfo.eye (new format)
                        // or eyeExam inside checklist (older format has nothing useful)
                        const eye          = (cl.patientInfo && cl.patientInfo.eye)           || '';
                        const eyeCondition = (cl.patientInfo && cl.patientInfo.eyeCondition)  || '';
                        const eyeSurgery   = (cl.patientInfo && cl.patientInfo.eyeSurgery)    || '';

                        if (eye || eyeCondition || eyeSurgery) {
                            db.run(
                                "UPDATE patients SET eye=?, eye_condition=?, eye_surgery=? WHERE patient_id=?",
                                [eye, eyeCondition, eyeSurgery, row.patient_id],
                                (uerr) => {
                                    if (uerr) console.warn(`Backfill update failed for ${row.patient_id}:`, uerr.message);
                                    else      console.log(`✓ Backfilled eye for patient ${row.patient_id}: "${eye}"`);
                                }
                            );
                        }
                    } catch (e) { /* skip malformed checklist */ }
                    done++;
                    if (done === rows.length) resolve();
                });
            }
        );
    });
}

async function startServer() {
    try {
        db = await initializeDatabase();
        await createTables();
        await fixOTSchedulesForeignKey();
        await backfillEyeFromChecklist();
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║               HOSPITAL MANAGEMENT SYSTEM SERVER             ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 HTTP Server running on PORT ${PORT}                      ║
║  📱 Accessible from all devices on network                  ║
║                                                             ║
║  Local Access:                                              ║
║    http://localhost:${PORT}                                 ║
║    http://127.0.0.1:${PORT}                                 ║
║                                                             ║`);
            
            if (LOCAL_IP && LOCAL_IP !== 'localhost') {
                console.log(`║                                                             ║
║  Network Access (Mobile Devices):                          ║
║    http://${LOCAL_IP}:${PORT}                                ║`);
            }
            
            console.log(`║                                                             ║
║  Features now working:                                      ║
║    ✓ Patient Management with Full 5-Step Form              ║
║    ✓ OT Scheduling with Conflict Detection                  ║
║    ✓ Biometry Tracking                                      ║
║    ✓ Lab Results Management                                 ║
║    ✓ Surgical Aids Tracking                                 ║
║    ✓ File Uploads (Reports, Music, Videos)                  ║
║    ✓ Store Management                                       ║
║    ✓ User & Role Management                                 ║
║    ✓ Clean Reports with PDF Generation                      ║
║    ✓ All devices can access                                 ║
║                                                             ║
╚══════════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down server gracefully...');
    server.close(() => {
        console.log('HTTP server closed.');
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed.');
                }
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
});

module.exports = app;