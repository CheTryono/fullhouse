const STORE = 'fullhouse-v01';
const LEGACY_STORE = 'botanica-planificador-v01';
const colorOptions = ['#4b8665', '#c39960', '#8683b3', '#b87f75', '#5485a3'];
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
function gDraft() { return { id: '', title: '', desc: '', parentId: '', color: colorOptions[0], current: 0, target: 0, unit: '' }; }
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
function Icon({ name, size = 19 }) { return React.createElement("span", { className: "icon", style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
    React.createElement("svg", { style: { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } },
        React.createElement("use", { href: '#i-' + name }))); }
function Btn({ children, onClick, kind = '', tiny = false, disabled = false, type = 'button', title }) { return React.createElement("button", { className: `btn ${kind} ${tiny ? 'tiny' : ''}`, onClick: onClick, type: type, disabled: disabled, title: title }, children); }
class Planner extends React.Component {
    constructor(props) {
        super(props);
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
        this.openGoal = (goal, parentId = '') => this.setState({ modal: 'goal', goalDraft: goal ? { id: goal.id, title: goal.title, desc: goal.desc, parentId: goal.parentId, color: goal.color, current: goal.current, target: goal.target, unit: goal.unit } : { ...gDraft(), parentId } });
        this.openRoutine = (r) => this.setState({ modal: 'routine', routineDraft: r ? JSON.parse(JSON.stringify(r)) : rDraft() });
        this.openEvent = (e) => this.setState({ modal: 'event', eventDraft: e ? JSON.parse(JSON.stringify(e)) : eDraft(this.state.selectedDate) });
        this.openProgress = (g) => this.setState({ modal: 'progress', progressGoalId: g.id, progressValue: String(g.current), progressNote: '' });
        this.openExecute = (e) => this.setState({ modal: 'execute', activeEventId: e.id });
        this.close = () => this.setState({ modal: null });
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
            const next = { ...x, id: x.id || uid(), title: x.title.trim(), target: Math.max(0, x.target), current: Math.max(0, x.current), history: (before === null || before === void 0 ? void 0 : before.history) || [] };
            this.save({ ...data, goals: before ? data.goals.map(g => g.id === x.id ? next : g) : [...data.goals, next] });
            this.close();
        };
        this.saveRoutine = () => {
            const x = this.state.routineDraft;
            if (!x.title.trim()) {
                this.setState({ toast: 'Escribe un nombre para la rutina' });
                return;
            }
            if (x.steps.some(s => !s.title.trim())) {
                this.setState({ toast: 'Todos los pasos necesitan un nombre' });
                return;
            }
            const data = this.state.data;
            const result = { ...x, id: x.id || uid(), title: x.title.trim(), steps: x.steps.map(s => ({ ...s, title: s.title.trim(), min: Math.max(1, s.min) })) };
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
            const completed = !!routine && routine.steps.length > 0 && routine.steps.every(s => checked.includes(s.id));
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
            const val = Number(this.state.progressValue);
            if (!Number.isFinite(val) || val < 0) {
                this.setState({ toast: 'Registra un valor válido mayor o igual a cero' });
                return;
            }
            const next = { ...g, current: val, history: [...g.history, { date: today(), value: val, note: this.state.progressNote.trim() }] };
            this.save({ ...d, goals: d.goals.map(x => x.id === g.id ? next : x) }, 'Avance registrado');
            this.close();
        };
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
        this.changeMonth = (offset) => { const d = parseDay(this.state.month); d.setMonth(d.getMonth() + offset); const newMonth = ymd(d); this.setState({ month: newMonth, selectedDate: newMonth }); };
        const d = today();
        this.state = { data: load(), page: 'inicio', selectedDate: d, month: firstMonth(d), modal: null, goalDraft: gDraft(), routineDraft: rDraft(), eventDraft: eDraft(d), activeEventId: '', progressValue: '', progressNote: '', progressGoalId: '', toast: '' };
    }
    renderSidebar() {
        const links = [{ id: 'inicio', label: 'Inicio', icon: 'home' }, { id: 'metas', label: 'Mis metas', icon: 'target' }, { id: 'rutinas', label: 'Rutinas', icon: 'checklist' }, { id: 'calendario', label: 'Calendario', icon: 'calendar' }, { id: 'progreso', label: 'Progreso', icon: 'chart' }, { id: 'ajustes', label: 'Respaldo y ajustes', icon: 'settings' }];
        return React.createElement(React.Fragment, null,
            React.createElement("aside", { className: "sidebar" },
                React.createElement("div", { className: "brand" },
                    React.createElement("div", { className: "brand-mark" },
                        React.createElement(Icon, { name: "home", size: 24 })),
                    React.createElement("div", null,
                        React.createElement("div", { className: "brand-name" }, "FULLHOUSE"),
                        React.createElement("div", { className: "brand-sub" }, "Tu sistema integral"))),
                React.createElement("div", { className: "side-section" }, "Mi espacio"),
                React.createElement("nav", null, links.map(l => React.createElement("button", { key: l.id, className: `nav-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
                    React.createElement(Icon, { name: l.icon }),
                    l.label))),
                React.createElement("div", { className: "sidebar-bottom" },
                    React.createElement("div", { className: "profile-mini" },
                        React.createElement("div", { className: "avatar" }, "\u2733"),
                        React.createElement("div", null,
                            React.createElement("div", { className: "profile-name" }, "Mi espacio privado"),
                            React.createElement("div", { className: "profile-meta" }, "Prototipo web \u00B7 0.1"))),
                    React.createElement("small", null, "Sin cuentas, sin sincronizaci\u00F3n externa. Los datos permanecen en este navegador."))),
            React.createElement("nav", { className: "mobile-nav", "aria-label": "Navegaci\u00F3n m\u00F3vil" }, links.slice(0, 5).map(l => React.createElement("button", { key: l.id, className: `mobile-item ${this.state.page === l.id ? 'active' : ''}`, onClick: () => this.route(l.id) },
                React.createElement(Icon, { name: l.icon }),
                l.label.replace('Mis ', '')))));
    }
    renderHeading(title, description, action) { return React.createElement("div", { className: "heading-row" },
        React.createElement("div", null,
            React.createElement("div", { className: "eyebrow" },
                "MI SISTEMA / ",
                this.state.page),
            React.createElement("h1", { className: "page-title" }, title),
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
        const tracked = d.goals.filter(g => g.target > 0), rate = es.length ? Math.round(n / es.length * 100) : 0;
        return React.createElement(React.Fragment, null,
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
                        React.createElement("button", { className: "link-btn", onClick: () => this.route('calendario') },
                            "Ver calendario ",
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
                            React.createElement("span", null,
                                percent(g.current, g.target),
                                "%")),
                        React.createElement("div", { className: "progress-track" },
                            React.createElement("div", { className: "progress-fill", style: { width: `${percent(g.current, g.target)}%`, background: g.color } })),
                        React.createElement("p", { className: "caption" },
                            g.current,
                            " de ",
                            g.target,
                            " ",
                            g.unit))) : React.createElement("div", { className: "empty" },
                        React.createElement("strong", null, "Sin metas medibles"),
                        React.createElement("p", null, "Configura un objetivo num\u00E9rico para visualizar su avance.")))),
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
        const d = this.state.data, children = d.goals.filter(x => x.parentId === g.id), linked = d.events.filter(e => e.goalId === g.id).length;
        return React.createElement("div", { className: "goal-card", key: g.id, style: { borderLeft: `4px solid ${g.color}` } },
            React.createElement("div", { className: "goal-card-title" },
                React.createElement("div", { className: "goal-color", style: { background: g.color } }),
                React.createElement("div", { className: "flex" },
                    React.createElement("div", { className: "goal-level" }, depth ? 'SUB-META · NIVEL ' + (depth + 1) : 'META PRINCIPAL'),
                    React.createElement("h3", { className: "goal-name" }, g.title),
                    React.createElement("p", { className: "goal-desc" }, g.desc || 'Sin descripción'))),
            g.target > 0 ? React.createElement("div", null,
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
                    React.createElement("div", { className: "progress-fill", style: { background: g.color, width: `${percent(g.current, g.target)}%` } }))) : React.createElement("div", { className: "caption" }, "Meta cualitativa \u00B7 Sin objetivo num\u00E9rico"),
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
                React.createElement(Btn, { kind: "secondary", tiny: true, onClick: () => this.openProgress(g) },
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
            React.createElement("div", { className: "notice" }, "El progreso de una meta num\u00E9rica se actualiza cuando registras un resultado. Completar actividades no equivale autom\u00E1ticamente a conseguir un resultado."),
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
                    r.steps.length,
                    " pasos \u00B7 ",
                    r.steps.reduce((s, x) => s + x.min, 0),
                    " min estimados"),
                React.createElement("div", { className: "routine-step-preview" },
                    r.steps.slice(0, 3).map((s, i) => React.createElement("div", { key: s.id },
                        i + 1,
                        ". ",
                        s.title,
                        " ",
                        React.createElement("span", { className: "muted" },
                            "\u00B7 ",
                            s.min,
                            " min"))),
                    r.steps.length > 3 && React.createElement("div", null,
                        "+",
                        r.steps.length - 3,
                        " pasos m\u00E1s")),
                React.createElement("div", { className: "actions" },
                    React.createElement(Btn, { tiny: true, onClick: () => this.setState({ modal: 'event', eventDraft: { ...eDraft(this.state.selectedDate), title: r.title, routineId: r.id, minutes: r.steps.reduce((s, x) => s + x.min, 0) } }) },
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
    renderCalendar() {
        const date = this.state.selectedDate, d = this.state.data;
        return React.createElement(React.Fragment, null,
            this.renderHeading('Calendario', 'Tu agenda propia. Organiza fechas, repeticiones y prioridades sin conectar servicios externos.', React.createElement(Btn, { onClick: () => this.openEvent() },
                React.createElement(Icon, { name: "plus" }),
                " Programar actividad")),
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
                React.createElement("h2", { className: "section-title" }, "\u00DAltimos registros de resultados")),
            React.createElement("section", { className: "panel" },
                d.goals.flatMap(g => g.history.map(h => ({ ...h, goal: g.title, unit: g.unit }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((h, i) => React.createElement("div", { className: "agenda-item", key: i },
                    React.createElement("div", { className: "agenda-time" }, h.date.slice(5)),
                    React.createElement("div", { className: "agenda-main" },
                        React.createElement("div", { className: "agenda-name" },
                            h.goal,
                            " \u00B7 ",
                            h.value,
                            " ",
                            h.unit),
                        h.note && React.createElement("div", { className: "agenda-sub" }, h.note)))),
                !d.goals.some(g => g.history.length > 0) && React.createElement("div", { className: "empty" },
                    React.createElement("strong", null, "A\u00FAn no hay resultados registrados"),
                    React.createElement("p", null, "Desde una meta, pulsa \u00ABRegistrar avance\u00BB para iniciar tu historial."))));
    }
    renderSettings() {
        return React.createElement(React.Fragment, null,
            this.renderHeading('Respaldo y ajustes', 'Todo permanece bajo tu control. Realiza copias de seguridad para conservar tus datos incluso si cambias de dispositivo o navegador.'),
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
        return React.createElement("div", { className: "modal-backdrop", onClick: (ev) => { if (ev.target === ev.currentTarget)
                this.close(); } },
            React.createElement("div", { className: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h2", { className: "modal-title" }, title),
                    React.createElement("button", { className: "icon-btn", onClick: this.close, "aria-label": "Cerrar" },
                        React.createElement(Icon, { name: "close" }))),
                React.createElement("div", { className: "modal-body" }, modal === 'goal' ? this.goalForm() : modal === 'routine' ? this.routineForm() : modal === 'event' ? this.eventForm() : modal === 'progress' ? this.progressForm() : this.executeForm()),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement(Btn, { kind: "secondary", onClick: this.close }, "Cerrar"),
                    modal === 'goal' && React.createElement(Btn, { onClick: this.saveGoal }, "Guardar meta"),
                    modal === 'routine' && React.createElement(Btn, { onClick: this.saveRoutine }, "Guardar rutina"),
                    modal === 'event' && React.createElement(Btn, { onClick: this.saveEvent }, "Guardar actividad"),
                    modal === 'progress' && React.createElement(Btn, { onClick: this.saveProgress }, "Registrar resultado"))));
    }
    goalForm() {
        const x = this.state.goalDraft, notAllowed = x.id ? [x.id, ...this.descendants(x.id)] : [];
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Nombre de la meta *"),
                React.createElement("input", { maxLength: 90, value: x.title, onChange: e => this.updateGoalDraft({ title: e.target.value }), placeholder: "Ej. Mejorar mi fuerza" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Descripci\u00F3n o prop\u00F3sito"),
                React.createElement("textarea", { maxLength: 350, value: x.desc, onChange: e => this.updateGoalDraft({ desc: e.target.value }), placeholder: "\u00BFQu\u00E9 quiero conseguir y para qu\u00E9?" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Meta superior (opcional)"),
                React.createElement("select", { value: x.parentId, onChange: e => this.updateGoalDraft({ parentId: e.target.value }) },
                    React.createElement("option", { value: "" }, "Ninguna \u00B7 Meta principal"),
                    this.state.data.goals.filter(g => !notAllowed.includes(g.id)).map(g => React.createElement("option", { value: g.id, key: g.id }, g.title)))),
            React.createElement("div", { className: "field-grid" },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Resultado actual"),
                    React.createElement("input", { type: "number", min: "0", step: "any", value: x.current, onChange: e => this.updateGoalDraft({ current: asInt(e.target.value) }) })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "Resultado objetivo (0 = sin medida)"),
                    React.createElement("input", { type: "number", min: "0", step: "any", value: x.target, onChange: e => this.updateGoalDraft({ target: asInt(e.target.value) }) }))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Unidad de medida"),
                React.createElement("input", { maxLength: 40, placeholder: "Ej. km, sesiones, cap\u00EDtulos, kg", value: x.unit, onChange: e => this.updateGoalDraft({ unit: e.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Color de identificaci\u00F3n"),
                React.createElement("div", { className: "row" }, colorOptions.map(c => React.createElement("button", { key: c, onClick: () => this.updateGoalDraft({ color: c }), title: c, style: { width: 31, height: 31, borderRadius: '50%', background: c, border: x.color === c ? '3px solid #1b3a2c' : '3px solid white', outline: x.color === c ? '1px solid #afc3b1' : 'none' } })))));
    }
    routineForm() {
        const r = this.state.routineDraft, changeStep = (id, patch) => this.updateRoutineDraft({ steps: r.steps.map(s => s.id === id ? { ...s, ...patch } : s) });
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Nombre de la rutina *"),
                React.createElement("input", { maxLength: 90, value: r.title, onChange: e => this.updateRoutineDraft({ title: e.target.value }), placeholder: "Ej. Preparaci\u00F3n para el gimnasio" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Descripci\u00F3n"),
                React.createElement("textarea", { maxLength: 350, value: r.desc, onChange: e => this.updateRoutineDraft({ desc: e.target.value }), placeholder: "\u00BFCu\u00E1l es el prop\u00F3sito de esta rutina?" })),
            React.createElement("div", { className: "field" },
                React.createElement("div", { className: "row spread" },
                    React.createElement("label", { style: { margin: 0 } }, "Pasos del procedimiento"),
                    React.createElement("span", { className: "caption" },
                        r.steps.reduce((v, s) => v + s.min, 0),
                        " minutos en total"))),
            r.steps.map((s, i) => React.createElement("div", { className: "step-edit", key: s.id },
                React.createElement("span", { className: "step-label" },
                    i + 1,
                    "."),
                React.createElement("input", { "aria-label": 'Nombre del paso ' + (i + 1), value: s.title, onChange: e => changeStep(s.id, { title: e.target.value }), placeholder: "Nombre del paso" }),
                React.createElement("input", { className: "step-min", "aria-label": "Duraci\u00F3n en minutos", type: "number", min: "1", value: s.min, onChange: e => changeStep(s.id, { min: asInt(e.target.value, 1) }) }),
                React.createElement("button", { className: "icon-btn", title: "Mover paso arriba", disabled: i === 0, onClick: () => { const a = [...r.steps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; this.updateRoutineDraft({ steps: a }); } }, "\u2191"),
                React.createElement("button", { className: "icon-btn", title: "Mover paso abajo", disabled: i === r.steps.length - 1, onClick: () => { const a = [...r.steps]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; this.updateRoutineDraft({ steps: a }); } }, "\u2193"),
                React.createElement("button", { className: "icon-btn", title: "Quitar paso", onClick: () => this.updateRoutineDraft({ steps: r.steps.filter(x => x.id !== s.id) }) },
                    React.createElement(Icon, { name: "close", size: 13 })))),
            React.createElement("div", { style: { marginTop: 13 } },
                React.createElement(Btn, { kind: "secondary", tiny: true, onClick: () => this.updateRoutineDraft({ steps: [...r.steps, { id: uid(), title: '', min: 5 }] }) },
                    React.createElement(Icon, { name: "plus", size: 14 }),
                    " Agregar paso")),
            React.createElement("div", { className: "notice", style: { marginTop: 18 } }, "Puedes vincular la rutina a actividades del calendario. Cambiar la plantilla modificar\u00E1 los pasos que ver\u00E1s en ejecuciones futuras y al consultar las existentes."));
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
                    React.createElement("select", { value: e.repeat, onChange: v => this.updateEventDraft({ repeat: v.target.value }) },
                        React.createElement("option", { value: "none" }, "Solo esta fecha"),
                        React.createElement("option", { value: "daily" }, "Todos los d\u00EDas"),
                        React.createElement("option", { value: "weekdays" }, "Lunes a viernes"),
                        React.createElement("option", { value: "weekly" }, "Cada semana")))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Rutina o procedimiento (opcional)"),
                React.createElement("select", { value: e.routineId, onChange: v => { const id = v.target.value, r = rs.find(x => x.id === id); this.updateEventDraft({ routineId: id, ...(r ? { title: r.title, minutes: r.steps.reduce((a, s) => a + s.min, 0) } : {}) }); } },
                    React.createElement("option", { value: "" }, "Actividad sencilla"),
                    rs.map(r => React.createElement("option", { key: r.id, value: r.id }, r.title)))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Meta vinculada (opcional)"),
                React.createElement("select", { value: e.goalId, onChange: v => this.updateEventDraft({ goalId: v.target.value }) },
                    React.createElement("option", { value: "" }, "Sin meta asociada"),
                    gs.map(g => React.createElement("option", { value: g.id, key: g.id }, g.title)))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Notas e instrucciones"),
                React.createElement("textarea", { value: e.note, onChange: v => this.updateEventDraft({ note: v.target.value }), maxLength: 400, placeholder: "Detalles que quieras recordar" })),
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
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "notice" },
                g.title,
                " \u00B7 Valor actual: ",
                g.current,
                " ",
                g.unit,
                g.target > 0 ? ' · Objetivo: ' + g.target + ' ' + g.unit : ''),
            React.createElement("div", { className: "field", style: { marginTop: 18 } },
                React.createElement("label", null, "Nuevo resultado"),
                React.createElement("input", { type: "number", step: "any", min: "0", value: this.state.progressValue, onChange: e => this.setState({ progressValue: e.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "Nota del registro (opcional)"),
                React.createElement("textarea", { value: this.state.progressNote, onChange: e => this.setState({ progressNote: e.target.value }), placeholder: "\u00BFQu\u00E9 cambi\u00F3 desde el registro anterior?" })),
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
                ". Los pasos marcados se guardan \u00FAnicamente para esta ejecuci\u00F3n."),
            React.createElement("div", { style: { marginTop: 15 } }, r.steps.map((s, i) => React.createElement("div", { className: "routine-step", key: s.id },
                React.createElement("button", { className: `check-circle ${log.checkedSteps.includes(s.id) ? 'checked' : ''}`, onClick: () => this.toggleStep(e, date, s.id), "aria-label": 'Marcar ' + s.title }, log.checkedSteps.includes(s.id) && React.createElement(Icon, { name: "check", size: 13 })),
                React.createElement("div", { className: "flex" },
                    React.createElement("div", { className: "agenda-name", style: { textDecoration: log.checkedSteps.includes(s.id) ? 'line-through' : 'none' } },
                        i + 1,
                        ". ",
                        s.title),
                    React.createElement("div", { className: "agenda-sub" },
                        s.min,
                        " min estimados"))))),
            React.createElement("div", { className: "divider" }),
            React.createElement("div", { className: "row spread" },
                React.createElement("span", { className: "caption" },
                    log.checkedSteps.length,
                    " / ",
                    r.steps.length,
                    " pasos completados"),
                log.completed && React.createElement("span", { className: "small-tag" }, "Actividad completada")));
    }
    render() {
        const title = { inicio: 'Inicio', metas: 'Metas', rutinas: 'Rutinas', calendario: 'Calendario', progreso: 'Progreso', ajustes: 'Ajustes' };
        return React.createElement("div", { className: "app-shell" },
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
                        React.createElement("button", { className: "icon-btn", onClick: () => this.route('ajustes'), title: "Respaldos y ajustes" },
                            React.createElement(Icon, { name: "settings" })))),
                React.createElement("div", { className: "content" }, this.state.page === 'inicio' ? this.renderHome() : this.state.page === 'metas' ? this.renderGoals() : this.state.page === 'rutinas' ? this.renderRoutines() : this.state.page === 'calendario' ? this.renderCalendar() : this.state.page === 'progreso' ? this.renderProgress() : this.renderSettings())),
            this.renderModal(),
            this.state.toast && React.createElement("div", { className: "toast", role: "status", onClick: () => this.setState({ toast: '' }) },
                this.state.toast,
                " ",
                React.createElement("span", { style: { marginLeft: 9, opacity: .65, cursor: 'pointer' } }, "\u00D7")));
    }
}
ReactDOM.render(React.createElement(Planner, null), document.getElementById('app'));