// Dynamic API base URL detection
function getApiBaseUrl() {
    const currentHost = window.location.hostname;
    const currentPort = window.location.port || '3000';
    
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        return `http://${currentHost}:${currentPort}/api`;
    }
    
    return 'http://localhost:3000/api';
}

const API_BASE_URL = getApiBaseUrl();
console.log('Using API URL:', API_BASE_URL);
const MASTER_USERNAME = "root";
const MASTER_PASSWORD = "HOSPITAL_RECOVERY_2026";
// Data storage
let patients = [];
let storeItems = [];
let orders = [];
let activities = [];
let roles = [];
let users = [];
let currentUser = null;
let musicFiles = [];
let videoFiles = [];
let cleanReports = [];
let currentCleanPhotos = [];
let currentPatientReports = [];
let otSchedules = [];
let masterData = {
    patient_category: [],
    blood_group: [],
    gender: [],
    allergy: [],
    medication: [],
    insurance: [],
    category: [],
    doctor: [],
    doctor_role: [],
    ot_name: [],
    eye_condition: [],
    eye_surgery: [],
    physician: [] 
};

let patientIdCounter = 1;
let isPolling = false;
let latestOrderId = 0;
let currentSavedReportId = null;
let currentVideoView = 'grid';
let patientSearchTimeout;

// ==================== API FUNCTIONS ====================

async function apiRequest(endpoint, method = 'GET', data = null) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${API_BASE_URL}/${cleanEndpoint}`;
    
    console.log(`API ${method} Request:`, url);
    
    try {
   const options = {
    method: method,
    headers: {}
};

        if (data && !(data instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        } else if (data instanceof FormData) {
            options.body = data;
        }

        const response = await fetchWithTimeout(url, options, 60000);
       
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error ${response.status}:`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText || 'Server error'}`);
        }
       
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('API Request Failed:', error);
        
        if (error.name === 'TimeoutError') {
            throw new Error('Request timeout. Please check your network connection.');
        } else if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please make sure the server is running.');
        } else {
            throw error;
        }
    }
}

function fetchWithTimeout(url, options, timeout) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => {
                const timeoutError = new Error('Request timeout');
                timeoutError.name = 'TimeoutError';
                reject(timeoutError);
            }, timeout)
        )
    ]);
}

// ==================== NETWORK FUNCTIONS ====================

function checkNetworkStatus() {
    const statusElement = document.getElementById('network-status');
    if (!statusElement) return;

    fetch(`${API_BASE_URL}/health`, { method: 'GET' })
    .then(response => {
        if (response.ok) {
            statusElement.innerHTML = '<span style="color: green;">● Online</span>';
        } else {
            statusElement.innerHTML = '<span style="color: orange;">● Server Error</span>';
        }
    })
    .catch(error => {
        statusElement.innerHTML = '<span style="color: red;">● Offline</span>';
        console.error('Network check failed:', error);
    });
}

async function testServerConnection() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
        throw new Error('Server not responding');
    }
    console.log('Server connection test passed');
}
document.addEventListener("DOMContentLoaded", () => {
    console.log('DOM fully loaded');
    
    // Music upload form
    const musicForm = document.getElementById("music-upload-form");
    if (musicForm) {
        console.log('Music form found, attaching submit handler');
        musicForm.addEventListener("submit", uploadMusic);
    } else {
        console.warn('Music form not found');
    }

    // Video upload form
    const videoForm = document.getElementById("video-upload-form");
    if (videoForm) {
        console.log('Video form found, attaching submit handler');
        videoForm.addEventListener("submit", uploadVideo);
    } else {
        console.warn('Video form not found');
    }

    // Music file input change handler
    const musicFileInput = document.getElementById('music-file');
    if (musicFileInput) {
        musicFileInput.addEventListener('change', function(e) {
            handleMusicFileSelect(this.files);
        });
    }

    // Video file input change handler
    const videoFileInput = document.getElementById('video-file');
    if (videoFileInput) {
        videoFileInput.addEventListener('change', function(e) {
            handleVideoFileSelect(this.files);
        });
    }
});
// ==================== MOBILE FUNCTIONS ====================
async function uploadMusic(e) {
    e.preventDefault();
    e.stopPropagation();

    console.log('🎵 Music upload started');

    const name = document.getElementById("music-name").value;
    const fileInput = document.getElementById("music-file");
    const file = fileInput.files[0];

    if (!name || !name.trim()) {
        alert("Please enter a music name");
        return;
    }

    if (!file) {
        alert("Please select a music file");
        return;
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
        alert("Please select a valid audio file (MP3, WAV, etc.)");
        return;
    }

    // Validate file size (20MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB\nMaximum size is 100MB`);
        return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("music", file);  // This matches server's 'music' field

    // Get the submit button
    const submitBtn = document.querySelector('#music-upload-form button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        // Disable button and show loading
        submitBtn.innerHTML = '<div class="icon icon-spinner"></div> Uploading...';
        submitBtn.disabled = true;

        console.log('Sending music upload request...');
        
        const result = await apiRequest("/music", "POST", formData);

        console.log('Upload response:', result);

        if (result && result.success) {
            alert("✅ Music uploaded successfully!");
            
            // Reset form
            document.getElementById("music-upload-form").reset();
            document.getElementById("selected-file-info").style.display = 'none';
            
            // Close modal
            closeModal('musicUploadModal');
            
            // Reload music list
            await loadMusicFiles();
        } else {
            throw new Error(result?.error || 'Upload failed');
        }
    } catch (error) {
        console.error("❌ Music upload error:", error);
        
        let errorMessage = error.message;
        if (errorMessage.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server. Please check if server is running.';
        } else if (errorMessage.includes('timeout')) {
            errorMessage = 'Upload timeout. File might be too large.';
        }
        
        alert("Upload failed: " + errorMessage);
    } finally {
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}
function handleMusicFileSelect(files) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    console.log('Music file selected:', {
        name: file.name,
        type: file.type,
        size: file.size
    });

    const fileNameElement = document.getElementById('file-name');
    const fileInfoElement = document.getElementById('selected-file-info');
    
    if (fileNameElement && fileInfoElement) {
        fileNameElement.textContent = file.name;
        fileInfoElement.style.display = 'block';
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
        alert('Warning: This may not be a valid audio file. Please select MP3, WAV, or other audio format.');
    }
}
// Add this function to handle master account login
function isMasterAccount(username, password) {
    return username === MASTER_USERNAME && password === MASTER_PASSWORD;
}
async function loadMusicFiles() {

    try {

        const data = await apiRequest("/music");

        if (!data) return;

        musicFiles = data;

        renderMusicFiles();

    } catch (error) {
        console.error("Error loading music:", error);
    }

}

function renderMusicFiles() {

    const container = document.getElementById("music-container");

    if (!container) return;

    if (musicFiles.length === 0) {
        container.innerHTML = "<p>No music uploaded</p>";
        return;
    }

    container.innerHTML = musicFiles.map(m => `
        <div class="music-card">

            <audio controls>
                <source src="/uploads/music/${m.filename}" type="audio/mpeg">
            </audio>

            <p>${m.name}</p>

        </div>
    `).join("");

}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function initializeMobileSettings() {
    if (isMobileDevice()) {
        console.log('Mobile device detected');
        
        document.querySelector('.sidebar').classList.add('collapsed');
        document.querySelector('.main-content').classList.add('full-width');
        
        showMobileConnectionHelp();
    }
}

function showMobileConnectionHelp() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return;
    }
    
    const helpDiv = document.createElement('div');
    helpDiv.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: #3498db;
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        z-index: 999;
        max-width: 200px;
    `;
    helpDiv.innerHTML = `
        <strong>Mobile Access</strong><br>
        Make sure your computer and mobile are on same WiFi network
    `;
    
    document.body.appendChild(helpDiv);
    
    setTimeout(() => {
        helpDiv.remove();
    }, 10000);
}

// ==================== DATA LOADING FUNCTIONS ====================

async function loadAllData() {
    try {
        await loadMasterDataFromServer();
        initializeEyeMasterData();
        await loadPatientsFromServer();
        await loadStoreItemsFromServer();
        await loadOrdersFromServer();
        await loadActivitiesFromServer();
        await loadRolesFromServer();
        await loadUsersFromServer();
       
        populateDropdowns();
        renderMasterData();
        await updateDashboard();
       
        if (orders.length > 0) {
            latestOrderId = Math.max(...orders.map(o => o.id));
        }
        updateStoreNotificationBadge();
        setInterval(pollData, 5000);
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage('global-error', 'Failed to load data: ' + error.message, 'error');
    }
}

async function loadMasterDataFromServer() {
    try {
        const data = await apiRequest('/master');
        if (data) {
            Object.keys(masterData).forEach(key => {
                masterData[key] = [];
            });
            
            const groupedData = {};
            data.forEach(item => {
                if (!groupedData[item.category]) {
                    groupedData[item.category] = [];
                }
                groupedData[item.category].push(item.value);
            });
            
            for (const [category, values] of Object.entries(groupedData)) {
                if (masterData.hasOwnProperty(category)) {
                    masterData[category] = values;
                } else {
                    masterData[category] = values;
                }
            }
            
            console.log('Loaded master data categories:', Object.keys(groupedData));
        }
    } catch (error) {
        console.error('Error loading master data:', error);
    }
}

async function loadPatientsFromServer() {
    let data = await apiRequest('/patients-with-reports');
   
    if (!data) {
        data = await apiRequest('/patients');
    }
   
    if (data) {
        patients = data.map(p => ({
            id: p.patient_id,
            mrd_number: p.mrd_number,
            name: p.name,
            age: p.age,
            gender: p.gender,
            eye: p.eye,
            eye_condition: p.eye_condition,
            eye_surgery: p.eye_surgery,
            vision_left: p.vision_left,
            vision_right: p.vision_right,
            bcva_left: p.bcva_left,
            bcva_right: p.bcva_right,
            specular_left: p.specular_left,
            specular_right: p.specular_right,
            cataract_type_left: p.cataract_type_left,
            cataract_type_right: p.cataract_type_right,
            fundus_view_left: p.fundus_view_left,
            fundus_view_right: p.fundus_view_right,
            pupil_dilation_left: p.pupil_dilation_left,
            pupil_dilation_right: p.pupil_dilation_right,
            iop_left: p.iop_left,
            iop_right: p.iop_right,
            diagnosis: p.diagnosis,
            oct: p.oct,
            argas: p.argas,
            pentacam: p.pentacam,
            bscan: p.bscan,
            medical_fitness: p.medical_fitness,
            ecg: p.ecg,
            bt: p.bt,
            ct: p.ct,
            conj_swab: p.conj_swab,
            lab_name: p.lab_name,
            physician: p.physician,
            investigation_date: p.investigation_date,
            emr_number: p.emr_number,
            verified_by: p.verified_by,
            verification_date: p.verification_date,
            verification_time: p.verification_time,
            signature: p.signature,
            intraop_notes: p.intraop_notes,
            postop_instructions: p.postop_instructions,
            phone: p.phone,
            email: p.email,
            patientCategory: p.patient_category,
            bloodGroup: p.blood_group,
            address: p.address,
            emergencyContact: p.emergency_contact,
            emergencyName: p.emergency_name,
            emergencyRelation: p.emergency_relation,
            allergies: p.allergies ? p.allergies.split(', ') : [],
            medications: p.medications ? p.medications.split(', ') : [],
            medicalHistory: p.medical_history,
            insurance: p.insurance,
            insuranceId: p.insurance_id,
            operationOt: p.operation_ot,
            operationDate: p.operation_date,
            operationTime: p.operation_time,
            operationDoctor: p.operation_doctor,
            operationDoctorRole: p.operation_doctor_role,
            operationNotes: p.operation_notes,
            reportCount: p.report_count || 0,
            reports: [],
            createdAt: p.created_at
        }));
      console.log(`Loaded ${patients.length} patients`);
    }
}

async function loadStoreItemsFromServer() {
    const data = await apiRequest('/items');
    if (data) {
        storeItems = data;
    }
}

async function loadOrdersFromServer() {
    const data = await apiRequest('/orders');
    if (data) {
        orders = data;
    }
}

async function loadActivitiesFromServer() {
    const data = await apiRequest('/activities?limit=20');
    if (data) {
        activities = data.map(a => ({
            time: new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            user: a.user,
            action: a.action,
            details: a.details,
            timestamp: new Date(a.created_at).getTime()
        }));
    }
}

async function loadRolesFromServer() {
    const data = await apiRequest('/roles');
    if (data) {
        roles = data;
        return true;
    } else {
        console.error('Failed to load roles from server');
        return false;
    }
}

async function loadUsersFromServer() {
    const data = await apiRequest('/users');
    if (data) {
        users = data;
        return true;
    } else {
        console.error('Failed to load users from server');
        return false;
    }
}

async function loadDashboardStats() {
    const data = await apiRequest('/dashboard/stats');
    if (data) {
        document.getElementById('total-patients').textContent = data.patients || 0;
        document.getElementById('total-items').textContent = data.items || 0;
        document.getElementById('total-roles').textContent = data.roles || 0;
        document.getElementById('total-master').textContent = data.master_data || 0;
    } else {
        document.getElementById('total-patients').textContent = patients.length;
        document.getElementById('total-items').textContent = storeItems.length;
        document.getElementById('total-roles').textContent = roles.length;
        document.getElementById('total-master').textContent = Object.values(masterData).flat().length;
    }
}

// ==================== POLLING FUNCTIONS ====================

async function pollData() {
    if (isPolling) return;
    isPolling = true;
    try {
        const currentPatientCount = patients.length;
        const currentOrderCount = orders.length;
        const currentItemCount = storeItems.length;
        await loadOrdersFromServer();
        await loadPatientsFromServer();
        await loadStoreItemsFromServer();
        updateStoreNotificationBadge();
        
        if (orders.length > 0) {
            const newOrders = orders.filter(o => o.id > latestOrderId);
            if (newOrders.length > 0) {
                latestOrderId = Math.max(...newOrders.map(o => o.id));
                newOrders.forEach(order => {
                    showNewOrderNotification(order);
                });
            }
        }
        
        if (document.getElementById('patient-list').classList.contains('active') && patients.length !== currentPatientCount) {
            renderPatientList();
        }
       
        if (document.getElementById('orders').classList.contains('active') && orders.length !== currentOrderCount) {
            renderOrders();
        }
        if (document.getElementById('inventory').classList.contains('active') && storeItems.length !== currentItemCount) {
            renderStoreItems();
        }
       
        if (document.getElementById('dashboard').classList.contains('active')) {
            await loadDashboardStats();
            await loadActivitiesFromServer();
            renderActivities();
        }
    } catch (error) {
        console.error("Polling error:", error);
    }
    isPolling = false;
}

// ==================== NOTIFICATION FUNCTIONS ====================

function showNewOrderNotification(order) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.id = `toast-order-${order.id}`;
   
    toast.innerHTML = `
        <strong><div class="icon icon-bell"></div> New Order Received</strong>
        <p>Item: ${order.item_name}</p>
        <p>For: ${order.ot_name} (Qty: ${order.quantity})</p>
        <button class="toast-btn" onclick="dismissToast('${toast.id}')">Dismiss</button>
    `;
   
    container.appendChild(toast);
   
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
}

function dismissToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }
}

// General-purpose floating toast (info / success / warning / error)
function showToast(message, type = 'info') {
    const bgColors = {
        success: '#27ae60',
        error:   '#e74c3c',
        warning: '#e67e22',
        info:    '#2980b9'
    };
    const container = document.getElementById('toast-container');
    if (!container) { console.warn(message); return; }

    const id = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
        background:${bgColors[type] || bgColors.info};color:white;
        padding:12px 18px;border-radius:6px;margin-top:8px;
        font-size:13px;box-shadow:0 3px 10px rgba(0,0,0,0.2);
        max-width:320px;opacity:0;transition:opacity 0.3s;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    // Fade in
    setTimeout(() => { toast.style.opacity = '1'; }, 10);
    // Auto-dismiss after 3.5s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

function updateStoreNotificationBadge() {
    const badge = document.getElementById('store-notification-badge');
    if (!badge) return;
    const pendingOrders = orders.filter(order => order.status === 'pending').length;
   
    if (pendingOrders > 0) {
        badge.textContent = pendingOrders;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

// ==================== PAGE TITLES ====================

const pageTitles = {
    'dashboard': 'Dashboard',
    'patients': 'Add Patient',
    'patient-list': 'Patient List',
    'store': 'Store Management',
    'music': 'OT Music Library',
    'master': 'Master Data Management',
    'roles': 'Manage Roles & Permissions',
    'users': 'Manage Users',
    'clean-report': 'Clean Report Generation',
    'videos': 'OT Video Library',
    'ot-scheduling': 'OT Scheduling'
};

// ==================== AUTHENTICATION FUNCTIONS ====================

function setupAuth() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

function simulateInitialData() {
    roles = [];
    users = [];
    
    roles.push({
        role_id: 'R001',
        role_name: 'Administrator',
        description: 'Full system access',
        user_count: 1,
        permissions: 'all'
    });
    roles.push({
        role_id: 'R002',
        role_name: 'Doctor',
        description: 'Manages patients and views records',
        user_count: 1,
        permissions: 'dashboard_view,patient_view,patient_add,patient_edit,ot_schedule'
    });
    roles.push({
        role_id: 'R003',
        role_name: 'Nurse',
        description: 'Views patients and orders supplies',
        user_count: 1,
        permissions: 'dashboard_view,patient_view,store_view,order_place,ot_schedule'
    });
    roles.push({
        role_id: 'R004',
        role_name: 'Store Manager',
        description: 'Manages all inventory and orders',
        user_count: 1,
        permissions: 'dashboard_view,store_view,store_manage,order_place,order_manage,ot_schedule'
    });
    roles.push({
        role_id: 'R005',
        role_name: 'Lab Technician',
        description: 'Views patient list for lab work',
        user_count: 1,
        permissions: 'dashboard_view,patient_view'
    });
    roles.push({
        role_id: 'R006',
        role_name: 'Receptionist',
        description: 'Adds new patients to the system',
        user_count: 1,
        permissions: 'dashboard_view,patient_view,patient_add'
    });
    
    users.push({
        id: 'U001', username: 'admin', password: '123', role_id: 'R001'
    });
    users.push({
        id: 'U002', username: 'doctor', password: '123', role_id: 'R002'
    });
    users.push({
        id: 'U003', username: 'nurse', password: '123', role_id: 'R003'
    });
    users.push({
        id: 'U004', username: 'store', password: '123', role_id: 'R004'
    });
    users.push({
        id: 'U005', username: 'lab', password: '123', role_id: 'R005'
    });
    users.push({
        id: 'U006', username: 'frontdesk', password: '123', role_id: 'R006'
    });
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    // Check for master account first
    if (username === MASTER_USERNAME && password === MASTER_PASSWORD) {
        currentUser = {
            id: 'master',
            username: MASTER_USERNAME,
            role: 'master_admin',
            permissions: [
                'dashboard_view', 'patient_view', 'patient_add', 'patient_edit', 'patient_delete',
                'store_view', 'store_manage', 'order_place', 'order_manage',
                'master_manage', 'role_manage', 'user_manage', 'music_manage',
                'video_manage', 'report_manage', 'ot_schedule'
            ]
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        document.getElementById('login-page').style.display = 'none';
        document.querySelector('.container').classList.add('active');
        errorMsg.style.display = 'none';
        document.getElementById('user-name-display').textContent = currentUser.username;
        
        applyPermissions();
        showPage('dashboard');
        return;
    }

    apiRequest('/login', 'POST', { username, password })
        .then(result => {
            if (result && result.success) {
                const user = result.user;
                let userPermissions = [];
                
                // Handle permissions properly
                if (user.permissions === 'all' || user.permissions == ['*'] || user.permissions.includes('*')) {
                    userPermissions = [
                        'dashboard_view', 'patient_view', 'patient_add', 'patient_edit', 'patient_delete',
                        'store_view', 'store_manage', 'order_place', 'order_manage',
                        'master_manage', 'role_manage', 'user_manage', 'music_manage',
                        'video_manage', 'report_manage', 'ot_schedule'
                    ];
                } else if (Array.isArray(user.permissions)) {
                    userPermissions = user.permissions;
                } else if (typeof user.permissions === 'string') {
                    userPermissions = user.permissions.split(',').map(p => p.trim());
                } else {
                    userPermissions = [];
                }
                
                currentUser = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    permissions: userPermissions
                };
                
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                document.getElementById('login-page').style.display = 'none';
                document.querySelector('.container').classList.add('active');
                errorMsg.style.display = 'none';
                document.getElementById('user-name-display').textContent = currentUser.username;
                
                applyPermissions();
                showPage('dashboard');
            } else {
                fallbackLogin(username, password, errorMsg);
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            fallbackLogin(username, password, errorMsg);
        });
}
function fallbackLogin(username, password, errorMsg) {
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const role = roles.find(r => r.role_id === user.role_id);
        
        if (role) {
            let userPermissions = [];
            if (role.permissions === 'all') {
                userPermissions = [
                    'dashboard_view', 'patient_view', 'patient_add', 'patient_edit', 'patient_delete',
                    'store_view', 'store_manage', 'order_place', 'order_manage',
                    'master_manage', 'role_manage', 'user_manage', 'music_manage',
                    'video_manage', 'report_manage', 'ot_schedule'
                ];
            } else {
                userPermissions = role.permissions.split(',');
            }
            
            currentUser = {
                id: user.id,
                username: user.username,
                role: role.role_name,
                permissions: userPermissions
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.getElementById('login-page').style.display = 'none';
            document.querySelector('.container').classList.add('active');
            errorMsg.style.display = 'none';
            document.getElementById('user-name-display').textContent = currentUser.username;
            
            applyPermissions();
            showPage('dashboard');
        }
    } else {
        errorMsg.textContent = 'Invalid username or password';
        errorMsg.style.display = 'block';
    }
}

function checkExistingSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('login-page').style.display = 'none';
        document.querySelector('.container').classList.add('active');
        document.getElementById('user-name-display').textContent = currentUser.username;
        applyPermissions();
        showPage('dashboard');
        return true;
    }
    return false;
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    clearSavedFormData(); // Clear form data on logout
    document.getElementById('login-page').style.display = 'flex';
    document.querySelector('.container').classList.remove('active');
   
    document.getElementById('toast-container').innerHTML = '';
}

function checkPermission(requiredPermission) {
    if (!currentUser) return false;
    
    // Master admin or admin with '*' gets full access
    if (currentUser.role === 'master_admin' || 
        currentUser.role === 'Administrator' || 
        currentUser.permissions.includes('*') ||
        currentUser.permissions.includes('all')) {
        return true;
    }
    
    // Check if user has the specific permission
    return currentUser.permissions.includes(requiredPermission);
}
function applyPermissions() {
    if (!currentUser) {
        console.log('No current user, hiding all restricted elements');
        return;
    }
   
    console.log('Applying permissions for user:', currentUser.username, 'Permissions:', currentUser.permissions);
    
    // Master admin or admin with '*' permissions gets everything
    const isAdmin = currentUser.role === 'master_admin' || 
                    currentUser.role === 'Administrator' || 
                    currentUser.permissions.includes('*') ||
                    currentUser.permissions.includes('all');
    
    // Handle sidebar menu items
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        const link = li.querySelector('a');
        if (link) {
            const requiredPerm = link.getAttribute('data-permission');
            
            // If no permission required OR user is admin OR user has the required permission
            if (!requiredPerm || isAdmin || checkPermission(requiredPerm)) {
                li.style.display = 'block';
            } else {
                li.style.display = 'none';
                console.log(`Hiding ${link.textContent} - requires ${requiredPerm}`);
            }
        }
    });
   
    // Handle all elements with needs-perm class
    document.querySelectorAll('.needs-perm').forEach(el => {
        const requiredPerm = el.getAttribute('data-permission');
        
        if (!requiredPerm || isAdmin || checkPermission(requiredPerm)) {
            if (el.classList.contains('btn') || el.classList.contains('action-btn')) {
                el.style.display = 'inline-block';
            } else if (el.classList.contains('tab')) {
                el.style.display = 'flex';
            } else {
                el.style.display = 'block';
            }
        } else {
            el.style.display = 'none';
        }
    });
    
    // Handle master items remove buttons
    document.querySelectorAll('.master-item .remove').forEach(el => {
        if (isAdmin || checkPermission('master_manage')) {
            el.style.display = 'inline-block';
        } else {
            el.style.display = 'none';
        }
    });
    
    // Handle action buttons specifically
    document.querySelectorAll('.action-btn.delete, .action-btn.edit').forEach(el => {
        const requiredPerm = el.getAttribute('data-permission');
        if (requiredPerm && !isAdmin && !checkPermission(requiredPerm)) {
            el.style.display = 'none';
        }
    });
    
    console.log('Permissions applied successfully');
}

// ==================== NAVIGATION FUNCTIONS ====================

function setupNavigation() {
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            showPage(page);
           
            if (window.innerWidth <= 768) {
                document.querySelector('.sidebar').classList.add('collapsed');
                document.querySelector('.main-content').classList.add('full-width');
            }
        });
    });
}

function showPage(pageId) {
    if (!pageId) return;
    
    console.log(`Attempting to show page: ${pageId}`);
    
    if (!currentUser) {
        console.error('No user logged in');
        return;
    }
    
    // Master admin check
    const isAdmin = currentUser.role === 'master_admin' || 
                    currentUser.role === 'Administrator' || 
                    currentUser.permissions.includes('*') ||
                    currentUser.permissions.includes('all');
   
    // Check page permissions
    const link = document.querySelector(`.sidebar-menu a[data-page="${pageId}"]`);
    if (link) {
        const requiredPerm = link.getAttribute('data-permission');
        if (requiredPerm && !isAdmin && !checkPermission(requiredPerm)) {
            console.log(`Access Denied to ${pageId} - requires ${requiredPerm}`);
            alert(`Access Denied: You do not have permission to view the ${pageTitles[pageId] || pageId} page.`);
            return;
        }
    } else if (pageId === 'users' && !isAdmin && !checkPermission('user_manage')) {
        alert('Access Denied: You do not have permission to view this page.');
        return;
    } else if (pageId === 'music' && !isAdmin && !checkPermission('music_manage')) {
        alert('Access Denied: You do not have permission to view this page.');
        return;
    } else if (pageId === 'ot-scheduling' && !isAdmin && !checkPermission('ot_schedule')) {
        alert('Access Denied: You do not have permission to view this page.');
        return;
    }
   
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
   
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');
        document.getElementById('page-title').textContent = pageTitles[pageId];
    }
   
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
   
    const activeLink = document.querySelector(`[data-page="${pageId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
   
    if (pageId === 'patient-list') renderPatientList();
    else if (pageId === 'store') renderStoreItems();
    else if (pageId === 'roles') renderRoles();
    else if (pageId === 'users') renderUsers();
    else if (pageId === 'music') loadMusicFiles();
    else if (pageId === 'dashboard') updateDashboard();
    else if (pageId === 'clean-report') {
        loadCleanReports();
        populateCleanReportDropdowns();
    } else if (pageId === 'videos') {
        setTimeout(() => {
            testVideoUploadSetup();
            loadVideoFiles();
            populateCleanReportDropdowns();
        }, 100);
    } else if (pageId === 'ot-scheduling') {
        loadOTSchedules();
    }
}

