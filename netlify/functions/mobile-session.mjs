import {createMobileSessionHandler} from '../../server/mobile-session.mjs';
export default request=>createMobileSessionHandler()(request);
