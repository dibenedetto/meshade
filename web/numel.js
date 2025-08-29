class NumelApp {

	static _randomId() {
		const rmax = 1000000000.0;
		const id   = Math.floor(Math.random() * rmax);
		return id;
	}

	static _defaultStatus() {
		const status = {
			"config" : {
				"agents" : [],
			},
		};
		return status;
	}

	static async getStatus(url) {
		const statusUrl = `${url}/status`;
		const status    = await fetch(statusUrl, {
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		}).then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error - status: ${response.status}`);
			}
			const result = response.json();
			result["error"] = null;
			return result;
		})
		.catch(error => {
			console.error("Error fetching status:", error);
			const result = NumelApp._defaultStatus();
			result["error"] = error;
			return NumelApp._defaultStatus();
		});
		return status;
	}

	static async create(url, userId, sessionId, subscriber) {
		const app = new NumelApp(url, userId, sessionId, subscriber);
		await app.update();
		if (!app.isValid()) {
			return null;
		}
		return app;
	}

	_getAgent(index) {
		if ((index == null) || (index < 0)) {
			index = this.agentIdx;
		}

		let agent = this.agents[index];
		if (agent) {
			return agent;
		}

		const configs = this.status["config"]["agents"] ?? null;
		if (!configs || (index >= configs.length)) {
			return null;
		}
		const config = configs[index];
		if (!config) {
			return null;
		}

		const info    = config;
		const baseUrl = this.url.substr(0, this.url.lastIndexOf(":"));
		const port    = info["port"];
		const url     = `${baseUrl}:${port}/agui`;

		agent = new AGUI.HttpAgent({
			name : info["name"],
			url  : url,
		});

		if (this.subscriber) {
			agent.subscribe(this.subscriber);
		}

		return agent;
	}

	constructor(url, userId, sessionId, subscriber) {
		this.url        = url;
		this.userId     = userId;
		this.sessionId  = sessionId;
		this.subscriber = subscriber;
		this.status     = null;
		this.valid      = false;
		this.agents     = null;
		this.agentIndex = -1;
	}

	isValid() {
		return this.valid;
	}

	async update() {
		this.status     = null;
		this.agents     = null;
		this.agentIndex = -1;
		this.valid      = false;
		this.status     = await NumelApp.getStatus(this.url);
		this.agents     = new Array(this.status["config"]["agents"].length);
		this.agentIndex = (this.agents.lenght > 0) ? 0 : -1;
		this.valid      = true;
		return this.status;
	}

	getDefaultAgentIndex() {
		return this.agentIdx;
	}

	setDefaultAgentIndex(index) {
		if (!this.isValid() || (index < 0) || (index >= this.status["config"]["agents"].length)) {
			return false;
		}
		this.agentIdx = index;
		return true;
	}

	async send(message, index = -1) {
		if (!this.isValid()) {
			return false;
		}
		const agent = this._getAgent(index);
		if (!agent) {
			return null;
		}
		const messageId   = `numel-message-${NumelApp._randomId()}`;
		const userMessage = {
			id      : messageId,
			role    : "user",
			content : message,
		};
		agent.setMessages([userMessage]);
		return await agent.runAgent({});
	}
};
