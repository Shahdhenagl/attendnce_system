// State & Core Logic for Attendance and Presence Verification System

// Request native desktop notification permissions on load
if (typeof window !== "undefined" && "Notification" in window) {
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

// Send native laptop notifications
function sendNativeNotification(title, body) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: body,
      icon: "https://cdn-icons-png.flaticon.com/512/564/564793.png",
      requireInteraction: true
    });
    
    notification.onclick = function() {
      window.focus();
      const roleSelect = document.getElementById('role-select');
      if (roleSelect) {
        roleSelect.value = "employee";
        roleSelect.dispatchEvent(new Event('change'));
      }
    };
    
    setTimeout(() => {
      notification.close();
    }, 10000);
  }
}

// ----------------------------------------------------
// 1. Audio Synthesizer (Web Audio API)
// ----------------------------------------------------
const playTone = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'success') {
      // Double upbeat chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain2.gain.setValueAtTime(0.08, ctx.currentTime);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.15);
      }, 100);
    } else if (type === 'alert') {
      // Warning chime (repetitive sound)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'danger') {
      // Buzzing error tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime); // Low pitch
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {
    console.warn("Web Audio API failed or blocked by browser autocomplete policies", e);
  }
};

// ----------------------------------------------------
// 2. Data Store & State Initialization
// ----------------------------------------------------
const DEFAULT_EMPLOYEES = [
  {
    id: "emp-1",
    name: "شاهندة ناجي",
    email: "shahd@company.com",
    startHour: "09:00",
    endHour: "17:00",
    vacationBalance: 21,
    vacationsUsed: 3,
    role: "remote",
    avatar: "شن",
    password: "shahd123"
  },
  {
    id: "emp-2",
    name: "أحمد حسن",
    email: "ahmed@company.com",
    startHour: "09:00",
    endHour: "17:00",
    vacationBalance: 15,
    vacationsUsed: 2,
    role: "remote",
    avatar: "أح",
    password: "ahmed123"
  },
  {
    id: "emp-3",
    name: "نهى محمود",
    email: "noha@company.com",
    startHour: "10:00",
    endHour: "18:00",
    vacationBalance: 30,
    vacationsUsed: 5,
    role: "remote",
    avatar: "نم",
    password: "noha123"
  }
];

const DEFAULT_ATTENDANCE = [
  // Past records for a realistic feel
  {
    id: "att-old-1",
    employeeId: "emp-1",
    date: "2026-07-15",
    checkInTime: "09:00",
    checkOutTime: "17:00",
    status: "Present",
    workedHours: 8.0,
    snoozeHours: 0.0,
    isCheckedOut: true
  },
  {
    id: "att-old-2",
    employeeId: "emp-2",
    date: "2026-07-15",
    checkInTime: "09:15", // Late
    checkOutTime: "17:00",
    status: "Late",
    workedHours: 7.75,
    snoozeHours: 0.5, // 30 mins snooze
    isCheckedOut: true
  },
  {
    id: "att-old-3",
    employeeId: "emp-3",
    date: "2026-07-15",
    checkInTime: "10:00",
    checkOutTime: "18:00",
    status: "Present",
    workedHours: 8.0,
    snoozeHours: 0.0,
    isCheckedOut: true
  }
];

class AppStore {
  constructor() {
    this.load();
  }

  load() {
    this.employees = JSON.parse(localStorage.getItem('att_employees')) || DEFAULT_EMPLOYEES;
    // Ensure all employees have passwords (backward compatibility)
    this.employees.forEach(emp => {
      if (!emp.password) {
        if (emp.id === 'emp-1') emp.password = 'shahd123';
        else if (emp.id === 'emp-2') emp.password = 'ahmed123';
        else if (emp.id === 'emp-3') emp.password = 'noha123';
        else emp.password = '12345';
      }
    });
    this.attendance = JSON.parse(localStorage.getItem('att_attendance')) || DEFAULT_ATTENDANCE;
    this.settings = JSON.parse(localStorage.getItem('att_settings')) || {
      roundInterval: "random", // "10", "20", "30", "50", "random"
      googleSheetsUrl: "https://script.google.com/macros/s/AKfycbz6RxHI933MEMp2bt-TCacbh3NgUL8ldbEuvp-L8dNM-bIqkROL855jaES8s64ohRB0_g/exec"
    };
    if (!this.settings.googleSheetsUrl) {
      this.settings.googleSheetsUrl = "https://script.google.com/macros/s/AKfycbz6RxHI933MEMp2bt-TCacbh3NgUL8ldbEuvp-L8dNM-bIqkROL855jaES8s64ohRB0_g/exec";
    }
    
    // Time states
    this.simTimeSpeed = parseInt(localStorage.getItem('att_simTimeSpeed')) || 1;
    this.simulatedTime = parseInt(localStorage.getItem('att_simulatedTime')) || new Date("2026-07-16T08:55:00").getTime();
    this.lastRoundTriggerTime = parseInt(localStorage.getItem('att_lastRoundTime')) || new Date("2026-07-16T08:55:00").getTime();
    
    // Determine next round check interval
    this.nextRoundIntervalMinutes = parseInt(localStorage.getItem('att_nextRoundInterval')) || this.getRandomInterval();
    
    // Active roles
    this.currentRole = localStorage.getItem('att_currentRole') || "admin";
    this.currentEmployeeId = localStorage.getItem('att_currentEmployeeId') || "emp-1";
    
    // Last validated timestamp for each employee checked-in today (to calculate snooze elapsed blocks)
    this.lastValidationTime = JSON.parse(localStorage.getItem('att_lastValidationTime')) || {};
    
    // Active presence check sessions
    // Structure: { empId: { startTime: timestamp, endTime: timestamp, durationRealMs: 10000, source: 'round'|'manual' } }
    this.activeChecks = JSON.parse(localStorage.getItem('att_activeChecks')) || {};
  }

  save() {
    localStorage.setItem('att_employees', JSON.stringify(this.employees));
    localStorage.setItem('att_attendance', JSON.stringify(this.attendance));
    localStorage.setItem('att_settings', JSON.stringify(this.settings));
    localStorage.setItem('att_simTimeSpeed', this.simTimeSpeed.toString());
    localStorage.setItem('att_simulatedTime', this.simulatedTime.toString());
    localStorage.setItem('att_lastRoundTime', this.lastRoundTriggerTime.toString());
    localStorage.setItem('att_nextRoundInterval', this.nextRoundIntervalMinutes.toString());
    localStorage.setItem('att_currentRole', this.currentRole);
    localStorage.setItem('att_currentEmployeeId', this.currentEmployeeId);
    localStorage.setItem('att_lastValidationTime', JSON.stringify(this.lastValidationTime));
    localStorage.setItem('att_activeChecks', JSON.stringify(this.activeChecks));
  }

