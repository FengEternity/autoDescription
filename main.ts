import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface AutoDescriptionSettings {
	apiProvider: string;
	apiKey: string;
	model: string;
	summaryLength: number;
	customPrompt: string;
	availableCategories: string[]; // 只保留分类列表
}

let DEFAULT_SETTINGS: AutoDescriptionSettings = {
	apiProvider: 'kimi',
	apiKey: '',
	model: 'moonshot-v1-8k',
	summaryLength: 150,
	customPrompt: '请为以下内容生成一个简洁的摘要，不超过{length}字：',
	availableCategories: ['Blog', 'C++', 'Git', 'linux', '开源项目', '数据库', '算法', '计算机体系结构']
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
		
		if (!content || content.trim() === '') {
			new Notice('文档内容为空，无法生成摘要');
			return;
		}
		
		if (!this.settings.apiKey) {
			new Notice('请先在设置中配置API密钥');
			return;
		}
	
		new Notice('正在生成摘要和标签...');
		
		try {
			const { summary, tags } = await this.callLLMApi(content);
			
			// 在文档前面插入摘要和标签
			await this.insertSummaryToFrontMatter(editor, summary, tags);
			
			new Notice('摘要和标签生成成功！');
		} catch (error) {
			console.error('生成时出错:', error);
			new Notice(`生成失败: ${error.message}`);
		}
	}

	async callLLMApi(content: string): Promise<{ summary: string; tags: string[] }> {
		const summaryPrompt = this.settings.customPrompt.replace('{length}', this.settings.summaryLength.toString());
		const tagsPrompt = `请分析文章内容，生成3-5个最相关的标签，每个标签限制在1-4个字之间。请直接返回标签，用逗号分隔。`;
		
		switch (this.settings.apiProvider) {
			case 'kimi':
				const summary = await this.callKimi(content, summaryPrompt);
				const tagsResponse = await this.callKimi(content, tagsPrompt);
				const tags = tagsResponse
					.split(/[,，、\n]/)
					.map(tag => tag.trim())
					.filter(tag => tag.length > 0);
				return { summary, tags };
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

	async insertSummaryToFrontMatter(editor: Editor, summary: string, tags: string[]) {
		const content = editor.getValue();
		let newContent = '';
		
		// 只弹出分类选择对话框
		const selectedCategories = await this.showCategorySelector();
		
		if (content.startsWith('---')) {
			const endOfFrontMatter = content.indexOf('---', 3);
			if (endOfFrontMatter !== -1) {
				const frontMatter = content.substring(0, endOfFrontMatter);
				const restContent = content.substring(endOfFrontMatter);
				
				let updatedFrontMatter = frontMatter;
				
				// 更新 description
				if (frontMatter.includes('description:')) {
					updatedFrontMatter = updatedFrontMatter.replace(
						/description:.*?($|\n)/,
						`description: "${summary}"\n`
					);
				} else {
					updatedFrontMatter += `description: "${summary}"\n`;
				}
				
				// 更新 tags
				if (tags.length > 0) {
					if (frontMatter.includes('tags:')) {
						updatedFrontMatter = updatedFrontMatter.replace(
							/tags:[\s\S]*?(?=\n\w|$)/,
							`tags:\n${tags.map(tag => `  - ${tag}`).join('\n')}`
						);
					} else {
						updatedFrontMatter += `tags:\n${tags.map(tag => `  - ${tag}`).join('\n')}\n`;
					}
				}
				
				// 更新 categories
				if (selectedCategories.length > 0) {
					if (frontMatter.includes('categories:')) {
						updatedFrontMatter = updatedFrontMatter.replace(
							/categories:[\s\S]*?(?=\n\w|$)/,
							`categories:\n${selectedCategories.map(category => `  - ${category}`).join('\n')}`
						);
					} else {
						updatedFrontMatter += `categories:\n${selectedCategories.map(category => `  - ${category}`).join('\n')}\n`;
					}
				}
				
				newContent = updatedFrontMatter + restContent;
			}
		} else {
			// 创建新的 Front Matter
			newContent = '---\n' +
				`description: "${summary}"\n` +
				(tags.length > 0 ? `tags:\n${tags.map(tag => `  - ${tag}`).join('\n')}\n` : '') +
				(selectedCategories.length > 0 ? `categories:\n${selectedCategories.map(category => `  - ${category}`).join('\n')}\n` : '') +
				'---\n\n' + content;
		}
		
		editor.setValue(newContent);
	}

	// 添加选择器对话框
	async showTagSelector(): Promise<string[]> {
		return new Promise((resolve) => {
			const modal = new TagSelectorModal(this.app, this.settings.availableTags, resolve);
			modal.open();
		});
	}

	async showCategorySelector(): Promise<string[]> {
		return new Promise((resolve) => {
			const modal = new CategorySelectorModal(this.app, this.settings.availableCategories, resolve);
			modal.open();
		});
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

		// 删除这段代码
		// new Setting(containerEl)
		//     .setName('可选标签')
		//     .setDesc('设置可选的文章标签（每行一个）')
		//     .addTextArea(text => text
		//         .setPlaceholder('技术\n教程\n笔记')
		//         .setValue(this.plugin.settings.availableTags.join('\n'))
		//         .onChange(async (value) => {
		//             this.plugin.settings.availableTags = value.split('\n').filter(tag => tag.trim() !== '');
		//             await this.plugin.saveSettings();
		//         }));

		new Setting(containerEl)
			.setName('可选分类')
			.setDesc('设置可选的文章分类（每行一个）')
			.addTextArea(text => text
				.setPlaceholder('编程\n学习\n工具')
				.setValue(this.plugin.settings.availableCategories.join('\n'))
				.onChange(async (value) => {
					this.plugin.settings.availableCategories = value.split('\n').filter(category => category.trim() !== '');
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

// 添加这两个类的完整实现
class TagSelectorModal extends Modal {
    private selectedTags: string[] = [];
    private availableTags: string[];
    private onSubmit: (tags: string[]) => void;

    constructor(app: App, availableTags: string[], onSubmit: (tags: string[]) => void) {
        super(app);
        this.availableTags = availableTags;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.createEl('h2', {text: '选择标签（可多选）'});

        const container = contentEl.createDiv({cls: 'tag-container'});
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';
        container.style.marginBottom = '20px';
        
        this.availableTags.forEach(tag => {
            const checkboxContainer = container.createDiv({cls: 'checkbox-container'});
            checkboxContainer.style.marginBottom = '8px';
            
            const input = checkboxContainer.createEl('input', {
                type: 'checkbox',
                attr: {value: tag, id: `tag-${tag}`}
            });
            
            const label = checkboxContainer.createEl('label', {
                text: tag,
                attr: {for: `tag-${tag}`}
            });
            label.style.marginLeft = '8px';
            
            input.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.checked) {
                    this.selectedTags.push(tag);
                } else {
                    this.selectedTags = this.selectedTags.filter(t => t !== tag);
                }
            });
        });

        const buttonContainer = contentEl.createDiv({cls: 'button-container'});
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        
        const cancelButton = buttonContainer.createEl('button', {text: '取消'});
        cancelButton.addEventListener('click', () => {
            this.close();
            this.onSubmit([]);
        });
        
        const confirmButton = buttonContainer.createEl('button', {text: '确定', cls: 'mod-cta'});
        confirmButton.addEventListener('click', () => {
            this.close();
            this.onSubmit(this.selectedTags);
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class CategorySelectorModal extends Modal {
    private selectedCategory: string = '';
    private availableCategories: string[];
    private onSubmit: (categories: string[]) => void;

    constructor(app: App, availableCategories: string[], onSubmit: (categories: string[]) => void) {
        super(app);
        this.availableCategories = availableCategories;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.createEl('h2', {text: '选择分类（单选）'});

        // 添加新分类输入框
        const newCategoryContainer = contentEl.createDiv({cls: 'new-category-container'});
        newCategoryContainer.style.marginBottom = '20px';
        
        const input = newCategoryContainer.createEl('input', {
            type: 'text',
            placeholder: '输入新分类名称'
        });
        input.style.width = '200px';
        input.style.marginRight = '10px';
        
        const addButton = newCategoryContainer.createEl('button', {
            text: '添加新分类',
            cls: 'mod-cta'
        });
        addButton.addEventListener('click', async () => {
            const newCategory = input.value.trim();
            if (newCategory && !this.availableCategories.includes(newCategory)) {
                this.availableCategories.push(newCategory);
                // 更新插件设置
                this.app.plugins.plugins['auto-description'].settings.availableCategories = this.availableCategories;
                await this.app.plugins.plugins['auto-description'].saveSettings();
                // 重新渲染选择框
                this.onOpen();
            }
        });

        // 原有的分类选择列表
        const container = contentEl.createDiv({cls: 'category-container'});
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';
        container.style.marginBottom = '20px';
        
        this.availableCategories.forEach(category => {
            const radioContainer = container.createDiv({cls: 'radio-container'});
            radioContainer.style.marginBottom = '8px';
            
            const input = radioContainer.createEl('input', {
                type: 'radio',
                attr: {
                    value: category, 
                    id: `category-${category}`,
                    name: 'category'
                }
            });
            
            const label = radioContainer.createEl('label', {
                text: category,
                attr: {for: `category-${category}`}
            });
            label.style.marginLeft = '8px';
            
            input.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.checked) {
                    this.selectedCategory = category;
                }
            });
        });

        const buttonContainer = contentEl.createDiv({cls: 'button-container'});
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        
        const cancelButton = buttonContainer.createEl('button', {text: '取消'});
        cancelButton.addEventListener('click', () => {
            this.close();
            this.onSubmit([]);
        });
        
        const confirmButton = buttonContainer.createEl('button', {text: '确定', cls: 'mod-cta'});
        confirmButton.addEventListener('click', () => {
            this.close();
            // 将单个分类转换为数组返回
            this.onSubmit(this.selectedCategory ? [this.selectedCategory] : []);
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
