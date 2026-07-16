import markdownItMath from './libs/markdownItMath';
import extensionSvc from '../services/extensionSvc';

let katexPromise;
const getKatex = () => {
  if (!katexPromise) {
    katexPromise = import(/* webpackChunkName: "katex" */ 'katex')
      .then(({ default: katex }) => katex);
  }
  return katexPromise;
};

extensionSvc.onGetOptions((options, properties) => {
  options.math = properties.extensions.katex.enabled;
});

extensionSvc.onInitConverter(2, (markdown, options) => {
  if (options.math) {
    markdown.use(markdownItMath);
    markdown.renderer.rules.inline_math = (tokens, idx) =>
      `<span class="katex--inline">${markdown.utils.escapeHtml(tokens[idx].content)}</span>`;
    markdown.renderer.rules.display_math = (tokens, idx) =>
      `<span class="katex--display">${markdown.utils.escapeHtml(tokens[idx].content)}</span>`;
  }
});

extensionSvc.onSectionPreview(async (elt) => {
  const inlineElements = elt.querySelectorAll('.katex--inline');
  const displayElements = elt.querySelectorAll('.katex--display');
  if (!inlineElements.length && !displayElements.length) {
    return;
  }
  const katex = await getKatex();
  const highlighter = displayMode => (katexElt) => {
    if (katexElt.isConnected && !katexElt.highlighted) {
      try {
        katex.render(katexElt.textContent, katexElt, { displayMode });
      } catch (e) {
        katexElt.textContent = `${e.message}`;
      }
    }
    katexElt.highlighted = true;
  };
  inlineElements.cl_each(highlighter(false));
  displayElements.cl_each(highlighter(true));
});
