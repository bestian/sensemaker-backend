declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
}

declare module '*.csv?raw' {
	const content: string;
	export default content;
}
