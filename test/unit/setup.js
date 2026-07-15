import { configureCompat } from 'vue';
import './mocks/cryptoMock';
import './mocks/mutationObserverMock';

configureCompat({
  ATTR_ENUMERATED_COERCION: 'suppress-warning',
  RENDER_FUNCTION: false,
});
