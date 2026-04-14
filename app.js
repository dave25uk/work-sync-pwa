import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let currentViewDate = new Date(2026, 3, 1); // Starts at April 2026

const SHIFTS = [
    'Dave Work (M)', 'Dave Work (A)', 'Dave Work (D1)', 
    'Dave Work (D4)', 'Dave Work (A1)', 'Dave Work (A2)', 
    'Dave Work (M1)', 'Annual Leave', 'Off'
];

const calendarEl = document.getElementById('calendar');
const picker = document.getElementById('shiftPicker');
const optionsGrid = document.getElementById('optionsGrid');
const monthLabel = document.getElementById('currentMonthLabel');

// Helper: Format for Display (Shorthand, no brackets)
function formatShiftDisplay(fullTitle) {
    if (!fullTitle || fullTitle === '-' || fullTitle === 'Off') return '-';
    if (fullTitle === 'Annual Leave') return '🌴';
    if (fullTitle.toLowerCase().includes("overtime")) return "OT";
    const match = fullTitle.match(/\((.*?)\)/);
    return match ? match[1] : fullTitle;
}

// 1. Initialize/Render Calendar
async function initCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Update Header Label
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    monthLabel.innerText = `${monthNames[month]} ${year}`;

    // Logic for Monday Start
    const firstDay = new Date(year, month, 1).getDay(); 
    const startingPoint = firstDay === 0 ? 6 : firstDay - 1; // Shifts Sunday to the end
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    calendarEl.innerHTML = '';

    // Add empty spacers for the start of the month
    for (let x = 0; x < startingPoint; x++) {
        const spacer = document.createElement('div');
        spacer.className = "min-h-[80px]"; 
        calendarEl.appendChild(spacer);
    }

    // Generate Day Cards
    for (let i = 1; i <= daysInMonth; i++) {
        const dayCard = document.createElement('div');
        const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        
        dayCard.className = "day-card bg-white border border-slate-200 rounded-xl p-1.5 min-h-[85px] shadow-sm flex flex-col justify-between cursor-pointer active:scale-95 transition-all";
        dayCard.innerHTML = `
            <span class="text-[10px] font-bold text-slate-400">${i}</span>
			<div class="text-[15px] font-black text-center uppercase transition-colors duration-300" id="shift-display-${dateKey}">-</div>	
        `;
        dayCard.onclick = () => openPicker(year, month, i);
        calendarEl.appendChild(dayCard);
    }

    // After rendering the grid, pull existing data from Supabase
    loadShiftsFromDB(year, month);
}

// 2. Load Existing Shifts from Supabase
async function loadShiftsFromDB(year, month) {
    const firstDay = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
    // Get last day of month
    const lastDay = `${year}-${(month + 1).toString().padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
    
    console.log(`Fetching range: ${firstDay} to ${lastDay}`);

    const { data, error } = await supabase
        .from('confirmed_shifts') // Double-check this matches your table name exactly
        .select('*')
        .gte('shift_date', firstDay)
        .lte('shift_date', lastDay);

    if (error) {
        console.error("Database fetch error:", error.message, error.details);
        return;
    }

    if (data) {
        console.log(`Successfully loaded ${data.length} shifts.`);
        data.forEach(entry => {
    const displayEl = document.getElementById(`shift-display-${entry.shift_date}`);
    if (displayEl) {
        const shortName = formatShiftDisplay(entry.shift_name);
        displayEl.innerText = shortName;

        // Apply colors based on the shift
        if (shortName === 'M') displayEl.className = "text-[15px] font-black text-center text-orange-500";
        else if (shortName === 'A') displayEl.className = "text-[15px] font-black text-center text-blue-500";
        else if (shortName === 'N') displayEl.className = "text-[15px] font-black text-center text-purple-600";
        else if (shortName === 'OT') displayEl.className = "text-[15px] font-black text-center text-emerald-600";
        else if (shortName === '🌴') displayEl.className = "text-[15px] font-black text-center text-rose-500";
    }
});
}

// 3. Picker Logic
function openPicker(year, month, day) {
    const formattedDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    document.getElementById('selectedDateLabel').innerText = formattedDate;
    optionsGrid.innerHTML = '';

    SHIFTS.forEach(shift => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-50 border border-slate-100 py-4 px-2 rounded-xl text-[10px] font-bold text-slate-700 active:bg-blue-600 active:text-white transition-all";
        btn.innerText = shift;
        btn.onclick = async () => {
            document.getElementById(`shift-display-${formattedDate}`).innerText = formatShiftDisplay(shift);
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

// 4. Navigation & Fetch Listeners
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
        // Refresh the current view to show new shifts
        initCalendar(currentViewDate);
        alert('Sync Complete!');
    } catch (err) {
        alert('Sync Error');
    } finally {
        fetchBtn.innerText = 'Fetch Shifts';
    }
};

// Initial Render
initCalendar(currentViewDate);