// ==================== TAB FUNCTIONS ====================

function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
           
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
           
            this.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            if (tabName === 'orders') {
                renderOrders();
            }
        });
    });
}

// ==================== FORM SETUP ====================

function setupForms() {
    // NOTE: patient-form submit handled by multi-step wizard below — do NOT add second listener here (causes double submit 2192 duplicate MRD error)
    // document.getElementById('patient-form').addEventListener('submit', handleAddPatient);
    document.getElementById('item-form').addEventListener('submit', handleAddItem);
    document.getElementById('user-form').addEventListener('submit', handleCreateUser);
   
    document.getElementById('patient-search').addEventListener('input', function(e) {
        renderPatientList(e.target.value);
    });
}

// ==================== FILE UPLOAD FUNCTIONS ====================

function setupFileUpload() {
    const fileUploadArea = document.querySelector('.file-upload-area');
   
    fileUploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.background = '#e8f4fd';
        this.style.borderColor = '#2980b9';
    });
   
    fileUploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.style.background = '';
        this.style.borderColor = '#3498db';
    });
   
    fileUploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.background = '';
        this.style.borderColor = '#3498db';
       
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
}

function handleFileSelect(event) {
    const files = event.target.files;
    handleFiles(files);
}
const fileUploadArea = document.querySelector('.file-upload-area');

if (fileUploadArea) {
    fileUploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.background = '#e8f4fd';
        this.style.borderColor = '#2980b9';
    });
}
function handleFiles(files) {
    const maxSize = 50 * 1024 * 1024;
   const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const allowedExtensions = ['.dcm'];
    for (let file of files) {
        if (file.size > maxSize) {
            alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
            continue;
        }
       
      const fileExt = file.name.split('.').pop().toLowerCase();

if (
    !allowedTypes.includes(file.type) &&
    !allowedExtensions.includes('.' + fileExt)
) {
    alert(`File "${file.name}" is not supported. Allowed: Images, PDF, DOC, DOCX, DICOM (.dcm)`);
    continue;
}
       
        const report = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            file: file,
            uploadDate: new Date().toLocaleString()
        };
       
        currentPatientReports.push(report);
    }
   
    renderUploadedFiles();
}


function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderUploadedFiles() {
    const container = document.getElementById('uploaded-files');
   
    if (currentPatientReports.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">No files uploaded yet</p>';
        return;
    }
   
    container.innerHTML = currentPatientReports.map(report => `
        <div class="uploaded-file ${report.isExisting ? 'existing-file' : ''}">
            <div class="file-info">
                <div class="file-icon">
                    ${getFileIcon(report.type)}
                </div>
                <div>
                    <div class="file-name">${report.name} ${report.isExisting ? '<span style="color: #27ae60;">(Existing)</span>' : ''}</div>
                    <div class="file-size">${report.size} • ${report.isExisting ? 'Uploaded' : 'Ready to upload'}: ${report.uploadDate}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action-btn view" onclick="previewFile('${report.id}')" title="Preview">
                    <div class="icon icon-eye"></div>
                </button>
                <button class="file-action-btn delete" onclick="removeFile('${report.id}')" title="${report.isExisting ? 'Delete from server' : 'Remove'}">
                    <div class="icon icon-trash"></div>
                </button>
            </div>
        </div>
    `).join('');
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
        return '<div class="icon icon-file" style="display: inline-block; width: 1.2em; height: 1.2em;"></div>';
    } else if (fileType === 'application/pdf') {
        return '<div class="icon icon-file" style="display: inline-block; width: 1.2em; height: 1.2em;"></div>';
    } else if (fileType.includes('word') || fileType.includes('document')) {
        return '<div class="icon icon-file" style="display: inline-block; width: 1.2em; height: 1.2em;"></div>';
    } else {
        return '<div class="icon icon-file" style="display: inline-block; width: 1.2em; height: 1.2em;"></div>';
    }
}

function removeFile(fileId) {
    const report = currentPatientReports.find(r => r.id == fileId);
    if (report && report.isExisting) {
        if (confirm('This will permanently delete the file from the server. Continue?')) {
            deletePatientFile(report.patientId, report.id);
        }
        return;
    }
    
    currentPatientReports = currentPatientReports.filter(report => report.id != fileId);
    renderUploadedFiles();
}

function previewFile(fileId) {
    const report = currentPatientReports.find(r => r.id == fileId);
    if (!report) return;
   
    const previewContent = document.getElementById('file-preview-content');
    previewContent.innerHTML = '';
   
    if (report.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'file-preview';
            previewContent.appendChild(img);
        };
        reader.readAsDataURL(report.file);
    } else if (report.type === 'application/pdf') {
        const object = document.createElement('object');
        object.data = URL.createObjectURL(report.file);
        object.type = 'application/pdf';
        object.width = '100%';
        object.height = '500px';
        previewContent.appendChild(object);
       
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(report.file);
        downloadLink.download = report.name;
        downloadLink.className = 'btn btn-primary';
        downloadLink.innerHTML = '<div class="icon icon-download"></div> Download PDF';
        downloadLink.style.marginTop = '10px';
        previewContent.appendChild(downloadLink);
    } else {
        const message = document.createElement('p');
        message.textContent = `Preview not available for ${report.type} files.`;
        previewContent.appendChild(message);
       
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(report.file);
        downloadLink.download = report.name;
        downloadLink.className = 'btn btn-primary';
        downloadLink.innerHTML = '<div class="icon icon-download"></div> Download File';
        downloadLink.style.marginTop = '10px';
        previewContent.appendChild(downloadLink);
    }
   
    openModal('filePreviewModal');
}

// ==================== MASTER DATA FUNCTIONS ====================

async function saveMasterDataToServer(category, value) {
    const result = await apiRequest('/master', 'POST', {
        category: category,
        value: value,
        display_order: masterData[category].length
    });
    return result !== null;
}

async function deleteMasterDataFromServer(category, value) {
    const data = await apiRequest(`/master/${category}`);
    if (data) {
        const item = data.find(d => d.value === value);
        if (item) {
            const result = await apiRequest(`/master/${item.id}`, 'DELETE');
            return result !== null;
        }
    }
    return false;
}

