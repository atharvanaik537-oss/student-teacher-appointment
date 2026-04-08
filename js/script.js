// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyCdBk6BCks8ZvTJHHK5DiNSEO-jV1puJ_I",
  authDomain: "edubook-45c33.firebaseapp.com",
  projectId: "edubook-45c33",
  storageBucket: "edubook-45c33.firebasestorage.app",
  messagingSenderId: "758417192664",
  appId: "1:758417192664:web:d2801c8e00d394805949ad",
  measurementId: "G-15NR2TXLPS"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================= GLOBAL STATE =================
let currentUser = null;

// ================= AUTH OBSERVER =================
auth.onAuthStateChanged((user) => {
  if (user) {
    db.collection("users").doc(user.email).get().then((doc) => {
      if (doc.exists) {
        currentUser = doc.data();
        updateNavbar();
        initPageLogic();
      }
    });
  } else {
    currentUser = null;
    updateNavbar();
    if (!window.location.pathname.includes('index.html') && 
        !window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
      window.location.href = 'login.html';
    }
  }
});

// ================= NAVBAR =================
function updateNavbar() {
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks) return;

  if (currentUser) {
    let dashLink = currentUser.role === 'admin' ? 'admin-dashboard.html' : 
                   currentUser.role === 'teacher' ? 'teacher-dashboard.html' : 'dashboard.html';

    const displayName = currentUser.name || "User"; 

    navLinks.innerHTML = `
      <a href="index.html" class="nav-btn">Home</a>
      <a href="${dashLink}" class="nav-btn">Dashboard</a>
      
      <div class="dropdown">
        <div class="user-dropdown-btn">
          <i class="fas fa-user-circle"></i> 
          <span>${displayName}</span>
          <i class="fas fa-chevron-down" style="font-size: 0.8em;"></i>
        </div>
        
        <div class="dropdown-content">
          <div style="padding: 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px 12px 0 0; cursor: default;">
            <div style="font-weight: 700; color: #0f172a; font-size: 15px;">${displayName}</div>
            <div style="color: #64748b; font-size: 13px; margin: 4px 0 10px 0; word-break: break-all;">${currentUser.email}</div>
            <span style="background: #dcfce7; color: #16a34a; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bbf7d0;">
              ${currentUser.role}
            </span>
          </div>
          
          <button onclick="logout()" class="logout-item"><i class="fas fa-sign-out-alt"></i> Logout</button>
        </div>
      </div>
    `;
  } else {
    // FIXED: Removed "About" link and fixed Register button styling so it matches Login perfectly
    navLinks.innerHTML = `
      <a href="index.html" class="nav-btn">Home</a>
      <a href="login.html" class="nav-btn">Login</a>
      <a href="register.html" class="nav-btn">Register</a>
    `;
  }
}

// ================= LOGIN & REGISTER =================

async function login() {
  const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
  const password = document.getElementById('loginPassword')?.value;
  const selectedRole = document.querySelector('input[name="role"]:checked')?.value;
  const messageDiv = document.getElementById('loginMessage');

  if (!email || !password) {
    showMessage(messageDiv, "Please enter both email and password.", 'error');
    return;
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection("users").doc(email).get();
    
    if (!userDoc.exists) {
      await auth.signOut();
      showMessage(messageDiv, "User not found in database.", 'error');
      return;
    }

    const userData = userDoc.data();

    // 1. THE SECRET ADMIN OVERRIDE
    // If the database says this is the Admin, ignore the radio buttons!
    if (userData.role === 'admin') {
      showMessage(messageDiv, "Admin recognized. Redirecting...", 'success');
      setTimeout(() => window.location.href = 'admin-dashboard.html', 1000);
      return;
    }

    // 2. NORMAL USER CHECK (Must match the radio button they clicked)
    if (userData.role !== selectedRole) {
      await auth.signOut();
      showMessage(messageDiv, `Incorrect role. This account is a ${userData.role}.`, 'error');
      return;
    }

    // 3. STUDENT APPROVAL CHECK
    if (userData.role === 'student' && userData.status === 'Pending') {
      await auth.signOut();
      showMessage(messageDiv, `Access Denied: Waiting for Admin approval.`, 'error');
      return;
    }

    // 4. SUCCESSFUL LOGIN
    window.location.href = userData.role === 'teacher' ? 'teacher-dashboard.html' : 'dashboard.html';

  } catch (error) {
    showMessage(messageDiv, "Login failed: " + error.message, 'error');
  }
}


