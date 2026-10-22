// UI helpers on top of cdp.mjs: find elements the way a person would
// (by label or visible text) and act through real DOM events.
import { sleep } from "./cdp.mjs";

const js = (v) => JSON.stringify(v);

export function ui(cdp) {
  const evaluate = (expr) => cdp.evaluate(expr);

  async function waitFor(expr, { timeout = 10_000, what = expr } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(`Boolean(${expr})`)) return;
      await sleep(150);
    }
    throw new Error(`Timed out waiting for: ${what}`);
  }

  const waitForText = (text, timeout) =>
    waitFor(`document.body.innerText.includes(${js(text)})`, { timeout, what: `text "${text}"` });

  async function goto(url) {
    await cdp.send("Page.navigate", { url });
    await waitFor("document.readyState === 'complete'");
    await sleep(800);
  }

  /** Fill an input/textarea by its <label> text (React-controlled safe). */
  async function fill(label, value) {
    await evaluate(`(() => {
      const el = [...document.querySelectorAll('input,textarea')].find(i => i.labels?.[0]?.textContent.trim() === ${js(label)});
      if (!el) throw new Error('No field labelled ' + ${js(label)});
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${js(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  }

  /** Click a button whose visible text matches exactly. */
  async function clickButton(text) {
    await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${js(text)} && !b.disabled)`, { what: `button "${text}"` });
    await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${js(text)} && !b.disabled).click()`);
    await sleep(300);
  }

  /** Click a <label> (radio cards, chips) or a Radix checkbox by its label text. */
  async function clickLabel(text) {
    await evaluate(`(() => {
      const labels = [...document.querySelectorAll('label')];
      const l = labels.find(x => x.textContent.trim() === ${js(text)}) || labels.find(x => x.textContent.trim().startsWith(${js(text)}));
      if (!l) throw new Error('No label ' + ${js(text)});
      const target = l.htmlFor ? document.getElementById(l.htmlFor) : null;
      (target && target.getAttribute('role') === 'checkbox' ? target : l).click();
    })()`);
    await sleep(200);
  }

  /** Radix Select: open by its label, then pick the option text. */
  async function select(label, optionText) {
    await evaluate(`(() => {
      const t = [...document.querySelectorAll('[role=combobox]')].find(b => b.labels?.[0]?.textContent.trim() === ${js(label)});
      if (!t) throw new Error('No select ' + ${js(label)});
      t.focus();
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    })()`);
    await waitFor(`document.querySelector('[role=listbox]')`);
    await evaluate(`[...document.querySelectorAll('[role=option]')].find(o => o.textContent.trim() === ${js(optionText)}).click()`);
    await sleep(300);
  }

  /** Real key presses (for sliders). */
  async function press(key, times = 1) {
    const codes = { Home: 36, End: 35, ArrowRight: 39, ArrowLeft: 37 };
    for (let i = 0; i < times; i++) {
      await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: codes[key] });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: codes[key] });
    }
    await sleep(200);
  }

  async function setSlider(label, value) {
    await evaluate(`[...document.querySelectorAll('[role=slider]')].find(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim() === ${js(label)}).focus()`);
    await press("Home");
    const now = Number(await evaluate("document.activeElement.getAttribute('aria-valuenow')"));
    await press("ArrowRight", value - now);
    const got = Number(await evaluate("document.activeElement.getAttribute('aria-valuenow')"));
    if (got !== value) throw new Error(`Slider ${label} is ${got}, wanted ${value}`);
  }

  /** Generate a SAMPLE JPEG in the page and hand it to the first gallery file input, like a picked file. */
  async function uploadSamplePhoto(caption) {
    await evaluate(`(async () => {
      const c = document.createElement('canvas'); c.width = 3000; c.height = 2250; const g = c.getContext('2d');
      g.fillStyle = '#e9ddd3'; g.fillRect(0, 0, 3000, 2250);
      g.fillStyle = '#b84c60'; g.beginPath(); g.arc(1500, 1000, 600, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a2325'; g.font = 'bold 120px Arial'; g.fillText(${js(caption)}, 300, 2050);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      const input = [...document.querySelectorAll('input[type=file]')].find(i => !i.hasAttribute('capture'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'sample.jpg', { type: 'image/jpeg' }));
      input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitForText("Photo saved", 20_000);
  }

  const text = () => evaluate("document.querySelector('main')?.innerText ?? ''");

  return { evaluate, waitFor, waitForText, goto, fill, clickButton, clickLabel, select, press, setSlider, uploadSamplePhoto, text };
}
