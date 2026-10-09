/* Convert editor markup to a small, safe set of HTML elements before saving or rendering. */
const escapeText = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const allowed = new Set(['B','STRONG','U','I','EM','UL','OL','LI','P','DIV','BR','A']);
export function safeRichText(html) {
  const root = new DOMParser().parseFromString(`<div>${String(html??'').slice(0,20000)}</div>`,'text/html').body.firstElementChild;
  const walk = node => {
    if(node.nodeType===Node.TEXT_NODE)return escapeText(node.textContent);
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    const contents=[...node.childNodes].map(walk).join('');
    const tag=node.tagName;
    if(!allowed.has(tag))return contents;
    if(tag==='BR')return '<br>';
    if(tag==='A'){
      let href='';try{const url=new URL(node.getAttribute('href')||'');if(url.protocol==='https:'||url.protocol==='http:')href=url.href;}catch{}
      return href?`<a href="${escapeText(href)}" target="_blank" rel="noopener noreferrer">${contents}</a>`:contents;
    }
    const output=tag==='DIV'?'p':tag.toLowerCase();
    return `<${output}>${contents}</${output}>`;
  };
  return [...root.childNodes].map(walk).join('').slice(0,12000);
}
