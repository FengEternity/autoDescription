import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface AutoDescriptionSettings {
	apiProvider: string;
	apiKey: string;
	model: string;
	summaryLength: number;
	customPrompt: string;
}

const DEFAULT_SETTINGS: AutoDescriptionSettings = {
	apiProvider: 'kimi',
	apiKey: '',
	model: 'moonshot-v1-8k',
	summaryLength: 150,
	customPrompt: '请为以下内容生成一个简洁的摘要，不超过{length}字：'
}

export default class AutoDescriptionPlugin extends Plugin {
	settings: AutoDescriptionSettings;

	async onload() {
		await this.loadSettings();

		// 添加命令：生成摘要
		this.addCommand({
			id: 'generate-description',
			name: '生成文章摘要',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.generateDescription(editor, view);
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new AutoDescriptionSettingTab(this.app, this));
	}

	onunload() {
		// 插件卸载时的清理工作
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async generateDescription(editor: Editor, view: MarkdownView) {
		const content = editor.getValue();
		
		// 检查文档内容是否为空
		if (!content || content.trim() === '') {
			new Notice('文档内容为空，无法生成摘要');
			return;
		}
		
		// 检查API密钥是否已设置
		if (!this.settings.apiKey) {
			new Notice('请先在设置中配置API密钥');
			return;
		}
	
		new Notice('正在生成摘要...');
		
		try {
			const summary = await this.callLLMApi(content);
			
			// 在文档前面插入摘要
			this.insertSummaryToFrontMatter(editor, summary);
			
			new Notice('摘要生成成功！');
		} catch (error) {
			console.error('生成摘要时出错:', error);
			new Notice(`生成摘要失败: ${error.message}`);
		}
	}

	async callLLMApi(content: string): Promise<string> {
		const prompt = this.settings.customPrompt.replace('{length}', this.settings.summaryLength.toString());
		
		switch (this.settings.apiProvider) {
			case 'kimi':
				return this.callKimi(content, prompt);
			// 为后续扩展预留接口
			default:
				throw new Error(`不支持的API提供商: ${this.settings.apiProvider}`);
		}
	}

	async callKimi(content: string, prompt: string): Promise<string> {
		const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.apiKey}`
			},
			body: JSON.stringify({
				model: this.settings.model,
				messages: [
					{
						role: 'system',
						content: '你是一个专业的文章摘要生成助手，请根据用户提供的内容生成简洁、准确的摘要。'
					},
					{
						role: 'user',
						content: `${prompt}\n\n${content}`
					}
				],
				max_tokens: this.settings.summaryLength * 2,
				temperature: 0.3
			})
		});

		const data = await response.json();
		
		if (!response.ok) {
			throw new Error(`Kimi API错误: ${data.error?.message || '未知错误'}`);
		}
		
		return data.choices[0].message.content.trim();
	}

	async callTencent(content: string, prompt: string): Promise<string> {
		const response = await fetch('https://hunyuan.cloud.tencent.com/hyllm/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.apiKey}`
			},
			body: JSON.stringify({
				model: this.settings.model,
				messages: [
					{
						role: 'system',
						content: '你是一个专业的文章摘要生成助手，请根据用户提供的内容生成简洁、准确的摘要。'
					},
					{
						role: 'user',
						content: `${prompt}\n\n${content}`
					}
				],
				temperature: 0.3,
				stream: false,
				top_p: 0.7,
				max_tokens: this.settings.summaryLength * 2
			})
		});
	
		const data = await response.json();
		
		// 添加调试日志
		console.log('腾讯元宝API返回数据:', data);
		
		if (!response.ok) {
			throw new Error(`腾讯元宝API错误: ${data.error?.message || '未知错误'}`);
		}
		
		// 修改返回值的获取方式
		if (data.choices && data.choices[0] && data.choices[0].delta) {
			return data.choices[0].delta.content.trim();
		} else if (data.choices && data.choices[0] && data.choices[0].message) {
			return data.choices[0].message.content.trim();
		} else {
			console.error('腾讯元宝API返回数据结构:', data);
			throw new Error('腾讯元宝API返回格式异常');
		}
	}

	async callQianwen(content: string, prompt: string): Promise<string> {
		const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.apiKey}`
			},
			body: JSON.stringify({
				model: this.settings.model,
				input: {
					messages: [
						{
							role: 'system',
							content: '你是一个专业的文章摘要生成助手，请根据用户提供的内容生成简洁、准确的摘要。'
						},
						{
							role: 'user',
							content: `${prompt}\n\n${content}`
						}
					]
				},
				parameters: {
					max_tokens: this.settings.summaryLength * 2,
					temperature: 0.3
				}
			})
		});

		const data = await response.json();
		
		if (!response.ok) {
			throw new Error(`千问API错误: ${data.error?.message || '未知错误'}`);
		}
		
		return data.output.text.trim();
	}

	async callDeepseek(content: string, prompt: string): Promise<string> {
		const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.apiKey}`
			},
			body: JSON.stringify({
				model: this.settings.model,
				messages: [
					{
						role: 'system',
						content: '你是一个专业的文章摘要生成助手，请根据用户提供的内容生成简洁、准确的摘要。'
					},
					{
						role: 'user',
						content: `${prompt}\n\n${content}`
					}
				],
				max_tokens: this.settings.summaryLength * 2,
				temperature: 0.3
			})
		});

		const data = await response.json();
		
		if (!response.ok) {
			throw new Error(`DeepSeek API错误: ${data.error?.message || '未知错误'}`);
		}
		
		return data.choices[0].message.content.trim();
	}

	insertSummaryToFrontMatter(editor: Editor, summary: string) {
		const content = editor.getValue();
		let newContent = '';
		
		// 检查是否有YAML前置元数据
		if (content.startsWith('---')) {
			const endOfFrontMatter = content.indexOf('---', 3);
			if (endOfFrontMatter !== -1) {
				const frontMatter = content.substring(0, endOfFrontMatter);
				const restContent = content.substring(endOfFrontMatter);
				
				// 检查是否已有description字段
				if (frontMatter.includes('description:')) {
					// 替换现有的description
					const updatedFrontMatter = frontMatter.replace(
						/description:.*?($|\n)/,
						`description: "${summary}"\n`
					);
					newContent = updatedFrontMatter + restContent;
				} else {
					// 在前置元数据末尾添加description
					newContent = frontMatter + `description: "${summary}"\n` + restContent;
				}
			}
		} else {
			// 如果没有前置元数据，创建一个
			newContent = `---\ndescription: "${summary}"\n---\n\n${content}`;
		}
		
		editor.setValue(newContent);
	}
}

