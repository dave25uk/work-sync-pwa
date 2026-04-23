import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONFIGURATION ---
const ANCHOR_DATE = new Date("2026-04-02T12:00:00");
const PATTERN = [
    "Dave Work (M)", "Dave Work (M)", "Dave Work (M)", 
    "Dave Work (A)", "Dave Work (A)", "Dave Work (A)", 
    null, null, null
];

const SHIFTS = [
    'Dave Work (M)', 'Dave Work (A)', 'Dave Work (D1)', 
    'Dave Work (D4)', 'Dave Work (A1)', 'Dave Work (A2)', 
    'Dave Work (M1)', 'Annual Leave', 'Off'
];

// State
let currentViewDate = new Date(2026, 3, 1);
const calendarEl = document.getElementById('calendar');
const monthLabel = document.getElementById('currentMonthLabel');
const picker = document.getElementById('shiftPicker');
const optionsGrid = document.getElementById('optionsGrid');

// Helper: Calculate 9-day pattern
function getPatternShift(dateString) {
    const target = new Date(dateString + "T12:00:00");
    const diffTime = target - ANCHOR_DATE;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const index = ((diffDays % 9) + 9) % 9;
    return PATTERN[index];
}

function formatShiftDisplay(fullTitle) {
    if (!fullTitle || fullTitle === 'Off' || fullTitle === '-') return '-';
    if (fullTitle === 'Annual Leave') return '🌴';
    const match = fullTitle.match(/\((.*?)\)/);
    return match ? match[1] : fullTitle;
}

// 1. Initialize Calendar
async function initCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); 
    const startingPoint = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    calendarEl.innerHTML = '';
    for (let x = 0; x < startingPoint; x++) {
        calendarEl.appendChild(document.createElement('div'));
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const patternShift = getPatternShift(dateKey);
        
        const dayCard = document.createElement('div');
        dayCard.className = "day-card bg-white border border-slate-200 rounded-xl p-1.5 min-h-[85px] flex flex-col justify-between cursor-pointer active:bg-slate-50";
        dayCard.innerHTML = `
            <span class="text-[10px] font-bold text-slate-400">${i}</span>
            <div class="text-[15px] font-black text-center uppercase opacity-30" id="shift-display-${dateKey}">
                ${formatShiftDisplay(patternShift)}
            </div>
        `;
        dayCard.onclick = () => openPicker(year, month, i);
        calendarEl.appendChild(dayCard);
    }
    loadOverrides(year, month);
}

// 2. Load Overrides (Annual Leave, etc)
async function loadOverrides(year, month) {
    const displayMonth = (month + 1).toString().padStart(2, '0');
    const { data } = await supabase
        .from('shift_overrides')
        .select('*')
        .ilike('shift_date', `${year}-${displayMonth}-%`);

    if (data) {
        data.forEach(entry => {
            const el = document.getElementById(`shift-display-${entry.shift_date}`);
            if (el) {
                el.innerText = formatShiftDisplay(entry.shift_name);
                el.classList.remove('opacity-30'); 
                el.classList.add('text-blue-600'); 
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
            await saveOverride(formattedDate, shift);
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

// 4. Save Overrides
async function saveOverride(dateKey, shiftName) {
    if (shiftName === 'Off') {
        await supabase.from('shift_overrides').delete().eq('shift_date', dateKey);
    } else {
        await supabase.from('shift_overrides').upsert({ shift_date: dateKey, shift_name: shiftName });
    }
    initCalendar(currentViewDate);
}

// 5. Navigation & Sync
document.getElementById('prevMonth').onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    initCalendar(currentViewDate);
};

document.getElementById('nextMonth').onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    initCalendar(currentViewDate);
};

document.getElementById('closePickerBtn').onclick = closePicker;

document.getElementById('fetchBtn').innerText = "Sync to iCloud";
document.getElementById('fetchBtn').onclick = async () => {
    const fetchBtn = document.getElementById('fetchBtn');
    const originalText = fetchBtn.innerText;
    fetchBtn.innerText = 'Syncing iCloud...';
    fetchBtn.disabled = true;

    try {
        const { data, error } = await supabase.functions.invoke('sync-to-icloud', {
            body: { 
                year: currentViewDate.getFullYear(), 
                month: currentViewDate.getMonth() 
            }
        });

        if (error) throw error;
        alert('iCloud Updated Successfully!');
    } catch (err) {
        console.error(err);
        alert('Sync failed. Check console.');
    } finally {
        fetchBtn.innerText = originalText;
        fetchBtn.disabled = false;
    }
};

// Start
initCalendar(currentViewDate);