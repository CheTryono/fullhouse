const STORE = 'fullhouse-v01';
const LEGACY_STORE = 'botanica-planificador-v01';
const colorOptions = ['#a26cf4', '#ed6dba', '#f7a853', '#39c8ab', '#54a9f4', '#ec6c73', '#8579e8', '#9bc55c', '#be81f2', '#d8a34c', '#ff8e5b', '#37b6cc', '#ec6f93', '#7e95e9', '#40b67a', '#ce7390', '#a85fe0', '#738c98'];
const ADVANCED_STORE = 'fullhouse-advanced-v08';
const DURATION_STORE = 'fullhouse-duration-display-v07';
const THEME_STORE = 'fullhouse-theme-v02';
const LAYOUT_STORE = 'fullhouse-modal-layout-v02';
const GUIDE_STORE = 'fullhouse-onboarding-v03'; // Mantener para no reiniciar guías ya finalizadas.
function getPreference(name) { try {
    return localStorage.getItem(name) || '';
}
catch {
    return '';
} }
function putPreference(name, value) { try {
    localStorage.setItem(name, value);
}
catch (err) {
    console.warn('No se pudo guardar preferencia', err);
} }
const lifeAreas = [
    { id: 'mind', title: 'Mente', detail: 'Aprendizaje, experiencias, hábitos y crecimiento personal.', color: '#8d70ec' },
    { id: 'physical', title: 'Físico', detail: 'Fuerza, salud, habilidades, movimiento y alimentación.', color: '#e77991' },
    { id: 'purpose', title: 'Propósito', detail: 'Trabajo, deberes, proyectos, aspiraciones y sueños.', color: '#e9a35c' },
    { id: 'social', title: 'Social', detail: 'Familia, amistades, relaciones y convivencia.', color: '#56b8ac' },
    { id: 'other', title: 'Otro ámbito', detail: 'Objetivos que todavía no encajan en los demás.', color: '#7899d9' }
];
function areaInfo(id) { return lifeAreas.find(a => a.id === id) || lifeAreas[2]; }
const themeOptions = [
    { id: 'aurora', name: 'Aurora', hint: 'Violeta, rosa y destellos cálidos', colors: ['#7b59e8', '#ec77be', '#ffa75c'] },
    { id: 'ocean', name: 'Océano', hint: 'Azules luminosos y turquesa', colors: ['#196de0', '#23c7bd', '#82a6fb'] },
    { id: 'sunset', name: 'Atardecer', hint: 'Coral, durazno y dorado', colors: ['#df586e', '#ef9c52', '#f5c66d'] },
    { id: 'forest', name: 'Bosque', hint: 'Verdes naturales y menta', colors: ['#247760', '#68c99c', '#c5dd84'] },
    { id: 'midnight', name: 'Medianoche', hint: 'Azul profundo y violeta', colors: ['#343f8f', '#8856d5', '#dd7cb0'] }
];
const goalStatuses = [
    { id: 'pending', label: 'Por comenzar', desc: 'Aún no he comenzado a trabajarla' },
    { id: 'working', label: 'En proceso', desc: 'Estoy dedicándole tiempo y atención' },
    { id: 'improving', label: 'Avanzando', desc: 'Percibo mejoras y cambios positivos' },
    { id: 'consolidated', label: 'Consolidando', desc: 'He construido una base estable' },
    { id: 'achieved', label: 'Conseguida', desc: 'Alcancé el resultado que buscaba' }
];
const guideSteps = [
    { page: 'inicio', title: 'Tu recorrido empieza aquí', text: 'Vas a construir un pequeño plan de verdad. Te acompañaré desde una meta hasta tu horario. Puedes salir del tutorial cuando quieras.', action: 'Comenzar recorrido' },
    { page: 'metas', title: '1. Crea tu primera meta', text: 'Una meta señala una dirección. Escribe algo que de verdad quieras mejorar; puedes elegir su ámbito y cómo medir su avance. Si ya tienes una meta, también puedes seleccionarla.', action: 'Crear una meta' },
    { page: 'metas', title: '2. Divide para poder avanzar', text: 'Una meta grande puede resultar abstracta. Dividirla en submetas pequeñas crea un camino concreto, permite saber qué sigue y evita que pierdas el rumbo. Añade ahora una primera submeta.', action: 'Crear una submeta' },
    { page: 'calendario', title: '3. Revisa tu rumbo', text: 'Establecer una fecha de revisión te ayuda a comprobar si las acciones te están acercando a lo que deseas. Programa una revisión: es una fecha importante, no otra tarea diaria.', action: 'Programar revisión' },
    { page: 'rutinas', title: '4. Convierte la intención en acciones', text: 'La constancia nace de acciones concretas. Una rutina define qué hacer y en qué orden, para que avanzar no dependa de improvisar cada día. Programa tu primera rutina.', action: 'Programar una rutina' },
    { page: 'horario', title: '5. Conecta las piezas de tu día', text: 'El horario reserva tiempo real para tus planes. Abre el bloque que acabas de programar y explora sus pasos: de lo grande a lo pequeño, sin perderte.', action: 'Abrir mi bloque' },
    { page: 'horario', title: '¡Tu primer plan está conectado!', text: 'Ya has recorrido meta → submeta → fecha de revisión → rutina → horario. Puedes seguir explorando y ajustando tu sistema.', action: 'Entrar a Fullhouse' }
];
const weekdays = ['L', 'M', 'Mié', 'J', 'V', 'S', 'D'];
const weekdayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const routineIcons = ['checklist', 'sun', 'moon', 'target', 'spark', 'clock', 'calendar', 'chart', 'heart', 'book', 'dumbbell', 'coffee', 'star', 'briefcase', 'music'];
const longDays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function ymd(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); }
function firstMonth(date) { return date.slice(0, 7) + '-01'; }
function today() { return ymd(new Date()); }
function fmtDate(s) { const d = parseDay(s); return `${longDays[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`; }
function fmtMonth(s) { const d = parseDay(s); return `${months[d.getMonth()]} ${d.getFullYear()}`; }
function asInt(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function bound(num, a, b) { return Math.min(b, Math.max(a, num)); }
function minutes(time) { const x = time.split(':').map(Number); return (x[0] || 0) * 60 + (x[1] || 0); }
function timeString(m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function gDraft() { return { id: '', title: '', desc: '', parentId: '', area: 'purpose', dependsOn: '', startDate: '', dueDate: '', color: colorOptions[0], current: 0, target: 0, unit: '', mode: 'qualitative', status: 'pending', milestones: [] }; }
function rDraft() { return { id: '', title: '', desc: '', icon: 'checklist', durationMode: 'steps', durationMin: 30, steps: [{ id: uid(), title: '', min: 5 }] }; }
function eDraft(date = today()) { return { id: '', title: '', date, time: '08:00', minutes: 30, goalId: '', routineId: '', repeat: 'none', repeatDays: [], everyDays: 2, specificDates: [], note: '', overrides: {} }; }
function seed() {
    const d = today();
    const goal1 = 'g-phys', goal2 = 'g-strength', goal3 = 'g-creative';
    return { version: 1,
        goals: [
            { id: goal1, title: 'Desarrollo físico', desc: 'Construir hábitos sostenibles y mejorar mis capacidades.', parentId: '', area: 'physical', color: colorOptions[0], current: 0, target: 0, unit: '', history: [] },
            { id: goal2, title: 'Progreso en fuerza', desc: 'Ejemplo de meta medible; cambia las cifras a tus propias referencias.', parentId: goal1, area: 'physical', color: colorOptions[1], current: 6, target: 10, unit: 'sesiones', history: [] },
            { id: goal3, title: 'Proyectos personales', desc: 'Reservar tiempo de concentración y registrar entregables.', parentId: '', area: 'purpose', color: colorOptions[2], current: 0, target: 0, unit: '', history: [] }
        ],
        routines: [
            { id: 'r-morning', title: 'Preparación matutina', desc: 'Ejemplo de rutina editable para comenzar el día.', steps: [{ id: 's-1', title: 'Registrar mi peso', min: 2 }, { id: 's-2', title: 'Tender la cama', min: 3 }, { id: 's-3', title: 'Preparar mochila y ropa', min: 8 }, { id: 's-4', title: 'Baño y aseo personal', min: 15 }] },
            { id: 'r-focus', title: 'Bloque de concentración', desc: 'Un procedimiento sencillo para trabajar sin distracciones.', steps: [{ id: 's-5', title: 'Definir el resultado esperado', min: 5 }, { id: 's-6', title: 'Trabajar en la tarea principal', min: 45 }, { id: 's-7', title: 'Guardar avances y registrar próximos pasos', min: 10 }] }
        ],
        events: [
            { id: 'e-morning', title: 'Preparación matutina', date: d, time: '07:00', minutes: 28, goalId: goal1, routineId: 'r-morning', repeat: 'daily', note: 'La duración es estimada.', overrides: {} },
            { id: 'e-work', title: 'Trabajo en proyectos', date: d, time: '09:00', minutes: 60, goalId: goal3, routineId: 'r-focus', repeat: 'weekdays', note: 'Priorizar un resultado concreto.', overrides: {} },
            { id: 'e-walk', title: 'Actividad física', date: d, time: '18:00', minutes: 40, goalId: goal1, routineId: '', repeat: 'none', note: 'Actividad de ejemplo; ajusta a tu plan.', overrides: {} }
        ], logs: {} };
}
function load() {
    try {
        const current = localStorage.getItem(STORE);
        if (current) {
            const parsed = JSON.parse(current);
            if (validData(parsed))
                return parsed;
        }
        // Migración sin pérdida cuando el prototipo anterior se abrió en el mismo origen.
        const legacy = localStorage.getItem(LEGACY_STORE);
        if (legacy) {
            const parsed = JSON.parse(legacy);
            if (validData(parsed)) {
                localStorage.setItem(STORE, legacy);
                return parsed;
            }
        }
    }
    catch (err) {
        console.warn('No se pudo leer el almacenamiento', err);
    }
    return seed();
}
function validData(v) { return !!v && v.version === 1 && Array.isArray(v.goals) && Array.isArray(v.routines) && Array.isArray(v.events) && !!v.logs && typeof v.logs === 'object' && !Array.isArray(v.logs); }
function occurs(e, date) {
    var _a, _b;
    const earliest = e.date;
    if (date < earliest || (e.endDate && date > e.endDate))
        return false;
    if ((_b = (_a = e.overrides) === null || _a === void 0 ? void 0 : _a[date]) === null || _b === void 0 ? void 0 : _b.skip)
        return false;
    if (e.kind === 'occasion' && e.repeat === 'none' && e.endDate)
        return date <= e.endDate;
    if (e.repeat === 'none')
        return e.date === date;
    const day = parseDay(date), start = parseDay(earliest);
    const weekday = day.getDay();
    if (e.repeat === 'daily')
        return true;
    if (e.repeat === 'weekdays')
        return weekday >= 1 && weekday <= 5;
    if (e.repeat === 'weekly')
        return weekday === start.getDay();
    if (e.repeat === 'custom')
        return (e.repeatDays || []).includes(weekday);
    if (e.repeat === 'every')
        return Math.round((day.getTime() - start.getTime()) / 86400000) % Math.max(1, e.everyDays || 1) === 0;
    if (e.repeat === 'monthly')
        return day.getDate() === start.getDate();
    if (e.repeat === 'yearly')
        return day.getDate() === start.getDate() && day.getMonth() === start.getMonth();
    if (e.repeat === 'dates')
        return (e.specificDates || []).includes(date) || date === e.date;
    return false;
}
function routineForDay(e, date, data) { var _a; const r = data.routines.find(r => r.id === e.routineId); return r ? activeSteps(r.steps, date, (_a = data.logs[key(e, date)]) === null || _a === void 0 ? void 0 : _a.choices) : []; }
function baseLength(e, date, data) { const r = data.routines.find(x => x.id === e.routineId); return r ? Math.max(1, r.durationMode === 'fixed' && Number(r.durationMin) > 0 ? Number(r.durationMin) : routineForDay(e, date, data).reduce((n, s) => n + stepMinutes(s), 0)) : Math.max(1, e.minutes); }
/* Las referencias se guardan por RUTINA; siguen válidas al dividir una programación para preservar su historial. */
function eventFrame(e, date, data, visited = new Set()) {
    var _a, _b;
    if (visited.has(e.id))
        return null;
    if (e.allDay)
        return { start: 0, end: 1440, length: 1440 };
    if (e.anchor === 'between') {
        if (!e.afterRoutineId || !e.beforeRoutineId || e.afterRoutineId === e.beforeRoutineId)
            return null;
        const nextVisited = new Set(visited);
        nextVisited.add(e.id);
        const find = (rid) => data.events.find(x => x.id !== e.id && x.routineId === rid && occurs(x, date));
        const after = find(e.afterRoutineId), before = find(e.beforeRoutineId);
        if (!after || !before)
            return null;
        const a = eventFrame(after, date, data, nextVisited), b = eventFrame(before, date, data, nextVisited);
        if (!a || !b || a.end >= b.start)
            return null;
        return { start: a.end, end: b.start, length: b.start - a.end };
    }
    const length = baseLength(e, date, data), at = (_b = (_a = e.overrides) === null || _a === void 0 ? void 0 : _a[date]) === null || _b === void 0 ? void 0 : _b.time;
    const start = at ? minutes(at) : e.anchor === 'end' && e.endTime ? minutes(e.endTime) - length : minutes(e.time);
    if (start < 0 || start + length > 1440)
        return null;
    return { start, end: start + length, length };
}
function eventsOn(data, date) { return data.events.filter(e => occurs(e, date) && (e.allDay || !!eventFrame(e, date, data))).sort((a, b) => eventTime(a, date, data).localeCompare(eventTime(b, date, data))); }
function eventTime(e, date, data) { var _a, _b; const frame = data ? eventFrame(e, date, data) : null; return frame ? timeString(frame.start) : ((_b = (_a = e.overrides) === null || _a === void 0 ? void 0 : _a[date]) === null || _b === void 0 ? void 0 : _b.time) || e.time; }
function scheduleStart(e, date, data) { var _a, _b; return (_b = (_a = eventFrame(e, date, data)) === null || _a === void 0 ? void 0 : _a.start) !== null && _b !== void 0 ? _b : minutes(e.time); }
function sameScheduleActive(e, cutoff) { return !!e.routineId && (!e.endDate || e.endDate >= cutoff) && (e.repeat !== 'none' || e.date >= cutoff); }
function reorderByIds(items, from, to) { const list = [...items], a = list.findIndex(i => i.id === from), b = list.findIndex(i => i.id === to); if (a < 0 || b < 0 || a === b)
    return items; const [m] = list.splice(a, 1); list.splice(b, 0, m); return list; }
function repeatCollision(a, b) {
    if (!a.routineId || a.routineId !== b.routineId)
        return false;
    const start = a.date > b.date ? a.date : b.date;
    const maxEnd = a.endDate && b.endDate ? (a.endDate < b.endDate ? a.endDate : b.endDate) : a.endDate || b.endDate || addDays(start, 1462);
    const candidates = new Set();
    for (let i = 0; i <= 1462 && addDays(start, i) <= maxEnd; i++)
        candidates.add(addDays(start, i));
    for (const d of [...(a.specificDates || []), ...(b.specificDates || [])])
        if (d >= start)
            candidates.add(d);
    return [...candidates].some(date => occurs(a, date) && occurs(b, date));
}
function reorderTree(steps, from, to) {
    const a = steps.findIndex(x => x.id === from), b = steps.findIndex(x => x.id === to);
    if (a >= 0 && b >= 0 && a !== b) {
        const next = [...steps];
        const [item] = next.splice(a, 1);
        next.splice(b, 0, item);
        return { steps: next, moved: true };
    }
    for (let i = 0; i < steps.length; i++)
        if (steps[i].children) {
            const changed = reorderTree(steps[i].children || [], from, to);
            if (changed.moved)
                return { steps: steps.map((s, j) => i === j ? { ...s, children: changed.steps } : s), moved: true };
        }
    for (let i = 0; i < steps.length; i++)
        for (const v of steps[i].variants || [])
            if (v.children) {
                const changed = reorderTree(v.children, from, to);
                if (changed.moved)
                    return { steps: steps.map((s, j) => { var _a; return i === j ? { ...s, variants: (_a = s.variants) === null || _a === void 0 ? void 0 : _a.map(item => item.id === v.id ? { ...item, children: changed.steps } : item) } : s; }), moved: true };
            }
    return { steps, moved: false };
}
function stepLevelName(level) { return ['Paso', 'Subpaso', 'Detalle', 'Subdetalle'][level] || `Nivel ${level + 1}`; }
function nextStepLevelName(level) { return ['subpaso', 'detalle', 'subdetalle'][level] || `nivel ${level + 2}`; }
function hexToHsl(hex) {
    const c = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#a26cf4';
    const rgb = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
    const max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case rgb[0]:
                h = ((rgb[1] - rgb[2]) / d) % 6;
                break;
            case rgb[1]:
                h = (rgb[2] - rgb[0]) / d + 2;
                break;
            default: h = (rgb[0] - rgb[1]) / d + 4;
        }
    }
    return [Math.round((h * 60 + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
}
function graphLayout(data, grouping) {
    const gs = data.goals;
    const edges = [];
    gs.forEach(g => { if (gs.some(x => x.id === g.parentId))
        edges.push({ from: g.parentId, to: g.id, kind: 'parent' }); if (g.dependsOn && gs.some(x => x.id === g.dependsOn))
        edges.push({ from: g.dependsOn, to: g.id, kind: 'depends' }); });
    const columns = new Map();
    const labels = [];
    if (grouping === 'structure') {
        const depth = (g, seen = new Set()) => { if (!g.parentId || seen.has(g.id))
            return 0; const parent = gs.find(x => x.id === g.parentId); if (!parent)
            return 0; seen.add(g.id); return Math.min(5, 1 + depth(parent, seen)); };
        gs.forEach(g => { const k = String(depth(g)); columns.set(k, [...(columns.get(k) || []), g]); });
        [...columns.keys()].sort((a, b) => Number(a) - Number(b)).forEach(k => labels.push({ title: Number(k) ? `NIVEL ${Number(k) + 1}` : 'METAS PRINCIPALES', x: 25 + Number(k) * 280 }));
    }
    else {
        const now = today(), soon = addDays(now, 30);
        gs.forEach(g => { const dates = [g.dueDate, ...data.events.filter(e => e.goalId === g.id).map(e => e.date)].filter(Boolean); const date = dates.sort()[0]; const k = !date ? '3' : date < now ? '0' : date <= soon ? '1' : '2'; columns.set(k, [...(columns.get(k) || []), g]); });
        ['ATRASADAS', 'PRÓXIMOS 30 DÍAS', 'MÁS ADELANTE', 'SIN FECHA'].forEach((title, i) => labels.push({ title, x: 25 + i * 280 }));
    }
    const nodes = [];
    let largest = 1;
    let last = grouping === 'structure' ? Math.max(0, ...[...columns.keys()].map(Number)) : 3;
    for (let k = 0; k <= last; k++) {
        const goals = columns.get(String(k)) || [];
        largest = Math.max(largest, goals.length);
        goals.forEach((goal, i) => nodes.push({ goal, x: 24 + k * 280, y: 72 + i * 146 }));
    }
    if (grouping === 'structure' && gs.length) {
        let nextLeaf = 0;
        const seen = new Set();
        const positions = new Map();
        const place = (g) => { var _a; if (seen.has(g.id))
            return (_a = positions.get(g.id)) !== null && _a !== void 0 ? _a : 72; seen.add(g.id); const children = gs.filter(x => x.parentId === g.id && !seen.has(x.id)); const y = children.length ? children.map(place).reduce((a, b) => a + b, 0) / children.length : 72 + (nextLeaf++) * 146; positions.set(g.id, y); return y; };
        gs.filter(g => !g.parentId || !gs.some(x => x.id === g.parentId)).forEach(place);
        gs.filter(g => !seen.has(g.id)).forEach(place);
        nodes.forEach(n => { var _a; return n.y = (_a = positions.get(n.goal.id)) !== null && _a !== void 0 ? _a : 72; });
        return { nodes, edges, width: (last + 1) * 280 + 40, height: Math.max(340, nextLeaf * 146 + 130), labels };
    }
    return { nodes, edges, width: (last + 1) * 280 + 40, height: largest * 146 + 108, labels };
}
function key(e, date) { return `${e.id}@${date}`; }
function done(data, e, date) { var _a; return !!((_a = data.logs[key(e, date)]) === null || _a === void 0 ? void 0 : _a.completed); }
function durationText(value, format = 'hours') { const total = Math.max(0, Math.round(value)); if (format === 'minutes')
    return total + ' min'; const h = Math.floor(total / 60), m = total % 60; return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`; }
function percent(current, target) { return target > 0 ? bound(Math.round((current / target) * 100), 0, 100) : 0; }
function goalMode(g) { return g.mode || (g.target > 0 ? 'numeric' : 'qualitative'); }
function goalStatus(g) { return g.status || 'pending'; }
function statusLabel(s) { var _a; return ((_a = goalStatuses.find(x => x.id === s)) === null || _a === void 0 ? void 0 : _a.label) || 'Por comenzar'; }
function goalMilestones(g) { return g.milestones || []; }
function stepMinutes(s) { return s.children && s.children.length ? s.children.reduce((a, c) => a + stepMinutes(c), 0) : s.min; }
function activeStep(s, date, choices = {}) {
    var _a, _b, _c, _d;
    const weekday = parseDay(date).getDay();
    if (s.mode === 'selected' && !(s.days || []).includes(weekday))
        return null;
    const mode = s.mode || ((s.variants || []).length ? 'alternatives' : 'always');
    const match = mode === 'alternatives' ? s.chooseWhen === 'execute' ? (_a = s.variants) === null || _a === void 0 ? void 0 : _a.find(v => v.id === choices[s.id]) : (_b = s.variants) === null || _b === void 0 ? void 0 : _b.find(v => v.days.includes(weekday)) : undefined;
    if (s.mode === 'alternatives' && s.chooseWhen !== 'execute' && !match) {
        const baseDays = s.days || DAYS.filter(n => !(s.variants || []).some(v => v.days.includes(n)));
        if (!baseDays.includes(weekday))
            return null;
    }
    const chosen = match ? { ...s, title: match.title || s.title, desc: match.desc || '', min: match.min, children: match.children || [], flexible: !!match.flexible, flexWeight: match.flexWeight || 1, goalId: match.goalId || s.goalId, requestEvidence: (_c = match.requestEvidence) !== null && _c !== void 0 ? _c : s.requestEvidence } : s;
    return { ...chosen, children: (_d = chosen.children) === null || _d === void 0 ? void 0 : _d.map(c => activeStep(c, date, choices)).filter(Boolean) };
}
function activeSteps(steps, date, choices = {}) { return steps.map(s => activeStep(s, date, choices)).filter(Boolean); }
function routineMinutesOn(r, date) { return r.durationMode === 'fixed' && Number(r.durationMin) > 0 ? Math.round(Number(r.durationMin)) : activeSteps(r.steps, date).reduce((total, s) => total + stepMinutes(s), 0); }
function durationOn(e, date, data) { var _a, _b; return (_b = (_a = eventFrame(e, date, data)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : baseLength(e, date, data); }
function leafAllocation(steps, available) {
    const leaves = leafSteps(steps), fixed = leaves.filter(s => !s.flexible).reduce((n, s) => n + s.min, 0);
    const flex = leaves.filter(s => s.flexible), remaining = Math.max(0, Math.round(available - fixed)), result = {};
    // Distribución proporcional por peso (ej. 90/10). El redondeo preserva exactamente los minutos disponibles.
    const total = flex.reduce((sum, s) => sum + Math.max(1, s.flexWeight || 1), 0);
    const portions = flex.map(s => ({ id: s.id, ideal: remaining * Math.max(1, s.flexWeight || 1) / Math.max(1, total) }));
    let used = 0;
    portions.forEach(p => { result[p.id] = Math.floor(p.ideal); used += result[p.id]; });
    portions.map(p => ({ ...p, fraction: p.ideal - Math.floor(p.ideal) })).sort((a, b) => b.fraction - a.fraction).slice(0, remaining - used).forEach(p => result[p.id]++);
    return result;
}
function routineBalance(r, date, available, choices = {}) {
    const steps = activeSteps(r.steps, date, choices), fixed = fixedStepMinutes(steps), flex = leafSteps(steps).filter(s => s.flexible).length;
    const space = available !== null && available !== void 0 ? available : routineMinutesOn(r, date);
    const error = fixed > space ? `Faltan ${durationText(fixed - space)}: los pasos fijos exceden el tiempo disponible.` : flex === 0 && fixed !== space ? `Sobran ${durationText(space - fixed)}: añade un contenido flexible o ajusta los pasos.` : '';
    return { fixed, flex, space, error };
}
function goalColor(data, goalId) { var _a; return (_a = data.goals.find(g => g.id === goalId)) === null || _a === void 0 ? void 0 : _a.color; }
function effectiveStepMinutes(s, alloc) {
    var _a, _b;
    return ((_a = s.children) === null || _a === void 0 ? void 0 : _a.length) ? s.children.reduce((n, c) => n + effectiveStepMinutes(c, alloc), 0) : s.flexible ? ((_b = alloc[s.id]) !== null && _b !== void 0 ? _b : s.min) : s.min;
}
function fixedStepMinutes(steps) { return leafSteps(steps).filter(s => !s.flexible).reduce((n, s) => n + s.min, 0); }
function unresolvedManual(steps, choices = {}) {
    const result = [];
    const walk = (items) => items.forEach(s => { if (s.mode === 'alternatives' && s.chooseWhen === 'execute' && !choices[s.id])
        result.push(s); walk(s.children || []); });
    walk(steps);
    return result;
}
function upcomingNote(data, e, date, stepId) {
    /* Solo el siguiente día en el que realmente aparece este paso/bloque. */
    const refs = data.events.filter(item => e.routineId ? item.routineId === e.routineId : item.id === e.id);
    const candidates = Object.entries(data.logs).flatMap(([logKey, log]) => {
        var _a;
        const i = logKey.lastIndexOf('@'), id = logKey.slice(0, i), at = logKey.slice(i + 1);
        const value = stepId ? (_a = log.stepNotes) === null || _a === void 0 ? void 0 : _a[stepId] : log.note;
        return value && at < date && refs.some(item => item.id === id) ? [{ at, value }] : [];
    }).sort((a, b) => b.at.localeCompare(a.at));
    for (const item of candidates) {
        let next = addDays(item.at, 1);
        let count = 0;
        while (next <= date && count++ < 3660) {
            const valid = refs.find(v => occurs(v, next) && !!eventFrame(v, next, data));
            const active = valid ? (!stepId || routineForDay(valid, next, data).some(s => stepPresent(s, stepId))) : false;
            if (active)
                return next === date ? item.value : '';
            next = addDays(next, 1);
        }
    }
    return '';
}
function originalStepTitle(data, routineId, id) {
    const routine = data.routines.find(r => r.id === routineId);
    if (!routine)
        return '';
    const find = (steps) => { for (const s of steps) {
        if (s.id === id)
            return s.title;
        const child = find(s.children || []);
        if (child)
            return child;
        for (const v of s.variants || []) {
            const alt = find(v.children || []);
            if (alt)
                return alt;
        }
    } return ''; };
    return find(routine.steps);
}
function stepPresent(s, id) { var _a; return s.id === id || !!((_a = s.children) === null || _a === void 0 ? void 0 : _a.some(c => stepPresent(c, id))); }
function readableOn(color) { const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .36 ? '#201b2e' : '#fff'; }
function routineMinutes(r) { return r.durationMode === 'fixed' && Number(r.durationMin) > 0 ? Number(r.durationMin) : r.steps.reduce((a, s) => a + stepMinutes(s), 0); }
function leafSteps(steps) { return steps.flatMap(s => s.children && s.children.length ? leafSteps(s.children) : [s]); }
function editStepTree(steps, id, fn) { return steps.map(s => { var _a; return s.id === id ? fn(s) : { ...s, children: s.children ? editStepTree(s.children, id, fn) : undefined, variants: (_a = s.variants) === null || _a === void 0 ? void 0 : _a.map(v => ({ ...v, children: v.children ? editStepTree(v.children, id, fn) : undefined })) }; }); }
function deleteStepTree(steps, id) { return steps.filter(s => s.id !== id).map(s => { var _a; return ({ ...s, children: s.children ? deleteStepTree(s.children, id) : undefined, variants: (_a = s.variants) === null || _a === void 0 ? void 0 : _a.map(v => ({ ...v, children: v.children ? deleteStepTree(v.children, id) : undefined })) }); }); }
function moveStepTree(steps, id, direction) { const arr = steps.map(s => { var _a; return ({ ...s, children: s.children ? moveStepTree(s.children, id, direction) : undefined, variants: (_a = s.variants) === null || _a === void 0 ? void 0 : _a.map(v => ({ ...v, children: v.children ? moveStepTree(v.children, id, direction) : undefined })) }); }); const i = arr.findIndex(s => s.id === id); const j = i + direction; if (i >= 0 && j >= 0 && j < arr.length) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
} return arr; }
function getStepByPath(steps, path) { let list = steps, last; for (const id of path) {
    last = list.find(s => s.id === id);
    if (!last)
        return undefined;
    list = last.children || [];
} return last; }
function fitArea(el) { if (!el)
    return; el.style.height = 'auto'; el.style.height = Math.max(86, el.scrollHeight + 2) + 'px'; }
class AutoTextarea extends React.Component {
    constructor() {
        super(...arguments);
        this.el = null;
        this.assign = (node) => { if (node !== this.el) {
            this.el = node;
            if (node)
                fitArea(node);
        } };
    }
    componentDidUpdate(prev) { if (prev.value !== this.props.value)
        fitArea(this.el); }
    render() { const { onChange, ...others } = this.props; return React.createElement("textarea", { ...others, ref: this.assign, onChange: (e) => { onChange(e); fitArea(e.currentTarget); } }); }
}
class NumberField extends React.Component {
    constructor(p) {
        var _a;
        super(p);
        this.commit = () => { var _a, _b, _c, _d; const raw = this.state.text.trim(); const proposed = raw === '' ? (_a = this.props.min) !== null && _a !== void 0 ? _a : 0 : Number(raw.replace(',', '.')); const v = Number.isFinite(proposed) ? bound(proposed, (_b = this.props.min) !== null && _b !== void 0 ? _b : 0, (_c = this.props.max) !== null && _c !== void 0 ? _c : 999999) : (_d = this.props.min) !== null && _d !== void 0 ? _d : 0; this.setState({ text: String(v), editing: false }); this.props.onCommit(v); };
        this.state = { text: String((_a = p.value) !== null && _a !== void 0 ? _a : ''), editing: false };
    }
    componentDidUpdate(prev) { var _a; if (!this.state.editing && prev.value !== this.props.value)
        this.setState({ text: String((_a = this.props.value) !== null && _a !== void 0 ? _a : '') }); }
    render() { return React.createElement("input", { type: "text", inputMode: "decimal", "aria-label": this.props.ariaLabel || 'Cantidad', value: this.state.text, onFocus: () => this.setState({ editing: true }), onChange: (e) => { if (/^\d*([.,]\d*)?$/.test(e.target.value))
            this.setState({ text: e.target.value }); }, onBlur: this.commit }); }
}
class NoteEditor extends React.Component {
    constructor(props) { super(props); this.state = { text: props.value || '', open: false }; }
    componentDidUpdate(prev) { if (prev.value !== this.props.value)
        this.setState({ text: this.props.value || '' }); }
    render() {
        return React.createElement("div", { className: 'day-note-editor ' + (this.state.open ? 'is-expanded' : 'is-collapsed') },
            React.createElement("div", { className: 'row spread' },
                React.createElement("div", { className: 'day-note-title' },
                    React.createElement(Icon, { name: 'book', size: 17 }),
                    React.createElement("strong", null, this.props.label)),
                React.createElement(Btn, { tiny: true, kind: 'secondary', onClick: () => this.setState({ open: !this.state.open, text: this.props.value || '' }) }, this.state.open ? 'Cerrar' : this.props.value ? 'Ver / editar nota' : 'Añadir nota')),
            !!this.props.value && !this.state.open && React.createElement("p", { className: 'saved-note-excerpt' },
                "\u270E ",
                this.props.value),
            this.props.carry && React.createElement("div", { className: 'note-from-previous' },
                React.createElement("strong", null, "\u2726 Nota de la ocasi\u00F3n anterior"),
                React.createElement("p", null, this.props.carry),
                React.createElement("small", null, "Aparece solamente esta vez; no cambia las instrucciones permanentes.")),
            this.state.open && React.createElement(React.Fragment, null,
                React.createElement(AutoTextarea, { value: this.state.text, onChange: (ev) => this.setState({ text: ev.target.value }), placeholder: '\u00BFQu\u00E9 sucedi\u00F3? \u00BFQu\u00E9 mejorar\u00EDas o recordar\u00EDas la pr\u00F3xima vez?', maxLength: 2000 }),
                React.createElement("div", { className: 'row spread' },
                    React.createElement("span", { className: 'caption' }, "Se conserva en esta fecha y aparecer\u00E1 una vez en la pr\u00F3xima ocasi\u00F3n."),
                    React.createElement(Btn, { tiny: true, kind: 'secondary', disabled: this.state.text === (this.props.value || ''), onClick: () => { this.props.onSave(this.state.text); this.setState({ open: false }); } }, "Guardar nota"))));
    }
}
class FriendlySelect extends React.Component {
    constructor(props) {
        super(props);
        this.root = null;
        this.menuEl = null;
        this.outside = (e) => { if (this.root && !this.root.contains(e.target) && !(this.menuEl && this.menuEl.contains(e.target)) && this.state.open)
            this.setState({ open: false }); };
        this.reposition = () => { if (!this.root || !this.state.open)
            return; this.setState({ style: this.getPosition() }); };
        this.getPosition = () => { var _a; const rect = (_a = this.root) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(); if (!rect)
            return {}; const available = window.innerHeight - rect.bottom - 12, above = rect.top - 12; const up = available < 195 && above > available; const h = Math.min(280, Math.max(115, up ? above : available)); return { left: rect.left, top: up ? Math.max(8, rect.top - h - 6) : rect.bottom + 6, width: rect.width, maxHeight: h }; };
        this.show = () => this.setState({ open: true, index: Math.max(0, this.props.options.findIndex(x => x.value === this.props.value)), style: this.getPosition() });
        this.keydown = (e) => { if (e.key === 'Escape') {
            this.setState({ open: false });
            return;
        } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const current = this.state.open ? this.state.index : Math.max(0, this.props.options.findIndex(x => x.value === this.props.value));
            this.setState({ open: true, index: bound(current + (e.key === 'ArrowDown' ? 1 : -1), 0, this.props.options.length - 1), style: this.getPosition() });
        } if (e.key === 'Enter' && this.state.open) {
            e.preventDefault();
            const opt = this.props.options[this.state.index];
            if (opt) {
                this.props.onChange(opt.value);
                this.setState({ open: false });
            }
        } };
        this.state = { open: false, index: 0, style: {} };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.outside); window.addEventListener('resize', this.reposition); document.addEventListener('scroll', this.reposition, true); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.outside); window.removeEventListener('resize', this.reposition); document.removeEventListener('scroll', this.reposition, true); }
    render() { const choice = this.props.options.find(x => x.value === this.props.value); const popup = this.state.open ? React.createElement("div", { className: 'friendly-menu friendly-portal', style: this.state.style, ref: (node) => this.menuEl = node, role: 'listbox', "aria-label": this.props.ariaLabel || 'Opciones disponibles' }, this.props.options.map((o, i) => React.createElement("button", { type: 'button', key: o.value, role: 'option', "aria-selected": o.value === this.props.value, className: 'friendly-option ' + (i === this.state.index ? 'focused ' : '') + (o.value === this.props.value ? 'selected' : ''), onMouseEnter: () => this.setState({ index: i }), onClick: () => { this.props.onChange(o.value); this.setState({ open: false }); } },
        React.createElement("span", null, o.label),
        o.value === this.props.value && React.createElement(Icon, { name: 'check', size: 15 })))) : null; return React.createElement("div", { className: 'friendly-select ' + (this.state.open ? 'is-open' : ''), ref: (e) => this.root = e, onKeyDown: this.keydown },
        React.createElement("button", { type: 'button', className: 'friendly-trigger', "aria-haspopup": 'listbox', "aria-expanded": this.state.open, "aria-label": this.props.ariaLabel || 'Seleccionar opción', onClick: () => this.state.open ? this.setState({ open: false }) : this.show() },
            React.createElement("span", null, (choice === null || choice === void 0 ? void 0 : choice.label) || 'Selecciona una opción'),
            React.createElement("span", { className: 'select-caret' }, "\u2304")),
        popup && ReactDOM.createPortal(popup, document.querySelector('.app-shell') || document.body)); }
}
class CalendarDateInput extends React.Component {
    constructor(props) {
        super(props);
        this.root = null;
        this.menu = null;
        this.outside = (e) => { var _a, _b; if (this.state.open && !((_a = this.root) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.menu) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.setState({ open: false }); };
        this.position = () => { if (this.state.open && this.root) {
            const r = this.root.getBoundingClientRect();
            const popupHeight = 350;
            this.setState({ style: { left: Math.min(Math.max(8, r.left), Math.max(8, innerWidth - 326)), top: innerHeight - r.bottom > popupHeight + 8 ? r.bottom + 5 : Math.max(8, r.top - popupHeight - 5) } });
        } };
        this.toggle = () => { if (this.state.open)
            this.setState({ open: false });
        else {
            const r = this.root.getBoundingClientRect();
            this.setState({ open: true, month: firstMonth(this.props.value || today()), style: { left: Math.min(Math.max(8, r.left), Math.max(8, innerWidth - 326)), top: innerHeight - r.bottom > 358 ? r.bottom + 5 : Math.max(8, r.top - 358) } });
        } };
        this.monthMove = (delta) => { const d = parseDay(this.state.month); d.setMonth(d.getMonth() + delta); this.setState({ month: firstMonth(ymd(d)) }); };
        this.state = { open: false, month: firstMonth(props.value || today()), style: {} };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.outside); window.addEventListener('resize', this.position); document.addEventListener('scroll', this.position, true); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.outside); window.removeEventListener('resize', this.position); document.removeEventListener('scroll', this.position, true); }
    componentDidUpdate(prev) { if (prev.value !== this.props.value && this.props.value)
        this.setState({ month: firstMonth(this.props.value) }); }
    render() {
        const first = parseDay(this.state.month), offset = (first.getDay() + 6) % 7, cells = Array.from({ length: 42 }, (_, i) => addDays(this.state.month, i - offset));
        const panel = this.state.open ? React.createElement("section", { className: 'date-popover', role: 'dialog', "aria-label": 'Elegir ' + (this.props.label || 'fecha'), style: this.state.style, ref: (node) => this.menu = node },
            React.createElement("div", { className: 'date-popover-head' },
                React.createElement("button", { className: 'icon-btn', title: 'Mes anterior', onClick: () => this.monthMove(-1) },
                    React.createElement(Icon, { name: 'left', size: 16 })),
                React.createElement("strong", null, fmtMonth(this.state.month)),
                React.createElement("button", { className: 'icon-btn', title: 'Mes siguiente', onClick: () => this.monthMove(1) },
                    React.createElement(Icon, { name: 'right', size: 16 }))),
            React.createElement("div", { className: 'date-popover-grid' },
                ['L', 'M', 'Mié', 'J', 'V', 'S', 'D'].map(x => React.createElement("span", { className: 'date-weekday', key: x }, x)),
                cells.map(day => React.createElement("button", { type: 'button', key: day, disabled: !!this.props.min && day < this.props.min, "aria-label": fmtDate(day), "aria-pressed": day === this.props.value, title: day, className: 'date-popover-day ' + (day.slice(0, 7) === this.state.month.slice(0, 7) ? '' : 'outside ') + (day === this.props.value ? 'selected ' : '') + (this.props.rangeStart && day >= this.props.rangeStart && day <= this.props.value ? 'in-range ' : ''), onClick: () => { this.props.onChange(day); this.setState({ open: false }); } }, parseDay(day).getDate()))),
            React.createElement("div", { className: 'date-popover-footer' },
                React.createElement("button", { type: 'button', onClick: () => { this.props.onChange(''); this.setState({ open: false }); } }, "Quitar fecha"),
                React.createElement("button", { type: 'button', onClick: () => { if (!this.props.min || today() >= this.props.min)
                        this.props.onChange(today()); this.setState({ open: false }); } }, "Hoy"))) : null;
        return React.createElement("div", { className: 'date-input-wrap', ref: (e) => this.root = e },
            React.createElement("button", { type: 'button', className: 'date-field-button', onClick: this.toggle, "aria-haspopup": 'dialog', "aria-expanded": this.state.open },
                React.createElement(Icon, { name: 'calendar', size: 17 }),
                React.createElement("span", null, this.props.value ? fmtDate(this.props.value) + ' de ' + parseDay(this.props.value).getFullYear() : 'Elegir fecha'),
                React.createElement("span", null, "\u2304")),
            panel && ReactDOM.createPortal(panel, document.querySelector('.app-shell') || document.body));
    }
}
function TimePicker({ value, onChange }) {
    const [hour, minute] = (value || '08:00').split(':');
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(v => ({ value: v, label: v + ' h' }));
    const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(v => ({ value: v, label: v + ' min' }));
    return React.createElement("div", { className: 'time-picker' },
        React.createElement("span", { className: 'time-icon' },
            React.createElement(Icon, { name: 'clock', size: 18 })),
        React.createElement(FriendlySelect, { value: hour, ariaLabel: 'Seleccionar hora', options: hours, onChange: h => onChange(h + ':' + (minute || '00')) }),
        React.createElement("span", { className: 'time-colon' }, ":"),
        React.createElement(FriendlySelect, { value: minute, ariaLabel: 'Seleccionar minuto', options: mins, onChange: m => onChange((hour || '08') + ':' + m) }));
}
function Icon({ name, size = 19 }) { return React.createElement("span", { className: "icon", style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
    React.createElement("svg", { style: { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } },
        React.createElement("use", { href: '#i-' + name }))); }
function Btn({ children, onClick, kind = '', tiny = false, disabled = false, type = 'button', title }) { return React.createElement("button", { className: `btn ${kind} ${tiny ? 'tiny' : ''}`, onClick: onClick, type: type, disabled: disabled, title: title }, children); }
class Planner extends React.Component {
    constructor(props) {
        super(props);
        this.toastTimer = null;
        this.backdropDown = false;
        this.initialDraft = '';
        this.confirmResolver = null;
        this.pendingSchedule = null;
        this.globalKeydown = (e) => { if (e.key === 'Escape') {
            if (this.state.confirmDialog) {
                this.resolveConfirm(false);
                return;
            }
            if (this.state.helpOpen)
                this.setState({ helpOpen: false });
            else if (this.state.modal)
                this.close();
            else if (this.state.guideOpen)
                this.finishGuide();
        } };
        this.syncModalState = () => { document.body.style.overflow = this.state.confirmDialog || this.state.modal || (this.state.guideOpen && this.state.guideStep === 0) ? 'hidden' : ''; };
        this.resizeTextareas = () => { document.querySelectorAll('.modal-body textarea').forEach(fitArea); };
        this.setTheme = (theme) => { putPreference(THEME_STORE, theme); this.setState({ theme }); };
        this.changeDurationDisplay = (durationDisplay) => { putPreference(DURATION_STORE, durationDisplay); this.setState({ durationDisplay }); };
        this.dur = (m) => durationText(m, this.state.durationDisplay);
        this.askConfirm = (title, message, acceptLabel = 'Confirmar', danger = false) => new Promise(resolve => { if (this.confirmResolver) {
            this.confirmResolver(false);
        } this.confirmResolver = resolve; this.setState({ confirmDialog: { title, message, acceptLabel, danger } }); });
        this.resolveConfirm = (accept) => { const resolve = this.confirmResolver; this.confirmResolver = null; this.setState({ confirmDialog: null }); if (resolve)
            resolve(accept); };
        this.renderConfirm = () => { const dialog = this.state.confirmDialog; if (!dialog)
            return null; return React.createElement("div", { className: 'confirmation-backdrop', onMouseDown: e => { if (e.target === e.currentTarget)
                this.resolveConfirm(false); } },
            React.createElement("section", { className: 'confirmation-dialog', role: 'alertdialog', "aria-modal": 'true', "aria-labelledby": 'confirm-title', "aria-describedby": 'confirm-description' },
                React.createElement("div", { className: 'confirmation-symbol ' + (dialog.danger ? 'danger' : '') },
                    React.createElement(Icon, { name: dialog.danger ? 'trash' : 'help', size: 24 })),
                React.createElement("div", { className: 'eyebrow' }, "FULLHOUSE \u00B7 CONFIRMACI\u00D3N"),
                React.createElement("h2", { id: 'confirm-title' }, dialog.title),
                React.createElement("p", { id: 'confirm-description' }, dialog.message),
                React.createElement("div", { className: 'confirmation-actions' },
                    React.createElement(Btn, { kind: 'secondary', onClick: () => this.resolveConfirm(false) }, "Cancelar"),
                    React.createElement(Btn, { kind: dialog.danger ? 'danger' : '', onClick: () => this.resolveConfirm(true) }, dialog.acceptLabel)))); };
        this.setLayout = (layout) => { putPreference(LAYOUT_STORE, layout); this.setState({ modalLayout: layout }); };
        this.finishGuide = () => { putPreference(GUIDE_STORE, 'yes'); this.setState({ guideOpen: false }); };
        this.openGuide = () => this.setState({ modal: null, guideOpen: true, guideStep: 0, page: 'inicio', guideGoalId: '', guideEventId: '' });
        this.openHelp = (topic) => this.setState({ helpOpen: true, helpTopic: topic });
        this.openDetail = (e) => this.setState({ modal: 'detail', activeEventId: e.id, detailPath: [], ...(this.state.guideOpen && this.state.guideStep === 5 && e.id === this.state.guideEventId ? { guideStep: 6 } : {}) });
        this.notice = (message) => this.setState({ toast: message });
        this.save = (data, message = 'Cambios guardados') => {
            try {
                localStorage.setItem(STORE, JSON.stringify(data));
                this.setState({ data });
                this.notice(message);
            }
            catch (err) {
                this.setState({ data });
                this.notice('No se pudo guardar: almacenamiento lleno o bloqueado. Exporta una copia.');
            }
        };
        this.route = (page) => { var _a, _b; if (this.state.guideOpen && this.state.guideStep > 0 && this.state.guideStep < 6 && page !== guideSteps[this.state.guideStep].page) {
            this.setState({ toast: 'Completa este paso de la guía o selecciona «Saltar tutorial».', page: guideSteps[this.state.guideStep].page });
            return;
        } this.setState({ page, modal: null, ...(page === 'hoy' ? { selectedDate: today(), reviewDraft: ((_b = (_a = this.state.data.dayReviews) === null || _a === void 0 ? void 0 : _a[today()]) === null || _b === void 0 ? void 0 : _b.note) || '' } : {}) }); window.scrollTo(0, 0); };
        this.chooseDay = (s) => this.setState({ selectedDate: s, month: firstMonth(s), calendarDetailOpen: this.state.page === 'calendario' });
        this.openGoal = (goal, parentId = '') => {
            var _a;
            const draft = goal ? {
                id: goal.id, title: goal.title, desc: goal.desc, parentId: goal.parentId, area: goal.area || 'purpose', review: goal.review ? { ...goal.review } : undefined, dependsOn: goal.dependsOn || '', startDate: goal.startDate || '', dueDate: goal.dueDate || '', color: goal.color, current: goal.current, target: goal.target, unit: goal.unit, mode: goalMode(goal), status: goalStatus(goal), milestones: goalMilestones(goal).map(m => ({ ...m }))
            } : { ...gDraft(), parentId, area: ((_a = this.state.data.goals.find(g => g.id === parentId)) === null || _a === void 0 ? void 0 : _a.area) || 'purpose' };
            this.initialDraft = JSON.stringify(draft);
            this.setState({ modal: 'goal', colorEditorOpen: false, hexDraft: draft.color, goalDraft: draft });
        };
        this.openRoutine = (r) => { const draft = r ? JSON.parse(JSON.stringify(r)) : rDraft(); this.initialDraft = JSON.stringify(draft); this.setState({ modal: 'routine', routineDraft: draft }); };
        this.openEvent = (e, kind) => {
            if ((e === null || e === void 0 ? void 0 : e.kind) === 'review') {
                const g = this.state.data.goals.find(x => x.id === e.goalId);
                if (g) {
                    this.openGoal(g);
                    return;
                }
            }
            const draft = e ? JSON.parse(JSON.stringify(e)) : { ...eDraft(this.state.selectedDate), ...(kind === 'occasion' ? { kind: 'occasion', allDay: true } : {}) };
            if (e && e.date < today())
                draft.applyFrom = today();
            this.initialDraft = JSON.stringify(draft);
            this.setState({ modal: 'event', eventDraft: draft, datePickerMonth: firstMonth(draft.date) });
        };
        this.openProgress = (g) => this.setState({ modal: 'progress', progressGoalId: g.id, progressValue: String(g.current), progressStatus: goalStatus(g), progressNote: '' });
        this.openExecute = (e) => this.setState({ modal: 'execute', activeEventId: e.id });
        this.close = (force = false) => {
            const m = this.state.modal, draft = m === 'goal' ? this.state.goalDraft : m === 'routine' ? this.state.routineDraft : m === 'event' ? this.state.eventDraft : null;
            const finish = () => { if (this.state.returnToSchedule && m === 'routine' && this.pendingSchedule) {
                const restored = this.pendingSchedule;
                this.pendingSchedule = null;
                this.initialDraft = JSON.stringify(restored);
                this.setState({ modal: 'event', eventDraft: restored, returnToSchedule: false, scheduleContextNote: '' });
            }
            else
                this.setState({ modal: null, detailPath: [], helpOpen: false, returnToSchedule: false, scheduleContextNote: '' }); };
            if (force !== true && draft && JSON.stringify(draft) !== this.initialDraft) {
                this.askConfirm('Salir sin guardar', 'Los cambios que has realizado en esta ventana se perderán.', 'Salir sin guardar', true).then(ok => { if (ok)
                    finish(); });
                return;
            }
            finish();
        };
        this.editRoutineFromSchedule = (reason = '') => {
            const e = this.state.eventDraft, r = this.state.data.routines.find(r => r.id === e.routineId);
            if (!r) {
                this.notice('Selecciona una rutina antes de editar sus pasos.');
                return;
            }
            const advice = reason.includes('Faltan') || reason.includes('exceden') ? 'Reduce la duración de los pasos fijos o modifica los límites del horario.' : reason.includes('Sobran') ? 'Puedes añadir uno o más contenidos flexibles, aumentar la duración de los pasos o cambiar los bloques límite.' : 'Puedes ajustar los minutos de los pasos y añadir contenidos flexibles para absorber el tiempo disponible.';
            this.pendingSchedule = JSON.parse(JSON.stringify(e));
            const draft = JSON.parse(JSON.stringify(r));
            this.initialDraft = JSON.stringify(draft);
            this.setState({ modal: 'routine', routineDraft: draft, returnToSchedule: true, scheduleContextNote: (reason ? reason + '\n\n' : '') + advice });
        };
        this.toggleAdvanced = () => { const advancedOpen = !this.state.advancedOpen; putPreference(ADVANCED_STORE, advancedOpen ? 'yes' : 'no'); this.setState({ advancedOpen }); };
        this.goalPicker = (value, onChange, empty = 'Sin meta vinculada') => {
            const goals = this.state.data.goals, ancestors = new Set(this.state.expandedGoalPick);
            let selected = goals.find(g => g.id === value);
            const traversed = new Set();
            while ((selected === null || selected === void 0 ? void 0 : selected.parentId) && !traversed.has(selected.id)) {
                traversed.add(selected.id);
                ancestors.add(selected.parentId);
                selected = goals.find(g => g.id === selected.parentId);
            }
            const render = (parent, level, seen) => goals.filter(g => g.parentId === parent).map(g => {
                if (seen.has(g.id))
                    return null;
                const childCount = goals.filter(x => x.parentId === g.id).length, expanded = ancestors.has(g.id);
                return React.createElement("div", { key: g.id, className: 'goal-picker-branch' },
                    React.createElement("div", { className: 'goal-picker-entry ' + (value === g.id ? 'chosen' : ''), style: { paddingLeft: (9 + level * 12) + 'px', '--goal-accent': g.color } },
                        React.createElement("button", { type: 'button', className: 'goal-picker-select', onClick: () => { onChange(g.id); if (childCount)
                                this.setState({ expandedGoalPick: [...new Set([...ancestors, g.id])] }); } },
                            React.createElement("span", { className: 'goal-picker-dot', style: { background: g.color } }),
                            React.createElement("span", null, g.title),
                            value === g.id && React.createElement(Icon, { name: 'check', size: 15 })),
                        childCount > 0 && React.createElement("button", { type: 'button', className: 'goal-picker-expand', "aria-label": expanded ? 'Contraer submetas' : 'Mostrar submetas', onClick: () => this.setState({ expandedGoalPick: expanded ? [...ancestors].filter(x => x !== g.id) : [...ancestors, g.id] }) },
                            expanded ? '−' : '+',
                            " ",
                            childCount)),
                    expanded && render(g.id, level + 1, new Set([...seen, g.id])));
            });
            return React.createElement("div", { className: 'goal-picker-tree' },
                React.createElement("button", { type: 'button', className: 'goal-picker-clear ' + (!value ? 'chosen' : ''), onClick: () => onChange('') }, empty),
                render('', 0, new Set()));
        };
        this.beginHelpDrag = (e) => { if (e.target.closest('button'))
            return; e.preventDefault(); const el = e.currentTarget.closest('.help-float'); if (!el)
            return; const rect = el.getBoundingClientRect(), dx = e.clientX - rect.left, dy = e.clientY - rect.top; const move = (p) => this.setState({ helpX: Math.max(4, Math.min(window.innerWidth - 100, p.clientX - dx)), helpY: Math.max(4, Math.min(window.innerHeight - 80, p.clientY - dy)) }); const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); }; document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop, { once: true }); };
        this.updateGoalDraft = (patch) => this.setState({ goalDraft: { ...this.state.goalDraft, ...patch } });
        this.updateRoutineDraft = (patch) => this.setState({ routineDraft: { ...this.state.routineDraft, ...patch } });
        this.updateEventDraft = (patch) => this.setState({ eventDraft: { ...this.state.eventDraft, ...patch } });
        this.startCardDrag = (kind, id, event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', kind + ':' + id); this.setState({ draggedCardType: kind, draggedCardId: id }); };
        this.endCardDrag = () => this.setState({ draggedCardType: '', draggedCardId: '' });
        this.moveCard = (kind, from, to) => {
            const d = this.state.data;
            if (kind === 'goal') {
                const a = d.goals.find(g => g.id === from), b = d.goals.find(g => g.id === to);
                if (!a || !b || a.parentId !== b.parentId)
                    return;
                this.save({ ...d, goals: reorderByIds(d.goals, from, to) }, 'Orden de metas actualizado');
            }
            else
                this.save({ ...d, routines: reorderByIds(d.routines, from, to) }, 'Orden de rutinas actualizado');
            this.endCardDrag();
        };
        this.moveCardKeyboard = (kind, id, delta) => {
            const d = this.state.data;
            const relevant = kind === 'goal' ? d.goals.filter(g => { var _a; return g.parentId === ((_a = d.goals.find(x => x.id === id)) === null || _a === void 0 ? void 0 : _a.parentId); }) : d.routines;
            const i = relevant.findIndex(x => x.id === id), target = relevant[i + delta];
            if (target)
                this.moveCard(kind, id, target.id);
        };
        this.cardDrop = (kind, id, event) => { event.preventDefault(); event.stopPropagation(); if (this.state.draggedCardType === kind && this.state.draggedCardId)
            this.moveCard(kind, this.state.draggedCardId, id); };
        this.routineSchedule = (routineId) => { const items = this.state.data.events.filter(e => e.routineId === routineId); const upcoming = items.filter(e => sameScheduleActive(e, today())).sort((a, b) => a.date.localeCompare(b.date)); return upcoming[0] || items.sort((a, b) => b.date.localeCompare(a.date))[0]; };
        this.chooseRoutineForSchedule = (r) => { const old = this.routineSchedule(r.id); if (old) {
            this.openEvent(old);
            this.notice('Reprogramación: los días anteriores quedarán intactos.');
        }
        else
            this.openEventWithRoutine(r); };
        this.openEventWithRoutine = (r) => { const draft = { ...eDraft(this.state.selectedDate), title: r.title, routineId: r.id, minutes: routineMinutes(r) }; this.initialDraft = JSON.stringify(draft); this.setState({ modal: 'event', eventDraft: draft, datePickerMonth: firstMonth(draft.date) }); };
        this.updateStepDays = (id, variantId, weekday) => {
            const next = editStepTree(this.state.routineDraft.steps, id, s => {
                var _a, _b;
                const mode = (s.mode || 'always') === 'alternatives' ? 'alternatives' : s.mode;
                if (mode === 'selected')
                    return { ...s, days: (s.days || []).includes(weekday) ? (s.days || []).filter(x => x !== weekday) : [...(s.days || []), weekday] };
                if (mode !== 'alternatives')
                    return s;
                const prevBase = s.days || DAYS.filter(n => !(s.variants || []).some(v => v.days.includes(n)));
                const isPicked = variantId ? !!((_b = (_a = s.variants) === null || _a === void 0 ? void 0 : _a.find(v => v.id === variantId)) === null || _b === void 0 ? void 0 : _b.days.includes(weekday)) : prevBase.includes(weekday);
                const base = prevBase.filter(n => n !== weekday);
                const variants = (s.variants || []).map(v => ({ ...v, days: v.days.filter(n => n !== weekday) }));
                if (!isPicked) {
                    if (variantId) {
                        const v = variants.find(v => v.id === variantId);
                        if (v)
                            v.days.push(weekday);
                    }
                    else
                        base.push(weekday);
                }
                return { ...s, days: base, variants };
            });
            this.updateRoutineDraft({ steps: next });
        };
        this.saveGoal = () => {
            var _a, _b;
            const x = this.state.goalDraft;
            if (!x.title.trim()) {
                this.setState({ toast: 'Escribe un nombre para la meta' });
                return;
            }
            if (x.id && (x.parentId === x.id || x.dependsOn === x.id)) {
                this.setState({ toast: 'Una meta no puede depender de sí misma' });
                return;
            }
            if (x.startDate && x.dueDate && x.dueDate < x.startDate) {
                this.setState({ toast: 'La fecha objetivo debe ser posterior al inicio.' });
                return;
            }
            const data = this.state.data;
            const before = data.goals.find(g => g.id === x.id);
            const next = { ...x, id: x.id || uid(), area: x.area || 'purpose', title: x.title.trim(), target: Math.max(0, x.target), current: Math.max(0, x.current), mode: goalMode(x), status: goalStatus(x), milestones: goalMilestones(x).filter(m => m.title.trim()).map(m => ({ ...m, title: m.title.trim() })), history: (before === null || before === void 0 ? void 0 : before.history) || [] };
            const reviewId = 'review-' + next.id;
            const reviews = data.events.filter(e => e.id !== reviewId);
            if ((_a = next.review) === null || _a === void 0 ? void 0 : _a.date) {
                reviews.push({ id: reviewId, kind: 'review', title: 'Revisión · ' + next.title, date: next.review.date, time: next.review.time || '18:00', minutes: 30, goalId: next.id, routineId: '', repeat: next.review.repeat || 'none', note: 'Revisa los avances de la meta, lo que aprendiste y qué conviene ajustar.', overrides: ((_b = data.events.find(e => e.id === reviewId)) === null || _b === void 0 ? void 0 : _b.overrides) || {} });
            }
            this.save({ ...data, goals: before ? data.goals.map(g => g.id === x.id ? next : g) : [...data.goals, next], events: reviews });
            this.close(true);
            if (this.state.guideOpen) {
                if (this.state.guideStep === 1 && !x.id)
                    this.selectGuideGoal(next.id);
                else if (this.state.guideStep === 2 && !x.id && x.parentId === this.state.guideGoalId)
                    this.setState({ guideStep: 3, page: 'calendario', modal: null });
            }
        };
        this.schedulePreview = (draft) => {
            var _a;
            const r = this.state.data.routines.find(x => x.id === draft.routineId);
            const prepared = { ...draft, id: draft.id || '__fh_preview__' };
            const data = { ...this.state.data, events: [...this.state.data.events.filter(x => x.id !== draft.id), prepared] };
            const result = [];
            const start = draft.id && draft.applyFrom && draft.applyFrom > draft.date ? draft.applyFrom : draft.date;
            if (!start)
                return result;
            for (let i = 0; i <= 370 && result.length < 9; i++) {
                const day = addDays(start, i);
                if (!occurs(prepared, day))
                    continue;
                if (result.length >= 8)
                    break;
                const frame = eventFrame(prepared, day, data);
                let issue = '';
                let skipped = false;
                if (draft.anchor === 'between') {
                    const after = data.events.find(x => x.id !== prepared.id && x.routineId === draft.afterRoutineId && occurs(x, day));
                    const before = data.events.find(x => x.id !== prepared.id && x.routineId === draft.beforeRoutineId && occurs(x, day));
                    if (!after || !before) {
                        skipped = true;
                        issue = 'Sin ambos límites programados este día; la rutina no aparecerá.';
                    }
                    else if (!frame)
                        issue = 'No existe un intervalo válido entre los límites.';
                }
                else if (!frame)
                    issue = 'La duración no cabe en este día o los horarios son inválidos.';
                if (frame && r) {
                    const balance = routineBalance(r, day, frame.length, ((_a = data.logs[key(prepared, day)]) === null || _a === void 0 ? void 0 : _a.choices) || {});
                    if (balance.error)
                        issue = balance.error;
                }
                const overlaps = frame ? data.events.filter(item => item.id !== prepared.id && occurs(item, day) && !item.allDay).filter(item => { const f = eventFrame(item, day, data); return !!f && f.start < frame.end && f.end > frame.start; }).map(item => item.title) : [];
                result.push({ date: day, label: fmtDate(day), start: frame ? timeString(frame.start) : '—', end: frame ? timeString(frame.end) : '—', length: (frame === null || frame === void 0 ? void 0 : frame.length) || 0, issue, overlaps, skipped });
                if (draft.repeat === 'none')
                    break;
            }
            return result;
        };
        this.routineIssue = (r) => {
            if (r.durationMode !== 'fixed')
                return '';
            if (!Number.isFinite(r.durationMin) || Number(r.durationMin) < 1)
                return 'Indica una duración fija válida para la rutina.';
            const dates = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
            for (const day of dates) {
                const current = activeSteps(r.steps, day);
                if (!current.length)
                    continue;
                const balance = routineBalance(r, day);
                if (balance.error)
                    return `${weekdayNames[parseDay(day).getDay()]}: ${balance.error}`;
                // Las alternativas que se eligen al ejecutar también deben poder encajar en la duración fija.
                const check = (steps, choices = {}) => {
                    for (const step of steps) {
                        if (step.mode === 'alternatives' && step.chooseWhen === 'execute') {
                            for (const variant of [{ id: '__base' }, ...(step.variants || [])]) {
                                const test = routineBalance(r, day, undefined, { ...choices, [step.id]: variant.id });
                                if (test.error)
                                    return `Alternativa de «${step.title}»: ${test.error}`;
                            }
                        }
                        const nested = check(step.children || [], choices);
                        if (nested)
                            return nested;
                        for (const v of step.variants || []) {
                            const issue = check(v.children || [], choices);
                            if (issue)
                                return issue;
                        }
                    }
                    return '';
                };
                const issue = check(r.steps);
                if (issue)
                    return issue;
            }
            return '';
        };
        this.saveRoutine = () => {
            const x = this.state.routineDraft;
            if (!x.title.trim()) {
                this.setState({ toast: 'Escribe un nombre para la rutina' });
                return;
            }
            if ((function invalid(steps) { return steps.some(s => !s.title.trim() || (s.children && invalid(s.children)) || ((s.variants || []).some(v => !!v.title.trim() && (s.chooseWhen === 'execute' || !!v.days.length) && v.children && invalid(v.children)))); })(x.steps)) {
                this.setState({ toast: 'Todos los pasos necesitan un nombre' });
                return;
            }
            const issue = this.routineIssue(x);
            if (issue) {
                this.notice('Corrige la distribución de tiempo: ' + issue);
                return;
            }
            const data = this.state.data;
            const clean = (steps) => steps.map(s => { var _a; const children = s.children ? clean(s.children) : undefined; return { ...s, title: s.title.trim(), children, variants: (_a = s.variants) === null || _a === void 0 ? void 0 : _a.filter(v => v.title.trim() && (s.chooseWhen === 'execute' || v.days.length)).map(v => ({ ...v, title: v.title.trim(), days: [...new Set(v.days)], children: v.children ? clean(v.children) : undefined, min: Math.max(0, v.min) })), min: children && children.length ? children.reduce((a, c) => a + stepMinutes(c), 0) : s.flexible ? Math.max(5, s.min) : Math.max(1, s.min), mode: s.mode || ((s.variants || []).length ? 'alternatives' : 'always') }; });
            const result = { ...x, id: x.id || uid(), title: x.title.trim(), steps: clean(x.steps) };
            this.save({ ...data, routines: x.id ? data.routines.map(r => r.id === x.id ? result : r) : [...data.routines, result], events: data.events.map(e => e.routineId === result.id ? { ...e, minutes: routineMinutes(result) } : e) });
            if (this.state.returnToSchedule && this.pendingSchedule) {
                const draft = this.pendingSchedule;
                this.pendingSchedule = null;
                this.initialDraft = JSON.stringify(draft);
                this.setState({ modal: 'event', eventDraft: draft, returnToSchedule: false, scheduleContextNote: '' });
            }
            else
                this.close(true);
        };
        this.saveEvent = async () => {
            const x = this.state.eventDraft;
            if (!x.title.trim() || !x.date || (!x.allDay && !x.time)) {
                this.notice('Completa el nombre, la fecha y la hora.');
                return;
            }
            if (x.kind === 'occasion' && x.endDate && x.endDate < x.date) {
                this.notice('La fecha final no puede ser anterior a la inicial.');
                return;
            }
            if (x.repeat === 'custom' && !(x.repeatDays || []).length) {
                this.notice('Selecciona los días en que quieres repetirlo.');
                return;
            }
            if (x.repeat === 'dates' && (x.specificDates || []).some(day => !day || day < x.date)) {
                this.notice('Las fechas específicas deben ser posteriores al comienzo.');
                return;
            }
            const data = this.state.data;
            const previewRows = this.schedulePreview(x);
            const blocking = previewRows.filter(row => row.issue && !row.skipped);
            if (x.routineId && blocking.length) {
                const details = blocking.slice(0, 3).map(row => `${row.label}: ${row.issue}`).join('\n');
                if (await this.askConfirm('La rutina necesita ajustes', `No se puede programar todavía.\n\n${details}\n\nPuedes editar sus tiempos y volver a esta programación sin perder lo que has rellenado.`, 'Editar rutina'))
                    this.editRoutineFromSchedule(details);
                return;
            }
            const original = data.events.find(e => e.id === x.id);
            if ((original === null || original === void 0 ? void 0 : original.kind) === 'review') {
                this.notice('Las revisiones se editan desde la meta.');
                return;
            }
            const scheduleChanged = !!original && (original.time !== x.time || original.endTime !== x.endTime || original.anchor !== x.anchor || original.afterRoutineId !== x.afterRoutineId || original.beforeRoutineId !== x.beforeRoutineId || original.date !== x.date || original.endDate !== x.endDate || original.repeat !== x.repeat || JSON.stringify(original.repeatDays || []) !== JSON.stringify(x.repeatDays || []) || original.everyDays !== x.everyDays || JSON.stringify(original.specificDates || []) !== JSON.stringify(x.specificDates || []));
            const impacted = (original === null || original === void 0 ? void 0 : original.routineId) ? data.events.filter(item => item.anchor === 'between' && (item.afterRoutineId === original.routineId || item.beforeRoutineId === original.routineId) && sameScheduleActive(item, today())) : [];
            if (original && scheduleChanged && !(await this.askConfirm('Reprogramar actividad', 'Se actualizarán las próximas fechas y el resto de hoy desde la fecha elegida, sin modificar los registros pasados.' + (impacted.length ? '\n\n' + impacted.length + ' bloque(s) dependiente(s) se reajustarán automáticamente.' : ''), 'Reprogramar')))
                return;
            const startChange = original ? (x.applyFrom || today()) : x.date;
            if (original && startChange < today()) {
                this.notice('La reprogramación debe aplicarse desde hoy o una fecha posterior.');
                return;
            }
            const cut = !!original && original.date < startChange && original.date < today() && (original.repeat !== 'none' || original.endDate >= today());
            const result = { ...x, id: x.id || uid(), title: x.title.trim(), minutes: Math.max(1, x.minutes), specificDates: [...new Set((x.specificDates || []).filter(Boolean))], overrides: x.overrides || {} };
            if (result.anchor === 'end' && result.endTime) {
                const duration = result.routineId ? Math.max(1, routineMinutesOn(data.routines.find(r => r.id === result.routineId) || { id: '', title: '', desc: '', steps: [] }, result.date)) : result.minutes;
                if (minutes(result.endTime) < duration) {
                    this.notice('La duración no cabe antes de la hora de término. Elige otra hora.');
                    return;
                }
                result.time = timeString(minutes(result.endTime) - duration);
            }
            if (result.kind === 'occasion' && result.endDate && result.endDate > result.date && result.repeat !== 'none') {
                this.notice('Los eventos de varios días se programan sin repetición. Puedes crear otro evento para un periodo diferente.');
                return;
            }
            const finalStart = cut ? (x.date > startChange ? x.date : startChange) : x.date;
            const future = cut ? { ...result, id: uid(), date: finalStart, overrides: Object.fromEntries(Object.entries(result.overrides || {}).filter(([day]) => day >= finalStart)), specificDates: (result.specificDates || []).filter(day => day >= finalStart) } : result;
            if (future.routineId) {
                const conflict = data.events.find(other => other.routineId === future.routineId && other.id !== result.id && other.id !== (original === null || original === void 0 ? void 0 : original.id) && sameScheduleActive(other, today()));
                if (conflict) {
                    this.notice('Esta rutina ya tiene una programación futura. Utiliza Reprogramar desde la tarjeta de rutinas.');
                    return;
                }
            }
            const cleanFuture = { ...future, applyFrom: undefined };
            if (cleanFuture.anchor === 'between') {
                if (!cleanFuture.routineId || !cleanFuture.afterRoutineId || !cleanFuture.beforeRoutineId || cleanFuture.afterRoutineId === cleanFuture.beforeRoutineId || [cleanFuture.afterRoutineId, cleanFuture.beforeRoutineId].includes(cleanFuture.routineId)) {
                    this.notice('Elige una rutina para este bloque y dos rutinas límite diferentes.');
                    return;
                }
                const hypothetical = { ...data, events: [...data.events.filter(e => e.id !== (original === null || original === void 0 ? void 0 : original.id) && e.id !== cleanFuture.id), cleanFuture] };
                if (!eventFrame(cleanFuture, cleanFuture.date, hypothetical)) {
                    this.notice('No hay un intervalo válido entre las dos rutinas en la fecha inicial. Revisa días, horarios y dependencias circulares.');
                    return;
                }
                const steps = routineForDay(cleanFuture, cleanFuture.date, hypothetical), frame = eventFrame(cleanFuture, cleanFuture.date, hypothetical);
                if (routineBalance(data.routines.find(r => r.id === cleanFuture.routineId) || { id: '', title: '', desc: '', steps: [] }, cleanFuture.date, frame.length).error) {
                    this.notice('El intervalo no se ajusta a los pasos de esta rutina. Edita la duración o agrega contenidos flexibles.');
                    return;
                }
            }
            const withOverlap = async (next) => {
                const target = next.events.find(item => item.id === cleanFuture.id);
                if (!target || target.overlapMode !== 'move' || target.repeat !== 'none' || target.allDay || target.anchor === 'between')
                    return next;
                const date = target.date, span = eventFrame(target, date, next);
                if (!span)
                    return next;
                const clashes = eventsOn(next, date).filter(item => item.id !== target.id && !item.allDay && !!eventFrame(item, date, next) && eventFrame(item, date, next).start < span.end && eventFrame(item, date, next).end > span.start);
                if (!clashes.length)
                    return next;
                if (clashes.some(item => item.anchor === 'between')) {
                    this.notice('Un bloque flexible coincide con el evento. Elige mantener el solapamiento o cambia los límites.');
                    return null;
                }
                if (!(await this.askConfirm('Posponer bloques de este día', 'Se moverán los bloques solapados del ' + date + '. Su orden y duración se conservarán, y los demás días no cambiarán.', 'Posponer bloques')))
                    return null;
                let cursor = span.end;
                let updated = next.events.map(item => ({ ...item, overrides: { ...item.overrides } }));
                const others = eventsOn(next, date).filter(item => item.id !== target.id && !item.allDay && item.anchor !== 'between').sort((a, b) => scheduleStart(a, date, next) - scheduleStart(b, date, next));
                for (const item of others) {
                    const f = eventFrame(item, date, { ...next, events: updated });
                    if (!f)
                        continue;
                    if (f.end <= span.start)
                        continue;
                    if (f.start < cursor) {
                        if (cursor + f.length > 1440) {
                            this.notice('No es posible posponer los bloques sin salir del día. Mantén el solapamiento o elige otra hora.');
                            return null;
                        }
                        updated = updated.map(x => x.id === item.id ? { ...x, overrides: { ...x.overrides, [date]: { ...x.overrides[date], time: timeString(cursor) } } } : x);
                        cursor += f.length;
                    }
                    else
                        cursor = f.end;
                }
                const adjusted = { ...next, events: updated };
                const broken = next.events.filter(item => item.anchor === 'between' && occurs(item, date) && !!eventFrame(item, date, next) && !eventFrame(item, date, adjusted));
                if (broken.length) {
                    this.notice('El desplazamiento dejaría sin intervalo a «' + broken[0].title + '». Mantén el solapamiento o ajusta las rutinas límite.');
                    return null;
                }
                return adjusted;
            };
            if (cut && original) {
                const endDate = addDays(finalStart, -1);
                const history = { ...original, endDate: original.endDate && original.endDate < endDate ? original.endDate : endDate, overrides: Object.fromEntries(Object.entries(original.overrides || {}).filter(([day]) => day < finalStart)) };
                const logs = { ...data.logs };
                Object.keys(logs).filter(k => k.startsWith(original.id + '@') && k.split('@')[1] >= finalStart).forEach(k => { logs[cleanFuture.id + '@' + k.split('@')[1]] = logs[k]; delete logs[k]; });
                const nextData = { ...data, events: [...data.events.map(e => e.id === original.id ? history : e), cleanFuture], logs };
                const planned = await withOverlap(nextData);
                if (!planned)
                    return;
                this.save(planned, 'Programación actualizada desde ' + finalStart);
            }
            else {
                if (future.routineId && data.events.some(other => other.id !== result.id && other.routineId === future.routineId && sameScheduleActive(other, today()))) {
                    this.notice('Esta rutina ya está programada. Reprograma la existente.');
                    return;
                }
                const planned = await withOverlap({ ...data, events: x.id ? data.events.map(e => e.id === x.id ? cleanFuture : e) : [...data.events, cleanFuture] });
                if (!planned)
                    return;
                this.save(planned, 'Actividad guardada');
            }
            this.close(true);
            if (this.state.guideOpen) {
                if (this.state.guideStep === 3 && result.goalId === this.state.guideGoalId)
                    this.setState({ guideStep: 4, page: 'rutinas' });
                else if (this.state.guideStep === 4 && result.routineId) {
                    this.setState({ guideStep: 5, page: 'horario', selectedDate: result.date, month: firstMonth(result.date), guideEventId: cleanFuture.id });
                }
            }
        };
        this.deleteGoal = async (g) => {
            if (!(await this.askConfirm('Eliminar meta', `¿Eliminar «${g.title}»? Las submetas pasarán a ser independientes.`, 'Eliminar meta', true)))
                return;
            const d = this.state.data;
            this.save({ ...d, goals: d.goals.filter(x => x.id !== g.id).map(x => x.parentId === g.id ? { ...x, parentId: '' } : x), events: d.events.filter(e => e.id !== 'review-' + g.id).map(e => e.goalId === g.id ? { ...e, goalId: '' } : e) });
        };
        /* Eliminar una programación conserva el pasado y cancela los bloques que dependen de ella. */
        this.cancelFutureDependencies = (d, routineId, from = today()) => {
            const selected = new Set([routineId]);
            let progress = true;
            while (progress) {
                progress = false;
                d.events.forEach(e => { if (e.routineId && !selected.has(e.routineId) && e.anchor === 'between' && (selected.has(e.afterRoutineId || '') || selected.has(e.beforeRoutineId || ''))) {
                    selected.add(e.routineId);
                    progress = true;
                } });
            }
            const remove = d.events.filter(e => e.anchor === 'between' && e.routineId && selected.has(e.routineId));
            const removes = new Set(remove.map(e => e.id));
            const revised = d.events.flatMap(e => {
                if (!removes.has(e.id))
                    return [e];
                if (e.date >= from)
                    return [];
                const end = addDays(from, -1);
                return [{ ...e, endDate: e.endDate && e.endDate < end ? e.endDate : end }];
            });
            return { ...d, events: revised };
        };
        this.deleteRoutine = async (r) => {
            const dependents = this.state.data.events.filter(e => e.anchor === 'between' && (e.afterRoutineId === r.id || e.beforeRoutineId === r.id));
            if (!(await this.askConfirm('Eliminar rutina', `¿Eliminar «${r.title}»? Las actividades conservarán su nombre pero perderán sus pasos.${dependents.length ? '\n\nSe cancelarán las programaciones futuras de ' + dependents.length + ' bloque(s) dependiente(s); se conserva el historial.' : ''}`, 'Eliminar rutina', true)))
                return;
            const d = this.state.data;
            const next = this.cancelFutureDependencies({ ...d, routines: d.routines.filter(x => x.id !== r.id), events: d.events.map(e => e.routineId === r.id ? { ...e, routineId: '' } : e) }, r.id);
            this.save(next);
            this.close(true);
        };
        this.deleteEvent = async (e) => {
            const dependents = e.routineId ? this.state.data.events.filter(x => x.anchor === 'between' && (x.afterRoutineId === e.routineId || x.beforeRoutineId === e.routineId)) : [];
            if (!(await this.askConfirm('Eliminar programación', (e.repeat === 'none' ? '¿Eliminar esta actividad?' : '¿Eliminar esta programación y sus próximas apariciones?') + (dependents.length ? '\n\nSe cancelarán ' + dependents.length + ' bloques dependientes futuros. Los registros pasados se conservarán.' : ''), 'Eliminar', true)))
                return;
            const d = this.state.data, from = today();
            const logs = { ...d.logs };
            // Si hoy ya tiene un registro, conservar también esa ejecución en el historial.
            const cutoff = logs[key(e, from)] ? addDays(from, 1) : from;
            const old = e.date < cutoff;
            const updated = d.events.flatMap(item => item.id !== e.id ? [item] : old ? [{ ...item, endDate: addDays(cutoff, -1) }] : []);
            const next = (e.routineId && sameScheduleActive(e, from) ? this.cancelFutureDependencies({ ...d, events: updated, goals: e.kind === 'review' ? d.goals.map(g => g.id === e.goalId ? { ...g, review: undefined } : g) : d.goals, logs }, e.routineId, cutoff) : { ...d, events: updated, goals: e.kind === 'review' ? d.goals.map(g => g.id === e.goalId ? { ...g, review: undefined } : g) : d.goals, logs });
            this.save(next);
            this.close(true);
        };
        this.saveEvidence = async (e, date, stepId, file) => {
            if (!file || !file.type.startsWith('image/')) {
                this.notice('Selecciona una imagen válida.');
                return;
            }
            if (file.size > 12 * 1024 * 1024) {
                this.notice('La imagen es demasiado grande. Prueba con una de menos de 12 MB.');
                return;
            }
            try {
                const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Lectura fallida')); reader.onload = () => { const img = new Image(); img.onload = () => { const ratio = Math.min(1, 1100 / Math.max(img.width, img.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio); const ctx = canvas.getContext('2d'); if (!ctx) {
                    reject(new Error('Lienzo no disponible'));
                    return;
                } ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .66)); }; img.onerror = () => reject(new Error('Formato no compatible')); img.src = String(reader.result); }; reader.readAsDataURL(file); });
                if (src.length > 600000) {
                    this.notice('La fotografía ocupa mucho almacenamiento local. Prueba con una imagen más pequeña.');
                    return;
                }
                const data = this.state.data, k = key(e, date), old = data.logs[k] || { completed: false, checkedSteps: [] };
                const evidence = { id: uid(), kind: 'image', src, caption: '', stepId: stepId || undefined, createdAt: new Date().toISOString() };
                this.save({ ...data, logs: { ...data.logs, [k]: { ...old, evidences: [...(old.evidences || []), evidence] } } }, 'Imagen añadida al registro');
            }
            catch (err) {
                this.notice('No se pudo guardar la imagen. Revisa su formato o el espacio disponible.');
            }
        };
        this.deleteEvidence = async (e, date, id) => { if (!await this.askConfirm('Quitar evidencia', 'Se eliminará esta foto del registro local.', 'Quitar foto', true))
            return; const d = this.state.data, k = key(e, date), log = d.logs[k]; if (!log)
            return; this.save({ ...d, logs: { ...d.logs, [k]: { ...log, evidences: (log.evidences || []).filter(x => x.id !== id) } } }, 'Foto eliminada'); };
        this.evidenceSection = (e, date, stepId = '') => {
            var _a;
            const items = (((_a = this.state.data.logs[key(e, date)]) === null || _a === void 0 ? void 0 : _a.evidences) || []).filter(a => (a.stepId || '') === stepId);
            return React.createElement("div", { className: 'evidence-section' },
                React.createElement("label", { className: 'evidence-upload' },
                    React.createElement(Icon, { name: 'plus', size: 15 }),
                    React.createElement("span", null, "Adjuntar foto o recuerdo"),
                    React.createElement("input", { type: 'file', accept: 'image/*', onChange: ev => { var _a; const f = (_a = ev.target.files) === null || _a === void 0 ? void 0 : _a[0]; if (f)
                            this.saveEvidence(e, date, stepId, f); ev.target.value = ''; } })),
                items.length > 0 && React.createElement("div", { className: 'evidence-gallery' }, items.map(pic => React.createElement("div", { className: 'evidence-thumb', key: pic.id },
                    React.createElement("img", { src: pic.src, alt: pic.caption || 'Fotografía del registro diario', onClick: () => window.open(pic.src, '_blank') }),
                    React.createElement("button", { title: 'Quitar fotograf\u00EDa', onClick: () => this.deleteEvidence(e, date, pic.id) }, "\u00D7")))));
        };
        this.saveDayReview = () => { const d = this.state.data, date = today(); this.save({ ...d, dayReviews: { ...d.dayReviews, [date]: { note: this.state.reviewDraft, closedAt: new Date().toISOString() } } }, 'Revisión del día guardada'); };
        this.toggleEvent = (e, date) => {
            const d = this.state.data, k = key(e, date), r = d.logs[k] || { completed: false, checkedSteps: [] };
            const original = d.routines.find(x => x.id === e.routineId);
            if (!r.completed && original && unresolvedManual(activeSteps(original.steps, date, r.choices || {}), r.choices || {}).length) {
                this.notice('Antes de completar la rutina, elige las alternativas desde Ejecutar rutina.');
                return;
            }
            this.save({ ...d, logs: { ...d.logs, [k]: { ...r, completed: !r.completed } } }, 'Actividad actualizada');
        };
        this.toggleStep = (e, date, stepId) => {
            const d = this.state.data, k = key(e, date), r = d.logs[k] || { completed: false, checkedSteps: [] };
            const routine = d.routines.find(x => x.id === e.routineId);
            const checked = r.checkedSteps.includes(stepId) ? r.checkedSteps.filter(s => s !== stepId) : [...r.checkedSteps, stepId];
            const choices = r.choices || {};
            const leaves = routine ? leafSteps(activeSteps(routine.steps, date, choices)) : [];
            const pending = routine ? unresolvedManual(activeSteps(routine.steps, date, choices), choices) : [];
            const completed = leaves.length > 0 && pending.length === 0 && leaves.every(s => checked.includes(s.id));
            this.save({ ...d, logs: { ...d.logs, [k]: { ...r, checkedSteps: checked, completed } } }, 'Paso actualizado');
        };
        this.saveOccurrenceNote = (e, date, text, stepId) => {
            const d = this.state.data, k = key(e, date), log = d.logs[k] || { completed: false, checkedSteps: [] };
            const value = text.trim();
            const updated = stepId ? { ...log, stepNotes: { ...log.stepNotes, [stepId]: value } } : { ...log, note: value };
            this.save({ ...d, logs: { ...d.logs, [k]: updated } }, 'Nota guardada en el historial');
        };
        this.selectVariant = (e, date, stepId, choice) => {
            const d = this.state.data, k = key(e, date), r = d.logs[k] || { completed: false, checkedSteps: [] };
            this.save({ ...d, logs: { ...d.logs, [k]: { ...r, choices: { ...r.choices, [stepId]: choice }, checkedSteps: [], completed: false } } }, 'Elección guardada solo para este día');
        };
        this.shiftEvent = (e, date, delta) => {
            if (e.anchor === 'between') {
                this.notice('Este bloque depende de dos rutinas. Para moverlo, reprograma alguna de sus rutinas límite.');
                return;
            }
            const d = this.state.data;
            const newTime = timeString(bound(minutes(eventTime(e, date, d)) + delta, 0, 1439));
            const next = { ...e, overrides: { ...e.overrides, [date]: { ...e.overrides[date], time: newTime } } };
            const newData = { ...d, events: d.events.map(x => x.id === e.id ? next : x) };
            const affected = e.routineId ? d.events.filter(x => x.anchor === 'between' && (x.afterRoutineId === e.routineId || x.beforeRoutineId === e.routineId) && occurs(x, date)) : [];
            if (affected.some(x => !!eventFrame(x, date, d) && !eventFrame(x, date, newData))) {
                this.notice('El cambio dejaría sin espacio a un bloque dependiente. Edita las horas de sus rutinas límite.');
                return;
            }
            this.save(newData, `Actividad movida a las ${newTime}` + (affected.length ? ' · Bloques dependientes ajustados' : ''));
        };
        this.saveProgress = () => {
            const d = this.state.data, g = d.goals.find(x => x.id === this.state.progressGoalId);
            if (!g)
                return;
            const mode = goalMode(g), val = mode === 'numeric' ? Number(this.state.progressValue.replace(',', '.')) : g.current;
            if (mode === 'numeric' && (!Number.isFinite(val) || val < 0)) {
                this.setState({ toast: 'Registra un valor válido mayor o igual a cero' });
                return;
            }
            const next = { ...g, current: val, status: mode === 'qualitative' ? this.state.progressStatus : goalStatus(g), history: [...g.history, { date: today(), value: val, note: this.state.progressNote.trim(), status: mode === 'qualitative' ? this.state.progressStatus : undefined }] };
            this.save({ ...d, goals: d.goals.map(x => x.id === g.id ? next : x) }, 'Avance registrado');
            this.close();
        };
        this.toggleMilestone = (goalId, milestoneId) => { const d = this.state.data; const g = d.goals.find(x => x.id === goalId); if (!g)
            return; const ms = goalMilestones(g).map(m => m.id === milestoneId ? { ...m, done: !m.done } : m); const n = ms.filter(m => m.done).length; const next = { ...g, milestones: ms, current: n, target: ms.length, history: [...g.history, { date: today(), value: n, note: 'Hito actualizado' }] }; this.save({ ...d, goals: d.goals.map(x => x.id === goalId ? next : x) }, 'Hito actualizado'); };
        this.exportData = () => {
            const blob = new Blob([JSON.stringify(this.state.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fullhouse-respaldo-${today()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            this.notice('Respaldo descargado. Guárdalo en un lugar seguro.');
        };
        this.importData = async (ev) => {
            var _a;
            const f = (_a = ev.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!f)
                return;
            if (!(await this.askConfirm('Restaurar respaldo', 'Esto sustituirá todos los datos actuales de este navegador. Exporta una copia antes de continuar.', 'Restaurar datos', true))) {
                ev.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const d = JSON.parse(String(reader.result));
                    if (!validData(d))
                        throw Error('Formato incompatible');
                    this.save(d, 'Respaldo restaurado');
                    this.setState({ page: 'inicio', modal: null });
                }
                catch (err) {
                    this.setState({ toast: 'Archivo inválido o incompatible. No se modificó la información.' });
                }
            };
            reader.readAsText(f);
            ev.target.value = '';
        };
        this.reset = async () => {
            if (!(await this.askConfirm('Restablecer ejemplos', 'Se perderán los datos actuales. Descarga un respaldo antes de continuar.', 'Restablecer', true)))
                return;
            this.save(seed(), 'Ejemplos restablecidos');
            this.setState({ page: 'inicio', selectedDate: today(), month: firstMonth(today()) });
        };
        this.childrenOf = (id) => this.state.data.goals.filter(g => g.parentId === id);
        this.descendants = (id) => {
            const all = [];
            const go = (x) => this.state.data.goals.filter(g => g.parentId === x).forEach(g => { if (!all.includes(g.id)) {
                all.push(g.id);
                go(g.id);
            } });
            go(id);
            return all;
        };
        this.selectGuideGoal = (id) => { if (this.state.guideOpen && this.state.guideStep === 1)
            this.setState({ guideGoalId: id, guideStep: 2, page: 'metas' }); };
        this.guideAction = () => {
            var _a;
            const step = this.state.guideStep, goal = this.state.data.goals.find(g => g.id === this.state.guideGoalId);
            if (step === 0) {
                this.setState({ guideStep: 1, page: 'metas' });
                return;
            }
            if (step === 1) {
                this.setState({ page: 'metas' });
                this.openGoal();
                return;
            }
            if (step === 2) {
                this.openGoal(undefined, this.state.guideGoalId);
                return;
            }
            if (step === 3) {
                this.setState({ page: 'calendario', modal: 'event', eventDraft: { ...eDraft(addDays(today(), 7)), title: 'Revisión de avance: ' + ((goal === null || goal === void 0 ? void 0 : goal.title) || 'mi meta'), goalId: this.state.guideGoalId, time: '19:00', minutes: 30 } });
                return;
            }
            if (step === 4) {
                const r = this.state.data.routines[0];
                if (!r) {
                    this.openRoutine();
                    this.setState({ toast: 'Crea una rutina antes de programarla.' });
                    return;
                }
                this.useRoutineForGuide(r);
                return;
            }
            if (step === 5) {
                this.setState({ page: 'horario', selectedDate: ((_a = this.state.data.events.find(e => e.id === this.state.guideEventId)) === null || _a === void 0 ? void 0 : _a.date) || today(), modal: null });
                return;
            }
            this.finishGuide();
        };
        this.useRoutineForGuide = (r) => {
            const existing = this.state.data.events.find(e => e.routineId === r.id && occurs(e, today()));
            if (existing) {
                this.setState({ guideEventId: existing.id, guideStep: 5, page: 'horario', selectedDate: today(), month: firstMonth(today()), modal: null, toast: 'Esta rutina ya estaba programada. Ábrela en el horario.' });
                return;
            }
            this.setState({ modal: 'event', eventDraft: { ...eDraft(today()), title: r.title, goalId: this.state.guideGoalId, routineId: r.id, minutes: routineMinutes(r), repeat: 'daily', time: '08:00' } });
        };
        this.startStepDrag = (id, e) => { e.preventDefault(); document.addEventListener('mousemove', this.moveStepDrag, true); document.addEventListener('mouseup', this.endStepDrag, true); document.addEventListener('touchmove', this.moveStepDrag, { capture: true, passive: false }); document.addEventListener('touchend', this.endStepDrag, true); this.setState({ draggedStepId: id, dragTargetId: id }); };
        this.moveStepDrag = (e) => { var _a, _b, _c; if (!this.state.draggedStepId)
            return; const point = ((_a = e.touches) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = e.changedTouches) === null || _b === void 0 ? void 0 : _b[0]) || e; const t = (_c = document.elementFromPoint(point.clientX, point.clientY)) === null || _c === void 0 ? void 0 : _c.closest('[data-step-id]'); if ((t === null || t === void 0 ? void 0 : t.dataset.stepId) && t.dataset.stepId !== this.state.dragTargetId)
            this.setState({ dragTargetId: t.dataset.stepId }); };
        this.endStepDrag = () => { document.removeEventListener('mousemove', this.moveStepDrag, true); document.removeEventListener('mouseup', this.endStepDrag, true); document.removeEventListener('touchmove', this.moveStepDrag, true); document.removeEventListener('touchend', this.endStepDrag, true); const { draggedStepId, dragTargetId } = this.state; if (draggedStepId && dragTargetId && draggedStepId !== dragTargetId) {
            const r = reorderTree(this.state.routineDraft.steps, draggedStepId, dragTargetId);
            if (r.moved)
                this.updateRoutineDraft({ steps: r.steps });
        } this.setState({ draggedStepId: '', dragTargetId: '' }); };
        this.moveStepDragKeyboard = (id, delta) => this.updateRoutineDraft({ steps: moveStepTree(this.state.routineDraft.steps, id, delta) });
        this.hint = (topic) => React.createElement("button", { type: "button", className: "hint-btn", title: "\u00BFC\u00F3mo funciona esta secci\u00F3n?", "aria-label": 'Ayuda de ' + topic, onClick: () => this.openHelp(topic) }, "?");
        this.changeMonth = (offset) => { const d = parseDay(this.state.month); d.setMonth(d.getMonth() + offset); const newMonth = ymd(d); this.setState({ month: newMonth, selectedDate: newMonth }); };
        this.weekdayPicker = (days, select) => React.createElement("div", { className: 'weekday-options' }, weekdayNames.map((day, n) => React.createElement("button", { type: 'button', key: n, className: 'weekday-pill ' + (days.includes(n) ? 'active' : ''), "aria-pressed": days.includes(n), title: longDays[n], onClick: () => select(n) }, day)));
        this.renderStepEditor = (steps, level = 0) => {
            const update = (id, patch) => this.updateRoutineDraft({ steps: editStepTree(this.state.routineDraft.steps, id, s => ({ ...s, ...patch })) });
            return React.createElement("div", { className: 'step-editor-list ' + (level ? 'nested' : '') }, steps.map((s, i) => {
                var _a, _b, _c;
                const hasChildren = !!((_a = s.children) === null || _a === void 0 ? void 0 : _a.length);
                const mode = s.mode || ((s.variants || []).length ? 'alternatives' : 'always');
                const baseDays = s.days || DAYS.filter(d => !(s.variants || []).some(v => v.days.includes(d)));
                const tint = goalColor(this.state.data, s.goalId);
                return React.createElement("div", { className: 'step-editor-card ' + (this.state.dragTargetId === s.id && this.state.draggedStepId !== s.id ? 'drop-target' : ''), style: tint ? { '--linked-goal-color': tint } : {}, "data-step-id": s.id, key: s.id },
                    React.createElement("div", { className: 'step-edit-head' },
                        React.createElement("span", { className: 'step-type-tag' },
                            stepLevelName(level),
                            " ",
                            i + 1),
                        React.createElement("span", { className: 'step-duration-summary' },
                            React.createElement(Icon, { name: 'clock', size: 14 }),
                            " ",
                            s.flexible ? 'Tiempo variable' : this.dur(stepMinutes(s)),
                            " ",
                            hasChildren ? '· calculados' : ''),
                        React.createElement("button", { className: 'drag-handle', title: 'Arrastra para reordenar', "aria-label": 'Arrastrar ' + stepLevelName(level) + ' ' + (i + 1), onMouseDown: e => this.startStepDrag(s.id, e), onTouchStart: e => this.startStepDrag(s.id, e), onKeyDown: e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                this.moveStepDragKeyboard(s.id, e.key === 'ArrowUp' ? -1 : 1);
                            } } },
                            React.createElement(Icon, { name: 'grip', size: 18 })),
                        React.createElement("button", { className: 'icon-btn remove-step', title: 'Eliminar este elemento', onClick: () => this.updateRoutineDraft({ steps: deleteStepTree(this.state.routineDraft.steps, s.id) }) },
                            React.createElement(Icon, { name: 'trash', size: 15 }))),
                    React.createElement("div", { className: 'step-mode-choices' },
                        React.createElement("button", { className: mode === 'always' ? 'active' : '', onClick: () => update(s.id, { mode: 'always' }) },
                            React.createElement("strong", null, "Siempre"),
                            React.createElement("small", null, "Se hace cada vez")),
                        React.createElement("button", { className: mode === 'selected' ? 'active' : '', onClick: () => update(s.id, { mode: 'selected', days: s.days || [1, 3, 5] }) },
                            React.createElement("strong", null, "Solo ciertos d\u00EDas"),
                            React.createElement("small", null, "Aparece cuando corresponde")),
                        React.createElement("button", { className: mode === 'alternatives' ? 'active' : '', onClick: () => update(s.id, { mode: 'alternatives', days: s.days || DAYS.filter(n => !(s.variants || []).some(v => v.days.includes(n))) }) },
                            React.createElement("strong", null, "Alternativas"),
                            React.createElement("small", null, "Seg\u00FAn el d\u00EDa o al ejecutar"))),
                    mode === 'selected' && React.createElement("div", { className: 'step-conditional' },
                        React.createElement("label", null, "D\u00EDas en los que se realiza"),
                        this.weekdayPicker(s.days || [], day => this.updateStepDays(s.id, undefined, day))),
                    mode === 'alternatives' && React.createElement("div", { className: 'step-conditional' },
                        React.createElement("div", { className: 'alternative-frequency' },
                            React.createElement("strong", null, "\u00BFC\u00F3mo se elige la alternativa?"),
                            React.createElement("div", { className: 'time-anchor-choice' },
                                React.createElement("button", { type: 'button', className: s.chooseWhen !== 'execute' ? 'active' : '', onClick: () => update(s.id, { chooseWhen: 'weekday' }) }, "Por d\u00EDa de semana"),
                                React.createElement("button", { type: 'button', className: s.chooseWhen === 'execute' ? 'active' : '', onClick: () => update(s.id, { chooseWhen: 'execute' }) }, "Al ejecutar la rutina"))),
                        s.chooseWhen !== 'execute' && React.createElement(React.Fragment, null,
                            React.createElement("div", { className: 'step-base-label' },
                                React.createElement("strong", null,
                                    "Alternativa 1 \u00B7 ",
                                    s.title || 'sin nombre'),
                                React.createElement("small", null, "Es una opci\u00F3n m\u00E1s, con el mismo valor que las dem\u00E1s.")),
                            this.weekdayPicker(baseDays, day => this.updateStepDays(s.id, undefined, day)))),
                    React.createElement("div", { className: 'step-edit-fields' },
                        React.createElement("input", { "aria-label": 'Nombre de ' + stepLevelName(level).toLowerCase() + ' ' + (i + 1), value: s.title, onChange: e => update(s.id, { title: e.target.value }), placeholder: mode === 'alternatives' ? 'Nombre de la alternativa 1' : level === 0 ? 'Nombre del paso' : 'Nombre del ' + stepLevelName(level).toLowerCase() }),
                        hasChildren ? React.createElement("span", { className: 'step-readonly-time', title: 'La duraci\u00F3n se calcula sumando los elementos hijos' },
                            "\u03A3 ",
                            this.dur(stepMinutes(s))) : s.flexible ? React.createElement("span", { className: 'step-readonly-time' }, "\u2194 Reparto variable") : React.createElement("label", { className: 'step-time-field' },
                            "min ",
                            React.createElement(NumberField, { value: s.min, min: 1, max: 1440, ariaLabel: 'Duraci\u00F3n en minutos', onCommit: min => update(s.id, { min }) }))),
                    !hasChildren && React.createElement("label", { className: 'step-flex-toggle' },
                        React.createElement("input", { type: 'checkbox', checked: !!s.flexible, onChange: e => update(s.id, { flexible: e.target.checked, min: e.target.checked ? 30 : Math.max(5, s.min) }) }),
                        React.createElement("span", null,
                            React.createElement("strong", null, "Tiempo flexible"),
                            React.createElement("small", null, "Este paso ocupa el tiempo libre del bloque (ideal para tareas de duraci\u00F3n variable entre dos rutinas)."))),
                    s.flexible && !hasChildren && React.createElement("div", { className: 'flex-weight-line' },
                        React.createElement("span", null,
                            React.createElement("strong", null, "Parte del tiempo disponible"),
                            React.createElement("small", null, "Arrastra la escala para distribuir el tiempo disponible.")),
                        React.createElement("div", { className: 'flex-slider' },
                            React.createElement("input", { type: 'range', min: 1, max: 100, step: 1, "aria-label": 'Proporci\u00F3n de tiempo flexible', value: s.flexWeight || 1, onChange: ev => update(s.id, { flexWeight: Number(ev.target.value) }) }),
                            React.createElement("strong", null, (() => { const active = activeSteps(this.state.routineDraft.steps, this.state.selectedDate), leaves = leafSteps(active).filter(x => x.flexible), w = Math.max(1, s.flexWeight || 1), total = leaves.reduce((a, x) => a + Math.max(1, x.flexWeight || 1), 0); return `${Math.round(w / Math.max(w, total) * 100)}% · ${this.dur(leafAllocation(active, routineMinutes(this.state.routineDraft))[s.id] || 0)}`; })()))),
                    React.createElement("details", { className: 'step-advanced ' + (s.goalId ? 'has-goal' : '') },
                        React.createElement("summary", null,
                            React.createElement(Icon, { name: 'target', size: 15 }),
                            " ",
                            s.goalId ? 'Meta vinculada: ' + (((_b = this.state.data.goals.find(g => g.id === s.goalId)) === null || _b === void 0 ? void 0 : _b.title) || 'Meta') : 'Relaciones y evidencias (opcional)'),
                        React.createElement("label", { className: 'evidence-preference' },
                            React.createElement("input", { type: 'checkbox', checked: !!s.requestEvidence, onChange: ev => update(s.id, { requestEvidence: ev.target.checked }) }),
                            " Sugerir evidencia al realizar este paso"),
                        React.createElement("div", { className: 'field' },
                            React.createElement("label", null, "Este elemento contribuye a"),
                            this.goalPicker(s.goalId || '', goalId => update(s.id, { goalId })))),
                    React.createElement("details", { className: 'legacy-hidden' },
                        React.createElement("summary", null,
                            React.createElement(Icon, { name: 'target', size: 15 }),
                            " ",
                            s.goalId ? 'Meta vinculada: ' + (((_c = this.state.data.goals.find(g => g.id === s.goalId)) === null || _c === void 0 ? void 0 : _c.title) || 'Meta') : 'Vincular a una meta (opcional)'),
                        React.createElement("div", { className: 'field' },
                            React.createElement("label", null, "Este elemento contribuye a"),
                            React.createElement(FriendlySelect, { value: s.goalId || '', ariaLabel: 'Vincular paso a meta', onChange: goalId => update(s.id, { goalId }), options: [{ value: '', label: 'Sin meta vinculada' }, ...this.state.data.goals.map(g => ({ value: g.id, label: g.title }))] }),
                            React.createElement("p", { className: 'caption' }, "El paso tomar\u00E1 el color de esta meta tanto aqu\u00ED como al ejecutarlo."))),
                    React.createElement("div", { className: 'step-description' },
                        React.createElement(AutoTextarea, { maxLength: 1000, value: s.desc || '', onChange: (e) => update(s.id, { desc: e.target.value }), placeholder: 'Instrucciones de este paso u opci\u00F3n...' })),
                    hasChildren && this.renderStepEditor(s.children || [], level + 1),
                    React.createElement("div", { className: 'step-subaction' },
                        React.createElement(Btn, { tiny: true, kind: 'secondary', onClick: () => update(s.id, { children: [...(s.children || []), { id: uid(), title: '', min: 5, desc: '' }] }) },
                            React.createElement(Icon, { name: 'plus', size: 14 }),
                            " A\u00F1adir ",
                            nextStepLevelName(level),
                            " a esta opci\u00F3n")),
                    mode === 'alternatives' && React.createElement("div", { className: 'step-variants' },
                        React.createElement("div", { className: 'step-variants-title' },
                            "M\u00E1s alternativas ",
                            React.createElement("span", null, "Todas tienen la misma importancia. Cada ocasi\u00F3n puede usar solo una.")),
                        (s.variants || []).map((v, vi) => {
                            var _a, _b, _c, _d, _e;
                            return React.createElement("div", { className: 'step-variant', key: v.id, style: goalColor(this.state.data, v.goalId) ? { '--linked-goal-color': goalColor(this.state.data, v.goalId) } : {} },
                                React.createElement("div", { className: 'row spread' },
                                    React.createElement("strong", null,
                                        "Alternativa ",
                                        vi + 2,
                                        " \u00B7 ",
                                        v.title || 'sin nombre'),
                                    React.createElement("button", { type: 'button', className: 'icon-btn', title: 'Eliminar opci\u00F3n', "aria-label": 'Eliminar opci\u00F3n', onClick: () => update(s.id, { variants: (s.variants || []).filter(a => a.id !== v.id) }) },
                                        React.createElement(Icon, { name: 'trash', size: 15 }))),
                                React.createElement("div", { className: 'field-grid' },
                                    React.createElement("div", { className: 'field' },
                                        React.createElement("label", null, "Nombre de la opci\u00F3n"),
                                        React.createElement("input", { value: v.title, placeholder: 'Ej. Preparar equipaje, estudiar, descansar', onChange: e => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, title: e.target.value } : a) }) })),
                                    React.createElement("div", { className: 'field' },
                                        React.createElement("label", null, "Tiempo estimado"),
                                        ((_a = v.children) === null || _a === void 0 ? void 0 : _a.length) ? React.createElement("div", { className: 'variant-duration' },
                                            "\u03A3 ",
                                            this.dur(v.children.reduce((sum, c) => sum + stepMinutes(c), 0)),
                                            " de sus detalles") : v.flexible ? React.createElement("div", { className: 'calculated-duration' }, "Tiempo flexible") : React.createElement(NumberField, { value: v.min, min: 1, max: 1440, ariaLabel: 'Minutos de opción ' + (vi + 2), onCommit: min => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, min } : a) }) }))),
                                !((_b = v.children) === null || _b === void 0 ? void 0 : _b.length) && React.createElement("label", { className: 'step-flex-toggle' },
                                    React.createElement("input", { type: 'checkbox', checked: !!v.flexible, onChange: ev => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, flexible: ev.target.checked, flexWeight: a.flexWeight || 1 } : a) }) }),
                                    React.createElement("span", null,
                                        React.createElement("strong", null, "Esta alternativa puede usar tiempo flexible"),
                                        React.createElement("small", null, "Participa en el reparto solo cuando sea la opci\u00F3n utilizada."))),
                                React.createElement("label", { className: 'evidence-preference' },
                                    React.createElement("input", { type: 'checkbox', checked: !!v.requestEvidence, onChange: ev => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, requestEvidence: ev.target.checked } : a) }) }),
                                    " Sugerir evidencia en esta alternativa (opcional)"),
                                v.flexible && !((_c = v.children) === null || _c === void 0 ? void 0 : _c.length) && React.createElement("div", { className: 'flex-weight-line' },
                                    React.createElement("span", null, "Parte proporcional del tiempo libre"),
                                    React.createElement("div", { className: 'flex-slider' },
                                        React.createElement("input", { type: 'range', min: 1, max: 100, step: 1, "aria-label": 'Porcentaje de la alternativa', value: v.flexWeight || 1, onChange: ev => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, flexWeight: Number(ev.target.value) } : a) }) }),
                                        React.createElement("strong", null, (() => { const current = activeSteps(this.state.routineDraft.steps, this.state.selectedDate), leaves = leafSteps(current), other = leaves.filter(x => x.flexible && x.id !== s.id), w = Math.max(1, v.flexWeight || 1), total = w + other.reduce((a, x) => a + Math.max(1, x.flexWeight || 1), 0), free = Math.max(0, routineMinutes(this.state.routineDraft) - fixedStepMinutes(current)), share = w / Math.max(1, total); return `${Math.round(share * 100)} % · aprox. ${this.dur(Math.round(free * share))}`; })()),
                                        React.createElement("small", null, "Estimaci\u00F3n si eliges esta opci\u00F3n; al ejecutarla se recalcula."))),
                                React.createElement("details", { className: 'step-advanced ' + (v.goalId ? 'has-goal' : '') },
                                    React.createElement("summary", null,
                                        React.createElement(Icon, { name: 'target', size: 15 }),
                                        v.goalId ? 'Meta: ' + (((_d = this.state.data.goals.find(g => g.id === v.goalId)) === null || _d === void 0 ? void 0 : _d.title) || 'Meta') : 'Vincular alternativa a meta'),
                                    React.createElement("div", { className: 'field' },
                                        React.createElement("label", null, "Meta de esta alternativa"),
                                        this.goalPicker(v.goalId || '', goalId => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, goalId } : a) }), 'Heredar color del paso'))),
                                s.chooseWhen !== 'execute' && React.createElement("div", { className: 'field' },
                                    React.createElement("label", null, "D\u00EDas en los que se utiliza"),
                                    this.weekdayPicker(v.days, day => this.updateStepDays(s.id, v.id, day))),
                                React.createElement("div", { className: 'field' },
                                    React.createElement("label", null, "Instrucciones particulares"),
                                    React.createElement(AutoTextarea, { value: v.desc || '', onChange: (e) => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, desc: e.target.value } : a) }), placeholder: '\u00BFC\u00F3mo se realiza esta opci\u00F3n?' })),
                                !!((_e = v.children) === null || _e === void 0 ? void 0 : _e.length) && React.createElement("div", { className: 'variant-children' }, this.renderStepEditor(v.children || [], level + 1)),
                                React.createElement(Btn, { tiny: true, kind: 'secondary', onClick: () => update(s.id, { variants: (s.variants || []).map(a => a.id === v.id ? { ...a, children: [...(a.children || []), { id: uid(), title: '', desc: '', min: 5 }] } : a) }) },
                                    React.createElement(Icon, { name: 'plus', size: 14 }),
                                    " A\u00F1adir ",
                                    nextStepLevelName(level),
                                    " a esta opci\u00F3n"));
                        }),
                        React.createElement("div", { className: 'step-alt-action' },
                            React.createElement(Btn, { kind: 'ghost', tiny: true, onClick: () => update(s.id, { variants: [...(s.variants || []), { id: uid(), title: '', desc: '', min: Math.max(1, s.min), days: [] }] }) },
                                React.createElement(Icon, { name: 'plus', size: 14 }),
                                " A\u00F1adir otra opci\u00F3n"))));
            }));
        };
        this.renderCheckSteps = (steps, e, date, log, allocation, level = 0) => React.createElement("div", { className: level ? 'check-child-steps' : '' }, steps.map((s, i) => {
            var _a, _b, _c, _d;
            const manual = s.mode === 'alternatives' && s.chooseWhen === 'execute';
            const chosen = ((_a = log.choices) === null || _a === void 0 ? void 0 : _a[s.id]) || '';
            return React.createElement("div", { className: 'execution-step ' + (s.goalId ? 'goal-linked-step' : ''), key: s.id, style: goalColor(this.state.data, s.goalId) ? { '--linked-goal-color': goalColor(this.state.data, s.goalId) } : {} },
                React.createElement("div", { className: "routine-step" },
                    React.createElement("button", { className: 'check-circle ' + (log.checkedSteps.includes(s.id) ? 'checked' : ''), onClick: () => this.toggleStep(e, date, s.id), "aria-label": 'Marcar ' + s.title, disabled: !!(s.children && s.children.length) || (manual && !chosen) }, log.checkedSteps.includes(s.id) && React.createElement(Icon, { name: "check", size: 13 })),
                    React.createElement("div", { className: "flex" },
                        React.createElement("div", { className: "agenda-name" },
                            i + 1,
                            ". ",
                            manual && !chosen ? 'Elige una alternativa' : s.title),
                        s.desc && React.createElement("div", { className: "agenda-sub" }, s.desc),
                        React.createElement("div", { className: "agenda-sub" },
                            this.dur(effectiveStepMinutes(s, allocation)),
                            " ",
                            s.flexible ? '· flexible' : '',
                            " \u00B7 ",
                            ((_b = s.children) === null || _b === void 0 ? void 0 : _b.length) ? 'Incluye ' + s.children.length + ' elementos' : 'Paso individual'))),
                manual && React.createElement("div", { className: 'execution-choice' },
                    React.createElement("strong", null, "\u00BFQu\u00E9 opci\u00F3n realizar\u00E1s hoy?"),
                    React.createElement("div", { className: 'execution-options' }, [{ id: '__base', title: originalStepTitle(this.state.data, e.routineId, s.id) || s.title }, ...(s.variants || []).map(v => ({ id: v.id, title: v.title }))].map(v => React.createElement("button", { key: v.id, className: chosen === v.id ? 'active' : '', type: 'button', onClick: () => this.selectVariant(e, date, s.id, v.id) }, v.title))),
                    !chosen && React.createElement("p", { className: 'caption' }, "Selecciona una alternativa antes de marcar este paso.")),
                (!manual || !!chosen) && (s.requestEvidence || ((_c = this.state.data.routines.find(r => r.id === e.routineId)) === null || _c === void 0 ? void 0 : _c.requestEvidence)) && React.createElement("div", { className: 'evidence-prompt' }, "Puedes adjuntar un recuerdo de este paso."),
                (!manual || !!chosen) && this.evidenceSection(e, date, s.id),
                (!manual || !!chosen) && React.createElement(NoteEditor, { key: e.id + '-' + date + '-' + s.id, label: 'Nota de ' + (s.title || 'este paso'), value: ((_d = log.stepNotes) === null || _d === void 0 ? void 0 : _d[s.id]) || '', carry: upcomingNote(this.state.data, e, date, s.id), onSave: text => this.saveOccurrenceNote(e, date, text, s.id) }),
                s.children && s.children.length > 0 && (!manual || !!chosen) && this.renderCheckSteps(s.children, e, date, log, allocation, level + 1));
        }));
        const d = today();
        this.state = { confirmDialog: null, durationDisplay: getPreference(DURATION_STORE) === 'minutes' ? 'minutes' : 'hours', returnToSchedule: false, scheduleContextNote: '', data: load(), page: 'inicio', selectedDate: d, month: firstMonth(d), modal: null, goalDraft: gDraft(), routineDraft: rDraft(), eventDraft: eDraft(d), activeEventId: '', detailPath: [], progressValue: '', progressNote: '', progressStatus: 'pending', progressGoalId: '', toast: '', theme: (themeOptions.some(x => x.id === getPreference(THEME_STORE)) ? getPreference(THEME_STORE) : 'aurora'), modalLayout: getPreference(LAYOUT_STORE) === 'horizontal' ? 'horizontal' : 'vertical', guideOpen: getPreference(GUIDE_STORE) !== 'yes', guideStep: 0, guideGoalId: '', guideEventId: '', helpTopic: '', helpOpen: false, areaFilter: 'all', goalView: 'cards', mapGrouping: 'structure', colorEditorOpen: false, hexDraft: colorOptions[0], draggedStepId: '', dragTargetId: '', draggedCardType: '', draggedCardId: '', datePickerMonth: firstMonth(d), calendarDetailOpen: false, advancedOpen: getPreference(ADVANCED_STORE) === 'yes', expandedGoalPick: [], helpX: null, helpY: null, reviewDraft: '', evidenceCaption: '' };
    }
    componentDidMount() { this.syncModalState(); document.addEventListener('keydown', this.globalKeydown); this.resizeTextareas(); }
    componentDidUpdate(_, prev) {
        this.syncModalState();
        if (prev.modal !== this.state.modal || prev.modalLayout !== this.state.modalLayout)
            this.resizeTextareas();
        if (prev.toast !== this.state.toast) {
            if (this.toastTimer)
                clearTimeout(this.toastTimer);
            if (this.state.toast)
                this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 3500);
        }
    }
    componentWillUnmount() { if (this.confirmResolver) {
        this.confirmResolver(false);
        this.confirmResolver = null;
    } if (this.toastTimer)
        clearTimeout(this.toastTimer); document.body.style.overflow = ''; document.removeEventListener('keydown', this.globalKeydown); document.removeEventListener('mousemove', this.moveStepDrag, true); document.removeEventListener('mouseup', this.endStepDrag, true); }
    renderSidebar() {
        const links = [{ id: 'hoy', label: 'Mi día', icon: 'checklist' }, { id: 'inicio', label: 'Inicio', icon: 'home' }, { id: 'metas', label: 'Metas', icon: 'target' }, { id: 'rutinas', label: 'Rutinas', icon: 'checklist' }, { id: 'horario', label: 'Horario', icon: 'clock' }, { id: 'calendario', label: 'Calendario', icon: 'calendar' }, { id: 'progreso', label: 'Progreso', icon: 'chart' }, { id: 'ajustes', label: 'Ajustes', icon: 'settings' }];
        return React.createElement(React.Fragment, null,
            React.createElement("aside", { className: "sidebar" },
                React.createElement("div", { className: "brand" },
                    React.createElement("img", { className: "brand-logo", src: "logo.svg", alt: "Logo Fullhouse" }),
                    React.createElement("div", null,
                        React.createElement("div", { className: "brand-name" }, "FULLHOUSE"),
                        React.createElement("div", { className: "brand-sub" }, "Tu espacio, completo"))),
                React.createElement("div", { className: 'side-section' }, "Uso y seguimiento"),
                React.createElement("nav", null, links.slice(0, 2).map(l => React.createElement("button", { key: l.id, className: `nav-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
                    React.createElement(Icon, { name: l.icon }),
                    l.label))),
                React.createElement("div", { className: 'side-section' }, "Planificar y editar"),
                React.createElement("nav", null, links.slice(2, 6).map(l => React.createElement("button", { key: l.id, className: `nav-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
                    React.createElement(Icon, { name: l.icon }),
                    l.label))),
                React.createElement("div", { className: 'side-section' }, "Analizar y personalizar"),
                React.createElement("nav", null, links.slice(6).map(l => React.createElement("button", { key: l.id, className: `nav-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
                    React.createElement(Icon, { name: l.icon }),
                    l.label))),
                React.createElement("div", { className: "sidebar-bottom" },
                    React.createElement("button", { className: "nav-item nav-help", onClick: this.openGuide },
                        React.createElement(Icon, { name: "help" }),
                        " Gu\u00EDa paso a paso"),
                    React.createElement("div", { className: "profile-mini" },
                        React.createElement("div", { className: "avatar" }, "\u2726"),
                        React.createElement("div", null,
                            React.createElement("div", { className: "profile-name" }, "Mi espacio privado"),
                            React.createElement("div", { className: "profile-meta" }, "Fullhouse \u00B7 0.8"))),
                    React.createElement("small", null, "Organiza \u00B7 Act\u00FAa \u00B7 Progresa. Los datos se guardan en este navegador."))),
            React.createElement("nav", { className: "mobile-nav", "aria-label": "Navegaci\u00F3n m\u00F3vil" }, links.filter(l => l.id !== 'ajustes' && l.id !== 'calendario' && l.id !== 'inicio').map(l => React.createElement("button", { key: l.id, className: `mobile-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
                React.createElement(Icon, { name: l.icon }),
                l.label.replace('Mis ', '')))));
    }
    renderHeading(title, description, action) { return React.createElement("div", { className: "heading-row" },
        React.createElement("div", null,
            React.createElement("div", { className: "eyebrow" },
                "FULLHOUSE / ",
                this.state.page.toUpperCase()),
            React.createElement("h1", { className: "page-title" },
                title,
                " ",
                this.hint(this.state.page)),
            React.createElement("p", { className: "lead" }, description)),
        action); }
    renderStat(label, value, note, icon) { return React.createElement("div", { className: "stat-card" },
        React.createElement("div", { className: "stat-top" },
            React.createElement("span", { className: "stat-icon" },
                React.createElement(Icon, { name: icon })),
            React.createElement("span", { className: "stat-deco" }, "FULLHOUSE")),
        React.createElement("div", { className: "stat-label" }, label),
        React.createElement("div", { className: "stat-value" }, value),
        React.createElement("div", { className: "stat-note" }, note)); }
    renderTodayList(date, compact = false) {
        const d = this.state.data, es = eventsOn(d, date).filter(e => !e.allDay);
        if (!es.length)
            return React.createElement("div", { className: "empty" },
                React.createElement(Icon, { name: "calendar" }),
                React.createElement("strong", null, "Un d\u00EDa por dise\u00F1ar"),
                React.createElement("p", null, "No hay actividades programadas todav\u00EDa. Comienza agregando una."),
                React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openEvent() },
                    React.createElement(Icon, { name: "plus", size: 14 }),
                    " Nueva actividad"));
        return React.createElement("div", null, es.map(e => {
            const isDone = done(d, e, date), routine = d.routines.find(r => r.id === e.routineId), log = d.logs[key(e, date)];
            return compact ? React.createElement("div", { key: e.id, className: `agenda-item ${isDone ? 'is-done' : ''}` },
                React.createElement("div", { className: "agenda-time" }, eventTime(e, date, d)),
                React.createElement("div", { className: "agenda-main" },
                    React.createElement("div", { className: "agenda-name" }, e.title),
                    React.createElement("div", { className: "agenda-sub" },
                        this.dur(durationOn(e, date, d)),
                        " ",
                        routine ? '· ' + routine.steps.length + ' pasos' : '')),
                React.createElement("button", { className: `check-circle ${isDone ? 'checked' : ''}`, onClick: () => this.toggleEvent(e, date), "aria-label": isDone ? 'Marcar pendiente' : 'Marcar completado' }, isDone && React.createElement(Icon, { name: "check", size: 13 })))
                : React.createElement("div", { key: e.id, className: `schedule-line ${isDone ? 'is-done' : ''}` },
                    React.createElement("div", { className: "schedule-time" }, eventTime(e, date, d)),
                    React.createElement("div", { className: "schedule-body" },
                        React.createElement("div", { className: "schedule-name" }, e.title),
                        React.createElement("div", { className: "schedule-meta" },
                            React.createElement("span", null, this.dur(durationOn(e, date, d))),
                            e.repeat !== 'none' && React.createElement("span", null, "\u21BB Recurrente"),
                            routine && React.createElement("span", null,
                                routine.steps.length,
                                " pasos")),
                        e.note && React.createElement("div", { className: "schedule-notes" }, e.note),
                        React.createElement("div", { className: "actions", style: { marginTop: 9 } },
                            routine && React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openExecute(e) }, "Abrir pasos"),
                            e.anchor !== 'between' && React.createElement(Btn, { tiny: true, kind: "ghost", title: "Mover 15 minutos antes (solo este d\u00EDa)", onClick: () => this.shiftEvent(e, date, -15) }, "\u221215 min"),
                            e.anchor !== 'between' && React.createElement(Btn, { tiny: true, kind: "ghost", title: "Mover 15 minutos despu\u00E9s (solo este d\u00EDa)", onClick: () => this.shiftEvent(e, date, 15) }, "+15 min"))),
                    React.createElement("div", { className: "mini-actions" },
                        React.createElement("button", { className: `check-circle ${isDone ? 'checked' : ''}`, onClick: () => this.toggleEvent(e, date), "aria-label": isDone ? 'Marcar pendiente' : 'Marcar completado' }, isDone && React.createElement(Icon, { name: "check", size: 13 })),
                        React.createElement(Btn, { tiny: true, kind: "ghost", onClick: () => this.openEvent(e), title: "Editar actividad" },
                            React.createElement(Icon, { name: "edit", size: 14 }))));
        }));
    }
    renderToday() {
        var _a;
        const date = today(), data = this.state.data, scheduled = eventsOn(data, date), items = scheduled.filter(e => !e.allDay), finished = items.filter(e => done(data, e, date)).length, percentDone = items.length ? Math.round(finished * 100 / items.length) : 0;
        const logs = items.map(e => ({ e, log: data.logs[key(e, date)] }));
        const photoCount = logs.reduce((sum, x) => { var _a, _b; return sum + (((_b = (_a = x.log) === null || _a === void 0 ? void 0 : _a.evidences) === null || _b === void 0 ? void 0 : _b.length) || 0); }, 0);
        const byArea = lifeAreas.map(area => { const group = items.filter(e => { var _a; return ((_a = data.goals.find(g => g.id === e.goalId)) === null || _a === void 0 ? void 0 : _a.area) === area.id; }); return { ...area, planned: group.length, done: group.filter(e => done(data, e, date)).length }; }).filter(x => x.planned);
        const review = (_a = data.dayReviews) === null || _a === void 0 ? void 0 : _a[date];
        return React.createElement(React.Fragment, null,
            this.renderHeading('Mi día', 'Tu espacio para realizar, registrar y revisar lo que haces hoy.', React.createElement(Btn, { onClick: () => this.openEvent() },
                React.createElement(Icon, { name: 'plus', size: 17 }),
                " A\u00F1adir actividad")),
            React.createElement("section", { className: 'today-hero' },
                React.createElement("div", null,
                    React.createElement("div", { className: 'eyebrow' },
                        "JORNADA ACTUAL \u00B7 ",
                        fmtDate(date).toUpperCase()),
                    React.createElement("h2", null, "Una acci\u00F3n a la vez."),
                    React.createElement("p", null, "Marca lo que completes, consulta las instrucciones y conserva tus notas y recuerdos en un mismo lugar.")),
                React.createElement("div", { className: 'today-ring', style: { '--progress': percentDone + '%' } },
                    React.createElement("strong", null,
                        percentDone,
                        "%"),
                    React.createElement("small", null, "Realizado"))),
            React.createElement("div", { className: 'today-progress-strip' },
                React.createElement("div", { className: 'row spread' },
                    React.createElement("strong", null,
                        finished,
                        " de ",
                        items.length,
                        " actividades terminadas"),
                    React.createElement("span", null,
                        items.length - finished,
                        " pendientes")),
                React.createElement("div", { className: 'today-progress-track' },
                    React.createElement("span", { style: { width: percentDone + '%' } }))),
            React.createElement("div", { className: 'today-layout' },
                React.createElement("section", { className: 'panel today-main' },
                    React.createElement("div", { className: 'panel-head' },
                        React.createElement("div", null,
                            React.createElement("h2", null, "Mi lista de hoy"),
                            React.createElement("p", { className: 'panel-sub' }, "Toca un bloque para realizar sus pasos, registrar notas o adjuntar una foto.")),
                        React.createElement("button", { className: 'link-btn', onClick: () => this.route('horario') },
                            "Ver horario ",
                            React.createElement(Icon, { name: 'arrow-right', size: 14 }))),
                    items.length ? items.map(e => {
                        var _a, _b;
                        const r = data.routines.find(x => x.id === e.routineId), log = data.logs[key(e, date)] || { completed: false, checkedSteps: [] }, color = goalColor(data, e.goalId) || '#a26cf4', stepCount = r ? leafSteps(activeSteps(r.steps, date, log.choices || {})).length : 0, checked = ((_a = log.checkedSteps) === null || _a === void 0 ? void 0 : _a.length) || 0;
                        return React.createElement("article", { key: e.id, className: 'today-task ' + (log.completed ? 'finished' : ''), style: { '--task-color': color } },
                            React.createElement("div", { className: 'today-task-top' },
                                React.createElement("button", { className: 'today-task-check ' + (log.completed ? 'checked' : ''), onClick: () => this.toggleEvent(e, date), "aria-label": 'Marcar ' + e.title },
                                    React.createElement(Icon, { name: log.completed ? 'check' : 'checklist', size: 20 })),
                                React.createElement("div", { className: 'today-task-copy' },
                                    React.createElement("strong", null, e.title),
                                    React.createElement("span", null,
                                        eventTime(e, date, data),
                                        " \u00B7 ",
                                        this.dur(durationOn(e, date, data)),
                                        r ? ' · ' + checked + '/' + stepCount + ' pasos' : '',
                                        ((_b = log.evidences) === null || _b === void 0 ? void 0 : _b.length) ? ' · 📷 ' + log.evidences.length : '')),
                                React.createElement("button", { className: 'today-task-open', onClick: () => r ? this.openExecute(e) : this.openDetail(e) },
                                    r ? 'Realizar pasos' : 'Abrir',
                                    " ",
                                    React.createElement(Icon, { name: 'right', size: 15 }))),
                            r && React.createElement("div", { className: 'today-step-teaser' },
                                activeSteps(r.steps, date, log.choices || {}).slice(0, 4).map(st => { var _a; return React.createElement("span", { key: st.id, className: log.checkedSteps.includes(st.id) ? 'done' : '' },
                                    log.checkedSteps.includes(st.id) ? '✓' : '○',
                                    " ",
                                    st.title,
                                    ((_a = st.children) === null || _a === void 0 ? void 0 : _a.length) ? ' · ' + st.children.length + ' detalles' : ''); }),
                                r.steps.length > 4 && React.createElement("small", null,
                                    "+",
                                    r.steps.length - 4,
                                    " m\u00E1s")),
                            React.createElement(NoteEditor, { key: 'daily-' + e.id, label: 'Nota de esta actividad', value: log.note || '', carry: upcomingNote(data, e, date), onSave: text => this.saveOccurrenceNote(e, date, text) }),
                            (e.requestEvidence || (r === null || r === void 0 ? void 0 : r.requestEvidence)) && React.createElement("p", { className: 'evidence-prompt' }, "Puedes dejar evidencia de este bloque, si lo deseas."),
                            this.evidenceSection(e, date));
                    }) : React.createElement("div", { className: 'empty' }, "Todav\u00EDa no tienes actividades para hoy. A\u00F1ade un bloque o programa una rutina.")),
                React.createElement("aside", { className: 'today-side' },
                    React.createElement("section", { className: 'panel' },
                        React.createElement("h2", null, "Avance por \u00E1mbitos"),
                        byArea.length ? byArea.map(a => React.createElement("div", { className: 'today-area-row', key: a.id },
                            React.createElement("i", { style: { background: a.color } }),
                            React.createElement("div", null,
                                React.createElement("strong", null, a.title),
                                React.createElement("small", null,
                                    a.done,
                                    " de ",
                                    a.planned,
                                    " actividades")),
                            React.createElement("span", null,
                                Math.round(a.done / a.planned * 100),
                                "%"))) : React.createElement("p", { className: 'caption' }, "Vincula metas a tus actividades para agruparlas por \u00E1mbito.")),
                    React.createElement("section", { className: 'panel' },
                        React.createElement("h2", null, "Recuerdos de hoy"),
                        React.createElement("div", { className: 'today-gallery' }, logs.flatMap(({ e, log }) => ((log === null || log === void 0 ? void 0 : log.evidences) || []).map(pic => React.createElement("figure", { key: pic.id },
                            React.createElement("img", { src: pic.src, alt: 'Recuerdo de ' + e.title }),
                            React.createElement("figcaption", null, e.title))))),
                        photoCount === 0 && React.createElement("p", { className: 'caption' }, "Las fotos que adjuntes durante el d\u00EDa se reunir\u00E1n aqu\u00ED.")))),
            React.createElement("section", { className: 'panel daily-review' },
                React.createElement("div", { className: 'panel-head' },
                    React.createElement("div", null,
                        React.createElement("h2", null, "Mi revisi\u00F3n al cerrar el d\u00EDa"),
                        React.createElement("p", { className: 'panel-sub' }, "Un momento para recordar, aprender y prepararte para ma\u00F1ana.")),
                    review && React.createElement("span", { className: 'small-tag' }, "Revisi\u00F3n guardada")),
                React.createElement("div", { className: 'daily-review-stats' },
                    React.createElement("span", null,
                        React.createElement("strong", null,
                            finished,
                            "/",
                            items.length),
                        " Actividades"),
                    React.createElement("span", null,
                        React.createElement("strong", null, photoCount),
                        " Fotos"),
                    React.createElement("span", null,
                        React.createElement("strong", null, byArea.length),
                        " \u00C1mbitos atendidos")),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "\u00BFQu\u00E9 logr\u00E9, qu\u00E9 aprend\u00ED y qu\u00E9 har\u00E9 diferente ma\u00F1ana?"),
                    React.createElement(AutoTextarea, { value: this.state.reviewDraft, onChange: (ev) => this.setState({ reviewDraft: ev.target.value }), placeholder: 'Hoy avanc\u00E9 en... Me gustar\u00EDa mejorar... Ma\u00F1ana priorizar\u00E9...' })),
                React.createElement("div", { className: 'row spread' },
                    React.createElement("span", { className: 'caption' }, "Puedes revisar el d\u00EDa aunque a\u00FAn queden actividades pendientes. La informaci\u00F3n no se elimina."),
                    React.createElement(Btn, { onClick: this.saveDayReview },
                        React.createElement(Icon, { name: 'check', size: 16 }),
                        " ",
                        review ? 'Actualizar revisión' : 'Guardar revisión del día'))));
    }
    renderHome() {
        const d = this.state.data, date = this.state.selectedDate, es = eventsOn(d, date).filter(e => !e.allDay), occasions = eventsOn(d, date).filter(e => e.kind === 'occasion'), n = es.filter(e => done(d, e, date)).length;
        const tracked = d.goals, rate = es.length ? Math.round(n / es.length * 100) : 0;
        return React.createElement(React.Fragment, null,
            React.createElement("section", { className: "home-hero" },
                React.createElement("div", { className: "hero-copy" },
                    React.createElement("div", { className: "hero-kicker" }, "\u2726 TU ESPACIO PERSONAL"),
                    React.createElement("h2", null, "Tu d\u00EDa, todas tus posibilidades."),
                    React.createElement("p", null, "Transforma tus metas en acciones concretas y observa c\u00F3mo avanzas, paso a paso."),
                    React.createElement("div", { className: "hero-actions" },
                        React.createElement(Btn, { onClick: () => this.route('hoy') },
                            React.createElement(Icon, { name: 'checklist' }),
                            " Comenzar mi d\u00EDa"),
                        React.createElement(Btn, { kind: "secondary", onClick: this.openGuide },
                            React.createElement(Icon, { name: "help" }),
                            " Conocer Fullhouse"))),
                React.createElement("div", { className: "hero-symbol" },
                    React.createElement("img", { src: "logo.svg", alt: "" }))),
            this.renderHeading('Tu espacio para avanzar', 'Una vista clara de lo que quieres conseguir, lo que harás hoy y lo que realmente has hecho.', React.createElement(Btn, { onClick: () => this.openEvent() },
                React.createElement(Icon, { name: "plus", size: 16 }),
                " Nueva actividad")),
            React.createElement("div", { className: "notice" }, "Este es un prototipo funcional con datos de ejemplo. Puedes editarlo todo. Los cambios se guardan autom\u00E1ticamente en este navegador."),
            React.createElement("div", { className: "cards" },
                this.renderStat('Metas activas', d.goals.length, 'Incluye sub-metas', 'target'),
                this.renderStat('Rutinas creadas', d.routines.length, 'Procedimientos reutilizables', 'checklist'),
                this.renderStat('Actividades del día', es.length, `${n} completadas`, 'calendar'),
                this.renderStat('Cumplimiento diario', rate + '%', 'De actividades planificadas', 'chart')),
            occasions.length > 0 && React.createElement("div", { className: 'home-special-events' },
                React.createElement("strong", null,
                    React.createElement(Icon, { name: 'calendar', size: 17 }),
                    " Acontecimientos de hoy"),
                occasions.map(e => React.createElement("button", { key: e.id, onClick: () => { this.route('calendario'); this.chooseDay(date); } },
                    e.title,
                    " ",
                    React.createElement("span", null, e.allDay ? 'Todo el día' : eventTime(e, date, d))))),
            React.createElement("div", { className: "two-col" },
                React.createElement("section", { className: "panel" },
                    React.createElement("div", { className: "panel-head" },
                        React.createElement("div", null,
                            React.createElement("h2", null, "Agenda del d\u00EDa"),
                            React.createElement("p", { className: "panel-sub" }, fmtDate(date))),
                        React.createElement("button", { className: "link-btn", onClick: () => this.route('horario') },
                            "Ver horario ",
                            React.createElement(Icon, { name: "arrow-right", size: 15 }))),
                    this.renderTodayList(date, true)),
                React.createElement("section", { className: "panel" },
                    React.createElement("div", { className: "panel-head" },
                        React.createElement("div", null,
                            React.createElement("h2", null, "Mis metas"),
                            React.createElement("p", { className: "panel-sub" }, "Indicadores de resultados, no solo tareas")),
                        React.createElement("button", { className: "link-btn", onClick: () => this.route('metas') },
                            "Ver todas ",
                            React.createElement(Icon, { name: "arrow-right", size: 15 }))),
                    tracked.length ? tracked.slice(0, 5).map(g => React.createElement("div", { key: g.id, className: "goal-summary" },
                        React.createElement("div", { className: "goal-summary-top" },
                            React.createElement("strong", null, g.title),
                            React.createElement("span", null, goalMode(g) === 'numeric' ? percent(g.current, g.target) + '%' : goalMode(g) === 'milestones' ? goalMilestones(g).filter(m => m.done).length + '/' + goalMilestones(g).length + ' hitos' : statusLabel(goalStatus(g)))),
                        goalMode(g) !== 'qualitative' ? React.createElement("div", { className: "progress-track" },
                            React.createElement("div", { className: "progress-fill", style: { width: (goalMode(g) === 'milestones' ? percent(goalMilestones(g).filter(m => m.done).length, goalMilestones(g).length) : percent(g.current, g.target)) + '%', background: g.color } })) : React.createElement("p", { className: "caption" }, "Meta cualitativa \u00B7 registra cambios en tu relaci\u00F3n o bienestar"))) : React.createElement("div", { className: "empty" },
                        React.createElement("strong", null, "A\u00FAn no tienes metas"),
                        React.createElement("p", null, "Comienza con un objetivo que sea importante para ti.")))),
            React.createElement("div", { className: "section-head" },
                React.createElement("h2", { className: "section-title" }, "Acceso r\u00E1pido")),
            React.createElement("div", { className: "goal-grid" },
                React.createElement("button", { className: "goal-card", style: { textAlign: 'left', cursor: 'pointer' }, onClick: () => this.openEvent(undefined, 'occasion') },
                    React.createElement("div", { className: 'row' },
                        React.createElement("span", { className: 'routine-badge' },
                            React.createElement(Icon, { name: 'calendar' })),
                        React.createElement("div", null,
                            React.createElement("div", { className: 'goal-name' }, "Nuevo evento"),
                            React.createElement("div", { className: 'goal-desc' }, "Viajes, citas, celebraciones o fechas especiales."))),
                    React.createElement("span", { className: 'link-btn' },
                        "Crear evento ",
                        React.createElement(Icon, { name: 'arrow-right', size: 14 }))),
                React.createElement("button", { className: "goal-card", style: { textAlign: 'left', cursor: 'pointer' }, onClick: () => this.openGoal() },
                    React.createElement("div", { className: "row" },
                        React.createElement("span", { className: "routine-badge" },
                            React.createElement(Icon, { name: "target" })),
                        React.createElement("div", null,
                            React.createElement("div", { className: "goal-name" }, "Nueva meta"),
                            React.createElement("div", { className: "goal-desc" }, "Desglosa un objetivo y define c\u00F3mo medirlo."))),
                    React.createElement("span", { className: "link-btn" },
                        "Crear meta ",
                        React.createElement(Icon, { name: "arrow-right", size: 14 }))),
                React.createElement("button", { className: "goal-card", style: { textAlign: 'left', cursor: 'pointer' }, onClick: () => this.openRoutine() },
                    React.createElement("div", { className: "row" },
                        React.createElement("span", { className: "routine-badge" },
                            React.createElement(Icon, { name: "checklist" })),
                        React.createElement("div", null,
                            React.createElement("div", { className: "goal-name" }, "Nueva rutina"),
                            React.createElement("div", { className: "goal-desc" }, "Dise\u00F1a los pasos de un procedimiento."))),
                    React.createElement("span", { className: "link-btn" },
                        "Crear rutina ",
                        React.createElement(Icon, { name: "arrow-right", size: 14 })))));
    }
    renderGoalCard(g, depth = 0) {
        const d = this.state.data, children = d.goals.filter(x => x.parentId === g.id), linked = d.events.filter(e => e.goalId === g.id).length, mode = goalMode(g), ms = goalMilestones(g), doneCount = ms.filter(m => m.done).length;
        return React.createElement("div", { className: "goal-card", key: g.id, style: { borderLeft: `5px solid ${g.color}` } },
            React.createElement("div", { className: "goal-card-title" },
                React.createElement("div", { className: "goal-color", style: { background: g.color } }),
                React.createElement("div", { className: "flex" },
                    React.createElement("div", { className: "goal-level" },
                        areaInfo(g.area).title.toUpperCase(),
                        " \u00B7 ",
                        depth ? 'SUB-META · NIVEL ' + (depth + 1) : 'META PRINCIPAL',
                        " \u00B7 ",
                        mode === 'numeric' ? 'NUMÉRICA' : mode === 'milestones' ? 'POR HITOS' : 'CUALITATIVA'),
                    React.createElement("h3", { className: "goal-name" }, g.title),
                    React.createElement("p", { className: "goal-desc" }, g.desc || 'Sin descripción'))),
            mode === 'numeric' ? React.createElement("div", null,
                React.createElement("div", { className: "goal-summary-top" },
                    React.createElement("strong", null,
                        g.current,
                        " / ",
                        g.target,
                        " ",
                        g.unit),
                    React.createElement("span", null,
                        percent(g.current, g.target),
                        "%")),
                React.createElement("div", { className: "progress-track" },
                    React.createElement("div", { className: "progress-fill", style: { background: g.color, width: `${percent(g.current, g.target)}%` } }))) : mode === 'milestones' ? React.createElement("div", null,
                React.createElement("div", { className: "goal-summary-top" },
                    React.createElement("strong", null,
                        doneCount,
                        " de ",
                        ms.length,
                        " hitos completados"),
                    React.createElement("span", null, ms.length ? percent(doneCount, ms.length) + '%' : 'Sin hitos')),
                React.createElement("div", { className: "progress-track" },
                    React.createElement("div", { className: "progress-fill", style: { background: g.color, width: `${percent(doneCount, ms.length)}%` } })),
                React.createElement("div", { className: "milestone-list" }, ms.map(m => React.createElement("button", { key: m.id, className: 'milestone-item ' + (m.done ? 'is-complete' : ''), onClick: () => this.toggleMilestone(g.id, m.id) },
                    React.createElement("span", { className: 'milestone-check ' + (m.done ? 'active' : '') }, m.done ? '✓' : ''),
                    m.title)))) : React.createElement("div", { className: "qualitative-state" },
                React.createElement("span", { className: "state-spark" }, "\u2726"),
                React.createElement("div", null,
                    React.createElement("strong", null, statusLabel(goalStatus(g))),
                    React.createElement("p", null, "Tu avance se registra por estados y reflexiones, no con n\u00FAmeros."))),
            React.createElement("div", { className: "goal-footer" },
                React.createElement("span", null,
                    children.length,
                    " sub-metas \u00B7 ",
                    linked,
                    " actividades vinculadas"),
                React.createElement("span", { className: "small-tag" },
                    g.history.length,
                    " registros")),
            React.createElement("div", { className: "actions" },
                this.state.guideOpen && this.state.guideStep === 1 && React.createElement(Btn, { kind: "secondary", tiny: true, onClick: () => this.selectGuideGoal(g.id) },
                    React.createElement(Icon, { name: "check", size: 14 }),
                    " Elegir para la gu\u00EDa"),
                mode !== 'milestones' && React.createElement(Btn, { kind: "secondary", tiny: true, onClick: () => this.openProgress(g) },
                    React.createElement(Icon, { name: "chart", size: 14 }),
                    " Registrar avance"),
                React.createElement(Btn, { kind: "ghost", tiny: true, onClick: () => this.openGoal(g) },
                    React.createElement(Icon, { name: "edit", size: 14 }),
                    " Editar"),
                React.createElement(Btn, { kind: "ghost", tiny: true, onClick: () => this.openGoal(undefined, g.id), title: "A\u00F1adir sub-meta" },
                    React.createElement(Icon, { name: "plus", size: 14 }),
                    " Sub-meta"),
                React.createElement(Btn, { kind: "ghost", tiny: true, onClick: () => this.deleteGoal(g), title: "Eliminar" },
                    React.createElement(Icon, { name: "trash", size: 14 }))));
    }
    visibleGoals() {
        const gs = this.state.data.goals;
        if (this.state.areaFilter === 'all')
            return gs;
        const visible = new Set(gs.filter(g => g.area === this.state.areaFilter).map(g => g.id));
        let changed = true;
        while (changed) {
            changed = false;
            for (const g of gs) {
                if (visible.has(g.id) && g.parentId && !visible.has(g.parentId)) {
                    visible.add(g.parentId);
                    changed = true;
                }
            }
        }
        return gs.filter(g => visible.has(g.id));
    }
    renderGoalTree(g, all, level = 0) {
        const children = all.filter(x => x.parentId === g.id);
        return React.createElement("div", { className: 'goal-tree-node ' + (level ? 'goal-tree-descendant' : ''), key: g.id, onDragOver: e => { if (this.state.draggedCardType === 'goal') {
                e.preventDefault();
                e.stopPropagation();
            } }, onDrop: e => this.cardDrop('goal', g.id, e) },
            React.createElement("div", { className: 'goal-tree-card' },
                React.createElement("button", { type: 'button', draggable: true, className: 'card-drag-handle', title: 'Arrastrar para cambiar el orden (solo dentro del mismo nivel)', "aria-label": 'Reordenar ' + g.title, onDragStart: e => this.startCardDrag('goal', g.id, e), onDragEnd: this.endCardDrag, onKeyDown: e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        this.moveCardKeyboard('goal', g.id, e.key === 'ArrowUp' ? -1 : 1);
                    } } },
                    React.createElement(Icon, { name: 'grip', size: 17 }),
                    " Mover"),
                this.renderGoalCard(g, level)),
            children.length > 0 && React.createElement("div", { className: 'goal-tree-children' }, children.map(child => this.renderGoalTree(child, all, level + 1))));
    }
    renderGoals() {
        const items = this.visibleGoals();
        const ids = new Set(items.map(g => g.id));
        const roots = items.filter(g => !g.parentId || !ids.has(g.parentId));
        const masonry = [[], []];
        const heights = [0, 0];
        const estimate = (g) => { const children = items.filter(x => x.parentId === g.id); const ms = goalMilestones(g).length; return 360 + Math.min(120, (g.desc || '').length * .45) + ms * 35 + children.reduce((sum, x) => sum + estimate(x) + 22, 0); };
        roots.forEach(g => { const col = heights[0] <= heights[1] ? 0 : 1; masonry[col].push(g); heights[col] += estimate(g) + 18; });
        return React.createElement(React.Fragment, null,
            this.renderHeading('Mis metas', 'Metas conectadas con sus submetas, sus ámbitos de vida y sus fechas de revisión.', React.createElement(Btn, { onClick: () => this.openGoal() },
                React.createElement(Icon, { name: 'plus' }),
                " Crear meta")),
            React.createElement("div", { className: 'goal-view-toolbar' },
                React.createElement("span", null, "Explorar como"),
                React.createElement("div", { className: 'view-toggle' },
                    React.createElement("button", { className: this.state.goalView === 'cards' ? 'selected' : '', onClick: () => this.setState({ goalView: 'cards' }) },
                        React.createElement(Icon, { name: 'checklist', size: 16 }),
                        " \u00C1rbol de metas"),
                    React.createElement("button", { className: this.state.goalView === 'map' ? 'selected' : '', onClick: () => this.setState({ goalView: 'map' }) },
                        React.createElement(Icon, { name: 'network', size: 16 }),
                        " Mapa de metas")),
                React.createElement("div", { className: 'goal-area-filter' },
                    React.createElement("span", null, "\u00C1mbito"),
                    React.createElement(FriendlySelect, { value: this.state.areaFilter, ariaLabel: 'Filtrar metas por \u00E1mbito', onChange: areaFilter => this.setState({ areaFilter: areaFilter }), options: [{ value: 'all', label: 'Todos los ámbitos' }, ...lifeAreas.map(a => ({ value: a.id, label: a.title }))] }))),
            React.createElement("div", { className: 'notice' }, "Cada meta puede pertenecer a Mente, F\u00EDsico, Prop\u00F3sito o Social. Las ramas muestran d\u00F3nde nace cada submeta y el mapa permite explorar conexiones adicionales."),
            items.length ? (this.state.goalView === 'map' ? this.renderGoalMap() : React.createElement("div", { className: 'goal-forest' }, masonry.map((column, i) => React.createElement("div", { className: 'goal-masonry-column', key: i }, column.map(g => this.renderGoalTree(g, items)))))) : React.createElement("section", { className: 'panel', style: { marginTop: 20 } },
                React.createElement("div", { className: 'empty' },
                    React.createElement(Icon, { name: 'target' }),
                    React.createElement("strong", null, "No hay metas en este \u00E1mbito"),
                    React.createElement("p", null, "Crea una meta o cambia el filtro para ver otras ramas."),
                    React.createElement(Btn, { onClick: () => this.openGoal() }, "Crear meta"))));
    }
    renderGoalMap() {
        const layout = graphLayout({ ...this.state.data, goals: this.visibleGoals() }, this.state.mapGrouping);
        const positions = new Map(layout.nodes.map(n => [n.goal.id, n]));
        return React.createElement("section", { className: "goal-map-panel" },
            React.createElement("div", { className: "map-topbar" },
                React.createElement("div", null,
                    React.createElement("h2", null, "Mapa de conexiones"),
                    React.createElement("p", null, "Las l\u00EDneas continuas representan sub-metas; las discontinuas, procesos dependientes. Selecciona una tarjeta para editarla.")),
                React.createElement("div", { className: "view-toggle" },
                    React.createElement("button", { className: this.state.mapGrouping === 'structure' ? 'selected' : '', onClick: () => this.setState({ mapGrouping: 'structure' }) }, "Por procesos"),
                    React.createElement("button", { className: this.state.mapGrouping === 'time' ? 'selected' : '', onClick: () => this.setState({ mapGrouping: 'time' }) }, "Por tiempo"))),
            React.createElement("div", { className: "goal-map-scroll" },
                React.createElement("div", { className: "goal-map-surface", style: { width: layout.width, height: layout.height } },
                    React.createElement("svg", { className: "goal-map-wires", width: layout.width, height: layout.height, "aria-hidden": "true" },
                        React.createElement("defs", null,
                            React.createElement("marker", { id: "graph-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" },
                                React.createElement("path", { d: "M0 0 L10 5 L0 10 z", fill: "currentColor" }))),
                        layout.edges.map((e, i) => { const a = positions.get(e.from), b = positions.get(e.to); if (!a || !b)
                            return null; const x1 = a.x + 220, y1 = a.y + 53, x2 = b.x, y2 = b.y + 53; const c = Math.max(44, Math.abs(x2 - x1) * .46); return React.createElement("path", { key: i, className: 'graph-edge ' + (e.kind === 'depends' ? 'graph-dependency' : ''), d: `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}` }); })),
                    layout.labels.map((label, i) => React.createElement("div", { className: "goal-map-label", key: i, style: { left: label.x } }, label.title)),
                    layout.nodes.map(({ goal: g, x, y }) => React.createElement("button", { type: "button", className: "map-node", key: g.id, style: { left: x, top: y, borderTopColor: g.color }, onClick: () => this.openGoal(g) },
                        React.createElement("span", { className: "map-node-name" }, g.title),
                        React.createElement("span", { className: "map-node-tag" },
                            goalMode(g) === 'numeric' ? 'Numérica' : goalMode(g) === 'milestones' ? 'Por hitos' : 'Cualitativa',
                            " ",
                            g.dueDate ? '· ' + g.dueDate : ''),
                        React.createElement("span", { className: "map-node-progress" }, goalMode(g) === 'numeric' ? percent(g.current, g.target) + '%' : goalMode(g) === 'milestones' ? goalMilestones(g).filter(m => m.done).length + ' hitos' : statusLabel(goalStatus(g))))))),
            React.createElement("div", { className: "map-legend" },
                React.createElement("span", null,
                    React.createElement("i", { className: "legend-line" }),
                    " Sub-meta"),
                React.createElement("span", null,
                    React.createElement("i", { className: "legend-line dashed" }),
                    " Depende de"),
                React.createElement("span", null,
                    React.createElement(Icon, { name: "help", size: 14 }),
                    " Puedes asignar fechas y dependencias al editar cada meta")));
    }
    renderRoutines() {
        const rs = this.state.data.routines;
        return React.createElement(React.Fragment, null,
            this.renderHeading('Rutinas y procedimientos', 'Diseña, ordena y programa procedimientos que se adapten a tus días.', React.createElement(Btn, { onClick: () => this.openRoutine() },
                React.createElement(Icon, { name: "plus" }),
                " Nueva rutina")),
            React.createElement("div", { className: "routine-grid" }, rs.map(r => {
                const scheduled = this.routineSchedule(r.id);
                return React.createElement("div", { className: "routine-card routine-modern", key: r.id, onDragOver: e => { if (this.state.draggedCardType === 'routine')
                        e.preventDefault(); }, onDrop: e => this.cardDrop('routine', r.id, e) },
                    React.createElement("div", { className: "routine-modern-top" },
                        React.createElement("span", { className: "routine-badge routine-icon" },
                            React.createElement(Icon, { name: routineIcons.includes(r.icon || '') ? r.icon : 'checklist', size: 23 })),
                        React.createElement("div", { className: "flex" },
                            React.createElement("h3", { className: "goal-name" }, r.title),
                            React.createElement("p", { className: "goal-desc" }, r.desc || 'Sin descripción todavía')),
                        React.createElement("button", { className: "card-drag-handle", draggable: true, title: "Arrastra para reordenar", "aria-label": 'Reordenar ' + r.title, onDragStart: e => this.startCardDrag('routine', r.id, e), onDragEnd: this.endCardDrag, onKeyDown: e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                this.moveCardKeyboard('routine', r.id, e.key === 'ArrowUp' ? -1 : 1);
                            } } },
                            React.createElement(Icon, { name: "grip", size: 17 }))),
                    React.createElement("div", { className: "routine-metadata" },
                        React.createElement("span", null,
                            React.createElement(Icon, { name: "clock", size: 15 }),
                            " ",
                            this.dur(routineMinutes(r)),
                            " \u00B7 ",
                            r.durationMode === 'fixed' ? 'duración fija' : 'según pasos'),
                        React.createElement("span", null,
                            React.createElement(Icon, { name: "checklist", size: 15 }),
                            " ",
                            r.steps.length,
                            " pasos principales")),
                    React.createElement("div", { className: "routine-step-preview new-step-preview" },
                        r.steps.slice(0, 4).map((s, i) => { var _a, _b; return React.createElement("div", { className: "routine-preview-line", key: s.id },
                            React.createElement("span", { className: "routine-preview-index" }, i + 1),
                            React.createElement("span", { className: 'routine-preview-name' },
                                s.title,
                                ((_a = s.children) === null || _a === void 0 ? void 0 : _a.length) > 0 && React.createElement("small", { className: 'preview-children' },
                                    "\u21B3 ",
                                    s.children.slice(0, 3).map(c => c.title).join(' · '),
                                    s.children.length > 3 ? '…' : ''),
                                s.mode === 'alternatives' && !!((_b = s.variants) === null || _b === void 0 ? void 0 : _b.length) && React.createElement("small", { className: 'preview-children' },
                                    "\u2194 ",
                                    s.variants.map(v => v.title).filter(Boolean).join(' / '))),
                            React.createElement("span", { className: "routine-preview-time" }, this.dur(stepMinutes(s)))); }),
                        r.steps.length > 4 && React.createElement("div", { className: "routine-preview-more" },
                            "+",
                            r.steps.length - 4,
                            " pasos adicionales")),
                    React.createElement("div", { className: "actions" },
                        this.state.guideOpen && this.state.guideStep === 4 && React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.useRoutineForGuide(r) }, "Usar en la gu\u00EDa"),
                        React.createElement(Btn, { tiny: true, onClick: () => this.chooseRoutineForSchedule(r) },
                            React.createElement(Icon, { name: "calendar", size: 14 }),
                            " ",
                            scheduled ? 'Reprogramar' : 'Programar'),
                        React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openRoutine(r) },
                            React.createElement(Icon, { name: "edit", size: 14 }),
                            " Editar"),
                        React.createElement(Btn, { tiny: true, kind: "ghost", onClick: () => this.deleteRoutine(r) },
                            React.createElement(Icon, { name: "trash", size: 14 }))));
            })),
            !rs.length && React.createElement("div", { className: "panel" },
                React.createElement("div", { className: "empty" },
                    React.createElement("strong", null, "A\u00FAn no tienes rutinas"),
                    React.createElement("p", null, "Crea un procedimiento, sus pasos y duraci\u00F3n estimada."),
                    React.createElement(Btn, { onClick: () => this.openRoutine() }, "Crear rutina"))));
    }
    monthDays() {
        const start = parseDay(this.state.month), offset = (start.getDay() + 6) % 7;
        const first = addDays(this.state.month, -offset);
        const result = [];
        for (let i = 0; i < 42; i++) {
            const day = addDays(first, i);
            result.push({ day, inside: day.slice(0, 7) === this.state.month.slice(0, 7) });
        }
        return result;
    }
    renderSchedule() {
        const date = this.state.selectedDate, data = this.state.data, es = eventsOn(data, date).filter(e => !e.allDay);
        const minStart = es.length ? Math.min(...es.map(e => minutes(eventTime(e, date, data)))) : 360;
        const maxEnd = es.length ? Math.max(...es.map(e => minutes(eventTime(e, date, data)) + durationOn(e, date, data))) : 1320;
        const startHour = Math.max(0, Math.min(6, Math.floor(minStart / 60)));
        const endHour = Math.min(24, Math.max(22, Math.ceil(maxEnd / 60)));
        const hourHeight = 82, origin = startHour * 60;
        const placed = [], all = es.map(e => ({ event: e, start: minutes(eventTime(e, date, data)), end: Math.min(1440, minutes(eventTime(e, date, data)) + Math.max(10, durationOn(e, date, data))) })).sort((a, b) => a.start - b.start);
        let group = [], groupEnd = -1;
        const finish = () => { if (!group.length)
            return; const laneEnds = []; group.forEach(x => { let j = laneEnds.findIndex(t => t <= x.start); if (j < 0) {
            j = laneEnds.length;
            laneEnds.push(-1);
        } x.lane = j; laneEnds[j] = x.end; }); group.forEach(x => { x.lanes = laneEnds.length; placed.push(x); }); group = []; };
        all.forEach(x => { if (group.length && x.start >= groupEnd)
            finish(); group.push({ ...x, lane: 0, lanes: 1 }); groupEnd = Math.max(groupEnd, x.end); });
        finish();
        return React.createElement(React.Fragment, null,
            this.renderHeading('Mi horario', 'Una vista continua de tu día: de la mañana a la noche. Abre cualquier bloque para descubrir sus rutinas, instrucciones y subpasos.', React.createElement(Btn, { onClick: () => this.openEvent() },
                React.createElement(Icon, { name: "plus" }),
                " A\u00F1adir bloque")),
            React.createElement("div", { className: "schedule-banner" },
                React.createElement("div", { className: "schedule-days schedule-days-stable" },
                    React.createElement("button", { className: "icon-btn", title: "D\u00EDa anterior", onClick: () => this.chooseDay(addDays(date, -1)) },
                        React.createElement(Icon, { name: "left" })),
                    React.createElement("div", null,
                        React.createElement("strong", null, fmtDate(date)),
                        React.createElement("span", null,
                            es.length,
                            " bloques \u00B7 ",
                            es.filter(e => done(data, e, date)).length,
                            " completados")),
                    React.createElement("button", { className: "icon-btn", title: "D\u00EDa siguiente", onClick: () => this.chooseDay(addDays(date, 1)) },
                        React.createElement(Icon, { name: "right" })),
                    React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.chooseDay(today()) }, "Hoy")),
                React.createElement("div", { className: "schedule-banner-actions" },
                    React.createElement("span", null, "Selecciona un bloque para verlo en detalle."),
                    React.createElement("span", { className: "schedule-tip" }, "Cada bloque puede revelar m\u00E1s detalles al abrirlo."))),
            React.createElement("section", { className: "timeline-panel" },
                React.createElement("div", { className: "timeline-head" },
                    React.createElement("div", null,
                        React.createElement(Icon, { name: "sun" }),
                        " Tu jornada"),
                    React.createElement("p", null, "Despl\u00E1zate por el horario y abre los bloques para consultar sus pasos e instrucciones.")),
                React.createElement("div", { className: "timeline-canvas", style: { height: (endHour - startHour) * hourHeight + 24 } },
                    Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour).map(hour => React.createElement("div", { key: hour, className: "timeline-gridline", style: { top: (hour - startHour) * hourHeight } },
                        React.createElement("span", null,
                            String(hour).padStart(2, '0'),
                            ":00"),
                        React.createElement("div", null))),
                    React.createElement("div", { className: "timeline-events" }, placed.map(({ event: e, start, end, lane, lanes }) => { var _a, _b; const goal = data.goals.find(g => g.id === e.goalId), routine = data.routines.find(r => r.id === e.routineId), isDone = done(data, e, date), color = (goal === null || goal === void 0 ? void 0 : goal.color) || '#a477ec'; const duration = durationOn(e, date, data), hasNote = !!((_a = data.logs[key(e, date)]) === null || _a === void 0 ? void 0 : _a.note) || !!Object.values(((_b = data.logs[key(e, date)]) === null || _b === void 0 ? void 0 : _b.stepNotes) || {}).filter(Boolean).length, hasCarry = !!upcomingNote(data, e, date), height = Math.max(16, ((end - start) / 60) * hourHeight - 3), width = 100 / lanes; const style = height < 38 || width < 26 ? 'micro' : height < 84 || width < 44 ? 'compact' : 'expanded'; return React.createElement("button", { key: e.id, className: 'timeline-block ' + style + ' ' + (isDone ? 'completed' : ''), title: `${e.title} · ${eventTime(e, date, data)} · ${duration} minutos${e.note ? ' · ' + e.note : ''}`, "aria-label": `Abrir ${e.title}, ${eventTime(e, date, data)}, ${duration} minutos`, onClick: () => this.openDetail(e), style: { top: ((start - origin) / 60) * hourHeight, height, left: (lane / lanes * 100) + '%', width: width + '%', '--block-bg': color, '--block-text': readableOn(color) } },
                        React.createElement("div", { className: 'timeline-block-header' },
                            React.createElement("span", { className: 'timeline-event-name' }, e.title),
                            React.createElement("span", { className: 'timeline-markers' },
                                (hasNote || hasCarry) && React.createElement("span", { title: hasNote ? 'Nota guardada este día' : 'Nota de la ocasión anterior', className: 'timeline-note-icon' }, "\u270E"),
                                isDone && React.createElement("span", { className: 'timeline-done' }, "\u2713"))),
                        style !== 'micro' && React.createElement("div", { className: 'timeline-time' },
                            eventTime(e, date, data),
                            " \u00B7 ",
                            this.dur(duration),
                            " ",
                            style === 'expanded' && routine ? '· ' + leafSteps(routine.steps).length + ' pasos' : ''),
                        style === 'expanded' && e.note && React.createElement("div", { className: 'timeline-description' }, e.note)); }))),
                !es.length && React.createElement("div", { className: "timeline-empty" },
                    React.createElement(Icon, { name: "calendar" }),
                    React.createElement("p", null, "Este d\u00EDa todav\u00EDa no tiene actividades. Empieza creando tu primer bloque."),
                    React.createElement(Btn, { onClick: () => this.openEvent() }, "A\u00F1adir bloque"))),
            React.createElement("div", { className: "notice" }, "Los bloques se pueden abrir para consultar cada nivel de detalle. Para cambiar horas, utiliza la edici\u00F3n de la actividad o los controles de \u00B115 minutos."));
    }
    renderDetail() {
        var _a, _b, _c;
        const date = this.state.selectedDate, d = this.state.data, e = d.events.find(x => x.id === this.state.activeEventId);
        if (!e)
            return React.createElement("p", null, "No se encontr\u00F3 el bloque seleccionado.");
        const r0 = d.routines.find(x => x.id === e.routineId), r = r0 ? { ...r0, steps: activeSteps(r0.steps, date, ((_a = d.logs[key(e, date)]) === null || _a === void 0 ? void 0 : _a.choices) || {}) } : undefined, g = d.goals.find(x => x.id === e.goalId), path = this.state.detailPath, current = r ? getStepByPath(r.steps, path) : undefined;
        const choices = current ? (current.children || []) : (r === null || r === void 0 ? void 0 : r.steps) || [];
        const log = d.logs[key(e, date)] || { completed: false, checkedSteps: [] };
        const allocation = leafAllocation((r === null || r === void 0 ? void 0 : r.steps) || [], durationOn(e, date, d));
        return React.createElement("div", { className: "detail-zoom" },
            React.createElement("div", { className: "detail-crumbs" },
                React.createElement("button", { onClick: () => this.setState({ detailPath: [] }) }, e.title),
                path.map((id, i) => { var _a; return React.createElement("span", { key: id },
                    " / ",
                    React.createElement("button", { onClick: () => this.setState({ detailPath: path.slice(0, i + 1) }) }, ((_a = getStepByPath((r === null || r === void 0 ? void 0 : r.steps) || [], path.slice(0, i + 1))) === null || _a === void 0 ? void 0 : _a.title) || 'Paso')); })),
            path.length === 0 ? React.createElement(React.Fragment, null,
                React.createElement("div", { className: "detail-spotlight" },
                    React.createElement("span", { className: "detail-time" },
                        React.createElement(Icon, { name: "clock" }),
                        " ",
                        fmtDate(date),
                        " \u00B7 ",
                        eventTime(e, date, d),
                        " \u00B7 ",
                        this.dur(durationOn(e, date, d))),
                    React.createElement("h3", null, e.title),
                    React.createElement("p", null, e.note || (r === null || r === void 0 ? void 0 : r.desc) || 'Sin descripción adicional para este bloque.'),
                    React.createElement("div", { className: "detail-tags" },
                        g && React.createElement("span", { style: { borderColor: g.color } },
                            React.createElement("span", { className: "circle-tint", style: { background: g.color } }),
                            g.title),
                        e.repeat !== 'none' && React.createElement("span", null, "\u21BB Recurrente"))),
                React.createElement("div", { className: "detail-actions" },
                    React.createElement(Btn, { kind: "secondary", onClick: () => this.openEvent(e) },
                        React.createElement(Icon, { name: "edit" }),
                        " Editar bloque"),
                    r && React.createElement(Btn, { onClick: () => this.openExecute(e) },
                        React.createElement(Icon, { name: "checklist" }),
                        " Ejecutar rutina"),
                    React.createElement(Btn, { kind: "secondary", onClick: () => this.toggleEvent(e, date) }, done(d, e, date) ? 'Marcar pendiente' : 'Marcar completada'))) : React.createElement("div", { className: "detail-spotlight" },
                React.createElement("div", { className: "detail-time" },
                    React.createElement(Icon, { name: "clock" }),
                    " ",
                    this.dur(current ? effectiveStepMinutes(current, allocation) : 0),
                    " previstos"),
                React.createElement("h3", null, (current === null || current === void 0 ? void 0 : current.title) || 'Paso'),
                React.createElement("p", null, (current === null || current === void 0 ? void 0 : current.desc) || 'No hay instrucciones adicionales para este paso.'),
                current && !((_b = current.children) === null || _b === void 0 ? void 0 : _b.length) && React.createElement(Btn, { kind: "secondary", onClick: () => this.toggleStep(e, date, current.id) }, log.checkedSteps.includes(current.id) ? '✓ Completado · Desmarcar' : 'Marcar paso completado')),
            choices.length > 0 && React.createElement(React.Fragment, null,
                React.createElement("h3", { className: "detail-section-title" }, path.length ? 'Elementos de ' + stepLevelName(path.length - 1).toLowerCase() : 'Dentro de este bloque'),
                React.createElement("div", { className: "zoom-children" }, choices.map((s, i) => { var _a; return React.createElement("button", { key: s.id, className: "zoom-child", onClick: () => this.setState({ detailPath: [...path, s.id] }) },
                    React.createElement("span", { className: "zoom-index", style: goalColor(d, s.goalId) ? { background: goalColor(d, s.goalId), color: readableOn(goalColor(d, s.goalId)) } : {} }, i + 1),
                    React.createElement("div", { className: "flex" },
                        React.createElement("strong", null, s.title),
                        React.createElement("div", { className: "caption" },
                            this.dur(effectiveStepMinutes(s, allocation)),
                            " \u00B7 ",
                            ((_a = s.children) === null || _a === void 0 ? void 0 : _a.length) ? s.children.length + ' elementos' : 'Ver instrucciones')),
                    React.createElement(Icon, { name: "right", size: 18 })); }))),
            this.evidenceSection(e, date, (current === null || current === void 0 ? void 0 : current.id) || ''),
            React.createElement(NoteEditor, { key: e.id + '-' + date + '-' + ((current === null || current === void 0 ? void 0 : current.id) || 'block'), value: current ? ((_c = log.stepNotes) === null || _c === void 0 ? void 0 : _c[current.id]) || '' : log.note || '', carry: upcomingNote(d, e, date, current === null || current === void 0 ? void 0 : current.id), label: current ? 'Nota de este paso' : 'Nota de esta actividad o rutina', onSave: text => this.saveOccurrenceNote(e, date, text, current === null || current === void 0 ? void 0 : current.id) }),
            !r && React.createElement("div", { className: "notice" }, "Para desglosar este bloque en pasos, as\u00EDgnale una rutina desde \u00ABEditar bloque\u00BB."),
            path.length > 0 && React.createElement(Btn, { kind: "ghost", onClick: () => this.setState({ detailPath: path.slice(0, -1) }) },
                React.createElement(Icon, { name: "left" }),
                " Volver al nivel anterior"));
    }
    renderGuide() {
        if (!this.state.guideOpen)
            return null;
        const i = this.state.guideStep, step = guideSteps[i];
        const dock = i > 0;
        const goal = this.state.data.goals.find(g => g.id === this.state.guideGoalId);
        const buttonLabel = i === 0 ? '¡Vamos!' : i === 1 ? 'Crear mi primera meta' : i === 2 ? 'Añadir submeta' : i === 3 ? 'Programar revisión' : i === 4 ? 'Programar rutina' : i === 5 ? 'Ver mi horario' : 'Finalizar recorrido';
        return React.createElement("div", { className: 'guide-backdrop ' + (dock ? 'guide-docked' : 'guide-welcome'), role: "presentation" },
            React.createElement("div", { className: "guide-panel", role: "dialog", "aria-modal": !dock, "aria-label": "Tutorial interactivo" },
                React.createElement("div", { className: "guide-top" },
                    React.createElement("span", { className: "guide-tag" },
                        React.createElement(Icon, { name: "spark" }),
                        " TUTORIAL INTERACTIVO"),
                    React.createElement("button", { className: "icon-btn", onClick: this.finishGuide, "aria-label": "Saltar el tutorial", title: "Saltar tutorial" },
                        React.createElement(Icon, { name: "close" }))),
                React.createElement("div", { className: "guide-progress" }, guideSteps.map((s, j) => React.createElement("span", { className: 'guide-dot ' + (j <= i ? 'active' : ''), key: j }))),
                React.createElement("div", { className: "guide-section-label" },
                    "APRENDE HACIENDO \u00B7 Paso ",
                    i + 1,
                    " de ",
                    guideSteps.length),
                React.createElement("h2", null, step.title),
                React.createElement("p", null, step.text),
                React.createElement("div", { className: "guide-why" },
                    React.createElement(Icon, { name: "spark", size: 17 }),
                    React.createElement("span", null,
                        React.createElement("strong", null, "\u00BFPor qu\u00E9 hacemos esto?"),
                        " ",
                        i === 1 ? 'Elegir un rumbo claro facilita decidir qué merece tu tiempo.' : i === 2 ? 'Los pasos pequeños convierten una ambición enorme en avances que puedes reconocer.' : i === 3 ? 'Una revisión periódica te permite ajustar el plan sin perder perspectiva.' : i === 4 ? 'Repetir una acción reduce la necesidad de organizarla de nuevo cada mañana.' : i === 5 ? 'Reservar un espacio de tiempo hace que los objetivos tengan un lugar real en tu día.' : 'Fullhouse reúne intención, ejecución y seguimiento en un mismo lugar.')),
                goal && i > 1 && i < 6 && React.createElement("div", { className: "guide-selected-goal" },
                    React.createElement(Icon, { name: "target", size: 16 }),
                    " Trabajando en: ",
                    React.createElement("strong", null, goal.title)),
                i === 1 && React.createElement("div", { className: "guide-tip" }, "Te recomendamos crear una meta nueva para practicar. Si prefieres, usa \u00ABElegir para la gu\u00EDa\u00BB en una meta existente."),
                i === 5 && React.createElement("div", { className: "guide-tip" }, "Busca el bloque que programaste: estar\u00E1 en la fecha que elegiste."),
                React.createElement("div", { className: "guide-buttons" },
                    React.createElement("button", { className: "guide-skip", onClick: this.finishGuide }, "Saltar tutorial"),
                    React.createElement(Btn, { onClick: this.guideAction },
                        buttonLabel,
                        " ",
                        React.createElement(Icon, { name: "arrow-right", size: 16 })))));
    }
    helpBody() {
        const content = {
            hoy: ['Mi día y revisión', ['Aquí ejecutas las actividades de la jornada y marcas los pasos que completas.', 'Puedes adjuntar fotos y notas opcionales a cada bloque o paso.', 'Antes de dormir revisa tus avances, los ámbitos atendidos y deja una reflexión para mañana.', 'Tus fotografías se comprimen y permanecen en el almacenamiento de este navegador. Exporta respaldos con frecuencia.']],
            inicio: ['Inicio y resumen', ['Tu panel reúne las metas, rutinas y actividades del día.', 'El porcentaje de cumplimiento refleja actividades realizadas, no resultados obtenidos.', 'Usa los accesos rápidos para crear metas, rutinas o programar eventos.']],
            metas: ['Metas y tipos de seguimiento', ['Numérica: registra un resultado concreto y una cantidad objetivo.', 'Cualitativa: elige estados de avance y deja reflexiones; es ideal para relaciones, bienestar o aprendizaje.', 'Por hitos: divide una meta en logros verificables y marca los que completas.', 'Clasifica tus objetivos por ámbito (Mente, Físico, Propósito, Social), vincula fechas de revisión y explora sus conexiones.']],
            rutinas: ['Rutinas y procedimientos', ['Las rutinas son plantillas reutilizables. Arrastra el tirador de cada paso para reordenarlo.', 'Cada paso puede realizarse siempre, aparecer solo ciertos días o presentar opciones distintas según el día, cada una con sus propias instrucciones.', 'Cada rutina tiene una programación vigente: usa «Reprogramar» para modificar el futuro sin afectar el historial.']],
            horario: ['Horario de mañana a noche', ['Cada bloque representa una actividad o rutina programada. Su diseño se adapta a la duración disponible.', 'Haz clic en un bloque para acercarte a su contenido, sus pasos y sus detalles.', 'Si algo cambia, puedes editar el bloque o moverlo ±15 minutos desde el calendario.']],
            calendario: ['Calendario independiente', ['Selecciona un día para consultar su agenda.', 'Los eventos pueden ocurrir una sola vez o repetirse por días, intervalos o fechas concretas, con un último día de repetición.', 'Los movimientos de ±15 minutos aplican solo a ese día, incluso en una rutina recurrente.']],
            progreso: ['Progreso y resultados', ['Puedes comparar lo planeado con lo realizado durante los últimos siete días.', 'Las metas numéricas, los hitos y las cualitativas se muestran de forma diferente.', 'Registrar una actividad completada no modifica automáticamente un resultado personal.']],
            ajustes: ['Apariencia, respaldos y ayuda', ['Selecciona una paleta y la interfaz se adaptará al instante.', 'Desde cualquier ventana emergente puedes alternar entre disposición vertical u horizontal.', 'Exporta un respaldo JSON antes de limpiar los datos del navegador.', 'Puedes volver a abrir la guía en cualquier momento.']]
        };
        const [title, lines] = content[this.state.helpTopic] || content.inicio;
        return React.createElement("div", { className: "help-content" },
            React.createElement("h3", null, title),
            lines.map((line, i) => React.createElement("div", { className: "help-line", key: i },
                React.createElement("span", null, i + 1),
                React.createElement("p", null, line))),
            React.createElement(Btn, { onClick: () => { this.setState({ helpOpen: false }); this.openGuide(); }, kind: "secondary" },
                React.createElement(Icon, { name: "help" }),
                " Abrir gu\u00EDa completa"));
    }
    renderHelpPanel() { if (!this.state.helpOpen)
        return null; return React.createElement("aside", { className: 'help-float ' + (this.state.modal ? 'in-modal' : ''), role: 'complementary', "aria-label": 'Ayuda contextual', style: this.state.helpX !== null && this.state.helpY !== null ? { left: this.state.helpX, top: this.state.helpY, right: 'auto', bottom: 'auto' } : undefined },
        React.createElement("div", { className: 'help-float-head', onPointerDown: this.beginHelpDrag, title: 'Arrastra para mover esta ayuda' },
            React.createElement("strong", null,
                React.createElement(Icon, { name: 'help', size: 18 }),
                " Ayuda contextual"),
            React.createElement("button", { className: 'icon-btn', onClick: () => this.setState({ helpOpen: false }), title: 'Cerrar ayuda', "aria-label": 'Cerrar ayuda' },
                React.createElement(Icon, { name: 'close', size: 16 }))),
        this.helpBody()); }
    isCalendarImportant(e) { return e.kind === 'review' || e.kind === 'occasion' || (!e.routineId && ['none', 'monthly', 'yearly', 'dates'].includes(e.repeat)); }
    renderCalendarAgenda(date) {
        const d = this.state.data, all = eventsOn(d, date), important = all.filter(e => this.isCalendarImportant(e));
        const routines = all.filter(e => !!e.routineId && e.repeat !== 'none');
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: 'calendar-agenda-entries' }, important.length ? important.map(e => React.createElement("div", { className: 'calendar-agenda-entry', key: e.id },
                React.createElement("span", { className: 'calendar-agenda-when' }, e.allDay ? 'Todo el día' : eventTime(e, date, d)),
                React.createElement("div", { className: 'flex' },
                    React.createElement("strong", null, e.title),
                    React.createElement("small", null,
                        e.kind === 'review' ? 'Revisión de meta' : e.kind === 'occasion' ? 'Evento' : 'Fecha importante',
                        e.endDate && e.kind === 'occasion' ? ' · Hasta ' + e.endDate : e.allDay ? ' · Día completo' : ' · ' + this.dur(durationOn(e, date, d))),
                    e.note && React.createElement("p", null, e.note)),
                React.createElement("button", { className: 'icon-btn', onClick: () => this.openEvent(e), title: 'Editar' },
                    React.createElement(Icon, { name: 'edit', size: 16 })))) : React.createElement("div", { className: 'empty' },
                React.createElement("strong", null, "Sin fechas especiales"),
                React.createElement("p", null, "Las tareas diarias se mantienen en Horario. Aqu\u00ED aparecer\u00E1n viajes, citas, fechas importantes y revisiones."))),
            React.createElement("div", { className: 'calendar-routine-summary' },
                React.createElement("strong", null,
                    React.createElement(Icon, { name: 'checklist', size: 16 }),
                    " Rutinas de este d\u00EDa"),
                React.createElement("span", null, routines.length ? `${routines.length} programada${routines.length === 1 ? '' : 's'}` : 'Sin rutinas recurrentes'),
                React.createElement("div", { className: 'calendar-routine-chips' }, routines.map(e => { var _a; return React.createElement("span", { key: e.id, className: 'calendar-routine-chip' },
                    React.createElement("i", { style: { background: ((_a = d.goals.find(g => g.id === e.goalId)) === null || _a === void 0 ? void 0 : _a.color) || areaInfo('other').color } }),
                    e.title); }))));
    }
    renderCalendar() {
        const date = this.state.selectedDate, d = this.state.data;
        return React.createElement(React.Fragment, null,
            this.renderHeading('Calendario', 'Fechas importantes, compromisos y revisiones. Las rutinas se muestran como puntos de referencia.', React.createElement(Btn, { onClick: () => this.openEvent(undefined, 'occasion') },
                React.createElement(Icon, { name: 'plus' }),
                " Nuevo evento")),
            React.createElement("div", { className: 'calendar-shortcut' },
                React.createElement("span", null,
                    React.createElement(Icon, { name: 'spark' }),
                    " Las fechas tambi\u00E9n cuentan tu historia"),
                React.createElement("span", { className: 'calendar-shortcut-note' }, "Tus rutinas aparecen como puntos de color; en el calendario destacamos los acontecimientos importantes.")),
            React.createElement("div", { className: 'calendar-layout calendar-layout-full' },
                React.createElement("section", { className: 'panel calendar-main-panel' },
                    React.createElement("div", { className: 'calendar-toolbar' },
                        React.createElement("div", { className: 'month-name' }, fmtMonth(this.state.month)),
                        React.createElement("div", { className: 'calendar-nav' },
                            React.createElement("button", { className: 'calendar-agenda-button', onClick: () => this.setState({ calendarDetailOpen: !this.state.calendarDetailOpen }) }, this.state.calendarDetailOpen ? 'Ocultar detalle' : 'Ver día seleccionado'),
                            React.createElement("button", { className: 'icon-btn', onClick: () => this.changeMonth(-1), title: 'Mes anterior' },
                                React.createElement(Icon, { name: 'left' })),
                            React.createElement("button", { className: 'icon-btn', onClick: () => this.chooseDay(today()), title: 'Volver a hoy' },
                                React.createElement(Icon, { name: 'sun' })),
                            React.createElement("button", { className: 'icon-btn', onClick: () => this.changeMonth(1), title: 'Mes siguiente' },
                                React.createElement(Icon, { name: 'right' })))),
                    React.createElement("div", { className: 'weekday-grid' }, weekdays.map((w, i) => React.createElement("div", { className: 'weekday', key: i }, w))),
                    React.createElement("div", { className: 'month-grid' }, this.monthDays().map(c => { const all = eventsOn(d, c.day), important = all.filter(e => this.isCalendarImportant(e)), repeated = all.filter(e => !!e.routineId && e.repeat !== 'none'); return React.createElement("button", { key: c.day, className: `day-cell ${c.inside ? '' : 'outside'} ${c.day === date ? 'selected' : ''} ${c.day === today() ? 'today' : ''}`, onClick: () => this.chooseDay(c.day), "aria-label": fmtDate(c.day) + ', ' + important.length + ' fechas importantes, ' + repeated.length + ' rutinas' },
                        React.createElement("div", { className: 'day-number' }, parseDay(c.day).getDate()),
                        important.slice(0, 2).map(e => React.createElement("span", { key: e.id, className: 'calendar-important-label', style: { '--event-color': goalColor(d, e.goalId) || '#a26cf4' }, title: e.title },
                            e.kind === 'review' ? '✦ ' : e.kind === 'occasion' ? '◆ ' : '',
                            e.title)),
                        important.length > 2 && React.createElement("small", { className: 'calendar-more' },
                            "+",
                            important.length - 2,
                            " m\u00E1s"),
                        repeated.length > 0 && React.createElement("div", { className: 'day-dots', "aria-label": 'Rutinas recurrentes' }, repeated.slice(0, 5).map(e => { var _a; return React.createElement("span", { key: e.id, className: 'day-dot', style: { background: ((_a = d.goals.find(g => g.id === e.goalId)) === null || _a === void 0 ? void 0 : _a.color) || areaInfo('other').color } }); }))); }))),
                this.state.calendarDetailOpen && React.createElement(React.Fragment, null,
                    React.createElement("div", { className: 'calendar-inspector-shade', onClick: () => this.setState({ calendarDetailOpen: false }) }),
                    React.createElement("section", { className: 'panel calendar-inspector', role: 'dialog', "aria-label": 'Eventos de la fecha seleccionada' },
                        React.createElement("button", { type: 'button', className: 'calendar-inspector-close icon-btn', "aria-label": 'Cerrar detalle', onClick: () => this.setState({ calendarDetailOpen: false }) },
                            React.createElement(Icon, { name: 'close', size: 18 })),
                        React.createElement("div", { className: 'panel-head' },
                            React.createElement("div", null,
                                React.createElement("div", { className: 'eyebrow', style: { marginBottom: 5 } }, "FECHAS IMPORTANTES"),
                                React.createElement("h2", { className: 'selected-date' }, fmtDate(date))),
                            React.createElement(Btn, { tiny: true, kind: 'secondary', onClick: () => this.openEvent(undefined, 'occasion') },
                                React.createElement(Icon, { name: 'plus', size: 15 }))),
                        this.renderCalendarAgenda(date)))));
    }
    renderProgress() {
        const d = this.state.data;
        const start = addDays(today(), -6);
        const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        let weekPlanned = 0, weekDone = 0;
        for (const day of days) {
            for (const e of eventsOn(d, day).filter(e => !e.allDay)) {
                weekPlanned++;
                if (done(d, e, day))
                    weekDone++;
            }
        }
        return React.createElement(React.Fragment, null,
            this.renderHeading('Mi progreso', 'Comprende la diferencia entre tu constancia diaria y los resultados que estás consiguiendo.'),
            React.createElement("div", { className: "cards progress-stats" },
                this.renderStat('Últimos 7 días', weekPlanned, 'Actividades programadas', 'calendar'),
                this.renderStat('Completadas', weekDone, 'Registros de ejecución', 'checklist'),
                this.renderStat('Cumplimiento', weekPlanned ? Math.round(weekDone / weekPlanned * 100) + '%' : '—', 'Últimos 7 días', 'chart'),
                this.renderStat('Metas con medida', d.goals.filter(g => g.target > 0).length, 'Objetivos cuantificados', 'target')),
            React.createElement("div", { className: "two-col" },
                React.createElement("section", { className: "panel" },
                    React.createElement("div", { className: "panel-head" },
                        React.createElement("div", null,
                            React.createElement("h2", null, "Actividad de la semana"),
                            React.createElement("p", { className: "panel-sub" }, "Porcentaje diario de actividades completadas"))),
                    React.createElement("div", { className: "week-chart" }, days.map(day => { const a = eventsOn(d, day).filter(e => !e.allDay), c = a.filter(e => done(d, e, day)).length, p = a.length ? Math.round(c / a.length * 100) : 0; return React.createElement("div", { key: day, className: "bar-wrap" },
                        React.createElement("div", { className: "bar-value" }, a.length ? p + '%' : '—'),
                        React.createElement("div", { className: "bar", style: { height: (5 + p * .85) + '%', background: day === today() ? '#407d5d' : '#b7d0b4' }, title: `${c}/${a.length}` }),
                        React.createElement("div", { className: "bar-label" }, longDays[parseDay(day).getDay()].slice(0, 3))); }))),
                React.createElement("section", { className: "panel" },
                    React.createElement("div", { className: "panel-head" },
                        React.createElement("div", null,
                            React.createElement("h2", null, "Resultados medibles"),
                            React.createElement("p", { className: "panel-sub" }, "Actualizados manualmente con su historial"))),
                    d.goals.filter(g => g.target > 0).length ? d.goals.filter(g => g.target > 0).map(g => React.createElement("div", { key: g.id, className: "goal-summary" },
                        React.createElement("div", { className: "goal-summary-top" },
                            React.createElement("strong", null, g.title),
                            React.createElement("span", null,
                                g.current,
                                "/",
                                g.target,
                                " ",
                                g.unit)),
                        React.createElement("div", { className: "progress-track" },
                            React.createElement("div", { className: "progress-fill", style: { width: percent(g.current, g.target) + '%', background: g.color } })),
                        React.createElement("div", { className: "actions", style: { marginTop: 9 } },
                            React.createElement(Btn, { kind: "ghost", tiny: true, onClick: () => this.openProgress(g) }, "Actualizar resultado")))) : React.createElement("div", { className: "empty" },
                        React.createElement("strong", null, "No hay indicadores configurados"),
                        React.createElement("p", null, "Asigna una cantidad objetivo a una meta para verla aqu\u00ED.")))),
            React.createElement("div", { className: "section-head" },
                React.createElement("h2", { className: "section-title" }, "Metas cualitativas y por hitos"),
                this.hint('metas')),
            React.createElement("section", { className: "panel" },
                React.createElement("div", { className: "qual-list" },
                    d.goals.filter(g => goalMode(g) !== 'numeric').map(g => React.createElement("div", { key: g.id, className: "qual-row" },
                        React.createElement("span", { className: "goal-color", style: { background: g.color } }),
                        React.createElement("div", { className: "flex" },
                            React.createElement("strong", null, g.title),
                            React.createElement("div", { className: "caption" }, goalMode(g) === 'qualitative' ? statusLabel(goalStatus(g)) : goalMilestones(g).filter(m => m.done).length + ' de ' + goalMilestones(g).length + ' hitos')),
                        goalMode(g) === 'qualitative' && React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openProgress(g) }, "Actualizar"))),
                    !d.goals.some(g => goalMode(g) !== 'numeric') && React.createElement("div", { className: "caption" }, "A\u00FAn no hay metas de este tipo."))),
            React.createElement("div", { className: 'section-head' },
                React.createElement("h2", { className: 'section-title' }, "Mi diario y recuerdos"),
                React.createElement("span", { className: 'caption' }, "Tus revisiones de cierre y fotograf\u00EDas forman un historial.")),
            React.createElement("section", { className: 'panel journal-archive' },
                Object.entries(d.dayReviews || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10).map(([date, review]) => React.createElement("div", { key: date, className: 'journal-entry' },
                    React.createElement("button", { type: 'button', onClick: () => this.setState({ page: 'horario', selectedDate: date, month: firstMonth(date) }) },
                        React.createElement("strong", null, fmtDate(date)),
                        React.createElement(Icon, { name: 'right', size: 15 })),
                    React.createElement("p", null, review.note || 'Día revisado sin observaciones escritas.'),
                    React.createElement("small", null,
                        eventsOn(d, date).filter(e => done(d, e, date)).length,
                        " actividades completadas"))),
                !Object.keys(d.dayReviews || {}).length && React.createElement("p", { className: 'caption' }, "Tus reflexiones aparecer\u00E1n aqu\u00ED cuando guardes la revisi\u00F3n desde \u00ABMi d\u00EDa\u00BB."),
                React.createElement("div", { className: 'journal-photos' }, Object.entries(d.logs).flatMap(([k, log]) => (log.evidences || []).map(pic => ({ pic, key: k }))).sort((a, b) => b.pic.createdAt.localeCompare(a.pic.createdAt)).slice(0, 18).map(({ pic, key }) => React.createElement("figure", { key: pic.id, className: 'journal-photo' },
                    React.createElement("img", { src: pic.src, alt: 'Recuerdo del ' + key.split('@')[1] }),
                    React.createElement("figcaption", null, key.split('@')[1]))))),
            React.createElement("div", { className: "section-head" },
                React.createElement("h2", { className: "section-title" }, "\u00DAltimos registros de resultados")),
            React.createElement("section", { className: "panel" },
                d.goals.flatMap(g => g.history.map(h => ({ ...h, goal: g.title, unit: g.unit }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((h, i) => React.createElement("div", { className: "agenda-item", key: i },
                    React.createElement("div", { className: "agenda-time" }, h.date.slice(5)),
                    React.createElement("div", { className: "agenda-main" },
                        React.createElement("div", { className: "agenda-name" },
                            h.goal,
                            " \u00B7 ",
                            h.status ? statusLabel(h.status) : h.value + ' ' + h.unit),
                        h.note && React.createElement("div", { className: "agenda-sub" }, h.note)))),
                !d.goals.some(g => g.history.length > 0) && React.createElement("div", { className: "empty" },
                    React.createElement("strong", null, "A\u00FAn no hay resultados registrados"),
                    React.createElement("p", null, "Desde una meta, pulsa \u00ABRegistrar avance\u00BB para iniciar tu historial."))));
    }
    renderSettings() {
        return React.createElement(React.Fragment, null,
            this.renderHeading('Apariencia, ayuda y ajustes', 'Todo permanece bajo tu control. Realiza copias de seguridad para conservar tus datos incluso si cambias de dispositivo o navegador.'),
            React.createElement("div", { className: "settings-box" },
                React.createElement("div", { className: "row spread" },
                    React.createElement("h2", null, "Paletas de colores"),
                    this.hint('ajustes')),
                React.createElement("p", null, "Elige la atm\u00F3sfera que m\u00E1s te guste. La paleta \u00ABAurora\u00BB es la predeterminada."),
                React.createElement("div", { className: "theme-grid" }, themeOptions.map(t => React.createElement("button", { key: t.id, className: 'theme-tile ' + (this.state.theme === t.id ? 'chosen' : ''), onClick: () => this.setTheme(t.id) },
                    React.createElement("div", { className: "theme-bubbles" }, t.colors.map((c, i) => React.createElement("span", { key: i, style: { background: c } }))),
                    React.createElement("strong", null, t.name),
                    React.createElement("span", null, t.hint),
                    this.state.theme === t.id && React.createElement("i", null, "\u2713"))))),
            React.createElement("div", { className: 'settings-box' },
                React.createElement("h2", null, "Formato de duraci\u00F3n"),
                React.createElement("p", null, "Elige c\u00F3mo mostrar los tiempos en rutinas, horario y pasos. El formato predeterminado es horas y minutos."),
                React.createElement("div", { className: 'time-anchor-choice' },
                    React.createElement("button", { className: this.state.durationDisplay === 'hours' ? 'active' : '', onClick: () => this.changeDurationDisplay('hours') }, "Horas y minutos \u00B7 1 h 32 min"),
                    React.createElement("button", { className: this.state.durationDisplay === 'minutes' ? 'active' : '', onClick: () => this.changeDurationDisplay('minutes') }, "Solo minutos \u00B7 92 min"))),
            React.createElement("div", { className: "settings-box" },
                React.createElement("h2", null, "Gu\u00EDa interactiva"),
                React.createElement("p", null, "Vuelve a recorrer los pasos para conocer el funcionamiento de Fullhouse."),
                React.createElement(Btn, { kind: "secondary", onClick: this.openGuide },
                    React.createElement(Icon, { name: "help" }),
                    " Iniciar la gu\u00EDa")),
            React.createElement("div", { className: "settings-box" },
                React.createElement("h2", null, "Disposici\u00F3n de las ventanas"),
                React.createElement("p", null, "Puedes cambiar entre modo vertical y horizontal desde la parte superior de cualquier ventana emergente."),
                React.createElement("div", { className: "row" },
                    React.createElement(Btn, { kind: this.state.modalLayout === 'vertical' ? '' : 'secondary', onClick: () => this.setLayout('vertical') },
                        React.createElement(Icon, { name: "vertical" }),
                        " Vertical"),
                    React.createElement(Btn, { kind: this.state.modalLayout === 'horizontal' ? '' : 'secondary', onClick: () => this.setLayout('horizontal') },
                        React.createElement(Icon, { name: "horizontal" }),
                        " Horizontal"))),
            React.createElement("div", { className: "settings-box" },
                React.createElement("h2", null, "Exportar mis datos"),
                React.createElement("p", null, "Descarga un archivo JSON con todas tus metas, rutinas, actividades, fechas, pasos completados y registros. Gu\u00E1rdalo en un lugar seguro."),
                React.createElement(Btn, { onClick: this.exportData },
                    React.createElement(Icon, { name: "download", size: 16 }),
                    " Descargar respaldo")),
            React.createElement("div", { className: "settings-box" },
                React.createElement("h2", null, "Restaurar un respaldo"),
                React.createElement("p", null,
                    "Importa un archivo JSON exportado anteriormente. ",
                    React.createElement("strong", null, "Esto reemplazar\u00E1 los datos actuales"),
                    " de este navegador. Te pediremos confirmaci\u00F3n."),
                React.createElement("label", { className: "btn secondary", style: { display: 'inline-flex', cursor: 'pointer', marginBottom: 0 } },
                    React.createElement(Icon, { name: "upload", size: 16 }),
                    " Elegir archivo JSON",
                    React.createElement("input", { className: "hide", type: "file", accept: ".json,application/json", onChange: this.importData }))),
            React.createElement("div", { className: "settings-box" },
                React.createElement("h2", null, "Restablecer datos de ejemplo"),
                React.createElement("p", null, "Vuelve al contenido inicial para hacer nuevas pruebas. Primero descarga un respaldo si hay algo que quieras conservar."),
                React.createElement(Btn, { kind: "danger", onClick: this.reset },
                    React.createElement(Icon, { name: "trash", size: 15 }),
                    " Restablecer ejemplos")),
            React.createElement("div", { className: "notice" },
                React.createElement("strong", null, "Importante:"),
                " los datos se almacenan con localStorage, solo en este navegador y perfil. Si limpias los datos del sitio, usas modo privado o cambias de dispositivo, podr\u00EDas perderlos. Este prototipo no cifra la informaci\u00F3n ni hace respaldos autom\u00E1ticos. Para datos importantes o privados, usa una copia de seguridad y una futura versi\u00F3n con almacenamiento m\u00E1s robusto."));
    }
    renderModal() {
        const modal = this.state.modal;
        if (!modal)
            return null;
        let title = '';
        if (modal === 'goal')
            title = (this.state.goalDraft.id ? 'Editar ' : 'Crear ') + (this.state.goalDraft.parentId ? 'submeta' : 'meta');
        if (modal === 'routine')
            title = this.state.routineDraft.id ? 'Editar rutina' : 'Nueva rutina';
        if (modal === 'event')
            title = this.state.eventDraft.routineId ? (this.state.eventDraft.id ? 'Reprogramar rutina' : 'Programar rutina') : this.state.eventDraft.kind === 'occasion' ? (this.state.eventDraft.id ? 'Editar evento' : 'Crear evento') : (this.state.eventDraft.id ? 'Editar actividad' : 'Programar actividad');
        if (modal === 'execute')
            title = 'Ejecutar procedimiento';
        if (modal === 'progress')
            title = 'Registrar avance';
        if (modal === 'detail')
            title = 'Dentro de mi horario';
        if (modal === 'help')
            title = '¿Cómo funciona?';
        return React.createElement("div", { className: 'modal-backdrop', onPointerDown: ev => { this.backdropDown = ev.target === ev.currentTarget; }, onPointerCancel: () => { this.backdropDown = false; }, onClick: ev => { if (this.backdropDown && ev.target === ev.currentTarget)
                this.close(); this.backdropDown = false; } },
            React.createElement("div", { className: 'modal ' + (this.state.modalLayout === 'horizontal' ? 'wide' : 'vertical'), role: "dialog", "aria-modal": "true", "aria-label": title },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "FULLHOUSE \u00B7 DETALLES"),
                        React.createElement("h2", { className: "modal-title" }, title)),
                    React.createElement("div", { className: "modal-header-actions" },
                        ['goal', 'routine', 'event'].includes(modal) && React.createElement("button", { type: 'button', className: 'advanced-toggle ' + (this.state.advancedOpen ? 'active' : ''), onClick: this.toggleAdvanced, title: 'Mostrar u ocultar opciones avanzadas' }, this.state.advancedOpen ? '− Avanzado' : '+ Avanzado'),
                        React.createElement("button", { className: 'icon-btn', title: 'Ayuda sobre esta ventana', "aria-label": 'Ayuda sobre esta ventana', onClick: () => this.openHelp(modal === 'goal' ? 'metas' : modal === 'routine' ? 'rutinas' : modal === 'event' ? 'calendario' : 'horario') },
                            React.createElement(Icon, { name: 'help', size: 18 })),
                        React.createElement("div", { className: "layout-switch" },
                            React.createElement("button", { className: this.state.modalLayout === 'vertical' ? 'active' : '', title: "Ventana vertical", "aria-label": "Vista vertical", onClick: () => this.setLayout('vertical') },
                                React.createElement(Icon, { name: "vertical", size: 16 })),
                            React.createElement("button", { className: this.state.modalLayout === 'horizontal' ? 'active' : '', title: "Ventana horizontal", "aria-label": "Vista horizontal", onClick: () => this.setLayout('horizontal') },
                                React.createElement(Icon, { name: "horizontal", size: 16 }))),
                        React.createElement("button", { className: "icon-btn", onClick: this.close, "aria-label": "Cerrar" },
                            React.createElement(Icon, { name: "close" })))),
                React.createElement("div", { className: "modal-body", tabIndex: -1 }, modal === 'goal' ? this.goalForm() : modal === 'routine' ? this.routineForm() : modal === 'event' ? this.eventForm() : modal === 'progress' ? this.progressForm() : modal === 'detail' ? this.renderDetail() : modal === 'help' ? this.helpBody() : this.executeForm()),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement(Btn, { kind: "secondary", onClick: this.close }, "Cerrar"),
                    modal === 'goal' && React.createElement(Btn, { onClick: this.saveGoal }, "Guardar meta"),
                    modal === 'routine' && React.createElement(Btn, { onClick: this.saveRoutine, disabled: !!this.routineIssue(this.state.routineDraft) }, "Guardar rutina"),
                    modal === 'event' && React.createElement(Btn, { onClick: this.saveEvent }, this.state.eventDraft.routineId ? 'Guardar programación' : this.state.eventDraft.kind === 'occasion' ? 'Guardar evento' : 'Guardar actividad'),
                    modal === 'progress' && React.createElement(Btn, { onClick: this.saveProgress }, "Registrar avance"))));
    }
    goalForm() {
        var _a, _b, _c;
        const x = this.state.goalDraft, notAllowed = x.id ? [x.id, ...this.descendants(x.id)] : [], mode = goalMode(x);
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Nombre de la meta *"),
                React.createElement("input", { maxLength: 90, value: x.title, onChange: e => this.updateGoalDraft({ title: e.target.value }), placeholder: "Ej. Mejorar mi relaci\u00F3n con mi familia" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null,
                    "Descripci\u00F3n o prop\u00F3sito ",
                    this.hint('metas')),
                React.createElement(AutoTextarea, { maxLength: 1500, value: x.desc, onChange: (e) => this.updateGoalDraft({ desc: e.target.value }), placeholder: "\u00BFQu\u00E9 quiero conseguir? \u00BFPor qu\u00E9 me importa?" })),
            React.createElement("div", { className: 'field' },
                React.createElement("label", null,
                    "\u00BFA qu\u00E9 \u00E1mbito de tu vida pertenece? ",
                    this.hint('metas')),
                React.createElement("div", { className: 'area-options' }, lifeAreas.map(a => React.createElement("button", { type: 'button', key: a.id, className: 'area-option ' + (x.area === a.id ? 'active' : ''), onClick: () => this.updateGoalDraft({ area: a.id }), style: { '--area-color': a.color } },
                    React.createElement("span", { className: 'area-option-dot' }),
                    React.createElement("strong", null, a.title),
                    React.createElement("small", null, a.detail))))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Meta superior (opcional)"),
                this.goalPicker(x.parentId, value => !notAllowed.includes(value) && this.updateGoalDraft({ parentId: value }), 'Ninguna · Meta principal')),
            React.createElement("div", { className: "field-grid" },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Fecha de inicio (opcional)"),
                    React.createElement("input", { type: "date", value: x.startDate || '', onChange: e => this.updateGoalDraft({ startDate: e.target.value }) })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Fecha objetivo (opcional)"),
                    React.createElement("input", { type: "date", value: x.dueDate || '', onChange: e => this.updateGoalDraft({ dueDate: e.target.value }) }))),
            React.createElement("div", { className: 'field goal-review' },
                React.createElement("div", { className: 'row spread' },
                    React.createElement("label", null,
                        "Fecha de revisi\u00F3n de avances ",
                        this.hint('calendario')),
                    React.createElement("span", { className: 'caption' }, "Se mostrar\u00E1 en el calendario")),
                React.createElement("div", { className: 'field-grid' },
                    React.createElement("div", { className: 'field' },
                        React.createElement("label", null, "Primera revisi\u00F3n"),
                        React.createElement("input", { type: 'date', value: ((_a = x.review) === null || _a === void 0 ? void 0 : _a.date) || '', onChange: e => { var _a, _b; return this.updateGoalDraft({ review: e.target.value ? { date: e.target.value, time: ((_a = x.review) === null || _a === void 0 ? void 0 : _a.time) || '18:00', repeat: ((_b = x.review) === null || _b === void 0 ? void 0 : _b.repeat) || 'none' } : undefined }); } })),
                    React.createElement("div", { className: 'field' },
                        React.createElement("label", null, "Repetir revisi\u00F3n"),
                        React.createElement(FriendlySelect, { value: ((_b = x.review) === null || _b === void 0 ? void 0 : _b.repeat) || 'none', ariaLabel: 'Periodicidad de revisi\u00F3n', onChange: repeat => this.updateGoalDraft({ review: x.review ? { ...x.review, repeat: repeat } : undefined }), options: [{ value: 'none', label: 'Una sola vez' }, { value: 'weekly', label: 'Cada semana' }, { value: 'monthly', label: 'Cada mes' }] }))),
                ((_c = x.review) === null || _c === void 0 ? void 0 : _c.date) && React.createElement("div", { className: 'field', style: { marginTop: 10, maxWidth: 250 } },
                    React.createElement("label", null, "Hora de revisi\u00F3n"),
                    React.createElement(TimePicker, { value: x.review.time || '18:00', onChange: time => this.updateGoalDraft({ review: { ...x.review, time } }) })),
                React.createElement("p", { className: 'caption' }, "Una revisi\u00F3n sirve para evaluar resultados y replantear acciones; no se cuenta como rutina diaria.")),
            this.state.advancedOpen && React.createElement("div", { className: 'field' },
                React.createElement("label", null, "Depende de otra meta (opcional)"),
                React.createElement(FriendlySelect, { ariaLabel: "Meta previa necesaria", value: x.dependsOn || '', onChange: dependsOn => this.updateGoalDraft({ dependsOn }), options: [{ value: '', label: 'Ninguna · Puede avanzar de forma independiente' }, ...this.state.data.goals.filter(g => !notAllowed.includes(g.id)).map(g => ({ value: g.id, label: 'Después de: ' + g.title }))] }),
                React.createElement("p", { className: "caption" }, "Esta conexi\u00F3n se dibuja con una l\u00EDnea discontinua en el mapa de metas.")),
            React.createElement("div", { className: "field" },
                React.createElement("label", null,
                    "\u00BFC\u00F3mo quieres medir el avance? ",
                    this.hint('metas')),
                React.createElement("div", { className: "goal-mode-grid" }, [{ id: 'numeric', label: 'Numérica', icon: 'chart', desc: 'Cantidades y objetivos' }, { id: 'qualitative', label: 'Cualitativa', icon: 'spark', desc: 'Estados y reflexiones' }, { id: 'milestones', label: 'Por hitos', icon: 'checklist', desc: 'Logros verificables' }].map(m => React.createElement("button", { key: m.id, className: 'goal-mode ' + (mode === m.id ? 'active' : ''), onClick: () => this.updateGoalDraft({ mode: m.id }) },
                    React.createElement(Icon, { name: m.icon }),
                    React.createElement("strong", null, m.label),
                    React.createElement("small", null, m.desc))))),
            mode === 'numeric' && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "field-grid" },
                    React.createElement("div", { className: "field" },
                        React.createElement("label", null, "Resultado actual"),
                        React.createElement(NumberField, { value: x.current, min: 0, onCommit: current => this.updateGoalDraft({ current }) })),
                    React.createElement("div", { className: "field" },
                        React.createElement("label", null, "Resultado objetivo"),
                        React.createElement(NumberField, { value: x.target, min: 0, onCommit: target => this.updateGoalDraft({ target }) }))),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Unidad de medida"),
                    React.createElement("input", { maxLength: 40, placeholder: "Ej. km, sesiones, cap\u00EDtulos, kg", value: x.unit, onChange: e => this.updateGoalDraft({ unit: e.target.value }) }))),
            mode === 'qualitative' && React.createElement("div", { className: "field" },
                React.createElement("label", null, "Estado actual de tu meta"),
                React.createElement(FriendlySelect, { value: goalStatus(x), ariaLabel: "Estado de meta", onChange: value => this.updateGoalDraft({ status: value }), options: goalStatuses.map(s => ({ value: s.id, label: s.label + ' · ' + s.desc })) }),
                React.createElement("p", { className: "caption" }, "Este tipo no necesita n\u00FAmeros. Podr\u00E1s guardar reflexiones y cambios en tu progreso.")),
            mode === 'milestones' && React.createElement("div", { className: "field" },
                React.createElement("div", { className: "row spread" },
                    React.createElement("label", null, "Hitos o logros parciales"),
                    React.createElement("span", { className: "caption" },
                        goalMilestones(x).length,
                        " definidos")),
                goalMilestones(x).map(m => React.createElement("div", { className: "milestone-editor", key: m.id },
                    React.createElement("input", { value: m.title, onChange: e => this.updateGoalDraft({ milestones: goalMilestones(x).map(k => k.id === m.id ? { ...k, title: e.target.value } : k) }), placeholder: "Describe un logro concreto" }),
                    React.createElement("button", { className: "icon-btn", "aria-label": "Quitar hito", onClick: () => this.updateGoalDraft({ milestones: goalMilestones(x).filter(k => k.id !== m.id) }) },
                        React.createElement(Icon, { name: "trash", size: 16 })))),
                React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.updateGoalDraft({ milestones: [...goalMilestones(x), { id: uid(), title: '', done: false }] }) },
                    React.createElement(Icon, { name: "plus", size: 14 }),
                    " Agregar hito"),
                React.createElement("p", { className: "caption" }, "Despu\u00E9s podr\u00E1s marcar cada hito como logrado desde la tarjeta de la meta.")),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Color de identificaci\u00F3n"),
                React.createElement("div", { className: "color-picker" },
                    colorOptions.map(c => React.createElement("button", { type: "button", key: c, className: 'color-dot ' + (x.color === c ? 'active' : ''), onClick: () => { this.updateGoalDraft({ color: c }); this.setState({ hexDraft: c }); }, "aria-label": 'Color ' + c, title: c, style: { background: c } })),
                    React.createElement("button", { type: "button", className: 'custom-color ' + (this.state.colorEditorOpen ? 'active' : ''), onClick: () => this.setState({ colorEditorOpen: !this.state.colorEditorOpen }) },
                        React.createElement(Icon, { name: "palette", size: 18 }),
                        " Personalizar")),
                this.state.colorEditorOpen && React.createElement("div", { className: "custom-color-editor" },
                    React.createElement("div", { className: "custom-color-preview" },
                        React.createElement("span", { style: { background: x.color } }),
                        React.createElement("div", null,
                            React.createElement("strong", null, "Crea tu propio tono"),
                            React.createElement("small", null, x.color.toUpperCase()))),
                    ['Tono', 'Saturación', 'Luminosidad'].map((label, i) => { const hsl = hexToHsl(x.color); return React.createElement("div", { key: label, className: "color-slider-row" },
                        React.createElement("label", null, label),
                        React.createElement("input", { type: "range", min: 0, max: i === 0 ? 359 : 100, value: hsl[i], className: i === 0 ? 'hue-range' : 'color-range', onChange: e => { const values = [...hsl]; values[i] = Number(e.target.value); this.updateGoalDraft({ color: hslToHex(values[0], values[1], values[2]) }); this.setState({ hexDraft: hslToHex(values[0], values[1], values[2]) }); } })); }),
                    React.createElement("div", { className: "custom-color-actions" },
                        React.createElement("label", null,
                            "Hexadecimal ",
                            React.createElement("input", { value: this.state.hexDraft, maxLength: 7, onChange: e => { const v = e.target.value; this.setState({ hexDraft: v }); if (/^#[a-fA-F0-9]{6}$/.test(v))
                                    this.updateGoalDraft({ color: v }); }, onBlur: () => this.setState({ hexDraft: this.state.goalDraft.color }), "aria-label": "Color hexadecimal" })),
                        React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.setState({ colorEditorOpen: false }) }, "Listo")))));
    }
    routineForm() {
        const r = this.state.routineDraft, mode = r.durationMode || 'steps', active = activeSteps(r.steps, this.state.selectedDate), balance = routineBalance(r, this.state.selectedDate), issue = this.routineIssue(r);
        const allocations = leafAllocation(active, routineMinutes(r)), flexLeaves = leafSteps(active).filter(x => x.flexible), free = Math.max(0, routineMinutes(r) - fixedStepMinutes(active));
        return React.createElement("div", { className: 'routine-form-v07' },
            this.state.returnToSchedule && React.createElement("div", { className: 'routine-context-alert' },
                React.createElement(Icon, { name: 'clock', size: 22 }),
                React.createElement("div", null,
                    React.createElement("strong", null, "Actualizando rutina para programarla entre bloques"),
                    React.createElement("p", null, this.state.scheduleContextNote),
                    React.createElement("small", null, "Al guardar regresar\u00E1s a la programaci\u00F3n, con las horas ya actualizadas."))),
            React.createElement("section", { className: 'routine-edit-section' },
                React.createElement("div", { className: 'editor-section-title' },
                    React.createElement("span", null, "01"),
                    React.createElement("div", null,
                        React.createElement("h3", null, "Identidad"),
                        React.createElement("p", null, "Nombre, icono y prop\u00F3sito de la rutina"))),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "Nombre de la rutina *"),
                    React.createElement("input", { maxLength: 90, value: r.title, onChange: ev => this.updateRoutineDraft({ title: ev.target.value }), placeholder: 'Ej. Trabajo concentrado' })),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "\u00CDcono de la rutina"),
                    React.createElement("div", { className: 'routine-icon-grid' }, routineIcons.map(ic => React.createElement("button", { type: 'button', key: ic, title: ic, "aria-label": 'Ícono ' + ic, "aria-pressed": (r.icon || 'checklist') === ic, className: 'routine-icon-choice ' + ((r.icon || 'checklist') === ic ? 'active' : ''), onClick: () => this.updateRoutineDraft({ icon: ic }) },
                        React.createElement(Icon, { name: ic, size: 21 }))))),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", { className: 'evidence-preference' },
                        React.createElement("input", { type: 'checkbox', checked: !!r.requestEvidence, onChange: e => this.updateRoutineDraft({ requestEvidence: e.target.checked }) }),
                        " Sugerir adjuntar evidencia al terminar la rutina (opcional)")),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null,
                        "Descripci\u00F3n ",
                        this.hint('rutinas')),
                    React.createElement(AutoTextarea, { maxLength: 1500, value: r.desc, onChange: (ev) => this.updateRoutineDraft({ desc: ev.target.value }), placeholder: '\u00BFQu\u00E9 se pretende conseguir con este procedimiento?' }))),
            React.createElement("section", { className: 'routine-edit-section' },
                React.createElement("div", { className: 'editor-section-title' },
                    React.createElement("span", null, "02"),
                    React.createElement("div", null,
                        React.createElement("h3", null, "C\u00F3mo se calcula la duraci\u00F3n"),
                        React.createElement("p", null, "Elige si estableces primero el tiempo o dejas que lo calculen los pasos"))),
                React.createElement("div", { className: 'duration-mode-grid' },
                    React.createElement("button", { className: mode === 'steps' ? 'active' : '', onClick: () => this.updateRoutineDraft({ durationMode: 'steps' }) },
                        React.createElement(Icon, { name: 'checklist', size: 22 }),
                        React.createElement("strong", null, "Seg\u00FAn mis pasos"),
                        React.createElement("small", null, "La duraci\u00F3n es la suma de los elementos que se realizan cada d\u00EDa.")),
                    React.createElement("button", { className: mode === 'fixed' ? 'active' : '', onClick: () => this.updateRoutineDraft({ durationMode: 'fixed', durationMin: r.durationMin || routineMinutes(r) }) },
                        React.createElement(Icon, { name: 'clock', size: 22 }),
                        React.createElement("strong", null, "Tiempo fijo"),
                        React.createElement("small", null, "Primero decido cu\u00E1nto dura la rutina y reparto el tiempo entre sus pasos."))),
                mode === 'fixed' && React.createElement("div", { className: 'duration-budget' },
                    React.createElement("div", { className: 'field' },
                        React.createElement("label", null, "Tiempo total de la rutina (minutos)"),
                        React.createElement(NumberField, { value: r.durationMin || 0, min: 1, max: 1440, onCommit: durationMin => this.updateRoutineDraft({ durationMin }) })),
                    React.createElement("div", { className: 'duration-budget-numbers' },
                        React.createElement("span", null,
                            "Pasos fijos: ",
                            React.createElement("strong", null, this.dur(balance.fixed))),
                        React.createElement("span", null,
                            "Disponible: ",
                            React.createElement("strong", null, this.dur(r.durationMin || 0))),
                        React.createElement("span", null,
                            "Contenido flexible: ",
                            React.createElement("strong", null, balance.flex))),
                    React.createElement("div", { className: 'duration-bar', "aria-label": 'Uso del presupuesto de tiempo' },
                        React.createElement("div", { style: { width: (r.durationMin ? Math.min(100, balance.fixed / r.durationMin * 100) : 100) + '%' } })),
                    issue ? React.createElement("div", { className: 'routine-validation-error', role: 'alert' },
                        React.createElement(Icon, { name: 'help', size: 18 }),
                        React.createElement("span", null,
                            issue,
                            " No se podr\u00E1 guardar hasta resolverlo.")) : React.createElement("div", { className: 'routine-validation-ok' }, "\u2713 El reparto cabe en la duraci\u00F3n que has elegido.")),
                mode === 'steps' && React.createElement("div", { className: 'notice' },
                    "Duraci\u00F3n estimada: ",
                    React.createElement("strong", null, this.dur(routineMinutes(r))),
                    ". Puedes utilizar pasos flexibles si programas esta rutina entre otras dos.")),
            mode === 'fixed' && React.createElement("div", { className: 'routine-budget-sticky ' + (issue ? 'is-warning' : ''), role: 'status' },
                React.createElement("div", { className: 'row spread' },
                    React.createElement("strong", null,
                        "Tiempo asignado: ",
                        this.dur(balance.fixed),
                        " / ",
                        this.dur(r.durationMin || 0)),
                    React.createElement("span", null, issue ? '⚠ Revisa el reparto' : balance.flex ? '↔ Sobrante para flexibles' : '✓ Distribución correcta')),
                React.createElement("div", { className: 'duration-bar' },
                    React.createElement("span", { style: { display: 'block', width: (r.durationMin ? Math.min(100, balance.fixed / r.durationMin * 100) : 100) + '%' } })),
                issue && React.createElement("small", null, issue)),
            React.createElement("section", { className: 'routine-edit-section' },
                React.createElement("div", { className: 'editor-section-title' },
                    React.createElement("span", null, "03"),
                    React.createElement("div", null,
                        React.createElement("h3", null, "Pasos y alternativas"),
                        React.createElement("p", null, "Construye el procedimiento. Puedes anidar detalles, asignar metas y repartir minutos."))),
                React.createElement("div", { className: 'routine-steps-intro' },
                    React.createElement("strong", null,
                        r.steps.length,
                        " pasos principales"),
                    React.createElement("span", null, "Arrastra los tiradores para ordenarlos. Las opciones avanzadas se despliegan solo cuando las necesitas.")),
                this.renderStepEditor(r.steps),
                React.createElement("div", { className: 'routine-add-step' },
                    React.createElement(Btn, { kind: 'secondary', onClick: () => this.updateRoutineDraft({ steps: [...r.steps, { id: uid(), title: '', min: 5, desc: '' }] }) },
                        React.createElement(Icon, { name: 'plus', size: 15 }),
                        " Agregar paso"))),
            React.createElement("section", { className: 'routine-edit-section' },
                React.createElement("div", { className: 'editor-section-title' },
                    React.createElement("span", null, "04"),
                    React.createElement("div", null,
                        React.createElement("h3", null, "Resumen y distribuci\u00F3n"),
                        React.createElement("p", null, "Comprueba el tiempo antes de guardar"))),
                React.createElement("div", { className: 'routine-distribution' },
                    React.createElement("div", { className: 'row spread' },
                        React.createElement("strong", null, "Duraci\u00F3n prevista"),
                        React.createElement("strong", null, this.dur(routineMinutes(r)))),
                    flexLeaves.length > 0 ? React.createElement(React.Fragment, null,
                        React.createElement("p", { className: 'caption' },
                            "Tiempo que sobra: ",
                            this.dur(free),
                            ". Se distribuye seg\u00FAn el peso de cada contenido flexible (9/1 equivale a 90/10)."),
                        flexLeaves.map(s => React.createElement("div", { className: 'distribution-item', key: s.id },
                            React.createElement("span", null, s.title || 'Sin título'),
                            React.createElement("strong", null,
                                this.dur(allocations[s.id] || 0),
                                " \u00B7 ",
                                Math.round(100 * Math.max(1, s.flexWeight || 1) / Math.max(1, flexLeaves.reduce((sum, item) => sum + Math.max(1, item.flexWeight || 1), 0))),
                                "%")))) : React.createElement("p", { className: 'caption' },
                        "Sin pasos flexibles. ",
                        mode === 'fixed' ? 'La suma fija debe coincidir exactamente con la duración.' : 'El tiempo varía con la suma de pasos y alternativas.')),
                mode === 'fixed' && issue && React.createElement("div", { className: 'routine-validation-error' },
                    "\u26A0 ",
                    issue)));
    }
    eventForm() {
        var _a;
        const e = this.state.eventDraft, rs = this.state.data.routines, gs = this.state.data.goals;
        const isOccasion = e.kind === 'occasion';
        const repeatGroup = e.repeat === 'none' ? 'none' : e.repeat === 'custom' || e.repeat === 'daily' || e.repeat === 'weekdays' ? 'days' : e.repeat === 'weekly' || e.repeat === 'monthly' || e.repeat === 'yearly' || e.repeat === 'every' ? 'period' : 'dates';
        const scheduled = e.routineId ? this.routineSchedule(e.routineId) : undefined;
        const changeRepeatGroup = (group) => {
            if (group === 'none')
                this.updateEventDraft({ repeat: 'none', repeatDays: [], specificDates: [] });
            if (group === 'days')
                this.updateEventDraft({ repeat: 'custom', repeatDays: [1, 2, 3, 4, 5] });
            if (group === 'period')
                this.updateEventDraft({ repeat: 'weekly', repeatDays: [] });
            if (group === 'dates')
                this.updateEventDraft({ repeat: 'dates', repeatDays: [], specificDates: [] });
        };
        const minDate = parseDay(this.state.datePickerMonth);
        const monthOffset = (minDate.getDay() + 6) % 7;
        const visibleDays = Array.from({ length: 42 }, (_, i) => addDays(this.state.datePickerMonth, i - monthOffset));
        const totalMinutes = e.routineId ? Math.max(1, routineMinutesOn(rs.find(x => x.id === e.routineId) || { id: '', title: '', desc: '', steps: [] }, e.date)) : e.minutes;
        const endTime = e.endTime || timeString(minutes(e.time) + totalMinutes);
        const anchors = this.state.data.events.filter(item => item.routineId && item.routineId !== e.routineId && sameScheduleActive(item, e.date));
        const preview = e.anchor === 'between' ? eventFrame(e, e.date, { ...this.state.data, events: [...this.state.data.events.filter(item => item.id !== e.id), e] }) : null;
        const avail = (preview === null || preview === void 0 ? void 0 : preview.length) || 0;
        const estimate = e.routineId ? fixedStepMinutes(activeSteps(((_a = rs.find(r => r.id === e.routineId)) === null || _a === void 0 ? void 0 : _a.steps) || [], e.date)) : 0;
        const rows = e.routineId ? this.schedulePreview(e) : [], problems = rows.filter(x => x.issue && !x.skipped);
        const currentRoutine = rs.find(r => r.id === e.routineId);
        const needsFlexible = preview && currentRoutine ? routineBalance(currentRoutine, e.date, preview.length).error : '';
        return React.createElement("div", { className: 'event-form-v06' },
            React.createElement("section", { className: 'event-editor-section' },
                React.createElement("div", { className: 'event-section-heading' },
                    React.createElement("span", null, "01"),
                    React.createElement("div", null,
                        React.createElement("strong", null, "Identidad del bloque"),
                        React.createElement("small", null, "Qu\u00E9 es y cu\u00E1ndo debe aparecer"))),
                React.createElement("div", { className: 'event-identity-banner' },
                    React.createElement(Icon, { name: isOccasion ? 'calendar' : e.routineId ? 'checklist' : 'clock', size: 19 }),
                    React.createElement("div", null,
                        React.createElement("strong", null, isOccasion ? 'Evento o fecha especial' : e.routineId ? 'Programación de rutina' : 'Actividad puntual'),
                        React.createElement("small", null, isOccasion ? 'Viajes, encuentros y fechas importantes.' : e.routineId ? 'Se programa únicamente como rutina, sin convertirla en evento.' : 'Un bloque puntual sin procedimiento asociado.'))),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, isOccasion ? 'Nombre del evento *' : 'Nombre de la actividad *'),
                    React.createElement("input", { maxLength: 100, value: e.title, onChange: v => this.updateEventDraft({ title: v.target.value }), placeholder: isOccasion ? 'Ej. Viaje de graduación' : 'Ej. Preparación matutina' })),
                React.createElement("div", { className: 'field-grid' },
                    React.createElement("div", { className: 'field' },
                        React.createElement("label", null, "Primera fecha *"),
                        React.createElement(CalendarDateInput, { label: 'fecha inicial', value: e.date, onChange: date => { this.updateEventDraft({ date, endDate: undefined, specificDates: [] }); if (date)
                                this.setState({ datePickerMonth: firstMonth(date) }); } })),
                    (isOccasion || e.repeat !== 'none') && React.createElement("div", { className: 'field' },
                        React.createElement("label", null, e.repeat === 'none' ? 'Fecha final (opcional)' : 'Dejar de repetir después del día (opcional)'),
                        React.createElement(CalendarDateInput, { label: 'fecha de finalizaci\u00F3n', min: e.date, rangeStart: isOccasion && e.repeat === 'none' ? e.date : undefined, value: e.endDate || '', onChange: endDate => this.updateEventDraft({ endDate: endDate || undefined }) }),
                        React.createElement("span", { className: 'caption' }, e.repeat === 'none' ? 'Úsala para eventos que duran varios días.' : 'Las repeticiones terminarán en esta fecha.')))),
            React.createElement("section", { className: 'event-editor-section' },
                React.createElement("div", { className: 'event-section-heading' },
                    React.createElement("span", null, "02"),
                    React.createElement("div", null,
                        React.createElement("strong", null, "Tiempo y duraci\u00F3n"),
                        React.createElement("small", null, "Fija una hora o haz que la calculen otros bloques"))),
                isOccasion && React.createElement("label", { className: 'event-allday-toggle' },
                    React.createElement("input", { type: 'checkbox', checked: !!e.allDay, onChange: v => this.updateEventDraft({ allDay: v.target.checked }) }),
                    " Ocurre durante todo el d\u00EDa (no ocupa un bloque con hora fija)"),
                !e.allDay && React.createElement(React.Fragment, null,
                    React.createElement("div", { className: 'field' },
                        React.createElement("label", null, "\u00BFCon qu\u00E9 hora quieres acomodarla?"),
                        React.createElement("div", { className: 'time-anchor-choice' },
                            React.createElement("button", { className: (e.anchor || 'start') === 'start' ? 'active' : '', onClick: () => this.updateEventDraft({ anchor: 'start' }) },
                                React.createElement(Icon, { name: 'clock', size: 16 }),
                                " Hora de inicio"),
                            React.createElement("button", { className: e.anchor === 'end' ? 'active' : '', onClick: () => this.updateEventDraft({ anchor: 'end', endTime }) },
                                React.createElement(Icon, { name: 'clock', size: 16 }),
                                " Hora de t\u00E9rmino"),
                            !isOccasion && React.createElement("button", { className: e.anchor === 'between' ? 'active' : '', onClick: () => this.updateEventDraft({ anchor: 'between' }) },
                                React.createElement(Icon, { name: 'calendar', size: 16 }),
                                " Entre dos rutinas"))),
                    e.anchor !== 'between' && React.createElement("div", { className: 'field-grid' },
                        React.createElement("div", { className: 'field' },
                            React.createElement("label", null,
                                e.anchor === 'end' ? 'Termina a las' : 'Comienza a las',
                                " *"),
                            React.createElement(TimePicker, { value: e.anchor === 'end' ? endTime : e.time, onChange: time => e.anchor === 'end' ? this.updateEventDraft({ endTime: time, time: timeString(Math.max(0, minutes(time) - totalMinutes)) }) : this.updateEventDraft({ time }) })),
                        React.createElement("div", { className: 'field' },
                            React.createElement("label", null, "Duraci\u00F3n estimada (min)"),
                            e.routineId ? React.createElement("div", { className: 'calculated-duration' },
                                "\u03A3 ",
                                this.dur(totalMinutes),
                                " \u00B7 duraci\u00F3n de la rutina") : React.createElement(NumberField, { value: e.minutes, min: 1, max: 1440, onCommit: val => this.updateEventDraft({ minutes: val, ...(e.anchor === 'end' ? { time: timeString(Math.max(0, minutes(endTime) - val)) } : {}) }) }))),
                    e.anchor === 'between' && React.createElement("div", { className: 'between-editor' },
                        React.createElement("p", null,
                            "Fullhouse calcula autom\u00E1ticamente el espacio entre el ",
                            React.createElement("strong", null, "final"),
                            " de una rutina y el ",
                            React.createElement("strong", null, "inicio"),
                            " de otra. Cuando una cambie, este bloque tambi\u00E9n cambiar\u00E1."),
                        React.createElement("div", { className: 'field-grid' },
                            React.createElement("div", { className: 'field' },
                                React.createElement("label", null, "Despu\u00E9s de finalizar\u2026"),
                                React.createElement(FriendlySelect, { value: e.afterRoutineId || '', ariaLabel: 'Rutina l\u00EDmite anterior', onChange: afterRoutineId => this.updateEventDraft({ afterRoutineId }), options: [{ value: '', label: 'Selecciona una rutina' }, ...anchors.map(x => ({ value: x.routineId, label: x.title }))] })),
                            React.createElement("div", { className: 'field' },
                                React.createElement("label", null, "Antes de comenzar\u2026"),
                                React.createElement(FriendlySelect, { value: e.beforeRoutineId || '', ariaLabel: 'Rutina l\u00EDmite posterior', onChange: beforeRoutineId => this.updateEventDraft({ beforeRoutineId }), options: [{ value: '', label: 'Selecciona una rutina' }, ...anchors.map(x => ({ value: x.routineId, label: x.title }))] }))),
                        preview ? React.createElement("div", { className: 'calculated-duration ' + (needsFlexible ? 'time-warning' : '') },
                            "\u2194 ",
                            timeString(preview.start),
                            " \u2013 ",
                            timeString(preview.end),
                            " \u00B7 ",
                            this.dur(avail),
                            " disponibles. Pasos fijos: ",
                            this.dur(estimate),
                            " \u00B7 tiempo libre: ",
                            this.dur(Math.max(0, avail - estimate)),
                            ".",
                            needsFlexible && React.createElement("div", { className: 'preview-day-message' },
                                "\u26A0 ",
                                needsFlexible,
                                " ",
                                React.createElement("button", { className: 'inline-link', type: 'button', onClick: () => this.editRoutineFromSchedule(needsFlexible) }, "Modificar pasos"))) : React.createElement("div", { className: 'notice' }, "Selecciona dos rutinas que ocurran ese d\u00EDa y no se superpongan. El bloque aparecer\u00E1 solo cuando ambas est\u00E9n programadas y haya espacio entre ellas.")),
                    e.anchor === 'end' && React.createElement("p", { className: 'caption anchor-note' }, "La hora inicial se calcula restando la duraci\u00F3n. Si una variante cambia la duraci\u00F3n, la hora de finalizaci\u00F3n seguir\u00E1 siendo la elegida."))),
            React.createElement("section", { className: 'event-editor-section' },
                React.createElement("div", { className: 'event-section-heading' },
                    React.createElement("span", null, "03"),
                    React.createElement("div", null,
                        React.createElement("strong", null, "Repetici\u00F3n"),
                        React.createElement("small", null, "Define los d\u00EDas o fechas en que aparecer\u00E1"))),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "C\u00F3mo se repite"),
                    React.createElement("div", { className: 'repeat-group-choice' }, [{ id: 'none', title: 'Una sola ocasión', desc: 'No se repite automáticamente' }, { id: 'days', title: 'Días de semana', desc: 'Lunes, martes, etc.' }, { id: 'period', title: 'Por período', desc: 'Semanas, meses o años' }, { id: 'dates', title: 'Fechas concretas', desc: 'Una o varias fechas' }].map(option => React.createElement("button", { type: 'button', key: option.id, className: repeatGroup === option.id ? 'active' : '', onClick: () => changeRepeatGroup(option.id) },
                        React.createElement("strong", null, option.title),
                        React.createElement("small", null, option.desc))))),
                repeatGroup === 'none' && React.createElement("div", { className: 'repeat-detail one-time-preview' },
                    React.createElement("div", { className: 'row spread' },
                        React.createElement("strong", null, isOccasion && e.endDate ? 'Un acontecimiento de varios días' : 'Una sola ocasión'),
                        React.createElement("small", null, isOccasion && e.endDate ? e.date + ' — ' + e.endDate : 'Sin repetición')),
                    React.createElement("p", { className: 'caption' }, "Este evento no se repetir\u00E1 autom\u00E1ticamente. Para un viaje o acontecimiento de varios d\u00EDas, selecciona una fecha final arriba."),
                    isOccasion && e.endDate && React.createElement(React.Fragment, null,
                        React.createElement("div", { className: 'mini-calendar-head' },
                            React.createElement("button", { type: 'button', className: 'icon-btn', "aria-label": 'Mes anterior', onClick: () => { const d = parseDay(this.state.datePickerMonth); d.setMonth(d.getMonth() - 1); this.setState({ datePickerMonth: firstMonth(ymd(d)) }); } },
                                React.createElement(Icon, { name: 'left', size: 15 })),
                            React.createElement("strong", null, fmtMonth(this.state.datePickerMonth)),
                            React.createElement("button", { type: 'button', className: 'icon-btn', "aria-label": 'Mes siguiente', onClick: () => { const d = parseDay(this.state.datePickerMonth); d.setMonth(d.getMonth() + 1); this.setState({ datePickerMonth: firstMonth(ymd(d)) }); } },
                                React.createElement(Icon, { name: 'right', size: 15 }))),
                        React.createElement("div", { className: 'mini-calendar-grid' },
                            weekdays.map(w => React.createElement("span", { className: 'mini-calendar-weekday', key: w }, w)),
                            visibleDays.map(day => React.createElement("span", { key: day, title: day, className: 'mini-calendar-day event-range-preview ' + (day >= e.date && day <= e.endDate ? 'active ' : '') + (day.slice(0, 7) !== this.state.datePickerMonth.slice(0, 7) ? 'outside' : '') }, parseDay(day).getDate()))))),
                repeatGroup === 'days' && React.createElement("div", { className: 'field repeat-detail' },
                    React.createElement("label", null, "Selecciona los d\u00EDas habituales"),
                    React.createElement("div", { className: 'weekday-options' }, weekdayNames.map((day, n) => React.createElement("button", { type: 'button', key: n, className: 'weekday-pill ' + ((e.repeat === 'daily' || (e.repeat === 'weekdays' && n >= 1 && n <= 5) || (e.repeat === 'custom' && (e.repeatDays || []).includes(n))) ? 'active' : ''), "aria-pressed": (e.repeatDays || []).includes(n), title: longDays[n], onClick: () => { const old = e.repeat === 'daily' ? DAYS : e.repeat === 'weekdays' ? [1, 2, 3, 4, 5] : e.repeatDays || []; const next = old.includes(n) ? old.filter(x => x !== n) : [...old, n]; this.updateEventDraft({ repeat: 'custom', repeatDays: next }); } }, day))),
                    React.createElement("p", { className: 'caption' }, "Los d\u00EDas seleccionados permanecen marcados. La primera fecha establece desde cu\u00E1ndo se aplican.")),
                repeatGroup === 'period' && React.createElement("div", { className: 'field repeat-detail' },
                    React.createElement("label", null, "Intervalo de repetici\u00F3n"),
                    React.createElement(FriendlySelect, { value: e.repeat, ariaLabel: 'Periodicidad', onChange: value => this.updateEventDraft({ repeat: value }), options: [{ value: 'weekly', label: 'Cada semana, el mismo día' }, { value: 'monthly', label: 'Cada mes, la misma fecha' }, { value: 'yearly', label: 'Cada año' }, { value: 'every', label: 'Cada cierto número de días' }] }),
                    e.repeat === 'every' && React.createElement("div", { className: 'field', style: { marginTop: 12, maxWidth: 210 } },
                        React.createElement("label", null, "Intervalo en d\u00EDas"),
                        React.createElement(NumberField, { value: e.everyDays || 2, min: 1, max: 365, onCommit: everyDays => this.updateEventDraft({ everyDays }) }))),
                repeatGroup === 'dates' && React.createElement("div", { className: 'field repeat-detail' },
                    React.createElement("div", { className: 'row spread' },
                        React.createElement("label", null, "Elige las fechas en el calendario"),
                        React.createElement("span", { className: 'caption' },
                            1 + (e.specificDates || []).filter(d => d !== e.date).length,
                            " seleccionada(s)")),
                    React.createElement("div", { className: 'mini-calendar-head' },
                        React.createElement("button", { className: 'icon-btn', "aria-label": 'Mes anterior', onClick: () => this.setState({ datePickerMonth: firstMonth(addDays(this.state.datePickerMonth, -1)) }) },
                            React.createElement(Icon, { name: 'left', size: 15 })),
                        React.createElement("strong", null, fmtMonth(this.state.datePickerMonth)),
                        React.createElement("button", { className: 'icon-btn', "aria-label": 'Mes siguiente', onClick: () => { const m = parseDay(this.state.datePickerMonth); m.setMonth(m.getMonth() + 1); this.setState({ datePickerMonth: ymd(m) }); } },
                            React.createElement(Icon, { name: 'right', size: 15 }))),
                    React.createElement("div", { className: 'mini-calendar-grid' },
                        ['L', 'M', 'Mié', 'J', 'V', 'S', 'D'].map((name, i) => React.createElement("span", { className: 'mini-calendar-weekday', key: i }, name)),
                        visibleDays.map((date, i) => { const selected = date === e.date || (e.specificDates || []).includes(date) || (!!isOccasion && e.repeat === 'none' && !!e.endDate && date >= e.date && date <= e.endDate), outside = date.slice(0, 7) !== this.state.datePickerMonth.slice(0, 7), disabled = date < e.date; return React.createElement("button", { type: 'button', key: i, disabled: disabled, className: 'mini-calendar-day ' + (selected ? 'active ' : '') + (outside ? 'outside' : ''), title: date, onClick: () => { if (date === e.date)
                                return; const next = (e.specificDates || []).includes(date) ? (e.specificDates || []).filter(d => d !== date) : [...(e.specificDates || []), date]; this.updateEventDraft({ specificDates: next, repeat: next.length ? 'dates' : 'none' }); } }, parseDay(date).getDate()); })),
                    React.createElement("p", { className: 'caption' }, "La fecha inicial siempre est\u00E1 incluida. Puedes a\u00F1adir o quitar fechas posteriores."))),
            React.createElement("section", { className: 'event-editor-section ' + (!this.state.advancedOpen ? 'advanced-collapsed' : '') },
                React.createElement("div", { className: 'event-section-heading' },
                    React.createElement("span", null, "04"),
                    React.createElement("div", null,
                        React.createElement("strong", null, "Detalles y relaciones"),
                        React.createElement("small", null, "Rutina, meta e informaci\u00F3n adicional"))),
                currentRoutine && React.createElement("div", { className: 'linked-routine-card' },
                    React.createElement(Icon, { name: currentRoutine.icon || 'checklist', size: 24 }),
                    React.createElement("div", null,
                        React.createElement("strong", null, currentRoutine.title),
                        React.createElement("small", null,
                            "Plantilla vinculada \u00B7 ",
                            this.dur(routineMinutes(currentRoutine)))),
                    React.createElement(Btn, { kind: 'secondary', tiny: true, onClick: () => this.editRoutineFromSchedule() }, "Editar rutina")),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "Meta vinculada (opcional)"),
                    this.goalPicker(e.goalId, goalId => this.updateEventDraft({ goalId }))),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", { className: 'evidence-preference' },
                        React.createElement("input", { type: 'checkbox', checked: !!e.requestEvidence, onChange: v => this.updateEventDraft({ requestEvidence: v.target.checked }) }),
                        " Recordar que puedo adjuntar una foto o evidencia al realizar esta actividad (siempre opcional)")),
                React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "Descripci\u00F3n e instrucciones"),
                    React.createElement(AutoTextarea, { value: e.note, onChange: (v) => this.updateEventDraft({ note: v.target.value }), maxLength: 1500, placeholder: isOccasion ? 'Lugar, notas del viaje, recuerdos o preparativos' : 'Detalles que quieras recordar' })),
                this.state.advancedOpen && !e.allDay && e.repeat === 'none' && e.anchor !== 'between' && React.createElement("div", { className: 'overlap-editor' },
                    React.createElement("strong", null, "Si este bloque se solapa con otro, \u00BFqu\u00E9 hacemos?"),
                    React.createElement("div", { className: 'time-anchor-choice' },
                        React.createElement("button", { type: 'button', className: (e.overlapMode || 'keep') === 'keep' ? 'active' : '', onClick: () => this.updateEventDraft({ overlapMode: 'keep' }) }, "Mantener solapamiento"),
                        React.createElement("button", { type: 'button', className: e.overlapMode === 'move' ? 'active' : '', onClick: () => this.updateEventDraft({ overlapMode: 'move' }) }, "Posponer bloques ese d\u00EDa")),
                    React.createElement("p", { className: 'caption' }, "Al posponer, Fullhouse pide confirmaci\u00F3n y aplica desplazamientos \u00FAnicamente en esta fecha. Las rutinas entre dos l\u00EDmites conservan sus dependencias.")),
                e.routineId && React.createElement("div", { className: 'notice' }, "Una rutina mantiene una \u00FAnica programaci\u00F3n vigente. Si ya existe, utiliza \u00ABReprogramar\u00BB: no se crear\u00E1n copias que compitan entre s\u00ED."),
                e.id && this.state.advancedOpen && React.createElement("div", { className: 'field' },
                    React.createElement("label", null, "Aplicar la reprogramaci\u00F3n desde"),
                    React.createElement("input", { type: 'date', min: today(), value: e.applyFrom || today(), onChange: v => this.updateEventDraft({ applyFrom: v.target.value }) }),
                    React.createElement("p", { className: 'caption' }, "Cambia este d\u00EDa y los siguientes; conserva los d\u00EDas anteriores y los registros ya hechos. Antes de guardar ver\u00E1s una confirmaci\u00F3n.")),
                e.id && React.createElement("div", { className: 'row spread', style: { marginTop: 16 } },
                    React.createElement("span", { className: 'caption' }, "Editar la programaci\u00F3n puede cambiar horas y repeticiones desde la fecha indicada."),
                    React.createElement(Btn, { kind: 'danger', tiny: true, onClick: () => this.deleteEvent(e) },
                        React.createElement(Icon, { name: 'trash', size: 14 }),
                        " Eliminar"))),
            e.routineId && React.createElement("section", { className: 'event-editor-section schedule-preview-section' },
                React.createElement("div", { className: 'event-section-heading' },
                    React.createElement("span", null, "05"),
                    React.createElement("div", null,
                        React.createElement("strong", null, "Vista previa del horario"),
                        React.createElement("small", null, "Comprueba las pr\u00F3ximas apariciones y posibles solapamientos"))),
                React.createElement("div", { className: 'row spread schedule-preview-top' },
                    React.createElement("span", { className: 'caption' }, "Hasta ocho fechas pr\u00F3ximas \u00B7 sin modificar todav\u00EDa el calendario"),
                    React.createElement(Btn, { kind: 'secondary', tiny: true, onClick: () => this.editRoutineFromSchedule(problems.length ? problems[0].issue : 'Ajusta los pasos o la duración y vuelve a revisar esta previsión.') },
                        React.createElement(Icon, { name: 'edit', size: 15 }),
                        " Modificar rutina")),
                rows.length ? React.createElement("div", { className: 'preview-day-list' }, rows.map(item => React.createElement("div", { className: 'preview-day ' + (item.issue ? (item.skipped ? 'preview-skipped' : 'preview-error') : item.overlaps.length ? 'preview-overlap' : 'preview-ok'), key: item.date },
                    React.createElement("div", { className: 'preview-day-main' },
                        React.createElement("strong", null, item.label),
                        React.createElement("span", null, item.skipped ? 'Sin bloque' : `${item.start}–${item.end} · ${this.dur(item.length)}`)),
                    item.length > 0 && React.createElement("div", { className: 'preview-timebar', title: 'Bloque: ' + item.start + '–' + item.end },
                        React.createElement("span", { style: { left: (Math.max(0, minutes(item.start) - 360) / 960 * 100) + '%', width: (Math.min(960, Math.max(0, item.length)) / 960 * 100) + '%' } })),
                    item.issue && React.createElement("div", { className: 'preview-day-message' },
                        item.skipped ? 'ℹ' : '⚠',
                        " ",
                        item.issue),
                    !item.issue && item.overlaps.length > 0 && React.createElement("div", { className: 'preview-day-message' },
                        "Coincide con: ",
                        item.overlaps.join(', ')),
                    !item.issue && !item.overlaps.length && React.createElement("small", null, "\u2713 Sin solapamientos")))) : React.createElement("div", { className: 'notice' }, "Selecciona una fecha y un patr\u00F3n de repetici\u00F3n para ver la previsi\u00F3n."),
                problems.length > 0 && React.createElement("div", { className: 'routine-validation-error' },
                    React.createElement("span", null,
                        "Hay ",
                        problems.length,
                        " fecha(s) que requieren ajustes. Puedes editar la rutina; al guardar volver\u00E1s aqu\u00ED."),
                    React.createElement(Btn, { tiny: true, onClick: () => this.editRoutineFromSchedule(problems[0].issue) }, "Ir a corregir rutina"))));
    }
    progressForm() {
        const g = this.state.data.goals.find(x => x.id === this.state.progressGoalId);
        if (!g)
            return null;
        const mode = goalMode(g);
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "notice" },
                React.createElement("strong", null, g.title),
                " \u00B7 ",
                mode === 'qualitative' ? 'Avance por estados y reflexiones' : 'Valor actual: ' + g.current + ' ' + g.unit + (g.target > 0 ? ' · Objetivo: ' + g.target + ' ' + g.unit : '')),
            mode === 'qualitative' ? React.createElement("div", { className: "field", style: { marginTop: 18 } },
                React.createElement("label", null, "\u00BFEn qu\u00E9 estado se encuentra esta meta?"),
                React.createElement(FriendlySelect, { value: this.state.progressStatus, ariaLabel: "Estado del progreso", onChange: status => this.setState({ progressStatus: status }), options: goalStatuses.map(s => ({ value: s.id, label: s.label + ' · ' + s.desc })) })) : React.createElement("div", { className: "field", style: { marginTop: 18 } },
                React.createElement("label", null, "Nuevo resultado"),
                React.createElement("input", { type: 'text', inputMode: 'decimal', value: this.state.progressValue, onChange: e => this.setState({ progressValue: e.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, mode === 'qualitative' ? '¿Qué cambió? Describe tus avances' : 'Nota del registro (opcional)'),
                React.createElement(AutoTextarea, { value: this.state.progressNote, onChange: (e) => this.setState({ progressNote: e.target.value }), placeholder: "Reflexiones, aprendizajes o cambios desde el registro anterior" })),
            React.createElement("p", { className: "caption" }, "El resultado se guarda en el historial de la meta con la fecha de hoy."));
    }
    executeForm() {
        const date = this.state.selectedDate, e = this.state.data.events.find(x => x.id === this.state.activeEventId);
        if (!e)
            return null;
        const original = this.state.data.routines.find(x => x.id === e.routineId);
        if (!original)
            return React.createElement("p", null, "La rutina ya no est\u00E1 disponible.");
        const log = this.state.data.logs[key(e, date)] || { completed: false, checkedSteps: [] };
        const r = { ...original, steps: activeSteps(original.steps, date, log.choices || {}) };
        const allocation = leafAllocation(r.steps, durationOn(e, date, this.state.data));
        const missing = unresolvedManual(r.steps, log.choices || {});
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "notice" },
                React.createElement("strong", null, e.title),
                " \u00B7 ",
                fmtDate(date),
                " a las ",
                eventTime(e, date, this.state.data),
                ". Las alternativas, notas y pasos marcados se guardan solo para este d\u00EDa."),
            missing.length > 0 && React.createElement("div", { className: 'manual-warning' },
                "\u2726 Hay ",
                missing.length,
                " paso(s) con alternativas pendientes de elegir."),
            (e.requestEvidence || original.requestEvidence) && React.createElement("div", { className: 'evidence-prompt' }, "Si quieres, deja una fotograf\u00EDa de lo que realizaste."),
            this.evidenceSection(e, date),
            React.createElement(NoteEditor, { key: e.id + '-' + date + '-routine', label: 'Nota general de esta ejecuci\u00F3n', value: log.note || '', carry: upcomingNote(this.state.data, e, date), onSave: text => this.saveOccurrenceNote(e, date, text) }),
            React.createElement("div", { style: { marginTop: 15 } }, this.renderCheckSteps(r.steps, e, date, log, allocation)),
            React.createElement("div", { className: "divider" }),
            React.createElement("div", { className: "row spread" },
                React.createElement("span", { className: "caption" },
                    leafSteps(r.steps).filter(s => log.checkedSteps.includes(s.id)).length,
                    " / ",
                    leafSteps(r.steps).length,
                    " pasos completados"),
                log.completed && React.createElement("span", { className: "small-tag" }, "Actividad completada")));
    }
    render() {
        const title = { hoy: 'Mi día', inicio: 'Inicio', metas: 'Metas', rutinas: 'Rutinas', horario: 'Horario', calendario: 'Calendario', progreso: 'Progreso', ajustes: 'Ajustes' };
        return React.createElement("div", { className: "app-shell", "data-theme": this.state.theme },
            this.renderSidebar(),
            React.createElement("main", { className: "main" },
                React.createElement("header", { className: "topbar" },
                    React.createElement("div", { className: "crumb" },
                        React.createElement(Icon, { name: "home", size: 16 }),
                        React.createElement("span", null, "Mi espacio"),
                        React.createElement("span", null, "/"),
                        React.createElement("strong", null, title[this.state.page])),
                    React.createElement("div", { className: "top-right" },
                        React.createElement("span", { className: "pill" },
                            React.createElement("span", { className: "dot" }),
                            " Datos locales"),
                        React.createElement("button", { className: "icon-btn guide-top-button", onClick: this.openGuide, title: "Gu\u00EDa de inicio", "aria-label": "Abrir gu\u00EDa de inicio" },
                            React.createElement(Icon, { name: "help" })))),
                React.createElement("div", { className: "content" }, this.state.page === 'hoy' ? this.renderToday() : this.state.page === 'inicio' ? this.renderHome() : this.state.page === 'metas' ? this.renderGoals() : this.state.page === 'rutinas' ? this.renderRoutines() : this.state.page === 'horario' ? this.renderSchedule() : this.state.page === 'calendario' ? this.renderCalendar() : this.state.page === 'progreso' ? this.renderProgress() : this.renderSettings())),
            this.renderModal(),
            this.renderConfirm(),
            this.renderGuide(),
            this.renderHelpPanel(),
            this.state.toast && React.createElement("div", { className: "toast", role: "status" },
                React.createElement("span", null, this.state.toast),
                React.createElement("button", { "aria-label": "Cerrar aviso", onClick: () => { if (this.toastTimer)
                        clearTimeout(this.toastTimer); this.setState({ toast: '' }); } }, "\u00D7")));
    }
}
ReactDOM.render(React.createElement(Planner, null), document.getElementById('app'));
