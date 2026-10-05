// remark plugin: prefixes root-relative links with the base path, and
// replaces {{token}} in docs Markdown with values from
// src/site.config.ts (through src/lib/ph.ts).  In prose an unset token
// becomes a highlighted placeholder chip; in code it becomes [TOKEN] text.
import { visit } from 'unist-util-visit';
import { text, html, tokens } from './ph.ts';
import { url } from './base.mjs';

// A set value is plain text; only an unset one needs HTML (the chip).
const toNode = (m) =>
  !(m[1] in tokens) ? { type: 'text', value: m[0] }
  : tokens[m[1]] != null ? { type: 'text', value: tokens[m[1]] }
  : { type: 'html', value: html(m[1]) };

const RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g;
// Unknown tokens (e.g. {{x}} inside a synced design doc) are left untouched.
const known = (m, k, f) => (k in tokens ? f(k) : m);

export default function remarkPlaceholders() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (node.type === 'code' || node.type === 'inlineCode') {
        node.value = node.value.replace(RE, (m, k) => known(m, k, text));
        return;
      }
      if (node.type === 'link') {
        // Root-relative links need the base path the site is served under.
        node.url = url(node.url.replace(RE, (m, k) => known(m, k, text)));
        return;
      }
      if (node.type !== 'text' || !parent || !RE.test(node.value)) return;
      RE.lastIndex = 0;
      // Split the text node so placeholders can carry HTML.
      const parts = [];
      let last = 0;
      for (const m of node.value.matchAll(RE)) {
        if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
        parts.push(toNode(m));
        last = m.index + m[0].length;
      }
      if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return index + parts.length;
    });
  };
}
