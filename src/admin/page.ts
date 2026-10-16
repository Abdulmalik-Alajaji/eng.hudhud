/**
 * صفحة الإدارة (admin.html): يعدّل الفريق بيانات الكلية في المتصفح، ثم يُنزّل ملفات JSON
 * ويرفعها بنفسه إلى data/ في GitHub بطلب دمج (الخيار «أ»، قرار الفريق). لا خادم ولا مفاتيح دخول:
 * الصفحة لا تكتب في أي مكان، وفحص البيانات نفسه الذي يوقف النشر يعمل هنا قبل التنزيل.
 *
 * الأقسام بروابط # (القاعدة 9): #map الخرائط، #doctors الدكاترة، #links الدرج والمصاعد والممرات، #save الحفظ.
 */
import '../styles/main.css';
import '../styles/admin.css';
import { loadDataFiles } from '../data/dataset';
import { LEVEL_NAMES, PLACE_KIND_NAMES, PLACE_KINDS, type Floor, type Place, type PlaceKind } from '../data/types';
import { ROOM_CODE } from '../data/validate';
import { createDemoBanner } from '../demo-banner';
import { containsDemo } from '../data/demo';
import { button, checkbox, code, el, field, fileButton, numberInput, select, textInput, type Option } from './dom';
import { backupText, clearDraft, download, loadDraft, parseBackup, saveDraft } from './draft';
import { createMapEditor, pixelLength, type MapState, type Mode } from './map-editor';
import {
  Editor,
  addDoctor,
  addPassage,
  addPlace,
  addVertical,
  changedFiles,
  deleteCorridor,
  deleteDoctor,
  deletePassage,
  deletePlace,
  deletePoint,
  deleteVertical,
  findPlace,
  fingerprint,
  fromFiles,
  getFloor,
  movePoint,
  placeIdPrefix,
  pointUsage,
  setCorridorLength,
  updateDoctor,
  updatePassage,
  updatePlace,
  updateVertical,
  validate,
} from './model';

type Tab = 'map' | 'doctors' | 'links' | 'save';
const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'الخرائط' },
  { id: 'doctors', label: 'الدكاترة' },
  { id: 'links', label: 'الدرج والممرات' },
  { id: 'save', label: 'الحفظ' },
];

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'select', label: 'تحديد ونقل', hint: 'انقر نقطة لتعديلها أو اسحبها لنقلها، وانقر ممراً لكتابة طوله.' },
  { id: 'point', label: 'إضافة نقاط', hint: 'انقر على الخريطة لإضافة نقطة. إن كانت نقطة محددة، تُربط بها الجديدة بممر مستقيم.' },
  { id: 'corridor', label: 'ربط بممر', hint: 'انقر نقطتين لربطهما بممر.' },
];

const ZOOMS = [1, 1.5, 2, 3, 4];
/** مسار المستودع كما يكتبه الفريق في المتصفح (نص لا رابط: الموقع لا يطلب أي موقع خارجي). */
const REPO = 'github.com/Abdulmalik-Alajaji/eng.hudhud';

