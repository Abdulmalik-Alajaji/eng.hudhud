/** أدوات صغيرة لبناء عناصر صفحة الإدارة (بلا innerHTML، بسبب سياسة الأمان CSP). */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/** حقل بعنوان فوقه. */
export function field(label: string, control: HTMLElement, hint?: string): HTMLLabelElement {
  const wrap = el('label', 'adm-field');
  wrap.append(el('span', 'adm-field__label', label), control);
  if (hint) wrap.append(el('span', 'adm-field__hint', hint));
  return wrap;
}

/** نص يُحفظ عند الخروج من الحقل أو Enter (لا مع كل حرف، حتى لا تُرسم الصفحة أثناء الكتابة). */
export function textInput(value: string, onCommit: (value: string) => void, options: { placeholder?: string; ltr?: boolean } = {}): HTMLInputElement {
  const input = el('input', 'adm-input');
  input.type = 'text';
  input.value = value;
  input.spellcheck = false;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.ltr) input.dir = 'ltr';
  input.addEventListener('change', () => onCommit(input.value.trim()));
  return input;
}

export function numberInput(value: number, onCommit: (value: number) => void, options: { step?: string; placeholder?: string } = {}): HTMLInputElement {
  const input = el('input', 'adm-input adm-input--number');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = options.step ?? 'any';
  input.dir = 'ltr';
  // الصفر يعني «لم يُكتب بعد» (ممر لم يُقس): الحقل فارغ.
  input.value = value === 0 ? '' : String(value);
  if (options.placeholder) input.placeholder = options.placeholder;
  input.addEventListener('change', () => {
    const number = Number(input.value.replace(',', '.'));
    onCommit(input.value.trim() === '' || !Number.isFinite(number) ? 0 : number);
  });
  return input;
}

/** رمز إنجليزي (B1-F-ST1) داخل نص عربي: معزول باتجاه من اليسار لليمين حتى لا تنقلب الأقواس والشرطات. */
export function code(text: string): HTMLElement {
  const node = el('bdi', 'adm-code', text);
  node.dir = 'ltr';
  return node;
}

export function checkbox(label: string | (string | Node)[], checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const wrap = el('label', 'adm-check');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const text = el('span');
  text.append(...(typeof label === 'string' ? [label] : label));
  wrap.append(input, text);
  return wrap;
}

export interface Option {
  value: string;
  label: string;
  group?: string;
}

export function select(options: Option[], value: string, onChange: (value: string) => void): HTMLSelectElement {
  const node = el('select', 'adm-input');
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const option of options) {
    const item = el('option', undefined, option.label);
    item.value = option.value;
    if (option.group) {
      let group = groups.get(option.group);
      if (!group) {
        group = el('optgroup');
        group.label = option.group;
        groups.set(option.group, group);
        node.append(group);
      }
      group.append(item);
    } else {
      node.append(item);
    }
  }
  node.value = value;
  node.addEventListener('change', () => onChange(node.value));
  return node;
}

/**
 * زر «اختر ملفاً» بنص عربي: حقل الملف الأصلي يكتب نصه بلغة المتصفح («Choose File»)، فنخفيه داخل الزر.
 */
export function fileButton(label: string, accept: string, onFile: (file: File) => void): HTMLLabelElement {
  const wrap = el('label', 'adm-btn adm-file');
  const input = el('input', 'adm-file__input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) onFile(file);
    input.value = '';
  });
  wrap.append(el('span', undefined, label), input);
  return wrap;
}
