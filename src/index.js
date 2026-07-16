import { createApp } from 'vue';
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { Workbox } from 'workbox-window';
import './extensions';
import './services/optional';
import installIcons from './icons';
import installVueGlobals from './components/common/vueGlobals';
import App from './components/App';
import store from './store';
import localDbSvc from './services/localDbSvc';

if (!window.indexedDB) {
  throw new Error('Your browser is not supported. Please upgrade to the latest version.');
}

if (NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  const workbox = new Workbox('/sw.js');
  let pendingUpdate = false;

  workbox.addEventListener('waiting', () => {
    pendingUpdate = true;
    workbox.messageSkipWaiting();
  });
  workbox.addEventListener('controlling', async () => {
    if (!pendingUpdate) {
      return;
    }
    if (!store.state.light) {
      await localDbSvc.sync();
      localStorage.updated = true;
      // Reload the webpage to load into the new version
      window.location.reload();
    }
  });
  workbox.register();
}

if (localStorage.updated) {
  store.dispatch('notification/info', 'StackEdit has just updated itself!');
  setTimeout(() => localStorage.removeItem('updated'), 2000);
}

if (!localStorage.installPrompted) {
  window.addEventListener('beforeinstallprompt', async (promptEvent) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    promptEvent.preventDefault();

    try {
      await store.dispatch('notification/confirm', 'Add StackEdit to your home screen?');
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (err) {
      // Cancel
    }
    localStorage.installPrompted = true;
  });
}

createApp(App)
  .use(store)
  .use(installIcons)
  .use(installVueGlobals)
  .mount('#app');
