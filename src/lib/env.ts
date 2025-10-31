const getEnv = (key: string) => {
  const value = import.meta.env[key as keyof ImportMetaEnv];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  supabaseUrl: getEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
};
