import { BrowserLocalStorage } from './BrowserLocalStorage';

const domainsWhitelist = [
	'http://localhost:3000',
	'http://10.14.14.157:3000',
	'https://mail.ylide.io',
	'https://frame.ylide.io',
	'https://staging.ylide.io',
	'https://otc.ylide.io',
	'https://airswap.ylide.io',
	'https://1inch.ylide.io',
	'https://paraswap.ylide.io',
	'https://hub.ylide.io',
];

const parentWindow = window.parent;

async function check() {
	if (!parentWindow) {
		throw new Error('Ylide Iframe must be loaded in iframe (apparently)');
	}

	let wasCatch = false;
	let probe;
	try {
		probe = parentWindow.location.href;
	} catch (err) {
		wasCatch = true;
	}

	if (!wasCatch && probe) {
		throw new Error('Ylide Iframe must be loaded from different origin');
	}
}

async function init() {
	check();

	const storage = new BrowserLocalStorage();
	await storage.init();

	let initedOrigin: string | null = null;

	const sendMsg = (type: string, data?: any, objectToTransfer?: Transferable | null) => {
		parentWindow!.postMessage(
			{
				type,
				data,
			},
			initedOrigin!,
			objectToTransfer ? [objectToTransfer] : [],
		);
	};

	const handleMessage = async (msg: { type: string; data: any }) => {
		if (msg.type === 'readBytes') {
			const { reqId, key } = msg.data as { reqId: string; key: string };
			const result = await storage.readBytes(key);
			sendMsg('op-done', { reqId, result }, result ? result.buffer : undefined);
		} else if (msg.type === 'clear') {
			const { reqId } = msg.data as { reqId: string };
			const result = await storage.clear();
			sendMsg('op-done', { reqId, result });
		} else if (msg.type === 'storeBytes') {
			const { reqId, key, bytes } = msg.data as { reqId: string; key: string; bytes: Uint8Array };
			const result = await storage.storeBytes(key, bytes);
			sendMsg('op-done', { reqId, result });
		}
	};

	window.onmessage = ev => {
		// console.log('irf: ', ev.origin, ev.data, ev.source === parentWindow, domainsWhitelist.includes(ev.origin));
		if (initedOrigin && ev.source === parentWindow && ev.origin === initedOrigin) {
			handleMessage(ev.data);
		} else if (ev.source === parentWindow && ev.data && ev.data.type === 'handshake-bond') {
			if (domainsWhitelist.includes(ev.origin)) {
				initedOrigin = ev.origin;
				sendMsg('handshake-success');
			} else {
				console.error(`You can't access Ylide storage from inappropriate domain (${ev.origin})`);
			}
		} else {
			// some bullshit received
		}
	};

	parentWindow!.postMessage(
		{
			type: 'handshake-start',
		},
		'*',
	);
}

init();

// Just to shut up bundler
export {};