  getRandomInterval() {
    const intervals = [10, 20, 30, 50];
    const idx = Math.floor(Math.random() * intervals.length);
    return intervals[idx];
  }

  getIntervalMinutes() {
    if (this.settings.roundInterval === "random") {
      return this.nextRoundIntervalMinutes;
    }
    return parseInt(this.settings.roundInterval);
  }
}

const store = new AppStore();

// ----------------------------------------------------
// 3. Simulated Time Engine
// ----------------------------------------------------
let simTimeInterval = null;

function startSimulatedTime() {
  if (simTimeInterval) clearInterval(simTimeInterval);
  
  simTimeInterval = setInterval(() => {
    // Tick: Add simulated milliseconds. 1 real second adds (1000 * speed)
    store.simulatedTime += 1000 * store.simTimeSpeed;
    
    // Process Auto Check-out check
    processAutoCheckOutCheck();
    
    // Process Random round checks triggers
    processRoundCheckTrigger();
    
    // Save periodically
    store.save();
    
    // Update view clocks
    updateClocks();
  }, 1000);
}

function updateClocks() {
  const dateObj = new Date(store.simulatedTime);
  
  // Format Date: YYYY-MM-DD
  const dateString = dateObj.toISOString().split('T')[0];
  
  // Format Clock: HH:MM:SS
  const pad = (n) => n.toString().padStart(2, '0');
  const clockString = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
  const shortClockString = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
  
  // Update UI Elements
  document.getElementById('sim-date').innerText = dateString;
  document.getElementById('sim-clock').innerText = clockString;
  
  const phoneTime = document.getElementById('phone-os-time');
  if (phoneTime) {
    phoneTime.innerText = shortClockString;
  }
  
  // Live ticker updates for checked-in employee duration
  updateEmployeeLiveStats();
}

// ----------------------------------------------------
// 4. Toast Notifications Drawer
// ----------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  if (type === 'warning') icon = '⚠️';
  if (type === 'danger') icon = '🚨';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Google Sheets Synchronization
function syncToGoogleSheets(action, employeeId, details, workedHours = 0, snoozeHours = 0) {
  const url = store.settings.googleSheetsUrl;
  if (!url) return;

  const emp = store.employees.find(e => e.id === employeeId);
  const empName = emp ? emp.name : "غير معروف";
  const empEmail = emp ? emp.email : "";

  const payload = {
    employeeName: empName,
    employeeEmail: empEmail,
    date: getTodayString(),
    simTime: new Date(store.simulatedTime).toLocaleTimeString('ar-EG', { hour12: false }),
    action: action, // "Check-in", "Check-out", "Missed-Check", "Absence", "Connection-Test"
    details: details,
    workedHours: workedHours,
    snoozeHours: snoozeHours
  };

  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(() => {
    console.log("Synced to Google Sheets successfully:", payload);
  })
  .catch(err => {
    console.error("Failed to sync to Google Sheets:", err);
  });
}

// ----------------------------------------------------
// 5. Shift & Attendance Operations
// ----------------------------------------------------

function getTodayString() {
  return new Date(store.simulatedTime).toISOString().split('T')[0];
}

function checkIn(employeeId) {
  const emp = store.employees.find(e => e.id === employeeId);
  if (!emp) return;

  const todayStr = getTodayString();
  const existingLog = store.attendance.find(a => a.employeeId === employeeId && a.date === todayStr);

  if (existingLog) {
    showToast("أنت مسجل حضور بالفعل اليوم!", "warning");
    return;
  }

  // Parse time
  const simDate = new Date(store.simulatedTime);
  const startParts = emp.startHour.split(':');
  const shiftStart = new Date(store.simulatedTime);
  shiftStart.setHours(parseInt(startParts[0]), parseInt(startParts[1]), 0, 0);

  let status = "Present";
  let lateMinutes = 0;
  
  if (simDate > shiftStart) {
    status = "Late";
    lateMinutes = Math.floor((simDate - shiftStart) / 60000);
    showToast(`لقد تأخرت في تسجيل الحضور بـ ${lateMinutes} دقيقة! تم تسجيل خصم تأخير.`, "warning");
  } else {
    showToast("تم تسجيل الحضور بنجاح في الموعد المحدد.", "success");
  }
  
  playTone('success');

  const newLog = {
    id: "att-" + Date.now() + Math.random().toString(36).substr(2, 5),
    employeeId: employeeId,
    date: todayStr,
    checkInTime: formatTime(simDate),
    checkOutTime: "",
    status: status,
    workedHours: 0.0,
    snoozeHours: 0.0,
    lateMinutes: lateMinutes,
    isCheckedOut: false
  };

  store.attendance.push(newLog);
  
  // Set initial verification baseline to checkin time
  store.lastValidationTime[employeeId] = store.simulatedTime;
  
  store.save();
  syncToGoogleSheets("تسجيل حضور (Check-in)", employeeId, status === "Late" ? `متأخر بـ ${lateMinutes} دقيقة` : "في الموعد المحدد", 0, 0);
  renderApp();
}

