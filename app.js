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

// 1. Generate the Grid
function initCalendar(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    calendarEl.innerHTML = '';

    for (let i = 1; i <= daysInMonth; i++) {
        const dayCard = document.createElement('div');
        dayCard.className = "day-card bg-white border border-slate-200 rounded-2xl p-2 min-h-[95px] shadow-sm flex flex-col justify-between cursor-pointer active:scale-95 transition-transform";
        dayCard.innerHTML = `
            <span class="text-xs font-bold text-slate-400">${i}</span>
            <div class="text-[14px] font-black text-blue-600 text-center leading-tight" id="shift-display-${i}">-</div>
        `;
        dayCard.onclick = () => openPicker(i);
        calendarEl.appendChild(dayCard);
    }
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

document.getElementById('fetchBtn').onclick = fetchShifts;