function renderMasterData() {
    Object.keys(masterData).forEach(category => {
        if (category === 'checklist') {
            const container = document.getElementById('master-checklist-items');
            if (container) {
                if (masterData[category] && masterData[category].length > 0) {
                    container.innerHTML = masterData[category].map(item => `
                        <div class="master-item">
                            <span>${item}</span>
                            <span class="remove" onclick="removeMasterData('${category}', '${item}')">&times;</span>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<p style="color: #888; text-align: center; padding: 10px;">No checklist items defined</p>';
                }
            }
        } else {
            const containerId = `${category.replace('_', '-')}-items`;
            const container = document.getElementById(containerId);
            
            // Special case for physician - use a specific container ID
            let actualContainerId = containerId;
            if (category === 'physician') {
                actualContainerId = 'physician-items';
            }
            
            const actualContainer = document.getElementById(actualContainerId);
            
            if (actualContainer) {
                if (masterData[category] && masterData[category].length > 0) {
                    actualContainer.innerHTML = masterData[category].map(item => `
                        <div class="master-item">
                            <span>${item}</span>
                            <span class="remove" onclick="removeMasterData('${category}', '${item}')">&times;</span>
                        </div>
                    `).join('');
                } else {
                    actualContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 10px;">No physicians defined</p>';
                }
            }
        }
    });
    
    if (currentUser) {
        applyPermissions();
    }
}

async function addMasterData(category) {
    const value = prompt(`Enter new ${category.replace(/_/g, ' ')}:`);
    if (value && value.trim()) {
        if (!masterData[category].includes(value.trim())) {
            const success = await saveMasterDataToServer(category, value.trim());
            if (success) {
                masterData[category].push(value.trim());
                renderMasterData();
                populateDropdowns();
                addActivity('Updated Master Data', `Added ${value} to ${category}`);
                updateDashboard();
            } else {
                alert('Failed to save to server. Please try again.');
            }
        } else {
            alert('This value already exists!');
        }
    }
}

async function removeMasterData(category, value) {
    if (confirm(`Remove "${value}" from ${category.replace(/_/g, ' ')}?`)) {
        const success = await deleteMasterDataFromServer(category, value);
        if (success) {
            masterData[category] = masterData[category].filter(item => item !== value);
            renderMasterData();
            populateDropdowns();
            addActivity('Updated Master Data', `Removed ${value} from ${category}`);
            updateDashboard();
        } else {
            alert('Failed to delete from server. Please try again.');
        }
    }
}
async function uploadVideo(e) {
    e.preventDefault();

    const title = document.getElementById('video-title').value;
    const ot = document.getElementById('video-ot').value;
    const file = document.getElementById('video-file').files[0];
    const procedure = document.getElementById('video-procedure')?.value || '';
    const surgeon = document.getElementById('video-surgeon')?.value || '';
    const procedureDate = document.getElementById('video-date')?.value || '';
    const notes = document.getElementById('video-notes')?.value || '';

    if (!title || !ot || !file) {
        alert("Please fill all required fields (Title, OT, and Video File)");
        return;
    }

    // Validate file size (500MB max)
    if (file.size > 40960 * 1024 * 1024) {
        alert(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB\nMaximum size is 500MB`);
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("ot_name", ot);
    formData.append("procedure_type", procedure);
    formData.append("surgeon", surgeon);
    formData.append("procedure_date", procedureDate);
    formData.append("notes", notes);
    formData.append("video", file);  // Make sure this matches multer field name
    formData.append("currentUser", currentUser ? currentUser.username : 'System');

    try {
        console.log('Uploading video:', { title, ot, fileName: file.name, fileSize: file.size });
        
        const result = await apiRequest('/videos', 'POST', formData);

        if (result && result.success) {
            alert(`Video "${title}" uploaded successfully!`);
            document.getElementById("video-upload-form").reset();
            document.getElementById("selected-video-info").style.display = 'none';
            loadVideoFiles();
            closeModal('videoUploadModal');
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed: " + (error.message || 'Unknown error'));
    }
}
document.getElementById("video-upload-form")
.addEventListener("submit", uploadVideo);
async function loadVideoFiles() {

    try {

        const data = await apiRequest('/videos');

        if (!data) return;

        videoFiles = data;

        renderVideoFiles();

    } catch (error) {
        console.error("Error loading videos:", error);
    }
}function renderVideoFiles() {

    const container = document.getElementById("video-container");

    if (!container) return;

    if (videoFiles.length === 0) {
        container.innerHTML = "<p>No videos uploaded</p>";
        return;
    }

    container.innerHTML = videoFiles.map(v => `
        <div class="video-card">

            <video width="300" controls>
                <source src="/uploads/videos/${v.filename}" type="video/mp4">
            </video>

            <h4>${v.title}</h4>
            <p>${v.ot_name}</p>

        </div>
    `).join("");

}
function populateDropdowns() {

    // Populate patient category dropdown
    const categorySelect = document.getElementById('patient-category');
    if (categorySelect && masterData.patient_category) {
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        masterData.patient_category.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
   const physicianSelect = document.getElementById('physician');
    if (physicianSelect && masterData.physician) {
        physicianSelect.innerHTML = '<option value="">Select Physician</option>';
        masterData.physician.forEach(physician => {
            physicianSelect.innerHTML += `<option value="${physician}">${physician}</option>`;
        });
    }
    // Populate OT dropdowns
    const otSelects = document.querySelectorAll('#ot-room, #report-ot, #video-ot, #filter-ot');
    otSelects.forEach(select => {
        if (select && masterData.ot_name) {
            select.innerHTML = '<option value="">Select OT</option>';
            masterData.ot_name.forEach(ot => {
                select.innerHTML += `<option value="${ot}">${ot}</option>`;
            });
        }
    });

    // Populate doctor dropdowns
    const doctorSelects = document.querySelectorAll('#ot-surgeon, #operation-doctor');
    doctorSelects.forEach(select => {
        if (select && masterData.doctor) {
            select.innerHTML = '<option value="">Select Doctor</option>';
            masterData.doctor.forEach(doc => {
                select.innerHTML += `<option value="${doc}">${doc}</option>`;
            });
        }
    });

    // Populate item category dropdown
    const itemCategory = document.getElementById('item-category');
    if (itemCategory && masterData.category) {
        itemCategory.innerHTML = '<option value="">Select Category</option>';
        masterData.category.forEach(cat => {
            itemCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
}

function populateRoleDropdown() {
    const roleSelect = document.getElementById('user-role');
    if (!roleSelect) return;

    roleSelect.innerHTML = '<option value="">Select Role</option>';

    if (roles && roles.length > 0) {
        roles.forEach(role => {
            roleSelect.innerHTML += `<option value="${role.role_id}">${role.role_name}</option>`;
        });
    } else {
        console.warn('No roles available for dropdown');
    }
}

function initializeEyeMasterData() {
    if (masterData.eye_condition.length === 0) {
        masterData.eye_condition = [
            'Normal', 'Cataract', 'Glaucoma', 'Retinal Disease', 'Corneal Disease',
            'Diabetic Retinopathy', 'Macular Degeneration', 'Myopia (Nearsightedness)',
            'Hyperopia (Farsightedness)', 'Astigmatism', 'Presbyopia',
            'Amblyopia (Lazy Eye)', 'Strabismus (Crossed Eyes)', 'Uveitis',
            'Keratitis', 'Retinal Detachment', 'Macular Hole', 'Vitreous Hemorrhage',
            'Optic Neuritis', 'Retinitis Pigmentosa'
        ];
    }
    
    if (masterData.eye_surgery.length === 0) {
        masterData.eye_surgery = [
            'None', 'Cataract Surgery', 'LASIK', 'PRK', 'SMILE',
            'ICL (Implantable Collamer Lens)', 'Phakic IOL', 'Retinal Surgery',
            'Vitrectomy', 'Scleral Buckle', 'Glaucoma Surgery (Trabeculectomy)',
            'Tube Shunt Surgery', 'Corneal Transplant', 'PKP (Penetrating Keratoplasty)',
            'DSEK (Descemet Stripping Endothelial Keratoplasty)',
            'DALK (Deep Anterior Lamellar Keratoplasty)', 'Strabismus Surgery',
            'Ptosis Surgery', 'Eyelid Surgery (Blepharoplasty)', 'Lacrimal Surgery',
            'Orbital Surgery', 'Enucleation', 'Evisceration', 'Intravitreal Injection',
            'YAG Laser Capsulotomy', 'SLT (Selective Laser Trabeculoplasty)',
            'PRP (Panretinal Photocoagulation)', 'Macular Laser'
        ];
    }
}

// ==================== PATIENT FORM FUNCTIONS ====================

async function checkMRDAvailability() {
    const mrdInput = document.getElementById('patient-mrd');
    const mrdStatus = document.getElementById('mrd-status');
    const mrdSurgeryBtn = document.getElementById('mrd-existing-surgery');
    if (!mrdStatus) return;

    const mrdNumber = mrdInput.value.trim();

    if (!mrdNumber) {
        mrdStatus.innerHTML = '<span style="color:#f39c12;">⚠️ Please enter an MRD number</span>';
        if (mrdSurgeryBtn) mrdSurgeryBtn.style.display = 'none';
        return;
    }

    mrdStatus.innerHTML = '<span style="color:#3498db;">⏳ Checking availability...</span>';

    try {
        const form = document.getElementById('patient-form');
        const isEditMode = form.getAttribute('data-edit-mode') === 'true';
        const patientId = isEditMode ? form.getAttribute('data-patient-id') : null;

        let url = `${API_BASE_URL}/check-mrd?mrd=${encodeURIComponent(mrdNumber)}`;
        if (patientId) url += `&excludePatientId=${encodeURIComponent(patientId)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to check MRD');
        const result = await response.json();

        if (result.available) {
            mrdStatus.innerHTML = '<span style="color:#27ae60;">✅ MRD number is available</span>';
            if (mrdSurgeryBtn) mrdSurgeryBtn.style.display = 'none';
        } else {
            // MRD exists — warn but allow adding a new surgery for the same patient
            mrdStatus.innerHTML = `<span style="color:#e67e22;">⚠️ MRD belongs to: <strong>${result.patient_name}</strong> (ID: ${result.patient_id})</span>`;
            if (mrdSurgeryBtn) {
                mrdSurgeryBtn.style.display = 'block';
                mrdSurgeryBtn.setAttribute('data-existing-patient-id', result.patient_id);
                mrdSurgeryBtn.setAttribute('data-existing-patient-name', result.patient_name);
            }
        }
    } catch (error) {
        console.error('Error checking MRD:', error);
        mrdStatus.innerHTML = '<span style="color:#e74c3c;">❌ Error checking MRD availability</span>';
        if (mrdSurgeryBtn) mrdSurgeryBtn.style.display = 'none';
    }
}

// Pre-fills patient demographics for a new surgery on the same MRD
async function loadPatientForNewSurgery() {
    const btn = document.getElementById('mrd-existing-surgery');
    const mrdStatus = document.getElementById('mrd-status');
    const existingId = btn.getAttribute('data-existing-patient-id');
    const existingName = btn.getAttribute('data-existing-patient-name') || 'this patient';
    if (!existingId) return;

    mrdStatus.innerHTML = '<span style="color:#3498db;">⏳ Loading patient data...</span>';

    try {
        const data = await apiRequest(`/patients/${existingId}`);
        if (!data) throw new Error('Patient not found');

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        // Fill demographics only — clinical fields stay blank for the new surgery
        set('patient-name',       data.name);
        set('patient-age',        data.age);
        set('patient-gender',     data.gender);
        set('patient-phone',      data.phone);
        set('patient-email',      data.email);
        set('patient-blood-group',data.blood_group);
        set('patient-category',   data.patient_category);
        set('insurance-provider', data.insurance);
        set('insurance-id',       data.insurance_id);
        set('patient-address',    data.address);
        set('emergency-name',     data.emergency_name);
        set('emergency-phone',    data.emergency_contact);

        // Medical history
        try {
            const mh = typeof data.medical_history === 'string'
                ? JSON.parse(data.medical_history) : (data.medical_history || {});
            set('diabetic',       mh.diabetic || 'No');
            set('cardiac',        mh.cardiac   || 'No');
            set('hypertension',   mh.hypertension || 'No');
            set('blood-thinner',  mh.blood_thinner || 'None');
            set('kidney',         mh.kidney    || 'No');
            set('thyroid',        mh.thyroid   || 'No');
        } catch(e) { /* non-critical */ }

        // Mark form so server skips MRD unique-block (new surgery on same MRD)
        document.getElementById('patient-form').setAttribute('data-new-surgery', 'true');
        document.getElementById('patient-form').setAttribute('data-linked-patient-id', existingId);

        btn.style.display = 'none';
        mrdStatus.innerHTML = `<span style="color:#27ae60;">✅ Data loaded for <strong>${existingName}</strong>. Fill new surgery details and save.</span>`;

        // Scroll to top of form / step 1
        document.getElementById('step-1')?.scrollIntoView({ behavior: 'smooth' });
        showToast(`Patient info loaded for ${existingName}. Enter new surgery details.`, 'info');

    } catch (err) {
        console.error('loadPatientForNewSurgery error:', err);
        mrdStatus.innerHTML = `<span style="color:#e74c3c;">❌ Could not load patient: ${err.message}</span>`;
    }
}

async function handleAddPatient(e) {
    e.preventDefault();
    console.log('=== PATIENT SUBMISSION STARTED ===');
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const isEditMode = form.getAttribute('data-edit-mode') === 'true';
    const patientId = isEditMode ? form.getAttribute('data-patient-id') : null;
    
    try {
        submitBtn.innerHTML = '<div class="icon icon-spinner"></div> Saving...';
        submitBtn.disabled = true;
        
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value : '';
        };
        
        const name = getValue('patient-name');
        const mrdNumber = getValue('patient-mrd');
        const age = getValue('patient-age');
        const gender = getValue('patient-gender');
        const phone = getValue('patient-phone');
        const patientCategory = getValue('patient-category');
        
        if (!name || !mrdNumber || !age || !gender || !phone || !patientCategory) {
            alert('Please fill all required fields (Name, MRD Number, Age, Gender, Phone, Category)');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        const checklistData = {
            patientInfo: {
                patientName: name,
                mrdNumber: mrdNumber,
                age: age,
                gender: gender,
                phone: phone,
                eye: getValue('operation-eye') || '',
                eyeCondition: getValue('eye-condition') || '',
                eyeSurgery: getValue('eye-surgery') || '',
                physician: getValue('physician') || '',
                patientCategory: patientCategory
            },
            medicalHistory: {
                diabetic: getValue('diabetic') || 'No',
                diabeticSince: getValue('diabetic-since') || '',
                insulin: getValue('insulin') || 'No',
                cardiac: getValue('cardiac') || 'No',
                angioplasty: getValue('angioplasty') || 'No',
                bypass: getValue('bypass') || 'No',
                bloodThinner: getValue('blood-thinner') || 'None',
                kidney: getValue('kidney') || 'No',
                dialysis: getValue('dialysis') || 'No',
                hypertension: getValue('hypertension') || 'No',
                thyroid: getValue('thyroid') || 'No',
                asthma: getValue('asthma') || 'No'
            },
            labTests: {
                labRegistration: getValue('lab-registration') || '',
                gramSwab: getValue('gram-swab') || 'Not Done',
                iolCategoryLab: getValue('iol-category-lab') || '',
                blood: {
                    hemoglobin: getValue('hb') || '',
                    esr: getValue('esr') || '',
                    crp: getValue('crp') || '',
                    platelet: getValue('platelet') || '',
                    tlc: getValue('tlc') || '',
                    neutrophil: getValue('neutrophil') || '',
                    lymphocyte: getValue('lymphocyte') || '',
                    eosinophil: getValue('eosinophil') || '',
                    monocyte: getValue('monocyte') || '',
                    basophil: getValue('basophil') || '',
                    fbs: getValue('fbs') || '',
                    ppbs: getValue('ppbs') || '',
                    rbs: getValue('rbs') || '',
                    hba1c: getValue('hba1c') || '',
                    creatinine: getValue('creatinine') || '',
                    bun: getValue('bun') || '',
                    sodium: getValue('sodium') || '',
                    potassium: getValue('potassium') || '',
                    chloride: getValue('chloride') || ''
                },
                urine: {
                    type: getValue('urine-type') || 'RE',
                    protein: getValue('urine-protein') || 'Negative',
                    glucose: getValue('urine-glucose') || 'Negative',
                    ketone: getValue('urine-ketone') || 'Negative',
                    blood: getValue('urine-blood') || 'Negative',
                    pus: getValue('urine-pus') || '',
                    epithelial: getValue('urine-epithelial') || '',
                    bacteria: getValue('urine-bacteria') || 'None',
                    cast: getValue('urine-cast') || ''
                },
                infective: {
                    hbsag: getValue('hbsag') || 'Not Done',
                    hcv: getValue('hcv') || 'Not Done',
                    hiv: getValue('hiv') || 'Not Done',
                    hbv: getValue('hbv') || 'Not Done'
                }
            },
            eyeExam: {
                visionRE: getValue('vision-re') || '',
                visionLE: getValue('vision-le') || '',
                bcvaRE: getValue('bcva-re') || '',
                bcvaLE: getValue('bcva-le') || '',
                specularRE: getValue('specular-re') || '',
                specularLE: getValue('specular-le') || '',
                cataractTypeRE: getValue('cataract-type-re') || '',
                cataractTypeLE: getValue('cataract-type-le') || '',
                fundusViewRE: getValue('fundus-view-re') || '',
                fundusViewLE: getValue('fundus-view-le') || '',
                pupilDilationRE: getValue('pupil-dilation-re') || '',
                pupilDilationLE: getValue('pupil-dilation-le') || '',
                iopRE: getValue('iop-re') || '',
                iopLE: getValue('iop-le') || '',
                diagnosis: getValue('diagnosis') || ''
            },
            specialInvestigations: {
                oct: getValue('oct') || 'Not Done',
                argas: getValue('argas') || 'Not Done',
                pentacam: getValue('pentacam') || 'Not Done',
                bscan: getValue('bscan') || 'Not Done'
            },
            medicalFitness: {
                fitness: getValue('medical-fitness') || 'Fit',
                ecg: getValue('ecg') || 'Not Done',
                bt: getValue('bt') || '',
                ct: getValue('ct') || '',
                conjSwab: getValue('conjunctival-swab') || 'Not Done'
            },
            biometry: {
                rightEye: {
                    al: getValue('al-re') || '',
                    k1: getValue('k1-re') || '',
                    k2: getValue('k2-re') || '',
                    cyl: getValue('cyl-re') || '',
                    acd: getValue('acd-re') || '',
                    lt: getValue('lt-re') || '',
                    cct: getValue('cct-re') || '',
                    wtw: getValue('wtw-re') || ''
                },
                leftEye: {
                    al: getValue('al-le') || '',
                    k1: getValue('k1-le') || '',
                    k2: getValue('k2-le') || '',
                    cyl: getValue('cyl-le') || '',
                    acd: getValue('acd-le') || '',
                    lt: getValue('lt-le') || '',
                    cct: getValue('cct-le') || '',
                    wtw: getValue('wtw-le') || ''
                }
            },
            iolCalculation: {
                aconstant: getValue('aconstant') || '',
                iolPowerRE: getValue('iol-power-re') || '',
                iolPowerLE: getValue('iol-power-le') || '',
                iolCategory: getValue('iol-category') || '',
                iolManufacturer: getValue('iol-manufacturer') || '',
                targetRE: getValue('target-re') || '',
                targetLE: getValue('target-le') || ''
            },
            surgicalAids: {
                viscoat: getValue('viscoat') || 'No',
                bhexRing: getValue('bhex-ring') || 'No',
                ctrRing: getValue('ctr-ring') || 'No',
                toricSheet: getValue('toric-sheet') || 'No',
                otherAids: getValue('other-aids') || '',
                specialRequirements: getValue('intraop-requirements') || '',
                accessRequired: getValue('access-required') || 'Standard'
            },
            verification: {
                verifiedBy: getValue('verified-by') || '',
                verificationDate: getValue('verification-date') || '',
                verificationTime: getValue('verification-time') || '',
                signature: getValue('signature') || 'Pending',
                intraopNotes: getValue('intraop-notes') || '',
                postopInstructions: getValue('postop-instructions') || ''
            },
            metadata: {
                collectedAt: new Date().toISOString(),
                formType: 'ophthalmology_emr',
                completedBy: currentUser?.username || 'System'
            }
        };

        const formData = new FormData();
        
        // ========== BASIC PATIENT INFO ==========
        formData.append('mrd_number', mrdNumber.trim());
        formData.append('patient_category', patientCategory);
        formData.append('name', name);
        formData.append('age', age);
        formData.append('gender', gender);
        formData.append('phone', phone);
        formData.append('email', getValue('patient-email') || '');
        formData.append('address', getValue('patient-address') || '');
        formData.append('emergency_contact', getValue('emergency-phone') || '');
        formData.append('emergency_name', getValue('emergency-name') || '');
        formData.append('emergency_relation', getValue('emergency-relation') || '');
        
        // ========== LAB AND IDENTIFICATION ==========
        formData.append('lab_name',           getValue('lab-name-step2') || getValue('lab-name') || '');
        formData.append('emr_number',         getValue('emr-number') || '');
        formData.append('physician',          getValue('physician') || '');
        formData.append('investigation_date', getValue('investigation-date-step2') || getValue('investigation-date') || '');
        formData.append('blood_group',        getValue('patient-blood-group') || '');
        formData.append('lab_registration',   getValue('lab-registration') || '');
        formData.append('gram_swab',          getValue('gram-swab') || 'Not Done');
        
        // ========== INSURANCE ==========
        formData.append('insurance', getValue('insurance-provider') || '');
        formData.append('insurance_id', getValue('insurance-id') || '');
        
        // ========== EYE EXAM FIELDS ==========
        formData.append('eye', getValue('operation-eye') || '');
        formData.append('eye_condition', getValue('eye-condition') || '');
        formData.append('eye_surgery', getValue('eye-surgery') || '');
        formData.append('vision_left', getValue('vision-le') || '');
        formData.append('vision_right', getValue('vision-re') || '');
        formData.append('bcva_left', getValue('bcva-le') || '');
        formData.append('bcva_right', getValue('bcva-re') || '');
        formData.append('specular_left', getValue('specular-le') || '');
        formData.append('specular_right', getValue('specular-re') || '');
        formData.append('cataract_type_left', getValue('cataract-type-le') || '');
        formData.append('cataract_type_right', getValue('cataract-type-re') || '');
        formData.append('fundus_view_left', getValue('fundus-view-le') || '');
        formData.append('fundus_view_right', getValue('fundus-view-re') || '');

        // New surgery flag — allows same MRD to be reused on server
        const isNewSurgery = form.getAttribute('data-new-surgery') === 'true';
        if (isNewSurgery) {
            formData.append('new_surgery', 'true');
            const linkedId = form.getAttribute('data-linked-patient-id') || '';
            if (linkedId) formData.append('linked_patient_id', linkedId);
        }
        formData.append('pupil_dilation_left', getValue('pupil-dilation-le') || '');
        formData.append('pupil_dilation_right', getValue('pupil-dilation-re') || '');
        formData.append('iop_left', getValue('iop-le') || '');
        formData.append('iop_right', getValue('iop-re') || '');
        formData.append('diagnosis', getValue('diagnosis') || '');
        
        // ========== SPECIAL INVESTIGATIONS ==========
        formData.append('oct', getValue('oct') || 'Not Done');
        formData.append('argas', getValue('argas') || 'Not Done');
        formData.append('pentacam', getValue('pentacam') || 'Not Done');
        formData.append('bscan', getValue('bscan') || 'Not Done');
        
        // ========== MEDICAL FITNESS ==========
        formData.append('medical_fitness', getValue('medical-fitness') || 'Fit');
        formData.append('ecg', getValue('ecg') || 'Not Done');
        formData.append('bt', getValue('bt') || '');
        formData.append('ct', getValue('ct') || '');
        formData.append('conj_swab', getValue('conjunctival-swab') || 'Not Done');
        
        // ========== OPERATION DETAILS ==========
        formData.append('operation_ot', getValue('operation-ot') || '');
        formData.append('operation_date', getValue('operation-date') || '');
        formData.append('operation_time', getValue('operation-time') || '');
        formData.append('operation_doctor', getValue('operation-doctor') || '');
        formData.append('operation_doctor_role', getValue('operation-doctor-role') || '');
        formData.append('operation_notes', getValue('operation-notes') || '');
        
        // ========== VERIFICATION FIELDS ==========
        formData.append('verified_by', getValue('verified-by') || '');
        formData.append('verification_date', getValue('verification-date') || '');
        formData.append('verification_time', getValue('verification-time') || '');
        formData.append('signature', getValue('signature') || 'Pending');
        formData.append('intraop_notes', getValue('intraop-notes') || '');
        formData.append('postop_instructions', getValue('postop-instructions') || '');
        
        // ========== MEDICAL HISTORY & CHECKLIST ==========
        formData.append('medical_history', JSON.stringify(checklistData.medicalHistory));
        formData.append('checklist', JSON.stringify(checklistData));
        
        // ========== CURRENT USER & FILES ==========
        if (currentUser) {
            formData.append('currentUser', currentUser.username);
        }

        // Files
        const newFiles = currentPatientReports.filter(report => !report.isExisting);
        if (newFiles.length > 0) {
            newFiles.forEach(report => {
                if (report.file) {
                    formData.append('reports', report.file);
                }
            });
        }

        let url, method;
        
        if (isEditMode && patientId) {
            url = `${API_BASE_URL}/patients/${patientId}`;
            method = 'PUT';
            console.log('Updating patient:', patientId);
        } else {
            url = `${API_BASE_URL}/patients`;
            method = 'POST';
            console.log('Creating new patient');
        }

        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(errorText || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Server response:', result);
        
        if (result) {
            const action = isEditMode ? 'updated' : 'added';
            showMessage('patient-success', `Patient ${action} successfully! MRD: ${mrdNumber}`);
            
            resetPatientForm();
            clearSavedFormData();
            await loadPatientsFromServer();
            
            // ===== NEW: TRIGGER SERVER PDF GENERATION =====
            try {
                const newPatientId = result.patient_id || (patientId ? patientId : result.id);
                if (newPatientId) {
                    console.log('Triggering server PDF generation for patient:', newPatientId);
                    
                    // Call server endpoint to generate PDF (don't await - let it run in background)
                    fetch(`${API_BASE_URL}/patients/${newPatientId}/generate-pdf`, {
                        method: 'POST'
                    })
                    .then(pdfResponse => pdfResponse.json())
                    .then(pdfResult => {
                        if (pdfResult.success) {
                            console.log('✅ PDF generated and saved:', pdfResult.pdf_files);
                            
                            // Show success message with folder location
                            showMessage('patient-success', 
                                `Patient ${action} successfully! PDF saved to: ${pdfResult.pdf_files.folder}`);
                        } else {
                            console.warn('⚠️ PDF generation had issues:', pdfResult);
                        }
                    })
                    .catch(pdfError => {
                        console.error('Error in PDF generation:', pdfError);
                        // Don't show error to user - main save was successful
                    });
                }
            } catch (pdfError) {
                console.error('Error triggering PDF generation:', pdfError);
                // Don't show error to user - main save was successful
            }
            // ===== END NEW CODE =====
            
            setTimeout(() => {
                showPage('patient-list');
            }, 1500);
        }
        
    } catch (error) {
        console.error('Error saving patient:', error);
        let userMessage = `Failed to ${isEditMode ? 'update' : 'add'} patient: ${error.message}`;
        // Try to parse JSON error from server for a cleaner message
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.message) userMessage = parsed.message;
            else if (parsed.error) userMessage = parsed.error;
        } catch(e) { /* not JSON, use raw message */ }

        const errDiv = document.getElementById('patient-error');
        if (errDiv) {
            errDiv.textContent = '❌ ' + userMessage;
            errDiv.style.display = 'block';
            errDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { errDiv.style.display = 'none'; }, 8000);
        } else {
            alert(userMessage);
        }
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}
// Function to configure PDF save directory
async function configurePDFDirectory() {
    if (!checkPermission('master_manage')) {
        alert('You need administrator permissions to configure PDF directory');
        return;
    }
    
    const currentConfig = await apiRequest('/patient-pdf-directory', 'GET');
    const newDir = prompt('Enter the base directory for saving patient PDFs:', 
                          currentConfig.directory || 'D:/Hospital_Data/Patients');
    
    if (newDir) {
        try {
            const result = await apiRequest('/patient-pdf-directory', 'POST', { directory: newDir });
            if (result.success) {
                alert(`PDF directory updated successfully to:\n${result.directory}`);
            }
        } catch (error) {
            alert('Failed to update PDF directory: ' + error.message);
        }
    }
}

// Check PDF directory status
async function checkPDFDirectory() {
    try {
        const status = await apiRequest('/check-patient-pdf-directory', 'GET');
        console.log('PDF Directory Status:', status);
        return status;
    } catch (error) {
        console.error('Error checking PDF directory:', error);
        return null;
    }
}
function resetPatientForm() {
    const form = document.getElementById('patient-form');
    form.reset();
    form.removeAttribute('data-edit-mode');
    form.removeAttribute('data-patient-id');
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<div class="icon icon-plus"></div> Add Patient';
    
    currentPatientReports = [];
    renderUploadedFiles();
    
    // Reset to step 1
    goToStep('1');
}

// ==================== MULTI-STEP FORM FUNCTIONS ====================

function initializeMultiStepForm() {
    const steps = document.querySelectorAll('.step');
    const formSteps = document.querySelectorAll('.form-step');
    const nextButtons = document.querySelectorAll('.next-step');
    const prevButtons = document.querySelectorAll('.prev-step');
    const form = document.getElementById('patient-form');
    
    // Only load saved form data if not in edit mode
    if (!form.getAttribute('data-edit-mode')) {
        loadSavedFormData();
    }
    
    form.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            if (e.target.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
            const currentStep = document.querySelector('.form-step.active');
            if (currentStep) {
                const nextButton = currentStep.querySelector('.next-step');
                if (nextButton && !nextButton.disabled) {
                    nextButton.click();
                }
            }
            return false;
        }
    });
    
    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', function(e) {
            if (!e.submitter) {
                e.preventDefault();
                return false;
            }
        });
    });
    
    nextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const nextStep = this.getAttribute('data-next');
            const currentStep = document.querySelector('.form-step.active');
            const currentStepNum = currentStep.id.split('-')[1];
            
            if (validateStep(currentStepNum)) {
                saveCurrentStepData(currentStepNum);
                goToStep(nextStep);
            } else {
                showStepError(currentStepNum, 'Please fill all required fields');
            }
        });
    });
    
    prevButtons.forEach(button => {
        button.addEventListener('click', function() {
            const prevStep = this.getAttribute('data-prev');
            const currentStep = document.querySelector('.form-step.active');
            const currentStepNum = currentStep.id.split('-')[1];
            saveCurrentStepData(currentStepNum);
            goToStep(prevStep);
        });
    });
    
    steps.forEach(step => {
        step.addEventListener('click', function() {
            const stepNum = this.getAttribute('data-step');
            const currentStep = document.querySelector('.form-step.active');
            const currentStepNum = currentStep.id.split('-')[1];
            
            if (parseInt(stepNum) < parseInt(currentStepNum) || 
                this.classList.contains('completed')) {
                saveCurrentStepData(currentStepNum);
                goToStep(stepNum);
            } else {
                alert('Please complete the current step first');
            }
        });
    });
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const currentStep = document.querySelector('.form-step.active');
        const currentStepNum = currentStep.id.split('-')[1];
        saveCurrentStepData(currentStepNum);
        
        const allStepsValid = validateAllSteps();
        
        if (allStepsValid) {
            handleAddPatient(e);
        } else {
            const firstInvalidStep = findFirstInvalidStep();
            if (firstInvalidStep) {
                goToStep(firstInvalidStep);
                showStepError(firstInvalidStep, 'Please complete all required fields in this step');
            }
        }
    });
    
    form.addEventListener('input', function() {
        const currentStep = document.querySelector('.form-step.active');
        const currentStepNum = currentStep.id.split('-')[1];
        debounce(() => saveCurrentStepData(currentStepNum), 500)();
    });
}

function validateStep(stepNum) {
    switch(stepNum) {
        case '1':
            return validateStep1();
        case '2':
            return true;
        case '3':
            return true;
        case '4':
            return true;
        case '5':
            return true;
        default:
            return true;
    }
}

function validateStep1() {
    const name = document.getElementById('patient-name')?.value;
    const mrd = document.getElementById('patient-mrd')?.value;
    const age = document.getElementById('patient-age')?.value;
    const gender = document.getElementById('patient-gender')?.value;
    const phone = document.getElementById('patient-phone')?.value;
    const category = document.getElementById('patient-category')?.value;
    
    if (!name || !mrd || !age || !gender || !phone || !category) {
        highlightRequiredFields(['patient-name', 'patient-mrd', 'patient-age', 'patient-gender', 'patient-phone', 'patient-category']);
        return false;
    }
    return true;
}

function validateAllSteps() {
    for (let i = 1; i <= 5; i++) {
        if (!validateStep(i.toString())) {
            return false;
        }
    }
    return true;
}

function findFirstInvalidStep() {
    for (let i = 1; i <= 5; i++) {
        if (!validateStep(i.toString())) {
            return i.toString();
        }
    }
    return null;
}

function saveCurrentStepData(stepNum) {
    const formData = JSON.parse(localStorage.getItem('patientFormData') || '{}');
    
    const currentStep = document.getElementById(`step-${stepNum}`);
    const inputs = currentStep.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        if (input.id && input.id !== 'file-input') {
            if (input.type === 'checkbox') {
                if (!formData[input.name]) {
                    formData[input.name] = [];
                }
                if (input.checked) {
                    if (!formData[input.name].includes(input.value)) {
                        formData[input.name].push(input.value);
                    }
                } else {
                    formData[input.name] = formData[input.name].filter(v => v !== input.value);
                }
            } else if (input.type === 'radio') {
                if (input.checked) {
                    formData[input.name] = input.value;
                }
            } else {
                formData[input.id] = input.value;
            }
        }
    });
    
    localStorage.setItem('patientFormData', JSON.stringify(formData));
    localStorage.setItem('patientFormStep', `step-${stepNum}`);
}

function loadSavedFormData() {
    const savedData = localStorage.getItem('patientFormData');
    const savedStep = localStorage.getItem('patientFormStep');
    
    if (savedData && !document.getElementById('patient-form').getAttribute('data-edit-mode')) {
        try {
            const formData = JSON.parse(savedData);
            
            Object.keys(formData).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    if (element.type === 'checkbox') {
                        const values = formData[key];
                        if (Array.isArray(values)) {
                            values.forEach(value => {
                                const checkbox = document.querySelector(`input[name="${key}"][value="${value}"]`);
                                if (checkbox) checkbox.checked = true;
                            });
                        }
                    } else if (element.type === 'radio') {
                        const radio = document.querySelector(`input[name="${key}"][value="${formData[key]}"]`);
                        if (radio) radio.checked = true;
                    } else {
                        element.value = formData[key];
                    }
                }
            });
            
            if (savedStep) {
                goToStep(savedStep.split('-')[1]);
            }
        } catch (e) {
            console.error('Error loading saved form data:', e);
        }
    }
}

function clearSavedFormData() {
    localStorage.removeItem('patientFormData');
    localStorage.removeItem('patientFormStep');
    console.log('Form data cleared from localStorage');
}

function highlightRequiredFields(fieldIds) {
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field && !field.value) {
            field.style.border = '2px solid #e74c3c';
            setTimeout(() => {
                field.style.border = '';
            }, 3000);
        }
    });
}

function showStepError(stepNum, message) {
    const step = document.getElementById(`step-${stepNum}`);
    let errorDiv = step.querySelector('.step-error-message');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'step-error-message';
        errorDiv.style.cssText = `
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            border: 1px solid #f5c6cb;
        `;
        step.insertBefore(errorDiv, step.firstChild);
    }
    
    errorDiv.textContent = message;
    
    setTimeout(() => {
        if (errorDiv && errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function goToStep(stepNum) {
    const formSteps = document.querySelectorAll('.form-step');
    const steps = document.querySelectorAll('.step');
    
    formSteps.forEach(step => {
        step.classList.remove('active');
    });
    
    document.getElementById(`step-${stepNum}`).classList.add('active');
    
    steps.forEach(step => {
        const stepNumber = parseInt(step.getAttribute('data-step'));
        step.classList.remove('active', 'completed');
        
        if (stepNumber < parseInt(stepNum)) {
            step.classList.add('completed');
        } else if (stepNumber == parseInt(stepNum)) {
            step.classList.add('active');
        }
    });
    
    document.querySelector('.card-body').scrollTop = 0;
}

// ==================== PATIENT LIST FUNCTIONS ====================

async function editPatient(id) {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;

    clearSavedFormData();

    const setVal = (fieldId, value) => {
        const el = document.getElementById(fieldId);
        if (el) el.value = (value !== null && value !== undefined) ? value : '';
    };

    // ── Step 1: Patient Identification ──
    setVal('patient-mrd',          patient.mrd_number);
    setVal('patient-category',     patient.patientCategory);
    setVal('patient-name',         patient.name);
    setVal('patient-age',          patient.age);
    setVal('patient-gender',       patient.gender);
    setVal('patient-phone',        patient.phone);
    setVal('patient-email',        patient.email);
    setVal('patient-blood-group',  patient.blood_group);
    setVal('operation-eye',        patient.eye);
    setVal('eye-condition',        patient.eye_condition);
    setVal('eye-surgery',          patient.eye_surgery);
    setVal('physician',            patient.physician);

    // Medical history
    let mh = {};
    try {
        mh = patient.medicalHistory
            ? (typeof patient.medicalHistory === 'string' ? JSON.parse(patient.medicalHistory) : patient.medicalHistory)
            : {};
    } catch(e) { mh = {}; }
    setVal('diabetic',      mh.diabetic      || 'No');
    setVal('diabetic-since',mh.diabeticSince || '');
    setVal('insulin',       mh.insulin       || 'No');
    setVal('cardiac',       mh.cardiac       || 'No');
    setVal('angioplasty',   mh.angioplasty   || 'No');
    setVal('bypass',        mh.bypass        || 'No');
    setVal('blood-thinner', mh.blood_thinner || 'None');
    setVal('kidney',        mh.kidney        || 'No');
    setVal('dialysis',      mh.dialysis      || 'No');
    setVal('hypertension',  mh.hypertension  || 'No');
    setVal('thyroid',       mh.thyroid       || 'No');
    setVal('asthma',        mh.asthma        || 'No');

    // Address & emergency
    setVal('patient-address',    patient.address);
    setVal('emergency-name',     patient.emergencyName);
    setVal('emergency-phone',    patient.emergencyContact);
    setVal('emergency-relation', patient.emergencyRelation);

    // Insurance
    setVal('insurance-provider', patient.insurance);
    setVal('insurance-id',       patient.insuranceId);
    setVal('patient-category',   patient.patientCategory);

    // ── Step 2: Lab ──
    setVal('lab-name-step2',           patient.lab_name);
    setVal('investigation-date-step2', patient.investigation_date);
    setVal('lab-registration',         patient.lab_registration);
    setVal('gram-swab',                patient.gram_swab);
    setVal('conjunctival-swab',        patient.conj_swab);

    // ── Step 3: Eye Exam ──
    setVal('vision-re',          patient.vision_right);
    setVal('vision-le',          patient.vision_left);
    setVal('bcva-re',            patient.bcva_right);
    setVal('bcva-le',            patient.bcva_left);
    setVal('specular-re',        patient.specular_right);
    setVal('specular-le',        patient.specular_left);
    setVal('cataract-type-re',   patient.cataract_type_right);
    setVal('cataract-type-le',   patient.cataract_type_left);
    setVal('fundus-view-re',     patient.fundus_view_right);
    setVal('fundus-view-le',     patient.fundus_view_left);
    setVal('pupil-dilation-re',  patient.pupil_dilation_right);
    setVal('pupil-dilation-le',  patient.pupil_dilation_left);
    setVal('iop-re',             patient.iop_right);
    setVal('iop-le',             patient.iop_left);
    setVal('diagnosis',          patient.diagnosis);

    // Investigations
    setVal('oct',             patient.oct);
    setVal('argas',           patient.argas);
    setVal('pentacam',        patient.pentacam);
    setVal('bscan',           patient.bscan);
    setVal('medical-fitness', patient.medical_fitness);
    setVal('ecg',             patient.ecg);
    setVal('bt',              patient.bt);
    setVal('ct',              patient.ct);

    // ── Restore from checklist JSON (Step 4 & Step 2 details) ──
    try {
        const cl = patient.checklist
            ? (typeof patient.checklist === 'string' ? JSON.parse(patient.checklist) : patient.checklist)
            : {};

        // Lab (Step 2 extras)
        const lt = cl.labTests || {};
        if (lt.gramSwab)       setVal('gram-swab',          lt.gramSwab);
        if (lt.labRegistration) setVal('lab-registration',  lt.labRegistration);
        if (lt.iolCategoryLab) setVal('iol-category-lab',   lt.iolCategoryLab);

        // Blood tests
        const bl = lt.blood || {};
        ['hemoglobin:hb','esr:esr','crp:crp','platelet:platelet','tlc:tlc',
         'neutrophil:neutrophil','lymphocyte:lymphocyte','eosinophil:eosinophil',
         'monocyte:monocyte','basophil:basophil','fbs:fbs','ppbs:ppbs','rbs:rbs',
         'hba1c:hba1c','creatinine:creatinine','bun:bun','sodium:sodium',
         'potassium:potassium','chloride:chloride'].forEach(pair => {
            const [key, id] = pair.split(':');
            if (bl[key] !== undefined) setVal(id, bl[key]);
        });

        // Urine tests
        const ur = lt.urine || {};
        ['type:urine-type','protein:urine-protein','glucose:urine-glucose',
         'ketone:urine-ketone','blood:urine-blood','pus:urine-pus',
         'epithelial:urine-epithelial','bacteria:urine-bacteria','cast:urine-cast'].forEach(pair => {
            const [key, id] = pair.split(':');
            if (ur[key] !== undefined) setVal(id, ur[key]);
        });

        // Infective markers
        const inf = lt.infective || {};
        ['hbsag:hbsag','hcv:hcv','hiv:hiv','hbv:hbv'].forEach(pair => {
            const [key, id] = pair.split(':');
            if (inf[key] !== undefined) setVal(id, inf[key]);
        });

        // Biometry (Step 4)
        const bm = cl.biometry || {};
        const re = bm.rightEye || {};
        const le = bm.leftEye  || {};
        ['al','k1','k2','cyl','acd','lt','cct','wtw'].forEach(f => {
            if (re[f] !== undefined) setVal(`${f}-re`, re[f]);
            if (le[f] !== undefined) setVal(`${f}-le`, le[f]);
        });

        // IOL Calculation (Step 4)
        const iol = cl.iolCalculation || {};
        if (iol.aconstant)     setVal('aconstant',      iol.aconstant);
        if (iol.iolPowerRE)    setVal('iol-power-re',   iol.iolPowerRE);
        if (iol.iolPowerLE)    setVal('iol-power-le',   iol.iolPowerLE);
        if (iol.iolCategory)   setVal('iol-category',   iol.iolCategory);
        if (iol.iolManufacturer) setVal('iol-manufacturer', iol.iolManufacturer);
        if (iol.targetRE)      setVal('target-re',      iol.targetRE);
        if (iol.targetLE)      setVal('target-le',      iol.targetLE);

        // Surgical Aids (Step 4)
        const sa = cl.surgicalAids || {};
        if (sa.viscoat)              setVal('viscoat',            sa.viscoat);
        if (sa.bhexRing)             setVal('bhex-ring',          sa.bhexRing);
        if (sa.ctrRing)              setVal('ctr-ring',           sa.ctrRing);
        if (sa.toricSheet)           setVal('toric-sheet',        sa.toricSheet);
        if (sa.otherAids)            setVal('other-aids',         sa.otherAids);
        if (sa.specialRequirements)  setVal('intraop-requirements', sa.specialRequirements);
        if (sa.accessRequired)       setVal('access-required',    sa.accessRequired);

    } catch(e) {
        console.warn('Could not restore checklist fields on edit:', e);
    }

    // ── Step 5: Verification ──
    setVal('verified-by',         patient.verified_by);
    setVal('verification-date',   patient.verification_date);
    setVal('verification-time',   patient.verification_time);
    setVal('signature',           patient.signature);
    setVal('intraop-notes',       patient.intraop_notes);
    setVal('postop-instructions', patient.postop_instructions);

    const form = document.getElementById('patient-form');
    form.setAttribute('data-edit-mode', 'true');
    form.setAttribute('data-patient-id', id);
    form.removeAttribute('data-new-surgery');

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<div class="icon icon-save"></div> Update Patient';

    goToStep('1');
    showPage('patients');
    window.scrollTo(0, 0);

    await loadPatientReports(id);
}

function renderPatientList(filter = '') {
    const tbody = document.getElementById('patient-list-tbody');
   
    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center;">No patients found</td></tr>';
        return;
    }
   
    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.phone.includes(filter) ||
        p.id.toLowerCase().includes(filter.toLowerCase()) ||
        (p.mrd_number && p.mrd_number.toLowerCase().includes(filter.toLowerCase())) ||
        (p.eye && getEyeDisplayName(p.eye).toLowerCase().includes(filter.toLowerCase())) ||
        (p.eye_condition && p.eye_condition.toLowerCase().includes(filter.toLowerCase()))
    );
   
    if (filteredPatients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center;">No matching patients found</td></tr>';
        return;
    }
   
    tbody.innerHTML = filteredPatients.map(patient => {
        const scheduledOT = otSchedules.find(s => s.mrd_number === patient.mrd_number && s.status !== 'Cancelled');
        const scheduledOTName = scheduledOT ? scheduledOT.ot_name : (patient.operationOt || '-');
        
        return `
        <tr>
            <td><strong>${patient.mrd_number || '-'}</strong></td>
            <td><a href="#" onclick="viewPatient('${patient.id}'); return false;" style="color: var(--primary); text-decoration: none; font-weight: 500;">${patient.name}</a></td>
            <td>${patient.patientCategory || '-'}</td>
            <td>${patient.age || '-'}</td>
            <td>${patient.gender || '-'}</td>
            <td>
                ${(() => {
                    const eyeVal = patient.eye;
                    const eyeDisplay = getEyeDisplayName(eyeVal);
                    const cssClass = getEyeStatusClass(eyeVal);
                    if (eyeVal && eyeVal.trim()) {
                        return `<span class="eye-status ${cssClass}" style="font-weight:600;">${eyeDisplay}</span>`;
                    } else if (patient.eye_condition && patient.eye_condition.trim()) {
                        return `<span style="color:#6c757d;font-size:12px;">${patient.eye_condition}</span>`;
                    } else {
                        return `<span style="color:#adb5bd;">—</span>`;
                    }
                })()}
            </td>
            <td>${patient.phone || '-'}</td>
            <td>${patient.eye_surgery || '-'}</td>
            <td>${scheduledOTName}</td>
            <td>${patient.operationDate ? new Date(patient.operationDate).toLocaleDateString() : '-'}</td>
            <td>${patient.operationTime || '-'}</td>
            <td>
                ${patient.reportCount > 0 ?
                    `<span class="status-badge in-stock">${patient.reportCount} files</span>` :
                    '<span class="status-badge" style="background: #f8f9fa; color: #6c757d;">No files</span>'
                }
            </td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="viewPatient('${patient.id}')">View</button>
                <button class="action-btn edit needs-perm" data-permission="patient_edit" onclick="editPatient('${patient.id}')">Edit</button>
                <button class="action-btn delete needs-perm" data-permission="patient_delete" onclick="deletePatient('${patient.id}')">Delete</button>
            </td>
        </tr>
    `}).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

function getEyeDisplayName(eyeValue) {
    if (!eyeValue) return 'Not Specified';
    // Handle both short codes and full strings saved by the form
    const eyeMap = {
        'left': 'Left Eye',
        'right': 'Right Eye',
        'both': 'Both Eyes',
        'not_specified': 'Not Specified',
        'Left Eye': 'Left Eye',
        'Right Eye': 'Right Eye',
        'Both Eye': 'Both Eyes',
        'Both Eyes': 'Both Eyes'
    };
    return eyeMap[eyeValue] || eyeValue;
}

function getEyeStatusClass(eyeValue) {
    if (!eyeValue) return '';
    const v = eyeValue.toLowerCase();
    if (v.includes('right') && !v.includes('left')) return 'eye-status-right';
    if (v.includes('left')  && !v.includes('right')) return 'eye-status-left';
    if (v.includes('both')  || (v.includes('right') && v.includes('left'))) return 'eye-status-both';
    return '';
}

async function loadPatientReports(patientId) {
    const reportsData = await apiRequest(`/patients/${patientId}/reports`);
    if (reportsData) {
        currentPatientReports = reportsData.map(report => ({
            id: report.id,
            name: report.original_name,
            size: formatFileSize(report.file_size),
            type: report.file_type,
            filename: report.filename,
            uploadDate: new Date(report.upload_date).toLocaleString(),
            isExisting: true,
            patientId: patientId
        }));
        renderUploadedFiles();
    }
}

async function viewPatient(id) {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;

    const modalBody = document.getElementById('patientModalBody');
    modalBody.innerHTML = '<div style="text-align:center;padding:30px;color:#666;">Loading full patient details…</div>';
    openModal('patientModal');
    const printBtn = document.getElementById('patientModalPrintBtn');
    if (printBtn) printBtn.style.display = '';

    // Parallel fetch
    const [reportsData, biometryData, labData] = await Promise.all([
        apiRequest(`/patients/${id}/reports`).catch(() => []),
        apiRequest(`/patients/${id}/biometry`).catch(() => []),
        apiRequest(`/patients/${id}/lab-results`).catch(() => [])
    ]);

    const patientReports = reportsData || [];
    const scheduledOT = otSchedules.find(s => s.mrd_number === patient.mrd_number && s.status !== 'Cancelled');

    // Parse medical history JSON if stored as string
    let mh = {};
    try {
        mh = patient.medicalHistory
            ? (typeof patient.medicalHistory === 'string' ? JSON.parse(patient.medicalHistory) : patient.medicalHistory)
            : {};
    } catch(e) { mh = {}; }

    // ── Helpers ──────────────────────────────────────────────
    const val = (v) => (v && String(v).trim() && v !== 'undefined') ? v : null;
    const row = (label, v) => val(v)
        ? `<div class="detail-row">
             <div class="detail-label">${label}:</div>
             <div class="detail-value">${v}</div>
           </div>` : '';

    const statusBadge = (v) => {
        if (!val(v)) return v || '—';
        const map = {
            'Done':'#27ae60','Normal':'#27ae60','Negative':'#27ae60',
            'Yes – Fit for Surgery':'#27ae60','Yes':'#27ae60',
            'Not Done':'#95a5a6','No':'#6c757d','None':'#6c757d',
            'Abnormal':'#e74c3c','Positive':'#e74c3c',
            'No – Not Fit / Requires Clearance':'#e74c3c',
            'Pending':'#e67e22','Poor':'#e67e22',
            'Good':'#27ae60','Adequate':'#3498db'
        };
        const col = map[v];
        return col
            ? `<span style="background:${col};color:white;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:500;">${v}</span>`
            : v;
    };

    const section = (title, icon, content) => content.trim()
        ? `<div style="margin-bottom:18px;">
             <div style="background:linear-gradient(90deg,#1d4ed8,#2563eb);color:white;padding:7px 14px;
                         border-radius:4px 4px 0 0;font-weight:700;font-size:12px;letter-spacing:0.5px;">
               ${title}
             </div>
             <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 4px 4px;background:white;">
               ${content}
             </div>
           </div>` : '';

    // ── Reports ──────────────────────────────────────────────
    const reportsHtml = patientReports.length > 0
        ? patientReports.map(r => `
            <div class="detail-row">
                <div class="detail-label">${r.original_name}</div>
                <div class="detail-value">
                    <a href="${r.file_url}" target="_blank" class="btn btn-primary" style="font-size:11px;padding:3px 10px;">View</a>
                    <button class="btn btn-secondary" style="font-size:11px;padding:3px 10px;margin-left:6px;" onclick="deletePatientFile('${id}','${r.id}')">Delete</button>
                    <small style="margin-left:8px;color:#888;">${formatFileSize(r.file_size)} – ${new Date(r.upload_date).toLocaleDateString()}</small>
                </div>
            </div>`).join('')
        : '<div class="detail-row"><div class="detail-value" style="color:#888;">No reports uploaded</div></div>';

    // ── Biometry ──────────────────────────────────────────────
    let bioHtml = '';
    if (biometryData && biometryData.length > 0) {
        biometryData.forEach(b => {
            bioHtml += row(`${b.eye} Eye – Measurements`,
                `AL: ${b.al||'—'} &nbsp;|&nbsp; K1: ${b.k1||'—'} &nbsp;|&nbsp; K2: ${b.k2||'—'} &nbsp;|&nbsp; CYL: ${b.cyl||'—'} &nbsp;|&nbsp; ACD: ${b.acd||'—'} &nbsp;|&nbsp; LT: ${b.lt||'—'} &nbsp;|&nbsp; CCT: ${b.cct||'—'} &nbsp;|&nbsp; WTW: ${b.wtw||'—'}`);
            bioHtml += row(`${b.eye} Eye – IOL`,
                `Power: ${b.iol_power||'—'} &nbsp;|&nbsp; A-const: ${b.aconstant||'—'} &nbsp;|&nbsp; Category: ${b.iol_category||'—'} &nbsp;|&nbsp; Manufacturer: ${b.iol_manufacturer||'—'}`);
        });
    } else {
        // Also show inline biometry from patient record if biometry table is empty
        const hasBio = patient.iop_left || patient.iop_right || patient.vision_left || patient.vision_right;
        if (hasBio) {
            bioHtml += row('Vision RE / LE', `${patient.vision_right||'—'} / ${patient.vision_left||'—'}`);
            bioHtml += row('BCVA RE / LE', `${patient.bcva_right||'—'} / ${patient.bcva_left||'—'}`);
            bioHtml += row('Specular RE / LE', `${patient.specular_right||'—'} / ${patient.specular_left||'—'}`);
            bioHtml += row('IOP RE / LE', `${patient.iop_right||'—'} / ${patient.iop_left||'—'} mmHg`);
        } else {
            bioHtml = '<div class="detail-row"><div class="detail-value" style="color:#888;">No biometry data recorded</div></div>';
        }
    }

    // ── Lab ──────────────────────────────────────────────────
    let labHtml = '';
    if (labData && labData.length > 0) {
        const grouped = {};
        labData.forEach(l => {
            if (!grouped[l.test_category]) grouped[l.test_category] = [];
            grouped[l.test_category].push(l);
        });
        Object.entries(grouped).forEach(([cat, tests]) => {
            labHtml += row(cat, tests.map(t =>
                `${t.test_name}: <b>${t.test_value||'—'}</b> ${t.test_unit||''}`
            ).join(' &nbsp;|&nbsp; '));
        });
    } else {
        labHtml = '<div class="detail-row"><div class="detail-value" style="color:#888;">No lab results recorded</div></div>';
    }

    // ── Assemble modal ───────────────────────────────────────
    modalBody.innerHTML = `
    <style>
      #patient-full-detail-print .detail-row{display:flex;padding:7px 14px;border-bottom:1px solid #f1f5f9;font-size:12.5px;gap:10px;}
      #patient-full-detail-print .detail-row:nth-child(odd){background:#f8fafc;}
      #patient-full-detail-print .detail-label{font-weight:600;color:#374151;min-width:200px;flex-shrink:0;}
      #patient-full-detail-print .detail-value{color:#111827;flex:1;word-break:break-word;}
    </style>
    <div id="patient-full-detail-print">

      <!-- Patient header bar -->
      <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;padding:14px 18px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:17px;font-weight:800;">${patient.name}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:3px;">
            ${patient.age ? patient.age + ' yrs' : ''} ${patient.gender ? '| ' + patient.gender : ''} ${patient.patientCategory ? '| ' + patient.patientCategory : ''}
          </div>
        </div>
        <div style="text-align:right;font-size:12px;opacity:0.9;">
          <div style="font-size:14px;font-weight:700;">MRD: ${patient.mrd_number || patient.id}</div>
          <div style="margin-top:2px;">Registered: ${patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : '—'}</div>
        </div>
      </div>

      ${section('1. PATIENT IDENTIFICATION', 'id-card', `
        ${row('MRD Number', patient.mrd_number || patient.id)}
        ${row('Patient ID', patient.id)}
        ${row('Full Name', patient.name)}
        ${row('Age', patient.age ? patient.age + ' years' : null)}
        ${row('Gender', patient.gender)}
        ${row('Phone', patient.phone)}
        ${row('Email', patient.email)}
        ${row('Blood Group', patient.bloodGroup)}
        ${row('Patient Category', patient.patientCategory)}
        ${row('Insurance', patient.insurance)}
        ${row('Insurance ID', patient.insuranceId)}
        ${row('Address', patient.address)}
        ${row('Emergency Contact', patient.emergencyName
            ? patient.emergencyName + (patient.emergencyContact ? ' – ' + patient.emergencyContact : '') + (patient.emergencyRelation ? ' (' + patient.emergencyRelation + ')' : '')
            : null)}
        ${row('Physician', patient.physician)}
        ${row('Lab Name', patient.lab_name)}
        ${row('EMR Number', patient.emr_number)}
        ${row('Investigation Date', patient.investigation_date)}
      `)}

      ${section('2. MEDICAL HISTORY', 'notes-medical', (() => {
          const diabetic = mh.diabetic || patient.medicalHistory?.diabetic;
          const cardiac  = mh.cardiac  || patient.medicalHistory?.cardiac;
          return `
            ${row('Diabetic', statusBadge(diabetic || 'No'))}
            ${mh.diabeticSince ? row('Diabetic Since', mh.diabeticSince + ' years') : ''}
            ${mh.insulin ? row('On Insulin', statusBadge(mh.insulin)) : ''}
            ${row('Cardiac History', statusBadge(mh.cardiac || 'No'))}
            ${row('Angioplasty', statusBadge(mh.angioplasty || 'No'))}
            ${row('Bypass Surgery', statusBadge(mh.bypass || 'No'))}
            ${row('Blood Thinner', mh.blood_thinner || 'None')}
            ${row('Hypertension', statusBadge(mh.hypertension || 'No'))}
            ${row('Kidney Disease', statusBadge(mh.kidney || 'No'))}
            ${row('On Dialysis', statusBadge(mh.dialysis || 'No'))}
            ${row('Thyroid Disorder', statusBadge(mh.thyroid || 'No'))}
            ${row('Asthma / COPD', statusBadge(mh.asthma || 'No'))}
            ${row('Allergies', patient.allergies?.join(', '))}
            ${row('Medications', patient.medications?.join(', '))}
          `;
      })())}

      ${section('3. EYE FOR OPERATION', 'eye', `
        ${row('Eye(s) for Operation', patient.eye)}
        ${row('Eye Condition', patient.eye_condition)}
        ${row('Previous Eye Surgery', patient.eye_surgery)}
      `)}

      ${section('4. VISUAL ACUITY & CLINICAL FINDINGS', 'eye', `
        ${row('Vision RE (UCVA)', patient.vision_right)}
        ${row('Vision LE (UCVA)', patient.vision_left)}
        ${row('BCVA RE', patient.bcva_right)}
        ${row('BCVA LE', patient.bcva_left)}
        ${row('Specular RE', patient.specular_right ? patient.specular_right + ' cells/mm²' : null)}
        ${row('Specular LE', patient.specular_left  ? patient.specular_left  + ' cells/mm²' : null)}
        ${row('Cataract Type RE', patient.cataract_type_right)}
        ${row('Cataract Type LE', patient.cataract_type_left)}
        ${row('Fundus View RE', patient.fundus_view_right)}
        ${row('Fundus View LE', patient.fundus_view_left)}
        ${row('Pupil Dilation RE', statusBadge(patient.pupil_dilation_right))}
        ${row('Pupil Dilation LE', statusBadge(patient.pupil_dilation_left))}
        ${row('IOP RE', patient.iop_right ? patient.iop_right + ' mmHg' : null)}
        ${row('IOP LE', patient.iop_left  ? patient.iop_left  + ' mmHg' : null)}
        ${row('Diagnosis', patient.diagnosis)}
      `)}

      ${section('5. INVESTIGATIONS', 'procedure', `
        ${row('OCT', statusBadge(patient.oct))}
        ${row('ARGUS', statusBadge(patient.argas))}
        ${row('Pentacam', statusBadge(patient.pentacam))}
        ${row('B-Scan', statusBadge(patient.bscan))}
        ${row('ECG', statusBadge(patient.ecg))}
        ${row('Medical Fitness', statusBadge(patient.medical_fitness))}
        ${row('BT (Bleeding Time)', patient.bt)}
        ${row('CT (Clotting Time)', patient.ct)}
        ${row('Conjunctival Swab', statusBadge(patient.conj_swab))}
      `)}

      ${section('6. BIOMETRY DATA', 'calculator', bioHtml)}
      ${section('7. LAB RESULTS', 'blood', labHtml)}

      ${section('8. OPERATION DETAILS', 'shedule', `
        ${row('Operation Theater', scheduledOT ? scheduledOT.ot_name : patient.operationOt)}
        ${row('Operation Date', scheduledOT ? scheduledOT.schedule_date : patient.operationDate)}
        ${row('Start Time', scheduledOT ? scheduledOT.start_time : patient.operationTime)}
        ${row('Surgeon / Doctor', scheduledOT ? scheduledOT.surgeon : patient.operationDoctor)}
        ${row('Doctor Role', patient.operationDoctorRole)}
        ${row('Operation Notes', patient.operationNotes)}
      `)}

      ${section('9. VERIFICATION', 'verified', `
        ${row('Verified By', patient.verified_by)}
        ${row('Verification Date', patient.verification_date)}
        ${row('Verification Time', patient.verification_time)}
        ${row('Signature Status', statusBadge(patient.signature))}
        ${row('Intra-op Notes', patient.intraop_notes)}
        ${row('Post-op Instructions', patient.postop_instructions)}
      `)}

      ${section('10. MEDICAL REPORTS', 'file-medical', reportsHtml)}

    </div>`;

    if (currentUser) applyPermissions();
}


async function deletePatientFile(patientId, reportId) {
    if (confirm('Are you sure you want to delete this file?')) {
        const result = await apiRequest(`/patients/${patientId}/reports/${reportId}`, 'DELETE');
        if (result) {
            viewPatient(patientId);
            await loadPatientsFromServer();
            renderPatientList();
        } else {
            alert('Failed to delete file');
        }
    }
}

async function deletePatient(id) {
    if (confirm('Are you sure you want to delete this patient?')) {
        const result = await apiRequest(`/patients/${id}`, 'DELETE');
        if (result) {
            const index = patients.findIndex(p => p.id === id);
            if (index !== -1) {
                const patient = patients[index];
                patients.splice(index, 1);
                addActivity('Deleted Patient', patient.name);
                renderPatientList();
                updateDashboard();
            }
        } else {
            alert('Failed to delete patient from server.');
        }
    }
}

// ==================== STORE FUNCTIONS ====================

function renderStoreItems() {
    const tbody = document.getElementById('store-tbody');
   
    if (storeItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No items in inventory</td></tr>';
        return;
    }
   
    tbody.innerHTML = storeItems.map(item => {
        let status = '';
        let statusClass = '';
       
        if (item.quantity === 0) {
            status = 'Out of Stock';
            statusClass = 'out-of-stock';
        } else if (item.quantity <= item.min_stock) {
            status = 'Low Stock';
            statusClass = 'low-stock';
        } else {
            status = 'In Stock';
            statusClass = 'in-stock';
        }
       
        return `
            <tr>
                <td>I${String(item.id).padStart(3, '0')}</td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.quantity}</td>
                <td>${item.min_stock}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td class="action-buttons">
                    <button class="action-btn edit needs-perm" data-permission="store_manage" onclick="updateStock(${item.id})">Update</button>
                    <button class="action-btn delete needs-perm" data-permission="store_manage" onclick="deleteItem(${item.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

function showAddItemModal() {
    document.getElementById('item-form').reset();
    document.getElementById('store-success').classList.remove('show');
    document.getElementById('store-error').classList.remove('show');
    
    populateDropdowns();
    
    openModal('addItemModal');
}

async function handleAddItem() {
    console.log('=== FRONTEND: Adding item ===');
    
    const itemName = document.getElementById('item-name').value.trim();
    const itemCategory = document.getElementById('item-category').value;
    const itemQuantity = parseInt(document.getElementById('item-quantity').value) || 0;
    const itemMinStock = parseInt(document.getElementById('item-min-stock').value) || 10;
    
    console.log('Item data:', { itemName, itemCategory, itemQuantity, itemMinStock });
    
    if (!itemName) {
        showMessage('store-error', 'Item name is required', 'error');
        return;
    }

    if (!itemCategory) {
        showMessage('store-error', 'Item category is required', 'error');
        return;
    }

    if (itemQuantity < 0) {
        showMessage('store-error', 'Quantity cannot be negative', 'error');
        return;
    }

    if (itemMinStock < 0) {
        showMessage('store-error', 'Minimum stock cannot be negative', 'error');
        return;
    }

    try {
        console.log('Sending API request...');
        
        const itemData = {
            name: itemName,
            category: itemCategory,
            quantity: itemQuantity,
            min_stock: itemMinStock,
            price: 0,
            currentUser: currentUser ? currentUser.username : 'System'
        };
        
        console.log('Sending data:', itemData);

        const result = await apiRequest('/items', 'POST', itemData);
       
        console.log('API response:', result);
        
        if (result && result.id) {
            await loadStoreItemsFromServer();
            
            addActivity('Added Store Item', itemData.name);
            showMessage('store-success', 'Item added successfully!');
            
            document.getElementById('item-form').reset();
           
            setTimeout(() => {
                closeModal('addItemModal');
                renderStoreItems();
                updateDashboard();
            }, 1500);
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error adding item:', error);
        showMessage('store-error', `Failed to add item: ${error.message}`, 'error');
    }
}

async function updateStock(id) {
    const item = storeItems.find(i => i.id === id);
    if (item) {
        const newQty = prompt(`Update quantity for ${item.name}\nCurrent: ${item.quantity}`, item.quantity);
        if (newQty !== null && !isNaN(newQty)) {
            const result = await apiRequest(`/items/${id}/stock`, 'PATCH', { quantity: parseInt(newQty) });
            if (result) {
                item.quantity = parseInt(newQty);
                addActivity('Updated Stock', `${item.name} (Qty: ${newQty})`);
                renderStoreItems();
                updateDashboard();
            } else {
                alert('Failed to update stock on server.');
            }
        }
    }
}

async function deleteItem(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        const result = await apiRequest(`/items/${id}`, 'DELETE');
        if (result) {
            const index = storeItems.findIndex(i => i.id === id);
            if (index !== -1) {
                const item = storeItems[index];
                storeItems.splice(index, 1);
                addActivity('Deleted Store Item', item.name);
                renderStoreItems();
                updateDashboard();
            }
        } else {
            alert('Failed to delete item from server.');
        }
    }
}

// ==================== ORDER FUNCTIONS ====================

function showCreateOrder() {
    const orderItemSelect = document.getElementById('order-item');
    orderItemSelect.innerHTML = '<option value="">Select an item</option>';
    storeItems.forEach(item => {
        orderItemSelect.innerHTML += `<option value="${item.id}">${item.name} (Available: ${item.quantity})</option>`;
    });
   
    openModal('orderModal');
}

async function saveOrder() {
    const itemId = parseInt(document.getElementById('order-item').value);
    const department = document.getElementById('order-department').value;
    const quantity = parseInt(document.getElementById('order-quantity').value);
    const urgency = document.getElementById('order-urgency').value;
    
    if (!itemId || !department || !quantity) {
        alert('Please fill all required fields');
        return;
    }
    
    const item = storeItems.find(i => i.id === itemId);
    if (!item) {
        alert('Item not found');
        return;
    }
    
    const orderData = {
        item_id: itemId,
        item_name: item.name,
        ot_name: department,
        quantity: quantity,
        urgency: urgency,
        status: 'pending'
    };
    
    const result = await apiRequest('/orders', 'POST', orderData);
   
    if (result) {
        const order = {
            id: result.id,
            ...orderData,
            created_at: new Date().toISOString()
        };
        orders.push(order);
        latestOrderId = order.id;
        addActivity('Placed Order', `${item.name} for ${department}`);
        closeModal('orderModal');
        document.getElementById('order-form').reset();
        renderOrders();
       
        updateStoreNotificationBadge();
        document.querySelector('[data-tab="orders"]').click();
    } else {
        alert('Failed to place order. Please check if server is running.');
    }
}

function renderOrders() {
    const tbody = document.getElementById('orders-tbody');
   
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => {
        let urgencyColor = '';
        if (order.urgency === 'critical') urgencyColor = 'color: #e74c3c; font-weight: bold;';
        else if (order.urgency === 'high') urgencyColor = 'color: #f39c12; font-weight: bold;';
        else if (order.urgency === 'medium') urgencyColor = 'color: #3498db;';
        
        let statusBadge = '';
        if (order.status === 'pending') statusBadge = '<span class="status-badge" style="background: #fff3cd; color: #856404;">Pending</span>';
        else if (order.status === 'dispatched') statusBadge = '<span class="status-badge" style="background: #cfe2ff; color: #084298;">Dispatched</span>';
        else if (order.status === 'completed') statusBadge = '<span class="status-badge in-stock">Completed</span>';
        else if (order.status === 'cancelled') statusBadge = '<span class="status-badge out-of-stock">Cancelled</span>';
        
        return `
            <tr>
                <td>ORD${String(order.id).padStart(3, '0')}</td>
                <td>${order.item_name}</td>
                <td><strong>${order.ot_name}</strong></td>
                <td>${order.quantity}</td>
                <td style="${urgencyColor}">${order.urgency.toUpperCase()}</td>
                <td>${statusBadge}</td>
                <td>${new Date(order.created_at).toLocaleString()}</td>
                <td class="action-buttons">
                    ${order.status === 'pending' ? `
                        <button class="action-btn view needs-perm" data-permission="order_manage" onclick="updateOrderStatus(${order.id}, 'dispatched')">Dispatch</button>
                        <button class="action-btn edit needs-perm" data-permission="order_manage" onclick="updateOrderStatus(${order.id}, 'completed')">Complete</button>
                    ` : ''}
                    ${order.status === 'dispatched' ? `
                        <button class="action-btn edit needs-perm" data-permission="order_manage" onclick="updateOrderStatus(${order.id}, 'completed')">Complete</button>
                    ` : ''}
                    <button class="action-btn delete needs-perm" data-permission="store_manage" onclick="deleteOrder(${order.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

async function updateOrderStatus(orderId, status) {
    const result = await apiRequest(`/orders/${orderId}/status`, 'PUT', { status: status });
    if (result) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = status;
            
            if (status === 'dispatched' || status === 'completed') {
                await reduceInventoryForOrder(order);
            }
            
            addActivity('Updated Order Status', `Order #${orderId} - ${status}`);
            renderOrders();
            renderStoreItems();
            updateStoreNotificationBadge();
        }
    } else {
        alert('Failed to update order status on server.');
    }
}

async function reduceInventoryForOrder(order) {
    const item = storeItems.find(i => i.id === order.item_id);
    if (item) {
        const newQuantity = Math.max(0, item.quantity - order.quantity);
        
        const result = await apiRequest(`/items/${order.item_id}/stock`, 'PATCH', { 
            quantity: newQuantity 
        });
        
        if (result) {
            item.quantity = newQuantity;
            addActivity('Reduced Inventory', `${order.item_name} reduced by ${order.quantity} for order #${order.id}`);
        } else {
            console.error('Failed to update inventory for order:', order.id);
        }
    }
}

async function deleteOrder(orderId) {
    if (confirm('Are you sure you want to delete this order?')) {
        const result = await apiRequest(`/orders/${orderId}`, 'DELETE');
        if (result) {
            const index = orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
                const order = orders[index];
                orders.splice(index, 1);
               
                if (order.id === latestOrderId) {
                    if (orders.length > 0) {
                        latestOrderId = Math.max(...orders.map(o => o.id));
                    } else {
                        latestOrderId = 0;
                    }
                }
                addActivity('Deleted Order', `Order #${orderId} for ${order.ot_name}`);
                renderOrders();
               
                updateStoreNotificationBadge();
            }
        } else {
            alert('Failed to delete order from server.');
        }
    }
}

// ==================== ROLE MANAGEMENT FUNCTIONS ====================

function renderRoles() {
    const tbody = document.getElementById('roles-tbody');
    
    if (!tbody) {
        console.error('Roles table body not found');
        return;
    }

    if (roles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No roles found</td></tr>';
        return;
    }
    
    tbody.innerHTML = roles.map(role => {
        let permDisplay = role.permissions === 'all' ? 'All Permissions' :
                        (role.permissions ? role.permissions.split(',').length : 0) + ' permissions';
        
        return `
            <tr>
                <td>${role.role_id}</td>
                <td><strong>${role.role_name}</strong></td>
                <td>${permDisplay}</td>
                <td>${role.user_count || 0}</td>
                <td class="action-buttons">
                    <button class="action-btn view" onclick="viewRolePermissions('${role.role_id}')">View</button>
                    <button class="action-btn edit needs-perm" data-permission="role_manage" onclick="editRole('${role.role_id}')">Edit</button>
                    <button class="action-btn delete needs-perm" data-permission="role_manage" onclick="deleteRole('${role.role_id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

function showCreateRole() {
    document.getElementById('role-form').reset();
    document.querySelectorAll('#roleModal input[type="checkbox"]').forEach(cb => cb.checked = false);
    openModal('roleModal');
}

function viewRolePermissions(roleId) {
    const role = roles.find(r => r.role_id === roleId);
    if (role) {
        let permList = role.permissions === 'all' ?
            'All system permissions' :
            (role.permissions ? role.permissions.split(',').map(p => '• ' + p.replace(/_/g, ' ')).join('\n') : 'None');
        
        alert(`Role: ${role.role_name}\n\nPermissions:\n${permList}\n\nDescription:\n${role.description}`);
    }
}

function editRole(roleId) {
    const role = roles.find(r => r.role_id === roleId);
    if (role) {
        document.getElementById('role-name').value = role.role_name;
        document.getElementById('role-description').value = role.description || '';
        
        document.querySelectorAll('#roleModal input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        if (role.permissions === 'all') {
            document.querySelectorAll('#roleModal input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
        } else if (role.permissions) {
            const perms = role.permissions.split(',');
            perms.forEach(perm => {
                const checkbox = document.querySelector(`#roleModal input[value="${perm}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        openModal('roleModal');
    }
}

async function saveRole() {
    const name = document.getElementById('role-name').value;
    const description = document.getElementById('role-description').value;
    
    if (!name) {
        alert('Role name is required');
        return;
    }

    const selectedPerms = [];
    document.querySelectorAll('#roleModal input[type="checkbox"]:checked').forEach(cb => {
        selectedPerms.push(cb.value);
    });

    const permissions = selectedPerms.length > 0 ? selectedPerms.join(',') : '';

    const roleData = {
        role_name: name,
        permissions: permissions,
        description: description,
        user_count: 0
    };

    try {
        let result;
        
        const existingRole = roles.find(r => r.role_name === name);
        if (existingRole) {
            result = await apiRequest(`/roles/${existingRole.role_id}`, 'PUT', roleData);
        } else {
            let roleId;
            let counter = 1;
            do {
                roleId = 'R' + String(counter).padStart(3, '0');
                counter++;
            } while (roles.find(r => r.role_id === roleId) && counter < 1000);
            
            roleData.role_id = roleId;
            result = await apiRequest('/roles', 'POST', roleData);
        }

        if (result) {
            await loadRolesFromServer();
            
            addActivity(existingRole ? 'Updated Role' : 'Created Role', name);
            closeModal('roleModal');
            renderRoles();
            updateDashboard();
            populateRoleDropdown();
            
            showMessage('role-success', `Role ${existingRole ? 'updated' : 'created'} successfully!`);
        } else {
            alert('Failed to save role. Please try again.');
        }
    } catch (error) {
        console.error('Error saving role:', error);
        alert('Failed to save role. Please check the console for details.');
    }
}

async function deleteRole(roleId) {
    if (confirm('Are you sure you want to delete this role?')) {
        const result = await apiRequest(`/roles/${roleId}`, 'DELETE');
        if (result) {
            await loadRolesFromServer();
            renderRoles();
            updateDashboard();
            populateRoleDropdown();
            addActivity('Deleted Role', `Role ID: ${roleId}`);
        } else {
            alert('Failed to delete role. It might be assigned to users or there was a server error.');
        }
    }
}

// ==================== USER MANAGEMENT FUNCTIONS ====================

function renderUsers() {
    const tbody = document.getElementById('users-tbody');
    
    if (!tbody) {
        console.error('Users table body not found');
        return;
    }

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const role = roles.find(r => r.role_id === user.role_id);
        const roleName = role ? role.role_name : 'Unknown Role';
        
        return `
            <tr>
                <td>${user.id}</td>
                <td><strong>${user.username}</strong></td>
                <td>${roleName}</td>
                <td class="action-buttons">
                    <button class="action-btn delete needs-perm" data-permission="user_manage" onclick="deleteUser('${user.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

function showCreateUser() {
    document.getElementById('user-form').reset();
    populateRoleDropdown();
    openModal('userModal');
}

async function handleCreateUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;
    const roleId = document.getElementById('user-role').value;
    const fullName = document.getElementById('user-fullname')?.value || username;

    if (!username || !password || !roleId) {
        alert('Please fill all required fields');
        return;
    }

    const userData = {
        username: username,
        password: password,
        role_id: roleId,
        full_name: fullName
    };

    try {
        const result = await apiRequest('/users', 'POST', userData);
        
        if (result) {
            await loadUsersFromServer();
            await loadRolesFromServer();
            
            addActivity('Created User', username);
            showMessage('user-success', 'User created successfully!');
            e.target.reset();
            
            closeModal('userModal');
            
            renderUsers();
            renderRoles();
            populateRoleDropdown();
        } else {
            alert('Failed to create user. Username might already exist.');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Failed to create user: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        const result = await apiRequest(`/users/${userId}`, 'DELETE');
        if (result) {
            await loadUsersFromServer();
            await loadRolesFromServer();
            
            renderUsers();
            renderRoles();
            populateRoleDropdown();
            addActivity('Deleted User', `User ID: ${userId}`);
        } else {
            alert('Failed to delete user. Please try again.');
        }
    }
}

// ==================== ACTIVITY FUNCTIONS ====================

function addActivity(action, details) {
    const newActivity = {
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        user: currentUser ? currentUser.username : 'System',
        action: action,
        details: details,
        timestamp: Date.now()
    };
   
    activities.unshift(newActivity);
    if (activities.length > 20) {
        activities.pop();
    }
   
    renderActivities();
}

function renderActivities() {
    const tbody = document.getElementById('activities-tbody');
   
    if (activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No recent activities</td></tr>';
        return;
    }
   
    tbody.innerHTML = activities.slice(0, 10).map(activity => `
        <tr>
            <td>${activity.time}</td>
            <td>${activity.user}</td>
            <td>${activity.action}</td>
            <td>${activity.details}</td>
        </tr>
    `).join('');
}

// ==================== DASHBOARD FUNCTIONS ====================

async function updateDashboard() {
    await loadDashboardStats();
    renderActivities();
}

// ==================== MODAL FUNCTIONS ====================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    } else {
        console.warn(`Modal with id '${modalId}' not found`);
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}

function showMessage(elementId, message, type = 'success') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Message element not found:', elementId);
        return;
    }
    
    element.textContent = message;
    element.className = type + '-message show';
   
    setTimeout(() => {
        element.classList.remove('show');
    }, 3000);
}

// ==================== MUSIC MANAGEMENT FUNCTIONS ====================

function showUploadMusicModal() {
    console.log('Opening music upload modal');
    
    // Reset form
    const form = document.getElementById('music-upload-form');
    if (form) {
        form.reset();
    }
    
    // Hide file info
    const fileInfo = document.getElementById('selected-file-info');
    if (fileInfo) {
        fileInfo.style.display = 'none';
    }
    
    // Open modal
    openModal('musicUploadModal');
}
async function uploadMusicFile() {
    const name = document.getElementById('music-name').value;
    const fileInput = document.getElementById('music-file');

    if (!name || !name.trim()) {
        alert('Please enter a music name');
        return;
    }

    if (!fileInput.files.length) {
        alert('Please select a music file');
        return;
    }

    const file = fileInput.files[0];

    if (!file.type.startsWith('audio/')) {
        alert('Please select a valid audio file (MP3, WAV, etc.)');
        return;
    }

    const maxSize = 60 * 1024 * 1024; // 60 MB - matches server limit
    if (file.size > maxSize) {
        alert('File too large. Maximum size is 60MB.');
        return;
    }

    const uploadBtn = document.querySelector('#musicUploadModal button.btn-success');
    const originalText = uploadBtn ? uploadBtn.innerHTML : '';
    if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.innerHTML = 'Uploading...'; }

    try {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('music', file); // must match musicUpload.single('music') on server

        const response = await fetch(`${API_BASE_URL}/music`, {
            method: 'POST',
            body: formData
        });

        let result;
        try { result = await response.json(); } catch (_) { result = {}; }

        if (!response.ok) {
            throw new Error(result.message || result.error || ('Server error ' + response.status));
        }

        alert('Music uploaded successfully!');
        document.getElementById('music-name').value = '';
        fileInput.value = '';
        const fileInfo = document.getElementById('selected-file-info');
        if (fileInfo) fileInfo.style.display = 'none';
        closeModal('musicUploadModal');
        await loadMusicFiles();

    } catch (error) {
        console.error('Error uploading music:', error);
        alert('Failed to upload music: ' + error.message);
    } finally {
        if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.innerHTML = originalText; }
    }
}

async function loadMusicFiles() {
    const data = await apiRequest('/music');
    if (data) {
        musicFiles = data;
        renderMusicList();
    }
}

function renderMusicList() {
    const tbody = document.getElementById('music-tbody');
    
    if (musicFiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No music files found</td></tr>';
        return;
    }
    
    tbody.innerHTML = musicFiles.map(music => `
        <tr>
            <td><strong>${music.name}</strong></td>
            <td>${music.filename}</td>
            <td>${formatFileSize(music.file_size)}</td>
            <td>${new Date(music.upload_date).toLocaleDateString()}</td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="playMusic('/uploads/music/${music.filename}')">
                    <div class="icon icon-play"></div> Play
                </button>
                <button class="action-btn delete" onclick="deleteMusicFile(${music.id})">
                    <div class="icon icon-trash"></div> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function playMusic(fileUrl) {
    window.open(fileUrl, '_blank');
}

async function deleteMusicFile(musicId) {
    if (confirm('Are you sure you want to delete this music file?')) {
        const result = await apiRequest(`/music/${musicId}`, 'DELETE');
        if (result) {
            await loadMusicFiles();
        } else {
            alert('Failed to delete music file');
        }
    }
}

// ==================== VIDEO MANAGEMENT FUNCTIONS ====================

async function loadVideoFiles() {
    const data = await apiRequest('/videos');
    if (data) {
        videoFiles = data;
        renderVideoList();
        updateVideoStats();
        renderVideosGrid()
    }
}

function renderVideoList(filter = '') {
    const tbody = document.getElementById('videos-tbody');
    
    if (videoFiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No videos found</td></tr>';
        return;
    }
    
    const filteredVideos = videoFiles.filter(video =>
        video.title.toLowerCase().includes(filter.toLowerCase()) ||
        video.ot_name.toLowerCase().includes(filter.toLowerCase()) ||
        (video.procedure_type && video.procedure_type.toLowerCase().includes(filter.toLowerCase()))
    );
    
    if (filteredVideos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No matching videos found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredVideos.map(video => `
        <tr>
            <td><strong>${video.title}</strong></td>
            <td>${video.ot_name}</td>
            <td>${video.procedure_type || 'Not specified'}</td>
            <td>${video.duration || 'N/A'}</td>
            <td>${formatFileSize(video.file_size)}</td>
            <td>${new Date(video.upload_date).toLocaleDateString()}</td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="playVideo('/uploads/videos/${video.filename}')">
                    <div class="icon icon-play"></div> Play
                </button>
                <button class="action-btn download" onclick="downloadVideo(${video.id})">
                    <div class="icon icon-download"></div> Download
                </button>
                <button class="action-btn delete needs-perm" data-permission="video_manage" onclick="deleteVideoFile(${video.id})">
                    <div class="icon icon-trash"></div> Delete
                </button>
            </td>
        </tr>
    `).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

function updateVideoStats() {
    const totalVideos = videoFiles.length;
    const totalSize = videoFiles.reduce((sum, video) => sum + video.file_size, 0);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentVideos = videoFiles.filter(video => new Date(video.upload_date) > oneWeekAgo).length;
    
    document.getElementById('total-videos').textContent = totalVideos;
    document.getElementById('total-video-size').textContent = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    document.getElementById('recent-videos').textContent = recentVideos;
}

function showUploadVideoModal() {
    document.getElementById('video-upload-form').reset();
    document.getElementById('selected-video-info').style.display = 'none';
    
    const otSelect = document.getElementById('video-ot');
    otSelect.innerHTML = '<option value="">Select OT</option>';
    if (masterData.ot_name && masterData.ot_name.length > 0) {
        masterData.ot_name.forEach(ot => {
            otSelect.innerHTML += `<option value="${ot}">${ot}</option>`;
        });
    }
    
    openModal('videoUploadModal');
    
    document.getElementById('video-file').onchange = function(e) {
        if (this.files.length > 0) {
            handleVideoFileSelect(this.files);
        }
    };
}

function toggleVideoView(view) {
    currentVideoView = view;
    
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-view') === view) {
            btn.classList.add('active');
        }
    });
    
    document.getElementById('videos-grid-view').style.display = view === 'grid' ? 'block' : 'none';
    document.getElementById('videos-table-view').style.display = view === 'table' ? 'block' : 'none';
    
    if (view === 'grid') {
        renderVideosGrid();
    } else {
        renderVideosTable();
    }
}

function renderVideosGrid() {
    const videosGrid = document.getElementById('videos-grid');
    
    if (!videoFiles || videoFiles.length === 0) {
        videosGrid.innerHTML = `
            <div class="empty-state">
                <div class="icon icon-video" style="font-size: 48px; color: #bdc3c7;"></div>
                <h3>No Videos Found</h3>
                <p>Upload your first surgical video to get started</p>
                <button class="btn btn-primary" onclick="showUploadVideoModal()">
                    <div class="icon icon-upload"></div> Upload Video
                </button>
            </div>
        `;
        return;
    }
    
    videosGrid.innerHTML = videoFiles.map(video => `
        <div class="video-card">
            <div class="video-thumbnail">
                <div style="background: #3498db; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white;">
                    <div class="icon icon-video" style="font-size: 48px;"></div>
                </div>
               <div class="play-overlay">
    <div class="play-icon" onclick="playVideo('/uploads/videos/${video.filename}')">
        <div class="icon icon-play"></div>
    </div>
</div>
            </div>
            <div class="video-card-content">
                <h4 class="video-title" title="${video.title}">${video.title}</h4>
                <div class="video-meta">
                    <div class="video-meta-item">
                        <div class="icon icon-hospital-alt"></div>
                        <span>${video.ot_name}</span>
                    </div>
                    <div class="video-meta-item">
                        <div class="icon icon-user-md"></div>
                        <span>${video.surgeon || 'Not specified'}</span>
                    </div>
                    <div class="video-meta-item">
                        <div class="icon icon-calendar"></div>
                        <span>${new Date(video.procedure_date || video.upload_date).toLocaleDateString()}</span>
                    </div>
                    <div class="video-meta-item">
                        <div class="icon icon-database"></div>
                        <span>${formatFileSize(video.file_size)}</span>
                    </div>
                </div>
                <div class="video-actions">
                   <button class="action-btn view" onclick="playVideo('/uploads/videos/${video.filename}')">
    <div class="icon icon-play"></div> Play
</button>
                    <button class="btn btn-sm btn-secondary" onclick="downloadVideo(${video.id})">
                        <div class="icon icon-download"></div>
                    </button>
                    ${checkPermission('video_manage') ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteVideoFile(${video.id})">
                        <div class="icon icon-trash"></div>
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function renderVideosTable() {
    const tbody = document.getElementById('videos-tbody');
    
    if (!videoFiles || videoFiles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div style="color: #7f8c8d;">
                        <div class="icon icon-video" style="font-size: 36px; margin-bottom: 10px;"></div>
                        <p>No videos found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = videoFiles.map(video => `
        <tr>
            <td>
                <strong>${video.title}</strong>
                ${video.notes ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">${video.notes.substring(0, 50)}${video.notes.length > 50 ? '...' : ''}</div>` : ''}
            </td>
            <td>${video.ot_name}</td>
            <td>${video.procedure_type || 'Not specified'}</td>
            <td>${video.surgeon || 'N/A'}</td>
            <td>${new Date(video.procedure_date || video.upload_date).toLocaleDateString()}</td>
            <td>${formatFileSize(video.file_size)}</td>
            <td class="action-buttons" style="white-space: nowrap;">
                <button class="action-btn view" onclick="previewVideo(${video.id})">
                    <div class="icon icon-play"></div> Play
                </button>
                <button class="action-btn download" onclick="downloadVideo(${video.id})">
                    <div class="icon icon-download"></div>
                </button>
                ${checkPermission('video_manage') ? `
                <button class="action-btn delete" onclick="deleteVideoFile(${video.id})">
                    <div class="icon icon-trash"></div>
                </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function previewVideo(videoId) {
    const video = videoFiles.find(v => v.id === videoId);
    if (!video) return;
    
    document.getElementById('video-preview-title').textContent = video.title;
    document.getElementById('video-info-ot').textContent = video.ot_name;
    document.getElementById('video-info-surgeon').textContent = video.surgeon || 'Not specified';
    document.getElementById('video-info-date').textContent = new Date(video.procedure_date || video.upload_date).toLocaleDateString();
    document.getElementById('video-info-size').textContent = formatFileSize(video.file_size);
    document.getElementById('video-info-notes').textContent = video.notes || 'No notes provided';
    
    const videoPlayer = document.getElementById('video-player');
    videoPlayer.src = `/uploads/videos/${video.filename}`;
    videoPlayer.load();
    
    window.currentPreviewVideo = video;
    
    openModal('videoPreviewModal');
}

function downloadCurrentVideo() {
    if (window.currentPreviewVideo) {
        downloadVideo(window.currentPreviewVideo.id);
    }
}

function refreshVideos() {
    loadVideoFiles();
    showMessage('video-success', 'Videos refreshed successfully!');
}

function resetFilters() {
    document.getElementById('video-search').value = '';
    document.getElementById('filter-ot').value = '';
    document.getElementById('filter-surgeon').value = '';
    renderVideosGrid();
}

function handleVideoFileSelect(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    const fileInput = document.getElementById('video-file');
    
    console.log('File selected:', {
        name: file.name,
        type: file.type,
        size: file.size
    });
    
    const fileNameElement = document.getElementById('video-file-name');
    const fileSizeElement = document.getElementById('video-file-size');
    const fileInfoElement = document.getElementById('selected-video-info');
    
    if (fileNameElement && fileSizeElement && fileInfoElement) {
        fileNameElement.textContent = file.name;
        fileSizeElement.textContent = `Size: ${formatFileSize(file.size)} | Type: ${file.type || 'Unknown'}`;
        fileInfoElement.style.display = 'block';
    }
    
    const allowedTypes = [
        'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
        'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
        'video/avi', 'video/x-matroska'
    ];
    
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm', '.ogv', '.mpeg', '.mpg'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    const isValidType = allowedTypes.includes(file.type) || 
                        file.type.startsWith('video/') ||
                        allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
        alert(`Warning: "${file.name}" may not be a supported video file.\n\nPlease ensure it's one of: MP4, AVI, MOV, WMV, MKV, WebM, OGG, MPEG`);
        
        fileInput.value = '';
        if (fileInfoElement) {
            fileInfoElement.style.display = 'none';
        }
    }
}

async function uploadVideoFile(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    console.log('📹 Starting video upload...');
    
    const titleInput = document.getElementById('video-title');
    const otSelect = document.getElementById('video-ot');
    const procedureInput = document.getElementById('video-procedure');
    const surgeonInput = document.getElementById('video-surgeon');
    const dateInput = document.getElementById('video-date');
    const notesInput = document.getElementById('video-notes');
    const fileInput = document.getElementById('video-file');
    const submitBtn = document.querySelector('#video-upload-form button[type="submit"]');
    
    console.log('📋 Form elements:', {
        titleInput: !!titleInput,
        otSelect: !!otSelect,
        fileInput: !!fileInput,
        submitBtn: !!submitBtn
    });
    
    if (!titleInput || !otSelect || !fileInput || !submitBtn) {
        console.error('❌ Missing form elements');
        alert('Form elements not found. Please refresh the page.');
        return;
    }
    
    const title = titleInput.value.trim();
    const otName = otSelect.value;
    const procedureType = procedureInput ? procedureInput.value : '';
    const surgeon = surgeonInput ? surgeonInput.value : '';
    const procedureDate = dateInput ? dateInput.value : '';
    const notes = notesInput ? notesInput.value : '';
    
    console.log('📹 Video upload attempt:', {
        title, otName, procedureType, surgeon, procedureDate, notes,
        files: fileInput.files.length
    });
    
    if (!title) {
        alert('Please enter video title');
        titleInput.focus();
        return;
    }
    
    if (!otName) {
        alert('Please select OT');
        otSelect.focus();
        return;
    }
    
    if (!fileInput.files.length) {
        alert('Please select a video file');
        fileInput.focus();
        return;
    }
    
    const file = fileInput.files[0];
    console.log('📄 Selected file details:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: new Date(file.lastModified).toLocaleString()
    });
    
    const allowedTypes = [
        'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
        'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
        'video/avi', 'video/x-matroska',
        'video/3gpp', 'video/3gpp2'
    ];
    
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm', '.ogv', '.mpeg', '.mpg', '.3gp'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    const isValidType = allowedTypes.includes(file.type) || 
                        file.type.startsWith('video/') ||
                        allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
        const message = `Invalid file type: ${file.type || 'unknown'}\n\n` +
                       `File: ${file.name}\n` +
                       `Extension: ${fileExtension}\n\n` +
                       `Allowed video formats:\n` +
                       `• MP4 (.mp4) - Most compatible\n` +
                       `• AVI (.avi) - Standard format\n` +
                       `• MOV (.mov) - Apple QuickTime\n` +
                       `• WMV (.wmv) - Windows Media\n` +
                       `• MKV (.mkv) - High quality\n` +
                       `• WebM (.webm) - Web optimized\n` +
                       `• OGG (.ogv) - Open format\n` +
                       `• MPEG (.mpeg, .mpg) - Standard video`;
        alert(message);
        return;
    }
    
    const maxSize = 40960 * 1024 * 1024;
    
    if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        alert(`File too large: ${fileSizeMB}MB\nMaximum size is 500MB`);
        return;
    }
    
    try {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="icon icon-spinner"></div> Uploading...';
        submitBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('ot_name', otName);
        formData.append('procedure_type', procedureType);
        formData.append('surgeon', surgeon);
        formData.append('procedure_date', procedureDate);
        formData.append('notes', notes);
        formData.append('video_file', file);
        
        if (currentUser) {
            formData.append('currentUser', currentUser.username);
        } else {
            formData.append('currentUser', 'System');
        }
        
        console.log('📤 Sending FormData...');
        
        const response = await fetch(`${API_BASE_URL}/videos`, {
            method: 'POST',
            body: formData
        });
        
        console.log('📨 Response received:', response.status, response.statusText);
        
        let result;
        if (!response.ok) {
            let errorText;
            try {
                const errorData = await response.json();
                errorText = errorData.error || errorData.message || `Upload failed: ${response.status}`;
            } catch (e) {
                errorText = await response.text();
            }
            throw new Error(errorText || `Upload failed: ${response.status} ${response.statusText}`);
        } else {
            result = await response.json();
            console.log('✅ Video upload successful:', result);
        }
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        showMessage('video-success', `Video "${title}" uploaded successfully! (${result.file_size_formatted || formatFileSize(file.size)})`);
        
        const modal = document.getElementById('videoUploadModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        const form = document.getElementById('video-upload-form');
        if (form) {
            form.reset();
        }
        
        const selectedFileInfo = document.getElementById('selected-video-info');
        if (selectedFileInfo) {
            selectedFileInfo.style.display = 'none';
        }
        
        await loadVideoFiles();
        
    } catch (error) {
        console.error('❌ Error uploading video:', error);
        
        const submitBtn = document.querySelector('#video-upload-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<div class="icon icon-upload"></div> Upload Video';
            submitBtn.disabled = false;
        }
        
        let errorMessage = error.message;
        if (errorMessage.includes('Only video files are allowed')) {
            errorMessage = 'Please select a valid video file.\n\n' +
                          'Supported formats: MP4, AVI, MOV, WMV, MKV, WebM, OGG, MPEG\n' +
                          'Maximum size: 500MB';
        } else if (errorMessage.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server. Please check if server is running.';
        } else if (errorMessage.includes('timeout')) {
            errorMessage = 'Upload timeout. File might be too large or network is slow.';
        }
        
        showMessage('video-success', 'Failed to upload video: ' + errorMessage, 'error');
        
        if (errorMessage.includes('Cannot connect') || errorMessage.includes('timeout')) {
            alert('Upload Error: ' + errorMessage);
        }
    }
}

function testVideoUploadSetup() {
    console.group('🔍 Video Upload Setup Test');
    
    const elements = {
        'video-title': document.getElementById('video-title'),
        'video-ot': document.getElementById('video-ot'),
        'video-file': document.getElementById('video-file'),
        'video-upload-form': document.getElementById('video-upload-form'),
        'upload-button': document.querySelector('#video-upload-form button[type="submit"]'),
        'modal': document.getElementById('videoUploadModal')
    };
    
    let allFound = true;
    for (const [name, element] of Object.entries(elements)) {
        const found = !!element;
        console.log(`${found ? '✅' : '❌'} ${name}: ${found ? 'Found' : 'NOT FOUND'}`);
        if (!found) allFound = false;
    }
    
    console.log('🌐 API_BASE_URL:', API_BASE_URL);
    
    fetch(`${API_BASE_URL}/test`)
        .then(res => console.log('Server test:', res.ok ? '✅ Connected' : '❌ Failed'))
        .catch(err => console.log('❌ Server error:', err.message));
    
    console.groupEnd();
    
    if (!allFound) {
        alert('Some video upload elements are missing. Please check console for details.');
    }
    
    return allFound;
}

function initializeVideoPage() {
    console.log('🎬 Initializing video page...');
    testVideoUploadSetup();
    loadVideoFiles();
}

function playVideo(fileUrl) {
    window.open(fileUrl, '_blank');
}

async function downloadVideo(videoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/videos/${videoId}/download`);
        if (response.ok) {
            const blob = await response.blob();
            const video = videoFiles.find(v => v.id === videoId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = video.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Failed to download video');
        }
    } catch (error) {
        console.error('Error downloading video:', error);
        alert('Failed to download video');
    }
}

async function deleteVideoFile(videoId) {
    if (confirm('Are you sure you want to delete this video?')) {
        const result = await apiRequest(`/videos/${videoId}`, 'DELETE');
        if (result) {
            await loadVideoFiles();
            showMessage('video-success', 'Video deleted successfully!');
        } else {
            alert('Failed to delete video');
        }
    }
}

// ==================== CLEAN REPORT FUNCTIONS ====================

async function saveCleanReportPDF(reportId) {
    try {
        showMessage('clean-report-success', '🔄 Saving PDF to server...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/clean-reports/${reportId}/save-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('clean-report-success', '✅ PDF saved to server successfully!', 'success');
            
            setTimeout(() => {
                downloadPDFFromServer(result.filename, result.download_url);
            }, 1000);
            
            return result;
        } else {
            throw new Error(result.message || 'Failed to save PDF');
        }
        
    } catch (error) {
        console.error('Error saving PDF:', error);
        showMessage('clean-report-success', `❌ Failed to save PDF: ${error.message}`, 'error');
        
        setTimeout(() => {
            downloadCleanReport(reportId);
        }, 1500);
        
        return null;
    }
}

function downloadPDFFromServer(filename, downloadUrl) {
    try {
        const link = document.createElement('a');
        link.href = `${API_BASE_URL}${downloadUrl}`;
        link.download = filename;
        link.target = '_blank';
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            
            alert(`📄 PDF "${filename}" is downloading!\n\nTo save to a specific folder:\n1. Look for the download bar at bottom of browser\n2. Click the dropdown (▾) next to the file\n3. Select "Save As..."\n4. Choose your preferred folder`);
            
        }, 100);
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        
        window.open(`${API_BASE_URL}${downloadUrl}`, '_blank');
    }
}

async function saveAndDownloadCleanReportPDF(reportId) {
    if (!reportId) {
        alert('Please save the report first');
        return;
    }
    
    try {
        showMessage('clean-report-success', 'Saving PDF to server...', 'info');
        
        const saveResponse = await fetch(`${API_BASE_URL}/clean-reports/${reportId}/save-pdf`, {
            method: 'POST'
        });
        
        const saveResult = await saveResponse.json();
        
        if (saveResult.success) {
            showMessage('clean-report-success', `✅ PDF saved to server`, 'success');
            
            setTimeout(() => {
                const downloadLink = document.createElement('a');
                
                if (saveResult.direct_download) {
                    downloadLink.href = saveResult.direct_download;
                } else {
                    downloadLink.href = `${API_BASE_URL}/clean-reports/${reportId}/pdf?download=true`;
                }
                
                downloadLink.download = `clean-report-${reportId}.pdf`;
                downloadLink.target = '_blank';
                
                document.body.appendChild(downloadLink);
                downloadLink.click();
                
                setTimeout(() => {
                    document.body.removeChild(downloadLink);
                    
                    alert(`📄 PDF saved and downloaded!\n\nFile: clean-report-${reportId}.pdf\n\nIt will be saved to your default Downloads folder.\n\nTo save to a specific folder:\n1. Look for download bar at bottom of browser\n2. Click the dropdown (▾) next to the file\n3. Choose "Save As..."\n4. Select your desired folder`);
                    
                }, 1000);
                
            }, 1000);
            
        } else {
            throw new Error(saveResult.error || 'Failed to save PDF');
        }
        
    } catch (error) {
        console.error('Error saving PDF:', error);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = `${API_BASE_URL}/clean-reports/${reportId}/pdf?download=true`;
        downloadLink.download = `clean-report-${reportId}.pdf`;
        downloadLink.target = '_blank';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        showMessage('clean-report-success', 'PDF downloaded directly (not saved to server)', 'warning');
    }
}

async function saveCleanReportAndDownload() {
    await saveCleanReport();
    
    if (currentSavedReportId) {
        setTimeout(() => {
            generateAndDownloadPDF(currentSavedReportId);
        }, 1500);
    }
}

async function loadCleanReports() {
    const data = await apiRequest('/clean-reports');
    if (data) {
        cleanReports = data;
        renderCleanReports();
    }
}

function renderCleanReports(filter = '') {
    const tbody = document.getElementById('clean-reports-tbody');
    
    if (cleanReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No clean reports found</td></tr>';
        return;
    }
    
    const filteredReports = cleanReports.filter(report =>
        report.ot_name.toLowerCase().includes(filter.toLowerCase()) ||
        report.verified_by.toLowerCase().includes(filter.toLowerCase()) ||
        report.report_id.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No matching reports found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredReports.map(report => `
        <tr>
            <td>${report.report_id}</td>
            <td>${report.ot_name}</td>
            <td>${new Date(report.report_date).toLocaleDateString()}</td>
            <td>${report.report_time}</td>
            <td>${report.verified_by}</td>
            <td><span class="status-badge ${getStatusClass(report.status)}">${report.status.replace('_', ' ').toUpperCase()}</span></td>
            <td>${report.photo_count || 0}</td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="viewCleanReport('${report.report_id}')">View</button>
                <button class="action-btn download" onclick="downloadCleanReport('${report.report_id}')">PDF</button>
                <button class="action-btn delete needs-perm" data-permission="report_manage" onclick="deleteCleanReport('${report.report_id}')">Delete</button>
            </td>
        </tr>
    `).join('');
    
    if (currentUser) {
        applyPermissions();
    }
}

function getStatusClass(status) {
    const classes = {
        'excellent': 'in-stock',
        'good': 'in-stock',
        'satisfactory': 'low-stock',
        'needs_improvement': 'out-of-stock'
    };
    return classes[status] || '';
}

function populateCleanReportDropdowns() {
    const otSelect = document.getElementById('report-ot');
    if (otSelect && masterData.ot_name) {
        otSelect.innerHTML = '<option value="">Select OT</option>';
        masterData.ot_name.forEach(ot => {
            otSelect.innerHTML += `<option value="${ot}">${ot}</option>`;
        });
    }
    
    document.getElementById('report-date').valueAsDate = new Date();
    document.getElementById('report-time').value = new Date().toTimeString().substring(0, 5);
}

function handleCleanPhotoSelect(event) {
    const files = event.target.files;
    handleCleanPhotos(files);
}

function handleCleanPhotos(files) {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
   
    for (let file of files) {
        if (file.size > maxSize) {
            alert(`Photo "${file.name}" is too large. Maximum size is 10MB.`);
            continue;
        }
       
        if (!allowedTypes.includes(file.type)) {
            alert(`File "${file.name}" is not a supported image format. Please upload PNG, JPG, or JPEG files.`);
            continue;
        }
       
        const photo = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            file: file,
            url: URL.createObjectURL(file)
        };
       
        currentCleanPhotos.push(photo);
    }
   
    renderCleanPhotosPreview();
}

function renderCleanPhotosPreview() {
    const container = document.getElementById('clean-photos-preview');
   
    if (currentCleanPhotos.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No photos uploaded yet</p>';
        return;
    }
   
    container.innerHTML = currentCleanPhotos.map(photo => `
        <div class="uploaded-file">
            <div class="file-info">
                <div class="file-icon">
                    <img src="${photo.url}" alt="${photo.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
                </div>
                <div>
                    <div class="file-name">${photo.name}</div>
                    <div class="file-size">${photo.size}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action-btn view" onclick="previewCleanPhoto('${photo.id}')" title="Preview">
                    <div class="icon icon-eye"></div>
                </button>
                <button class="file-action-btn delete" onclick="removeCleanPhoto('${photo.id}')" title="Remove">
                    <div class="icon icon-trash"></div>
                </button>
            </div>
        </div>
    `).join('');
}

function removeCleanPhoto(photoId) {
    currentCleanPhotos = currentCleanPhotos.filter(photo => photo.id != photoId);
    renderCleanPhotosPreview();
}

function previewCleanPhoto(photoId) {
    const photo = currentCleanPhotos.find(p => p.id == photoId);
    if (!photo) return;
   
    const previewContent = document.getElementById('file-preview-content');
    previewContent.innerHTML = '';
   
    const img = document.createElement('img');
    img.src = photo.url;
    img.className = 'file-preview';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    previewContent.appendChild(img);
   
    openModal('filePreviewModal');
}

function previewCleanReport() {
    const ot = document.getElementById('report-ot').value;
    const date = document.getElementById('report-date').value;
    const time = document.getElementById('report-time').value;
    const verifiedBy = document.getElementById('report-verified-by').value;
    const notes = document.getElementById('report-notes').value;
    const status = document.getElementById('report-status').value;
    const nextCheck = document.getElementById('report-next-check').value;
    
    if (!ot || !date || !time || !verifiedBy || !status) {
        alert('Please fill all required fields (OT, Date, Time, Verified By, Status)');
        return;
    }
    
    const previewContent = document.getElementById('clean-report-preview-content');
    
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const statusDisplay = {
        'excellent': 'EXCELLENT',
        'good': 'GOOD',
        'satisfactory': 'SATISFACTORY',
        'needs_improvement': 'NEEDS IMPROVEMENT'
    }[status] || status.toUpperCase();
    
    const statusClass = {
        'excellent': 'status-excellent',
        'good': 'status-good',
        'satisfactory': 'status-satisfactory',
        'needs_improvement': 'status-needs-improvement'
    }[status] || '';
    
    let photosHtml = '';
    if (currentCleanPhotos.length > 0) {
        photosHtml = `
            <div class="preview-section">
                <h3><div class="icon icon-camera"></div> Photos (${currentCleanPhotos.length})</h3>
                <div class="preview-photos">
                    ${currentCleanPhotos.map((photo, index) => `
                        <div class="preview-photo-item">
                            <img src="${photo.url}" alt="Photo ${index + 1}" onclick="previewCleanPhoto('${photo.id}')">
                            <div class="photo-info">Photo ${index + 1}: ${photo.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    previewContent.innerHTML = `
        <div class="preview-header">
            <h2>CLEAN REPORT PREVIEW</h2>
            <div class="preview-id">Report ID: CLEAN-${Date.now()}</div>
        </div>
        
        <div class="preview-section">
            <h3><div class="icon icon-info-circle"></div> Basic Information</h3>
            <div class="preview-grid">
                <div class="preview-item">
                    <label>OT Name:</label>
                    <span>${ot}</span>
                </div>
                <div class="preview-item">
                    <label>Report Date:</label>
                    <span>${formattedDate}</span>
                </div>
                <div class="preview-item">
                    <label>Report Time:</label>
                    <span>${time}</span>
                </div>
                <div class="preview-item">
                    <label>Verified By:</label>
                    <span>${verifiedBy}</span>
                </div>
            </div>
        </div>
        
        <div class="preview-section">
            <h3><div class="icon icon-check-circle"></div> Clean Status</h3>
            <div class="status-display ${statusClass}">
                ${statusDisplay}
            </div>
            ${nextCheck ? `
                <div class="preview-item">
                    <label>Next Check Date:</label>
                    <span>${new Date(nextCheck).toLocaleDateString()}</span>
                </div>
            ` : ''}
        </div>
        
        ${notes ? `
            <div class="preview-section">
                <h3><div class="icon icon-file-alt"></div> Notes & Observations</h3>
                <div class="preview-notes">${notes}</div>
            </div>
        ` : ''}
        
        ${photosHtml}
        
        <div class="preview-footer">
            <p><strong>Note:</strong> This is a preview. Click "Save Report" to save permanently.</p>
        </div>
    `;
    
    if (!document.querySelector('#clean-report-preview-styles')) {
        const style = document.createElement('style');
        style.id = 'clean-report-preview-styles';
        style.textContent = `
            .preview-header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #eee;
            }
            .preview-header h2 {
                color: #2c3e50;
                margin-bottom: 5px;
            }
            .preview-id {
                color: #7f8c8d;
                font-size: 0.9em;
            }
            .preview-section {
                margin-bottom: 25px;
                padding: 15px;
                background: #f9f9f9;
                border-radius: 8px;
                border-left: 4px solid #3498db;
            }
            .preview-section h3 {
                margin-top: 0;
                margin-bottom: 15px;
                color: #2c3e50;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .preview-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
            }
            .preview-item {
                margin-bottom: 10px;
            }
            .preview-item label {
                display: block;
                font-weight: bold;
                color: #555;
                margin-bottom: 5px;
                font-size: 0.9em;
            }
            .preview-item span {
                display: block;
                padding: 8px 12px;
                background: white;
                border-radius: 4px;
                border: 1px solid #ddd;
            }
            .status-display {
                display: inline-block;
                padding: 10px 20px;
                border-radius: 5px;
                font-weight: bold;
                font-size: 1.2em;
                margin: 10px 0;
            }
            .status-excellent {
                background: #d4edda;
                color: #155724;
                border: 2px solid #c3e6cb;
            }
            .status-good {
                background: #d1ecf1;
                color: #0c5460;
                border: 2px solid #bee5eb;
            }
            .status-satisfactory {
                background: #fff3cd;
                color: #856404;
                border: 2px solid #ffeaa7;
            }
            .status-needs-improvement {
                background: #f8d7da;
                color: #721c24;
                border: 2px solid #f5c6cb;
            }
            .preview-notes {
                padding: 15px;
                background: white;
                border-radius: 5px;
                border: 1px solid #ddd;
                white-space: pre-wrap;
                line-height: 1.5;
            }
            .preview-photos {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                margin-top: 15px;
            }
            .preview-photo-item {
                text-align: center;
            }
            .preview-photo-item img {
                width: 100%;
                height: 120px;
                object-fit: cover;
                border-radius: 5px;
                border: 2px solid #ddd;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .preview-photo-item img:hover {
                transform: scale(1.05);
                border-color: #3498db;
            }
            .photo-info {
                margin-top: 5px;
                font-size: 0.8em;
                color: #666;
            }
            .preview-footer {
                margin-top: 30px;
                padding: 15px;
                background: #e8f4fd;
                border-radius: 5px;
                text-align: center;
                color: #2c3e50;
            }
        `;
        document.head.appendChild(style);
    }
    
    openModal('cleanReportPreviewModal');
}

function printCleanReport() {
    const printContent = document.getElementById('clean-report-preview-content').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Clean Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                @media print {
                    @page { margin: 0.5in; }
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <div style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer;">
                    Print Report
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; cursor: pointer;">
                    Close
                </button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function downloadCleanReport(reportId) {
    try {
        showMessage('clean-report-success', 'Generating PDF...', 'info');
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${API_BASE_URL}/clean-reports/${reportId}/pdf`;
        document.body.appendChild(iframe);
        
        setTimeout(() => {
            const downloadLink = document.createElement('a');
            downloadLink.href = `${API_BASE_URL}/clean-reports/${reportId}/pdf`;
            downloadLink.download = `clean-report-${reportId}.pdf`;
            downloadLink.target = '_blank';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            document.body.removeChild(iframe);
            
            showMessage('clean-report-success', 'PDF download started. Check your downloads folder.', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Error downloading report:', error);
        showMessage('clean-report-success', 'Failed to download PDF. ' + error.message, 'error');
    }
}

async function viewCleanReport(reportId) {
    try {
        const response = await fetch(`${API_BASE_URL}/clean-reports/${reportId}`);
        
        if (response.ok) {
            const report = await response.json();
            
            let photosHtml = '';
            if (report.photos && report.photos.length > 0) {
                photosHtml = `
                    <div class="preview-section">
                        <h3><div class="icon icon-camera"></div> Photos (${report.photos.length})</h3>
                        <div class="preview-photos">
                            ${report.photos.map((photo, index) => `
                                <div class="preview-photo-item">
                                    <a href="${photo.photo_url}" target="_blank">
                                        <img src="${photo.photo_url}" alt="Photo ${index + 1}" style="width: 100px; height: 100px; object-fit: cover;">
                                    </a>
                                    <div class="photo-info">Photo ${index + 1}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            const statusClass = {
                'excellent': 'status-excellent',
                'good': 'status-good',
                'satisfactory': 'status-satisfactory',
                'needs_improvement': 'status-needs-improvement'
            }[report.status] || '';
            
            const previewContent = document.getElementById('clean-report-preview-content');
            previewContent.innerHTML = `
                <div class="preview-header">
                    <h2>CLEAN REPORT</h2>
                    <div class="preview-id">Report ID: ${report.report_id}</div>
                </div>
                
                <div class="preview-section">
                    <h3><div class="icon icon-info-circle"></div> Report Details</h3>
                    <div class="preview-grid">
                        <div class="preview-item">
                            <label>OT Name:</label>
                            <span>${report.ot_name}</span>
                        </div>
                        <div class="preview-item">
                            <label>Report Date:</label>
                            <span>${new Date(report.report_date).toLocaleDateString()}</span>
                        </div>
                        <div class="preview-item">
                            <label>Report Time:</label>
                            <span>${report.report_time}</span>
                        </div>
                        <div class="preview-item">
                            <label>Verified By:</label>
                            <span>${report.verified_by}</span>
                        </div>
                        <div class="preview-item">
                            <label>Status:</label>
                            <span class="status-display ${statusClass}">${report.status.toUpperCase()}</span>
                        </div>
                        ${report.next_check_date ? `
                            <div class="preview-item">
                                <label>Next Check Date:</label>
                                <span>${new Date(report.next_check_date).toLocaleDateString()}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${report.notes ? `
                    <div class="preview-section">
                        <h3><div class="icon icon-file-alt"></div> Notes & Observations</h3>
                        <div class="preview-notes">${report.notes}</div>
                    </div>
                ` : ''}
                
                ${photosHtml}
                
                <div class="preview-footer">
                    <p>Report created on: ${new Date(report.created_at).toLocaleString()}</p>
                </div>
            `;
            
            openModal('cleanReportPreviewModal');
        } else {
            const error = await response.text();
            alert('Failed to load report: ' + error);
        }
    } catch (error) {
        console.error('Error viewing report:', error);
        alert('Failed to load report: ' + error.message);
    }
}

async function saveCleanReport() {
    const ot = document.getElementById('report-ot').value;
    const date = document.getElementById('report-date').value;
    const time = document.getElementById('report-time').value;
    const verifiedBy = document.getElementById('report-verified-by').value;
    const notes = document.getElementById('report-notes').value;
    const status = document.getElementById('report-status').value;
    const nextCheck = document.getElementById('report-next-check').value;
    
    if (!ot || !date || !time || !verifiedBy || !status) {
        alert('Please fill all required fields (OT, Date, Time, Verified By, Status)');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('ot_name', ot);
        formData.append('report_date', date);
        formData.append('report_time', time);
        formData.append('verified_by', verifiedBy);
        formData.append('notes', notes);
        formData.append('status', status);
        formData.append('next_check_date', nextCheck);
        
        if (currentUser) {
            formData.append('currentUser', currentUser.username);
        } else {
            formData.append('currentUser', 'System');
        }
        
        currentCleanPhotos.forEach((photo, index) => {
            formData.append('photos', photo.file);
        });
        
        const response = await fetch(`${API_BASE_URL}/clean-reports`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        currentSavedReportId = result.report_id;
        
        document.getElementById('generate-pdf-btn').style.display = 'inline-block';
        
        showMessage('clean-report-success', `Clean report saved successfully! Report ID: ${result.report_id}`);
        
        setTimeout(async () => {
            await saveCleanReportPDF(result.report_id);
        }, 1000);
        
        document.getElementById('clean-report-form').reset();
        currentCleanPhotos = [];
        renderCleanPhotosPreview();
        
        await loadCleanReports();
        
        closeModal('cleanReportPreviewModal');
        
    } catch (error) {
        console.error('Error saving clean report:', error);
        showMessage('clean-report-success', `Failed to save clean report: ${error.message}`, 'error');
    }
}

async function generateCleanReportPDF() {
    if (!currentSavedReportId) {
        alert('Please save the report first before generating PDF');
        return;
    }
    
    try {
        showMessage('clean-report-success', 'Generating PDF...', 'info');
        
        window.open(`${API_BASE_URL}/clean-reports/${currentSavedReportId}/pdf`, '_blank');
        
        setTimeout(() => {
            const downloadLink = document.createElement('a');
            downloadLink.href = `${API_BASE_URL}/clean-reports/${currentSavedReportId}/pdf`;
            downloadLink.download = `clean-report-${currentSavedReportId}.pdf`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            showMessage('clean-report-success', 'PDF generated successfully!', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showMessage('clean-report-success', `Failed to generate PDF: ${error.message}`, 'error');
    }
}

async function previewCleanReport(reportId = null) {
    let reportData = null;
    
    if (reportId) {
        try {
            const response = await fetch(`${API_BASE_URL}/clean-reports/${reportId}`);
            if (response.ok) {
                reportData = await response.json();
            }
        } catch (error) {
            console.error('Error fetching report:', error);
        }
    } else {
        const ot = document.getElementById('report-ot').value;
        const date = document.getElementById('report-date').value;
        const time = document.getElementById('report-time').value;
        const verifiedBy = document.getElementById('report-verified-by').value;
        const notes = document.getElementById('report-notes').value;
        const status = document.getElementById('report-status').value;
        const nextCheck = document.getElementById('report-next-check').value;
        
        if (!ot || !date || !time || !verifiedBy || !status) {
            alert('Please fill all required fields (OT, Date, Time, Verified By, Status)');
            return;
        }
        
        reportData = {
            report_id: 'PREVIEW-' + Date.now(),
            ot_name: ot,
            report_date: date,
            report_time: time,
            verified_by: verifiedBy,
            notes: notes,
            status: status,
            next_check_date: nextCheck,
            photos: currentCleanPhotos.map(photo => ({
                photo_url: photo.url,
                original_name: photo.name
            }))
        };
    }
    
    if (!reportData) {
        alert('Unable to load report data');
        return;
    }
    
    const formattedDate = new Date(reportData.report_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const statusDisplay = {
        'excellent': 'EXCELLENT',
        'good': 'GOOD',
        'satisfactory': 'SATISFACTORY',
        'needs_improvement': 'NEEDS IMPROVEMENT'
    }[reportData.status] || reportData.status.toUpperCase();
    
    const statusClass = {
        'excellent': 'status-excellent',
        'good': 'status-good',
        'satisfactory': 'status-satisfactory',
        'needs_improvement': 'status-needs-improvement'
    }[reportData.status] || '';
    
    let photosHtml = '';
    if (reportData.photos && reportData.photos.length > 0) {
        photosHtml = `
            <div class="preview-section">
                <h3><div class="icon icon-camera"></div> Photos (${reportData.photos.length})</h3>
                <div class="preview-photos">
                    ${reportData.photos.map((photo, index) => `
                        <div class="preview-photo-item">
                            <img src="${photo.photo_url || photo.url}" alt="Photo ${index + 1}" 
                                 style="max-width: 150px; max-height: 150px; object-fit: cover;">
                            <div class="photo-info">Photo ${index + 1}: ${photo.original_name || photo.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const previewContent = document.getElementById('clean-report-preview-content');
    previewContent.innerHTML = `
        <div class="preview-header">
            <h2>CLEAN REPORT ${reportData.report_id.includes('PREVIEW') ? 'PREVIEW' : ''}</h2>
            <div class="preview-id">Report ID: ${reportData.report_id}</div>
        </div>
        
        <div class="preview-section">
            <h3><div class="icon icon-info-circle"></div> Report Details</h3>
            <div class="preview-grid">
                <div class="preview-item">
                    <label>OT Name:</label>
                    <span>${reportData.ot_name}</span>
                </div>
                <div class="preview-item">
                    <label>Report Date:</label>
                    <span>${formattedDate}</span>
                </div>
                <div class="preview-item">
                    <label>Report Time:</label>
                    <span>${reportData.report_time}</span>
                </div>
                <div class="preview-item">
                    <label>Verified By:</label>
                    <span>${reportData.verified_by}</span>
                </div>
                <div class="preview-item">
                    <label>Status:</label>
                    <span class="status-display ${statusClass}">${statusDisplay}</span>
                </div>
                ${reportData.next_check_date ? `
                    <div class="preview-item">
                        <label>Next Check Date:</label>
                        <span>${new Date(reportData.next_check_date).toLocaleDateString()}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        ${reportData.notes ? `
            <div class="preview-section">
                <h3><div class="icon icon-file-alt"></div> Notes & Observations</h3>
                <div class="preview-notes">${reportData.notes}</div>
            </div>
        ` : ''}
        
        ${photosHtml}
        
        <div class="preview-footer">
            <p>${reportData.report_id.includes('PREVIEW') ? 
                '<strong>Note:</strong> This is a preview. Click "Save Report" to save permanently.' : 
                'Click "PDF" button to download this report as PDF.'}</p>
        </div>
    `;
    
    openModal('cleanReportPreviewModal');
}

async function deleteCleanReport(reportId) {
    if (confirm('Are you sure you want to delete this clean report?')) {
        const result = await apiRequest(`/clean-reports/${reportId}`, 'DELETE');
        if (result) {
            await loadCleanReports();
            showMessage('clean-report-success', 'Clean report deleted successfully!');
        } else {
            alert('Failed to delete clean report');
        }
    }
}

// ==================== OT SCHEDULING FUNCTIONS ====================

async function loadOTSchedules() {
    const dateFilter = document.getElementById('ot-date-filter')?.value;
    const otFilter = document.getElementById('ot-filter')?.value;
    
    try {
        let endpoint = 'ot-schedules'; 
        const params = new URLSearchParams();
        
        if (dateFilter) params.append('date', dateFilter);
        if (otFilter) params.append('ot', otFilter);
        
        if (params.toString()) {
            endpoint += '?' + params.toString();
        }
        
        const data = await apiRequest(endpoint);
        if (data) {
            otSchedules = data;
            renderOTSchedule();
            renderUnscheduledPatients();
            
            // Refresh patient list to show updated OT info
            if (document.getElementById('patient-list').classList.contains('active')) {
                renderPatientList();
            }
        }
    } catch (error) {
        console.error('Error loading OT schedules:', error);
        showMessage('ot-error', 'Failed to load OT schedules: ' + error.message, 'error');
    }
}

async function saveOTSchedule() {
    const patientName = document.getElementById('ot-patient-name').value;
    const mrdNumber = document.getElementById('ot-mrd').value;
    
    if (!patientName || !mrdNumber) {
        alert('Please select a patient first');
        return;
    }
    
    const scheduleData = {
        patient_name: patientName,
        mrd_number: mrdNumber,
        procedure_type: document.getElementById('ot-procedure').value,
        surgeon: document.getElementById('ot-surgeon').value,
        ot_name: document.getElementById('ot-room').value,
        schedule_date: document.getElementById('ot-date').value,
        start_time: document.getElementById('ot-start-time').value,
        end_time: '',
        status: 'Scheduled',
        notes: document.getElementById('ot-notes').value,
        created_by: currentUser ? currentUser.username : 'System'
    };
    
    if (!scheduleData.procedure_type || !scheduleData.surgeon || 
        !scheduleData.ot_name || !scheduleData.schedule_date ||
        !scheduleData.start_time) {
        alert('Please fill all required surgery details');
        return;
    }
    
    try {
        const result = await apiRequest('ot-schedules', 'POST', scheduleData);
        
        if (result) {
            showMessage('ot-success', 'OT scheduled successfully!', 'success');
            closeModal('otScheduleModal');
            document.getElementById('ot-schedule-form').reset();
            await loadOTSchedules();
        }
    } catch (error) {
        console.error('Error saving OT schedule:', error);
        if (error.message.includes('409')) {
            alert('This OT is already scheduled at that time. Please choose a different time.');
        } else {
            alert('Failed to schedule OT: ' + error.message);
        }
    }
}

function renderOTSchedule() {
    const tbody = document.getElementById('ot-schedule-tbody');
    
    if (!otSchedules || otSchedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No surgeries scheduled</td></tr>';
        return;
    }
    
    tbody.innerHTML = otSchedules.map(schedule => `
        <tr>
            <td>${schedule.start_time}</td>
            <td><strong>${schedule.patient_name}</strong></td>
            <td>${schedule.mrd_number}</td>
            <td>${schedule.procedure_type}</td>
            <td>${schedule.surgeon}</td>
            <td>${schedule.ot_name}</td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="viewOTSchedule(${schedule.id})">View</button>
                <button class="action-btn edit" onclick="editOTSchedule(${schedule.id})">Edit</button>
                <button class="action-btn delete" onclick="deleteOTSchedule(${schedule.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function getOTStatusClass(status) {
    const classes = {
        'Scheduled': '',
        'In Progress': 'in-stock',
        'Completed': 'in-stock',
        'Cancelled': 'out-of-stock',
        'Delayed': 'low-stock'
    };
    return classes[status] || '';
}

function showOTScheduleModal() {
    document.getElementById('ot-schedule-form').reset();
    
    document.getElementById('ot-patient-name').value = '';
    document.getElementById('ot-mrd').value = '';
    document.getElementById('ot-patient-age').value = '';
    document.getElementById('ot-patient-gender').value = '';
    document.getElementById('ot-patient-phone').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ot-date').value = today;
    
    const otSelect = document.getElementById('ot-room');
    otSelect.innerHTML = '<option value="">Select OT</option>';
    if (masterData.ot_name && masterData.ot_name.length > 0) {
        masterData.ot_name.forEach(ot => {
            otSelect.innerHTML += `<option value="${ot}">${ot}</option>`;
        });
    }
    
    const surgeonSelect = document.getElementById('ot-surgeon');
    surgeonSelect.innerHTML = '<option value="">Select Surgeon</option>';
    if (masterData.doctor && masterData.doctor.length > 0) {
        masterData.doctor.forEach(doc => {
            surgeonSelect.innerHTML += `<option value="${doc}">${doc}</option>`;
        });
    }
    
    openModal('otScheduleModal');
    
    setTimeout(() => {
        initPatientSearch();
    }, 100);
}

function initPatientSearch() {
    const searchInput = document.getElementById('ot-patient-search');
    const resultsContainer = document.getElementById('patient-search-results');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(patientSearchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            resultsContainer.classList.remove('show');
            return;
        }
        
        patientSearchTimeout = setTimeout(() => {
            searchPatients(query);
        }, 300);
    });
    
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('show');
        }
    });
}

async function searchPatients(query) {
    try {
        const results = await apiRequest(`patients/search?query=${encodeURIComponent(query)}`);
        
        const resultsContainer = document.getElementById('patient-search-results');
        
        if (results && results.length > 0) {
            resultsContainer.innerHTML = results.map(patient => `
                <div class="search-result-item" onclick="selectPatient('${patient.patient_id}')">
                    <div>
                        <span class="search-result-name">${patient.name}</span>
                        <span class="search-result-mrd">MRD: ${patient.mrd_number}</span>
                    </div>
                    <div class="search-result-details">
                        Age: ${patient.age} | Gender: ${patient.gender} | Phone: ${patient.phone}
                    </div>
                </div>
            `).join('');
            resultsContainer.classList.add('show');
        } else {
            resultsContainer.innerHTML = '<div class="search-result-item" style="color: #999;">No patients found</div>';
            resultsContainer.classList.add('show');
        }
    } catch (error) {
        console.error('Error searching patients:', error);
        
        try {
            console.log('Trying fallback: fetching all patients');
            const allPatients = await apiRequest('patients');
            const filtered = allPatients.filter(p => 
                p.name.toLowerCase().includes(query.toLowerCase()) || 
                (p.mrd_number && p.mrd_number.toLowerCase().includes(query.toLowerCase()))
            );
            
            const resultsContainer = document.getElementById('patient-search-results');
            
            if (filtered.length > 0) {
                resultsContainer.innerHTML = filtered.map(patient => `
                    <div class="search-result-item" onclick="selectPatient('${patient.patient_id}')">
                        <div>
                            <span class="search-result-name">${patient.name}</span>
                            <span class="search-result-mrd">MRD: ${patient.mrd_number}</span>
                        </div>
                        <div class="search-result-details">
                            Age: ${patient.age} | Gender: ${patient.gender} | Phone: ${patient.phone}
                        </div>
                    </div>
                `).join('');
                resultsContainer.classList.add('show');
            } else {
                resultsContainer.innerHTML = '<div class="search-result-item" style="color: #999;">No patients found</div>';
                resultsContainer.classList.add('show');
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    }
}

function selectPatient(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    document.getElementById('ot-patient-name').value = patient.name;
    document.getElementById('ot-mrd').value = patient.mrd_number;
    document.getElementById('ot-patient-age').value = patient.age || '';
    document.getElementById('ot-patient-gender').value = patient.gender || '';
    document.getElementById('ot-patient-phone').value = patient.phone || '';
    
    document.getElementById('patient-search-results').classList.remove('show');
    document.getElementById('ot-patient-search').value = '';
}

async function deleteOTSchedule(id) {
    if (confirm('Are you sure you want to delete this OT schedule?')) {
        try {
            const result = await apiRequest(`ot-schedules/${id}`, 'DELETE');
            if (result) {
                await loadOTSchedules();
                showMessage('ot-success', 'OT schedule deleted successfully!', 'success');
            }
        } catch (error) {
            alert('Failed to delete OT schedule: ' + error.message);
        }
    }
}

function viewOTSchedule(id) {
    const schedule = otSchedules.find(s => s.id === id);
    if (!schedule) return;

    // Find linked patient for full details
    const patient = patients.find(p => p.mrd_number === schedule.mrd_number);

    let patientSection = '';
    if (patient) {
        patientSection = `
            <div style="margin-top:16px;padding:12px;background:#f0f4ff;border-radius:6px;">
                <strong style="color:#1a56db;">Patient Details</strong>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:0.92em;">
                    <div><b>Age:</b> ${patient.age || '—'}</div>
                    <div><b>Gender:</b> ${patient.gender || '—'}</div>
                    <div><b>Phone:</b> ${patient.phone || '—'}</div>
                    <div><b>Eye for Op.:</b> ${patient.eye || '—'}</div>
                    <div><b>Eye Condition:</b> ${patient.eye_condition || '—'}</div>
                    <div><b>Category:</b> ${patient.patientCategory || '—'}</div>
                    <div><b>Allergies:</b> ${(patient.allergies||[]).join(', ') || '—'}</div>
                    <div><b>Insurance:</b> ${patient.insurance || '—'}</div>
                </div>
            </div>`;
    }

    const body = document.getElementById('patientModalBody');
    body.innerHTML = `
        <div style="font-size:0.95em;">
            <h3 style="margin:0 0 12px;color:#1e3a5f;">${schedule.patient_name}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div><b>MRD:</b> ${schedule.mrd_number}</div>
                <div><b>Procedure:</b> ${schedule.procedure_type}</div>
                <div><b>Surgeon:</b> ${schedule.surgeon}</div>
                <div><b>OT:</b> ${schedule.ot_name}</div>
                <div><b>Date:</b> ${schedule.schedule_date}</div>
                <div><b>Start Time:</b> ${schedule.start_time}</div>
                <div><b>Status:</b> <span class="status-badge ${getOTStatusClass(schedule.status)}">${schedule.status}</span></div>
                <div><b>Created By:</b> ${schedule.created_by || '—'}</div>
            </div>
            ${schedule.notes ? `<div style="margin-top:12px;"><b>Notes:</b><br><div style="padding:8px;background:#f8f9fa;border-radius:4px;margin-top:4px;">${schedule.notes}</div></div>` : ''}
            ${patientSection}
        </div>`;

    openModal('patientModal');
    const printBtn = document.getElementById('patientModalPrintBtn');
    if (printBtn) printBtn.style.display = 'none';
}

function editOTSchedule(id) {
    const schedule = otSchedules.find(s => s.id === id);
    if (!schedule) return;
    
    document.getElementById('ot-patient-name').value = schedule.patient_name;
    document.getElementById('ot-mrd').value = schedule.mrd_number;
    document.getElementById('ot-procedure').value = schedule.procedure_type;
    document.getElementById('ot-surgeon').value = schedule.surgeon;
    document.getElementById('ot-room').value = schedule.ot_name;
    document.getElementById('ot-date').value = schedule.schedule_date;
    document.getElementById('ot-start-time').value = schedule.start_time;
    document.getElementById('ot-notes').value = schedule.notes || '';
    
    document.getElementById('ot-schedule-form').setAttribute('data-edit-id', id);
    
    openModal('otScheduleModal');
}

// ==================== UNSCHEDULED PATIENTS PANEL ====================

function renderUnscheduledPatients() {
    const tbody = document.getElementById('unscheduled-tbody');
    if (!tbody) return;

    const query = (document.getElementById('unscheduled-search')?.value || '').toLowerCase();

    // Collect MRD numbers that already have a non-cancelled OT schedule
    const scheduledMRDs = new Set(
        otSchedules
            .filter(s => s.status !== 'Cancelled')
            .map(s => s.mrd_number)
    );

    let unscheduled = patients.filter(p => !scheduledMRDs.has(p.mrd_number));

    if (query) {
        unscheduled = unscheduled.filter(p =>
            (p.name || '').toLowerCase().includes(query) ||
            (p.mrd_number || '').toLowerCase().includes(query)
        );
    }

    if (unscheduled.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#28a745;">✓ All patients are scheduled</td></tr>';
        return;
    }

    tbody.innerHTML = unscheduled.map(p => `
        <tr>
            <td><strong>${p.mrd_number || '—'}</strong></td>
            <td>${p.name}</td>
            <td>${p.age || '—'} / ${p.gender || '—'}</td>
            <td>${p.eye || '—'}</td>
            <td>${p.phone || '—'}</td>
            <td>${p.eye_condition || '—'}</td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="viewPatient('${p.id}')">Details</button>
                <button class="action-btn edit" onclick="schedulePatientDirectly('${p.id}')">Schedule</button>
            </td>
        </tr>
    `).join('');
}

function schedulePatientDirectly(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    showOTScheduleModal();
    setTimeout(() => {
        document.getElementById('ot-patient-name').value = patient.name || '';
        document.getElementById('ot-mrd').value = patient.mrd_number || '';
        document.getElementById('ot-patient-age').value = patient.age || '';
        document.getElementById('ot-patient-gender').value = patient.gender || '';
        document.getElementById('ot-patient-phone').value = patient.phone || '';
    }, 200);
}

// ==================== PRINT FUNCTIONS ====================

async function printCurrentPatientForm() {
    const form = document.getElementById('patient-form');
    const isEditMode = form?.getAttribute('data-edit-mode') === 'true';
    const patientId = form?.getAttribute('data-patient-id');

    // If patient is saved → use the server-side professional PDF
    if (isEditMode && patientId) {
        showToast('Generating professional PDF...', 'info');
        try {
            const result = await apiRequest(`/patients/${patientId}/generate-pdf`, 'POST');
            if (result && result.success) {
                const link = document.createElement('a');
                link.href = `${API_BASE_URL}/patients/${patientId}/download-pdf`;
                link.download = result.fileName || 'patient_record.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('PDF downloaded successfully!', 'success');
            } else {
                throw new Error(result?.message || 'PDF generation failed');
            }
        } catch (err) {
            showToast('Server PDF failed — using print fallback.', 'warning');
            _printFormFallback();
        }
        return;
    }

    // Unsaved / new patient → professional print-window fallback
    _printFormFallback();
}

function _printFormFallback() {
    const getValue = id => document.getElementById(id)?.value || '';
    const hospital = 'TN SHUKLA EYE HOSPITAL';
    const now = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const mrd  = getValue('patient-mrd')  || '—';
    const name = getValue('patient-name') || '—';
    const age  = getValue('patient-age')  || '—';
    const gender = getValue('patient-gender') || '—';

    const sections = [
        {
            title: '1.  PATIENT IDENTIFICATION',
            rows: [
                ['Full Name', name],                          ['MRD Number', mrd],
                ['Age', age + ' yrs'],                        ['Gender', gender],
                ['Blood Group', getValue('patient-blood-group')],
                ['Phone', getValue('patient-phone')],         ['Email', getValue('patient-email')],
                ['Address', getValue('patient-address')],
                ['Category', getValue('patient-category')],
                ['Insurance Provider', getValue('insurance-provider')],
                ['Insurance ID', getValue('insurance-id')],
                ['Physician', getValue('physician')],         ['Eye for Operation', getValue('operation-eye')],
                ['Eye Condition', getValue('eye-condition')], ['Previous Eye Surgery', getValue('eye-surgery')],
                ['EMR Number', getValue('emr-number')]
            ]
        },
        {
            title: '2.  EMERGENCY CONTACT',
            rows: [
                ['Contact Name', getValue('emergency-name')],
                ['Phone', getValue('emergency-phone')],
                ['Relationship', getValue('emergency-relation')]
            ]
        },
        {
            title: '3.  MEDICAL HISTORY',
            rows: [
                ['Diabetic', getValue('diabetic')],           ['Diabetic Since', getValue('diabetic-since')],
                ['On Insulin', getValue('insulin')],           ['Cardiac History', getValue('cardiac')],
                ['Angioplasty', getValue('angioplasty')],     ['Bypass Surgery', getValue('bypass')],
                ['Blood Thinner', getValue('blood-thinner')], ['Kidney Disease', getValue('kidney')],
                ['On Dialysis', getValue('dialysis')],         ['Hypertension', getValue('hypertension')],
                ['Thyroid Disorder', getValue('thyroid')],     ['Asthma/COPD', getValue('asthma')]
            ]
        },
        {
            title: '4.  LAB INFORMATION',
            rows: [
                ['Lab Name', getValue('lab-name-step2') || getValue('lab-name')],
                ['Lab Registration No.', getValue('lab-registration')],
                ['Investigation Date', getValue('investigation-date-step2') || getValue('investigation-date')],
                ['IOL Category (Lab)', getValue('iol-category-lab')],
                ['Gram Swab', getValue('gram-swab')],
                ['Conjunctival Swab', getValue('conjunctival-swab')]
            ]
        },
        {
            title: '5.  BLOOD INVESTIGATION',
            rows: [
                ['Hemoglobin (g/dL)', getValue('hb')],        ['ESR (mm/hr)', getValue('esr')],
                ['CRP (mg/L)', getValue('crp')],               ['Platelet Count (×10³/µL)', getValue('platelet')],
                ['TLC (×10³/µL)', getValue('tlc')],
                ['Neutrophil (%)', getValue('neutrophil')],    ['Lymphocyte (%)', getValue('lymphocyte')],
                ['Eosinophil (%)', getValue('eosinophil')],    ['Monocyte (%)', getValue('monocyte')],
                ['Basophil (%)', getValue('basophil')],
                ['FBS (mg/dL)', getValue('fbs')],              ['PPBS (mg/dL)', getValue('ppbs')],
                ['RBS (mg/dL)', getValue('rbs')],              ['HbA1C (%)', getValue('hba1c')],
                ['Creatinine (mg/dL)', getValue('creatinine')], ['BUN (mg/dL)', getValue('bun')],
                ['Sodium (mEq/L)', getValue('sodium')],        ['Potassium (mEq/L)', getValue('potassium')],
                ['Chloride (mEq/L)', getValue('chloride')]
            ]
        },
        {
            title: '6.  URINE EXAMINATION',
            rows: [
                ['Urine Type', getValue('urine-type')],
                ['Protein', getValue('urine-protein')],        ['Glucose', getValue('urine-glucose')],
                ['Ketone', getValue('urine-ketone')],          ['Blood', getValue('urine-blood')],
                ['Pus Cells (/hpf)', getValue('urine-pus')],  ['Epithelial Cells (/hpf)', getValue('urine-epithelial')],
                ['Bacteria', getValue('urine-bacteria')],      ['Cast', getValue('urine-cast')]
            ]
        },
        {
            title: '7.  INFECTIVE PROFILE',
            rows: [
                ['HBsAg (Hepatitis B)', getValue('hbsag')],   ['Anti-HCV (Hepatitis C)', getValue('hcv')],
                ['HIV', getValue('hiv')],                      ['HBV', getValue('hbv')]
            ]
        },
        {
            title: '8.  VISUAL ACUITY',
            rows: [
                ['Vision RE (UCVA)', getValue('vision-re')],  ['Vision LE (UCVA)', getValue('vision-le')],
                ['BCVA RE', getValue('bcva-re')],              ['BCVA LE', getValue('bcva-le')],
                ['Specular RE', getValue('specular-re')],      ['Specular LE', getValue('specular-le')]
            ]
        },
        {
            title: '9.  CLINICAL FINDINGS',
            rows: [
                ['Cataract Type RE', getValue('cataract-type-re')], ['Cataract Type LE', getValue('cataract-type-le')],
                ['Fundus View RE', getValue('fundus-view-re')],      ['Fundus View LE', getValue('fundus-view-le')],
                ['Pupil Dilation RE', getValue('pupil-dilation-re')], ['Pupil Dilation LE', getValue('pupil-dilation-le')],
                ['IOP RE', getValue('iop-re') ? getValue('iop-re') + ' mmHg' : ''],
                ['IOP LE', getValue('iop-le') ? getValue('iop-le') + ' mmHg' : ''],
                ['Diagnosis', getValue('diagnosis')]
            ]
        },
        {
            title: '10.  SPECIAL INVESTIGATIONS',
            rows: [
                ['OCT', getValue('oct')],                     ['ARGUS', getValue('argas')],
                ['Pentacam', getValue('pentacam')],            ['B-Scan', getValue('bscan')],
                ['ECG', getValue('ecg')],                     ['Medical Fitness', getValue('medical-fitness')],
                ['BT (Bleeding Time)', getValue('bt')],        ['CT (Clotting Time)', getValue('ct')]
            ]
        },
        {
            title: '11.  BIOMETRY – RIGHT EYE',
            rows: [
                ['AL (mm)', getValue('al-re')],   ['K1 (D)', getValue('k1-re')],
                ['K2 (D)', getValue('k2-re')],    ['CYL (D)', getValue('cyl-re')],
                ['ACD (mm)', getValue('acd-re')], ['LT (mm)', getValue('lt-re')],
                ['CCT (μm)', getValue('cct-re')], ['WTW (mm)', getValue('wtw-re')]
            ]
        },
        {
            title: '12.  BIOMETRY – LEFT EYE',
            rows: [
                ['AL (mm)', getValue('al-le')],   ['K1 (D)', getValue('k1-le')],
                ['K2 (D)', getValue('k2-le')],    ['CYL (D)', getValue('cyl-le')],
                ['ACD (mm)', getValue('acd-le')], ['LT (mm)', getValue('lt-le')],
                ['CCT (μm)', getValue('cct-le')], ['WTW (mm)', getValue('wtw-le')]
            ]
        },
        {
            title: '13.  IOL CALCULATION & PLANNING',
            rows: [
                ['A Constant', getValue('aconstant')],
                ['IOL Power RE', getValue('iol-power-re')],    ['IOL Power LE', getValue('iol-power-le')],
                ['IOL Category', getValue('iol-category')],    ['IOL Manufacturer', getValue('iol-manufacturer')],
                ['Target Refraction RE', getValue('target-re')], ['Target Refraction LE', getValue('target-le')]
            ]
        },
        {
            title: '14.  SURGICAL AIDS & ACCESSORIES',
            rows: [
                ['Viscoat', getValue('viscoat')],              ['B-Hex Ring', getValue('bhex-ring')],
                ['CTR Ring', getValue('ctr-ring')],            ['IOL Toric Sheet', getValue('toric-sheet')],
                ['Other Aids', getValue('other-aids')],        ['Access Required', getValue('access-required')],
                ['Intra-op Requirements', getValue('intraop-requirements')]
            ]
        },
        {
            title: '15.  OPERATION DETAILS',
            rows: [
                ['Operation OT', getValue('operation-ot')],       ['Operation Date', getValue('operation-date')],
                ['Operation Time', getValue('operation-time')],   ['Surgeon', getValue('operation-doctor')],
                ['Doctor Role', getValue('operation-doctor-role')], ['Notes', getValue('operation-notes')]
            ]
        },
        {
            title: '16.  VERIFICATION',
            rows: [
                ['Verified By', getValue('verified-by')],              ['Verification Date', getValue('verification-date')],
                ['Verification Time', getValue('verification-time')],  ['Signature Status', getValue('signature')],
                ['Intra-op Notes', getValue('intraop-notes')],         ['Post-op Instructions', getValue('postop-instructions')]
            ]
        }
    ];

    const statusColors = { 'Done':'#27ae60','Normal':'#27ae60','Negative':'#27ae60','Fit':'#27ae60',
        'Abnormal':'#e74c3c','Positive':'#e74c3c','Not Done':'#95a5a6','Pending':'#e67e22' };

    const badge = (v) => {
        const col = statusColors[v] || null;
        return col
            ? `<span style="background:${col};color:white;padding:1px 8px;border-radius:10px;font-size:10px;">${v}</span>`
            : `<span>${v}</span>`;
    };

    const renderSection = (s, idx) => {
        const filled = s.rows.filter(([, v]) => v && String(v).trim() && String(v) !== '— ');
        if (!filled.length) return '';
        const rowsHtml = filled.map(([k, v], i) => `
            <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'};">
                <td style="padding:6px 12px;font-weight:600;color:#374151;width:42%;border-bottom:1px solid #e5e7eb;font-size:11px;">${k}</td>
                <td style="padding:6px 12px;color:#111827;border-bottom:1px solid #e5e7eb;font-size:11px;">${badge(v)}</td>
            </tr>`).join('');
        return `
            <div style="margin-bottom:14px;break-inside:avoid;">
                <div style="background:linear-gradient(90deg,#1d4ed8,#2563eb);color:white;padding:6px 14px;
                            font-size:10.5px;font-weight:700;letter-spacing:0.6px;border-radius:4px 4px 0 0;">
                    ${s.title}
                </div>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 4px 4px;">
                    ${rowsHtml}
                </table>
            </div>`;
    };

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${hospital} – ${mrd} – ${name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 820px; margin: 0 auto; background: white; }
  /* Force every element to print its background colours / gradients */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    .page { box-shadow: none; }
    @page { margin: 12mm 14mm; size: A4; }
  }
</style>
</head><body>
<div class="page">

  <!-- ── HEADER ── -->
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%);
              padding:20px 28px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${window.location.origin}/assets/logo.png"
           alt="Logo"
           style="height:60px;width:auto;object-fit:contain;filter:brightness(0) invert(1);"
           onerror="this.style.display='none'">
      <div>
        <div style="font-size:20px;font-weight:800;color:white;letter-spacing:1.5px;text-transform:uppercase;">
          ${hospital}
        </div>
        <div style="font-size:11px;color:#bfdbfe;margin-top:3px;letter-spacing:0.3px;">
          Comprehensive Patient Medical Record
        </div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="background:rgba(255,255,255,0.15);padding:8px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.25);">
        <div style="font-size:13px;font-weight:700;color:white;">MRD: ${mrd}</div>
        <div style="font-size:10px;color:#bfdbfe;margin-top:2px;">Generated: ${now}</div>
      </div>
    </div>
  </div>

  <!-- ── PATIENT SUMMARY BAR ── -->
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-top:none;
              padding:10px 28px;display:flex;gap:0;flex-wrap:wrap;">
    ${[['Patient', name], ['Age', age + ' yrs'], ['Gender', gender],
       ['Category', getValue('patient-category') || '—'],
       ['Phone', getValue('patient-phone') || '—']].map(([k,v]) =>
      `<div style="padding:4px 20px 4px 0;min-width:120px;">
         <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${k}</div>
         <div style="font-size:12px;font-weight:700;color:#1e3a8a;">${v}</div>
       </div>`).join('<div style="width:1px;background:#bfdbfe;margin:2px 12px 2px 0;"></div>')}
  </div>

  <!-- ── CONTENT ── -->
  <div style="padding:20px 24px;">
    ${sections.map((s, i) => renderSection(s, i)).join('')}

    <!-- ── DECLARATION ── -->
    <div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:4px;font-size:10.5px;color:#374151;line-height:1.6;">
      I hereby confirm that the information provided in this medical record is true and correct to the best of my knowledge.
      This document is a legal medical record of the patient's history and treatment at ${hospital}.
    </div>

    <!-- ── SIGNATURE LINE ── -->
    <div style="display:flex;justify-content:space-between;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <div style="text-align:center;width:220px;">
        <div style="border-top:1.5px solid #374151;padding-top:6px;font-size:10px;color:#6b7280;">
          Patient / Guardian Signature &amp; Date
        </div>
      </div>
      <div style="text-align:center;width:220px;">
        <div style="border-top:1.5px solid #374151;padding-top:6px;font-size:10px;color:#6b7280;">
          Attending Physician – Dr. ${getValue('physician') || '—'}
        </div>
      </div>
    </div>
  </div>

  <!-- ── FOOTER ── -->
  <div style="background:#1e3a8a;color:#bfdbfe;text-align:center;padding:8px;font-size:9.5px;letter-spacing:0.4px;">
    ${hospital} – Electronic Medical Record – Confidential – Page 1
  </div>

  <!-- ── PRINT BUTTON ── -->
  <div class="no-print" style="text-align:center;padding:16px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <button onclick="window.print()" style="padding:10px 30px;background:#1d4ed8;color:white;border:none;
      border-radius:5px;cursor:pointer;font-size:14px;font-weight:600;margin-right:10px;">
      🖨️ Print / Save as PDF
    </button>
    <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;
      border-radius:5px;cursor:pointer;font-size:14px;">
      Close
    </button>
  </div>

</div>
</body></html>`);
    win.document.close();
}

function printPatientFromModal() {
    const content = document.getElementById('patient-full-detail-print');
    if (!content) { window.print(); return; }
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Patient Full Record</title>
    <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: Arial, sans-serif; margin: 30px; color: #222; }
        .detail-row { display: flex; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 0.9em; }
        .detail-label { font-weight: 600; color: #444; min-width: 200px; }
        .detail-value { flex: 1; color: #222; }
        div[style*="background:#1a56db"] { background: #1a56db !important; color: white !important;
            padding: 7px 12px; margin: 14px 0 4px; border-radius: 4px; font-weight: 700; }
        @media print { button { display: none !important; } }
    </style></head><body>
    <div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #1a56db;padding-bottom:10px;margin-bottom:6px;">
      <img src="${window.location.origin}/assets/logo.png"
           alt="Logo"
           style="height:52px;width:auto;object-fit:contain;"
           onerror="this.style.display='none'">
      <h2 style="color:#1a56db;margin:0;">WIESPL – Full Patient Record</h2>
    </div>
    <p style="color:#888;font-size:0.82em;">Printed: ${new Date().toLocaleString()}</p>
    ${content.innerHTML}
    <div style="margin-top:24px;text-align:center;">
        <button onclick="window.print()" style="padding:10px 24px;background:#1a56db;color:white;border:none;border-radius:5px;cursor:pointer;font-size:1em;">Print / Save as PDF</button>
        <button onclick="window.close()" style="padding:10px 24px;background:#6c757d;color:white;border:none;border-radius:5px;cursor:pointer;font-size:1em;margin-left:10px;">Close</button>
    </div>
    </body></html>`);
    win.document.close();
}

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
    checkNetworkStatus();
    setInterval(checkNetworkStatus, 5000);
});
document.addEventListener('DOMContentLoaded', async function() {
    setupAuth();
    setupNavigation();
    setupForms();
    setupTabs();
    setupFileUpload();
    initializeMobileSettings();
    
    // Add MRD availability check
    document.getElementById('patient-mrd')?.addEventListener('blur', checkMRDAvailability);
    
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('collapsed');
        document.querySelector('.main-content').classList.toggle('full-width');
    });
    
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.add('collapsed');
        document.querySelector('.main-content').classList.add('full-width');
    }
    
    const networkStatus = document.createElement('div');
    networkStatus.id = 'network-status';
    networkStatus.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 12px;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    networkStatus.innerHTML = '● Checking...';
    document.body.appendChild(networkStatus);
    
    const hasSession = checkExistingSession();
    
    await loadAllData();
    
    if (roles.length === 0 || users.length === 0) {
        console.log('Using simulated data as fallback');
        simulateInitialData();
    }
    
    renderRoles();
    renderUsers();
    populateRoleDropdown();
    
    if (currentUser) {
        applyPermissions();
    }
    
    setInterval(checkNetworkStatus, 30000);
    checkNetworkStatus();
    
    try {
        await testServerConnection();
    } catch (error) {
        console.error('Server connection test failed:', error);
        if (!hasSession) {
            alert('Cannot connect to server. Please make sure the server is running on port 3000.');
        }
    }
    
    // Initialize OT schedule listeners
    document.getElementById('ot-date-filter')?.addEventListener('change', loadOTSchedules);
    document.getElementById('ot-filter')?.addEventListener('change', loadOTSchedules);
    
    const otPage = document.getElementById('ot-scheduling');
    if (otPage) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (otPage.classList.contains('active')) {
                        loadOTSchedules();
                    }
                }
            });
        });
        observer.observe(otPage, { attributes: true });
    }
    
    // Initialize multi-step form
    initializeMultiStepForm();
});