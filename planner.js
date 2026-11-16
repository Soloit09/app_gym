(() => {
  'use strict';
  const KEY = 'gym-progress-v1';
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value;
  const templates = {
    completo: { name: 'Cuerpo completo', ids: [8, 0, 5, 10, 11] },
    superior: { name: 'Tren superior', ids: [0, 5, 4, 3, 6] },
    inferior: { name: 'Piernas', ids: [8, 10, 11, 9] }
  };
  function propose(focus, minutes, excluded = []) {
    const template = templates[focus] || templates.completo;
    const ids = template.ids.filter(id => !excluded.includes(id)).slice(0, Number(minutes) <= 25 ? 3 : 5);
    return { name: `${template.name} · ${minutes} min aprox.`, ids };
  }
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.sessions) || data.sessions.length > 5000) throw new Error('Respaldo no compatible.');
    const dates = new Set();
    for (const s of data.sessions) {
      if (!validDate(s.date) || dates.has(s.date) || !['planned', 'partial', 'completed'].includes(s.status) || typeof s.name !== 'string' || s.name.length > 160 || !Array.isArray(s.exercises) || s.exercises.length > 13 || typeof s.notes !== 'string' || s.notes.length > 1000 || !Number.isFinite(s.minutes) || s.minutes < 0 || s.minutes > 600 || !['', 'suave', 'moderado', 'alto'].includes(s.effort) || !['', 'sin molestias', 'con molestias'].includes(s.discomfort)) throw new Error('El respaldo contiene una sesión inválida.');
      dates.add(s.date);
      if (s.date > dateKey() && s.status !== 'planned') throw new Error('Una fecha futura solo puede estar planificada.');
      const ids = new Set();
      for (const e of s.exercises) {
        if (!Number.isInteger(e.id) || e.id < 0 || e.id > 12 || ids.has(e.id) || !Array.isArray(e.sets) || e.sets.length > 6) throw new Error('Ejercicio inválido.');
        ids.add(e.id);
        for (const row of e.sets) {
          if (typeof row.done !== 'boolean' || !['kg', 'lb'].includes(row.unit) || !['weight', 'reps'].every(k => row[k] === '' || (Number.isFinite(row[k]) && row[k] >= 0 && row[k] <= (k === 'weight' ? 1000 : 200))) || (row.reps !== '' && !Number.isInteger(row.reps))) throw new Error('Serie inválida.');
        }
      }
    }
    return data;
  }
  globalThis.GymPlanner = { dateKey, validDate, propose, validate };
  if (typeof document === 'undefined') return;
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const cards = [...document.querySelectorAll('.exercise-card')];
  const names = cards.map(c => c.querySelector('.exercise-title').textContent.replace(/^\d+\.\s*/, ''));
  const groups = { pecho: [0, 1, 2, 3], espalda: [4, 5, 6, 7], piernas: [8, 9, 10, 11, 12] };
  let data = { version: 1, sessions: [] }, storageOK = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = validate(JSON.parse(raw));
    localStorage.setItem('gym-storage-check', '1');
    localStorage.removeItem('gym-storage-check');
  } catch { storageOK = false; }
  const root = el('section', undefined, 'planner');
  root.id = 'mi-entrenamiento';
  root.innerHTML = `
    <h2>Mi entrenamiento <small>Versión 3.0</small></h2>
    <p>Planifica, registra tus sesiones y consulta tu progreso.</p>
    <p class="planner-hint">Tu historial se guarda en este dispositivo. Chrome y el APK tienen historiales separados. Exporta una copia antes de desinstalar o cambiar de teléfono.</p>
    <p id="planner-message" role="status" aria-live="polite"></p>
    <details open><summary>Proponer una rutina</summary>
      <label>Enfoque<select id="mix-focus"><option value="completo">Cuerpo completo</option><option value="superior">Tren superior</option><option value="inferior">Piernas</option></select></label>
      <label>Tiempo disponible<select id="mix-time"><option value="25">25 minutos · 3 ejercicios</option><option value="40">40 minutos · hasta 5 ejercicios</option></select></label>
      <details><summary>Excluir ejercicios que no puedo realizar</summary><div id="exclusions"></div></details>
      <section id="mix-preview" aria-live="polite" aria-label="Rutina propuesta"><h3>Rutina propuesta</h3><p id="mix-preview-name"></p><ol id="mix-preview-list"></ol><p id="mix-preview-status" class="planner-hint"></p></section>
      <button id="propose" type="button">Usar esta rutina</button>
      <p class="planner-hint">Plantillas de organización, no una prescripción individual. No asignan peso ni aumentan cargas. Revisa ejercicios, series y repeticiones con tu entrenador según tu experiencia y salud; la rutina original es de nivel intermedio.</p>
      <p class="planner-hint">Además de fuerza, considera actividad aeróbica y equilibrio adaptados a tus capacidades. <a href="https://www.cdc.gov/physical-activity-basics/guidelines/older-adults.html" target="_blank" rel="noopener noreferrer">Guía CDC</a>. Si tienes dolor nuevo, mareo o malestar, detén la sesión y busca orientación; no uses el mix para decidir si es seguro entrenar.</p>
      <p id="mix-reason"></p>
    </details>
    <details open><summary>Calendario e historial</summary>
      <div class="calendar-nav"><button type="button" id="month-prev" aria-label="Mes anterior">‹</button><h3 id="month-title"></h3><button type="button" id="month-next" aria-label="Mes siguiente">›</button></div>
      <div id="calendar" class="calendar"></div>
      <p class="planner-hint">○ Planificada · ◐ Parcial · ✓ Completada. Toca una fecha para ver o registrar la sesión.</p>
      <p id="month-summary"></p>
    </details>
    <form id="session-form">
      <h3>Sesión seleccionada</h3>
      <label>Fecha<input id="session-date" type="date" required></label>
      <label>Rutina<select id="session-plan"><option value="pecho">Día A · Pecho y brazos</option><option value="espalda">Día B · Espalda y lumbar</option><option value="piernas">Día C · Piernas y abdomen</option><option value="mix">Combinación propuesta / guardada</option></select></label>
      <p id="session-name"></p><p id="recovery-note" class="planner-hint"></p>
      <div id="session-exercises"></div>
      <label>Estado<select id="session-status"><option value="planned">Planificada</option><option value="partial">Parcial</option><option value="completed">Completada</option></select></label>
      <label>Duración real (minutos)<input id="session-minutes" type="number" min="0" max="600" step="1" value="0" required></label>
      <label>Esfuerzo percibido<select id="session-effort"><option value="">Sin registrar</option><option value="suave">Suave</option><option value="moderado">Moderado</option><option value="alto">Alto</option></select></label>
      <label>Molestias<select id="session-discomfort"><option value="">Sin registrar</option><option value="sin molestias">Sin molestias</option><option value="con molestias">Con molestias</option></select></label>
      <label>Notas<textarea id="session-notes" rows="3" maxlength="1000" placeholder="Cómo te sentiste, ajustes o recomendaciones de tu entrenador"></textarea></label>
      <div class="planner-actions"><button type="submit">Guardar sesión</button><button type="button" id="session-delete">Eliminar esta fecha</button></div>
    </form>
    <details><summary>Respaldo de mi historial</summary><p>El archivo incluye tus notas y registros personales. Guárdalo en un lugar privado.</p><button id="export-history" type="button">Exportar respaldo</button><details><summary>Si el APK no descarga el archivo</summary><p>Después de exportar, también puedes copiar el texto siguiente y guardarlo como archivo .json para restaurarlo.</p><label>Contenido del respaldo<textarea id="backup-text" readonly rows="6"></textarea></label></details><label>Restaurar respaldo JSON<input type="file" id="import-history" accept="application/json,.json"></label></details>`;
  document.querySelector('.routine-tabs').before(root);
  const $ = id => root.querySelector(`#${id}`);
  const message = text => { $('planner-message').textContent = text; const result=$('session-result');if(result)result.textContent=text; };
  if (!storageOK) message('No se pudo leer o usar el almacenamiento. No se sobrescribirá el historial existente. Puedes exportar los cambios de esta sesión, pero no se conservarán al cerrar.');
  let selected = dateKey(), month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let draft, dirty = false, savedMix = null;
  const blankExercise = id => ({ id, sets: Array.from({ length: 2 }, () => ({ weight: '', reps: '', unit: 'kg', done: false })) });
  function fresh(plan = 'pecho') {
    return { date: selected, name: plan === 'mix' ? savedMix.name : { pecho: 'Día A · Pecho y brazos', espalda: 'Día B · Espalda y lumbar', piernas: 'Día C · Piernas y abdomen' }[plan], status: 'planned', exercises: (plan === 'mix' ? savedMix.ids : groups[plan]).map(blankExercise), minutes: 0, effort: '', discomfort: '', notes: '' };
  }
  function persist(next) {
    validate(next);
    if (storageOK) {
      try { localStorage.setItem(KEY, JSON.stringify(next)); }
      catch { message('No se pudo guardar. Exporta un respaldo antes de cerrar.'); return false; }
    }
    data = next;
    return true;
  }
  function allowDiscard() { return !dirty || confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'); }
  function renderCalendar() {
    $('month-title').textContent = month.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    const grid = $('calendar'); grid.replaceChildren();
    ['L','M','X','J','V','S','D'].forEach(day => grid.append(el('span', day)));
    const offset = (month.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) grid.append(el('span'));
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= total; day++) {
      const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
      const session = data.sessions.find(s => s.date === key);
      const symbols = { planned: '○', partial: '◐', completed: '✓' };
      const button = el('button', `${day}${session ? ' '+symbols[session.status] : ''}`, `calendar-day ${session?.status || ''}`);
      button.type = 'button'; button.setAttribute('aria-label', `${key}${session ? ', '+{planned:'planificada',partial:'parcial',completed:'completada'}[session.status] : ', sin sesión'}`);
      button.setAttribute('aria-pressed', String(selected === key));
      if (key === dateKey()) button.setAttribute('aria-current', 'date');
      button.onclick = () => { if (allowDiscard()) { load(key); navigate('entrenar'); } };
      grid.append(button);
    }
    const sessions = data.sessions.filter(s => s.date.startsWith(dateKey(month).slice(0,7)));
    $('month-summary').textContent = `${sessions.filter(s=>s.status==='completed').length} completadas · ${sessions.filter(s=>s.status==='partial').length} parciales · ${sessions.filter(s=>s.status==='planned').length} planificadas`;
  }
  function previous(id) {
    return data.sessions.filter(s=>s.date < selected && s.status !== 'planned').sort((a,b)=>b.date.localeCompare(a.date)).flatMap(s=>s.exercises.filter(e=>e.id===id && e.sets.some(row=>row.done)).map(e=>({date:s.date,sets:e.sets}))).at(0);
  }
  function renderExercises() {
    $('session-name').textContent = draft.name;
    const container = $('session-exercises'); container.replaceChildren();
    draft.exercises.forEach((exercise, index) => {
      const box = el('article', undefined, 'session-exercise');
      box.append(el('h4', `${index + 1}. ${names[exercise.id]}`));
      const prev = previous(exercise.id);
      box.append(el('p', prev ? `Última sesión (${prev.date}): ${prev.sets.filter(s=>s.done).map(s=>`${s.weight === '' ? '—' : s.weight} ${s.unit} × ${s.reps === '' ? '—' : s.reps}`).join(' · ')}` : 'Sin series anteriores registradas.', 'planner-hint'));
      const view = el('button', 'Ver técnica y videos'); view.type = 'button';
      view.onclick = () => navigate(`tecnica/${exercise.id}`);
      box.append(view);
      exercise.sets.forEach((row, rowIndex) => {
        const line = el('div', undefined, 'set-entry');
        line.append(el('span', `Serie ${rowIndex+1}`));
        for (const [key, label, max, step] of [['weight','Peso',1000,'any'], ['reps','Reps',200,'1']]) {
          const wrapper = el('label', label), input = el('input');
          input.type = 'number'; input.min = '0'; input.max = String(max); input.step = step; input.inputMode = 'decimal'; input.value = row[key];
          input.setAttribute('aria-label', `${names[exercise.id]}, serie ${rowIndex+1}, ${label}`);
          input.oninput = () => { row[key] = input.value === '' ? '' : Number(input.value); dirty = true; };
          wrapper.append(input); line.append(wrapper);
        }
        const unitLabel = el('label', 'Unidad'), unit = el('select');
        ['kg','lb'].forEach(u=>{ const option=el('option',u);option.value=u;unit.append(option); }); unit.value=row.unit;
        unit.onchange=()=>{row.unit=unit.value;dirty=true;}; unitLabel.append(unit);line.append(unitLabel);
        const doneLabel=el('label','Hecha'),done=el('input');done.type='checkbox';done.checked=row.done;
        done.setAttribute('aria-label',`${names[exercise.id]}, serie ${rowIndex+1} realizada`);
        done.onchange=()=>{row.done=done.checked;dirty=true;};doneLabel.append(done);line.append(doneLabel);box.append(line);
      });
      const actions = el('div',undefined,'planner-actions');
      const add = el('button','+ Serie');add.type='button';add.disabled=exercise.sets.length>=6;
      add.onclick=()=>{exercise.sets.push({weight:'',reps:'',unit:exercise.sets.at(-1)?.unit || 'kg',done:false});dirty=true;renderExercises();};
      const remove=el('button','− Serie');remove.type='button';remove.disabled=exercise.sets.length<=1;
      remove.onclick=()=>{if (exercise.sets.at(-1).done && !confirm('¿Quitar esta serie realizada?')) return;exercise.sets.pop();dirty=true;renderExercises();};
      const omit=el('button','Quitar ejercicio');omit.type='button';omit.onclick=()=>{if(exercise.sets.some(s=>s.done)&&!confirm('¿Quitar este ejercicio y sus series registradas?'))return;draft.exercises.splice(index,1);dirty=true;renderExercises();};
      actions.append(add,remove,omit);box.append(actions);container.append(box);
    });
    const recent=data.sessions.filter(s=>s.date<selected && s.status!=='planned' && s.exercises.some(e=>draft.exercises.some(d=>d.id===e.id)) && (new Date(`${selected}T12:00:00`)-new Date(`${s.date}T12:00:00`))/86400000<=2);
    renderStep();
    $('recovery-note').textContent=recent.length ? 'Hay ejercicios repetidos en los dos días anteriores. Revisa tu recuperación y las indicaciones de tu entrenador antes de repetirlos.' : 'Revisa tu recuperación antes de entrenar. El tiempo indicado es orientativo y no incluye desplazamientos entre máquinas.';
  }
  function load(date) {
    selected=date;
    const session=data.sessions.find(s=>s.date===date);
    draft=session ? JSON.parse(JSON.stringify(session)) : fresh();
    $('session-date').value=date;
    let plan=Object.keys(groups).find(key=>JSON.stringify(groups[key])===JSON.stringify(draft.exercises.map(e=>e.id)));
    $('session-plan').value=plan || 'mix';
    for(const key of ['status','minutes','effort','discomfort','notes']) $('session-'+key).value=draft[key];
    dirty=false;stepIndex=0;renderCalendar();renderExercises();refreshDashboard();
  }
  names.forEach((name,id)=>{
    const label=el('label',undefined,'exclude-choice'),input=el('input');input.type='checkbox';input.value=String(id);label.append(input,document.createTextNode(name));$('exclusions').append(label);
  });
  let previewMix;
  function updateProposal() {
    previewMix=propose($('mix-focus').value,$('mix-time').value,[...$('exclusions').querySelectorAll('input:checked')].map(i=>Number(i.value)));
    $('mix-preview-name').textContent=previewMix.name;
    $('mix-preview-list').replaceChildren(...previewMix.ids.map(id=>el('li',names[id])));
    $('mix-preview-status').textContent=previewMix.ids.length
      ? `${previewMix.ids.length} ejercicios en el orden indicado. Pulsa «Usar esta rutina» para abrir el registro de la fecha seleccionada.`
      : 'No hay ejercicios disponibles con estas exclusiones. Cambia el enfoque o los ejercicios excluidos.';
    $('propose').disabled=!previewMix.ids.length;
  }
  $('mix-focus').addEventListener('change',updateProposal);
  $('mix-time').addEventListener('change',updateProposal);
  $('exclusions').addEventListener('change',updateProposal);
  $('propose').onclick=()=>{
    if(!allowDiscard() || !previewMix.ids.length)return;
    savedMix={name:previewMix.name,ids:[...previewMix.ids]};
    draft=fresh('mix');$('session-plan').value='mix';
    for(const key of ['status','minutes','effort','discomfort','notes']) $('session-'+key).value=draft[key];
    $('mix-reason').textContent=`Propuesta aplicada: ${savedMix.name}. ${savedMix.ids.length} ejercicios disponibles; 2 filas iniciales por ejercicio para registrar, ajustables con tu entrenador. No es un plan semanal completo.`;
    dirty=true;renderExercises();message('Rutina aplicada. Registra aquí las series realizadas y guarda la sesión.');
    stepIndex=0;renderStep();navigate('entrenar');
    $('session-name').setAttribute('tabindex','-1');
    $('session-name').focus({preventScroll:true});
  };
  $('session-plan').onchange=()=>{
    const value=$('session-plan').value;
    if(!allowDiscard()){ $('session-plan').value=Object.keys(groups).find(key=>JSON.stringify(groups[key])===JSON.stringify(draft.exercises.map(e=>e.id)))||'mix';return; }
    if(value==='mix'&&!savedMix){message('Primero elige un enfoque y pulsa Usar esta rutina.');load(selected);return;}
    draft=fresh(value);for(const key of ['status','minutes','effort','discomfort','notes'])$('session-'+key).value=draft[key];dirty=true;stepIndex=0;renderExercises();
  };
  $('session-date').onchange=()=>{if(validDate($('session-date').value)&&allowDiscard()){const date=$('session-date').value;month=new Date(`${date.slice(0,7)}-01T12:00:00`);load(date);}else $('session-date').value=selected;};
  $('session-form').addEventListener('input',event=>{if(!['session-date','session-plan'].includes(event.target.id))dirty=true;});
  $('session-form').onsubmit=event=>{
    event.preventDefault();
    if(!draft.exercises.length){message('La sesión necesita al menos un ejercicio.');return;}
    const next=JSON.parse(JSON.stringify(draft));next.date=selected;
    for(const key of ['status','effort','discomfort','notes'])next[key]=$('session-'+key).value;
    next.minutes=Number($('session-minutes').value);
    if(next.date>dateKey()&&next.status!=='planned'){message('Las fechas futuras solo pueden guardarse como planificadas.');return;}
    if(next.status==='completed'&&!next.exercises.some(e=>e.sets.some(s=>s.done))){message('Marca al menos una serie realizada, o guarda la sesión como planificada/parcial.');return;}
    if(next.status==='planned'&&next.exercises.some(e=>e.sets.some(s=>s.done))){message('Hay series realizadas: elige Parcial o Completada para registrarlas.');return;}
    try {
      if(persist({version:1,sessions:[...data.sessions.filter(s=>s.date!==selected),next]})){dirty=false;draft=next;renderCalendar();refreshDashboard();message(storageOK?'Sesión guardada en este dispositivo.':'Sesión conservada solo en memoria. Exporta un respaldo antes de cerrar.');}
    } catch { message('Revisa los valores: peso entre 0 y 1000 y repeticiones enteras entre 0 y 200.'); }
  };
  $('session-delete').onclick=()=>{if(!data.sessions.some(s=>s.date===selected)){message('No hay una sesión guardada en esta fecha.');return;}if(confirm('¿Eliminar la sesión de esta fecha?')&&persist({version:1,sessions:data.sessions.filter(s=>s.date!==selected)})){load(selected);message('Sesión eliminada.');}};
  for(const [id,delta] of [['month-prev',-1],['month-next',1]])$(id).onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+delta,1);renderCalendar();};
  $('export-history').onclick=()=>{
    if(dirty){message('Guarda la sesión antes de exportar para incluir tus cambios.');return;}
    $('backup-text').value=JSON.stringify(data,null,2);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');
    a.href=url;a.download=`rutina-historial-${dateKey()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    message('Respaldo solicitado. Si el APK no permite descargarlo, utiliza Chrome para exportar su propio historial; no se comparten automáticamente.');
  };
  $('import-history').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error('El archivo supera 5 MB.');
      const incoming=validate(JSON.parse(await file.text()));
      if(!confirm(`¿Restaurar ${incoming.sessions.length} sesiones? Reemplazará el historial de este dispositivo y los cambios sin guardar.`))return;
      if(persist(incoming)){load(selected);message(storageOK?'Historial restaurado.':'Historial restaurado solo en memoria: el almacenamiento no está disponible.');}
    }catch(error){message(error instanceof SyntaxError?'El archivo no es JSON válido.':error.message);}finally{event.target.value='';}
  };
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  // Vistas independientes: se reutilizan los controles para conservar el historial v1.
  let stepIndex=0, currentRoute='inicio', techniqueCard=null, techniqueMarker=null;
  const views={};
  const heading=root.querySelector('h2');heading.textContent='Mi gimnasio · Versión 3.0';
  heading.classList.add('screen-brand');
  const intro=heading.nextElementSibling;intro.classList.add('screen-intro');intro.textContent='Tu entrenamiento, paso a paso.';
  const storageNote=intro.nextElementSibling;
  const originalDetails=[...root.children].filter(n=>n.tagName==='DETAILS');
  function panel(id,title) {
    const section=el('section',undefined,'app-screen');section.id=`screen-${id}`;section.hidden=true;
    section.append(el('h2',title));root.append(section);views[id]=section;return section;
  }
  const home=panel('inicio','Inicio');
  home.innerHTML+='<p id="home-today"></p><h3 id="home-routine"></h3><p id="home-status"></p><button type="button" id="start-today">Comenzar / continuar</button><button type="button" id="home-pending" hidden>Retomar cambios sin guardar</button><p id="home-last"></p><button type="button" id="choose-routine">Elegir otra rutina</button>';
  home.append(storageNote);
  const routines=panel('rutinas','Rutinas');
  const originalChoices=el('div',undefined,'routine-choices');
  for(const [group,title] of Object.entries({pecho:'Día A · Pecho y brazos',espalda:'Día B · Espalda y lumbar',piernas:'Día C · Piernas y abdomen'})) {
    const item=el('article',undefined,'routine-choice');item.append(el('h3',title));
    const inspect=el('button','Ver ejercicios');inspect.type='button';inspect.onclick=()=>{
      const tab=[...document.querySelectorAll('.tab-btn')][Object.keys(groups).indexOf(group)];switchRoutine(group,tab);navigate('catalogo');
    };
    const use=el('button','Entrenar esta rutina');use.type='button';use.onclick=()=>{
      if(!allowDiscard())return;
      draft=fresh(group);$('session-plan').value=group;
      for(const key of ['status','minutes','effort','discomfort','notes'])$('session-'+key).value=draft[key];
      dirty=true;stepIndex=0;renderExercises();navigate('entrenar');
    };
    item.append(inspect,use);originalChoices.append(item);
  }
  routines.append(originalChoices,originalDetails[0]);
  const calendarView=panel('calendario','Calendario');calendarView.append(originalDetails[1]);
  const progress=panel('progreso','Progreso');
  const progressLabel=el('label','Consultar ejercicio'),progressSelect=el('select');progressSelect.id='progress-exercise';
  names.forEach((name,id)=>{const option=el('option',name);option.value=String(id);progressSelect.append(option);});
  progressLabel.append(progressSelect);progress.append(progressLabel,el('p',undefined,'planner-hint'));
  progress.lastElementChild.textContent='Se muestran series realizadas, con su unidad original. No se comparan kg con lb ni se aumentan cargas automáticamente.';
  const historyList=el('div');historyList.id='progress-history';progress.append(historyList,originalDetails[2]);
  const training=panel('entrenar','Entrenamiento');training.append($('session-form'));
  const sessionForm=$('session-form');sessionForm.querySelector('h3').textContent='Tu sesión';
  const settings=el('details');settings.append(el('summary','Fecha y rutina de la sesión'));
  const dateLabel=$('session-date').parentElement,planLabel=$('session-plan').parentElement;
  dateLabel.before(settings);settings.append(dateLabel,planLabel);
  const stepText=el('p');stepText.id='training-step';stepText.setAttribute('role','status');
  $('session-exercises').before(stepText);
  const stepControls=el('div',undefined,'planner-actions');
  const prevButton=el('button','Anterior'),nextButton=el('button','Siguiente');prevButton.type=nextButton.type='button';
  prevButton.id='step-prev';nextButton.id='step-next';stepControls.append(prevButton,nextButton);$('session-exercises').after(stepControls);
  const review=el('section');review.id='session-review';review.append(el('h3','Finalizar y guardar'),el('p','Revisa cómo fue la sesión. Puedes guardarla como parcial si no realizaste todos los ejercicios.'));
  const feedback=[];let sibling=stepControls.nextElementSibling;
  while(sibling){feedback.push(sibling);sibling=sibling.nextElementSibling;}
  sessionForm.append(review);review.append(...feedback);
  const sessionResult=el('p');sessionResult.id='session-result';sessionResult.setAttribute('role','status');review.append(sessionResult);
  function currentFieldsValid() {
    const boxes=[...$('session-exercises').children];
    const fields=boxes[stepIndex]?.querySelectorAll('input,select') || [];
    for(const field of fields)if(!field.checkValidity()){field.reportValidity();return false;}
    return true;
  }
  prevButton.onclick=()=>{if(!currentFieldsValid())return;stepIndex=Math.max(0,stepIndex-1);renderStep();window.scrollTo({top:0,behavior:'smooth'});};
  nextButton.onclick=()=>{if(!currentFieldsValid())return;stepIndex=Math.min(draft.exercises.length,stepIndex+1);renderStep();window.scrollTo({top:0,behavior:'smooth'});};
  function renderStep() {
    if(!draft || !views.entrenar)return;
    stepIndex=Math.min(stepIndex,draft.exercises.length);
    [...$('session-exercises').children].forEach((node,index)=>{node.hidden=index!==stepIndex;});
    review.hidden=stepIndex<draft.exercises.length;
    stepText.textContent=review.hidden?`Ejercicio ${stepIndex+1} de ${draft.exercises.length}`:'Resumen de la sesión';
    prevButton.disabled=stepIndex===0;nextButton.hidden=!review.hidden;
    nextButton.textContent=stepIndex===draft.exercises.length-1?'Finalizar y revisar':'Siguiente ejercicio';
  }
  const catalog=panel('catalogo','Biblioteca de ejercicios');
  const backRoutines=el('button','Volver a Rutinas');backRoutines.type='button';backRoutines.onclick=()=>navigate('rutinas');catalog.append(backRoutines);
  for(const selector of ['.routine-tabs','.youtube-settings','.rir-note','.routine-section','.progression-card'])document.querySelectorAll(selector).forEach(node=>catalog.append(node));
  const technique=panel('tecnica','Técnica y videos');
  const backTraining=el('button','Volver al entrenamiento');backTraining.type='button';backTraining.onclick=()=>navigate('entrenar');technique.append(backTraining);
  const techniqueHost=el('div');techniqueHost.id='technique-host';technique.append(techniqueHost);
  // El temporizador queda en la pantalla de entrenamiento y técnica.
  const timer=document.getElementById('timerBar');
  const nav=el('nav',undefined,'bottom-nav');nav.setAttribute('aria-label','Navegación principal');
  for(const [route,label] of Object.entries({inicio:'Inicio',rutinas:'Rutinas',calendario:'Calendario',progreso:'Progreso'})){
    const link=el('a',label);link.href=`#${route}`;link.dataset.route=route;nav.append(link);
  }
  document.body.append(nav);document.body.classList.add('multi-screen');
  function refreshDashboard(){
    if(!views.inicio)return;
    const today=data.sessions.find(s=>s.date===dateKey());
    $('home-today').textContent=new Date().toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'});
    $('home-routine').textContent=today?.name || 'Elige tu entrenamiento de hoy';
    $('home-status').textContent=today?{planned:'Sesión planificada',partial:'Sesión parcial guardada',completed:'Sesión completada'}[today.status]:'Aún no hay una sesión guardada para hoy.';
    $('home-pending').hidden=!dirty;
    const last=[...data.sessions].filter(s=>s.status!=='planned').sort((a,b)=>b.date.localeCompare(a.date))[0];
    $('home-last').textContent=last?`Última sesión: ${last.date} · ${last.name}`:'Tu historial comenzará al guardar la primera sesión.';
    renderProgress();
  }
  function renderProgress(){
    const id=Number(progressSelect.value);historyList.replaceChildren();
    const sessions=data.sessions.filter(s=>s.status!=='planned'&&s.exercises.some(e=>e.id===id&&e.sets.some(row=>row.done))).sort((a,b)=>b.date.localeCompare(a.date));
    if(!sessions.length){historyList.append(el('p','Todavía no hay series realizadas para este ejercicio.'));return;}
    for(const session of sessions){
      const article=el('article',undefined,'session-exercise');article.append(el('h3',session.date));
      const exercise=session.exercises.find(e=>e.id===id);
      article.append(el('p',exercise.sets.filter(row=>row.done).map(row=>`${row.weight===''?'—':row.weight} ${row.unit} × ${row.reps===''?'—':row.reps} repeticiones`).join(' · ')));
      const open=el('button','Ver sesión');open.type='button';open.onclick=()=>{if(allowDiscard()){load(session.date);navigate('entrenar');}};article.append(open);historyList.append(article);
    }
  }
  progressSelect.onchange=renderProgress;
  $('choose-routine').onclick=()=>navigate('rutinas');
  $('home-pending').onclick=()=>navigate('entrenar');
  $('start-today').onclick=()=>{
    if(selected!==dateKey() || !dirty){if(!allowDiscard())return;load(dateKey());}
    navigate('entrenar');
  };
  function navigate(route){
    if(location.hash===`#${route}`)showRoute();else location.hash=route;
  }
  function showRoute(){
    let [route,id]=location.hash.slice(1).split('/');
    if(!views[route])route='inicio';
    if(route==='tecnica'&&(!/^\d+$/.test(id||'')||!cards[Number(id)]))route='entrenar';
    if(techniqueCard){techniqueMarker.replaceWith(techniqueCard);techniqueCard=null;techniqueMarker=null;}
    if(route==='tecnica'){
      techniqueCard=cards[Number(id)];techniqueMarker=document.createComment('ubicación del ejercicio');techniqueCard.before(techniqueMarker);techniqueHost.append(techniqueCard);
    }
    currentRoute=route;document.body.dataset.screen=route;
    for(const [key,section]of Object.entries(views))section.hidden=key!==route;
    for(const link of nav.querySelectorAll('a')){
      const active=link.dataset.route===route || (link.dataset.route==='rutinas'&&['entrenar','tecnica','catalogo'].includes(route));
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    timer.hidden=!['entrenar','tecnica'].includes(route);
    refreshDashboard();renderStep();
    const title=views[route].querySelector('h2');title.tabIndex=-1;title.focus({preventScroll:true});window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',showRoute);
  load(selected);
  updateProposal();
  showRoute();
})();
