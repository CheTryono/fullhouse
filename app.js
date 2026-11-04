const STORE = 'fullhouse-v01';
const LEGACY_STORE = 'botanica-planificador-v01';
const colorOptions = ['#a26cf4', '#ed6dba', '#f7a853', '#39c8ab', '#54a9f4', '#ec6c73', '#8579e8', '#9bc55c', '#be81f2', '#d8a34c', '#ff8e5b', '#37b6cc', '#ec6f93', '#7e95e9', '#40b67a', '#ce7390', '#a85fe0', '#738c98'];
const THEME_STORE = 'fullhouse-theme-v02';
const LAYOUT_STORE = 'fullhouse-modal-layout-v02';
const GUIDE_STORE = 'fullhouse-guide-seen-v02';
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
    { page: 'inicio', title: 'Bienvenido a Fullhouse', text: 'Aquí tienes tu resumen diario: las metas que persigues, las actividades previstas y el trabajo que ya completaste.', action: 'Explorar Inicio' },
    { page: 'metas', title: 'Empieza por tus metas', text: 'Crea una meta, elige si la medirás con números, hitos o estados cualitativos y divídela en sub-metas cuando sea necesario.', action: 'Ver mis metas' },
    { page: 'rutinas', title: 'Convierte ideas en procedimientos', text: 'Diseña rutinas paso a paso. Cada paso puede contener instrucciones y, si lo necesitas, subpasos.', action: 'Ver rutinas' },
    { page: 'horario', title: 'Organiza tu día completo', text: 'En Horario verás bloques desde la mañana hasta la noche. Toca uno para acercarte a la rutina, sus pasos y sus detalles.', action: 'Ver horario' },
    { page: 'progreso', title: 'Registra lo que de verdad ocurre', text: 'Marca actividades, registra avances cualitativos o cuantitativos y consulta tu progreso. Descarga respaldos en Ajustes.', action: 'Ver progreso' }
];
const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
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
function gDraft() { return { id: '', title: '', desc: '', parentId: '', color: colorOptions[0], current: 0, target: 0, unit: '', mode: 'qualitative', status: 'pending', milestones: [] }; }
function rDraft() { return { id: '', title: '', desc: '', steps: [{ id: uid(), title: '', min: 5 }] }; }
function eDraft(date = today()) { return { id: '', title: '', date, time: '08:00', minutes: 30, goalId: '', routineId: '', repeat: 'none', note: '', overrides: {} }; }
function seed() {
    const d = today();
    const goal1 = 'g-phys', goal2 = 'g-strength', goal3 = 'g-creative';
    return { version: 1,
        goals: [
            { id: goal1, title: 'Desarrollo físico', desc: 'Construir hábitos sostenibles y mejorar mis capacidades.', parentId: '', color: colorOptions[0], current: 0, target: 0, unit: '', history: [] },
            { id: goal2, title: 'Progreso en fuerza', desc: 'Ejemplo de meta medible; cambia las cifras a tus propias referencias.', parentId: goal1, color: colorOptions[1], current: 6, target: 10, unit: 'sesiones', history: [] },
            { id: goal3, title: 'Proyectos personales', desc: 'Reservar tiempo de concentración y registrar entregables.', parentId: '', color: colorOptions[2], current: 0, target: 0, unit: '', history: [] }
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
    var _a;
    if (date < e.date)
        return false;
    if (e.overrides && ((_a = e.overrides[date]) === null || _a === void 0 ? void 0 : _a.skip))
        return false;
    if (e.repeat === 'none')
        return e.date === date;
    const dw = parseDay(date).getDay(), sw = parseDay(e.date).getDay();
    if (e.repeat === 'daily')
        return true;
    if (e.repeat === 'weekdays')
        return dw >= 1 && dw <= 5;
    if (e.repeat === 'weekly')
        return dw === sw;
    return false;
}
function eventsOn(data, date) { return data.events.filter(e => occurs(e, date)).sort((a, b) => { var _a, _b, _c, _d; return (((_b = (_a = a.overrides) === null || _a === void 0 ? void 0 : _a[date]) === null || _b === void 0 ? void 0 : _b.time) || a.time).localeCompare(((_d = (_c = b.overrides) === null || _c === void 0 ? void 0 : _c[date]) === null || _d === void 0 ? void 0 : _d.time) || b.time); }); }
function eventTime(e, date) { var _a, _b; return ((_b = (_a = e.overrides) === null || _a === void 0 ? void 0 : _a[date]) === null || _b === void 0 ? void 0 : _b.time) || e.time; }
function key(e, date) { return `${e.id}@${date}`; }
function done(data, e, date) { var _a; return !!((_a = data.logs[key(e, date)]) === null || _a === void 0 ? void 0 : _a.completed); }
function percent(current, target) { return target > 0 ? bound(Math.round((current / target) * 100), 0, 100) : 0; }
function goalMode(g) { return g.mode || (g.target > 0 ? 'numeric' : 'qualitative'); }
function goalStatus(g) { return g.status || 'pending'; }
function statusLabel(s) { var _a; return ((_a = goalStatuses.find(x => x.id === s)) === null || _a === void 0 ? void 0 : _a.label) || 'Por comenzar'; }
function goalMilestones(g) { return g.milestones || []; }
function stepMinutes(s) { return s.children && s.children.length ? s.children.reduce((a, c) => a + stepMinutes(c), 0) : s.min; }
function routineMinutes(r) { return r.steps.reduce((a, s) => a + stepMinutes(s), 0); }
function leafSteps(steps) { return steps.flatMap(s => s.children && s.children.length ? leafSteps(s.children) : [s]); }
function editStepTree(steps, id, fn) { return steps.map(s => s.id === id ? fn(s) : { ...s, children: s.children ? editStepTree(s.children, id, fn) : undefined }); }
function deleteStepTree(steps, id) { return steps.filter(s => s.id !== id).map(s => ({ ...s, children: s.children ? deleteStepTree(s.children, id) : undefined })); }
function moveStepTree(steps, id, direction) { const arr = steps.map(s => ({ ...s, children: s.children ? moveStepTree(s.children, id, direction) : undefined })); const i = arr.findIndex(s => s.id === id); const j = i + direction; if (i >= 0 && j >= 0 && j < arr.length) {
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
function AutoTextarea(props) { const { onChange, ...others } = props; return React.createElement("textarea", { ...others, ref: (node) => fitArea(node), onChange: (e) => { onChange(e); fitArea(e.currentTarget); } }); }
class FriendlySelect extends React.Component {
    constructor(props) {
        super(props);
        this.root = null;
        this.outside = (e) => { if (this.root && !this.root.contains(e.target) && this.state.open)
            this.setState({ open: false }); };
        this.keydown = (e) => { if (e.key === 'Escape') {
            this.setState({ open: false });
            return;
        } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const current = this.state.open ? this.state.index : Math.max(0, this.props.options.findIndex(x => x.value === this.props.value));
            this.setState({ open: true, index: bound(current + (e.key === 'ArrowDown' ? 1 : -1), 0, this.props.options.length - 1) });
        } if (e.key === 'Enter' && this.state.open) {
            e.preventDefault();
            const opt = this.props.options[this.state.index];
            if (opt) {
                this.props.onChange(opt.value);
                this.setState({ open: false });
            }
        } };
        this.state = { open: false, index: 0 };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.outside); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.outside); }
    render() { const choice = this.props.options.find(x => x.value === this.props.value); return React.createElement("div", { className: 'friendly-select ' + (this.state.open ? 'is-open' : ''), ref: (e) => this.root = e, onKeyDown: this.keydown },
        React.createElement("button", { type: 'button', className: 'friendly-trigger', "aria-haspopup": 'listbox', "aria-expanded": this.state.open, "aria-label": this.props.ariaLabel || 'Seleccionar opción', onClick: () => this.setState({ open: !this.state.open, index: Math.max(0, this.props.options.findIndex(x => x.value === this.props.value)) }) },
            React.createElement("span", null, (choice === null || choice === void 0 ? void 0 : choice.label) || 'Selecciona una opción'),
            React.createElement("span", { className: 'select-caret' }, "\u2304")),
        this.state.open && React.createElement("div", { className: 'friendly-menu', role: 'listbox', "aria-label": this.props.ariaLabel || 'Opciones disponibles' }, this.props.options.map((o, i) => React.createElement("button", { type: 'button', key: o.value, role: 'option', "aria-selected": o.value === this.props.value, className: 'friendly-option ' + (i === this.state.index ? 'focused ' : '') + (o.value === this.props.value ? 'selected' : ''), onMouseEnter: () => this.setState({ index: i }), onClick: () => { this.props.onChange(o.value); this.setState({ open: false }); } },
            React.createElement("span", null, o.label),
            o.value === this.props.value && React.createElement(Icon, { name: 'check', size: 15 }))))); }
}
function Icon({ name, size = 19 }) { return React.createElement("span", { className: "icon", style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
    React.createElement("svg", { style: { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } },
        React.createElement("use", { href: '#i-' + name }))); }
function Btn({ children, onClick, kind = '', tiny = false, disabled = false, type = 'button', title }) { return React.createElement("button", { className: `btn ${kind} ${tiny ? 'tiny' : ''}`, onClick: onClick, type: type, disabled: disabled, title: title }, children); }
class Planner extends React.Component {
    constructor(props) {
        super(props);
        this.globalKeydown = (e) => { if (e.key === 'Escape' && (this.state.modal || this.state.guideOpen)) {
            this.close();
        } };
        this.syncModalState = () => { document.body.style.overflow = this.state.modal || this.state.guideOpen ? 'hidden' : ''; };
        this.resizeTextareas = () => { document.querySelectorAll('.modal-body textarea').forEach(fitArea); };
        this.setTheme = (theme) => { putPreference(THEME_STORE, theme); this.setState({ theme }); };
        this.setLayout = (layout) => { putPreference(LAYOUT_STORE, layout); this.setState({ modalLayout: layout }); };
        this.finishGuide = () => { putPreference(GUIDE_STORE, 'yes'); this.setState({ guideOpen: false }); };
        this.openGuide = () => this.setState({ modal: null, guideOpen: true, guideStep: 0 });
        this.openHelp = (topic) => this.setState({ modal: 'help', helpTopic: topic });
        this.openDetail = (e) => this.setState({ modal: 'detail', activeEventId: e.id, detailPath: [] });
        this.save = (data, message = 'Cambios guardados') => {
            try {
                localStorage.setItem(STORE, JSON.stringify(data));
                this.setState({ data, toast: message });
            }
            catch (err) {
                this.setState({ data, toast: 'No se pudo guardar: almacenamiento lleno o bloqueado. Exporta una copia.' });
            }
        };
        this.route = (page) => { this.setState({ page, modal: null }); window.scrollTo(0, 0); };
        this.chooseDay = (s) => this.setState({ selectedDate: s, month: firstMonth(s) });
        this.openGoal = (goal, parentId = '') => this.setState({ modal: 'goal', goalDraft: goal ? { id: goal.id, title: goal.title, desc: goal.desc, parentId: goal.parentId, color: goal.color, current: goal.current, target: goal.target, unit: goal.unit, mode: goalMode(goal), status: goalStatus(goal), milestones: goalMilestones(goal).map(x => ({ ...x })) } : { ...gDraft(), parentId } });
        this.openRoutine = (r) => this.setState({ modal: 'routine', routineDraft: r ? JSON.parse(JSON.stringify(r)) : rDraft() });
        this.openEvent = (e) => this.setState({ modal: 'event', eventDraft: e ? JSON.parse(JSON.stringify(e)) : eDraft(this.state.selectedDate) });
        this.openProgress = (g) => this.setState({ modal: 'progress', progressGoalId: g.id, progressValue: String(g.current), progressStatus: goalStatus(g), progressNote: '' });
        this.openExecute = (e) => this.setState({ modal: 'execute', activeEventId: e.id });
        this.close = () => this.setState({ modal: null, guideOpen: false, detailPath: [] });
        this.updateGoalDraft = (patch) => this.setState({ goalDraft: { ...this.state.goalDraft, ...patch } });
        this.updateRoutineDraft = (patch) => this.setState({ routineDraft: { ...this.state.routineDraft, ...patch } });
        this.updateEventDraft = (patch) => this.setState({ eventDraft: { ...this.state.eventDraft, ...patch } });
        this.saveGoal = () => {
            const x = this.state.goalDraft;
            if (!x.title.trim()) {
                this.setState({ toast: 'Escribe un nombre para la meta' });
                return;
            }
            if (x.id && x.parentId === x.id) {
                this.setState({ toast: 'Una meta no puede depender de sí misma' });
                return;
            }
            const data = this.state.data;
            const before = data.goals.find(g => g.id === x.id);
            const next = { ...x, id: x.id || uid(), title: x.title.trim(), target: Math.max(0, x.target), current: Math.max(0, x.current), mode: goalMode(x), status: goalStatus(x), milestones: goalMilestones(x).filter(m => m.title.trim()).map(m => ({ ...m, title: m.title.trim() })), history: (before === null || before === void 0 ? void 0 : before.history) || [] };
            this.save({ ...data, goals: before ? data.goals.map(g => g.id === x.id ? next : g) : [...data.goals, next] });
            this.close();
        };
        this.saveRoutine = () => {
            const x = this.state.routineDraft;
            if (!x.title.trim()) {
                this.setState({ toast: 'Escribe un nombre para la rutina' });
                return;
            }
            if ((function invalid(steps) { return steps.some(s => !s.title.trim() || (s.children && invalid(s.children))); })(x.steps)) {
                this.setState({ toast: 'Todos los pasos necesitan un nombre' });
                return;
            }
            const data = this.state.data;
            const result = { ...x, id: x.id || uid(), title: x.title.trim(), steps: (function clean(steps) { return steps.map(s => ({ ...s, title: s.title.trim(), min: Math.max(1, s.min), children: s.children ? clean(s.children) : undefined })); })(x.steps) };
            this.save({ ...data, routines: x.id ? data.routines.map(r => r.id === x.id ? result : r) : [...data.routines, result] });
            this.close();
        };
        this.saveEvent = () => {
            const x = this.state.eventDraft;
            if (!x.title.trim() || !x.date || !x.time) {
                this.setState({ toast: 'Completa el título, la fecha y la hora' });
                return;
            }
            const data = this.state.data;
            const result = { ...x, id: x.id || uid(), title: x.title.trim(), minutes: Math.max(1, x.minutes), overrides: x.overrides || {} };
            this.save({ ...data, events: x.id ? data.events.map(e => e.id === x.id ? result : e) : [...data.events, result] });
            this.close();
        };
        this.deleteGoal = (g) => {
            if (!confirm(`¿Eliminar la meta «${g.title}»? Las sub-metas pasarán a ser independientes.`))
                return;
            const d = this.state.data;
            this.save({ ...d, goals: d.goals.filter(x => x.id !== g.id).map(x => x.parentId === g.id ? { ...x, parentId: '' } : x), events: d.events.map(e => e.goalId === g.id ? { ...e, goalId: '' } : e) });
        };
        this.deleteRoutine = (r) => {
            if (!confirm(`¿Eliminar «${r.title}»? Las actividades programadas conservarán su nombre, pero perderán sus pasos.`))
                return;
            const d = this.state.data;
            this.save({ ...d, routines: d.routines.filter(x => x.id !== r.id), events: d.events.map(e => e.routineId === r.id ? { ...e, routineId: '' } : e) });
        };
        this.deleteEvent = (e) => {
            if (!confirm(e.repeat === 'none' ? '¿Eliminar esta actividad?' : '¿Eliminar esta actividad recurrente y todas sus próximas apariciones?'))
                return;
            const d = this.state.data;
            const logs = { ...d.logs };
            Object.keys(logs).filter(k => k.startsWith(e.id + '@')).forEach(k => delete logs[k]);
            this.save({ ...d, events: d.events.filter(x => x.id !== e.id), logs });
            this.close();
        };
        this.toggleEvent = (e, date) => {
            const d = this.state.data, k = key(e, date), r = d.logs[k] || { completed: false, checkedSteps: [] };
            this.save({ ...d, logs: { ...d.logs, [k]: { ...r, completed: !r.completed } } }, 'Actividad actualizada');
        };
        this.toggleStep = (e, date, stepId) => {
            const d = this.state.data, k = key(e, date), r = d.logs[k] || { completed: false, checkedSteps: [] };
            const routine = d.routines.find(x => x.id === e.routineId);
            const checked = r.checkedSteps.includes(stepId) ? r.checkedSteps.filter(s => s !== stepId) : [...r.checkedSteps, stepId];
            const leaves = routine ? leafSteps(routine.steps) : [];
            const completed = leaves.length > 0 && leaves.every(s => checked.includes(s.id));
            this.save({ ...d, logs: { ...d.logs, [k]: { ...r, checkedSteps: checked, completed } } }, 'Paso actualizado');
        };
        this.shiftEvent = (e, date, delta) => {
            const d = this.state.data;
            const newTime = timeString(bound(minutes(eventTime(e, date)) + delta, 0, 1439));
            const next = { ...e, overrides: { ...e.overrides, [date]: { ...e.overrides[date], time: newTime } } };
            this.save({ ...d, events: d.events.map(x => x.id === e.id ? next : x) }, `Actividad movida a las ${newTime}`);
        };
        this.saveProgress = () => {
            const d = this.state.data, g = d.goals.find(x => x.id === this.state.progressGoalId);
            if (!g)
                return;
            const mode = goalMode(g), val = mode === 'numeric' ? Number(this.state.progressValue) : g.current;
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
            this.setState({ toast: 'Respaldo descargado. Guárdalo en un lugar seguro.' });
        };
        this.importData = (ev) => {
            var _a;
            const f = (_a = ev.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!f)
                return;
            if (!confirm('¿Restaurar este respaldo? Sustituirá todos los datos actuales en este navegador.')) {
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
        this.reset = () => {
            if (!confirm('¿Volver a los ejemplos iniciales? Se perderán los datos actuales. Exporta un respaldo antes de continuar.'))
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
        this.hint = (topic) => React.createElement("button", { type: "button", className: "hint-btn", title: "\u00BFC\u00F3mo funciona esta secci\u00F3n?", "aria-label": 'Ayuda de ' + topic, onClick: () => this.openHelp(topic) }, "?");
        this.changeMonth = (offset) => { const d = parseDay(this.state.month); d.setMonth(d.getMonth() + offset); const newMonth = ymd(d); this.setState({ month: newMonth, selectedDate: newMonth }); };
        this.renderStepEditor = (steps, level = 0) => {
            const update = (id, patch) => this.updateRoutineDraft({ steps: editStepTree(this.state.routineDraft.steps, id, s => ({ ...s, ...patch })) });
            return React.createElement("div", { className: 'step-editor-list ' + (level ? 'nested' : '') }, steps.map((s, i) => React.createElement("div", { className: "step-editor-card", key: s.id },
                React.createElement("div", { className: "step-edit" },
                    React.createElement("span", { className: "step-label" },
                        i + 1,
                        "."),
                    React.createElement("input", { "aria-label": 'Nombre del paso ' + (i + 1), value: s.title, onChange: e => update(s.id, { title: e.target.value }), placeholder: "Nombre del paso" }),
                    React.createElement("input", { className: "step-min", title: "Minutos previstos (si tiene subpasos, se suman sus duraciones)", "aria-label": "Duraci\u00F3n en minutos", type: "number", min: "1", value: s.min, onChange: e => update(s.id, { min: asInt(e.target.value, 1) }) }),
                    React.createElement("button", { className: "icon-btn", title: "Mover paso arriba", disabled: i === 0, onClick: () => this.updateRoutineDraft({ steps: moveStepTree(this.state.routineDraft.steps, s.id, -1) }) }, "\u2191"),
                    React.createElement("button", { className: "icon-btn", title: "Mover paso abajo", disabled: i === steps.length - 1, onClick: () => this.updateRoutineDraft({ steps: moveStepTree(this.state.routineDraft.steps, s.id, 1) }) }, "\u2193"),
                    React.createElement("button", { className: "icon-btn", title: "Quitar paso", onClick: () => this.updateRoutineDraft({ steps: deleteStepTree(this.state.routineDraft.steps, s.id) }) },
                        React.createElement(Icon, { name: "close", size: 13 }))),
                React.createElement("div", { className: "step-description" },
                    React.createElement(AutoTextarea, { maxLength: 1000, value: s.desc || '', onChange: (e) => update(s.id, { desc: e.target.value }), placeholder: "Instrucciones, orden o detalles de este paso..." })),
                s.children && s.children.length > 0 && this.renderStepEditor(s.children, level + 1),
                React.createElement("div", { className: "step-subaction" },
                    React.createElement(Btn, { tiny: true, kind: "ghost", onClick: () => update(s.id, { children: [...(s.children || []), { id: uid(), title: '', min: 5, desc: '' }] }) },
                        React.createElement(Icon, { name: "plus", size: 14 }),
                        " A\u00F1adir subpaso")))));
        };
        this.renderCheckSteps = (steps, e, date, log, level = 0) => React.createElement("div", { className: level ? 'check-child-steps' : '' }, steps.map((s, i) => { var _a; return React.createElement("div", { key: s.id },
            React.createElement("div", { className: "routine-step" },
                React.createElement("button", { className: 'check-circle ' + (log.checkedSteps.includes(s.id) ? 'checked' : ''), onClick: () => this.toggleStep(e, date, s.id), "aria-label": 'Marcar ' + s.title, disabled: !!(s.children && s.children.length) }, log.checkedSteps.includes(s.id) && React.createElement(Icon, { name: "check", size: 13 })),
                React.createElement("div", { className: "flex" },
                    React.createElement("div", { className: "agenda-name" },
                        i + 1,
                        ". ",
                        s.title),
                    s.desc && React.createElement("div", { className: "agenda-sub" }, s.desc),
                    React.createElement("div", { className: "agenda-sub" },
                        stepMinutes(s),
                        " min \u00B7 ",
                        ((_a = s.children) === null || _a === void 0 ? void 0 : _a.length) ? 'Incluye ' + s.children.length + ' subpasos' : 'Paso individual'))),
            s.children && s.children.length > 0 && this.renderCheckSteps(s.children, e, date, log, level + 1)); }));
        const d = today();
        this.state = { data: load(), page: 'inicio', selectedDate: d, month: firstMonth(d), modal: null, goalDraft: gDraft(), routineDraft: rDraft(), eventDraft: eDraft(d), activeEventId: '', detailPath: [], progressValue: '', progressNote: '', progressStatus: 'pending', progressGoalId: '', toast: '', theme: (themeOptions.some(x => x.id === getPreference(THEME_STORE)) ? getPreference(THEME_STORE) : 'aurora'), modalLayout: getPreference(LAYOUT_STORE) === 'horizontal' ? 'horizontal' : 'vertical', guideOpen: getPreference(GUIDE_STORE) !== 'yes', guideStep: 0, helpTopic: '' };
    }
    componentDidMount() { this.syncModalState(); document.addEventListener('keydown', this.globalKeydown); this.resizeTextareas(); }
    componentDidUpdate() { this.syncModalState(); this.resizeTextareas(); }
    componentWillUnmount() { document.body.style.overflow = ''; document.removeEventListener('keydown', this.globalKeydown); }
    renderSidebar() {
        const links = [{ id: 'inicio', label: 'Inicio', icon: 'home' }, { id: 'metas', label: 'Mis metas', icon: 'target' }, { id: 'rutinas', label: 'Rutinas', icon: 'checklist' }, { id: 'horario', label: 'Horario', icon: 'clock' }, { id: 'calendario', label: 'Calendario', icon: 'calendar' }, { id: 'progreso', label: 'Progreso', icon: 'chart' }, { id: 'ajustes', label: 'Respaldo y ajustes', icon: 'settings' }];
        return React.createElement(React.Fragment, null,
            React.createElement("aside", { className: "sidebar" },
                React.createElement("div", { className: "brand" },
                    React.createElement("img", { className: "brand-logo", src: "logo.svg", alt: "Logo Fullhouse" }),
                    React.createElement("div", null,
                        React.createElement("div", { className: "brand-name" }, "FULLHOUSE"),
                        React.createElement("div", { className: "brand-sub" }, "Tu espacio, completo"))),
                React.createElement("div", { className: "side-section" }, "Mi espacio"),
                React.createElement("nav", null, links.map(l => React.createElement("button", { key: l.id, className: `nav-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
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
                            React.createElement("div", { className: "profile-meta" }, "Fullhouse \u00B7 0.2"))),
                    React.createElement("small", null, "Organiza \u00B7 Act\u00FAa \u00B7 Progresa. Los datos se guardan en este navegador."))),
            React.createElement("nav", { className: "mobile-nav", "aria-label": "Navegaci\u00F3n m\u00F3vil" }, links.filter(l => l.id !== 'ajustes' && l.id !== 'calendario').map(l => React.createElement("button", { key: l.id, className: `mobile-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
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
        const d = this.state.data, es = eventsOn(d, date);
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
                React.createElement("div", { className: "agenda-time" }, eventTime(e, date)),
                React.createElement("div", { className: "agenda-main" },
                    React.createElement("div", { className: "agenda-name" }, e.title),
                    React.createElement("div", { className: "agenda-sub" },
                        e.minutes,
                        " min ",
                        routine ? '· ' + routine.steps.length + ' pasos' : '')),
                React.createElement("button", { className: `check-circle ${isDone ? 'checked' : ''}`, onClick: () => this.toggleEvent(e, date), "aria-label": isDone ? 'Marcar pendiente' : 'Marcar completado' }, isDone && React.createElement(Icon, { name: "check", size: 13 })))
                : React.createElement("div", { key: e.id, className: `schedule-line ${isDone ? 'is-done' : ''}` },
                    React.createElement("div", { className: "schedule-time" }, eventTime(e, date)),
                    React.createElement("div", { className: "schedule-body" },
                        React.createElement("div", { className: "schedule-name" }, e.title),
                        React.createElement("div", { className: "schedule-meta" },
                            React.createElement("span", null,
                                e.minutes,
                                " min"),
                            e.repeat !== 'none' && React.createElement("span", null, "\u21BB Recurrente"),
                            routine && React.createElement("span", null,
                                routine.steps.length,
                                " pasos")),
                        e.note && React.createElement("div", { className: "schedule-notes" }, e.note),
                        React.createElement("div", { className: "actions", style: { marginTop: 9 } },
                            routine && React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openExecute(e) }, "Abrir pasos"),
                            React.createElement(Btn, { tiny: true, kind: "ghost", title: "Mover 15 minutos antes (solo este d\u00EDa)", onClick: () => this.shiftEvent(e, date, -15) }, "\u221215 min"),
                            React.createElement(Btn, { tiny: true, kind: "ghost", title: "Mover 15 minutos despu\u00E9s (solo este d\u00EDa)", onClick: () => this.shiftEvent(e, date, 15) }, "+15 min"))),
                    React.createElement("div", { className: "mini-actions" },
                        React.createElement("button", { className: `check-circle ${isDone ? 'checked' : ''}`, onClick: () => this.toggleEvent(e, date), "aria-label": isDone ? 'Marcar pendiente' : 'Marcar completado' }, isDone && React.createElement(Icon, { name: "check", size: 13 })),
                        React.createElement(Btn, { tiny: true, kind: "ghost", onClick: () => this.openEvent(e), title: "Editar actividad" },
                            React.createElement(Icon, { name: "edit", size: 14 }))));
        }));
    }
    renderHome() {
        const d = this.state.data, date = this.state.selectedDate, es = eventsOn(d, date), n = es.filter(e => done(d, e, date)).length;
        const tracked = d.goals, rate = es.length ? Math.round(n / es.length * 100) : 0;
        return React.createElement(React.Fragment, null,
            React.createElement("section", { className: "home-hero" },
                React.createElement("div", { className: "hero-copy" },
                    React.createElement("div", { className: "hero-kicker" }, "\u2726 TU ESPACIO PERSONAL"),
                    React.createElement("h2", null, "Tu d\u00EDa, todas tus posibilidades."),
                    React.createElement("p", null, "Transforma tus metas en acciones concretas y observa c\u00F3mo avanzas, paso a paso."),
                    React.createElement("div", { className: "hero-actions" },
                        React.createElement(Btn, { onClick: () => this.route('horario') },
                            React.createElement(Icon, { name: "clock" }),
                            " Abrir mi horario"),
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
    renderGoals() {
        const gs = this.state.data.goals;
        const items = [];
        const seen = new Set();
        const visit = (g, depth) => { if (seen.has(g.id))
            return; seen.add(g.id); items.push({ goal: g, depth }); gs.filter(x => x.parentId === g.id).forEach(c => visit(c, depth + 1)); };
        gs.filter(g => !g.parentId || !gs.some(x => x.id === g.parentId)).forEach(g => visit(g, 0));
        gs.forEach(g => visit(g, 0));
        return React.createElement(React.Fragment, null,
            this.renderHeading('Mis metas', 'De una visión amplia a objetivos concretos. Crea sub-metas, vincula actividades y registra resultados.', React.createElement(Btn, { onClick: () => this.openGoal() },
                React.createElement(Icon, { name: "plus" }),
                " Crear meta")),
            React.createElement("div", { className: "notice" }, "Cada meta puede medirse por resultados num\u00E9ricos, hitos o estados cualitativos. Completar actividades no equivale autom\u00E1ticamente a conseguir un resultado."),
            items.length ? React.createElement("div", { className: "goal-grid", style: { marginTop: 20 } }, items.map(x => React.createElement("div", { key: x.goal.id, style: { paddingLeft: Math.min(x.depth, 3) * 12 } }, this.renderGoalCard(x.goal, x.depth)))) : React.createElement("div", { className: "panel", style: { marginTop: 20 } },
                React.createElement("div", { className: "empty" },
                    React.createElement(Icon, { name: "target" }),
                    React.createElement("strong", null, "Tu primera meta empieza aqu\u00ED"),
                    React.createElement("p", null, "Define algo que quieras conseguir y desgl\u00F3salo en pasos."),
                    React.createElement(Btn, { onClick: () => this.openGoal() }, "Crear meta"))));
    }
    renderRoutines() {
        const rs = this.state.data.routines;
        return React.createElement(React.Fragment, null,
            this.renderHeading('Rutinas y procedimientos', 'Convierte actividades complejas en pasos claros, reutilizables y fáciles de ejecutar.', React.createElement(Btn, { onClick: () => this.openRoutine() },
                React.createElement(Icon, { name: "plus" }),
                " Nueva rutina")),
            React.createElement("div", { className: "routine-grid" }, rs.map(r => React.createElement("div", { className: "routine-card", key: r.id },
                React.createElement("div", { className: "row" },
                    React.createElement("span", { className: "routine-badge" },
                        React.createElement(Icon, { name: "checklist", size: 21 })),
                    React.createElement("div", { className: "flex" },
                        React.createElement("h3", { className: "goal-name" }, r.title),
                        React.createElement("p", { className: "goal-desc" }, r.desc || 'Procedimiento sin descripción'))),
                React.createElement("div", { className: "routine-steps" },
                    React.createElement(Icon, { name: "clock", size: 15 }),
                    leafSteps(r.steps).length,
                    " pasos \u00B7 ",
                    routineMinutes(r),
                    " min estimados"),
                React.createElement("div", { className: "routine-step-preview" },
                    r.steps.slice(0, 3).map((s, i) => React.createElement("div", { key: s.id },
                        i + 1,
                        ". ",
                        s.title,
                        " ",
                        React.createElement("span", { className: "muted" },
                            "\u00B7 ",
                            stepMinutes(s),
                            " min"))),
                    r.steps.length > 3 && React.createElement("div", null,
                        "+",
                        r.steps.length - 3,
                        " pasos m\u00E1s")),
                React.createElement("div", { className: "actions" },
                    React.createElement(Btn, { tiny: true, onClick: () => this.setState({ modal: 'event', eventDraft: { ...eDraft(this.state.selectedDate), title: r.title, routineId: r.id, minutes: routineMinutes(r) } }) },
                        React.createElement(Icon, { name: "calendar", size: 14 }),
                        " Programar"),
                    React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openRoutine(r) },
                        React.createElement(Icon, { name: "edit", size: 14 }),
                        " Editar"),
                    React.createElement(Btn, { tiny: true, kind: "ghost", onClick: () => this.deleteRoutine(r) },
                        React.createElement(Icon, { name: "trash", size: 14 })))))),
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
        const date = this.state.selectedDate, data = this.state.data, es = eventsOn(data, date);
        const minStart = es.length ? Math.min(...es.map(e => minutes(eventTime(e, date)))) : 360;
        const maxEnd = es.length ? Math.max(...es.map(e => minutes(eventTime(e, date)) + e.minutes)) : 1320;
        const startHour = Math.max(0, Math.min(6, Math.floor(minStart / 60)));
        const endHour = Math.min(24, Math.max(22, Math.ceil(maxEnd / 60)));
        const hourHeight = 82, origin = startHour * 60;
        const placed = [], all = es.map(e => ({ event: e, start: minutes(eventTime(e, date)), end: Math.min(1440, minutes(eventTime(e, date)) + e.minutes) })).sort((a, b) => a.start - b.start);
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
                React.createElement("div", { className: "schedule-days" },
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
                    React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.route('calendario') },
                        React.createElement(Icon, { name: "calendar" }),
                        " Vista mensual"))),
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
                    React.createElement("div", { className: "timeline-events" }, placed.map(({ event: e, start, end, lane, lanes }) => { const goal = data.goals.find(g => g.id === e.goalId), routine = data.routines.find(r => r.id === e.routineId), isDone = done(data, e, date), color = (goal === null || goal === void 0 ? void 0 : goal.color) || '#a477ec'; return React.createElement("button", { key: e.id, className: 'timeline-block ' + (isDone ? 'completed' : ''), onClick: () => this.openDetail(e), style: { top: ((start - origin) / 60) * hourHeight, height: Math.max(36, ((end - start) / 60) * hourHeight - 4), left: (lane / lanes * 100) + '%', width: (100 / lanes) + '%', borderLeftColor: color, background: `linear-gradient(113deg, ${color}25, ${color}12 70%, white)` } },
                        React.createElement("div", { className: "timeline-block-header" },
                            React.createElement("span", { className: "timeline-event-name" }, e.title),
                            isDone && React.createElement("span", { className: "timeline-done" }, "\u2713")),
                        React.createElement("div", { className: "timeline-time" },
                            eventTime(e, date),
                            " \u00B7 ",
                            e.minutes,
                            " min ",
                            routine ? '· ' + leafSteps(routine.steps).length + ' pasos' : ''),
                        e.note && React.createElement("div", { className: "timeline-description" }, e.note)); }))),
                !es.length && React.createElement("div", { className: "timeline-empty" },
                    React.createElement(Icon, { name: "calendar" }),
                    React.createElement("p", null, "Este d\u00EDa todav\u00EDa no tiene actividades. Empieza creando tu primer bloque."),
                    React.createElement(Btn, { onClick: () => this.openEvent() }, "A\u00F1adir bloque"))),
            React.createElement("div", { className: "notice" }, "Los bloques se pueden abrir para consultar cada nivel de detalle. Para cambiar horas, utiliza la edici\u00F3n de la actividad o los controles de \u00B115 minutos."));
    }
    renderDetail() {
        var _a;
        const date = this.state.selectedDate, d = this.state.data, e = d.events.find(x => x.id === this.state.activeEventId);
        if (!e)
            return React.createElement("p", null, "No se encontr\u00F3 el bloque seleccionado.");
        const r = d.routines.find(x => x.id === e.routineId), g = d.goals.find(x => x.id === e.goalId), path = this.state.detailPath, current = r ? getStepByPath(r.steps, path) : undefined;
        const choices = current ? (current.children || []) : (r === null || r === void 0 ? void 0 : r.steps) || [];
        const log = d.logs[key(e, date)] || { completed: false, checkedSteps: [] };
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
                        eventTime(e, date),
                        " \u00B7 ",
                        e.minutes,
                        " min"),
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
                    current ? stepMinutes(current) : 0,
                    " min previstos"),
                React.createElement("h3", null, (current === null || current === void 0 ? void 0 : current.title) || 'Paso'),
                React.createElement("p", null, (current === null || current === void 0 ? void 0 : current.desc) || 'No hay instrucciones adicionales para este paso.'),
                current && !((_a = current.children) === null || _a === void 0 ? void 0 : _a.length) && React.createElement(Btn, { kind: "secondary", onClick: () => this.toggleStep(e, date, current.id) }, log.checkedSteps.includes(current.id) ? '✓ Completado · Desmarcar' : 'Marcar paso completado')),
            choices.length > 0 && React.createElement(React.Fragment, null,
                React.createElement("h3", { className: "detail-section-title" }, path.length ? 'Subpasos de este paso' : 'Dentro de este bloque'),
                React.createElement("div", { className: "zoom-children" }, choices.map((s, i) => { var _a; return React.createElement("button", { key: s.id, className: "zoom-child", onClick: () => this.setState({ detailPath: [...path, s.id] }) },
                    React.createElement("span", { className: "zoom-index" }, i + 1),
                    React.createElement("div", { className: "flex" },
                        React.createElement("strong", null, s.title),
                        React.createElement("div", { className: "caption" },
                            stepMinutes(s),
                            " min \u00B7 ",
                            ((_a = s.children) === null || _a === void 0 ? void 0 : _a.length) ? s.children.length + ' subpasos' : 'Ver instrucciones')),
                    React.createElement(Icon, { name: "right", size: 18 })); }))),
            !r && React.createElement("div", { className: "notice" }, "Para desglosar este bloque en pasos, as\u00EDgnale una rutina desde \u00ABEditar bloque\u00BB."),
            path.length > 0 && React.createElement(Btn, { kind: "ghost", onClick: () => this.setState({ detailPath: path.slice(0, -1) }) },
                React.createElement(Icon, { name: "left" }),
                " Volver al nivel anterior"));
    }
    renderGuide() { if (!this.state.guideOpen)
        return null; const i = this.state.guideStep, step = guideSteps[i]; return React.createElement("div", { className: "guide-backdrop", role: "presentation" },
        React.createElement("div", { className: "guide-panel", role: "dialog", "aria-modal": "true", "aria-label": "Gu\u00EDa paso a paso" },
            React.createElement("div", { className: "guide-top" },
                React.createElement("span", { className: "guide-tag" },
                    React.createElement(Icon, { name: "spark" }),
                    " Gu\u00EDa de inicio"),
                React.createElement("button", { className: "icon-btn", onClick: this.finishGuide, title: "Cerrar gu\u00EDa" },
                    React.createElement(Icon, { name: "close" }))),
            React.createElement("h2", null, step.title),
            React.createElement("p", null, step.text),
            React.createElement("div", { className: "guide-progress" }, guideSteps.map((s, j) => React.createElement("button", { className: 'guide-dot ' + (j <= i ? 'active' : ''), key: j, title: 'Paso ' + (j + 1), onClick: () => this.setState({ guideStep: j, page: s.page }) }))),
            React.createElement("div", { className: "guide-lesson" },
                React.createElement("div", { className: "guide-count" }, i + 1),
                React.createElement("div", null,
                    React.createElement("strong", null,
                        "Paso ",
                        i + 1,
                        " de ",
                        guideSteps.length),
                    React.createElement("span", null, step.action)),
                React.createElement(Btn, { kind: "secondary", tiny: true, onClick: () => this.setState({ page: step.page, modal: null }) }, "Ver secci\u00F3n")),
            React.createElement("div", { className: "guide-buttons" },
                React.createElement(Btn, { kind: "ghost", onClick: this.finishGuide }, "Explorar por mi cuenta"),
                React.createElement("div", { className: "row" },
                    i > 0 && React.createElement(Btn, { kind: "secondary", onClick: () => this.setState({ guideStep: i - 1, page: guideSteps[i - 1].page }) }, "Anterior"),
                    React.createElement(Btn, { onClick: () => i === guideSteps.length - 1 ? this.finishGuide() : this.setState({ guideStep: i + 1, page: guideSteps[i + 1].page }) },
                        i === guideSteps.length - 1 ? 'Terminar guía' : 'Siguiente',
                        " ",
                        React.createElement(Icon, { name: "arrow-right" })))))); }
    helpBody() {
        const content = {
            inicio: ['Inicio y resumen', ['Tu panel reúne las metas, rutinas y actividades del día.', 'El porcentaje de cumplimiento refleja actividades realizadas, no resultados obtenidos.', 'Usa los accesos rápidos para crear metas, rutinas o programar eventos.']],
            metas: ['Metas y tipos de seguimiento', ['Numérica: registra un resultado concreto y una cantidad objetivo.', 'Cualitativa: elige estados de avance y deja reflexiones; es ideal para relaciones, bienestar o aprendizaje.', 'Por hitos: divide una meta en logros verificables y marca los que completas.', 'Puedes crear sub-metas y conectar tus actividades con una meta.']],
            rutinas: ['Rutinas y procedimientos', ['Las rutinas son plantillas reutilizables: agrega pasos, instrucciones y tiempos.', 'Puedes incluir subpasos y entrar progresivamente a cada nivel desde los bloques del horario.', 'Para usar una rutina en tu jornada, pulsa «Programar».']],
            horario: ['Horario de mañana a noche', ['Cada bloque representa una actividad o rutina programada.', 'Haz clic en un bloque para acercarte a su contenido, sus pasos y sus detalles.', 'Si algo cambia, puedes editar el bloque o moverlo ±15 minutos desde el calendario.']],
            calendario: ['Calendario independiente', ['Selecciona un día para consultar su agenda.', 'Las actividades pueden repetirse diariamente, entre semana o cada semana.', 'Los movimientos de ±15 minutos aplican solo a ese día, incluso en una rutina recurrente.']],
            progreso: ['Progreso y resultados', ['Puedes comparar lo planeado con lo realizado durante los últimos siete días.', 'Las metas numéricas, los hitos y las cualitativas se muestran de forma diferente.', 'Registrar una actividad completada no modifica automáticamente un resultado personal.']],
            ajustes: ['Apariencia, respaldos y ayuda', ['Selecciona una paleta y la interfaz se adaptará al instante.', 'Desde cualquier ventana emergente puedes alternar entre disposición vertical u horizontal.', 'Exporta un respaldo JSON antes de limpiar los datos del navegador.', 'Puedes volver a abrir la guía en cualquier momento.']]
        };
        const [title, lines] = content[this.state.helpTopic] || content.inicio;
        return React.createElement("div", { className: "help-content" },
            React.createElement("h3", null, title),
            lines.map((line, i) => React.createElement("div", { className: "help-line", key: i },
                React.createElement("span", null, i + 1),
                React.createElement("p", null, line))),
            React.createElement(Btn, { onClick: () => { this.close(); this.openGuide(); }, kind: "secondary" },
                React.createElement(Icon, { name: "help" }),
                " Abrir gu\u00EDa completa"));
    }
    renderCalendar() {
        const date = this.state.selectedDate, d = this.state.data;
        return React.createElement(React.Fragment, null,
            this.renderHeading('Calendario', 'Tu agenda propia. Organiza fechas, repeticiones y prioridades sin conectar servicios externos.', React.createElement(Btn, { onClick: () => this.openEvent() },
                React.createElement(Icon, { name: "plus" }),
                " Programar actividad")),
            React.createElement("div", { className: "calendar-shortcut" },
                React.createElement("span", null,
                    React.createElement(Icon, { name: "clock" }),
                    " \u00BFQuieres ordenar el d\u00EDa de la ma\u00F1ana a la noche?"),
                React.createElement(Btn, { kind: "secondary", onClick: () => this.route('horario') },
                    "Abrir horario por bloques ",
                    React.createElement(Icon, { name: "arrow-right" }))),
            React.createElement("div", { className: "calendar-layout" },
                React.createElement("section", { className: "panel" },
                    React.createElement("div", { className: "calendar-toolbar" },
                        React.createElement("div", { className: "month-name" }, fmtMonth(this.state.month)),
                        React.createElement("div", { className: "calendar-nav" },
                            React.createElement("button", { className: "icon-btn", onClick: () => this.changeMonth(-1), title: "Mes anterior" },
                                React.createElement(Icon, { name: "left" })),
                            React.createElement("button", { className: "icon-btn", onClick: () => this.chooseDay(today()), title: "Volver a hoy" },
                                React.createElement(Icon, { name: "sun" })),
                            React.createElement("button", { className: "icon-btn", onClick: () => this.changeMonth(1), title: "Mes siguiente" },
                                React.createElement(Icon, { name: "right" })))),
                    React.createElement("div", { className: "weekday-grid" }, weekdays.map((w, i) => React.createElement("div", { className: "weekday", key: i }, w))),
                    React.createElement("div", { className: "month-grid" }, this.monthDays().map(c => { const events = eventsOn(d, c.day); return React.createElement("button", { key: c.day, className: `day-cell ${c.inside ? '' : 'outside'} ${c.day === date ? 'selected' : ''} ${c.day === today() ? 'today' : ''}`, onClick: () => this.chooseDay(c.day), "aria-label": fmtDate(c.day) + ', ' + events.length + ' actividades' },
                        React.createElement("div", { className: "day-number" }, parseDay(c.day).getDate()),
                        events.length > 0 && React.createElement(React.Fragment, null,
                            React.createElement("div", { className: "day-dots" }, events.slice(0, 4).map(e => React.createElement("span", { key: e.id, className: "day-dot", style: { background: done(d, e, c.day) ? '#bacbb8' : '#76aa86' } }))),
                            React.createElement("span", { className: "day-count" },
                                events.length,
                                " actividad",
                                events.length === 1 ? '' : 'es'))); }))),
                React.createElement("section", { className: "panel" },
                    React.createElement("div", { className: "panel-head" },
                        React.createElement("div", null,
                            React.createElement("div", { className: "eyebrow", style: { marginBottom: 5 } }, "AGENDA DEL D\u00CDA"),
                            React.createElement("h2", { className: "selected-date" }, fmtDate(date))),
                        React.createElement(Btn, { tiny: true, kind: "secondary", onClick: () => this.openEvent() },
                            React.createElement(Icon, { name: "plus", size: 15 }))),
                    this.renderTodayList(date),
                    React.createElement("div", { className: "divider" }),
                    React.createElement("div", { className: "caption" }, "Los botones \u00B115 min modifican solo el d\u00EDa seleccionado, incluso en actividades recurrentes."))));
    }
    renderProgress() {
        const d = this.state.data;
        const start = addDays(today(), -6);
        const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        let weekPlanned = 0, weekDone = 0;
        for (const day of days) {
            for (const e of eventsOn(d, day)) {
                weekPlanned++;
                if (done(d, e, day))
                    weekDone++;
            }
        }
        return React.createElement(React.Fragment, null,
            this.renderHeading('Mi progreso', 'Comprende la diferencia entre tu constancia diaria y los resultados que estás consiguiendo.'),
            React.createElement("div", { className: "cards" },
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
                    React.createElement("div", { className: "week-chart" }, days.map(day => { const a = eventsOn(d, day), c = a.filter(e => done(d, e, day)).length, p = a.length ? Math.round(c / a.length * 100) : 0; return React.createElement("div", { key: day, className: "bar-wrap" },
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
            title = this.state.goalDraft.id ? 'Editar meta' : 'Crear meta';
        if (modal === 'routine')
            title = this.state.routineDraft.id ? 'Editar rutina' : 'Nueva rutina';
        if (modal === 'event')
            title = this.state.eventDraft.id ? 'Editar actividad' : 'Programar actividad';
        if (modal === 'execute')
            title = 'Ejecutar procedimiento';
        if (modal === 'progress')
            title = 'Registrar avance';
        if (modal === 'detail')
            title = 'Dentro de mi horario';
        if (modal === 'help')
            title = '¿Cómo funciona?';
        return React.createElement("div", { className: "modal-backdrop", onClick: (ev) => { if (ev.target === ev.currentTarget)
                this.close(); } },
            React.createElement("div", { className: 'modal ' + (this.state.modalLayout === 'horizontal' ? 'wide' : 'vertical'), role: "dialog", "aria-modal": "true", "aria-label": title },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "FULLHOUSE \u00B7 DETALLES"),
                        React.createElement("h2", { className: "modal-title" }, title)),
                    React.createElement("div", { className: "modal-header-actions" },
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
                    modal === 'routine' && React.createElement(Btn, { onClick: this.saveRoutine }, "Guardar rutina"),
                    modal === 'event' && React.createElement(Btn, { onClick: this.saveEvent }, "Guardar actividad"),
                    modal === 'progress' && React.createElement(Btn, { onClick: this.saveProgress }, "Registrar avance"))));
    }
    goalForm() {
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
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Meta superior (opcional)"),
                React.createElement(FriendlySelect, { ariaLabel: "Elegir meta superior", value: x.parentId, onChange: value => this.updateGoalDraft({ parentId: value }), options: [{ value: '', label: 'Ninguna · Meta principal' }, ...this.state.data.goals.filter(g => !notAllowed.includes(g.id)).map(g => ({ value: g.id, label: g.title }))] })),
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
                        React.createElement("input", { type: "number", min: "0", step: "any", value: x.current, onChange: e => this.updateGoalDraft({ current: asInt(e.target.value) }) })),
                    React.createElement("div", { className: "field" },
                        React.createElement("label", null, "Resultado objetivo"),
                        React.createElement("input", { type: "number", min: "0", step: "any", value: x.target, onChange: e => this.updateGoalDraft({ target: asInt(e.target.value) }) }))),
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
                    colorOptions.map(c => React.createElement("button", { type: "button", key: c, className: 'color-dot ' + (x.color === c ? 'active' : ''), onClick: () => this.updateGoalDraft({ color: c }), "aria-label": 'Color ' + c, title: c, style: { background: c } })),
                    React.createElement("label", { className: "custom-color", title: "Elegir cualquier color" },
                        "\uFF0B",
                        React.createElement("input", { type: "color", value: /^#[a-fA-F0-9]{6}$/.test(x.color) ? x.color : '#a477ec', onChange: e => this.updateGoalDraft({ color: e.target.value }) })))));
    }
    routineForm() {
        const r = this.state.routineDraft;
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Nombre de la rutina *"),
                React.createElement("input", { maxLength: 90, value: r.title, onChange: e => this.updateRoutineDraft({ title: e.target.value }), placeholder: "Ej. Preparaci\u00F3n para el gimnasio" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null,
                    "Descripci\u00F3n ",
                    this.hint('rutinas')),
                React.createElement(AutoTextarea, { maxLength: 1500, value: r.desc, onChange: (e) => this.updateRoutineDraft({ desc: e.target.value }), placeholder: "\u00BFQu\u00E9 necesitas lograr al terminar esta rutina?" })),
            React.createElement("div", { className: "field" },
                React.createElement("div", { className: "row spread" },
                    React.createElement("label", { style: { margin: 0 } }, "Pasos del procedimiento"),
                    React.createElement("span", { className: "caption" },
                        routineMinutes(r),
                        " minutos en total"))),
            this.renderStepEditor(r.steps),
            React.createElement("div", { style: { marginTop: 13 } },
                React.createElement(Btn, { kind: "secondary", tiny: true, onClick: () => this.updateRoutineDraft({ steps: [...r.steps, { id: uid(), title: '', min: 5, desc: '' }] }) },
                    React.createElement(Icon, { name: "plus", size: 14 }),
                    " Agregar paso")),
            React.createElement("div", { className: "notice", style: { marginTop: 18 } }, "Puedes a\u00F1adir instrucciones y subpasos ilimitados. Cuando un paso contiene subpasos, su duraci\u00F3n se calcula sumando los hijos. Al editar una rutina, sus actividades vinculadas utilizan la plantilla actual."));
    }
    eventForm() {
        const e = this.state.eventDraft, rs = this.state.data.routines, gs = this.state.data.goals;
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "T\u00EDtulo de la actividad *"),
                React.createElement("input", { maxLength: 100, value: e.title, onChange: v => this.updateEventDraft({ title: v.target.value }), placeholder: "Ej. Entrenamiento de fuerza" })),
            React.createElement("div", { className: "field-grid" },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Fecha de inicio *"),
                    React.createElement("input", { type: "date", value: e.date, onChange: v => this.updateEventDraft({ date: v.target.value }) })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Hora *"),
                    React.createElement("input", { type: "time", value: e.time, onChange: v => this.updateEventDraft({ time: v.target.value }) }))),
            React.createElement("div", { className: "field-grid" },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Duraci\u00F3n estimada (min)"),
                    React.createElement("input", { type: "number", min: "1", max: "1440", value: e.minutes, onChange: v => this.updateEventDraft({ minutes: asInt(v.target.value, 30) }) })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Repetici\u00F3n"),
                    React.createElement(FriendlySelect, { value: e.repeat, ariaLabel: "Repetici\u00F3n", onChange: value => this.updateEventDraft({ repeat: value }), options: [{ value: 'none', label: 'Solo esta fecha' }, { value: 'daily', label: 'Todos los días' }, { value: 'weekdays', label: 'Lunes a viernes' }, { value: 'weekly', label: 'Cada semana' }] }))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null,
                    "Rutina o procedimiento (opcional) ",
                    this.hint('rutinas')),
                React.createElement(FriendlySelect, { value: e.routineId, ariaLabel: "Rutina vinculada", onChange: id => { const r = rs.find(x => x.id === id); this.updateEventDraft({ routineId: id, ...(r ? { title: r.title, minutes: routineMinutes(r) } : {}) }); }, options: [{ value: '', label: 'Actividad sencilla' }, ...rs.map(r => ({ value: r.id, label: r.title }))] })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Meta vinculada (opcional)"),
                React.createElement(FriendlySelect, { value: e.goalId, ariaLabel: "Meta vinculada", onChange: goalId => this.updateEventDraft({ goalId }), options: [{ value: '', label: 'Sin meta asociada' }, ...gs.map(g => ({ value: g.id, label: g.title }))] })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Notas e instrucciones"),
                React.createElement(AutoTextarea, { value: e.note, onChange: (v) => this.updateEventDraft({ note: v.target.value }), maxLength: 1500, placeholder: "Detalles que quieras recordar" })),
            e.id && React.createElement("div", { className: "row spread", style: { marginTop: 16 } },
                React.createElement("div", { className: "caption" }, "Editar una actividad recurrente modifica su programaci\u00F3n general. Los cambios de \u00B115 min en el calendario afectan solo al d\u00EDa elegido."),
                React.createElement(Btn, { kind: "danger", tiny: true, onClick: () => this.deleteEvent(e) },
                    React.createElement(Icon, { name: "trash", size: 14 }),
                    " Eliminar")));
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
                React.createElement("input", { type: "number", step: "any", min: "0", value: this.state.progressValue, onChange: e => this.setState({ progressValue: e.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, mode === 'qualitative' ? '¿Qué cambió? Describe tus avances' : 'Nota del registro (opcional)'),
                React.createElement(AutoTextarea, { value: this.state.progressNote, onChange: (e) => this.setState({ progressNote: e.target.value }), placeholder: "Reflexiones, aprendizajes o cambios desde el registro anterior" })),
            React.createElement("p", { className: "caption" }, "El resultado se guarda en el historial de la meta con la fecha de hoy."));
    }
    executeForm() {
        const date = this.state.selectedDate, e = this.state.data.events.find(x => x.id === this.state.activeEventId);
        if (!e)
            return null;
        const r = this.state.data.routines.find(x => x.id === e.routineId);
        if (!r)
            return React.createElement("p", null, "La rutina ya no est\u00E1 disponible.");
        const log = this.state.data.logs[key(e, date)] || { completed: false, checkedSteps: [] };
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "notice" },
                React.createElement("strong", null, e.title),
                " \u00B7 ",
                fmtDate(date),
                " a las ",
                eventTime(e, date),
                ". Cada paso marcado se guarda \u00FAnicamente para esta ejecuci\u00F3n."),
            React.createElement("div", { style: { marginTop: 15 } }, this.renderCheckSteps(r.steps, e, date, log)),
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
        const title = { inicio: 'Inicio', metas: 'Metas', rutinas: 'Rutinas', horario: 'Horario', calendario: 'Calendario', progreso: 'Progreso', ajustes: 'Ajustes' };
        return React.createElement("div", { className: "app-shell", "data-theme": this.state.theme },
            this.renderSidebar(),
            React.createElement("main", { className: "main" },
                React.createElement("header", { className: "topbar" },
                    React.createElement("div", { className: "crumb" },
                        React.createElement(Icon, { name: "sprout", size: 16 }),
                        React.createElement("span", null, "Mi espacio"),
                        React.createElement("span", null, "/"),
                        React.createElement("strong", null, title[this.state.page])),
                    React.createElement("div", { className: "top-right" },
                        React.createElement("span", { className: "pill" },
                            React.createElement("span", { className: "dot" }),
                            " Datos locales"),
                        React.createElement("button", { className: "icon-btn", onClick: this.openGuide, title: "Gu\u00EDa de inicio", "aria-label": "Abrir gu\u00EDa de inicio" },
                            React.createElement(Icon, { name: "help" })),
                        React.createElement("button", { className: "icon-btn", onClick: () => this.route('ajustes'), title: "Colores, respaldos y ajustes" },
                            React.createElement(Icon, { name: "palette" })))),
                React.createElement("div", { className: "content" }, this.state.page === 'inicio' ? this.renderHome() : this.state.page === 'metas' ? this.renderGoals() : this.state.page === 'rutinas' ? this.renderRoutines() : this.state.page === 'horario' ? this.renderSchedule() : this.state.page === 'calendario' ? this.renderCalendar() : this.state.page === 'progreso' ? this.renderProgress() : this.renderSettings())),
            this.renderModal(),
            this.renderGuide(),
            this.state.toast && React.createElement("div", { className: "toast", role: "status", onClick: () => this.setState({ toast: '' }) },
                this.state.toast,
                " ",
                React.createElement("span", { style: { marginLeft: 9, opacity: .65, cursor: 'pointer' } }, "\u00D7")));
    }
}
ReactDOM.render(React.createElement(Planner, null), document.getElementById('app'));