function checkOut(employeeId, isAuto = false) {
  const todayStr = getTodayString();
  const log = store.attendance.find(a => a.employeeId === employeeId && a.date === todayStr && !a.isCheckedOut);
  
  if (!log) {
    if (!isAuto) showToast("لا يوجد تسجيل حضور نشط لإغلاقه اليوم.", "danger");
    return;
  }
  
  const emp = store.employees.find(e => e.id === employeeId);
  const simDate = new Date(store.simulatedTime);
  
  // Parse check-in
  const checkInParts = log.checkInTime.split(':');
  const checkInDate = new Date(store.simulatedTime);
  checkInDate.setHours(parseInt(checkInParts[0]), parseInt(checkInParts[1]), 0, 0);
  
  // Total elapsed time in hours
  let totalHours = (simDate - checkInDate) / 3600000;
  if (totalHours < 0) totalHours = 0; // Edge case next day
  
  // Deduct snooze hours
  let netHours = totalHours - log.snoozeHours;
  if (netHours < 0) netHours = 0;
  
  log.checkOutTime = formatTime(simDate);
  log.workedHours = parseFloat(netHours.toFixed(2));
  log.isCheckedOut = true;
  
  // Remove active presence checks if any
  if (store.activeChecks[employeeId]) {
    delete store.activeChecks[employeeId];
  }
  
  // Clean validation baseline
  delete store.lastValidationTime[employeeId];
  
  store.save();
  
  if (isAuto) {
    showToast(`⏱️ انتهى الدوام لـ ${emp.name}! تم تسجيل الانصراف التلقائي (صافي العمل: ${log.workedHours} س).`, "info");
    syncToGoogleSheets("انصراف تلقائي (Auto Check-out)", employeeId, `انتهى الدوام تلقائياً (صافي العمل: ${log.workedHours} س)`, log.workedHours, log.snoozeHours);
  } else {
    showToast(`تم تسجيل الانصراف بنجاح. صافي ساعات العمل المحسوبة: ${log.workedHours} ساعة.`, "success");
    playTone('success');
    syncToGoogleSheets("تسجيل انصراف (Check-out)", employeeId, `تم تسجيل الانصراف بنجاح (صافي العمل: ${log.workedHours} س)`, log.workedHours, log.snoozeHours);
  }
  
  renderApp();
}

// ----------------------------------------------------
// 6. Presence Checking (Rounds / Manual alerts)
// ----------------------------------------------------

function processRoundCheckTrigger() {
  const currentSimTime = store.simulatedTime;
  const intervalMs = store.getIntervalMinutes() * 60 * 1000;
  
  // Check if currentSimulatedTime has crossed the next round limit
  if (currentSimTime >= store.lastRoundTriggerTime + intervalMs) {
    // Save last trigger time
    store.lastRoundTriggerTime = currentSimTime;
    
    // If it's a random configuration, pick a new random interval for the next round
    if (store.settings.roundInterval === "random") {
      store.nextRoundIntervalMinutes = store.getRandomInterval();
    }
    
    // Trigger presence checks for ALL checked-in active employees
    triggerGroupRound();
    store.save();
  }
}

function triggerGroupRound() {
  const todayStr = getTodayString();
  const activeLogs = store.attendance.filter(a => a.date === todayStr && !a.isCheckedOut);
  
  if (activeLogs.length === 0) {
    // No one is currently online
    return;
  }
  
  let triggeredCount = 0;
  activeLogs.forEach(log => {
    createPresenceCheck(log.employeeId, 'round');
    triggeredCount++;
  });
  
  if (triggeredCount > 0) {
    showToast(`🚨 تم إرسال فحص تواجد دوري لـ (${triggeredCount}) موظف نشط!`, "warning");
    playTone('alert');
  }
}

function createPresenceCheck(employeeId, source = 'manual') {
  // If there's already an active check, do not double trigger
  if (store.activeChecks[employeeId]) return;
  
  const emp = store.employees.find(e => e.id === employeeId);
  if (!emp) return;
  
  const realNow = Date.now();
  store.activeChecks[employeeId] = {
    employeeId: employeeId,
    source: source,
    startTime: store.simulatedTime, // Simulated start
    realExpiryTime: realNow + 10000 // Exactly 10 real seconds from now
  };
  
  // Alert the user via standard browser toast in case they are looking at Admin portal
  const empName = emp.name;
  if (store.currentRole === 'admin' || store.currentEmployeeId !== employeeId) {
    showToast(`طلب إثبات تواجد للموظف: ${empName}. أمامه 10 ثوانٍ للرد!`, "warning");
  }
  
  // Send native desktop notification to the laptop
  sendNativeNotification(
    `🚨 إثبات حضور للموظف: ${empName}`,
    `أمامك 10 ثوانٍ لتأكيد تواجدك بالضغط هنا لتفادي الخصم من الساعات!`
  );
  
  store.save();
  
  // Setup real-world timer to handle timeout in exactly 10 seconds
  setTimeout(() => {
    handlePresenceTimeout(employeeId);
  }, 10000);
  
  renderApp();
  
  // Start active popup overlay if viewing that employee
  if (store.currentRole === 'employee' && store.currentEmployeeId === employeeId) {
    startVisualCountdown(employeeId);
  }
}

function handlePresenceTimeout(employeeId) {
  // Verify if check is still active (not confirmed)
  const activeCheck = store.activeChecks[employeeId];
  if (!activeCheck) return; // Already answered
  
  // Calculate penalty
  const todayStr = getTodayString();
  const log = store.attendance.find(a => a.employeeId === employeeId && a.date === todayStr && !a.isCheckedOut);
  const emp = store.employees.find(e => e.id === employeeId);
  
  if (log) {
    // Calculate elapsed simulated time since last successful validation (or check-in) up to current simulated check time
    const lastValTime = store.lastValidationTime[employeeId] || store.simulatedTime;
    const elapsedMs = activeCheck.startTime - lastValTime;
    
    // Minutes
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const snoozeHours = parseFloat((elapsedMs / 3600000).toFixed(2));
    
    if (snoozeHours > 0) {
      log.snoozeHours = parseFloat((log.snoozeHours + snoozeHours).toFixed(2));
      showToast(`💤 لم يستجب الموظف ${emp.name} خلال 10 ثوانٍ! احتساب ${elapsedMinutes} دقيقة وقت غفوة وخصمها من الساعات.`, "danger");
      playTone('danger');
      syncToGoogleSheets("غفوة خصم (Missed Presence Check)", employeeId, `لم يستجب للفحص خلال 10 ثوانٍ (خصم: ${elapsedMinutes} د)`, 0, snoozeHours);
    }
    
    // Update validation reference to the missed check time
    store.lastValidationTime[employeeId] = activeCheck.startTime;
  }
  
  // Delete the check session
  delete store.activeChecks[employeeId];
  store.save();
  
  // Hide popup modal if viewing
  if (store.currentRole === 'employee' && store.currentEmployeeId === employeeId) {
    hidePresenceModal();
  }
  
  renderApp();
}

function confirmPresence(employeeId) {
  const activeCheck = store.activeChecks[employeeId];
  if (!activeCheck) return;
  
  // Update last validation baseline to current simulated time
  store.lastValidationTime[employeeId] = store.simulatedTime;
  
  // Delete the check
  delete store.activeChecks[employeeId];
  store.save();
  
  showToast("تم إثبات تواجدك بنجاح! طاب يومك عملك مستمر.", "success");
  playTone('success');
  
  hidePresenceModal();
  renderApp();
}