class AutoDescriptionSettingTab extends PluginSettingTab {
	plugin: AutoDescriptionPlugin;

	constructor(app: App, plugin: AutoDescriptionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// 将方法移到这里，并移除 private 关键字
	getDefaultModelForProvider(provider: string): string {
		switch (provider) {
			case 'kimi':
				return 'moonshot-v1-8k';
			// 为后续扩展预留接口
			default:
				return 'moonshot-v1-8k';
		}
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: '自动摘要设置'});

		new Setting(containerEl)
			.setName('API提供商')
			.setDesc('选择大语言模型API提供商')
			.addDropdown(dropdown => dropdown
				.addOption('kimi', 'Kimi (Moonshot)')
				// 为后续扩展预留位置
				.setValue(this.plugin.settings.apiProvider)
				.onChange(async (value) => {
					this.plugin.settings.apiProvider = value;
					this.plugin.settings.model = this.getDefaultModelForProvider(value);
					await this.plugin.saveSettings();
					this.display();
				}));

		let apiKeyDescription = '输入你的Kimi API密钥，可从 https://platform.moonshot.cn/console/api-keys 获取';
		
		new Setting(containerEl)
			.setName('API密钥')
			.setDesc(apiKeyDescription)
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('模型')
			.setDesc('选择Kimi模型')
			.addDropdown(dropdown => dropdown
				.addOption('moonshot-v1-8k', 'Moonshot V1 8K')
				.addOption('moonshot-v1-32k', 'Moonshot V1 32K')
				.addOption('moonshot-v1-128k', 'Moonshot V1 128K')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('摘要长度')
			.setDesc('设置生成摘要的最大字符数')
			.addSlider(slider => slider
				.setLimits(50, 500, 10)
				.setValue(this.plugin.settings.summaryLength)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.summaryLength = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('自定义提示词')
			.setDesc('设置生成摘要的提示词模板，使用{length}表示摘要长度')
			.addTextArea(text => text
				.setPlaceholder('请为以下内容生成一个简洁的摘要，不超过{length}字：')
				.setValue(this.plugin.settings.customPrompt)
				.onChange(async (value) => {
					this.plugin.settings.customPrompt = value;
					await this.plugin.saveSettings();
				}))
			.addExtraButton(button => {
				button
					.setIcon('reset')
					.setTooltip('重置为默认提示词')
					.onClick(async () => {
						this.plugin.settings.customPrompt = DEFAULT_SETTINGS.customPrompt;
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}
}
