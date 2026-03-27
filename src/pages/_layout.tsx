import type { ReactNode } from 'react';
import '../styles.css';

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
	return (
		<div className='min-h-screen'>
			<title>MineWeb</title>
			<meta name='description' content='MineWeb - Web Minecraft Clone' />
			<meta name='viewport' content='width=device-width, initial-scale=1.0' />
			<main>{children}</main>
		</div>
	);
}

export const getConfig = async () => {
	return {
		render: 'static',
	} as const;
};
