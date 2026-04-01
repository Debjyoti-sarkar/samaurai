const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const resolveBaseUrl = () => {
	const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

	if (envUrl && envUrl.trim().length > 0) {
		return normalizeBaseUrl(envUrl);
	}

	return "http://172.16.21.68:3001";
};

export const BASE_URL = resolveBaseUrl();