export function startAdmin(root: HTMLElement, published: Record<string, unknown> = loadDataFiles()): void {
  const base = fingerprint(published);
  const draft = loadDraft();
  const editor = new Editor(draft?.data ?? fromFiles(published));
  /** المسودة بدأت من بيانات منشورة أقدم مما هو منشور الآن. */
  let staleDraft = Boolean(draft && draft.base !== base);
  let draftBase = draft?.base ?? base;
  let saveFailed = false;

  const state: MapState = {
    floorId: editor.data.floors[0]?.id ?? '',
    mode: 'select',
    selection: null,
    pending: null,
    zoom: 1,
    showLabels: false,
    localImages: new Map(),
  };
  let message = '';
  let doctorFilter = '';

  const tab = (): Tab => {
    const id = location.hash.slice(1) as Tab;
    return TABS.some((t) => t.id === id) ? id : 'map';
  };

  const header = el('header', 'adm-header');
  const main = el('main', 'adm-main');
  root.replaceChildren();
  if (containsDemo(Object.values(published))) root.append(createDemoBanner());
  root.append(header, main);

  const mapEditor = createMapEditor(editor, state, {
    onState: () => renderPanel(),
    onMessage: (text) => {
      message = text;
      renderPanel();
    },
  });
  const panel = el('section', 'adm-panel');
  panel.setAttribute('aria-live', 'polite');

  editor.onChange(() => {
    saveFailed = !saveDraft(draftBase, editor.data);
    render();
  });

  // ---------- أدوات مشتركة ----------

  const floorLabel = (floor: Floor): string => {
    const building = editor.data.buildings.find((b) => b.id === floor.building);
    return `${building?.name ?? floor.building} · ${LEVEL_NAMES[floor.level]}`;
  };

  const pointOptions = (): Option[] =>
    editor.data.floors.flatMap((f) =>
      f.points.map((p) => {
        const names = f.places.filter((place) => place.point === p.id).map((place) => place.name ?? place.id);
        return { value: p.id, label: names.length ? `${p.id} (${names.join('، ')})` : p.id, group: floorLabel(f) };
      }),
    );

  const confirmAction = (text: string): boolean => (typeof confirm === 'function' ? confirm(text) : true);

  // ---------- الرأس ----------

  const renderHeader = (): void => {
    const result = validate(editor.data);
    const changed = changedFiles(published, editor.data);
    header.replaceChildren();
    const top = el('div', 'adm-header__top');
    const titles = el('div');
    titles.append(el('h1', undefined, 'إدارة بيانات الكلية'), el('p', 'adm-muted', 'التعديلات تُحفظ في هذا المتصفح فقط، حتى تنزّل الملفات وترفعها إلى GitHub.'));
    const history = el('div', 'adm-history');
    const undo = button('تراجع', 'adm-btn', () => editor.undo());
    undo.disabled = !editor.canUndo;
    const redo = button('إعادة', 'adm-btn', () => editor.redo());
    redo.disabled = !editor.canRedo;
    history.append(undo, redo);
    top.append(titles, history);

    const status = el('a', `adm-status ${result.errors.length ? 'adm-status--error' : 'adm-status--ok'}`);
    status.href = '#save';
    status.textContent = [
      result.errors.length ? `✗ ${result.errors.length} خطأ` : '✓ البيانات سليمة',
      result.warnings.length ? `${result.warnings.length} تنبيه` : '',
      changed.length ? `${changed.length} ملف معدّل` : 'لا تعديلات',
    ]
      .filter(Boolean)
      .join(' · ');

    const nav = el('nav', 'adm-tabs');
    for (const t of TABS) {
      const link = el('a', 'adm-tabs__link', t.label);
      link.href = `#${t.id}`;
      if (t.id === tab()) link.setAttribute('aria-current', 'page');
      nav.append(link);
    }
    header.append(top, status, nav);
    if (staleDraft) header.append(staleNotice());
    if (saveFailed) header.append(el('p', 'adm-notice adm-notice--error', 'تعذّر حفظ المسودة في هذا المتصفح (التصفح الخاص؟). نزّل نسخة احتياطية من «الحفظ» حتى لا تضيع التعديلات.'));
  };

  const staleNotice = (): HTMLElement => {
    const box = el('div', 'adm-notice');
    box.append(
      el('p', undefined, 'البيانات المنشورة تغيّرت منذ بدأت هذه المسودة (دُمج تعديل آخر). إن أكملت المسودة فقد تُلغي ذلك التعديل عند رفع ملفاتك.'),
    );
    const actions = el('div', 'adm-row');
    actions.append(
      button('ابدأ من المنشور الآن', 'adm-btn adm-btn--primary', () => {
        if (!confirmAction('ستُحذف المسودة الحالية. هل نزّلت نسخة احتياطية منها إن احتجتها؟')) return;
        staleDraft = false;
        draftBase = base;
        editor.replace(fromFiles(published));
      }),
      button('أكمل المسودة', 'adm-btn', () => {
        staleDraft = false;
        render();
      }),
    );
    box.append(actions);
    return box;
  };

  // ---------- الخرائط ----------

  const renderMapTab = (): void => {
    const floor = getFloor(editor.data, state.floorId);
    const tools = el('div', 'adm-toolbar');
    tools.append(
      field(
        'الطابق',
        select(
          editor.data.floors.map((f) => ({ value: f.id, label: `${floorLabel(f)} (${f.id})` })),
          state.floorId,
          (id) => {
            state.floorId = id;
            state.selection = null;
            state.pending = null;
            render();
          },
        ),
      ),
    );
    const zoom = el('div', 'adm-row');
    const zoomIndex = ZOOMS.indexOf(state.zoom);
    const out = button('−', 'adm-btn adm-btn--icon', () => {
      state.zoom = ZOOMS[Math.max(0, zoomIndex - 1)] as number;
      render();
    });
    out.setAttribute('aria-label', 'تصغير الخريطة');
    out.disabled = zoomIndex === 0;
    const into = button('+', 'adm-btn adm-btn--icon', () => {
      state.zoom = ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)] as number;
      render();
    });
    into.setAttribute('aria-label', 'تكبير الخريطة');
    into.disabled = zoomIndex === ZOOMS.length - 1;
    zoom.append(out, el('span', 'adm-muted', `×${state.zoom}`), into, checkbox('أظهر أسماء الأماكن', state.showLabels, (on) => {
      state.showLabels = on;
      render();
    }));
    tools.append(zoom);

    const modes = el('div', 'adm-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'طريقة التعديل');
    for (const mode of MODES) {
      const b = button(mode.label, 'adm-modes__button', () => {
        state.mode = mode.id;
        state.pending = null;
        message = '';
        render();
      });
      b.setAttribute('aria-pressed', String(state.mode === mode.id));
      modes.append(b);
    }
    const hint = el('p', 'adm-muted', MODES.find((m) => m.id === state.mode)?.hint);
    if (state.mode === 'corridor' && state.pending) hint.textContent = `اختيرت ${state.pending}. انقر النقطة الثانية.`;

    const scroller = el('div', 'adm-map-scroll');
    scroller.append(mapEditor.root);
    const legend = el('p', 'adm-legend');
    legend.append(
      el('span', 'adm-legend__item adm-legend__item--point', 'نقطة'),
      el('span', 'adm-legend__item adm-legend__item--place', 'عندها مكان'),
      el('span', 'adm-legend__item adm-legend__item--missing', 'ممر بلا طول'),
    );

    const layout = el('div', 'adm-map-layout');
    const left = el('div', 'adm-map-column');
    left.append(modes, hint, scroller, legend);
    layout.append(left, panel);
    main.append(tools, layout, floorErrors(floor), floorSettings(floor));
    mapEditor.render();
    renderPanel();
  };

  const floorErrors = (floor: Floor): HTMLElement => {
    const result = validate(editor.data);
    const file = `data/floors/${floor.id}.json`;
    const errors = result.errors.filter((e) => e.startsWith(file));
    const warnings = result.warnings.filter((w) => w.startsWith(file));
    const box = el('section', 'adm-card');
    box.append(el('h2', undefined, `فحص هذا الطابق: ${errors.length ? `${errors.length} خطأ` : 'لا أخطاء'}${warnings.length ? `، ${warnings.length} تنبيه` : ''}`));
    const list = el('ul', 'adm-issues');
    for (const e of errors) list.append(el('li', 'adm-issues__error', e.slice(file.length + 2)));
    for (const w of warnings) list.append(el('li', 'adm-issues__warning', w.slice(file.length + 2)));
    if (list.childElementCount) box.append(list);
    return box;
  };

  const floorSettings = (floor: Floor): HTMLElement => {
    const box = el('details', 'adm-card');
    box.append(el('summary', undefined, 'إعدادات الطابق وصورة الخريطة'));
    const building = editor.data.buildings.find((b) => b.id === floor.building);
    if (building) {
      box.append(
        field('اسم المبنى', textInput(building.name, (name) => editor.change(() => (building.name = name)))),
        checkbox('المبنى تجريبي', building.demo, (on) => editor.change(() => (building.demo = on))),
      );
    }
    const image = fileButton('اختر صورة الخريطة', 'image/png,image/jpeg,image/webp,image/svg+xml', (file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace('jpeg', 'jpg');
        const path = `maps/${floor.id}.${ext}`;
        state.localImages.set(path, url);
        const hadPoints = floor.points.length > 0;
        editor.change(() => {
          floor.map = path;
          floor.width = img.naturalWidth;
          floor.height = img.naturalHeight;
        });
        message = `اختيرت الصورة. ارفعها إلى public/maps/ باسم ${floor.id}.${ext} (التفاصيل في «الحفظ»).${hadPoints ? ' النقاط الحالية مرسومة على الخريطة السابقة: راجع مواضعها.' : ''}`;
        renderPanel();
      };
      img.src = url;
    });
    box.append(
      imageField(image),
      field('مسار الخريطة في الموقع', textInput(floor.map ?? '', (map) => editor.change(() => (floor.map = map || null)), { ltr: true, placeholder: `maps/${floor.id}.png` })),
      field('عرض الصورة (بكسل)', numberInput(floor.width, (w) => editor.change(() => (floor.width = w)), { step: '1' })),
      field('ارتفاع الصورة (بكسل)', numberInput(floor.height, (h) => editor.change(() => (floor.height = h)), { step: '1' })),
      checkbox('بيانات هذا الطابق تجريبية', floor.demo, (on) => editor.change(() => (floor.demo = on))),
      button('ابدأ هذا الطابق من الصفر', 'adm-btn adm-btn--danger', () => {
        if (!confirmAction(`ستُحذف كل نقاط ${floor.id} وممراته وأماكنه، ويصير «حقيقياً» (غير تجريبي). يمكنك التراجع بعدها.`)) return;
        editor.change((data) => {
          for (const point of [...floor.points]) deletePoint(data, point.id);
          floor.demo = false;
        });
        state.selection = null;
      }),
    );
    return box;
  };

  /** حقل صورة الخريطة: div لا label، لأن زر اختيار الملف نفسه label. */
  const imageField = (control: HTMLElement): HTMLElement => {
    const wrap = el('div', 'adm-field');
    wrap.append(
      el('span', 'adm-field__label', 'صورة الخريطة من جهازك'),
      control,
      el('span', 'adm-field__hint', 'تُعرض هنا فقط، وتُرفع إلى GitHub مع الملفات. الإحداثيات بالبكسل على هذه الصورة.'),
    );
    return wrap;
  };

  const renderPanel = (): void => {
    panel.replaceChildren();
    if (message) panel.append(el('p', 'adm-message', message));
    const selection = state.selection;
    if (!selection) {
      panel.append(el('p', 'adm-muted', 'لا شيء محدد. انقر نقطة أو ممراً على الخريطة.'));
      return;
    }
    if (selection.type === 'corridor') {
      corridorPanel(selection.from, selection.to);
      return;
    }
    const floor = getFloor(editor.data, state.floorId);
    const point = floor.points.find((p) => p.id === selection.id);
    if (!point) {
      state.selection = null;
      panel.append(el('p', 'adm-muted', 'لا شيء محدد.'));
      return;
    }
    panel.append(el('h2', undefined, `النقطة ${point.id}`));
    const coords = el('div', 'adm-row');
    coords.append(
      field('x', numberInput(point.x, (x) => editor.change((d) => movePoint(d, point.id, x, point.y)), { step: '1' })),
      field('y', numberInput(point.y, (y) => editor.change((d) => movePoint(d, point.id, point.x, y)), { step: '1' })),
    );
    panel.append(coords);

    // الممرات
    const corridors = floor.corridors.filter((c) => c.from === point.id || c.to === point.id);
    panel.append(el('h3', undefined, `الممرات (${corridors.length})`));
    for (const c of corridors) {
      const other = c.from === point.id ? c.to : c.from;
      const row = el('div', `adm-item ${c.length_m > 0 ? '' : 'adm-item--missing'}`);
      row.append(
        field(`إلى ${other}`, numberInput(c.length_m, (m) => editor.change((d) => setCorridorLength(d, c.from, c.to, m)), { placeholder: 'الطول المقاس' }), `بالأمتار. على الخريطة ${pixelLength(editor.data, c.from, c.to)} بكسل.`),
        button('احذف', 'adm-btn adm-btn--danger', () => editor.change((d) => deleteCorridor(d, c.from, c.to))),
      );
      panel.append(row);
    }
    const passages = editor.data.passages.filter((p) => p.from === point.id || p.to === point.id);
    for (const p of passages) panel.append(el('p', 'adm-muted', `يبدأ أو ينتهي هنا: ${p.name || p.id} (يُعدَّل في «الدرج والممرات»).`));

    // الأماكن
    const places = floor.places.filter((p) => p.point === point.id);
    panel.append(el('h3', undefined, `الأماكن عند هذه النقطة (${places.length})`));
    for (const place of places) panel.append(placeEditor(floor, place));
    panel.append(newPlaceForm(floor, point.id));

    const usage = pointUsage(editor.data, point.id);
    panel.append(
      button('احذف النقطة', 'adm-btn adm-btn--danger', () => {
        const parts = [
          usage.corridors ? `${usage.corridors} ممر` : '',
          usage.places.length ? `الأماكن: ${usage.places.map((p) => p.id).join('، ')}` : '',
          usage.passages.length ? `الممر بين الطوابق: ${usage.passages.map((p) => p.id).join('، ')}` : '',
        ].filter(Boolean);
        if (parts.length && !confirmAction(`سيُحذف معها: ${parts.join('؛ ')}. يمكنك التراجع بعدها.`)) return;
        state.selection = null;
        editor.change((d) => deletePoint(d, point.id));
      }),
    );
  };

  const corridorPanel = (from: string, to: string): void => {
    const floor = getFloor(editor.data, state.floorId);
    const corridor = floor.corridors.find((c) => (c.from === from && c.to === to) || (c.from === to && c.to === from));
    if (!corridor) {
      state.selection = null;
      panel.append(el('p', 'adm-muted', 'لا شيء محدد.'));
      return;
    }
    panel.append(el('h2', undefined, `ممر ${corridor.from} ← ${corridor.to}`));
    const length = numberInput(corridor.length_m, (m) => editor.change((d) => setCorridorLength(d, corridor.from, corridor.to, m)), { placeholder: 'الطول المقاس' });
    panel.append(
      field('الطول بالأمتار (من قياس الفريق)', length, `على الخريطة ${pixelLength(editor.data, corridor.from, corridor.to)} بكسل. البكسل لا يُغني عن القياس.`),
      button('احذف الممر', 'adm-btn adm-btn--danger', () => {
        state.selection = null;
        editor.change((d) => deleteCorridor(d, corridor.from, corridor.to));
      }),
    );
    if (corridor.length_m <= 0) queueMicrotask(() => length.focus({ preventScroll: true }));
  };

  const kindOptions = (): Option[] => PLACE_KINDS.map((k) => ({ value: k, label: PLACE_KIND_NAMES[k] }));

  const placeIdHint = (floor: Floor, kind: PlaceKind): string =>
    ['room', 'lab', 'office'].includes(kind) ? `رمز الجامعة، مثل ${floor.id}215` : `الطابق ثم شرطة ثم اسم قصير بحروف إنجليزية، مثل ${floor.id}-WC1`;

  const placeEditor = (floor: Floor, place: Place): HTMLElement => {
    const card = el('div', 'adm-item adm-item--place');
    const set = (patch: Partial<Place>): void => editor.change((d) => updatePlace(d, place.id, patch));
    card.append(
      field('النوع', select(kindOptions(), place.kind, (kind) => set({ kind: kind as PlaceKind }))),
      field('المعرّف', textInput(place.id, (id) => {
        if (!id || id === place.id) return;
        if (findPlace(editor.data, id)) {
          message = `المعرّف «${id}» مستخدم لمكان آخر.`;
          renderPanel();
          return;
        }
        set({ id });
      }, { ltr: true }), placeIdHint(floor, place.kind)),
      field('الاسم', textInput(place.name ?? '', (name) => set({ name: name || undefined }), { placeholder: ['room', 'lab', 'office'].includes(place.kind) ? 'اختياري للقاعات' : 'مطلوب' })),
      checkbox('معلم (يظهر في قائمة المعالم)', Boolean(place.landmark), (on) => set({ landmark: on || undefined })),
      checkbox('تجريبي', place.demo, (on) => set({ demo: on })),
      button('احذف المكان', 'adm-btn adm-btn--danger', () => editor.change((d) => deletePlace(d, place.id))),
    );
    return card;
  };

  const newPlaceForm = (floor: Floor, pointId: string): HTMLElement => {
    const box = el('details', 'adm-item');
    box.append(el('summary', undefined, 'أضف مكاناً هنا'));
    let kind: PlaceKind = 'room';
    const id = el('input', 'adm-input');
    id.dir = 'ltr';
    id.value = placeIdPrefix(floor, kind);
    const name = el('input', 'adm-input');
    const hint = el('span', 'adm-field__hint', placeIdHint(floor, kind));
    const kindSelect = select(kindOptions(), kind, (value) => {
      const prefix = placeIdPrefix(floor, kind);
      kind = value as PlaceKind;
      if (id.value === prefix) id.value = placeIdPrefix(floor, kind);
      hint.textContent = placeIdHint(floor, kind);
    });
    const idField = field('المعرّف', id);
    idField.append(hint);
    box.append(
      field('النوع', kindSelect),
      idField,
      field('الاسم', name),
      button('أضف', 'adm-btn adm-btn--primary', () => {
        const value = id.value.trim();
        if (!value || value === placeIdPrefix(floor, kind)) {
          message = 'اكتب المعرّف كاملاً.';
        } else if (findPlace(editor.data, value)) {
          message = `المعرّف «${value}» مستخدم لمكان آخر.`;
        } else if (['room', 'lab', 'office'].includes(kind) && !ROOM_CODE.test(value)) {
          message = `الرمز «${value}» ليس بنمط الجامعة (مثل ${floor.id}215).`;
        } else {
          message = '';
          editor.change((d) => addPlace(d, floor.id, { id: value, kind, name: name.value.trim() || undefined, point: pointId }));
          return;
        }
        renderPanel();
      }),
    );
    return box;
  };

  // ---------- الدكاترة ----------

  const renderDoctorsTab = (): void => {
    const offices: Option[] = editor.data.floors.flatMap((f) =>
      f.places.filter((p) => p.kind === 'office').map((p) => ({ value: p.id, label: p.name ? `${p.id} (${p.name})` : p.id, group: floorLabel(f) })),
    );
    const card = el('section', 'adm-card');
    card.append(el('h2', undefined, `الدكاترة (${editor.data.doctors.length})`));
    const filter = el('input', 'adm-input');
    filter.type = 'search';
    filter.placeholder = 'ابحث بالاسم أو المكتب';
    filter.value = doctorFilter;
    const list = el('div', 'adm-list');
    const draw = (): void => {
      list.replaceChildren();
      const q = doctorFilter.trim();
      for (const doctor of editor.data.doctors) {
        if (q && !doctor.name.includes(q) && !doctor.office.includes(q.toUpperCase())) continue;
        const row = el('div', 'adm-item adm-item--doctor');
        row.append(
          field('الاسم', textInput(doctor.name, (name) => editor.change((d) => updateDoctor(d, doctor.id, { name })), { placeholder: 'مثل: د. ...' })),
          field('المكتب', select(offices, doctor.office, (office) => editor.change((d) => updateDoctor(d, doctor.id, { office })))),
          checkbox('تجريبي', doctor.demo, (on) => editor.change((d) => updateDoctor(d, doctor.id, { demo: on }))),
          button('احذف', 'adm-btn adm-btn--danger', () => {
            if (confirmAction(`حذف ${doctor.name || doctor.id}؟`)) editor.change((d) => deleteDoctor(d, doctor.id));
          }),
        );
        list.append(row);
      }
    };
    filter.addEventListener('input', () => {
      doctorFilter = filter.value;
      draw();
    });
    const add = button('أضف دكتوراً', 'adm-btn adm-btn--primary', () => {
      const office = offices[0]?.value;
      if (!office) {
        message = 'لا يوجد أي مكتب (نوع «مكتب») في الخرائط بعد.';
        render();
        return;
      }
      doctorFilter = '';
      editor.change((d) => addDoctor(d, office));
    });
    card.append(filter, list, add);
    if (!offices.length) card.append(el('p', 'adm-muted', 'أضف المكاتب أولاً من «الخرائط» (مكان من نوع «مكتب»).'));
    main.append(card);
    draw();
  };

  // ---------- الدرج والمصاعد والممرات بين الطوابق ----------

  const renderLinksTab = (): void => {
    const vertical = el('section', 'adm-card');
    vertical.append(
      el('h2', undefined, 'الدرج والمصاعد'),
      el('p', 'adm-muted', 'لكل درج أو مصعد: اختر مكانه في كل طابق يقف عنده. الأماكن نفسها تُضاف من «الخرائط» بنوع «درج» أو «مصعد».'),
    );
    for (const link of editor.data.vertical) {
      const card = el('div', 'adm-item');
      card.append(el('h3', undefined, `${link.kind === 'stairs' ? 'درج' : 'مصعد'} ${link.id}`));
      const stops = el('div', 'adm-stops');
      for (const floor of editor.data.floors) {
        for (const place of floor.places.filter((p) => p.kind === link.kind)) {
          stops.append(
            checkbox([`${floorLabel(floor)}: ${place.name ?? place.id} `, code(place.id)], link.stops.includes(place.id), (on) =>
              editor.change((d) =>
                updateVertical(d, link.id, {
                  stops: on ? [...link.stops, place.id] : link.stops.filter((s) => s !== place.id),
                }),
              ),
            ),
          );
        }
      }
      card.append(
        stops,
        checkbox('تجريبي', link.demo, (on) => editor.change((d) => updateVertical(d, link.id, { demo: on }))),
        button('احذف', 'adm-btn adm-btn--danger', () => {
          if (confirmAction(`حذف ${link.id}؟`)) editor.change((d) => deleteVertical(d, link.id));
        }),
      );
      vertical.append(card);
    }
    const addVerticalForm = el('div', 'adm-item adm-row');
    let kind: 'stairs' | 'elevator' = 'stairs';
    const id = el('input', 'adm-input');
    id.dir = 'ltr';
    id.placeholder = 'مثل B1-ST4';
    addVerticalForm.append(
      field('النوع', select([{ value: 'stairs', label: 'درج' }, { value: 'elevator', label: 'مصعد' }], kind, (v) => (kind = v as typeof kind))),
      field('المعرّف', id),
      button('أضف', 'adm-btn adm-btn--primary', () => {
        const result = editor.change((d) => addVertical(d, id.value.trim(), kind));
        if (typeof result === 'string') {
          editor.undo();
          message = result;
          render();
        }
      }),
    );
    vertical.append(addVerticalForm);

    const passages = el('section', 'adm-card');
    passages.append(el('h2', undefined, 'الممرات بين المبنيين (أو بين خريطتين)'));
    const points = pointOptions();
    for (const passage of editor.data.passages) {
      const card = el('div', `adm-item ${passage.length_m > 0 ? '' : 'adm-item--missing'}`);
      const set = (patch: Partial<typeof passage>): void => editor.change((d) => updatePassage(d, passage.id, patch));
      card.append(
        el('h3', undefined, passage.id),
        field('الاسم (يظهر للطالب)', textInput(passage.name, (name) => set({ name }), { placeholder: 'مثل: الممر بين المبنيين في الطابق الأرضي' })),
        field('من النقطة', select(points, passage.from, (from) => set({ from }))),
        field('إلى النقطة', select(points, passage.to, (to) => set({ to }))),
        field('الطول بالأمتار', numberInput(passage.length_m, (length_m) => set({ length_m }), { placeholder: 'الطول المقاس' })),
        checkbox('تجريبي', passage.demo, (demo) => set({ demo })),
        button('احذف', 'adm-btn adm-btn--danger', () => {
          if (confirmAction(`حذف ${passage.id}؟`)) editor.change((d) => deletePassage(d, passage.id));
        }),
      );
      passages.append(card);
    }
    const addPassageForm = el('div', 'adm-item adm-row');
    const passageId = el('input', 'adm-input');
    passageId.dir = 'ltr';
    passageId.placeholder = 'مثل B2-B1-G';
    addPassageForm.append(
      field('المعرّف', passageId),
      button('أضف', 'adm-btn adm-btn--primary', () => {
        const first = points[0]?.value ?? '';
        const result = editor.change((d) => addPassage(d, passageId.value.trim(), first, first));
        if (typeof result === 'string') {
          editor.undo();
          message = result;
          render();
        }
      }),
    );
    passages.append(addPassageForm);
    if (message) main.append(el('p', 'adm-message', message));
    main.append(vertical, passages);
  };

  // ---------- الحفظ ----------

  const renderSaveTab = (): void => {
    const result = validate(editor.data);
    const changed = changedFiles(published, editor.data);

    const check = el('section', 'adm-card');
    check.append(el('h2', undefined, result.errors.length ? `1. أصلح الأخطاء (${result.errors.length})` : '1. الفحص: البيانات سليمة ✓'));
    if (result.errors.length) {
      check.append(el('p', 'adm-muted', 'هذا الفحص نفسه يوقف نشر الموقع، فلا تُنزَّل الملفات حتى تُصلح الأخطاء.'));
      const list = el('ul', 'adm-issues');
      for (const e of result.errors) list.append(el('li', 'adm-issues__error', e));
      check.append(list);
    }
    if (result.warnings.length) {
      check.append(el('h3', undefined, `تنبيهات (${result.warnings.length}): لا توقف النشر، لكن راجعها`));
      const list = el('ul', 'adm-issues');
      for (const w of result.warnings) list.append(el('li', 'adm-issues__warning', w));
      check.append(list);
    }

    const files = el('section', 'adm-card');
    files.append(el('h2', undefined, `2. نزّل الملفات المعدّلة (${changed.length})`));
    if (!changed.length) files.append(el('p', 'adm-muted', 'لا تعديلات على البيانات المنشورة.'));
    const list = el('ul', 'adm-files');
    for (const file of changed) {
      const item = el('li');
      const get = button(`نزّل ${file.name}`, 'adm-btn', () => download(file.name, file.text));
      get.disabled = result.errors.length > 0;
      item.append(el('code', undefined, file.path), get);
      list.append(item);
    }
    files.append(list);
    if (changed.length > 1) {
      const all = button('نزّل كل الملفات', 'adm-btn adm-btn--primary', () => {
        changed.forEach((file, i) => setTimeout(() => download(file.name, file.text), i * 400));
      });
      all.disabled = result.errors.length > 0;
      files.append(all, el('p', 'adm-muted', 'قد يسألك المتصفح مرة واحدة: «السماح بتنزيل عدة ملفات؟» فاختر «السماح».'));
    }
    const images = editor.data.floors.filter((f) => f.map && state.localImages.has(f.map));
    for (const floor of images) {
      files.append(el('p', 'adm-notice', `صورة خريطة جديدة لـ ${floor.id}: ارفع الصورة التي اخترتها إلى المجلد public/maps/ وسمّها ${floor.map?.replace('maps/', '')}.`));
    }

    const steps = el('section', 'adm-card');
    steps.append(el('h2', undefined, '3. ارفع الملفات إلى GitHub'));
    const folders = [...new Set(changed.map((f) => f.path.slice(0, f.path.lastIndexOf('/'))))];
    if (images.length) folders.push('public/maps');
    steps.append(uploadSteps(folders.length ? folders : ['data']));
    const backup = el('section', 'adm-card');
    backup.append(
      el('h2', undefined, 'نسخة احتياطية'),
      el('p', 'adm-muted', 'المسودة محفوظة في هذا المتصفح فقط. لنقلها إلى جهاز آخر أو لعضو آخر في الفريق: نزّل نسخة احتياطية ثم استوردها هناك.'),
    );
    const importInput = fileButton('استورد نسخة احتياطية', 'application/json,.json', async (file) => {
      const parsed = parseBackup(await file.text());
      if (!parsed) {
        message = 'الملف ليس نسخة احتياطية من هذه الصفحة.';
        render();
        return;
      }
      draftBase = parsed.base;
      staleDraft = parsed.base !== base;
      message = 'استُوردت النسخة الاحتياطية.';
      editor.replace(parsed.data);
    });
    const backupRow = el('div', 'adm-row');
    backupRow.append(
      button('نزّل نسخة احتياطية', 'adm-btn', () => download(`hudhud-admin-${new Date().toISOString().slice(0, 10)}.json`, backupText(draftBase, editor.data))),
      importInput,
    );
    backup.append(backupRow);

    const reset = el('section', 'adm-card');
    reset.append(
      el('h2', undefined, 'البدء من جديد'),
      button('ارجع إلى البيانات المنشورة', 'adm-btn adm-btn--danger', () => {
        if (!confirmAction('ستُلغى كل التعديلات في هذا المتصفح. يمكنك التراجع بعدها ما دامت الصفحة مفتوحة.')) return;
        draftBase = base;
        staleDraft = false;
        editor.replace(fromFiles(published));
        clearDraft();
      }),
    );

    if (message) main.append(el('p', 'adm-message', message));
    main.append(check, files, steps, backup, reset);
  };

  /**
   * خطوات الرفع للفريق (مبتدئ في GitHub). كل رفع في GitHub يخص مجلداً واحداً، فإن تغيّرت ملفات
   * في أكثر من مجلد يُرفع الأول في فرع جديد بطلب دمج، ثم تُرفع البقية إلى الفرع نفسه، فيُفحص الكل معاً.
   */
  const uploadSteps = (folders: string[]): HTMLOListElement => {
    const ol = el('ol', 'adm-steps');
    const step = (...parts: (string | HTMLElement)[]): void => {
      const li = el('li');
      li.append(...parts);
      ol.append(li);
    };
    const [first, ...rest] = folders as [string, ...string[]];
    step('افتح صفحة المشروع على GitHub: ', code(REPO));
    step('افتح المجلد ', code(first), ' (اضغط اسم كل جزء منه في قائمة الملفات)، ثم اضغط «Add file» أعلى القائمة، ثم «Upload files».');
    step('اسحب إلى الصفحة الملفات التي نزّلتها لهذا المجلد بأسمائها كما هي: الملف بالاسم نفسه يحل محل القديم.');
    step('أسفل الصفحة اختر «Create a new branch for this commit and start a pull request»، ثم اضغط «Propose changes»، ثم «Create pull request».');
    for (const folder of rest) {
      step(
        'في صفحة طلب الدمج اضغط اسم الفرع الجديد (يظهر أعلى الصفحة بعد «from»، مثل patch-1)، ثم افتح المجلد ',
        code(folder),
        ' واضغط «Add file» ثم «Upload files»، واسحب ملفاته.',
      );
      step('أسفل الصفحة اختر «Commit directly to the … branch» (الفرع نفسه)، ثم اضغط «Commit changes». يُضاف الرفع إلى طلب الدمج نفسه.');
    }
    step('افتح طلب الدمج (تبويب «Pull requests») وانتظر دقيقة أو دقيقتين: GitHub يشغّل الفحص نفسه. إن ظهرت علامة ✓ خضراء فاضغط «Merge pull request» ثم «Confirm merge»، وتظهر البيانات في الموقع بعد دقائق.');
    step('بعد الدمج ارجع إلى هذه الصفحة واضغط «ابدأ من المنشور الآن» إن ظهر، أو «ارجع إلى البيانات المنشورة» أدناه.');
    return ol;
  };

  // ---------- الرسم ----------

  const render = (): void => {
    renderHeader();
    main.replaceChildren();
    const current = tab();
    if (current === 'map') renderMapTab();
    else if (current === 'doctors') renderDoctorsTab();
    else if (current === 'links') renderLinksTab();
    else renderSaveTab();
  };

  window.addEventListener('hashchange', () => {
    message = '';
    render();
  });
  document.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
    } else if (event.key === 'Escape') {
      state.pending = null;
      state.selection = null;
      render();
    }
  });
  render();
}
