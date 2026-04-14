import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Supabase credentials missing!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Shift configuration
const SHIFTS = [
    'Dave Work (M)', 'Dave Work (A)', 'Dave Work (D1)', 
    'Dave Work (D4)', 'Dave Work (A1)', 'Dave Work (A2)', 
    'Dave Work (M1)', 'Annual Leave', 'Off'
];

const calendarEl = document.getElementById('calendar');
const picker = document.getElementById('shiftPicker');
const optionsGrid = document.getElementById('optionsGrid');

// --- Updated: Helper to format text for display ONLY ---
function formatShiftDisplay(fullTitle) {
    if (!fullTitle || fullTitle === '-' || fullTitle === 'Off') return fullTitle;
    
    // 1. Handle Annual Leave with a clean icon or text
    if (fullTitle === 'Annual Leave') return 'PALM'; 
    
    // 2. Check for Overtime
    if (fullTitle.toLowerCase().includes("overtime")) return "OT";
    
    // 3. Extract text inside brackets: "Dave Work (M)" -> "M"
    // The [1] pulls the first "capture group" (the text between the brackets)
    const match = fullTitle.match(/\((.*?)\)/);
    return match ? match[1] : fullTitle;
}


// 2. Shift Picker Logic
function openPicker(day) {
    document.getElementById('selectedDateLabel').innerText = `April ${day}, 2026`;
    optionsGrid.innerHTML = '';

    SHIFTS.forEach(shift => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-50 border border-slate-100 py-4 px-2 rounded-xl text-[10px] font-bold text-slate-700 active:bg-blue-600 active:text-white transition-all";
        btn.innerText = shift; // Buttons still show full name for clarity
        btn.onclick = async () => {
            // UI shows the SHORT version
            document.getElementById(`shift-display-${day}`).innerText = formatShiftDisplay(shift);
            
            // Database saves the FULL version
            saveShiftToDatabase(day, shift);
            closePicker();
        };
        optionsGrid.appendChild(btn);
    });

    picker.classList.remove('hidden');
    picker.classList.add('flex');
}

function closePicker() {
    picker.classList.add('hidden');
    picker.classList.remove('flex');
}

// 3. Event Listeners
document.getElementById('closePickerBtn').onclick = closePicker;

// Start for 1st April 2026
initCalendar(2026, 3);

async function fetchShifts() {
    const fetchBtn = document.getElementById('fetchBtn');
    fetchBtn.innerText = 'Syncing...';
    fetchBtn.disabled = true;

    try {
        const { data, error } = await supabase.functions.invoke('get-icloud-shifts');
        if (error) throw error;

        data.forEach(shift => {
            const dayNumber = new Date(shift.start).getDate();
            const displayEl = document.getElementById(`shift-display-${dayNumber}`);
            if (displayEl) {
                // UI gets short name
                displayEl.innerText = formatShiftDisplay(shift.title);
                // DB gets full name
                saveShiftToDatabase(dayNumber, shift.title);
            }
        });

        alert('Shifts synced and saved to DaveSync!');
    } catch (err) {
        console.error('Fetch error:', err);
        alert('Could not sync calendar.');
    } finally {
        fetchBtn.innerText = 'Fetch Shifts';
        fetchBtn.disabled = false;
    }
}

async function saveShiftToDatabase(day, shiftName) {
    const formattedDate = `2026-04-${day.toString().padStart(2, '0')}`;
    const { error } = await supabase.from('confirmed_shifts').upsert({ 
        shift_date: formattedDate, 
        shift_name: shiftName 
    });
    if (error) console.error("DB Save Error:", error);
}

let currentViewDate = new Date(2026, 3, 1); // Start at April 2026

function initCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Update Label
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    document.getElementById('currentMonthLabel').innerText = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    // Adjust for Monday start (JS days are 0=Sun, 1=Mon... so we convert)
    const startingPoint = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    calendarEl.innerHTML = '';

    // 1. Fill empty slots for previous month days
    for (let x = 0; x < startingPoint; x++) {
        const spacer = document.createElement('div');
        spacer.className = "min-h-[95px]"; // match card height
        calendarEl.appendChild(spacer);
    }

    // 2. Generate actual day cards
    for (let i = 1; i <= daysInMonth; i++) {
        const dayCard = document.createElement('div');
        dayCard.className = "day-card bg-white border border-slate-200 rounded-xl p-1 min-h-[95px] shadow-sm flex flex-col justify-between cursor-pointer active:scale-95 transition-transform";
        
        // Prepare the unique ID for this specific date
        const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        
        dayCard.innerHTML = `
            <span class="text-[10px] font-bold text-slate-400">${i}</span>
            <div class="text-[15px] font-black text-blue-600 text-center uppercase" id="shift-display-${dateKey}">-</div>
        `;
        dayCard.onclick = () => openPicker(year, month, i);
        calendarEl.appendChild(dayCard);
    }
    
    // 3. Re-fetch from DB for the new month view
    loadMonthFromDB(year, month);
}

// Navigation Listeners
document.getElementById('prevMonth').onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    initCalendar(currentViewDate);
};

document.getElementById('nextMonth').onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    initCalendar(currentViewDate);
};

// Initial Load
initCalendar(currentViewDate);

document.getElementById('fetchBtn').onclick = fetchShifts;