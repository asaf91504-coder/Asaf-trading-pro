import {createAppleHandler} from '../../server/apple-auth.mjs';
export default request=>createAppleHandler()(request);
