import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// This tells the app to look for the keys in the environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only initialize if the keys exist
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

// 1. Generate the Grid
function initCalendar(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    calendarEl.innerHTML = '';

    for (let i = 1; i <= daysInMonth; i++) {
        const dayCard = document.createElement('div');
        dayCard.className = "day-card bg-white border border-slate-200 rounded-2xl p-2 min-h-[95px] shadow-sm flex flex-col justify-between cursor-pointer";
        dayCard.innerHTML = `
            <span class="text-xs font-bold text-slate-400">${i}</span>
            <div class="text-[11px] font-extrabold text-blue-600 leading-tight" id="shift-display-${i}">-</div>
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
        btn.className = "bg-slate-50 border border-slate-100 py-4 px-2 rounded-xl text-xs font-bold text-slate-700 active:bg-blue-600 active:text-white transition-all";
        btn.innerText = shift;
        btn.onclick = async () => {
    // 1. Update the UI immediately for that "snappy" feel
    document.getElementById(`shift-display-${day}`).innerText = shift;
    
    // 2. Prepare the date string (YYYY-MM-DD)
    const formattedDate = `2026-04-${day.toString().padStart(2, '0')}`;

    // 3. Save to Supabase (UPSERT handles both new entries and updates)
    const { error } = await supabase
        .from('confirmed_shifts')
        .upsert({ 
            shift_date: formattedDate, 
            shift_name: shift 
        });

    if (error) {
        console.error('Error saving shift:', error);
        alert('Failed to save to database');
    }

    closePicker();
};
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

// Start for April 2026
initCalendar(2026, 3);