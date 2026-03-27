'use client';

import { MineWebGame } from '#/engine/MineWebGame';
import type { MineWebTestController } from '#/engine/MineWebTestController';

declare global {
  interface Window {
    __minewebTestController?: MineWebTestController;
    __minewebRegressionReady?: boolean;
    __minewebRegressionError?: string;
  }
}

function handleReady(controller: MineWebTestController) {
  window.__minewebTestController = controller;
  window.__minewebRegressionReady = false;
  window.__minewebRegressionError = undefined;
}

export default function MineWebRegressionPage() {
	return (
		<MineWebGame
			style={{ width: '100vw', height: '100vh' }}
			testHarness={{
				autoStart: {
					slotId: 'mineweb-regression-page',
					name: 'Regression World',
					seed: 4242,
					scene: 'regression',
				},
				manualLoop: true,
				preserveDrawingBuffer: true,
				onReady: handleReady,
			}}
		/>
	);
}
