// Keep existing account sessions when the same localhost origin switches to the local stack.
const scope = import.meta.env.VITE_DIGIWMS_LOCAL_DEV === 'true' ? 'digiwms_dev' : 'digiwms';
export const userStorageKey = `${scope}_user`;
export const tokenStorageKey = `${scope}_token`;
