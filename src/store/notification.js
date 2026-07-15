import providerRegistry from '../services/providers/common/providerRegistry';
import utils from '../services/utils';

const defaultTimeout = 5000; // 5 sec
let nextId = 0;

export default {
  namespaced: true,
  state: {
    items: [],
  },
  mutations: {
    setItems: (state, value) => {
      state.items = value;
    },
  },
  actions: {
    showItem({ state, commit }, item) {
      const existingItem = utils.someResult(
        state.items,
        other => other.type === item.type && other.content === item.content && item,
      );
      if (existingItem) {
        return existingItem.promise;
      }

      const notificationId = nextId;
      nextId += 1;
      item.notificationId = notificationId;
      item.promise = new Promise((resolve, reject) => {
        commit('setItems', [...state.items, item]);
        const removeItem = () => commit(
          'setItems',
          state.items.filter(otherItem => otherItem.notificationId !== notificationId),
        );
        setTimeout(
          () => removeItem(),
          item.timeout || defaultTimeout,
        );
        item.resolve = (res) => {
          removeItem();
          resolve(res);
        };
        item.reject = (err) => {
          removeItem();
          reject(err);
        };
      });

      return item.promise;
    },
    info({ dispatch }, content) {
      return dispatch('showItem', {
        type: 'info',
        content,
      });
    },
    badge({ dispatch }, content) {
      return dispatch('showItem', {
        type: 'badge',
        content,
      });
    },
    confirm({ dispatch }, content) {
      return dispatch('showItem', {
        type: 'confirm',
        content,
        timeout: 10000, // 10 sec
      });
    },
    error({ dispatch, rootState }, error) {
      const item = { type: 'error' };
      if (error) {
        if (error.message) {
          item.content = error.message;
        } else if (error.status) {
          const location = rootState.queue.currentLocation;
          if (location.providerId) {
            const provider = providerRegistry.providersById[location.providerId];
            item.content = `HTTP error ${error.status} on ${provider.name} location.`;
          } else {
            item.content = `HTTP error ${error.status}.`;
          }
        } else {
          item.content = `${error}`;
        }
      }
      if (!item.content || item.content === '[object Object]') {
        item.content = 'Unknown error.';
      }
      return dispatch('showItem', item);
    },
  },
};
