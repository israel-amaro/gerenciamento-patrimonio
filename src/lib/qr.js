const trimTrailingSlash = (value) => value?.replace(/\/+$/, "") || "";

const getConfiguredOrigin = () => {
  const envOrigin = trimTrailingSlash(import.meta.env.VITE_APP_URL);
  if (envOrigin) {
    return envOrigin;
  }

  if (typeof window !== "undefined") {
    return trimTrailingSlash(window.location.origin);
  }

  return "";
};

const isLocalUrl = (value) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?/i.test(value);

const buildAbsoluteUrl = (path) => `${getConfiguredOrigin()}${path}`;

const ensureQrUrl = (existingValue, path) => {
  if (!existingValue) {
    return buildAbsoluteUrl(path);
  }

  if (existingValue.startsWith("/")) {
    return buildAbsoluteUrl(existingValue);
  }

  if (isLocalUrl(existingValue)) {
    return buildAbsoluteUrl(path);
  }

  return existingValue;
};

export const buildAssetQrUrl = (assetId) => buildAbsoluteUrl(`/scan/asset/${assetId}`);
export const buildBoxQrUrl = (boxId) => buildAbsoluteUrl(`/scan/box/${boxId}`);
export const buildLabQrUrl = (labId) => buildAbsoluteUrl(`/scan/lab/${labId}`);

export const ensureAssetQrUrl = (existingValue, assetId) => ensureQrUrl(existingValue, `/scan/asset/${assetId}`);
export const ensureBoxQrUrl = (existingValue, boxId) => ensureQrUrl(existingValue, `/scan/box/${boxId}`);
export const ensureLabQrUrl = (existingValue, labId) => ensureQrUrl(existingValue, `/scan/lab/${labId}`);
