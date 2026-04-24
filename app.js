import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ANCHOR_DATE = new Date("2026-04-02T12:00:00");
const PATTERN = ["Dave Work (M)", "Dave Work (M)", "Dave Work (M)", "Dave Work (A)", "Dave Work (A)", "Dave Work (A)", null, null, null];
const SHIFTS = ['Dave Work (M)', 'Dave Work (A)', 'Dave Work (D1)', 'Dave Work (D4)', 'Dave Work (A1)', 'Dave Work (A2)', 'Dave Work (M1)', 'Annual Leave', 'Off'];

// Start at current month instead of a fixed date
let currentViewDate = new Date();
currentViewDate.setDate(1); 

const calendarEl = document.getElementById('calendar');
const monthLabel = document.getElementById('currentMonthLabel');

function getPatternShift(dateString) {
    const target = new Date(dateString + "T12:00:00");
    const diffDays = Math.floor((target - ANCHOR_DATE) / (1000 * 60 * 60 * 24));
    const index = ((diffDays % 9) + 9) % 9;
    return PATTERN[index];
}

function formatShiftDisplay(fullTitle) {
    if (!fullTitle || fullTitle === 'Off' || fullTitle === '-') return '-';
    if (fullTitle === 'Annual Leave') return 'AL';
    const match = fullTitle.match(/\((.*?)\)/);
    return match ? match[1] : fullTitle;
}

async function initCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    monthLabel.innerText = `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)} ${year}`;

    // 1. Check if this month has been synced
    const { data: syncData } = await supabase
        .from('sync_history')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .single();

    const isMonthSynced = !!syncData;

    const firstDay = new Date(year, month, 1).getDay(); 
    const startingPoint = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    calendarEl.innerHTML = '';
    for (let x = 0; x < startingPoint; x++) calendarEl.appendChild(document.createElement('div'));

    for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const patternShift = getPatternShift(dateKey);
        
        const dayCard = document.createElement('div');
        dayCard.className = "day-card bg-white border border-slate-200 rounded-xl p-1.5 min-h-[85px] flex flex-col justify-between cursor-pointer";
        
        // Base styling logic: 
        // If synced -> text-blue-600, full opacity
        // If not synced -> text-slate-400 (grey), low opacity (opacity-30)
        const colorClass = isMonthSynced ? 'text-blue-600' : 'text-slate-400';
        const opacityClass = isMonthSynced ? 'opacity-100' : 'opacity-30';

        dayCard.innerHTML = `
            <span class="text-[10px] font-bold text-slate-400">${i}</span>
            <div class="text-[15px] font-black text-center uppercase ${colorClass} ${opacityClass}" id="shift-display-${dateKey}">
                ${formatShiftDisplay(patternShift)}
            </div>
        `;
        dayCard.onclick = () => openPicker(year, month, i);
        calendarEl.appendChild(dayCard);
    }
    await loadOverrides(year, month, isMonthSynced);
}

async function loadOverrides(year, month, isMonthSynced) {
    const displayMonth = (month + 1).toString().padStart(2, '0');
    const firstDay = `${year}-${displayMonth}-01`;
    const lastDay = `${year}-${displayMonth}-${new Date(year, month + 1, 0).getDate()}`;

    const { data, error } = await supabase
        .from('shift_overrides')
        .select('*')
        .gte('shift_date', firstDay)
        .lte('shift_date', lastDay);

    if (error) return console.error("Supabase Query Error:", error);

    if (data) {
        data.forEach(entry => {
            const el = document.getElementById(`shift-display-${entry.shift_date}`);
            if (el) {
                el.innerText = formatShiftDisplay(entry.shift_name);
                
                // If month is synced, everything stays blue.
                // If not synced, overrides turn blue (active) while pattern stays grey.
                if (!isMonthSynced) {
                    el.classList.remove('opacity-30', 'text-slate-400');
                    el.classList.add('opacity-100', 'text-blue-600');
                }
                
                if (entry.shift_name === 'Off') {
                    el.classList.add('text-slate-300');
                    el.classList.remove('text-blue-600');
                }
            }
        });
    }
}

async function saveOverride(dateKey, shiftName) {
    const { error } = await supabase.from('shift_overrides').upsert({ shift_date: dateKey, shift_name: shiftName });
    if (error) console.error("Database Error:", error);
    await initCalendar(currentViewDate);
}

function openPicker(year, month, day) {
    const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    document.getElementById('selectedDateLabel').innerText = `Shift for ${day}/${month + 1}/${year}`;
    const optionsGrid = document.getElementById('optionsGrid');
    optionsGrid.innerHTML = '';

    SHIFTS.forEach(shift => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-50 border border-slate-100 py-4 px-2 rounded-xl text-[10px] font-bold text-slate-700 active:bg-blue-600 active:text-white transition-all";
        btn.innerText = shift;
        btn.onclick = async () => {
            await saveOverride(dateKey, shift);
            document.getElementById('shiftPicker').classList.add('hidden');
        };
        optionsGrid.appendChild(btn);
    });
    document.getElementById('shiftPicker').classList.remove('hidden');
    document.getElementById('shiftPicker').classList.add('flex');
}

// Fixed navigation logic for unlimited months
document.getElementById('prevMonth').onclick = () => { 
    currentViewDate.setMonth(currentViewDate.getMonth() - 1); 
    initCalendar(currentViewDate); 
};
document.getElementById('nextMonth').onclick = () => { 
    currentViewDate.setMonth(currentViewDate.getMonth() + 1); 
    initCalendar(currentViewDate); 
};

document.getElementById('closePickerBtn').onclick = () => document.getElementById('shiftPicker').classList.add('hidden');

document.getElementById('fetchBtn').onclick = async () => {
    const btn = document.getElementById('fetchBtn');
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
    btn.innerText = 'Syncing...';
    try {
        await supabase.functions.invoke('sync-to-icloud', { body: { year, month } });
        
        // Record the sync in history
        await supabase.from('sync_history').upsert({ year, month, last_synced_at: new Date().toISOString() });
        
        alert('iCloud Sync Request Sent!');
        await initCalendar(currentViewDate); // Refresh UI to turn everything blue
    } catch (e) { 
        alert('Sync Error'); 
    }
    btn.innerText = 'Sync to iCloud';
};

initCalendar(currentViewDate);