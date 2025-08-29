class NumelPlatform {
	static _randomId() {
		const rmax = 1000000000.0;
		const id   = Math.floor(Math.random() * rmax);
		return id;
	}

	constructor(options, subscriber) {
		this.options    = options;
		this.subscriber = subscriber;
		this.status     = {};
		this.agent      = null;
		this.agentIndex = -1;
	}

	clear() {
		this.disconnect();
		this.status = {};
	}

	async updateStatus() {
		const url = `${this.options.url}:${this.options.port}/status`;
		this.status = await fetch(url)
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP error - status: ${response.status}`);
				}
				return response.json();
			})
			.catch(error => {
				console.error("Error fetching status:", error);
				return {};
			});
		return this.status;
	}

	connect(index) {
		this.disconnect();
		const agents = this.status["agents"] ?? null;
		if (!agents || (index < 0) || (index >= agents.length)) {
			return false;
		}
		const info  = agents[index];
		const port  = info["port"];
		const url   = `${this.options.url}:${port}/agui`;
		const agent = new AGUI.HttpAgent({
			url     : url,
			headers : {
				'Access-Control-Allow-Origin': '*',
			},
		});
		if (self.subscriber) {
			agent.subscribe(subscriber);
		}
		this.agent    = agent
		this.agentIdx = index;
		return true;
	}

	disconnect() {
		if (!this.isConnected()) {
			return false;
		}
		this.agent    = null;
		this.agentIdx = -1;
		return true;
	}

	isConnected() {
		return (this.agent != null);
	}

	agentIndex() {
		return this.agentIdx;
	}

	async send(message) {
		const messageId   = `numel-msg-${_randomId()}`;
		const userMessage = {
			id      : messageId,
			role    : "user",
			content : message,
		};
		this.agent.setMessages([userMessage]);
		return await this.agent.runAgent({});
	}
};
