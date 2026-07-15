import Clipboard from 'clipboard';
import timeSvc from '../../services/timeSvc';
import store from '../../store';

export const formatTime = time =>
  // Access the time counter for reactive refresh
  timeSvc.format(time, store.state.timeCounter);

const setElTitle = (el, title) => {
  el.title = title;
  el.setAttribute('aria-label', title);
};

const createClipboard = (el, value) => {
  el.seClipboard = new Clipboard(el, { text: () => value });
};

const destroyClipboard = (el) => {
  if (el.seClipboard) {
    el.seClipboard.destroy();
    el.seClipboard = null;
  }
};

export default (app) => {
  app.config.globalProperties.$formatTime = formatTime;

  app.directive('focus', {
    mounted(el) {
      el.focus();
      const { value } = el;
      if (value && el.setSelectionRange) {
        el.setSelectionRange(0, value.length);
      }
    },
  });

  app.directive('title', {
    beforeMount(el, { value }) {
      setElTitle(el, value);
    },
    updated(el, { value, oldValue }) {
      if (value !== oldValue) {
        setElTitle(el, value);
      }
    },
  });

  app.directive('clipboard', {
    beforeMount(el, { value }) {
      createClipboard(el, value);
    },
    updated(el, { value, oldValue }) {
      if (value !== oldValue) {
        destroyClipboard(el);
        createClipboard(el, value);
      }
    },
    unmounted(el) {
      destroyClipboard(el);
    },
  });
};
