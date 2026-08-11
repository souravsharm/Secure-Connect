// These IDs are specific to each Gallagher instance (Configure > Card Types) —
// override via env rather than editing this file per-deployment.
export const cardTypes = {
    access: process.env.GALLAGHER_ACCESS_CARD_TYPE_ID || 695,
    msic:   process.env.GALLAGHER_MSIC_CARD_TYPE_ID || 692,
};

export const baseUrl = process.env.GALLAGHER_API_URL;