import {createGoogleHandler} from '../../server/google-auth.mjs';
export default request=>createGoogleHandler()(request);