// ----------------------------------------------------
// 7. Auto Check-out Verification Engine
// ----------------------------------------------------
function processAutoCheckOutCheck() {
  const todayStr = getTodayString();
  const simDate = new Date(store.simulatedTime);
  const pad = (n) => n.toString().padStart(2, '0');
  const simTimeStr = `${pad(simDate.getHours())}:${pad(simDate.getMinutes())}`;
  
  // Look for any active checked-in employee whose shift hour is passed
  store.attendance.forEach(log => {
    if (!log.isCheckedOut && log.date === todayStr) {
      const emp = store.employees.find(e => e.id === log.employeeId);
      if (emp) {
        // Parse end hour
        const endParts = emp.endHour.split(':');
        const endHourVal = parseInt(endParts[0]);
        const endMinVal = parseInt(endParts[1]);
        
        const shiftEnd = new Date(store.simulatedTime);
        shiftEnd.setHours(endHourVal, endMinVal, 0, 0);
        
        if (simDate >= shiftEnd) {
          // Force check out
          checkOut(emp.id, true);
        }
      }
    }
  });
}

// ----------------------------------------------------
// 8. Admin Management Actions
// ----------------------------------------------------

function addEmployee(name, email, startHour, endHour, vacationBalance, password) {
  const newEmp = {
    id: "emp-" + Date.now(),
    name: name,
    email: email,
    startHour: startHour,
    endHour: endHour,
    vacationBalance: parseInt(vacationBalance),
    vacationsUsed: 0,
    role: "remote",
    avatar: name.split(' ').map(n => n[0]).join('').substr(0, 2),
    password: password || "12345"
  };
  
  store.employees.push(newEmp);
  store.save();
  showToast(`تمت إضافة الموظف الجديد: ${name}`, "success");
  renderApp();
}

function recordAbsence(employeeId, type) {
  // Add an absence on the simulated date
  const todayStr = getTodayString();
  
  // Check if they are already checked in/out today
  const logIndex = store.attendance.findIndex(a => a.employeeId === employeeId && a.date === todayStr);
  const emp = store.employees.find(e => e.id === employeeId);
  
  if (logIndex !== -1) {
    // Overwrite today's attendance
    const currentLog = store.attendance[logIndex];
    if (type === 'paid-vacation') {
      if (emp.vacationBalance - emp.vacationsUsed < 1) {
        showToast("لا يوجد رصيد إجازات كافٍ للموظف!", "danger");
        return;
      }
      emp.vacationsUsed++;
      currentLog.status = "Paid Vacation";
      currentLog.workedHours = 8.0; // Fully credited
      currentLog.snoozeHours = 0.0;
      currentLog.isCheckedOut = true;
      showToast(`تم تسجيل إجازة مدفوعة اليوم للموظف ${emp.name}`, "success");
    } else {
      currentLog.status = "Absent";
      currentLog.workedHours = 0.0;
      currentLog.snoozeHours = 0.0;
      currentLog.isCheckedOut = true;
      showToast(`تم تسجيل غياب (غير مدفوع الأجر) للموظف ${emp.name}`, "warning");
    }
  } else {
    // Create new record
    if (type === 'paid-vacation') {
      if (emp.vacationBalance - emp.vacationsUsed < 1) {
        showToast("لا يوجد رصيد إجازات كافٍ للموظف!", "danger");
        return;
      }
      emp.vacationsUsed++;
      store.attendance.push({
        id: "att-" + Date.now(),
        employeeId: employeeId,
        date: todayStr,
        checkInTime: "--:--",
        checkOutTime: "--:--",
        status: "Paid Vacation",
        workedHours: 8.0,
        snoozeHours: 0.0,
        isCheckedOut: true
      });
      showToast(`تم تسجيل إجازة مدفوعة اليوم للموظف ${emp.name}`, "success");
    } else {
      store.attendance.push({
        id: "att-" + Date.now(),
        employeeId: employeeId,
        date: todayStr,
        checkInTime: "--:--",
        checkOutTime: "--:--",
        status: "Absent",
        workedHours: 0.0,
        snoozeHours: 0.0,
        isCheckedOut: true
      });
      showToast(`تم تسجيل غياب (غير مدفوع الأجر) للموظف ${emp.name}`, "warning");
    }
  }
  
  store.save();
  syncToGoogleSheets(type === 'paid-vacation' ? "إجازة مدفوعة الأجر" : "غياب غير مدفوع الأجر", employeeId, type === 'paid-vacation' ? "تم تسجيل إجازة مدفوعة الأجر تخصم من الرصيد" : "تم تسجيل يوم غياب بدون أجر", type === 'paid-vacation' ? 8.0 : 0.0, 0.0);
  renderApp();
}

function updateVacationBalance(employeeId, val) {
  const emp = store.employees.find(e => e.id === employeeId);
  if (!emp) return;
  
  emp.vacationBalance = Math.max(0, parseInt(val));
  store.save();
  showToast(`تم تعديل رصيد الإجازات للموظف ${emp.name} إلى ${emp.vacationBalance} أيام.`, "success");
  renderApp();
}

// ----------------------------------------------------
// 9. Countdown Visual Timer UI Handler
// ----------------------------------------------------
let visualCountdownInterval = null;

function startVisualCountdown(employeeId) {
  const activeCheck = store.activeChecks[employeeId];
  if (!activeCheck) return;
  
  // Show UI popup
  const overlay = document.getElementById('presence-popup-overlay');
  overlay.classList.remove('hidden');
  
  // Play repetitive alert chime
  playTone('alert');
  
  const circle = document.getElementById('countdown-circle');
  const textSecs = document.getElementById('countdown-seconds');
  const footerSecs = document.getElementById('countdown-text-secs');
  
  const totalDuration = 10000; // 10 real seconds
  const strokeDashOffsetVal = 282.7; // Circle length
  
  if (visualCountdownInterval) clearInterval(visualCountdownInterval);
  
  visualCountdownInterval = setInterval(() => {
    const timeLeft = activeCheck.realExpiryTime - Date.now();
    
    if (timeLeft <= 0) {
      clearInterval(visualCountdownInterval);
      hidePresenceModal();
      return;
    }
    
    const elapsedPercent = (totalDuration - timeLeft) / totalDuration;
    const currentOffset = strokeDashOffsetVal * elapsedPercent;
    
    circle.style.strokeDashoffset = currentOffset;
    
    const formattedSecs = (timeLeft / 1000).toFixed(1);
    textSecs.innerText = formattedSecs;
    footerSecs.innerText = Math.ceil(timeLeft / 1000);
  }, 100);
}

