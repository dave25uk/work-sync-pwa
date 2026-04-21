import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let currentViewDate = new Date(2026, 3, 1); 

const SHIFTS = [
    'Dave Work (M)', 'Dave Work (A)', 'Dave Work (D1)', 
    'Dave Work (D4)', 'Dave Work (A1)', 'Dave Work (A2)', 
    'Dave Work (M1)', 'Annual Leave', 'Off'
];

const calendarEl = document.getElementById('calendar');
const picker = document.getElementById('shiftPicker');
const optionsGrid = document.getElementById('optionsGrid');
const monthLabel = document.getElementById('currentMonthLabel');

// Helper: Format for Display
function formatShiftDisplay(fullTitle) {
    if (!fullTitle || fullTitle === '-' || fullTitle === 'Off') return '-';
    if (fullTitle === 'Annual Leave') return '🌴';
    if (fullTitle.toLowerCase().includes("overtime")) return "OT";
    const match = fullTitle.match(/\((.*?)\)/);
    return match ? match[1] : fullTitle;
}

// 1. Initialize Calendar Grid
async function initCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); 
    const startingPoint = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    calendarEl.innerHTML = '';

    for (let x = 0; x < startingPoint; x++) {
        const spacer = document.createElement('div');
        spacer.className = "min-h-[85px]"; 
        calendarEl.appendChild(spacer);
    }

for (let i = 1; i <= daysInMonth; i++) {
    const dayCard = document.createElement('div');
    
    // Construct the dateKey: Month + 1 because JS months are 0-indexed
    const y = year;
    const m = (month + 1).toString().padStart(2, '0');
    const d = i.toString().padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`; 

    dayCard.innerHTML = `
        <span class="text-[10px] font-bold text-slate-400">${i}</span>
        <div class="text-[15px] font-black text-center uppercase" id="shift-display-${dateKey}">-</div>
    `;
	dayCard.onclick = () => openPicker(year, month, i);
        calendarEl.appendChild(dayCard);
    }
    loadShiftsFromDB(year, month);
}

// 2. Load Existing Shifts
async function loadShiftsFromDB(year, month) {
    // Ensure we are searching for "2026-04" not "2026-03"
    const displayMonth = (month + 1).toString().padStart(2, '0');
    const firstDay = `${year}-${displayMonth}-01`;
    const lastDay = `${year}-${displayMonth}-${new Date(year, month + 1, 0).getDate()}`;
    
    const { data, error } = await supabase
        .from('confirmed_shifts')
        .select('*')
        .gte('shift_date', firstDay)
        .lte('shift_date', lastDay);

    if (error) return;

    if (data) {
        data.forEach(entry => {
            const displayEl = document.getElementById(`shift-display-${entry.shift_date}`);
            if (displayEl) {
                const shortName = formatShiftDisplay(entry.shift_name);
                displayEl.innerText = shortName;
                displayEl.classList.remove('text-blue-600', 'text-orange-500', 'text-blue-500', 'text-purple-600', 'text-emerald-600', 'text-rose-500');
                if (shortName === 'M' || shortName === 'M1') displayEl.classList.add('text-orange-500');
                else if (shortName === 'A' || shortName === 'A1' || shortName === 'A2') displayEl.classList.add('text-blue-500');
                else if (shortName === 'N') displayEl.classList.add('text-purple-600');
                else if (shortName === 'OT') displayEl.classList.add('text-emerald-600');
                else if (shortName === '🌴') displayEl.classList.add('text-rose-500');
            }
        });
    }
}

// 3. Picker Logic
function openPicker(year, month, day) {
    const formattedDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    document.getElementById('selectedDateLabel').innerText = `Shift for ${day}/${month + 1}/${year}`;
    optionsGrid.innerHTML = '';

    SHIFTS.forEach(shift => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-50 border border-slate-100 py-4 px-2 rounded-xl text-[10px] font-bold text-slate-700 active:bg-blue-600 active:text-white transition-all";
        btn.innerText = shift;
        btn.onclick = async () => {
            const displayEl = document.getElementById(`shift-display-${formattedDate}`);
            if (displayEl) displayEl.innerText = formatShiftDisplay(shift);
            await saveShiftToDatabase(formattedDate, shift);
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

async function saveShiftToDatabase(dateKey, shiftName) {
    await supabase.from('confirmed_shifts').upsert({ 
        shift_date: dateKey, 
        shift_name: shiftName 
    });
}

// 4. Navigation & Fetch
document.getElementById('prevMonth').onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    initCalendar(currentViewDate);
};

document.getElementById('nextMonth').onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    initCalendar(currentViewDate);
};

document.getElementById('closePickerBtn').onclick = closePicker;

document.getElementById('fetchBtn').onclick = async () => {
    const fetchBtn = document.getElementById('fetchBtn');
    fetchBtn.innerText = 'Syncing...';
    try {
        const { data, error } = await supabase.functions.invoke('get-icloud-shifts');
        if (error) throw error;

        // 1. CLEAR existing data for the current month range to remove "Ghost" shifts
        const year = currentViewDate.getFullYear();
        const month = (currentViewDate.getMonth() + 1).toString().padStart(2, '0');
        const { error: delError } = await supabase
            .from('confirmed_shifts')
            .delete()
            .ilike('shift_date', `${year}-${month}-%`); // Deletes all shifts for this month

        if (delError) console.error("Cleanup error:", delError);

        // 2. SAVE the fresh data from iCloud
        if (data && data.length > 0) {
            for (const shift of data) {
                await saveShiftToDatabase(shift.start.split('T')[0], shift.title);
            }
        }
        
        initCalendar(currentViewDate);
        alert('Sync Complete! Ghost shifts removed.');
    } catch (err) {
        alert('Sync Error');
    } finally {
        fetchBtn.innerText = 'Fetch Shifts';
    }
};

// Initial Start
initCalendar(currentViewDate);