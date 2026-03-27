export { default } from './play/mineweb';

export const getConfig = async () =>
	({
		render: 'dynamic',
	}) as const;