function hidePresenceModal() {
  if (visualCountdownInterval) clearInterval(visualCountdownInterval);
  const overlay = document.getElementById('presence-popup-overlay');
  overlay.classList.add('hidden');
}

// ----------------------------------------------------
// 10. Dynamic Render Layouts
// ----------------------------------------------------

function renderApp() {
  // Update header badges
  const roleBadge = document.getElementById('app-role-badge');
  const appTitle = document.getElementById('app-title');
  const headerAvatar = document.getElementById('header-avatar');
  
  if (store.currentRole === 'admin') {
    roleBadge.innerText = "مدير النظام (Admin)";
    roleBadge.style.borderColor = "var(--secondary)";
    roleBadge.style.color = "var(--secondary)";
    appTitle.innerText = "لوحة تحكم المدير";
    headerAvatar.innerText = "AD";
    
    document.getElementById('view-admin').classList.remove('hidden');
    document.getElementById('view-employee').classList.add('hidden');
    document.getElementById('employee-selector-group').classList.add('hidden');
    
    renderAdminDashboard();
  } else {
    const emp = store.employees.find(e => e.id === store.currentEmployeeId);
    roleBadge.innerText = "موظف ريموتلي";
    roleBadge.style.borderColor = "var(--primary)";
    roleBadge.style.color = "var(--text-main)";
    appTitle.innerText = emp ? emp.name : "بوابة الموظف";
    headerAvatar.innerText = emp ? emp.avatar : "EE";
    
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('view-employee').classList.remove('hidden');
    document.getElementById('employee-selector-group').classList.remove('hidden');
    
    renderEmployeeDashboard();
  }
  
  // Render employee dropdown in top simulator bar
  renderEmployeeSelectors();
  
  // Keep check overlay open if currently impersonated employee has an active check
  const activeCheck = store.activeChecks[store.currentEmployeeId];
  if (store.currentRole === 'employee' && activeCheck) {
    startVisualCountdown(store.currentEmployeeId);
  } else {
    hidePresenceModal();
  }
}

