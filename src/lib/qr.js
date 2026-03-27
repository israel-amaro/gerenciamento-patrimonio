const absoluteUrl = (path) => {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
};

export const buildAssetQrUrl = (assetId) => absoluteUrl(`/scan/asset/${assetId}`);

export const buildBoxQrUrl = (boxId) => absoluteUrl(`/scan/box/${boxId}`);

export const buildLabQrUrl = (labId) => absoluteUrl(`/scan/lab/${labId}`);
