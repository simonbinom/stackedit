import extensionSvc from '../services/extensionSvc';

let abcPromise;
const getAbc = () => {
  if (!abcPromise) {
    abcPromise = import(/* webpackChunkName: "abc" */ 'abcjs');
  }
  return abcPromise;
};

const render = async (elt) => {
  const content = elt.textContent;
  const { renderAbc } = await getAbc();
  if (!elt.parentNode || !elt.parentNode.parentNode) {
    return;
  }
  // Create a div element
  const divElt = document.createElement('div');
  divElt.className = 'abc-notation-block';
  // Replace the pre element with the div
  elt.parentNode.parentNode.replaceChild(divElt, elt.parentNode);
  renderAbc(divElt, content, {});
};

extensionSvc.onGetOptions((options, properties) => {
  options.abc = properties.extensions.abc.enabled;
});

extensionSvc.onSectionPreview((elt) => {
  return Promise.all(elt.querySelectorAll('.prism.language-abc')
    .cl_map(notationElt => render(notationElt)));
});