function renderEmployeeSelectors() {
  const select = document.getElementById('active-employee-select');
  select.innerHTML = '';
  
  store.employees.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.innerText = emp.name;
    if (emp.id === store.currentEmployeeId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function renderEmployeeDashboard() {
  const empId = store.currentEmployeeId;
  const emp = store.employees.find(e => e.id === empId);
  if (!emp) return;

  const todayStr = getTodayString();
  const log = store.attendance.find(a => a.employeeId === empId && a.date === todayStr);

  // 1. Update Status Badge Card
  const empPulse = document.getElementById('emp-pulse');
  const empStatusText = document.getElementById('emp-status-text');
  const empShiftText = document.getElementById('emp-shift-text');
  const checkBtn = document.getElementById('btn-check-action');
  
  empShiftText.innerText = `الدوام: ${emp.startHour} إلى ${emp.endHour}`;

  if (log) {
    if (log.isCheckedOut) {
      empPulse.className = "pulse-indicator offline";
      empStatusText.innerText = "تم تسجيل الانصراف";
      checkBtn.className = "check-btn checkout-state";
      checkBtn.querySelector('.btn-text').innerText = "تم الانتهاء";
      checkBtn.querySelector('.btn-subtext').innerText = log.checkOutTime;
      checkBtn.disabled = true;
      document.getElementById('emp-check-hint').innerText = "تم إغلاق حضور اليوم بنجاح.";
    } else {
      empPulse.className = "pulse-indicator online";
      empStatusText.innerText = log.status === "Late" ? "حاضر (متأخر)" : "حاضر قيد العمل";
      checkBtn.className = "check-btn checkin-state";
      checkBtn.querySelector('.btn-text').innerText = "تسجيل انصراف";
      checkBtn.querySelector('.btn-subtext').innerText = log.checkInTime;
      checkBtn.disabled = false;
      document.getElementById('emp-check-hint').innerText = "اضغط لتسجيل الانصراف وإغلاق ساعات العمل اليوم.";
    }
  } else {
    empPulse.className = "pulse-indicator offline";
    empStatusText.innerText = "غير مسجل حضور";
    checkBtn.className = "check-btn checkout-state";
    checkBtn.querySelector('.btn-text').innerText = "تسجيل حضور";
    checkBtn.querySelector('.btn-subtext').innerText = "ابدأ العمل";
    checkBtn.disabled = false;
    document.getElementById('emp-check-hint').innerText = "اضغط لتسجيل الحضور وبدء احتساب ساعات الدوام.";
  }

  // 2. Set stats
  const startParts = emp.startHour.split(':');
  const endParts = emp.endHour.split(':');
  const totalShiftHrs = (parseInt(endParts[0]) + parseInt(endParts[1])/60) - (parseInt(startParts[0]) + parseInt(startParts[1])/60);
  
  document.getElementById('emp-stat-required').innerText = `${totalShiftHrs.toFixed(1)} س`;
  
  updateEmployeeLiveStats();

  // 3. Render Vacations Balance
  const balance = emp.vacationBalance - emp.vacationsUsed;
  document.getElementById('emp-vacation-balance').innerText = `${balance} / ${emp.vacationBalance} يوم`;
  
  const fillPercent = emp.vacationBalance > 0 ? (balance / emp.vacationBalance) * 100 : 0;
  document.getElementById('emp-vacation-fill').style.width = `${fillPercent}%`;

  // 4. Render Personal Logs List
  const logsContainer = document.getElementById('emp-logs-list');
  logsContainer.innerHTML = '';

  const personalLogs = store.attendance
    .filter(a => a.employeeId === empId)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  if (personalLogs.length === 0) {
    logsContainer.innerHTML = '<div class="empty-state">لا يوجد أي سجلات حضور سابقة.</div>';
  } else {
    personalLogs.forEach(l => {
      const item = document.createElement('div');
      item.className = 'log-item';
      
      let statusBadge = '';
      if (l.status === 'Present') statusBadge = '<span class="log-status-badge present">حاضر</span>';
      if (l.status === 'Late') statusBadge = '<span class="log-status-badge late">متأخر</span>';
      if (l.status === 'Absent') statusBadge = '<span class="log-status-badge absent">غياب</span>';
      if (l.status === 'Paid Vacation') statusBadge = '<span class="log-status-badge vacation-paid">إجازة مدفوعة</span>';
      if (l.status === 'Unpaid Leave') statusBadge = '<span class="log-status-badge absence-unpaid">إجازة غير مدفوعة</span>';
      
      const checkInDisp = l.checkInTime || '--:--';
      const checkOutDisp = l.checkOutTime || '--:--';
      const workedDisp = l.isCheckedOut ? `${l.workedHours} س` : 'قيد العمل...';
      const snoozeDisp = l.snoozeHours > 0 ? `-${l.snoozeHours} س خصم` : 'بدون خصومات';
      
      item.innerHTML = `
        <div class="log-item-header">
          <span class="log-date">${l.date}</span>
          ${statusBadge}
        </div>
        <div class="log-item-details">
          <span>دخول: ${checkInDisp} | خروج: ${checkOutDisp}</span>
          <span class="log-net-hours">الصافي: ${workedDisp} (${snoozeDisp})</span>
        </div>
      `;
      logsContainer.appendChild(item);
    });
  }
}

function updateEmployeeLiveStats() {
  if (store.currentRole !== 'employee') return;
  const empId = store.currentEmployeeId;
  const emp = store.employees.find(e => e.id === empId);
  const todayStr = getTodayString();
  const log = store.attendance.find(a => a.employeeId === empId && a.date === todayStr);

  const workedValEl = document.getElementById('emp-stat-worked');
  const snoozeValEl = document.getElementById('emp-stat-snooze');
  const netValEl = document.getElementById('emp-stat-net');
  const snoozeBox = document.getElementById('emp-snooze-box');

  if (log) {
    snoozeValEl.innerText = `${log.snoozeHours.toFixed(2)} س`;
    if (log.snoozeHours > 0) {
      snoozeBox.classList.add('text-danger');
    } else {
      snoozeBox.classList.remove('text-danger');
    }

    if (log.isCheckedOut) {
      workedValEl.innerText = `${log.workedHours.toFixed(2)} س`;
      netValEl.innerText = `${log.workedHours.toFixed(2)} س`;
    } else {
      // Calculate live dynamic hours based on simulated clock
      const checkInParts = log.checkInTime.split(':');
      const checkInDate = new Date(store.simulatedTime);
      checkInDate.setHours(parseInt(checkInParts[0]), parseInt(checkInParts[1]), 0, 0);

      let elapsedHours = (store.simulatedTime - checkInDate.getTime()) / 3600000;
      if (elapsedHours < 0) elapsedHours = 0;
      
      let netHrs = elapsedHours - log.snoozeHours;
      if (netHrs < 0) netHrs = 0;

      workedValEl.innerText = `${elapsedHours.toFixed(2)} س`;
      netValEl.innerText = `${netHrs.toFixed(2)} س`;
    }
  } else {
    workedValEl.innerText = "0.0 س";
    snoozeValEl.innerText = "0.0 س";
    netValEl.innerText = "0.0 س";
    snoozeBox.classList.remove('text-danger');
  }
}

function renderAdminDashboard() {
  const todayStr = getTodayString();
  
  // 1. Summary Cards
  const totalEmployees = store.employees.length;
  const presentToday = store.attendance.filter(a => a.date === todayStr && !a.isCheckedOut).length;
  const lateToday = store.attendance.filter(a => a.date === todayStr && a.status === 'Late').length;
  const snoozeCount = store.attendance.filter(a => a.date === todayStr && a.snoozeHours > 0).length;
  
  document.getElementById('admin-count-total').innerText = totalEmployees;
  document.getElementById('admin-count-present').innerText = presentToday;
  document.getElementById('admin-count-late').innerText = lateToday;
  document.getElementById('admin-count-snoozed').innerText = snoozeCount;
  
  // Round status display
  const nextIntMin = store.getIntervalMinutes();
  const nextRoundTime = new Date(store.lastRoundTriggerTime + nextIntMin * 60000);
  const pad = (n) => n.toString().padStart(2, '0');
  const targetTimeString = `${pad(nextRoundTime.getHours())}:${pad(nextRoundTime.getMinutes())}`;
  
  let labelText = `الفحص التالي عند ${targetTimeString}`;
  if (store.settings.roundInterval === 'random') {
    labelText += ` (عشوائي: كل ${nextIntMin} د)`;
  } else {
    labelText += ` (كل ${nextIntMin} د)`;
  }
  
  document.getElementById('admin-round-status').innerText = labelText;

  // 2. Render Employees Grid
  const grid = document.getElementById('admin-employee-grid');
  grid.innerHTML = '';

  store.employees.forEach(emp => {
    const card = document.createElement('div');
    card.className = 'admin-emp-card';
    
    // Check status today
    const log = store.attendance.find(a => a.employeeId === emp.id && a.date === todayStr);
    let statusText = '💤 غير نشط';
    let pulseColorClass = 'offline';
    
    if (log) {
      if (log.isCheckedOut) {
        statusText = '🚪 انصرف';
      } else {
        statusText = log.status === 'Late' ? '⚠️ حاضر متأخر' : '🟢 قيد العمل';
        pulseColorClass = 'online';
      }
    }
    
    const balance = emp.vacationBalance - emp.vacationsUsed;
    const hasActiveCheck = store.activeChecks[emp.id] ? 'pulse-indicator online' : 'hidden';
    
    card.innerHTML = `
      <div class="admin-emp-card-header">
        <div class="admin-emp-meta">
          <div class="admin-emp-avatar">${emp.avatar}</div>
          <div class="admin-emp-name-box">
            <span class="admin-emp-name">${emp.name} <span class="${hasActiveCheck}" style="width:6px;height:6px;display:inline-block;" title="فحص معلق"></span></span>
            <span class="admin-emp-shift">الدوام: ${emp.startHour} - ${emp.endHour} | إجازات متبقية: ${balance} يوم</span>
          </div>
        </div>
        <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">${statusText}</span>
      </div>
      
      <div class="admin-emp-actions">
        <button class="btn btn-primary btn-xs btn-alert-emp" data-id="${emp.id}" ${log && !log.isCheckedOut ? '' : 'disabled'} title="طلب إثبات تواجد الآن للموظف">
          🚨 فحص نشاط
        </button>
        <button class="btn btn-warning btn-xs btn-absence-emp" data-id="${emp.id}" title="تسجيل غياب أو إجازة للموظف">
          📅 تسجيل غياب/إجازة
        </button>
        <button class="btn btn-success btn-xs btn-vacation-emp" data-id="${emp.id}" data-balance="${emp.vacationBalance}" title="تعديل رصيد الإجازات السنوي">
          ⚙️ الإجازات (${emp.vacationBalance})
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  // 3. Render History Logs (Admin Panel Tab 2)
  const logsListContainer = document.getElementById('admin-logs-list-container');
  logsListContainer.innerHTML = '';
  
  const filterDateInput = document.getElementById('admin-log-filter-date');
  if (!filterDateInput.value) {
    filterDateInput.value = todayStr;
  }
  const filterDate = filterDateInput.value;
  
  const filteredLogs = store.attendance.filter(a => a.date === filterDate);
  
  if (filteredLogs.length === 0) {
    logsListContainer.innerHTML = '<div class="empty-state">لا يوجد أي سجلات حضور لهذا اليوم.</div>';
  } else {
    filteredLogs.forEach(l => {
      const emp = store.employees.find(e => e.id === l.employeeId);
      if (!emp) return;
      
      const item = document.createElement('div');
      item.className = 'log-item';
      
      let statusBadge = '';
      if (l.status === 'Present') statusBadge = '<span class="log-status-badge present">حاضر</span>';
      if (l.status === 'Late') statusBadge = '<span class="log-status-badge late">متأخر</span>';
      if (l.status === 'Absent') statusBadge = '<span class="log-status-badge absent">غياب</span>';
      if (l.status === 'Paid Vacation') statusBadge = '<span class="log-status-badge vacation-paid">إجازة مدفوعة</span>';
      if (l.status === 'Unpaid Leave') statusBadge = '<span class="log-status-badge absence-unpaid">إجازة غير مدفوعة</span>';
      
      item.innerHTML = `
        <div class="log-item-header">
          <span class="log-date" style="font-weight:700;">${emp.name}</span>
          ${statusBadge}
        </div>
        <div class="log-item-details">
          <span>دخول: ${l.checkInTime} | خروج: ${l.checkOutTime || 'قيد العمل'}</span>
          <span class="log-net-hours">الصافي: ${l.workedHours} س (غفوات: ${l.snoozeHours} س)</span>
        </div>
      `;
      logsListContainer.appendChild(item);
    });
  }
}

// Helper formatting functions
function formatTime(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ----------------------------------------------------
// 11. Event Binding & UI Initial Setup
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Security State & Variables
  let lastAuthorizedRole = store.currentRole;
  let lastAuthorizedEmployeeId = store.currentEmployeeId;
  let pendingRoleChange = null;

  const roleSelect = document.getElementById('role-select');
  roleSelect.value = store.currentRole;
  
  const empSelect = document.getElementById('active-employee-select');
  empSelect.value = store.currentEmployeeId;

  // Intercept role changes for authentication
  roleSelect.addEventListener('change', (e) => {
    const targetRole = e.target.value;
    if (targetRole === 'admin') {
      showLoginModal("admin", null);
    } else {
      const selectedEmpId = empSelect.value;
      showLoginModal("employee", selectedEmpId);
    }
  });

  empSelect.addEventListener('change', (e) => {
    const selectedEmpId = e.target.value;
    showLoginModal("employee", selectedEmpId);
  });

  // Login Modal Handling functions
  function showLoginModal(role, employeeId) {
    pendingRoleChange = { role, employeeId };
    
    // Customize text
    const titleEl = document.getElementById('login-title');
    const subtitleEl = document.getElementById('login-subtitle');
    const passInput = document.getElementById('login-password-input');
    
    passInput.value = '';
    
    if (role === 'admin') {
      titleEl.innerText = "🔐 تسجيل دخول المدير (Admin)";
      subtitleEl.innerText = "يرجى إدخال كلمة مرور الإدارة للمتابعة";
    } else {
      const emp = store.employees.find(e => e.id === employeeId);
      const empName = emp ? emp.name : "الموظف";
      titleEl.innerText = `🔐 دخول الموظف: ${empName}`;
      subtitleEl.innerText = "يرجى إدخال كلمة المرور الفريدة الخاصة بك";
    }
    
    document.getElementById('login-popup-overlay').classList.remove('hidden');
    
    // Temporarily reset select boxes visual selection until authorized
    roleSelect.value = lastAuthorizedRole;
    empSelect.value = lastAuthorizedEmployeeId;
    
    passInput.focus();
  }

  function hideLoginModal() {
    document.getElementById('login-popup-overlay').classList.add('hidden');
    document.getElementById('login-password-input').value = '';
    pendingRoleChange = null;
  }

  // Bind Login Buttons
  document.getElementById('btn-login-cancel').addEventListener('click', () => {
    hideLoginModal();
    // Keep visual selectors unchanged
    roleSelect.value = lastAuthorizedRole;
    empSelect.value = lastAuthorizedEmployeeId;
  });

  document.getElementById('btn-login-submit').addEventListener('click', () => {
    processLogin();
  });

  // Enter key press in password input triggers login
  document.getElementById('login-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      processLogin();
    }
  });

  function processLogin() {
    const enteredPass = document.getElementById('login-password-input').value.trim();
    
    if (!pendingRoleChange) return;

    if (pendingRoleChange.role === 'admin') {
      if (enteredPass === '123456789') {
        store.currentRole = 'admin';
        store.save();
        lastAuthorizedRole = 'admin';
        
        // Update visual select
        roleSelect.value = 'admin';
        
        showToast("مرحباً بك يا مدير النظام! تم الدخول بنجاح.", "success");
        playTone('success');
        hideLoginModal();
        renderApp();
      } else {
        showToast("رمز مرور الإدارة غير صحيح! حاول مجدداً.", "danger");
        playTone('danger');
      }
    } else {
      const emp = store.employees.find(e => e.id === pendingRoleChange.employeeId);
      if (emp && enteredPass === emp.password) {
        store.currentRole = 'employee';
        store.currentEmployeeId = pendingRoleChange.employeeId;
        store.save();
        
        lastAuthorizedRole = 'employee';
        lastAuthorizedEmployeeId = pendingRoleChange.employeeId;
        
        // Update visual selects
        roleSelect.value = 'employee';
        empSelect.value = pendingRoleChange.employeeId;
        
        showToast(`مرحباً بك ${emp.name}! تم تسجيل الدخول بنجاح.`, "success");
        playTone('success');
        hideLoginModal();
        renderApp();
      } else {
        showToast("كلمة مرور الموظف غير صحيحة! حاول مجدداً.", "danger");
        playTone('danger');
      }
    }
  }

  // Time speed simulation binding
  document.getElementById('btn-speed-normal').addEventListener('click', (e) => {
    store.simTimeSpeed = 1;
    setActiveSpeedBtn('btn-speed-normal');
    store.save();
  });
  document.getElementById('btn-speed-fast').addEventListener('click', (e) => {
    store.simTimeSpeed = 60; // 1s real = 1m sim
    setActiveSpeedBtn('btn-speed-fast');
    store.save();
  });
  document.getElementById('btn-speed-warp').addEventListener('click', (e) => {
    store.simTimeSpeed = 300; // 1s real = 5m sim
    setActiveSpeedBtn('btn-speed-warp');
    store.save();
  });
  
  function setActiveSpeedBtn(id) {
    document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
  
  // Set the active button initially based on loaded speed
  if (store.simTimeSpeed === 60) setActiveSpeedBtn('btn-speed-fast');
  else if (store.simTimeSpeed === 300) setActiveSpeedBtn('btn-speed-warp');
  else setActiveSpeedBtn('btn-speed-normal');

  // Jump Time buttons
  document.getElementById('btn-jump-10m').addEventListener('click', () => {
    store.simulatedTime += 10 * 60 * 1000; // Add 10 mins
    updateClocks();
    processAutoCheckOutCheck();
    processRoundCheckTrigger();
    store.save();
    showToast("تم قفز الوقت لـ 10 دقائق للأمام.", "info");
    renderApp();
  });

  document.getElementById('btn-jump-to-checkout').addEventListener('click', () => {
    // Jump straight to 5:00 PM (17:00) today
    const now = new Date(store.simulatedTime);
    now.setHours(17, 0, 0, 0);
    store.simulatedTime = now.getTime();
    updateClocks();
    processAutoCheckOutCheck();
    processRoundCheckTrigger();
    store.save();
    showToast("تم قفز الوقت لـ 5:00 مساءً.", "info");
    renderApp();
  });

  // Employee Check-In / Out Button
  document.getElementById('btn-check-action').addEventListener('click', () => {
    const empId = store.currentEmployeeId;
    const todayStr = getTodayString();
    const log = store.attendance.find(a => a.employeeId === empId && a.date === todayStr);

    if (!log) {
      checkIn(empId);
    } else if (!log.isCheckedOut) {
      checkOut(empId);
    }
  });

  // Presence Confirmation button inside popup modal
  document.getElementById('btn-presence-confirm').addEventListener('click', () => {
    confirmPresence(store.currentEmployeeId);
  });

  // Admin round interval select
  const roundIntervalSelect = document.getElementById('admin-round-interval');
  roundIntervalSelect.value = store.settings.roundInterval;
  roundIntervalSelect.addEventListener('change', (e) => {
    store.settings.roundInterval = e.target.value;
    store.save();
    showToast("تم تعديل فترات الفحص الدورية.", "success");
    renderApp();
  });

  // Admin trigger round now
  document.getElementById('btn-trigger-round-now').addEventListener('click', () => {
    triggerGroupRound();
  });

  // Admin Tabs switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active-content'));
      
      e.target.classList.add('active');
      const targetId = e.target.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active-content');
      
      if (targetId === 'admin-panel-logs') {
        renderAdminDashboard(); // Refresh logs tab date filter
      }
    });
  });

  // Admin Logs Date Filter
  document.getElementById('admin-log-filter-date').addEventListener('change', () => {
    renderAdminDashboard();
  });

  // Admin form add employee
  document.getElementById('add-employee-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-emp-name').value;
    const email = document.getElementById('new-emp-email').value;
    const start = document.getElementById('new-emp-start').value;
    const end = document.getElementById('new-emp-end').value;
    const vacation = document.getElementById('new-emp-vacation').value;
    const password = document.getElementById('new-emp-password').value;
    
    addEmployee(name, email, start, end, vacation, password);
    
    // Reset form & go back to employees tab
    e.target.reset();
    document.querySelector('.admin-tab-btn[data-target="admin-panel-employees"]').click();
  });

  // Delegate clicks on dynamic employee lists in Admin view
  document.getElementById('admin-employee-grid').addEventListener('click', (e) => {
    const target = e.target;
    const empId = target.getAttribute('data-id');
    if (!empId) return;

    if (target.classList.contains('btn-alert-emp')) {
      // Alert employee manual popup
      createPresenceCheck(empId, 'manual');
      showToast(`تم إرسال تنبيه إثبات الحضور للموظف بنجاح.`, "success");
    } else if (target.classList.contains('btn-absence-emp')) {
      // Absence dialog
      const type = confirm("هل تريد تسجيل غياب بإجازة مدفوعة الأجر؟ (اضغط Cancel لتسجيل غياب بدون أجر)") ? 'paid-vacation' : 'unpaid-leave';
      recordAbsence(empId, type);
    } else if (target.classList.contains('btn-vacation-emp')) {
      // Vacation modify
      const currentVal = target.getAttribute('data-balance');
      const val = prompt("أدخل رصيد الإجازات السنوي الجديد للموظف:", currentVal);
      if (val !== null && val !== "") {
        updateVacationBalance(empId, val);
      }
    }
  });

  // Google Sheets integration bindings
  const sheetsUrlInput = document.getElementById('admin-sheets-url');
  if (sheetsUrlInput) {
    sheetsUrlInput.value = store.settings.googleSheetsUrl || '';
  }
  
  document.getElementById('btn-save-sheets-url').addEventListener('click', () => {
    const urlInput = document.getElementById('admin-sheets-url').value.trim();
    store.settings.googleSheetsUrl = urlInput;
    store.save();
    showToast("تم حفظ رابط Google Sheets بنجاح!", "success");
    playTone('success');
    
    if (urlInput) {
      showToast("جاري إرسال فحص اتصال تجريبي للمزامنة...", "info");
      syncToGoogleSheets("فحص اتصال تجريبي (Connection-Test)", "emp-1", "فحص توافق النظام والربط مع جوجل شيت", 0, 0);
    }
  });

  // Start the timers
  startSimulatedTime();
  renderApp();
});