async function register() {
  const name = document.getElementById('regName')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
  const password = document.getElementById('regPassword')?.value;
  const confirmPassword = document.getElementById('regConfirmPassword')?.value;
  const role = document.querySelector('input[name="regRole"]:checked')?.value || 'student';
  const messageDiv = document.getElementById('registerMessage');

  // NEW: Check if passwords match
  if (password !== confirmPassword) {
    showMessage(messageDiv, "Passwords do not match. Please try again.", "error");
    return;
  }

  // Check for empty fields
  if (!name || !email || !password) {
    showMessage(messageDiv, "Please fill in all fields.", "error");
    return;
  }

  try {
    // 1. Create the user in Firebase Auth
    await auth.createUserWithEmailAndPassword(email, password);
    
    // 2. Save user details to Firestore Database
    await db.collection("users").doc(email).set({
      name, 
      email, 
      role,
      status: role === 'student' ? 'Pending' : 'Active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 3. Show the detailed success message based on role
    if (role === 'student') {
      showMessage(
        messageDiv, 
        "✅ Registration Successful!<br><br>⏳ <b>Please note:</b> Your account requires Admin approval before you can log in. Please wait for an Admin to activate your account.", 
        "success"
      );
      // Give them 5 seconds to read the message before sending to login page
      setTimeout(() => window.location.href = 'login.html', 5000);
    } else {
      showMessage(messageDiv, "✅ Registration Successful!", "success");
      setTimeout(() => window.location.href = 'login.html', 2000);
    }

  } catch (error) {
    showMessage(messageDiv, error.message, 'error');
  }
}

// ================= ADMIN LOGIC =================
async function displayAdminDashboard() {
  const teacherList = document.getElementById('adminTeacherList');
  const studentList = document.getElementById('adminStudentList');
  if (!teacherList || !studentList) return;

  db.collection("users").onSnapshot(usersSnapshot => {
    teacherList.innerHTML = ''; studentList.innerHTML = '';
    let tCount = 0, sCount = 0;

    usersSnapshot.forEach(doc => {
      const u = doc.data();
      if (u.role === 'teacher') {
        tCount++;
        teacherList.innerHTML += `
          <div class="appointment-item" style="border-left: 5px solid #3b82f6;">
            <div class="appointment-info"><h4>${u.name}</h4><p>${u.email}</p></div>
            <button class="cancel-btn" onclick="deleteUser('${u.email}')">Delete</button>
          </div>`;
      } else if (u.role === 'student') {
        sCount++;
        const isPending = u.status === 'Pending';
        studentList.innerHTML += `
          <div class="appointment-item" style="border-left: 5px solid ${isPending ? '#f59e0b' : '#8b5cf6'};">
            <div class="appointment-info"><h4>${u.name} ${isPending ? '(Pending)' : ''}</h4><p>${u.email}</p></div>
            <div class="btn-group">
              ${isPending ? `<button class="approve-btn" onclick="approveStudent('${u.email}')">Approve</button>` : ''}
              <button class="cancel-btn" onclick="deleteUser('${u.email}')">Remove</button>
            </div>
          </div>`;
      }
    });
    document.getElementById('totalTeachers').innerText = tCount;
    document.getElementById('totalStudents').innerText = sCount;
  });
}

async function approveStudent(email) {
  await db.collection("users").doc(email).update({ status: 'Active' });
  showFloatingMessage("Student Approved!");
}

async function deleteUser(email) {
  if (confirm("Delete this user?")) {
    await db.collection("users").doc(email).delete();
  }
}

// ================= TEACHER LOGIC =================
async function displayTeacherDashboard() {
  const pendingContainer = document.getElementById('teacherPendingList');
  const approvedContainer = document.getElementById('teacherApprovedList');
  const messagesContainer = document.getElementById('teacherMessagesList');
  if (!pendingContainer) return;

  db.collection("appointments").where("teacherEmail", "==", currentUser.email).onSnapshot(snapshot => {
    pendingContainer.innerHTML = ''; approvedContainer.innerHTML = '';
    if(messagesContainer) messagesContainer.innerHTML = '';

    snapshot.forEach(doc => {
      const a = doc.data();
      const html = `
        <div class="appointment-item">
          <div class="appointment-info">
            <h4>From: ${a.studentName}</h4>
            <p>${a.date} at ${formatTime(a.time)}</p>
            <p style="background:#f1f5f9; padding:8px; border-radius:5px;">"${a.message}"</p>
          </div>
          <div class="btn-group">
            ${a.status === 'Pending' ? `<button class="approve-btn" onclick="updateApptStatus('${doc.id}', 'Approved')">Approve</button>` : ''}
            <button class="cancel-btn" onclick="updateApptStatus('${doc.id}', 'Declined')">Decline</button>
          </div>
        </div>`;
      
      if (a.status === 'Approved') approvedContainer.innerHTML += html;
      else if (a.status === 'Pending') pendingContainer.innerHTML += html;

      if(messagesContainer && a.message !== "No message provided.") {
        messagesContainer.innerHTML += `<div class="appointment-item"><strong>${a.studentName}:</strong> ${a.message}</div>`;
      }
    });
  });
}

async function updateApptStatus(id, status) {
  await db.collection("appointments").doc(id).update({ status });
}

// ================= STUDENT LOGIC =================
async function populateTeachers() {
  const dropdown = document.getElementById('teacherName');
  if (!dropdown) return;
  const snapshot = await db.collection("users").where("role", "==", "teacher").get();
  dropdown.innerHTML = '<option value="" disabled selected>Select Teacher</option>';
  snapshot.forEach(doc => {
    dropdown.innerHTML += `<option value="${doc.data().email}">${doc.data().name}</option>`;
  });
}

async function bookAppointment() {
  const teacherSelect = document.getElementById('teacherName');
  const teacherEmail = teacherSelect.value; 
  const teacherName = teacherSelect.options[teacherSelect.selectedIndex].text; 
  const date = document.getElementById('appointmentDate').value;
  const time = document.getElementById('appointmentTime').value;
  const message = document.getElementById('appointmentMessage').value || "No message provided.";

  if (!teacherEmail || !date || !time) {
    showFloatingMessage("Please fill all fields!");
    return;
  }

  await db.collection("appointments").add({
    teacherEmail: teacherEmail,
    teacherName: teacherName,  
    studentEmail: currentUser.email,
    studentName: currentUser.name,
    date: date,
    time: time,
    message: message,
    status: 'Pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  showFloatingMessage("Request Sent Successfully!");
  document.getElementById('appointmentMessage').value = '';
}

async function displayStudentAppointments() {
  const container = document.getElementById('appointmentsList');
  const countBadge = document.getElementById('totalAppointments');
  if (!container) return;

  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase() || "";
  const filterDate = document.getElementById('filterDate')?.value || "";

  db.collection("appointments")
    .where("studentEmail", "==", currentUser.email)
    .onSnapshot(snapshot => {
      container.innerHTML = '';
      let count = 0;

      snapshot.forEach(doc => {
        const a = doc.data();
        
        // Apply Filters
        if (searchQuery && !a.teacherName.toLowerCase().includes(searchQuery)) return;
        if (filterDate && a.date !== filterDate) return;

        count++;
        let statusColor = a.status === 'Approved' ? '#16a34a' : a.status === 'Declined' ? '#dc2626' : '#f59e0b';
        
        container.innerHTML += `
          <div class="appointment-item">
            <div class="appointment-info">
              <h4>Teacher: ${a.teacherName}</h4>
              <p>${a.date} at ${formatTime(a.time)}</p>
              <small style="color: ${statusColor}; font-weight:bold;">● ${a.status}</small>
            </div>
            <button class="cancel-btn" onclick="deleteAppointment('${doc.id}')">Cancel</button>
          </div>`;
      });

      if (countBadge) countBadge.innerText = count;
      if (count === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>No matches found</p></div>`;
      }
    });
}

async function deleteAppointment(id) {
  if (confirm("Cancel this appointment?")) {
    await db.collection("appointments").doc(id).delete();
  }
}

function clearAll() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterDate').value = '';
  displayStudentAppointments();
}

// ================= UTILS =================
function formatTime(time) {
  if(!time) return "";
  const [hour, minute] = time.split(":");
  const h = parseInt(hour);
  return `${h % 12 || 12}:${minute} ${h >= 12 ? 'PM' : 'AM'}`;
}

function logout() { auth.signOut().then(() => window.location.href = 'index.html'); }
function showMessage(el, msg, type) { if (el) el.innerHTML = `<div class="${type}-message">${msg}</div>`; }
function showFloatingMessage(msg) {
  const div = document.createElement("div");
  div.innerText = msg;
  div.style.cssText = "position:fixed;bottom:20px;right:20px;background:#16a34a;color:white;padding:12px 20px;border-radius:50px;z-index:1000;";
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}

function initPageLogic() {
  const path = window.location.pathname;
  
  if (path.includes('admin-dashboard')) {
    displayAdminDashboard();
  }
  
  if (path.includes('teacher-dashboard')) {
    displayTeacherDashboard();
  }
  
  if (path.includes('dashboard.html') && !path.includes('admin') && !path.includes('teacher')) { 
    populateTeachers(); 
    displayStudentAppointments();
    
    const searchInput = document.getElementById('searchInput');
    const filterDate = document.getElementById('filterDate');
    const dateInput = document.getElementById("appointmentDate");

    if (searchInput) searchInput.addEventListener('input', displayStudentAppointments);
    if (filterDate) filterDate.addEventListener('change', displayStudentAppointments);
    if (dateInput) dateInput.min = new Date().toISOString().split("T")[0];
  }
}

// ================= ADMIN: ADD TEACHER =================
async function adminAddTeacher() {
  const name = document.getElementById('adminTeacherName').value.trim();
  const subject = document.getElementById('adminTeacherSubject').value.trim();
  const email = document.getElementById('adminTeacherEmail').value.trim();
  const password = document.getElementById('adminTeacherPassword').value;
  const messageDiv = document.getElementById('adminMessage');

  if (!name || !subject || !email || !password) {
    showMessage(messageDiv, "Please fill all fields!", "error");
    return;
  }

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(email).set({
      name: name,
      subject: subject,
      email: email,
      role: "teacher",
      status: "Active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showMessage(messageDiv, "Teacher Account Created Successfully!", "success");
    
    document.getElementById('adminTeacherName').value = '';
    document.getElementById('adminTeacherSubject').value = '';
    document.getElementById('adminTeacherEmail').value = '';
    document.getElementById('adminTeacherPassword').value = '';

  } catch (error) {
    showMessage(messageDiv, error.message, "error");
  }
}

// ================= PROFILE LOGIC =================
// FIXED: Removed the accidental duplicate of this function that was causing bugs!
async function displayUserProfile() {
  const container = document.getElementById('profileContent');
  if (!container || !currentUser) return;

  let roleColor = currentUser.role === 'admin' ? '#ef4444' : currentUser.role === 'teacher' ? '#3b82f6' : '#8b5cf6';
  let statusColor = currentUser.status === 'Active' ? '#16a34a' : '#f59e0b';

  container.innerHTML = `
    <div class="profile-avatar">
      <i class="fas fa-user"></i>
    </div>
    <h2 class="profile-name">${currentUser.name}</h2>
    <p class="profile-email"><i class="fas fa-envelope"></i> ${currentUser.email}</p>
    
    <div class="profile-details">
      <div class="detail-group">
        <label>Account Role</label>
        <span class="badge" style="background: ${roleColor}; padding: 8px 15px; font-size: 1rem;">
          ${currentUser.role.toUpperCase()}
        </span>
      </div>
      
      <div class="detail-group">
        <label>Account Status</label>
        <span class="badge" style="background: ${statusColor}; padding: 8px 15px; font-size: 1rem;">
          ${currentUser.status}
        </span>
      </div>
    </div>
  `;
}
// ================= SMART ROUTING =================
function goToDashboard() {
  if (currentUser) {
    // If they ARE logged in, figure out which dashboard they belong to
    let dashLink = currentUser.role === 'admin' ? 'admin-dashboard.html' : 
                   currentUser.role === 'teacher' ? 'teacher-dashboard.html' : 'dashboard.html';
    window.location.href = dashLink;
  } else {
    // If they are NOT logged in, send them straight to login safely
    window.location.href = 'login.html';
  }
}
// ================= PASSWORD VISIBILITY TOGGLE =================
function togglePassword(inputId, iconElement) {
  const input = document.getElementById(inputId);
  
  if (input.type === "password") {
    input.type = "text"; // Show password
    iconElement.classList.remove("fa-eye-slash");
    iconElement.classList.add("fa-eye"); // Show Open Eye
  } else {
    input.type = "password"; // Hide password
    iconElement.classList.remove("fa-eye");
    iconElement.classList.add("fa-eye-slash"); // Show Closed Eye
  }
}